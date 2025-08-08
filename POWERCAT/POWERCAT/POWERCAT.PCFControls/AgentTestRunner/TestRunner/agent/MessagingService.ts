import type { Activity } from "@microsoft/agents-activity";
import { ConversationManager } from "./ConversationManager";
import { MessageProcessor } from "./MessageProcessor";
import { ResponseValidationEngine } from "../shared/utils/ResponseValidationEngine";
import type {
  AgentResponse,
  AgentTestCase,
  AdaptiveCard,
} from "../shared/models/DataModels";

export class MessagingService {
  private conversationManager: ConversationManager;
  private messageProcessor: MessageProcessor;

  constructor(conversationManager: ConversationManager) {
    this.conversationManager = conversationManager;
    this.messageProcessor = new MessageProcessor();
  }

  /**
   * Helper method to filter activities with text content
   * @param activities - Array of activities to filter
   * @returns Array of text content from activities
   */
  private extractTextFromActivities(activities: Activity[]): string[] {
    return activities
      .filter((activity) => activity.text && activity.text.trim().length > 0)
      .map((activity) => activity.text!.trim());
  }

  /**
   * Helper method to create simplified response format for JSON storage
   * @param activities - Array of activities to simplify
   * @returns Array of simplified response objects
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

      // Include attachments if they exist (for adaptive cards)
      if (
        activity.attachments &&
        Array.isArray(activity.attachments) &&
        activity.attachments.length > 0
      ) {
        result.attachments = activity.attachments;
      }

      // Include suggested actions if they exist (for position-based logic in extractSuggestedActionsJson)
      // Note: These are needed for position-based suggested actions extraction
      // The global suggestedActions field is still used for overall processing
      if (activity.suggestedActions) {
        if (Array.isArray(activity.suggestedActions)) {
          result.suggestedActions = activity.suggestedActions;
        } else {
          // If it's not an array, wrap it in an array or handle accordingly
          result.suggestedActions = [activity.suggestedActions];
        }
      }

      return result;
    });
  }

  /**
   * Helper method to process agent response and extract all components
   * @param activities - Activities from agent response
   * @returns Processed response components
   */
  private processAgentResponse(activities: Activity[]) {
    const processedResponse = this.messageProcessor.processResponse(activities);
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
   * Helper method to validate response against test case expectations
   * @param testCase - Test case with expected values
   * @param processedResponse - The processed response text
   * @param adaptiveCards - Extracted adaptive cards
   * @param allResponsesArray - Array of all response texts
   * @param isContinueConversation - Whether this is for continue conversation (simpler position logic)
   * @returns Object with validation results
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
      // Always use the same position logic regardless of isContinueConversation
      // Send message: handle position logic
      let positionIndex = 0; // Default: First response (index 0) when position not specified

      // Use expectedPositionOfTheResponseActivity if specified, regardless of isStartConversationEventSent
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

    // Perform validation using ResponseValidationEngine
    if (testCase.expectedAttachmentsJson) {
      isMatch = ResponseValidationEngine.compareAttachments(
        testCase.expectedAttachmentsJson,
        adaptiveCards || [],
        testCase.comparisonOperatorCode
      );
    } else if (testCase.expectedResponse) {
      isMatch = ResponseValidationEngine.validateResponse(
        specificResponse,
        testCase.expectedResponse,
        testCase.comparisonOperatorCode
      );
    }

    return { isMatch, specificResponse };
  }

  /**
   * Sends a message to the agent and processes the response
   * Creates a new conversation and handles the complete message exchange
   * @param message - The message text to send to the agent
   * @param testCase - Optional test case for response comparison and validation
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
      // Always create conversation with start event true
      const result = await this.conversationManager.createConversation();
      conversationId = result.conversationId;

      // Store the start conversation activity based on isStartConversationEventSent setting
      // This implements the filtering logic for start conversation activity:
      // - If isStartConversationEventSent = true: include start conversation in allActivities
      // - If isStartConversationEventSent = false: exclude start conversation from allActivities
      // - If testCase is undefined: default to including start conversation (backward compatibility)
      // This affects all downstream processing including cat_actualcompleteresponse, cat_response, cat_result, and cat_resultreason
      if (
        result.startActivity &&
        (testCase?.isStartConversationEventSent ?? true)
      ) {
        allActivities.push(result.startActivity);
      } else if (
        result.startActivity &&
        testCase?.isStartConversationEventSent === false
      ) {
        // Skip start conversation activity when not expected
      }

      // Ensure we have a conversation ID
      if (!conversationId) {
        throw new Error(
          "Failed to create conversation - no conversation ID returned"
        );
      }

      // Send message
      const client = this.conversationManager.getClient();
      if (!client) {
        throw new Error("Client not available");
      }

      // Send the user's message and get the response
      let activities;
      try {
        activities = await client.askQuestionAsync(message, conversationId);
        if (activities && activities.length > 0) {
          // Activities received successfully
        }
      } catch (apiError) {
        // Check if it's a token-related error and try to refresh
        if (
          apiError instanceof Error &&
          (apiError.message.includes("401") ||
            apiError.message.includes("Unauthorized") ||
            apiError.message.includes("token"))
        ) {
          await this.conversationManager.refreshToken();
          const refreshedClient = this.conversationManager.getClient();
          if (refreshedClient) {
            activities = await refreshedClient.askQuestionAsync(
              message,
              conversationId
            );
          } else {
            throw new Error("Failed to get refreshed client");
          }
        } else {
          throw apiError;
        }
      }

      // Add these activities to our collection of all activities
      if (activities && activities.length > 0) {
        allActivities = [...allActivities, ...activities];
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Process all activities to accumulate all responses
      const allResponsesArray = this.extractTextFromActivities(allActivities);
      const simplifiedResponses = this.createSimplifiedResponses(allActivities);
      const allResponsesJson = JSON.stringify(simplifiedResponses);

      // Debug logging to see what's being populated
      console.log(
        "DEBUG: MessagingService sendMessage - allActivities:",
        allActivities
      );
      console.log(
        "DEBUG: MessagingService sendMessage - allResponsesArray:",
        allResponsesArray
      );
      console.log(
        "DEBUG: MessagingService sendMessage - simplifiedResponses:",
        simplifiedResponses
      );
      console.log(
        "DEBUG: MessagingService sendMessage - allResponsesJson:",
        allResponsesJson
      );

      // Process the response components
      const {
        processedResponse,
        adaptiveCards,
        attachments,
        suggestedActions,
      } = this.processAgentResponse(activities);

      if (adaptiveCards && adaptiveCards.length > 0) {
        // Adaptive cards found in response
      }

      // Validate response if test case is provided
      let isMatch: boolean | undefined;
      let specificResponse: string = processedResponse || "";

      if (
        testCase &&
        (testCase.expectedResponse || testCase.expectedAttachmentsJson)
      ) {
        const validation = this.validateResponse(
          testCase,
          processedResponse,
          adaptiveCards,
          allResponsesArray,
          false // sendMessage uses complex position logic
        );
        isMatch = validation.isMatch;
        specificResponse = validation.specificResponse;
      }

      return {
        message: processedResponse || "", // Ensure we always have a string
        timestamp: new Date(),
        success: true,
        responseTime,
        adaptiveCards,
        attachments,
        suggestedActions,
        isMatch,
        conversationId, // This should always be set now
        allResponses: allResponsesJson, // Add full responses (with suggested actions & attachments)
        specificResponse, // Include the specific response used for comparison
        responseIndex: testCase?.expectedPositionOfTheResponseActivity,
        startConversationActivity: result.startActivity || undefined, // Store start activity for multiturn scenarios
      };
    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      return {
        message: "",
        timestamp: new Date(),
        success: false,
        responseTime,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        conversationId: conversationId || undefined, // Convert null to undefined
      };
    }
  }

  /**
   * Continues an existing conversation by sending a message to an existing conversation ID
   * @param message The message to send
   * @param conversationId The existing conversation ID
   * @param testCase Optional test case for comparison
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
      // Include start conversation activity for first child test if conditions are met
      if (
        isFirstChildTest &&
        testCase?.isStartConversationEventSent === true &&
        startConversationActivity
      ) {
        allActivities.push(startConversationActivity);
      }

      // Get the client from conversation manager
      const client = this.conversationManager.getClient();
      if (!client) {
        throw new Error("Client not available for continuing conversation");
      }

      // Send message to existing conversation
      const activities = await client.askQuestionAsync(message, conversationId);

      // Add current activities to allActivities
      if (activities && activities.length > 0) {
        allActivities = [...allActivities, ...activities];
      }

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Process the response using helper methods - use allActivities (which may include start conversation)
      const allResponsesArray = this.extractTextFromActivities(allActivities);
      const simplifiedResponses = this.createSimplifiedResponses(allActivities);
      const allResponsesJson = JSON.stringify(simplifiedResponses);

      const {
        processedResponse,
        adaptiveCards,
        attachments,
        suggestedActions,
      } = this.processAgentResponse(allActivities);

      // Validate response if test case is provided
      let isMatch: boolean | undefined;
      let specificResponse: string = processedResponse || "";

      if (
        testCase &&
        (testCase.expectedResponse || testCase.expectedAttachmentsJson)
      ) {
        const validation = this.validateResponse(
          testCase,
          processedResponse,
          adaptiveCards,
          allResponsesArray,
          true // continueConversation uses simple first response logic
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
      const endTime = Date.now();
      const responseTime = endTime - startTime;

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
}
