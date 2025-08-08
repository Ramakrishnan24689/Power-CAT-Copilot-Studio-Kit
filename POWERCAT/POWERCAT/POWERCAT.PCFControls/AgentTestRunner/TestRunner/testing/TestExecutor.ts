import { ConversationManager } from "../agent/ConversationManager";
import { MessagingService } from "../agent/MessagingService";
import { AgentTestResultOperations } from "../dataverse/AgentTestResultOperations";
import { AgentTestSetOperations } from "../dataverse/AgentTestSetOperations";
import { AgentTestRunOperations } from "../dataverse/AgentTestRunOperations";
import { AgentConfigurationOperations } from "../dataverse/AgentConfigurationOperations";
import { PostExecuteActions } from "../dataverse/PostExecuteActions";
import { MultiturnConversationManager } from "../agent/MultiturnConversationManager";
import type {
  AgentTestCase,
  AgentConfiguration,
  AgentTestRun,
  TestExecutionSummary,
} from "../shared/models/DataModels";

// Constants for result codes
const RESULT_CODES = {
  SUCCESS: 1,
  FAILED: 2,
  UNKNOWN: 3,
  ERROR: 4,
  PENDING: 5,
} as const;

// Constants for test execution
const TEST_EXECUTION = {
  MULTITURN_TEST_TYPE: 5,
  CONCURRENCY_LIMIT: 10,
  DEFAULT_HISTORY_LIMIT: 50000,
} as const;

// Constants for test run status
const TEST_RUN_STATUS = {
  RUNNING: 2,
  COMPLETE: 3,
  ERROR: 6,
} as const;

export class TestRunner {
  private conversationManager: ConversationManager;
  private messagingService: MessagingService;
  private testResultOps: AgentTestResultOperations;
  private testSetOps: AgentTestSetOperations;
  private testRunOps: AgentTestRunOperations;
  private configOps: AgentConfigurationOperations;
  private postExecOps: PostExecuteActions;
  private multiturnManager: MultiturnConversationManager;
  private configuration?: AgentConfiguration;

  constructor(context: ComponentFramework.Context<unknown>) {
    this.conversationManager = new ConversationManager();
    this.messagingService = new MessagingService(this.conversationManager);
    this.testResultOps = new AgentTestResultOperations(context);
    this.testSetOps = new AgentTestSetOperations(context);
    this.testRunOps = new AgentTestRunOperations(context);
    this.configOps = new AgentConfigurationOperations(context);
    this.postExecOps = new PostExecuteActions(context);
    this.multiturnManager = new MultiturnConversationManager(
      this.messagingService,
      context
    );
  }

  /**
   * Initializes the test runner with agent configuration
   * Sets up the conversation manager and prepares for test execution
   * @param agentConfig - Configuration for the agent connection and settings
   */
  async initialize(agentConfig: AgentConfiguration): Promise<void> {
    this.configuration = agentConfig;
    await this.conversationManager.initialize(agentConfig);

    // Validate agent connection immediately after initialization
    await this.validateAgentConnection();
  }

  /**
   * Validates that the agent connection is working properly
   * Creates a test conversation to verify bot identifier and connection
   * @throws Error if agent connection fails
   */
  private async validateAgentConnection(): Promise<void> {
    try {
      // Attempt to create a test conversation to validate the agent
      const testConnection =
        await this.conversationManager.createConversation();

      if (!testConnection.conversationId) {
        throw new Error(
          "Failed to establish connection with the agent. Please verify your bot identifier and agent configuration."
        );
      }

      // Verify the conversation manager is properly initialized
      const client = this.conversationManager.getClient();
      if (!client) {
        throw new Error(
          "Agent client initialization failed. Please check your bot identifier and environment configuration."
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Unknown agent validation error";

      // Check for specific 404 error which indicates invalid bot identifier
      if (errorMessage.includes("404") || errorMessage.includes("Not Found")) {
        throw new Error(
          `Invalid bot identifier: The bot identifier "${
            this.configuration?.botIdentifier || "unknown"
          }" was not found. Please verify:
1. The bot identifier is correct
2. The agent is published and accessible
3. You have permission to access this agent in the specified environment
Original error: ${errorMessage}`
        );
      }

      // Provide specific error messages for common issues
      if (
        errorMessage.toLowerCase().includes("bot") ||
        errorMessage.toLowerCase().includes("identifier") ||
        errorMessage.toLowerCase().includes("agent")
      ) {
        throw new Error(
          `Agent connection validation failed: Invalid bot identifier or agent configuration. Please verify your bot identifier and ensure the agent is published and accessible. Original error: ${errorMessage}`
        );
      } else if (errorMessage.toLowerCase().includes("environment")) {
        throw new Error(
          `Environment connection failed: Please verify your environment ID and ensure you have access to the specified environment. Original error: ${errorMessage}`
        );
      } else if (
        errorMessage.toLowerCase().includes("auth") ||
        errorMessage.toLowerCase().includes("unauthorized") ||
        errorMessage.toLowerCase().includes("401")
      ) {
        throw new Error(
          `Authentication failed during agent validation: Please check your credentials and permissions. Original error: ${errorMessage}`
        );
      } else {
        throw new Error(`Agent connection validation failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Executes a single test case (either single-turn or multiturn)
   * Handles different test types and creates appropriate test results
   * @param testCase - The test case to execute
   * @param testRunId - ID of the current test run for result tracking
   * @returns Promise resolving to object with success status and result code
   */
  async executeTest(
    testCase: AgentTestCase,
    testRunId: string
  ): Promise<{ success: boolean; resultCode: number }> {
    try {
      // Check if this is a multiturn test
      if (testCase.testTypeCode === TEST_EXECUTION.MULTITURN_TEST_TYPE) {
        const success = await this.multiturnManager.executeMultiturnTest(
          testCase,
          testRunId,
          this.configuration!
        );

        // For multiturn tests, we need to get the actual result code from Dataverse
        // For now, return based on success, but this should be improved to get actual code
        return {
          success,
          resultCode: success ? RESULT_CODES.SUCCESS : RESULT_CODES.FAILED,
        };
      }

      // Regular single-turn test execution
      const agentResponse = await this.messagingService.sendMessage(
        testCase.testUtterance,
        testCase
      );

      // Create test result record and get the result code
      const testResultId = await this.testResultOps.createTestResult(
        testCase,
        testRunId,
        agentResponse,
        this.configuration!
      );

      // Get the actual result code from the created test result
      const resultCode = testResultId
        ? (await this.testResultOps.getTestResultCode(testResultId)) ??
          RESULT_CODES.ERROR
        : RESULT_CODES.ERROR; // Error if no result created

      const success = resultCode === RESULT_CODES.SUCCESS; // Success code is 1

      return { success, resultCode };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      return { success: false, resultCode: RESULT_CODES.ERROR }; // Error code
    }
  }

  async executeAllTests(
    testCases: AgentTestCase[],
    testRunId: string,
    onProgress?: (
      current: number,
      total: number,
      currentSummary?: TestExecutionSummary
    ) => void
  ): Promise<TestExecutionSummary> {
    const startTime = new Date();

    // Calculate total test cases for UI display (parent tests only, not child tests)
    const totalTestsCount = testCases.length;

    const summary: TestExecutionSummary = {
      totalTests: totalTestsCount,
      successTests: 0,
      failedTests: 0,
      errorTests: 0,
      unknownTests: 0,
      pendingTests: 0,
      startTime,
      successRate: 0,
      resultCodeBreakdown: {
        success: 0,
        failed: 0,
        unknown: 0,
        error: 0,
        pending: 0,
      },
    };

    const testResults: {
      success: boolean;
      resultCode: number;
    }[] = [];

    // Execute test cases in parallel with concurrency limit
    await this.executeTestsInParallel(
      testCases,
      testRunId,
      summary,
      testResults,
      (completed) => {
        onProgress?.(completed, totalTestsCount, { ...summary });
      }
    );

    summary.endTime = new Date();
    summary.duration = summary.endTime.getTime() - summary.startTime.getTime();

    // Calculate success rate
    summary.successRate =
      summary.totalTests > 0
        ? Math.round((summary.successTests / summary.totalTests) * 100)
        : 0;

    return summary;
  }

  /**
   * Executes test cases in parallel with a concurrency limit
   */
  private async executeTestsInParallel(
    testCases: AgentTestCase[],
    testRunId: string,
    summary: TestExecutionSummary,
    testResults: { success: boolean; resultCode?: number }[],
    onProgress: (completed: number) => void
  ): Promise<void> {
    const CONCURRENCY_LIMIT = TEST_EXECUTION.CONCURRENCY_LIMIT; // Maximum number of parallel test executions
    const semaphore = new Semaphore(CONCURRENCY_LIMIT);
    let completedCount = 0;

    const executeTestWithSemaphore = async (
      testCase: AgentTestCase
    ): Promise<void> => {
      // Acquire a semaphore slot
      await semaphore.acquire();

      try {
        const result = await this.executeTest(testCase, testRunId);

        // Record test result for metrics
        testResults.push({
          success: result.success,
          resultCode: result.resultCode,
        });

        // Update summary based on actual result code
        this.updateSummaryWithResultCode(summary, result.resultCode);

        // Calculate completed tests (count only parent test cases for UI)
        completedCount += 1; // Count only the parent test case

        onProgress(completedCount);
      } catch (error) {
        // Record error result for metrics
        testResults.push({
          success: false,
          resultCode: RESULT_CODES.ERROR, // Error code
        });

        // Update summary for error
        this.updateSummaryWithResultCode(summary, RESULT_CODES.ERROR);

        // Account for failed test case (count only parent test case for UI)
        completedCount += 1; // Count only the parent test case

        onProgress(completedCount);
      } finally {
        // Release the semaphore slot
        semaphore.release();
      }
    };

    // Execute all tests with concurrency control
    const testPromises = testCases.map((testCase) =>
      executeTestWithSemaphore(testCase)
    );

    // Wait for all tests to complete
    await Promise.all(testPromises);
  }

  // Public methods for accessing services
  async getTestRun(testRunId: string) {
    return await this.testRunOps.getTestRun(testRunId);
  }

  async getConfiguration(configId: string) {
    return await this.configOps.getConfiguration(configId);
  }

  async getTestCases(testSetId: string) {
    return await this.testSetOps.getTestCases(testSetId);
  }

  async getTestExecutionHistory(testRunId: string) {
    return await this.testResultOps.getTestExecutionHistory(testRunId);
  }

  /**
   * Get the total number of test cases for a specific test run
   * This counts only parent test cases for UI display, not child tests from multiturn conversations
   * @param testRunId - The test run ID
   * @returns Promise resolving to the total test case count
   */
  async getTotalTestCountForRun(testRunId: string): Promise<number> {
    try {
      // Get the test run to find the test set ID
      const testRun = await this.getTestRun(testRunId);

      // Get all test cases for this test set
      const testCases = await this.getTestCases(testRun.testSetId);

      // Calculate total including only parent test cases for UI display
      return testCases.length;
    } catch (error) {
      return 0;
    }
  }

  async runCompleteTestSuite(
    testRunId: string,
    onProgress?: (
      current: number,
      total: number,
      currentSummary?: TestExecutionSummary
    ) => void
  ): Promise<TestExecutionSummary> {
    let testRun: AgentTestRun | undefined;
    let agentConfig: AgentConfiguration | undefined;

    try {
      // Set test run status to "Running" (2) - FIRST STEP
      await this.testRunOps.updateTestRunStatus(
        testRunId,
        TEST_RUN_STATUS.RUNNING
      );

      // Get test run data
      testRun = await this.getTestRun(testRunId);

      // Get agent configuration
      agentConfig = await this.getConfiguration(testRun.configurationId);

      // Initialize with agent configuration (includes agent validation)
      try {
        await this.initialize(agentConfig);
      } catch (initError) {
        // If initialization/validation fails, throw a detailed error
        const initErrorMessage =
          initError instanceof Error
            ? initError.message
            : "Unknown initialization error";
        throw new Error(`Agent initialization failed: ${initErrorMessage}`);
      }

      // If we reach here, agent connection is validated - proceed with test execution
      // Get test cases
      const testCases = await this.getTestCases(testRun.testSetId);

      // Validate we have test cases before proceeding
      if (!testCases || testCases.length === 0) {
        throw new Error(
          "No test cases found for this test run. Please check your test set configuration."
        );
      }

      // Execute all tests
      const summary = await this.executeAllTests(
        testCases,
        testRunId,
        onProgress
      );

      // Determine final status based on test execution, not test results
      // Test run should only be marked as ERROR when there are execution exceptions,
      // not when individual test cases fail their assertions
      const finalStatus: number = TEST_RUN_STATUS.COMPLETE; // Complete (3) - all tests executed successfully

      // Update test run status to final status and set enrichment status codes
      await this.testRunOps.updateTestRunStatus(
        testRunId,
        finalStatus,
        agentConfig
      );

      // Invoke the rollup columns update action after test completion
      try {
        const rollupSuccess =
          await this.postExecOps.invokeRunRollupColumnsUpdates(testRunId);
      } catch (error) {
        // Log the error but don't fail the test run
      }

      // Invoke conditional enrichment actions based on Agent Configuration
      try {
        await this.postExecOps.invokeConditionalEnrichmentActions(
          testRunId,
          agentConfig,
          testRun.testSetId
        );
      } catch (error) {
        // Log the error but don't fail the test run
      }

      return summary;
    } catch (error) {
      // If there's an error in the test suite execution, set status to Error (6)
      await this.testRunOps.updateTestRunStatus(
        testRunId,
        TEST_RUN_STATUS.ERROR
      );

      throw error;
    }
  }

  /**
   * Updates the summary with the correct result code mapping
   * @param summary - The test execution summary to update
   * @param resultCode - The result code from Dataverse (1=Success, 2=Failed, 3=Unknown, 4=Error, 5=Pending)
   */
  private updateSummaryWithResultCode(
    summary: TestExecutionSummary,
    resultCode: number
  ): void {
    console.log(
      `DEBUG: Processing result code ${resultCode} for summary update`
    );
    console.log(`DEBUG: Summary before update:`, {
      totalTests: summary.totalTests,
      successTests: summary.successTests,
      failedTests: summary.failedTests,
      errorTests: summary.errorTests,
      unknownTests: summary.unknownTests,
      pendingTests: summary.pendingTests,
    });

    switch (resultCode) {
      case RESULT_CODES.SUCCESS: // Success
        summary.successTests++;
        summary.resultCodeBreakdown!.success++;
        console.log(
          `DEBUG: Incremented successTests to ${summary.successTests}`
        );
        break;
      case RESULT_CODES.FAILED: // Failed
        summary.failedTests++;
        summary.resultCodeBreakdown!.failed++;
        console.log(`DEBUG: Incremented failedTests to ${summary.failedTests}`);
        break;
      case RESULT_CODES.UNKNOWN: // Unknown
        summary.unknownTests = (summary.unknownTests || 0) + 1;
        summary.resultCodeBreakdown!.unknown++;
        console.log(
          `DEBUG: Incremented unknownTests to ${summary.unknownTests}`
        );
        break;
      case RESULT_CODES.ERROR: // Error
        summary.errorTests++;
        summary.resultCodeBreakdown!.error++;
        console.log(`DEBUG: Incremented errorTests to ${summary.errorTests}`);
        break;
      case RESULT_CODES.PENDING: // Pending
        summary.pendingTests = (summary.pendingTests || 0) + 1;
        summary.resultCodeBreakdown!.pending++;
        console.log(
          `DEBUG: Incremented pendingTests to ${summary.pendingTests}`
        );
        break;
      default:
        // Default to error for unexpected codes
        summary.errorTests++;
        summary.resultCodeBreakdown!.error++;
        console.log(
          `DEBUG: Unexpected result code ${resultCode}, incremented errorTests to ${summary.errorTests}`
        );
        break;
    }

    console.log(`DEBUG: Summary after update:`, {
      totalTests: summary.totalTests,
      successTests: summary.successTests,
      failedTests: summary.failedTests,
      errorTests: summary.errorTests,
      unknownTests: summary.unknownTests,
      pendingTests: summary.pendingTests,
    });
  }

  /**
   * Checks if the test runner has been properly initialized
   * @returns True if the conversation manager is ready for test execution
   */

  isInitialized(): boolean {
    return this.conversationManager.isInitialized();
  }
}

/**
 * Simple semaphore implementation for controlling concurrency
 */
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquires a permit from the semaphore, blocking if none are available
   * Used to control concurrency by limiting the number of simultaneous operations
   */

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve();
      } else {
        this.waitQueue.push(resolve);
      }
    });
  }

  /**
   * Releases a permit back to the semaphore
   * Allows waiting operations to proceed if any are in the queue
   */

  release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      if (next) {
        this.permits--;
        next();
      }
    }
  }
}
