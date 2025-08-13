/**
 * TestExecutor.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides core test execution engine for PowerApps PCF Agent Testing framework.
 * Orchestrates complete test execution lifecycle including agent authentication,
 * test case execution (single-turn and multiturn), result tracking, and enrichment operations.
 * Handles parallel test execution with configurable concurrency control and comprehensive error handling.
 *
 * Exports:
 *   - TestRunner: Primary service class for agent test execution and lifecycle management.
 *   - Semaphore: Concurrency control implementation for parallel test execution.
 *
 * Usage:
 *   const testRunner = new TestRunner(context, errorLogger);
 *   await testRunner.initialize(agentConfig);
 *   const summary = await testRunner.runCompleteTestSuite(testRunId, progressCallback);
 */

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

/**
 * TestRunner
 *
 * Core test execution service for PowerApps PCF Agent Testing framework.
 * Orchestrates complete test lifecycle including agent authentication, parallel execution,
 * result tracking, and post-execution enrichment operations.
 *
 * This service integrates multiple components to deliver comprehensive testing capabilities
 * with support for both single-turn and multiturn conversation patterns, configurable
 * concurrency control, and real-time progress monitoring for UI integration.
 */
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
  private context: ComponentFramework.Context<unknown>;
  private errorLogger?: (error: string) => void;

  /**
   * Creates a new TestRunner instance with required Dataverse operation dependencies.
   * @param context - The PowerApps Component Framework context for Dataverse operations.
   * @param onError - Optional error callback function for logging and error handling.
   */
  constructor(
    context: ComponentFramework.Context<unknown>,
    onError?: (error: string) => void
  ) {
    this.context = context;
    this.errorLogger = onError;
    this.conversationManager = new ConversationManager(context, onError);
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
   * Sets the error logger callback for cloud configuration warnings and errors
   * @param logger - Function that handles error logging
   */
  setErrorLogger(logger: (error: string) => void): void {
    this.errorLogger = logger;
    this.conversationManager = new ConversationManager(this.context, logger);
    this.messagingService = new MessagingService(this.conversationManager);
    this.multiturnManager = new MultiturnConversationManager(
      this.messagingService,
      this.context
    );
  }

  /**
   * Initializes the TestRunner with agent configuration and validates connectivity.
   * @param agentConfig - The agent configuration containing authentication and connection details.
   * @returns Promise that resolves when initialization and validation are complete.
   */
  async initialize(agentConfig: AgentConfiguration): Promise<void> {
    this.configuration = agentConfig;
    await this.conversationManager.initialize(agentConfig);

    // Validate agent connection immediately after initialization
    await this.validateAgentConnection();
  }

  /**
   * Validates agent connectivity and readiness for test execution.
   * @returns Promise that resolves when agent connection is validated successfully.
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
        errorMessage.toLowerCase().includes("401") ||
        errorMessage.toLowerCase().includes("clientid") ||
        errorMessage.toLowerCase().includes("tenantid")
      ) {
        // For authentication errors, re-throw original error without wrapping
        throw error;
      } else {
        throw new Error(`Agent connection validation failed: ${errorMessage}`);
      }
    }
  }

  /**
   * Executes a single test case with comprehensive result tracking.
   * @param testCase - The test case containing test data and configuration.
   * @param testRunId - Unique identifier of the current test run for result tracking.
   * @returns Promise resolving to execution result with success status and result code.
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
        // For multiturn tests, return based on immediate success; donut will be aligned by monitoring via DB history
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
      return { success: false, resultCode: RESULT_CODES.ERROR }; // Error code
    }
  }

  /**
   * Executes all test cases with parallel processing and comprehensive progress tracking.
   * @param testCases - Array of test cases to execute in the current test run.
   * @param testRunId - Unique identifier of the test run for result tracking.
   * @param onProgress - Optional callback for real-time progress updates during execution.
   * @returns Promise resolving to comprehensive test execution summary with metrics.
   */
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

        // Account for failed test case
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

  /**
   * Executes a complete test suite with full lifecycle management.
   * @param testRunId - Unique identifier of the test run to execute.
   * @param onProgress - Optional callback for real-time progress updates during execution.
   * @returns Promise resolving to comprehensive test execution summary with detailed metrics.
   */
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

      // Determine final status based on test execution
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
    switch (resultCode) {
      case RESULT_CODES.SUCCESS: // Success
        summary.successTests++;
        summary.resultCodeBreakdown!.success++;
        break;
      case RESULT_CODES.FAILED: // Failed
        summary.failedTests++;
        summary.resultCodeBreakdown!.failed++;
        break;
      case RESULT_CODES.UNKNOWN: // Unknown
        summary.unknownTests = (summary.unknownTests || 0) + 1;
        summary.resultCodeBreakdown!.unknown++;
        break;
      case RESULT_CODES.ERROR: // Error
        summary.errorTests++;
        summary.resultCodeBreakdown!.error++;
        break;
      case RESULT_CODES.PENDING: // Pending
        summary.pendingTests = (summary.pendingTests || 0) + 1;
        summary.resultCodeBreakdown!.pending++;
        break;
      default:
        // Default to error for unexpected codes
        summary.errorTests++;
        summary.resultCodeBreakdown!.error++;
        break;
    }
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
 * Semaphore
 *
 * Lightweight semaphore implementation for controlling concurrent test execution.
 * Provides permit-based access control to limit simultaneous operations and prevent
 * resource exhaustion during parallel test processing.
 */
class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  /**
   * Creates a new Semaphore with the specified number of permits.
   * @param permits - Maximum number of concurrent operations allowed.
   */
  constructor(permits: number) {
    this.permits = permits;
  }

  /**
   * Acquires a permit from the semaphore for resource access.
   * @returns Promise that resolves when a permit is successfully acquired.
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
   * Releases a permit back to the semaphore for other operations to use.
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
