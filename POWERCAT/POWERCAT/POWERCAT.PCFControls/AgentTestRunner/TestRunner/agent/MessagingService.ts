/**
 * MessagingService.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Handles agent communication, message processing, and response validation
 * for Agent testing scenarios. Manages conversation lifecycle,
 * processes agent responses, and validates results against test expectations.
 *
 * Exports:
 *   - MessagingService: Main service for agent communication and response processing.
 *
 * Usage:
 *   const service = new MessagingService(conversationManager);
 *   const response = await service.sendMessage(message, testCase);
 *   const continuedResponse = await service.continueConversation(message, conversationId, testCase);
 */

import { Activity } from "@microsoft/agents-activity";
import { ConversationManager } from "./ConversationManager";
import { MessageProcessor } from "./MessageProcessor";
import { ResponseValidationEngine } from "../shared/utils/ResponseValidationEngine";
import { extractTextFromAttachment } from "./AttachmentTextExtractor";
import { detectAuthorizationAllowAction } from "./AuthorizationCardHandler";
import type {
  AgentResponse,
  AgentTestCase,
  AdaptiveCard,
  TestCaseAttachmentData,
} from "../shared/models/DataModels";

/**
 * Generates an RFC4122 v4 UUID using the Web Crypto API when available,
 * falling back to Math.random when not.
 */
function generateUuid(): string {
  const cryptoObj = (typeof crypto !== "undefined" ? crypto : undefined) as Crypto | undefined;
  if (cryptoObj?.randomUUID) {
    return cryptoObj.randomUUID();
  }
  // Fallback (RFC4122 v4)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * MessagingService manages agent communication and response processing.
 * Provides methods for sending messages, continuing conversations, and validating responses
 * against expected test case outcomes.
 */
export class MessagingService {
  private conversationManager: ConversationManager;
  private messageProcessor: MessageProcessor;

  constructor(conversationManager: ConversationManager) {
    this.conversationManager = conversationManager;
    this.messageProcessor = new MessageProcessor();
  }

  /**
   * Extracts text content from activities array.
   * @param activities - Activities to filter for text content
   * @returns Array of trimmed text strings
   */
  private extractTextFromActivities(activities: Activity[]): string[] {
    return activities
      .filter((activity) => activity.text?.trim())
      .map((activity) => activity.text!.trim());
  }

  /**
   * Creates simplified response format for JSON storage.
   * @param activities - Activities to convert to simplified format
   * @returns Array of simplified response objects with text, attachments, and suggested actions
   */
  private createSimplifiedResponses(
    activities: Activity[]
  ): { text: string; attachments?: unknown[]; suggestedActions?: unknown[] }[] {
    return activities.map((activity) => {
      const result: {
        text: string;
        attachments?: unknown[];
        suggestedActions?: unknown[];
      } = {
        text: activity.text?.trim() || "",
      };

      if (activity.attachments?.length) {
        result.attachments = activity.attachments;
      }

      if (activity.suggestedActions) {
        result.suggestedActions = Array.isArray(activity.suggestedActions)
          ? activity.suggestedActions
          : [activity.suggestedActions];
      }

      return result;
    });
  }

  /**
   * Processes agent response activities and extracts all components.
   * @param activities - Activities from agent response
   * @param testCase - Optional test case to determine processing strategy
   * @returns Object containing processed response, adaptive cards, attachments, and suggested actions
   */
  private processAgentResponse(
    activities: Activity[],
    testCase?: AgentTestCase
  ) {
    // For RESPONSE_MATCH tests, use direct text only (no adaptive card text extraction)
    const processedResponse =
      testCase?.testTypeCode === 1
        ? this.messageProcessor.processDirectTextResponse(activities)
        : this.messageProcessor.processResponse(activities);

    const adaptiveCards =
      this.messageProcessor.extractAdaptiveCards(activities);
    const attachments = this.messageProcessor.extractAttachments(activities);
    const suggestedActions =
      this.messageProcessor.extractSuggestedActions(adaptiveCards);

    return {
      processedResponse,
      adaptiveCards,
      attachments,
      suggestedActions,
    };
  }

  /**
   * Validates response against test case expectations.
   * @param testCase - Test case with expected values
   * @param processedResponse - Processed response text
   * @param adaptiveCards - Extracted adaptive cards
   * @param allResponsesArray - Array of all response texts
   * @param isContinueConversation - Whether this is for continue conversation
   * @returns Validation results with match status and specific response
   */
  private validateResponse(
    testCase: AgentTestCase,
    processedResponse: string,
    adaptiveCards: AdaptiveCard[] | undefined,
    allResponsesArray: string[],
    isContinueConversation = false
  ): { isMatch: boolean | undefined; specificResponse: string } {
    let isMatch: boolean | undefined;
    let specificResponse: string = processedResponse || "";

    if (testCase.expectedResponse && processedResponse) {
      let positionIndex = 0;

      if (testCase.expectedPositionOfTheResponseActivity !== undefined) {
        positionIndex = testCase.expectedPositionOfTheResponseActivity;
      }

      if (positionIndex >= 0 && positionIndex < allResponsesArray.length) {
        specificResponse = allResponsesArray[positionIndex];
      } else if (allResponsesArray.length > 0) {
        const fallbackIndex = Math.min(1, allResponsesArray.length - 1);
        specificResponse = allResponsesArray[fallbackIndex];
      }
    }

    // Validate strictly based on test type, not expected values presence
    if (testCase.testTypeCode === 1) {
      // TEST_TYPES.RESPONSE_MATCH
      // For RESPONSE_MATCH tests, ALWAYS validate text response only
      if (testCase.expectedResponse) {
        isMatch = ResponseValidationEngine.validateResponse(
          specificResponse,
          testCase.expectedResponse,
          testCase.comparisonOperatorCode
        );
      }
    } else if (testCase.testTypeCode === 3) {
      // TEST_TYPES.ADAPTIVE_CARD
      // For ADAPTIVE_CARD tests, validate adaptive cards only
      if (testCase.expectedAttachmentsJson) {
        isMatch = ResponseValidationEngine.validateAdaptiveCards(
          1, // Operation type 1 = Comparison Operator
          testCase.comparisonOperatorCode ?? 1, // Default to Equals
          testCase.expectedAttachmentsJson,
          testCase.validationInstructions || "", // For Contains/Does not contain operations
          adaptiveCards || [],
          true // Return boolean only for MessagingService compatibility
        ) as boolean;
      }
    }

    return { isMatch, specificResponse };
  }

  /**
   * Returns true for attachment types Copilot Studio agents process natively
   * (images via vision, PDFs via document AI). For these types, sending the
   * binary alone is sufficient — the agent will read it directly. Forcing a
   * "could not extract" envelope on these types is harmful because it
   * suppresses the agent's own multimodal capabilities.
   */
  private isAgentNativelyHandled(
    mimeType: string,
    fileName: string
  ): boolean {
    const m = (mimeType || "").toLowerCase();
    const n = (fileName || "").toLowerCase();
    if (m === "application/pdf" || n.endsWith(".pdf")) return true;
    if (m.startsWith("image/")) return true;
    if (/\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(n)) return true;
    return false;
  }

  /**
   * Builds the text body for an attachment-bearing message. Three modes:
   *
   * 1. Client-side extraction produced text (PPTX/DOCX/XLSX/TXT/CSV/JSON/XML/...)
   *    → inline the text verbatim and tell the agent to use it. Prevents the
   *    generative-answer topic from web-searching the user utterance.
   *
   * 2. No extracted text, but the format is one Copilot Studio handles natively
   *    (PDF, PNG/JPEG/WEBP/GIF/BMP/SVG)
   *    → send a minimal prompt that lets the agent's own vision / document AI
   *    process the attached binary. Do NOT add a "could not read" guard
   *    — that would suppress the agent's native capability.
   *
   * 3. No extracted text and not natively handled
   *    → wrap the utterance in a guard that tells the agent an attachment is
   *    present but unreadable client-side, and explicitly forbid web search
   *    (prevents the generative-answer topic from returning irrelevant Bing
   *    results).
   *
   * The binary file is always attached on the same activity regardless of mode.
   */
  private buildMessageWithExtractedText(
    utterance: string,
    attachmentData: TestCaseAttachmentData,
    extractedText: string
  ): string {
    if (extractedText) {
      return (
        `The user has attached a file named "${attachmentData.fileName}" ` +
        `(${attachmentData.mimeType}). The complete text content of this file is ` +
        `included verbatim between the markers below. Please use only this ` +
        `inlined file content to answer the user's request. Do not perform a ` +
        `web search — the answer is contained in the content below.\n\n` +
        `--- BEGIN ATTACHED FILE CONTENT (${attachmentData.fileName}) ---\n` +
        `${extractedText}\n` +
        `--- END ATTACHED FILE CONTENT ---\n\n` +
        `User request:\n${utterance}`
      );
    }

    if (this.isAgentNativelyHandled(attachmentData.mimeType, attachmentData.fileName)) {
      return (
        `The user has attached a file named "${attachmentData.fileName}" ` +
        `(${attachmentData.mimeType}). Use your built-in document/vision ` +
        `understanding to read the attached file and answer the request.\n\n` +
        `User request:\n${utterance}`
      );
    }

    return (
      `The user has attached a binary file named "${attachmentData.fileName}" ` +
      `(${attachmentData.mimeType}). The text content of this file could not be ` +
      `extracted client-side by the test runner. Do not perform a web search. ` +
      `Respond only based on (a) the file name and type and (b) the user's ` +
      `request below. If you cannot fulfil the request without the file's ` +
      `content, reply that you were unable to read the attached file.\n\n` +
      `User request:\n${utterance}`
    );
  }

  /**
   * Sends one message activity containing both utterance text and attachment.
   *
   * The activity carries the original binary file in `attachments[0]`, and the
   * `text` field is enriched with the file's client-side-extracted content (for
   * supported formats) so the agent can summarize even without server-side
   * binary parsing.
   */
  private async sendMessageWithAttachment(
    message: string,
    conversationId: string,
    attachmentData: TestCaseAttachmentData
  ): Promise<Activity[]> {
    const client = this.conversationManager.getClient();
    if (!client) {
      throw new Error("Client not initialized for attachment send");
    }

    const extractedText = await extractTextFromAttachment(attachmentData);
    const enrichedText = this.buildMessageWithExtractedText(
      message,
      attachmentData,
      extractedText
    );

    const dataUri = `data:${attachmentData.mimeType};base64,${attachmentData.base64Content}`;
    const activityId = generateUuid();
    const activity = new Activity("message");

    Object.assign(activity, {
      id: activityId,
      text: enrichedText,
      textFormat: "plain",
      locale: "en-US",
      inputHint: "acceptingInput",
      from: { id: "user", role: "user", name: "Agent Test Runner" },
      attachments: [
        {
          contentType: attachmentData.mimeType,
          name: attachmentData.fileName,
          contentUrl: dataUri,
          content: {
            name: attachmentData.fileName,
            mimeType: attachmentData.mimeType,
            data: attachmentData.base64Content,
          },
        },
      ],
    });

    const activities = await client.sendActivity(activity, conversationId);

    return activities || [];
  }

  /**
   * Auto-allow handling for the connector authorization adaptive card.
   *
   * Copilot Studio agents that use connectors (SharePoint, Dataverse, Power
   * Automate, etc.) inject an "Allow / Cancel" adaptive card as the first
   * response on every new conversation. If the test response is that card,
   * the test fails because the card is not the real answer. This helper
   * detects the card, sends the Allow invoke (`adaptiveCard/action`) using the
   * card's own payload, and returns the continuation activities so the caller
   * can treat them as the real response for validation.
   *
   * Loops up to MAX_AUTO_ALLOW_ITERATIONS times so chained connector prompts
   * (e.g. the agent invokes a second connector right after the first Allow)
   * are also dismissed automatically in a single test run.
   *
   * @param responseActivities Activities just returned by the agent.
   * @param conversationId Current conversation ID.
   * @returns The continuation activities (auth-card free) when at least one
   *   Allow was submitted; otherwise `null`. If an invoke fails on the first
   *   iteration the caller falls back to the original response; if it fails
   *   on a later iteration or the iteration cap is hit, the most recent
   *   continuation is returned as-is.
   */
  private async autoAllowConnectorAuthorization(
    responseActivities: Activity[],
    conversationId: string
  ): Promise<Activity[] | null> {
    const MAX_AUTO_ALLOW_ITERATIONS = 10;

    let current = responseActivities;
    let detected = detectAuthorizationAllowAction(current);
    if (!detected) return null;

    const client = this.conversationManager.getClient();
    if (!client) return null;

    // Submit one invoke (adaptiveCard/action). Refresh the token once on 401/
    // Unauthorized/token errors and retry — mirrors invokeAdaptiveCardAction.
    const sendInvoke = async (payload: unknown): Promise<Activity[]> => {
      const invokeActivity = new Activity("invoke");
      Object.assign(invokeActivity, {
        id: generateUuid(),
        name: "adaptiveCard/action",
        value: payload,
        from: { id: "user", role: "user", name: "Agent Test Runner" },
        locale: "en-US",
      });

      const runOnce = async (): Promise<Activity[]> => {
        const c = this.conversationManager.getClient();
        if (!c) throw new Error("client unavailable");
        const result = await c.sendActivity(invokeActivity, conversationId);
        return result || [];
      };

      try {
        return await runOnce();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (
          err instanceof Error &&
          (message.includes("401") ||
            message.includes("Unauthorized") ||
            message.includes("token"))
        ) {
          await this.conversationManager.refreshToken();
          return await runOnce();
        }
        throw err;
      }
    };

    for (let iteration = 1; iteration <= MAX_AUTO_ALLOW_ITERATIONS; iteration++) {
      let continuation: Activity[];
      try {
        continuation = await sendInvoke(detected.actionPayload);
      } catch {
        // First iteration failure → caller falls back to the original card.
        // Later iteration failure → surface the latest continuation as final
        // so the test result reflects the partial handshake.
        if (iteration === 1) return null;
        return current;
      }

      const nextDetected = detectAuthorizationAllowAction(continuation);
      if (!nextDetected) {
        return continuation;
      }

      current = continuation;
      detected = nextDetected;
    }

    return current;
  }

  /**
   * Sends a message to the agent and processes the response.
   * Creates a new conversation and handles the complete message exchange.
   * @param message - Message text to send to the agent
   * @param testCase - Optional test case for response validation
   * @returns Promise resolving to AgentResponse with processed results
   */
  async sendMessage(
    message: string,
    testCase?: AgentTestCase
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    let conversationId: string | null = null;
    let allActivities: Activity[] = [];

    try {
      const result = await this.conversationManager.createConversation();
      conversationId = result.conversationId;

      // Include start conversation activity based on test case setting
      if (
        result.startActivity &&
        (testCase?.isStartConversationEventSent ?? true)
      ) {
        allActivities.push(result.startActivity);
      }

      if (!conversationId) {
        throw new Error(
          "Failed to create conversation - no conversation ID returned"
        );
      }

      const client = this.conversationManager.getClient();
      if (!client) {
        throw new Error("Client not available");
      }

      let activities;
      try {
        if (testCase?.includeAttachment === true && !testCase.attachmentData) {
          throw new Error(
            `Attachment is enabled for test "${testCase.name}" but attachment data could not be loaded.`
          );
        }

        if (testCase?.attachmentData) {
          activities = await this.sendMessageWithAttachment(message, conversationId, testCase.attachmentData);
        } else {
          activities = await client.askQuestionAsync(message, conversationId);
        }
      } catch (apiError) {
        // Handle token-related errors with refresh
        if (
          apiError instanceof Error &&
          (apiError.message.includes("401") ||
            apiError.message.includes("Unauthorized") ||
            apiError.message.includes("token"))
        ) {
          await this.conversationManager.refreshToken();
          const refreshedClient = this.conversationManager.getClient();
          if (refreshedClient) {
            if (testCase?.attachmentData) {
              activities = await this.sendMessageWithAttachment(message, conversationId, testCase.attachmentData);
            } else {
              activities = await refreshedClient.askQuestionAsync(
                message,
                conversationId
              );
            }
          } else {
            throw new Error("Failed to get refreshed client");
          }
        } else {
          throw apiError;
        }
      }

      // Auto-handle the connector authorization "Allow / Cancel" adaptive card.
      // When present in the first response, submit Allow transparently and use
      // the continuation activities as the real response for validation. Loops
      // internally to handle chained connector prompts. Dismissed auth cards
      // are NOT surfaced to the visible response so the test result reflects
      // only the agent's actual reply.
      if (activities?.length) {
        const finalActivities = await this.autoAllowConnectorAuthorization(
          activities,
          conversationId
        );
        if (finalActivities) {
          activities = finalActivities;
        }
      }

      if (activities?.length) {
        allActivities = [...allActivities, ...activities];
      }

      const responseTime = Date.now() - startTime;
      const allResponsesArray = this.extractTextFromActivities(allActivities);
      const simplifiedResponses = this.createSimplifiedResponses(allActivities);
      const allResponsesJson = JSON.stringify(simplifiedResponses);

      const {
        processedResponse,
        adaptiveCards,
        attachments,
        suggestedActions,
      } = this.processAgentResponse(activities, testCase);

      let isMatch: boolean | undefined;
      let specificResponse: string = processedResponse || "";

      if (testCase?.expectedResponse || testCase?.expectedAttachmentsJson) {
        const validation = this.validateResponse(
          testCase,
          processedResponse,
          adaptiveCards,
          allResponsesArray,
          false
        );
        isMatch = validation.isMatch;
        specificResponse = validation.specificResponse;
      }

      return {
        message: processedResponse || "",
        timestamp: new Date(),
        success: true,
        responseTime,
        adaptiveCards,
        attachments,
        suggestedActions,
        isMatch,
        conversationId,
        allResponses: allResponsesJson,
        specificResponse,
        responseIndex: testCase?.expectedPositionOfTheResponseActivity,
        startConversationActivity: result.startActivity || undefined,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        message: "",
        timestamp: new Date(),
        success: false,
        responseTime,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        conversationId: conversationId || undefined,
      };
    }
  }

  /**
   * Continues an existing conversation by sending a message.
   * @param message - Message to send
   * @param conversationId - Existing conversation ID
   * @param testCase - Optional test case for validation
   * @param isFirstChildTest - Whether this is first child test in multiturn scenario
   * @param startConversationActivity - Start conversation activity for context
   * @returns Promise<AgentResponse>
   */
  async continueConversation(
    message: string,
    conversationId: string,
    testCase?: AgentTestCase,
    isFirstChildTest = false,
    startConversationActivity?: Activity
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    let allActivities: Activity[] = [];

    try {
      // Include start conversation activity for first child test if needed
      if (
        isFirstChildTest &&
        testCase?.isStartConversationEventSent === true &&
        startConversationActivity
      ) {
        allActivities.push(startConversationActivity);
      }

      const client = this.conversationManager.getClient();
      if (!client) {
        throw new Error("Client not available for continuing conversation");
      }

      let activities;
      if (testCase?.attachmentData) {
        activities = await this.sendMessageWithAttachment(message, conversationId, testCase.attachmentData);
      } else {
        activities = await client.askQuestionAsync(message, conversationId);
      }

      // Auto-handle the connector authorization "Allow / Cancel" adaptive card
      // on continued conversations too (a new connector can be referenced
      // mid-conversation, triggering the prompt on a later turn). Loops to
      // handle chained connector prompts. Dismissed auth cards are NOT
      // surfaced to the visible response so the test result reflects only
      // the agent's actual reply.
      if (activities?.length) {
        const finalActivities = await this.autoAllowConnectorAuthorization(
          activities,
          conversationId
        );
        if (finalActivities) {
          activities = finalActivities;
        }
      }

      if (activities?.length) {
        allActivities = [...allActivities, ...activities];
      }

      const responseTime = Date.now() - startTime;
      const allResponsesArray = this.extractTextFromActivities(allActivities);
      const simplifiedResponses = this.createSimplifiedResponses(allActivities);
      const allResponsesJson = JSON.stringify(simplifiedResponses);

      const {
        processedResponse,
        adaptiveCards,
        attachments,
        suggestedActions,
      } = this.processAgentResponse(allActivities, testCase);

      let isMatch: boolean | undefined;
      let specificResponse: string = processedResponse || "";

      if (testCase?.expectedResponse || testCase?.expectedAttachmentsJson) {
        const validation = this.validateResponse(
          testCase,
          processedResponse,
          adaptiveCards,
          allResponsesArray,
          true
        );
        isMatch = validation.isMatch;
        specificResponse = validation.specificResponse;
      }

      return {
        message: processedResponse || "",
        timestamp: new Date(),
        success: true,
        responseTime,
        adaptiveCards,
        attachments,
        suggestedActions,
        isMatch,
        conversationId,
        allResponses: allResponsesJson,
        specificResponse,
        responseIndex: testCase?.expectedPositionOfTheResponseActivity,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        message: "",
        timestamp: new Date(),
        success: false,
        responseTime,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        conversationId,
      };
    }
  }

  /**
   * Invoke an adaptive card action
   * @param actionPayload - The payload from cat_adaptivecardpayload to merge into value property
   * @param conversationId - Existing conversation ID for multiturn scenarios
   * @param testCase - Optional test case for validation context
   * @returns Promise resolving to AgentResponse with action result
   */
  async invokeAdaptiveCardAction(
    actionPayload: string,
    conversationId: string,
    testCase?: AgentTestCase
  ): Promise<AgentResponse> {
    const startTime = Date.now();
    let allActivities: Activity[] = [];

    try {
      // Parse the action payload from the test case
      let parsedPayload: Record<string, unknown>;
      try {
        parsedPayload = JSON.parse(actionPayload);
      } catch (parseError) {
        throw new Error(`Invalid adaptive card payload JSON: ${parseError}`);
      }

      const client = this.conversationManager.getClient();
      if (!client) {
        throw new Error("Client not available for invoke action");
      }

      // Create a simple invoke activity object and cast to Activity
      const invokeActivityData = {
        type: "invoke",
        name: "adaptiveCard/action",
        value: parsedPayload,
      };

      let activities;
      try {
        // Use sendActivity with the simple object, let the client handle the conversion
        activities = await client.sendActivity(
          invokeActivityData as unknown as Activity,
          conversationId
        );
      } catch (apiError) {
        // Handle token-related errors with refresh
        if (
          apiError instanceof Error &&
          (apiError.message.includes("401") ||
            apiError.message.includes("Unauthorized") ||
            apiError.message.includes("token"))
        ) {
          await this.conversationManager.refreshToken();
          const refreshedClient = this.conversationManager.getClient();
          if (refreshedClient) {
            activities = await refreshedClient.sendActivity(
              invokeActivityData as unknown as Activity,
              conversationId
            );
          } else {
            throw new Error("Failed to get refreshed client");
          }
        } else {
          throw apiError;
        }
      }

      if (activities?.length) {
        allActivities = [...allActivities, ...activities];
      }

      const responseTime = Date.now() - startTime;
      const simplifiedResponses = this.createSimplifiedResponses(allActivities);
      const allResponsesJson = JSON.stringify(simplifiedResponses);

      const {
        processedResponse,
        adaptiveCards,
        attachments,
        suggestedActions,
      } = this.processAgentResponse(allActivities, testCase);

      return {
        message: processedResponse || "",
        timestamp: new Date(),
        success: true,
        responseTime,
        adaptiveCards,
        attachments,
        suggestedActions,
        isMatch: true, // Will be validated in AgentTestResultOperations
        conversationId,
        allResponses: allResponsesJson,
        specificResponse: processedResponse || "",
        responseIndex: 0,
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      return {
        message: "",
        timestamp: new Date(),
        success: false,
        responseTime,
        error: `Error invoking adaptive card action: ${errorMessage}`,
        conversationId,
      };
    }
  }
}
