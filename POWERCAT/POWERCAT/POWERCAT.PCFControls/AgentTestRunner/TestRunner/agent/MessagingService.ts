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

import type { Activity } from "@microsoft/agents-activity";
import { ConversationManager } from "./ConversationManager";
import { MessageProcessor } from "./MessageProcessor";
import { ResponseValidationEngine } from "../shared/utils/ResponseValidationEngine";
import type {
  AgentResponse,
  AgentTestCase,
  AdaptiveCard,
  TestCaseAttachmentData,
} from "../shared/models/DataModels";

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
   * Sends a pvaSetContext event with external variables to the agent.
   * Must be called after conversation creation but before sending the user message.
   * @param conversationId - The conversation to send the event to
   * @param externalVariablesJson - JSON string of external variables to set
   */
  private async sendExternalVariablesEvent(
    conversationId: string,
    externalVariablesJson: string
  ): Promise<void> {
    const client = this.conversationManager.getClient();
    if (!client) {
      throw new Error("Client not available for sending external variables");
    }

    const parsedValue = JSON.parse(externalVariablesJson);

    const pvaSetContextActivity = {
      type: "event",
      name: "pvaSetContext",
      value: parsedValue,
    };

    await client.sendActivity(
      pvaSetContextActivity as unknown as Activity,
      conversationId
    );
  }

  /**
   * Sends a startConversation event to trigger the Conversation Start topic.
   * Used when the conversation was created without the start event (sendStartEvent=false)
   * to allow pvaSetContext to be sent first.
   * @param conversationId - The conversation to send the event to
   * @returns The start activity responses from the agent
   */
  private async sendStartConversationEvent(
    conversationId: string
  ): Promise<Activity[]> {
    const client = this.conversationManager.getClient();
    if (!client) {
      throw new Error("Client not available for sending start conversation event");
    }

    const startConversationActivity = {
      type: "event",
      name: "startConversation",
    };

    const activities = await client.sendActivity(
      startConversationActivity as unknown as Activity,
      conversationId
    );

    return activities || [];
  }

  /**
   * Sends a message with an attachment to the agent using sendActivity.
   * Used instead of askQuestionAsync when a test case has an attachment.
   * @param message - Message text to send
   * @param conversationId - The conversation ID
   * @param attachmentData - The attachment file data
   * @returns Array of response activities from the agent
   */
  private async sendMessageWithAttachment(
    message: string,
    conversationId: string,
    attachmentData: TestCaseAttachmentData
  ): Promise<Activity[]> {
    const client = this.conversationManager.getClient();
    if (!client) {
      throw new Error("Client not available for sending message with attachment");
    }

    const messageActivity = {
      type: "message",
      text: message,
      attachments: [
        {
          contentType: attachmentData.mimeType,
          name: attachmentData.fileName,
          contentUrl: `data:${attachmentData.mimeType};base64,${attachmentData.base64Content}`,
        },
      ],
    };

    return await client.sendActivity(
      messageActivity as unknown as Activity,
      conversationId
    );
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
      const hasExternalVars = !!testCase?.externalVariablesJson;

      // When external variables exist, defer the startConversation event
      // so pvaSetContext is sent first (variables must be set before Conversation Start topic fires)
      // Order: Initiate → pvaSetContext → startConversation → utterance
      const result = await this.conversationManager.createConversation(!hasExternalVars);
      conversationId = result.conversationId;

      if (!conversationId) {
        throw new Error(
          "Failed to create conversation - no conversation ID returned"
        );
      }

      const client = this.conversationManager.getClient();
      if (!client) {
        throw new Error("Client not available");
      }

      if (hasExternalVars) {
        // Send external variables BEFORE the start conversation event
        await this.sendExternalVariablesEvent(conversationId, testCase!.externalVariablesJson!);

        // Now send the startConversation event to trigger the Conversation Start topic
        // (which can now read the external variables)
        if (testCase?.isStartConversationEventSent ?? true) {
          const startActivities = await this.sendStartConversationEvent(conversationId);
          if (startActivities.length) {
            allActivities.push(...startActivities);
          }
        }
      } else {
        // No external variables — start activity was already sent during createConversation(true)
        if (
          result.startActivity &&
          (testCase?.isStartConversationEventSent ?? true)
        ) {
          allActivities.push(result.startActivity);
        }
      }

      let activities;
      try {
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

      // Send external variables as pvaSetContext event before the user message
      if (testCase?.externalVariablesJson) {
        await this.sendExternalVariablesEvent(conversationId, testCase.externalVariablesJson);
      }

      let activities;
      if (testCase?.attachmentData) {
        activities = await this.sendMessageWithAttachment(message, conversationId, testCase.attachmentData);
      } else {
        activities = await client.askQuestionAsync(message, conversationId);
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

      // Send external variables as pvaSetContext event before the invoke action
      if (testCase?.externalVariablesJson) {
        await this.sendExternalVariablesEvent(conversationId, testCase.externalVariablesJson);
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
