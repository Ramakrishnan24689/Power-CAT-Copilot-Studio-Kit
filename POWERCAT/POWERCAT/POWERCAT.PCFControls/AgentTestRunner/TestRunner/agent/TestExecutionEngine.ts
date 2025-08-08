/**
 * Test Execution Engine for Multiturn Tests
 * Handles the execution of child tests within multiturn conversations.
 */

import { MultiturnTestOrchestrator } from "./MultiturnTestOrchestrator";
import { IDataverseOperations } from "./IDataverseOperations";
import type {
  AgentTestCase,
  AgentResponse,
  AgentConfiguration,
} from "../shared/models/DataModels";

/**
 * Constants for TestExecutionEngine
 */
const TEST_EXECUTION_ENGINE_CONSTANTS = {
  SERVICE_NAME: "TestExecutionEngine",
  ERROR_MESSAGES: {
    SERVICES_REQUIRED: "Required services not provided",
  },
} as const;

/**
 * Result from executing child test
 */
interface ChildTestResult {
  testCase: AgentTestCase;
  response: AgentResponse;
  success: boolean;
  actualResultCode: number;
}

/**
 * Engine for executing child tests in a multiturn conversation
 */
export class TestExecutionEngine {
  private readonly conversationManager: MultiturnTestOrchestrator;
  private readonly dataverseService: IDataverseOperations;
  private readonly serviceName = TEST_EXECUTION_ENGINE_CONSTANTS.SERVICE_NAME;

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

  private isFailureResultCode(resultCode: number): boolean {
    return resultCode === 2 || resultCode === 3 || resultCode === 4; // FAILED, UNKNOWN, ERROR
  }

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
          actualResultCode: 4, // 4 = ERROR
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
        return { testResultId, actualResultCode: actualResultCode || 4 }; // 4 = ERROR
      }

      return { testResultId: null, actualResultCode: 4 }; // 4 = ERROR
    } catch (error) {
      return { testResultId: null, actualResultCode: 4 }; // 4 = ERROR
    }
  }

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

  calculateSuccessRate(childResults: ChildTestResult[]): number {
    if (childResults.length === 0) return 0;
    const successfulTests = childResults.filter(
      (result) => result.success
    ).length;
    return Math.round((successfulTests / childResults.length) * 100);
  }

  evaluateOverallSuccess(childResults: ChildTestResult[]): boolean {
    return this.calculateSuccessRate(childResults) === 100;
  }

  generateExecutionSummary(childResults: ChildTestResult[]): {
    totalTests: number;
    successfulTests: number;
    failedTests: number;
    successRate: number;
    overallSuccess: boolean;
    avgResponseTime: number;
  } {
    const totalTests = childResults.length;
    const successfulTests = childResults.filter(
      (result) => result.success
    ).length;
    const successRate = this.calculateSuccessRate(childResults);
    const overallSuccess = this.evaluateOverallSuccess(childResults);

    const totalResponseTime = childResults.reduce(
      (sum, result) => sum + (result.response.responseTime || 0),
      0
    );
    const avgResponseTime = totalTests > 0 ? totalResponseTime / totalTests : 0;

    return {
      totalTests,
      successfulTests,
      failedTests: totalTests - successfulTests,
      successRate,
      overallSuccess,
      avgResponseTime,
    };
  }
}
