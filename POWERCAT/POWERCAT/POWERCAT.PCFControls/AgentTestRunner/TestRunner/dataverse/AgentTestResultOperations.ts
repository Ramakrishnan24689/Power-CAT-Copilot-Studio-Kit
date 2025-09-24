/**
 * AgentTestResultOperations.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides comprehensive Dataverse operations for managing agent test result records and validation.
 * Handles test result creation, updates, status management, and complex business logic for
 * response validation, multiturn test rollups, and execution history analysis.
 *
 * Exports:
 *   - AgentTestResultOperations: Main class for test result operations and validation logic.
 *
 * Usage:
 *   const testResultOps = new AgentTestResultOperations(context);
 *   const resultId = await testResultOps.createTestResult(testCase, testRunId, response, config);
 *   const history = await testResultOps.getTestExecutionHistory(testRunId);
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import { ResponseValidationEngine } from "../shared/utils/ResponseValidationEngine";
import type {
  AgentTestCase,
  AgentResponse,
  AgentConfiguration,
  AdaptiveCard,
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
 * Test type mapping constants for Dataverse field values
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
 * Result code constants for test outcome classification
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
 * Handles creation, updates, and business logic for test results with comprehensive validation
 * @class AgentTestResultOperations
 */
export class AgentTestResultOperations extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "AgentTestResultOperations");
  }

  /**
   * Create a test result record in Dataverse with comprehensive validation and response analysis
   * @param testCase - The test case being executed with validation criteria
   * @param testRunId - GUID of the current test run for association
   * @param agentResponse - Response received from the agent with all response data
   * @param configuration - Agent configuration settings for validation logic
   * @param parentTestResultId - Optional parent test result ID for multiturn test scenarios
   * @returns Promise resolving to created test result ID or null if creation failed
   */
  async createTestResult(
    testCase: AgentTestCase,
    testRunId: string,
    agentResponse: AgentResponse,
    configuration: AgentConfiguration,
    parentTestResultId?: string
  ): Promise<string | null> {
    return this.executeOperationSafely(async () => {
      // Generate position-based response value for validation
      const responseValue = this.generateResponseValue(testCase, agentResponse);

      // Calculate result code based on business logic using position-based response
      const resultCode = this.calculateResultCode(
        testCase,
        configuration,
        responseValue,
        agentResponse.isMatch,
        agentResponse
      );

      // Generate result reason using position-based response
      const resultReason = this.generateResultReason(
        testCase,
        configuration,
        responseValue,
        resultCode,
        agentResponse
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

      return this.createTestResultRecord(testResultData);
    }, "Create test result");
  }

  /**
   * Create a test result record in Dataverse with standardized error handling
   * @param testResultData - Complete test result data object for record creation
   * @returns Promise resolving to created record ID or null if creation failed
   * @private
   */
  private async createTestResultRecord(
    testResultData: Record<string, string | number | boolean | null | undefined>
  ): Promise<string | null> {
    try {
      const response = await this.context.webAPI.createRecord(
        "cat_copilottestresult",
        testResultData
      );
      return response.id;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      if (errorMessage.includes("Resource not found")) {
        throw new Error(
          "Test result table 'Agent Test Result' not found. Please check your Dataverse environment setup."
        );
      }

      if (
        errorMessage.includes("Forbidden") ||
        errorMessage.includes("Unauthorized")
      ) {
        throw new Error(
          "Insufficient permissions to create test results. Please check your security roles and table permissions."
        );
      }

      throw error;
    }
  }

  /**
   * Create a placeholder test result for multiturn parent tests
   * Creates initial test result record that will be updated with child test rollup data
   * @param parentTestCase - The parent test case definition for multiturn scenario
   * @param testRunId - GUID of the current test run for association
   * @param conversationId - Conversation ID for the multiturn test session
   * @returns Promise resolving to created test result ID or null if creation failed
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
        cat_testutterance: "",
        cat_expectedresponse: "",
        cat_expectedtopicname: "",
        cat_comparisonoperator: null,
        cat_operationtypecode: null,
        cat_adaptivecardpayload: "",
        cat_generativeansweroutcomecode: null,
        cat_passthreshold: null,
        cat_externalvariablesjson: "",
        cat_expectedattachmentsjson: "",
        cat_attachmentsjson: "",
        cat_suggestedactionsjson: "",
        cat_messagesenttimestamp: null,
        cat_responsereceivedtimestamp: null,
        cat_latencyms: 0,
        "cat_CopilotTestRunId@odata.bind": `/cat_copilottestruns(${testRunId})`,
        "cat_CopilotTestId@odata.bind": `/cat_copilottests(${parentTestCase.id})`,
      };

      return this.createTestResultRecord(testResultData);
    }, "Create placeholder test result");
  }

  /**
   * Update parent test result based on child test results with rollup logic
   * Applies business rules to determine parent test outcome from child test results
   * @param parentTestResultId - GUID of parent test result to update
   * @param childResults - Array of child test result codes and critical flags for rollup calculation
   * @returns Promise resolving to boolean indicating success or failure of update operation
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
      const hasCriticalPending = childResults.some(
        (result) =>
          result.critical && result.resultCode === RESULT_CODES.PENDING
      );
      const allCriticalPassed = childResults
        .filter((result) => result.critical)
        .every((result) => result.resultCode === RESULT_CODES.SUCCESS);

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
      } else if (hasCriticalPending) {
        // Any critical pending subtests make parent pending
        parentResultCode = RESULT_CODES.PENDING;
      } else if (allCriticalPassed) {
        // All critical tests passed successfully
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
   * Get test result code by ID for validation and rollup operations
   * @param testResultId - GUID of the test result record to query
   * @returns Promise resolving to result code (1=Success, 2=Failed, 3=Unknown, 4=Error, 5=Pending) or null if not found
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
   * Get test execution history from cat_copilottestresult table with comprehensive result analysis
   * Provides aggregated counts of test results by status for reporting and progress tracking
   * @param testRunId - Test run ID to filter results for specific execution session
   * @returns Promise resolving to test execution history summary with counts by result type
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
      // Only count parent tests and normal tests (exclude child tests by filtering parent lookup value as null)
      const queryString = `?$select=cat_resultcode&$filter=_cat_copilottestrunid_value eq '${testRunId}' and _cat_parent_value eq null`;
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

  /**
   * Extract suggested actions JSON from agent response based on position column
   * @param agentResponse - The agent response containing allResponses data (includes suggested actions)
   * @returns String JSON of suggested actions or null
   */
  private extractSuggestedActionsJson(
    agentResponse: AgentResponse
  ): string | null {
    // First check: empty(Agent Response based on position column) → return null
    if (!agentResponse.allResponses) {
      return null;
    }

    let allResponsesArray;
    try {
      allResponsesArray = JSON.parse(agentResponse.allResponses);
      if (!Array.isArray(allResponsesArray) || allResponsesArray.length === 0) {
        return null;
      }
    } catch (error) {
      return null;
    }

    // Simple position logic: null/undefined = 0, otherwise use specified position
    const position = agentResponse.responseIndex ?? 0;

    // Check if position is within bounds
    if (position < 0 || position >= allResponsesArray.length) {
      return null;
    }

    // Get response at the specified position
    const responseAtPosition = allResponsesArray[position];

    // Second check: empty(suggestedActions of Agent Response based on position column) → return null
    if (
      !responseAtPosition ||
      !responseAtPosition.suggestedActions ||
      !Array.isArray(responseAtPosition.suggestedActions) ||
      responseAtPosition.suggestedActions.length === 0
    ) {
      return null;
    }

    // Final: string(suggestedActions of Agent Response based on position column)
    try {
      const suggestedActionsJson = JSON.stringify(
        responseAtPosition.suggestedActions
      );
      return suggestedActionsJson;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract attachments JSON from agent response based on position column
   * @param agentResponse - The agent response containing all responses data
   * @returns String JSON of attachments or empty string
   */
  private extractAttachmentsJson(agentResponse: AgentResponse): string {
    // First check: empty(Agent Response based on position column) → return ""
    if (!agentResponse.allResponses) {
      return "";
    }

    let allResponsesArray;
    try {
      allResponsesArray = JSON.parse(agentResponse.allResponses);
      if (!Array.isArray(allResponsesArray) || allResponsesArray.length === 0) {
        return "";
      }
    } catch (error) {
      return "";
    }

    // Simple position logic: null/undefined = 0, otherwise use specified position
    const position = agentResponse.responseIndex ?? 0;

    // Check if position is within bounds
    if (position < 0 || position >= allResponsesArray.length) {
      return "";
    }

    // Get response at the specified position
    const responseAtPosition = allResponsesArray[position];

    // Second check: empty(attachments of Agent Response based on position column) → return ""
    if (
      !responseAtPosition ||
      !responseAtPosition.attachments ||
      !Array.isArray(responseAtPosition.attachments) ||
      responseAtPosition.attachments.length === 0
    ) {
      return "";
    }

    // Final: string(attachments of Agent Response based on position column)
    try {
      const attachmentsJson = JSON.stringify(responseAtPosition.attachments);
      return attachmentsJson;
    } catch (error) {
      return "";
    }
  }

  /**
   * Calculate result code based on test type and validation logic
   * Applies comprehensive business rules to determine test outcome based on agent response analysis
   * @param testCase - Test case definition with validation criteria and type information
   * @param configuration - Agent configuration for validation context
   * @param agentResponseText - Position-based response text for validation
   * @param isMatch - Optional match result from MessagingService validation
   * @param agentResponse - Optional full agent response for accessing adaptive cards
   * @returns Result code (1=Success, 2=Failed, 3=Unknown, 4=Error, 5=Pending)
   * @private
   */
  private calculateResultCode(
    testCase: AgentTestCase,
    configuration: AgentConfiguration,
    agentResponseText: string,
    isMatch?: boolean, // Add isMatch parameter from MessagingService validation
    agentResponse?: AgentResponse // Add agentResponse to access adaptiveCards
  ): number {
    const testType = testCase.testTypeCode;
    const isEmpty = (value: string) => !value || value.trim() === "";

    if (isEmpty(agentResponseText)) {
      return RESULT_CODES.ERROR; // No response
    }

    switch (testType) {
      case TEST_TYPES.RESPONSE_MATCH: {
        // For response match, use isMatch if available, otherwise fallback to validation
        if (isMatch !== undefined) {
          const resultCode = isMatch
            ? RESULT_CODES.SUCCESS
            : RESULT_CODES.FAILED;
          return resultCode;
        }
        const responseMatchResult = ResponseValidationEngine.validateResponse(
          agentResponseText,
          testCase.expectedResponse || "",
          testCase.comparisonOperatorCode
        )
          ? RESULT_CODES.SUCCESS
          : RESULT_CODES.FAILED;
        return responseMatchResult;
      }

      case TEST_TYPES.TOPIC_MATCH:
      case TEST_TYPES.PLAN_VALIDATION: {
        // Plan Validation works the same as Topic Match
        const dataverseTranscriptResult =
          configuration.isEnrichedWithConversationTranscripts
            ? RESULT_CODES.PENDING
            : RESULT_CODES.UNKNOWN;
        return dataverseTranscriptResult;
      }

      case TEST_TYPES.ADAPTIVE_CARD: {
        const operationTypeCode = testCase.operationTypeCode ?? 1; // Default to Comparison Operator

        // Handle different operation types with their specific result codes
        if (operationTypeCode === 2) {
          // AI Validation
          return RESULT_CODES.PENDING;
        } else if (operationTypeCode === 3) {
          // Invoke Actions
          const validationResult = ResponseValidationEngine.validateResponse(
            agentResponseText,
            testCase.expectedResponse || "",
            testCase.comparisonOperatorCode ?? 1
          );
          return validationResult ? RESULT_CODES.SUCCESS : RESULT_CODES.FAILED;
        } else {
          // Comparison Operator - use extracted attachments for consistency
          const extractedAttachmentsJson = agentResponse
            ? this.extractAttachmentsJson(agentResponse)
            : "";

          // Convert the extracted JSON string to AdaptiveCard array for validation
          let actualAdaptiveCards: AdaptiveCard[] = [];
          try {
            if (
              extractedAttachmentsJson &&
              extractedAttachmentsJson.trim() !== ""
            ) {
              actualAdaptiveCards = JSON.parse(extractedAttachmentsJson);
            }
          } catch (parseError) {
            // If parsing fails, use empty array
            actualAdaptiveCards = [];
          }

          const validationResult =
            ResponseValidationEngine.validateAdaptiveCards(
              operationTypeCode,
              testCase.comparisonOperatorCode ?? 1, // Default to Equals
              testCase.expectedAttachmentsJson || "",
              testCase.validationInstructions || "",
              actualAdaptiveCards // Use extracted and parsed attachments
            ) as { success: boolean; reason: string };

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

  /**
   * Generate detailed result reason based on test type and validation outcome
   * Provides specific reasoning for test result based on business logic and validation type
   * @param testCase - Test case with type and validation configuration
   * @param configuration - Agent configuration affecting validation capabilities
   * @param agentResponseText - Response text for analysis
   * @param resultCode - Calculated result code for context
   * @param agentResponse - Optional agent response for adaptive card access
   * @returns Human-readable reason explaining the test result
   * @private
   */
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
      case TEST_TYPES.PLAN_VALIDATION:
        return configuration.isEnrichedWithConversationTranscripts
          ? "Pending analysis of Conversation Transcripts"
          : "Cannot be evaluated without Conversation Transcripts enrichment";

      case TEST_TYPES.ADAPTIVE_CARD: {
        const operationTypeCode = testCase.operationTypeCode ?? 1;

        if (operationTypeCode === 2) {
          // AI Validation
          return "Pending analysis with AI Builder";
        } else if (operationTypeCode === 3) {
          // Invoke Actions - Updated to use Response Match style messages
          return resultCode === RESULT_CODES.SUCCESS
            ? "Exact match between the expected response and received response as per comparison operator"
            : "Not an exact match between the expected response and received response as per comparison operator";
        } else {
          // Comparison Operator - use extracted attachments for consistency
          const extractedAttachmentsJson = agentResponse
            ? this.extractAttachmentsJson(agentResponse)
            : "";

          // Convert the extracted JSON string to array for validation
          let actualAdaptiveCards: AdaptiveCard[] = [];
          try {
            if (
              extractedAttachmentsJson &&
              extractedAttachmentsJson.trim() !== ""
            ) {
              actualAdaptiveCards = JSON.parse(extractedAttachmentsJson);
            }
          } catch (parseError) {
            // If parsing fails, use empty array
            actualAdaptiveCards = [];
          }

          const validationResult =
            ResponseValidationEngine.validateAdaptiveCards(
              operationTypeCode,
              testCase.comparisonOperatorCode ?? 1,
              testCase.expectedAttachmentsJson || "",
              testCase.validationInstructions || "",
              actualAdaptiveCards
            ) as { success: boolean; reason: string };
          return validationResult.reason;
        }
      }

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

  /**
   * Generate unique name for test result record
   * Uses conversation ID if available, otherwise creates timestamped name
   * @param testCase - Test case providing fallback name
   * @param agentResponse - Agent response containing conversation ID
   * @returns Unique name string for test result identification
   * @private
   */
  private generateUniqueName(
    testCase: AgentTestCase,
    agentResponse: AgentResponse
  ): string {
    return (
      agentResponse.conversationId ||
      `${testCase.name}-${new Date().toISOString().replace(/[:.]/g, "-")}`
    );
  }

  /**
   * Calculate timestamps for test result record
   * Computes message timestamp based on response time and current time
   * @param agentResponse - Agent response containing response time data
   * @returns Object with messageTimestamp and currentTime Date objects
   * @private
   */
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
    const paddedMs = (milliseconds || "000").padEnd(7, "0");

    // Reconstruct in the desired format
    return `${datePart}T${timeWithoutMs}.${paddedMs}Z`;
  }

  /**
   * Generate position-based response value for validation and storage
   * Creates appropriate response value based on test type and position requirements
   * @param testCase - Test case definition with position and type information
   * @param agentResponse - Full agent response object for additional data access
   * @returns Generated response value based on test type and position
   * @private
   */
  private generateResponseValue(
    testCase: AgentTestCase,
    agentResponse: AgentResponse
  ): string {
    let allResponsesArray: ParsedAgentResponse[] = [];
    try {
      if (agentResponse.allResponses) {
        const parsedResponses = JSON.parse(agentResponse.allResponses);
        allResponsesArray = parsedResponses;
      }
    } catch (error) {
      allResponsesArray = [];
    }

    const expectedPosition = testCase.expectedPositionOfTheResponseActivity;
    const isEmpty = (value: string) => !value || value.trim() === "";

    // Check if Agent Response is empty (overall response) - this checks if allResponses exists and has content
    const isAgentResponseEmpty =
      !agentResponse.allResponses ||
      agentResponse.allResponses.trim() === "" ||
      allResponsesArray.length === 0;

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

    // Check if Agent Response based on position column is empty (response object doesn't exist)
    const isResponseAtPositionEmpty = !responseAtPosition;

    if (isAgentResponseEmpty || isResponseAtPositionEmpty) {
      return "No response";
    }

    // Now we know responseAtPosition exists, get the text from it
    const textAtPosition =
      ((responseAtPosition as ParsedAgentResponse)?.text as string) || "";

    if (isEmpty(textAtPosition)) {
      // Check Adaptive Card attachments of Agent Response based on position column
      const attachmentsAtPosition =
        ((responseAtPosition as ParsedAgentResponse)
          ?.attachments as unknown[]) || [];

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

      if (adaptiveCardsAtPosition && adaptiveCardsAtPosition.length > 0) {
        return "No response, but attachments (Adaptive Cards, etc.)";
      } else {
        return "No response";
      }
    }

    return textAtPosition;
  }

  /**
   * Build comprehensive test result data object for Dataverse storage
   * Constructs complete record with all required fields for test result tracking
   * @param testCase - Test case providing base configuration and validation data
   * @param testRunId - ID of the parent test run
   * @param agentResponse - Complete agent response with timing and content data
   * @param uniqueName - Unique identifier for this test result
   * @param resultCode - Calculated result code (1=Success, 2=Failed, etc.)
   * @param resultReason - Human-readable explanation of the result
   * @param responseValue - Position-based response value for validation
   * @param messageTimestamp - Timestamp when message was sent
   * @param currentTime - Current processing time
   * @param parentTestResultId - Optional parent test result for hierarchical tests
   * @returns Complete data object ready for Dataverse record creation
   * @private
   */
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
      cat_comparisonoperator: testCase.comparisonOperatorCode ?? null,
      cat_operationtypecode: testCase.operationTypeCode ?? null,
      cat_adaptivecardpayload: testCase.adaptiveCardPayload,
      cat_testutterance: testCase.testUtterance,
      cat_expectedresponse: testCase.expectedResponse,
      cat_expectedtopicname: testCase.expectedTopicName,
      cat_expectedtools: testCase.expectedTools,
      cat_passthreshold: testCase.cat_passthreshold ?? null,
      cat_generativeansweroutcomecode:
        testCase.generativeAnswerOutcomeCode ?? null,
      cat_externalvariablesjson: testCase.externalVariablesJson,
      cat_isstartconversationeventsent: testCase.isStartConversationEventSent,
    };

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

    // Position-based attachments extraction
    testResultData.cat_attachmentsjson =
      this.extractAttachmentsJson(agentResponse);

    // Add suggested actions JSON based on position column
    testResultData.cat_suggestedactionsjson =
      this.extractSuggestedActionsJson(agentResponse);

    // Add parent reference if provided
    if (parentTestResultId) {
      testResultData[
        `cat_Parent@odata.bind`
      ] = `/cat_copilottestresults(${parentTestResultId})`;
    }

    return testResultData;
  }
}
