/**
 * TestExecutionEngine.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides execution engine capabilities for child tests within multiturn conversation
 * scenarios. Handles individual test execution, result aggregation, parent test updates,
 * and comprehensive summary generation for multiturn test scenarios.
 *
 * Exports:
 *   - TestExecutionEngine: Main execution engine for multiturn child test processing.
 *   - ChildTestResult: Interface defining child test execution result structure.
 *
 * Usage:
 *   const engine = new TestExecutionEngine(orchestrator, dataverseService);
 *   const results = await engine.executeChildTests(children, conversationId, testRunId, config);
 *   const allPassed = engine.allTestsPassed(results);
 */

import { MultiturnTestOrchestrator } from "./MultiturnTestOrchestrator";
import { IDataverseOperations } from "./IDataverseOperations";
import type {
  AgentTestCase,
  AgentResponse,
  AgentConfiguration,
} from "../shared/models/DataModels";

/**
 * Constants for TestExecutionEngine operations
 */
const TEST_EXECUTION_ENGINE_CONSTANTS = {
  ERROR_MESSAGES: {
    SERVICES_REQUIRED: "Required services not provided",
  },
} as const;

/**
 * Result code constants for test execution
 */
const RESULT_CODES = {
  SUCCESS: 1,
  FAILED: 2,
  UNKNOWN: 3,
  ERROR: 4,
  PENDING: 5,
} as const;

/**
 * Result structure from executing individual child test
 */
export interface ChildTestResult {
  testCase: AgentTestCase;
  response: AgentResponse;
  success: boolean;
  actualResultCode: number;
}

/**
 * Execution engine for processing child tests within multiturn conversation scenarios.
 * Provides orchestration, error handling, and comprehensive result analysis.
 */
export class TestExecutionEngine {
  private readonly conversationManager: MultiturnTestOrchestrator;
  private readonly dataverseService: IDataverseOperations;

  constructor(
    conversationManager: MultiturnTestOrchestrator,
    dataverseService: IDataverseOperations
  ) {
    if (!conversationManager || !dataverseService) {
      throw new Error(
        TEST_EXECUTION_ENGINE_CONSTANTS.ERROR_MESSAGES.SERVICES_REQUIRED
      );
    }

    this.conversationManager = conversationManager;
    this.dataverseService = dataverseService;
  }

  /**
   * Validates if a result code indicates test failure.
   * @param resultCode - The result code to validate (2=FAILED, 3=UNKNOWN, 4=ERROR)
   * @returns True if the result code indicates failure
   */
  private isFailureResultCode(resultCode: number): boolean {
    return (
      resultCode === RESULT_CODES.FAILED ||
      resultCode === RESULT_CODES.UNKNOWN ||
      resultCode === RESULT_CODES.ERROR
    );
  }

  /**
   * Executes all child tests in sequence within a multiturn conversation.
   * Handles error scenarios and stops execution for critical test failures.
   * @param childTests - Array of child test cases to execute
   * @param conversationId - The conversation identifier for message context
   * @param testRunId - Associated test run identifier
   * @param configuration - Agent configuration for test execution
   * @param parentTestResultId - Optional parent test result for relationship tracking
   * @returns Promise resolving to array of child test execution results
   */

  async executeChildTests(
    childTests: AgentTestCase[],
    conversationId: string,
    testRunId: string,
    configuration: AgentConfiguration,
    parentTestResultId?: string
  ): Promise<ChildTestResult[]> {
    const results: ChildTestResult[] = [];

    for (let i = 0; i < childTests.length; i++) {
      const childTest = childTests[i];
      const isFirstChildTest = i === 0;

      try {
        const result = await this.executeIndividualChildTest(
          childTest,
          conversationId,
          testRunId,
          configuration,
          parentTestResultId,
          isFirstChildTest
        );

        results.push(result);

        // Stop execution if critical test fails
        if (
          childTest.critical &&
          this.isFailureResultCode(result.actualResultCode)
        ) {
          break;
        }
      } catch (error) {
        const errorResult = {
          testCase: childTest,
          response: this.conversationManager.createErrorResponse(
            conversationId,
            error
          ),
          success: false,
          actualResultCode: RESULT_CODES.ERROR,
        };

        results.push(errorResult);

        // Stop execution only for critical test errors
        if (childTest.critical) {
          break;
        }
      }
    }

    // Update parent test result based on child results
    if (parentTestResultId) {
      await this.updateParentTestResultFromChildren(
        parentTestResultId,
        results
      );
    }

    return results;
  }

  /**
   * Executes an individual child test within the conversation context.
   * Handles start conversation activity for first child test and creates test results.
   * @param childTest - Child test case to execute
   * @param conversationId - The conversation identifier for message context
   * @param testRunId - Associated test run identifier
   * @param configuration - Agent configuration for test execution
   * @param parentTestResultId - Optional parent test result for relationship tracking
   * @param isFirstChildTest - Whether this is the first child test in the sequence
   * @returns Promise resolving to child test execution result
   */
  async executeIndividualChildTest(
    childTest: AgentTestCase,
    conversationId: string,
    testRunId: string,
    configuration: AgentConfiguration,
    parentTestResultId?: string,
    isFirstChildTest = false
  ): Promise<ChildTestResult> {
    // Get start conversation activity if this is the first child test
    const startConversationActivity = isFirstChildTest
      ? this.conversationManager.getStartConversationActivity()
      : null;

    // Send message and get response
    const response =
      await this.conversationManager.sendMessageInExistingConversation(
        childTest.testUtterance || "",
        conversationId,
        childTest,
        isFirstChildTest,
        startConversationActivity || undefined
      );

    // Create test result in Dataverse and get actual result code
    const { testResultId, actualResultCode } = await this.createChildTestResult(
      childTest,
      testRunId,
      response,
      configuration,
      parentTestResultId
    );

    const success = response.success && !response.error;

    return {
      testCase: childTest,
      response,
      success,
      actualResultCode,
    };
  }

  /**
   * Creates a child test result in Dataverse and retrieves the actual result code.
   * Handles test result creation and code retrieval with proper error handling.
   * @param childTest - Child test case definition
   * @param testRunId - Associated test run identifier
   * @param response - Agent response from the test execution
   * @param configuration - Agent configuration used for testing
   * @param parentTestResultId - Optional parent test result for relationship tracking
   * @returns Promise resolving to test result ID and actual result code
   */
  private async createChildTestResult(
    childTest: AgentTestCase,
    testRunId: string,
    response: AgentResponse,
    configuration: AgentConfiguration,
    parentTestResultId?: string
  ): Promise<{ testResultId: string | null; actualResultCode: number }> {
    try {
      const testResultId = await this.dataverseService.createTestResult(
        childTest,
        testRunId,
        response,
        configuration,
        parentTestResultId
      );

      if (testResultId) {
        const actualResultCode = await this.dataverseService.getTestResultCode(
          testResultId
        );
        return {
          testResultId,
          actualResultCode: actualResultCode || RESULT_CODES.ERROR,
        };
      }

      return { testResultId: null, actualResultCode: RESULT_CODES.ERROR };
    } catch (error) {
      return { testResultId: null, actualResultCode: RESULT_CODES.ERROR };
    }
  }

  /**
   * Updates parent test result with aggregated data from child test results.
   * Handles the rollup of child test outcomes to the parent test result.
   * @param parentTestResultId - Parent test result identifier
   * @param childResults - Array of child test execution results
   * @returns Promise that resolves when update is complete
   */
  private async updateParentTestResultFromChildren(
    parentTestResultId: string,
    childResults: ChildTestResult[]
  ): Promise<void> {
    try {
      const childResultData = childResults.map((result) => ({
        resultCode: result.actualResultCode,
        critical: result.testCase.critical || false,
      }));

      await this.dataverseService.updateParentTestResult(
        parentTestResultId,
        childResultData
      );
    } catch (error) {
      // Failed to update parent test result - continue silently
    }
  }

  /**
   * Determines if all child tests passed successfully.
   * @param childResults - Array of child test execution results
   * @returns True if all tests succeeded, false otherwise
   */
  allTestsPassed(childResults: ChildTestResult[]): boolean {
    return (
      childResults.length > 0 && childResults.every((result) => result.success)
    );
  }
}
