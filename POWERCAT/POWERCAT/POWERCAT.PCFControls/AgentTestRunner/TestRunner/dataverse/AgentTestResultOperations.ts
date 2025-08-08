/**
 * Agent Test Result Operations for Dataverse
 * Handles all CRUD operations related to agent test results
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import { ResponseValidationEngine } from "../shared/utils/ResponseValidationEngine";
import type {
  AgentTestCase,
  AgentResponse,
  AgentConfiguration,
} from "../shared/models/DataModels";

/**
 * Interface for parsed agent response structure
 * Note: suggestedActions are handled separately and not included in allResponses
 */
interface ParsedAgentResponse {
  text?: string;
  attachments?: unknown[];
  [key: string]: unknown;
}

/**
 * Test type mapping constants
 */
const TEST_TYPES = {
  RESPONSE_MATCH: 1,
  TOPIC_MATCH: 2,
  ADAPTIVE_CARD: 3,
  GENERATIVE_ANSWER: 4,
  MULTITURN: 5,
  PLAN_VALIDATION: 6,
} as const;

/**
 * Result code constants
 */
const RESULT_CODES = {
  SUCCESS: 1,
  FAILED: 2,
  UNKNOWN: 3,
  ERROR: 4,
  PENDING: 5,
} as const;

/**
 * Service for managing agent test result operations in Dataverse
 * Handles creation, updates, and business logic for test results
 */
export class AgentTestResultOperations extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "AgentTestResultOperations");
  }

  /**
   * Create a test result record in Dataverse
   * @param testCase - The test case being executed
   * @param testRunId - GUID of the current test run
   * @param agentResponse - Response received from the agent
   * @param configuration - Agent configuration settings
   * @param parentTestResultId - Optional parent test result ID for multiturn tests
   * @returns Promise resolving to test result ID or null
   */
  async createTestResult(
    testCase: AgentTestCase,
    testRunId: string,
    agentResponse: AgentResponse,
    configuration: AgentConfiguration,
    parentTestResultId?: string
  ): Promise<string | null> {
    return this.executeOperationSafely(async () => {
      // Debug logging to see the actual agentResponse object structure
      console.log(`DEBUG: createTestResult for test case: ${testCase.name}`);
      console.log("DEBUG: agentResponse object:", {
        message: agentResponse.message,
        specificResponse: agentResponse.specificResponse,
        allResponses: agentResponse.allResponses,
        adaptiveCards: agentResponse.adaptiveCards,
        allResponsesType: typeof agentResponse.allResponses,
        allResponsesLength: agentResponse.allResponses
          ? agentResponse.allResponses.length
          : "N/A",
      });

      // Extract response data for validation
      const agentResponseText =
        agentResponse.specificResponse || agentResponse.message || "";
      const testType = testCase.testTypeCode;
      const adaptiveCardJson = this.extractAdaptiveCardJson(agentResponse);
      const expectedAttachmentsJson = testCase.expectedAttachmentsJson || "";

      // Generate position-based response value FIRST (before validation)
      const responseValue = this.generateResponseValue(
        agentResponseText,
        adaptiveCardJson,
        testCase,
        agentResponse
      );

      // Calculate result code based on business logic using position-based response
      const resultCode = this.calculateResultCode(
        testCase,
        configuration,
        responseValue, // Use position-based response instead of agentResponseText
        adaptiveCardJson,
        expectedAttachmentsJson,
        agentResponse.isMatch, // Pass the isMatch result from MessagingService
        agentResponse // Pass the full agentResponse for adaptive cards access
      );

      // Generate result reason using position-based response
      const resultReason = this.generateResultReason(
        testCase,
        configuration,
        responseValue, // Use position-based response instead of agentResponseText
        resultCode,
        agentResponse // Pass agentResponse for adaptive card handling
      );

      // Generate unique name for the test result
      const uniqueName = this.generateUniqueName(testCase, agentResponse);

      // Calculate timing information
      const { messageTimestamp, currentTime } =
        this.calculateTimestamps(agentResponse);

      // Build test result data object
      const testResultData = this.buildTestResultData(
        testCase,
        testRunId,
        agentResponse,
        uniqueName,
        resultCode,
        resultReason,
        responseValue,
        messageTimestamp,
        currentTime,
        parentTestResultId
      );

      try {
        const response = await this.context.webAPI.createRecord(
          "cat_copilottestresult",
          testResultData
        );

        return response.id;
      } catch (error) {
        // Check if it's a table not found error
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        if (errorMessage.includes("Resource not found")) {
          // Handle resource not found error
        }

        throw error;
      }
    }, "Create test result");
  }

  /**
   * Create a placeholder test result for multiturn parent tests
   * @param parentTestCase - The parent test case
   * @param testRunId - GUID of the current test run
   * @param conversationId - Conversation ID for the multiturn test
   * @returns Promise resolving to test result ID or null
   */
  async createPlaceholderTestResult(
    parentTestCase: AgentTestCase,
    testRunId: string,
    conversationId: string
  ): Promise<string | null> {
    return this.executeOperationSafely(async () => {
      const testResultData = {
        cat_name: conversationId,
        cat_resultcode: RESULT_CODES.PENDING,
        cat_resultreason: "",
        cat_response: "",
        cat_testtypecode: parentTestCase.testTypeCode,

        // Explicitly override inherited fields to ensure placeholder behavior
        cat_testutterance: "", // Empty to override inherited value from test case binding
        cat_expectedresponse: "", // Empty for placeholder - always use expectedResponse directly
        cat_expectedtopicname: "", // Empty for placeholder
        cat_comparisonoperator: null, // No comparison for placeholder
        cat_operationtypecode: parentTestCase.operationTypeCode ?? null, // Copy operation type from parent test case
        cat_adaptivecardpayload: "", // Empty for placeholder
        cat_generativeansweroutcomecode: null, // No outcome for placeholder
        cat_passthreshold: parentTestCase.cat_passthreshold ?? null, // Copy pass threshold from parent test case
        cat_externalvariablesjson: "", // Empty for placeholder
        cat_expectedattachmentsjson: "", // Empty for placeholder
        cat_attachmentsjson: "", // Empty for placeholder
        cat_suggestedactionsjson: "", // Null for placeholder

        // Timestamp fields - use proper types for placeholder
        cat_messagesenttimestamp: new Date().toISOString(),
        cat_responsereceivedtimestamp: new Date().toISOString(),
        cat_latencyms: 0, // Integer field - use 0 instead of empty string

        // Relationships
        "cat_CopilotTestRunId@odata.bind": `/cat_copilottestruns(${testRunId})`,
        "cat_CopilotTestId@odata.bind": `/cat_copilottests(${parentTestCase.id})`,
      };

      try {
        const response = await this.context.webAPI.createRecord(
          "cat_copilottestresult",
          testResultData
        );

        return response.id;
      } catch (error) {
        // Check if it's a table not found error
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        throw error;
      }
    }, "Create placeholder test result");
  }

  /**
   * Update parent test result based on child test results
   * @param parentTestResultId - GUID of parent test result
   * @param childResults - Array of child test result codes and critical flags
   * @returns Promise resolving to boolean indicating success
   */
  async updateParentTestResult(
    parentTestResultId: string,
    childResults: { resultCode: number; critical: boolean }[]
  ): Promise<boolean> {
    const result = await this.executeOperationSafely(async () => {
      // Determine parent result based on child results following the specified logic
      const hasCriticalError = childResults.some(
        (result) => result.critical && result.resultCode === RESULT_CODES.ERROR
      );
      const hasCriticalFailed = childResults.some(
        (result) => result.critical && result.resultCode === RESULT_CODES.FAILED
      );
      const hasCriticalUnknown = childResults.some(
        (result) =>
          result.critical && result.resultCode === RESULT_CODES.UNKNOWN
      );
      const hasPending = childResults.some(
        (result) => result.resultCode === RESULT_CODES.PENDING
      );
      const allPassed = childResults.every(
        (result) => result.resultCode === RESULT_CODES.SUCCESS
      );

      let parentResultCode: number;

      // Priority order based on requirements:
      if (hasCriticalError) {
        // Critical subtest failing with "error" makes parent "error"
        parentResultCode = RESULT_CODES.ERROR;
      } else if (hasCriticalFailed) {
        // Critical subtest failing with "failed" makes parent "failed"
        parentResultCode = RESULT_CODES.FAILED;
      } else if (hasCriticalUnknown) {
        // Critical subtest failing with "unknown" makes parent "unknown"
        parentResultCode = RESULT_CODES.UNKNOWN;
      } else if (hasPending) {
        // Any pending subtests make parent pending (if no critical failures)
        parentResultCode = RESULT_CODES.PENDING;
      } else if (allPassed) {
        // All tests passed successfully
        parentResultCode = RESULT_CODES.SUCCESS;
      } else {
        // Mixed results (non-critical failures don't affect parent result per requirements)
        parentResultCode = RESULT_CODES.SUCCESS;
      }

      await this.context.webAPI.updateRecord(
        "cat_copilottestresult",
        parentTestResultId,
        {
          cat_resultcode: parentResultCode,
          cat_resultreason: "",
          cat_responsereceivedtimestamp: new Date().toISOString(),
        }
      );

      return true;
    }, "Update parent test result");

    return result ?? false;
  }

  /**
   * Get test result code by ID
   * @param testResultId - GUID of the test result
   * @returns Promise resolving to result code or null
   */
  async getTestResultCode(testResultId: string): Promise<number | null> {
    return this.executeOperationSafely(async () => {
      const response = await this.context.webAPI.retrieveRecord(
        "cat_copilottestresult",
        testResultId,
        "?$select=cat_resultcode"
      );
      return response.cat_resultcode as number;
    }, "Get test result code");
  }

  /**
   * Get test execution history from cat_copilottestresult table
   * @param testRunId - Test run ID to filter results (required)
   * @returns Promise resolving to test execution history summary
   */
  async getTestExecutionHistory(testRunId: string): Promise<{
    success: number;
    failed: number;
    unknown: number;
    error: number;
    pending: number;
    total: number;
  }> {
    const result = await this.executeOperationSafely(async () => {
      // Only count parent test results (exclude child tests from multiturn conversations)
      // Child tests have cat_Parent field populated, parent tests have cat_Parent as null
      const queryString = `?$select=cat_resultcode&$filter=_cat_copilottestrunid_value eq '${testRunId}' and cat_Parent eq null`;
      const response = await this.context.webAPI.retrieveMultipleRecords(
        "cat_copilottestresult",
        queryString
      );

      // Initialize counts
      const counts = {
        success: 0, // Code 1
        failed: 0, // Code 2
        unknown: 0, // Code 3
        error: 0, // Code 4
        pending: 0, // Code 5
        total: 0,
      };

      // Process each individual test result
      response.entities.forEach((entity) => {
        const resultCode = entity.cat_resultcode as number;
        counts.total += 1;

        switch (resultCode) {
          case 1:
            counts.success += 1;
            break;
          case 2:
            counts.failed += 1;
            break;
          case 3:
            counts.unknown += 1;
            break;
          case 4:
            counts.error += 1;
            break;
          case 5:
            counts.pending += 1;
            break;
          default:
            // Handle any unexpected codes as unknown
            counts.unknown += 1;
            break;
        }
      });

      return counts;
    }, "Get test execution history");

    // Return default values if operation failed
    return (
      result ?? {
        success: 0,
        failed: 0,
        unknown: 0,
        error: 0,
        pending: 0,
        total: 0,
      }
    );
  }

  // Private helper methods
  private extractAdaptiveCardJson(agentResponse: AgentResponse): string {
    return agentResponse.adaptiveCards && agentResponse.adaptiveCards.length > 0
      ? JSON.stringify(agentResponse.adaptiveCards)
      : "";
  }

  /**
   * Extract suggested actions JSON from agent response based on position column
   * Implements Power Automate expression logic for position-based suggested actions extraction
   * Power Automate Expression:
   * if(empty(Agent Response based on position column), null,
   *    if(empty(suggestedActions of Agent Response based on position column), null,
   *       string(suggestedActions of Agent Response based on position column)))
   *
   * @param agentResponse - The agent response containing allResponses data (includes suggested actions)
   * @param testCase - The test case for context (currently unused but kept for consistency)
   * @returns String JSON of suggested actions or null
   */
  private extractSuggestedActionsJson(
    agentResponse: AgentResponse,
    testCase: AgentTestCase
  ): string | null {
    console.log(
      "[extractSuggestedActionsJson] Starting position-based extraction..."
    );
    console.log(
      "[extractSuggestedActionsJson] agentResponse.responseIndex:",
      agentResponse.responseIndex
    );
    console.log(
      "[extractSuggestedActionsJson] agentResponse.allResponses:",
      agentResponse.allResponses
    );

    // Power Automate Expression Implementation:
    // if(empty(Agent Response based on position column), null,
    //    if(empty(suggestedActions of Agent Response based on position column), null,
    //       string(suggestedActions of Agent Response based on position column)))

    // First check: empty(Agent Response based on position column) → return null
    if (!agentResponse.allResponses) {
      console.log(
        "[extractSuggestedActionsJson] allResponses is empty, returning null"
      );
      return null;
    }

    let allResponsesArray;
    try {
      allResponsesArray = JSON.parse(agentResponse.allResponses);
      if (!Array.isArray(allResponsesArray) || allResponsesArray.length === 0) {
        console.log(
          "[extractSuggestedActionsJson] allResponses is not a valid array, returning null"
        );
        return null;
      }
    } catch (error) {
      console.log(
        "[extractSuggestedActionsJson] Error parsing allResponses:",
        error
      );
      return null;
    }

    // Simple position logic: null/undefined = 0, otherwise use specified position
    const position = agentResponse.responseIndex ?? 0;

    // Debug logging for position validation
    console.log(
      "[extractSuggestedActionsJson] Using position:",
      position,
      "Array length:",
      allResponsesArray.length
    );

    // Check if position is within bounds
    if (position < 0 || position >= allResponsesArray.length) {
      console.log(
        "[extractSuggestedActionsJson] Position out of bounds, returning null"
      );
      return null;
    }

    // Get response at the specified position
    const responseAtPosition = allResponsesArray[position];
    console.log(
      "[extractSuggestedActionsJson] Response at position:",
      responseAtPosition
    );

    // Second check: empty(suggestedActions of Agent Response based on position column) → return null
    if (
      !responseAtPosition ||
      !responseAtPosition.suggestedActions ||
      !Array.isArray(responseAtPosition.suggestedActions) ||
      responseAtPosition.suggestedActions.length === 0
    ) {
      console.log(
        "[extractSuggestedActionsJson] No suggested actions at position, returning null"
      );
      return null;
    }

    // Final: string(suggestedActions of Agent Response based on position column)
    try {
      const suggestedActionsJson = JSON.stringify(
        responseAtPosition.suggestedActions
      );
      console.log(
        "[extractSuggestedActionsJson] Returning suggested actions JSON:",
        suggestedActionsJson
      );
      return suggestedActionsJson;
    } catch (error) {
      console.log(
        "[extractSuggestedActionsJson] Error stringifying suggested actions:",
        error
      );
      return null;
    }
  }

  /**
   * Extract attachments JSON from agent response based on position column
   * Implements Power Automate expression logic for position-based attachment extraction
   * Power Automate Expression:
   * if(empty(Agent Response based on position column), "",
   *    if(empty(attachments of Agent Response based on position column), "",
   *       string(attachments of Agent Response based on position column)))
   *
   * @param agentResponse - The agent response containing all responses data
   * @param testCase - The test case for context (currently unused but kept for consistency)
   * @returns String JSON of attachments or empty string
   */
  private extractAttachmentsJson(
    agentResponse: AgentResponse,
    testCase: AgentTestCase
  ): string {
    console.log(
      "[extractAttachmentsJson] Starting position-based extraction..."
    );
    console.log(
      "[extractAttachmentsJson] agentResponse.responseIndex:",
      agentResponse.responseIndex
    );
    console.log(
      "[extractAttachmentsJson] agentResponse.allResponses:",
      agentResponse.allResponses
    );

    // Power Automate Expression Implementation:
    // if(empty(Agent Response based on position column), "",
    //    if(empty(attachments of Agent Response based on position column), "",
    //       string(attachments of Agent Response based on position column)))

    // First check: empty(Agent Response based on position column) → return ""
    if (!agentResponse.allResponses) {
      console.log(
        "[extractAttachmentsJson] allResponses is empty, returning empty string"
      );
      return "";
    }

    let allResponsesArray;
    try {
      allResponsesArray = JSON.parse(agentResponse.allResponses);
      if (!Array.isArray(allResponsesArray) || allResponsesArray.length === 0) {
        console.log(
          "[extractAttachmentsJson] allResponses is not a valid array, returning empty string"
        );
        return "";
      }
    } catch (error) {
      console.log(
        "[extractAttachmentsJson] Error parsing allResponses:",
        error
      );
      return "";
    }

    // Simple position logic: null/undefined = 0, otherwise use specified position
    const position = agentResponse.responseIndex ?? 0;

    // Debug logging for position validation
    console.log(
      "[extractAttachmentsJson] Using position:",
      position,
      "Array length:",
      allResponsesArray.length
    );

    // Check if position is within bounds
    if (position < 0 || position >= allResponsesArray.length) {
      console.log(
        "[extractAttachmentsJson] Position out of bounds, returning empty string"
      );
      return "";
    }

    // Get response at the specified position
    const responseAtPosition = allResponsesArray[position];
    console.log(
      "[extractAttachmentsJson] Response at position:",
      responseAtPosition
    );

    // Second check: empty(attachments of Agent Response based on position column) → return ""
    if (
      !responseAtPosition ||
      !responseAtPosition.attachments ||
      !Array.isArray(responseAtPosition.attachments) ||
      responseAtPosition.attachments.length === 0
    ) {
      console.log(
        "[extractAttachmentsJson] No attachments at position, returning empty string"
      );
      return "";
    }

    // Final: string(attachments of Agent Response based on position column)
    try {
      const attachmentsJson = JSON.stringify(responseAtPosition.attachments);
      console.log(
        "[extractAttachmentsJson] Returning attachments JSON:",
        attachmentsJson
      );
      return attachmentsJson;
    } catch (error) {
      console.log(
        "[extractAttachmentsJson] Error stringifying attachments:",
        error
      );
      return "";
    }
  }

  private calculateResultCode(
    testCase: AgentTestCase,
    configuration: AgentConfiguration,
    agentResponseText: string,
    adaptiveCardJson: string,
    expectedAttachmentsJson: string,
    isMatch?: boolean, // Add isMatch parameter from MessagingService validation
    agentResponse?: AgentResponse // Add agentResponse to access adaptiveCards
  ): number {
    const testType = testCase.testTypeCode;
    const isEmpty = (value: string) => !value || value.trim() === "";

    console.log(
      `DEBUG: calculateResultCode - testCase.name: ${
        testCase.name
      }, testType: ${testType}, isEmpty(agentResponseText): ${isEmpty(
        agentResponseText
      )}`
    );

    if (isEmpty(agentResponseText)) {
      console.log(
        `DEBUG: calculateResultCode - Returning ERROR (${RESULT_CODES.ERROR}) due to empty agentResponseText`
      );
      return RESULT_CODES.ERROR; // No response
    }

    switch (testType) {
      case TEST_TYPES.RESPONSE_MATCH: {
        // For response match, use isMatch if available, otherwise fallback to validation
        if (isMatch !== undefined) {
          const resultCode = isMatch
            ? RESULT_CODES.SUCCESS
            : RESULT_CODES.FAILED;
          console.log(
            `DEBUG: calculateResultCode - RESPONSE_MATCH with isMatch=${isMatch}, returning ${resultCode}`
          );
          return resultCode;
        }
        const responseMatchResult = ResponseValidationEngine.validateResponse(
          agentResponseText,
          testCase.expectedResponse || "",
          testCase.comparisonOperatorCode
        )
          ? RESULT_CODES.SUCCESS
          : RESULT_CODES.FAILED;
        console.log(
          `DEBUG: calculateResultCode - RESPONSE_MATCH validation result: ${responseMatchResult}`
        );
        return responseMatchResult;
      }

      case TEST_TYPES.TOPIC_MATCH: {
        const topicMatchResult =
          configuration.isEnrichedWithConversationTranscripts
            ? RESULT_CODES.PENDING
            : RESULT_CODES.UNKNOWN;
        console.log(
          `DEBUG: calculateResultCode - TOPIC_MATCH, isEnriched=${configuration.isEnrichedWithConversationTranscripts}, returning ${topicMatchResult}`
        );
        return topicMatchResult;
      }

      case TEST_TYPES.PLAN_VALIDATION: {
        // Plan Validation works the same as Topic Match
        const planValidationResult =
          configuration.isEnrichedWithConversationTranscripts
            ? RESULT_CODES.PENDING
            : RESULT_CODES.UNKNOWN;
        console.log(
          `DEBUG: calculateResultCode - PLAN_VALIDATION, isEnriched=${configuration.isEnrichedWithConversationTranscripts}, returning ${planValidationResult}`
        );
        return planValidationResult;
      }

      case TEST_TYPES.ADAPTIVE_CARD: {
        // New logic: Handle adaptive cards based on operation type code
        const operationTypeCode = testCase.operationTypeCode ?? 1; // Default to Comparison Operator

        // Handle different operation types with their specific result codes
        if (operationTypeCode === 2) {
          // AI Validation
          return RESULT_CODES.PENDING;
        } else if (operationTypeCode === 3) {
          // Invoke Actions
          return RESULT_CODES.ERROR;
        } else {
          // Comparison Operator - only call validation for this type
          const validationResult =
            ResponseValidationEngine.validateAdaptiveCards(
              operationTypeCode,
              testCase.comparisonOperatorCode ?? 1, // Default to Equals
              testCase.expectedAttachmentsJson || "",
              testCase.validationInstructions || "",
              agentResponse?.adaptiveCards || [] // Use actual adaptive cards from agent response
            );

          return validationResult.success
            ? RESULT_CODES.SUCCESS
            : RESULT_CODES.FAILED;
        }
      }

      case TEST_TYPES.GENERATIVE_ANSWER: {
        const outcomeCode = testCase.generativeAnswerOutcomeCode;
        if (outcomeCode === 1 || outcomeCode === 2) {
          return configuration.isGeneratedAnswersAnalysisEnabled
            ? RESULT_CODES.PENDING
            : RESULT_CODES.UNKNOWN;
        } else if (outcomeCode === 3 || outcomeCode === 4) {
          return configuration.isAzureApplicationInsightsEnabled
            ? RESULT_CODES.PENDING
            : RESULT_CODES.UNKNOWN;
        }
        return RESULT_CODES.UNKNOWN;
      }

      default:
        if (ResponseValidationEngine.hasErrorStrings(agentResponseText)) {
          return RESULT_CODES.ERROR; // Error response
        }
        return RESULT_CODES.PENDING; // Default to pending
    }
  }

  private generateResultReason(
    testCase: AgentTestCase,
    configuration: AgentConfiguration,
    agentResponseText: string,
    resultCode: number,
    agentResponse?: AgentResponse // Add agentResponse parameter for adaptive card handling
  ): string {
    const testType = testCase.testTypeCode;
    const isEmpty = (value: string) => !value || value.trim() === "";

    if (isEmpty(agentResponseText)) {
      return "No response from the bot, possibly due to the Expected Position of the Response Message column value for the given test.";
    }

    if (ResponseValidationEngine.hasErrorStrings(agentResponseText)) {
      return "The bot returned an error";
    }

    switch (testType) {
      case TEST_TYPES.RESPONSE_MATCH:
        return resultCode === RESULT_CODES.SUCCESS
          ? "Exact match between the expected message and the received message as per comparison operator"
          : "Not an exact match between the expected response and received message as per comparison operator";

      case TEST_TYPES.TOPIC_MATCH:
        return configuration.isEnrichedWithConversationTranscripts
          ? "Pending analysis of Conversation Transcripts"
          : "Cannot be evaluated without Conversation Transcripts enrichment";

      case TEST_TYPES.PLAN_VALIDATION:
        // Plan Validation works the same as Topic Match
        return configuration.isEnrichedWithConversationTranscripts
          ? "Pending analysis of Conversation Transcripts"
          : "Cannot be evaluated without Conversation Transcripts enrichment";

      case TEST_TYPES.ADAPTIVE_CARD: {
        // New logic: Generate reason based on operation type code
        const operationTypeCode = testCase.operationTypeCode ?? 1;

        if (operationTypeCode === 2) {
          // AI Validation
          return "Pending analysis with AI Builder";
        } else if (operationTypeCode === 3) {
          // Invoke Actions
          return "Invoke Actions is not currently supported with Microsoft Authentication";
        } else {
          // Comparison Operator
          // Get the detailed reason from validation result
          const validationResult =
            ResponseValidationEngine.validateAdaptiveCards(
              operationTypeCode,
              testCase.comparisonOperatorCode ?? 1,
              testCase.expectedAttachmentsJson || "",
              testCase.validationInstructions || "",
              agentResponse?.adaptiveCards || []
            );
          return validationResult.reason;
        }
      }

      // Comment out the old logic for now
      // return resultCode === RESULT_CODES.SUCCESS
      //   ? "Exact match between the expected attachment(s) JSON and the received attachment(s) JSON"
      //   : "Not an exact match between the expected attachment(s) JSON and the received attachment(s) JSON";

      case TEST_TYPES.GENERATIVE_ANSWER: {
        const outcomeCode = testCase.generativeAnswerOutcomeCode;
        if (outcomeCode === 1 || outcomeCode === 2) {
          return configuration.isGeneratedAnswersAnalysisEnabled
            ? "Pending analysis with AI Builder"
            : "Cannot be evaluated without AI Builder analysis";
        } else if (outcomeCode === 3 || outcomeCode === 4) {
          return configuration.isAzureApplicationInsightsEnabled
            ? "Pending analysis with Azure Application Insights"
            : "Cannot be evaluated without Azure Application Insights enrichment";
        }
        return "Answer could not be evaluated";
      }

      default:
        return resultCode === RESULT_CODES.PENDING
          ? "Pending analysis"
          : "Answer could not be evaluated";
    }
  }

  private generateUniqueName(
    testCase: AgentTestCase,
    agentResponse: AgentResponse
  ): string {
    return (
      agentResponse.conversationId ||
      `${testCase.name}-${new Date().toISOString().replace(/[:.]/g, "-")}`
    );
  }

  private calculateTimestamps(agentResponse: AgentResponse): {
    messageTimestamp: Date;
    currentTime: Date;
  } {
    const currentTime = new Date();
    const messageTimestamp = new Date(
      currentTime.getTime() - (agentResponse.responseTime || 0)
    );
    return { messageTimestamp, currentTime };
  }

  /**
   * Formats timestamp in the required format: 2025-08-07T11:01:53.0869844Z
   * @param date - Date to format
   * @returns Formatted timestamp string
   */
  private formatTimestamp(date: Date): string {
    // Get the basic ISO string: 2025-08-07T11:01:53.086Z
    const isoString = date.toISOString();

    // Extract the parts: YYYY-MM-DDTHH:mm:ss.sssZ
    const [datePart, timePart] = isoString.split("T");
    const [timeWithoutZ, _] = timePart.split("Z");
    const [timeWithoutMs, milliseconds] = timeWithoutZ.split(".");

    // Pad milliseconds to 7 digits (microseconds precision)
    // JavaScript only provides 3 digits, so we pad with additional digits
    const paddedMs = (milliseconds || "000").padEnd(7, "0");

    // Reconstruct in the desired format
    return `${datePart}T${timeWithoutMs}.${paddedMs}Z`;
  }

  private generateResponseValue(
    agentResponseText: string,
    adaptiveCardJson: string,
    testCase: AgentTestCase,
    agentResponse: AgentResponse
  ): string {
    // NEW IMPLEMENTATION: Parse all responses from agent (should already be filtered by MessagingService based on isStartConversationEventSent)
    let allResponsesArray: ParsedAgentResponse[] = [];
    try {
      if (agentResponse.allResponses) {
        const parsedResponses = JSON.parse(agentResponse.allResponses);
        allResponsesArray = parsedResponses;
        console.log("DEBUG: Parsed allResponses array:", allResponsesArray);
      }
    } catch (error) {
      console.log("DEBUG: Error parsing allResponses:", error);
      allResponsesArray = [];
    }

    const expectedPosition = testCase.expectedPositionOfTheResponseActivity;
    const isEmpty = (value: string) => !value || value.trim() === "";

    console.log("DEBUG: expectedPosition:", expectedPosition);
    console.log("DEBUG: allResponsesArray length:", allResponsesArray.length);

    // Check if Agent Response is empty (overall response) - this checks if allResponses exists and has content
    const isAgentResponseEmpty =
      !agentResponse.allResponses ||
      agentResponse.allResponses.trim() === "" ||
      allResponsesArray.length === 0;

    console.log("DEBUG: isAgentResponseEmpty:", isAgentResponseEmpty);

    // Get the response at the expected position
    let responseAtPosition: ParsedAgentResponse | null = null;
    if (
      expectedPosition !== undefined &&
      expectedPosition >= 0 &&
      expectedPosition < allResponsesArray.length
    ) {
      responseAtPosition = allResponsesArray[expectedPosition];
    } else if (allResponsesArray.length > 0) {
      responseAtPosition = allResponsesArray[0]; // Default to first response
    }

    console.log("DEBUG: responseAtPosition:", responseAtPosition);

    // Check if Agent Response based on position column is empty (response object doesn't exist)
    const isResponseAtPositionEmpty = !responseAtPosition;

    console.log("DEBUG: isResponseAtPositionEmpty:", isResponseAtPositionEmpty);

    // CORRECTED Power Automate logic:
    // if(or(empty(Agent Response), empty(Agent Response based on position column)), 'No response', ...)
    if (isAgentResponseEmpty || isResponseAtPositionEmpty) {
      console.log(
        "DEBUG: Returning 'No response' due to empty overall response or no response at position"
      );
      return "No response";
    }

    // Now we know responseAtPosition exists, get the text from it
    const textAtPosition =
      ((responseAtPosition as ParsedAgentResponse)?.text as string) || "";

    console.log("DEBUG: textAtPosition:", textAtPosition);
    console.log("DEBUG: isEmpty(textAtPosition):", isEmpty(textAtPosition));

    // CORRECTED: Now check if the TEXT at position is empty (not the response object itself)
    // if(empty(text of Agent Response based on position column), ...)
    if (isEmpty(textAtPosition)) {
      // Check Adaptive Card attachments of Agent Response based on position column
      const attachmentsAtPosition =
        ((responseAtPosition as ParsedAgentResponse)
          ?.attachments as unknown[]) || [];

      console.log("DEBUG: attachmentsAtPosition:", attachmentsAtPosition);

      const adaptiveCardsAtPosition = attachmentsAtPosition.filter(
        (att: unknown) => {
          const attachment = att as {
            contentType?: string;
            content?: unknown;
            contentUrl?: string;
          };
          return (
            attachment.contentType ===
              "application/vnd.microsoft.card.adaptive" ||
            attachment.content ||
            attachment.contentUrl
          );
        }
      );

      console.log("DEBUG: adaptiveCardsAtPosition:", adaptiveCardsAtPosition);

      // if(not(empty(Adaptive Card attachments of Agent Response based on position column)), ...)
      if (adaptiveCardsAtPosition && adaptiveCardsAtPosition.length > 0) {
        console.log(
          "DEBUG: Returning 'No response, but attachments (Adaptive Cards, etc.)'"
        );
        return "No response, but attachments (Adaptive Cards, etc.)";
      } else {
        console.log(
          "DEBUG: Returning 'No response' due to no adaptive cards and no text"
        );
        return "No response";
      }
    }

    // Return Agent Response based on position column (the text) - this is the final else case
    console.log("DEBUG: Returning textAtPosition:", textAtPosition);
    return textAtPosition;

    /* ORIGINAL IMPLEMENTATION - COMMENTED OUT FOR TESTING
    // Determine the expected scenario based on the test case settings
    let scenario = "";
    if (
      testCase.isStartConversationEventSent === false &&
      testCase.expectedPositionOfTheResponseActivity == null
    ) {
      scenario = "Scenario 1: No start conversation, default position (0)";
    } else if (
      testCase.isStartConversationEventSent === false &&
      testCase.expectedPositionOfTheResponseActivity != null
    ) {
      scenario = `Scenario 2: No start conversation, specific position (${testCase.expectedPositionOfTheResponseActivity})`;
    } else if (
      testCase.isStartConversationEventSent === true &&
      testCase.expectedPositionOfTheResponseActivity == null
    ) {
      scenario =
        "Scenario 3: With start conversation, default position (0 = start conversation)";
    } else if (
      testCase.isStartConversationEventSent === true &&
      testCase.expectedPositionOfTheResponseActivity != null
    ) {
      scenario = `Scenario 4: With start conversation, specific position (${testCase.expectedPositionOfTheResponseActivity})`;
    }

    // Parse all responses from agent (should already be filtered by MessagingService based on isStartConversationEventSent)
    // Logic handled in MessagingService:
    // - If isStartConversationEventSent = false: startConversation activity is excluded from allActivities
    // - If isStartConversationEventSent = true: startConversation activity is included in allActivities
    // This affects:
    // 1. cat_actualcompleteresponse (stored as agentResponse.allResponses)
    // 2. cat_response (generated by this method using expectedPositionOfTheResponseActivity)
    // 3. cat_result and cat_resultreason (calculated based on response at position)
    let allResponsesArray: string[] = [];
    try {
      if (agentResponse.allResponses) {
        const parsedResponses = JSON.parse(agentResponse.allResponses);
        allResponsesArray = parsedResponses
          .map((r: { text?: string }) => r.text || "")
          .filter((text: string) => text.trim() !== "");
      }
    } catch (error) {
      allResponsesArray = agentResponseText ? [agentResponseText] : [];
    }

    const expectedPosition = testCase.expectedPositionOfTheResponseActivity;

    // Power Automate expression: if(or(Agent Response is empty, lessOrEquals(length(Agent Response), cat_expectedpositionoftheresponseactivity)), 'No response', ...)
    const isEmpty = (value: string) => !value || value.trim() === "";
    const isAgentResponseEmpty =
      allResponsesArray.length === 0 ||
      allResponsesArray.every((r) => isEmpty(r));
    const isPositionOutOfBounds =
      expectedPosition !== undefined &&
      allResponsesArray.length <= expectedPosition;

    if (isAgentResponseEmpty || isPositionOutOfBounds) {
      return "No response";
    }

    // Get the response at the expected position
    let responseAtPosition = "";
    if (
      expectedPosition !== undefined &&
      expectedPosition >= 0 &&
      expectedPosition < allResponsesArray.length
    ) {
      responseAtPosition = allResponsesArray[expectedPosition];
    } else if (allResponsesArray.length > 0) {
      // Default to first response (index 0) when position not specified
      responseAtPosition = allResponsesArray[0];
    } else {
      // Fallback to agentResponseText if no responses in array
      responseAtPosition = agentResponseText;
    }

    // Power Automate expression: if(empty(Agent Response based on cat_expectedpositionoftheresponseactivity), ...)
    if (isEmpty(responseAtPosition)) {
      // Power Automate expression: if(not(empty(Adaptive Card of Agent Response based cat_expectedpositionoftheresponseactivity)), 'No response, but attachments (Adaptive Cards, etc.)', 'No response')
      if (!isEmpty(adaptiveCardJson) && adaptiveCardJson !== "[]") {
        return "No response, but attachments (Adaptive Cards, etc.)";
      } else {
        return "No response";
      }
    }

    // Power Automate expression: Agent Response based on cat_expectedpositionoftheresponseactivity
    return responseAtPosition;
    */
  }

  private buildTestResultData(
    testCase: AgentTestCase,
    testRunId: string,
    agentResponse: AgentResponse,
    uniqueName: string,
    resultCode: number,
    resultReason: string,
    responseValue: string,
    messageTimestamp: Date,
    currentTime: Date,
    parentTestResultId?: string
  ): Record<string, string | number | boolean | null | undefined> {
    const testResultData: Record<
      string,
      string | number | boolean | null | undefined
    > = {
      cat_name: uniqueName,
      cat_resultcode: resultCode,
      cat_testtypecode: testCase.testTypeCode,
      cat_resultreason: resultReason,
      cat_response: responseValue,
      cat_actualcompleteresponse: agentResponse.allResponses || "[]",
      cat_latencyms: agentResponse.responseTime || 0,
      cat_messagesenttimestamp: this.formatTimestamp(messageTimestamp),
      cat_responsereceivedtimestamp: this.formatTimestamp(currentTime),
      "cat_CopilotTestRunId@odata.bind": `/cat_copilottestruns(${testRunId})`,
      "cat_CopilotTestId@odata.bind": `/cat_copilottests(${testCase.id})`,

      // Map test case fields to result - handle undefined integer fields properly
      cat_comparisonoperator: testCase.comparisonOperatorCode ?? null,
      cat_operationtypecode: testCase.operationTypeCode ?? null, // Add new operation type code field
      cat_adaptivecardpayload: testCase.adaptiveCardPayload, // Add adaptive card payload field
      cat_testutterance: testCase.testUtterance,
      cat_expectedresponse: testCase.expectedResponse, // Always map expectedResponse directly
      cat_expectedtopicname: testCase.expectedTopicName,
      cat_expectedtools: testCase.expectedTools, // Add new expected tools field for Plan Validation
      cat_passthreshold: testCase.cat_passthreshold ?? null, // Copy pass threshold from test case
      cat_generativeansweroutcomecode:
        testCase.generativeAnswerOutcomeCode ?? null,
      cat_externalvariablesjson: testCase.externalVariablesJson,
      cat_isstartconversationeventsent: testCase.isStartConversationEventSent,
    };

    // Handle expected position logic
    // With the new start conversation filtering logic, the position can be used directly
    // since the allActivities array is already filtered based on isStartConversationEventSent
    if (testCase.expectedPositionOfTheResponseActivity !== undefined) {
      testResultData.cat_expectedpositionoftheresponseactivity =
        testCase.expectedPositionOfTheResponseActivity;
    }

    // Handle attachment data with conditional mapping logic for validationInstructions
    const shouldMapValidationInstructions =
      // Condition 1: Comparison Operator (1) with Contains (3) or Does not contain (4)
      (testCase.operationTypeCode === 1 &&
        (testCase.comparisonOperatorCode === 3 ||
          testCase.comparisonOperatorCode === 4)) ||
      // Condition 2: AI Validation (2)
      testCase.operationTypeCode === 2;

    if (shouldMapValidationInstructions && testCase.validationInstructions) {
      // Map validationInstructions to expectedattachmentsjson for specific conditions
      testResultData.cat_expectedattachmentsjson =
        testCase.validationInstructions;
    } else if (testCase.expectedAttachmentsJson) {
      // For all other cases, map expectedAttachmentsJson directly
      testResultData.cat_expectedattachmentsjson =
        testCase.expectedAttachmentsJson;
    }

    // Always populate actual attachments JSON regardless of whether expected attachments are provided
    // OLD LOGIC - COMMENTED OUT: Using global adaptiveCards instead of position-based extraction
    // if (agentResponse.adaptiveCards && agentResponse.adaptiveCards.length > 0) {
    //   testResultData.cat_attachmentsjson = JSON.stringify(
    //     agentResponse.adaptiveCards
    //   );
    // } else {
    //   testResultData.cat_attachmentsjson = "";
    // }

    // NEW LOGIC: Position-based attachments extraction following Power Automate expression pattern
    testResultData.cat_attachmentsjson = this.extractAttachmentsJson(
      agentResponse,
      testCase
    );

    // Add suggested actions JSON based on position column
    testResultData.cat_suggestedactionsjson = this.extractSuggestedActionsJson(
      agentResponse,
      testCase
    );

    // Add parent reference if provided
    if (parentTestResultId) {
      testResultData[
        `cat_Parent@odata.bind`
      ] = `/cat_copilottestresults(${parentTestResultId})`;
    }

    return testResultData;
  }
}
