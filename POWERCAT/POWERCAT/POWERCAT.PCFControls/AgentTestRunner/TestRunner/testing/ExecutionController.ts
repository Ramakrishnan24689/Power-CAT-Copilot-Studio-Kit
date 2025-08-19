/**
 * ExecutionController.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides test execution workflow controller for PowerApps PCF Agent Testing framework.
 * Manages complete test execution lifecycle, UI coordination, progress monitoring,
 * and comprehensive error handling for seamless testing experience.
 *
 * Exports:
 *   - TestRunnerController: Primary controller class for test execution workflow orchestration.
 *
 * Usage:
 *   const controller = new TestRunnerController(testService, uiManager, entityId);
 *   await controller.initialize();
 */

/**
 * Test Runner Controller
 * Handles all business logic for test execution and monitoring
 */

import { TestRunner as TestRunnerService } from "./TestExecutor";
import { FluentTestRunnerManager } from "../ui/FluentTestRunnerUI";
import type { TestExecutionSummary } from "../shared/models/DataModels";

// Constants for test runner controller operations
const TEST_RUNNER_CONTROLLER_CONSTANTS = {
  DEFAULTS: {
    INITIAL_TEST_COUNT: 0, // Starting count for test progress tracking
    HISTORY_LIMIT: 50000, // Maximum number of test result records to fetch
    MONITORING_INTERVAL: 2000, // Progress monitoring check interval (milliseconds)
  },

  PROGRESS_MILESTONES: {
    FIRST_TEST: 1, // First test completion milestone
  },

  LOG_LEVELS: {
    INFO: "info", // Informational messages
    SUCCESS: "success", // Success notifications
    WARNING: "warning", // Warning messages
    ERROR: "error", // Error messages
  } as const,

  STATUS_MESSAGES: {
    INITIALIZING: "Initializing test execution",
    LOADING_CONFIG: "Loading test configuration",
    AUTHENTICATING: "Authenticating and connecting to agent",
    EXECUTION_STARTED: "Test execution started",
    EXECUTION_PROGRESS: "Progress",
    EXECUTION_COMPLETED: "Test execution completed successfully",
    EXECUTION_FAILED: "Test execution failed",
    REFRESHING_HISTORY: "Refreshing execution history",
  },

  LOG_MESSAGES: {
    EXECUTION_STARTED: "Test execution started for Test Run",
    AUTHENTICATION_COMPLETED: "Authentication & connection to Agent completed",
    EXECUTION_STARTED_TESTS: "Executing tests now",
    EXECUTION_COMPLETED: "Test execution completed successfully!",
    EXECUTION_FAILED: "Test execution failed",
    READING_HISTORY: "Reading existing test run history",
    HISTORY_LOAD_FAILED: "Failed to load test execution history",
    REFRESH_FAILED: "Failed to refresh test execution history from Dataverse",
    EXECUTION_IS_COMPLETE: "Test execution completed successfully",
    NO_PREVIOUS_RESULTS:
      "No previous test results found - ready for test execution",
  },

  ERROR_MESSAGES: {
    NO_TEST_RUN_ID: "Test Run ID is not available",
    UNKNOWN_ERROR: "Unknown error",
  },
} as const;

/**
 * TestRunnerController
 *
 * Primary test execution workflow orchestrator for PowerApps PCF Agent Testing framework.
 * Coordinates between UI components and test execution services, manages test lifecycle,
 * provides real-time progress monitoring, and handles comprehensive error scenarios.
 */
export class TestRunnerController {
  // Service instances
  private testRunnerService: TestRunnerService;
  private fluentUIManager: FluentTestRunnerManager;

  // State management
  private isExecuting = false;
  private entityId: string | null = null;
  private hasExistingResults = false;
  private currentSummary: TestExecutionSummary | null = null;

  // Progress monitoring
  private progressMonitorInterval: number | null = null;
  private totalTestCount: number =
    TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT;
  private isMonitoringProgress = false;

  /**
   * Creates a new TestRunnerController instance with required service dependencies.
   * @param testRunnerService - Core test execution service for running agent tests.
   * @param fluentUIManager - UI management service for user interface interactions.
   * @param entityId - Unique identifier of the test run entity for execution tracking.
   */
  constructor(
    testRunnerService: TestRunnerService,
    fluentUIManager: FluentTestRunnerManager,
    entityId: string | null
  ) {
    this.testRunnerService = testRunnerService;
    this.fluentUIManager = fluentUIManager;
    this.entityId = entityId;

    // Set up callback for running tests
    this.fluentUIManager.setOnRunTestsCallback(() => this.executeAllTests());
  }

  /**
   * Helper method to calculate success rate
   * @param successTests - Number of successful tests
   * @param totalTests - Total number of tests
   * @returns Success rate as percentage
   */
  private calculateSuccessRate(
    successTests: number,
    totalTests: number
  ): number {
    return totalTests >
      TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT
      ? Math.round((successTests / totalTests) * 100)
      : TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT;
  }

  /**
   * Helper method to create TestExecutionSummary from history data
   * @param historyData - Test execution history data
   * @param totalPlanned - Total planned test count
   * @param startTime - Optional start time (defaults to current time)
   * @param endTime - Optional end time
   * @param duration - Optional duration in milliseconds
   * @returns Formatted TestExecutionSummary object
   */
  private createTestExecutionSummary(
    historyData: {
      success: number;
      failed: number;
      error: number;
      unknown: number;
      pending: number;
    },
    totalPlanned: number,
    startTime?: Date,
    endTime?: Date,
    duration?: number
  ): TestExecutionSummary {
    return {
      totalTests: totalPlanned,
      successTests: historyData.success,
      failedTests: historyData.failed,
      errorTests: historyData.error,
      unknownTests: historyData.unknown,
      pendingTests: historyData.pending,
      startTime: startTime ?? new Date(),
      endTime,
      duration,
      successRate: this.calculateSuccessRate(historyData.success, totalPlanned),
      resultCodeBreakdown: {
        success: historyData.success,
        failed: historyData.failed,
        unknown: historyData.unknown,
        error: historyData.error,
        pending: historyData.pending,
      },
    };
  }

  /**
   * Helper method to extract error message from error object
   * @param error - Error object or unknown value
   * @returns Formatted error message string
   */
  private getErrorMessage(error: unknown): string {
    return error instanceof Error
      ? error.message
      : TEST_RUNNER_CONTROLLER_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  /**
   * Helper method to convert duration from milliseconds to seconds
   * @param durationMs - Duration in milliseconds
   * @returns Duration in seconds
   */
  private convertToSeconds(durationMs: number): number {
    return Math.round(durationMs / 1000);
  }

  /**
   * Helper method to check if current test is the first test
   * @param current - Current test number
   * @returns True if this is the first test
   */
  private isFirstTest(current: number): boolean {
    return (
      current ===
      TEST_RUNNER_CONTROLLER_CONSTANTS.PROGRESS_MILESTONES.FIRST_TEST
    );
  }

  /**
   * Helper method to check if tests have results
   * @param totalResults - Total number of results
   * @returns True if there are results
   */
  private hasResults(totalResults: number): boolean {
    return (
      totalResults >
      TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT
    );
  }

  /**
   * Log messages to FluentUI interface with fallback error handling
   *
   * @param level - Log level (info, success, warning, error)
   * @param message - Message to display to users
   */
  private log(
    level: (typeof TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS)[keyof typeof TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS],
    message: string
  ): void {
    // Check if FluentUI manager exists
    if (!this.fluentUIManager) {
      return;
    }

    try {
      // Primary method: Log to UI for user feedback
      this.fluentUIManager.addLog(level, message);
    } catch (uiError) {
      // Try alternative FluentUI methods
      try {
        if (level === TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR) {
          this.fluentUIManager.logError(message);
        } else if (
          level === TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.WARNING
        ) {
          this.fluentUIManager.logWarning(message);
        } else if (
          level === TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.SUCCESS
        ) {
          this.fluentUIManager.logSuccess(message);
        } else {
          this.fluentUIManager.logInfo(message);
        }
      } catch (fallbackError) {
        // All logging methods failed - silently continue
      }
    }
  }

  /**
   * Public method for logging errors from external components like ConversationManager
   * @param message - Error message to log
   */
  public logError(message: string): void {
    this.log(TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR, message);
  }

  /**
   * Initializes the controller and establishes baseline test execution state.
   * @returns Promise that resolves when initialization is complete.
   */
  public async initialize(): Promise<void> {
    this.fluentUIManager.setHasExistingResults(this.hasExistingResults);

    // Comment out loading previous results during initialization per user request
    // await this.loadTestExecutionHistory();
  }

  /**
   * Executes all tests for the current test run with comprehensive workflow orchestration.
   * @returns Promise that resolves when test execution workflow is complete.
   */
  public async executeAllTests(): Promise<void> {
    if (this.isExecuting) return;

    // Stop any existing progress monitoring since we're starting a new execution
    this.stopProgressMonitoring();

    this.isExecuting = true;
    this.fluentUIManager.setRunning(true);
    this.fluentUIManager.setStatus(
      TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.INITIALIZING
    );

    try {
      const testRunId = this.getTestRunId();
      if (!testRunId) {
        throw new Error(
          TEST_RUNNER_CONTROLLER_CONSTANTS.ERROR_MESSAGES.NO_TEST_RUN_ID
        );
      }

      // 🚀 Test Execution Started - Get test run name for better logging
      try {
        const testRun = await this.testRunnerService.getTestRun(testRunId);
        this.fluentUIManager.logTestExecutionStarted(testRun.name || testRunId);
      } catch (error) {
        // Fallback to testRunId if we can't get the name
        this.fluentUIManager.logTestExecutionStarted(testRunId);
      }

      this.fluentUIManager.setStatus(
        TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.LOADING_CONFIG
      );
      this.fluentUIManager.logConfigurationLoaded();

      // Update status during authentication phase
      this.fluentUIManager.setStatus(
        TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.AUTHENTICATING
      );
      this.fluentUIManager.logAuthenticationStarted();

      // Execute the complete test suite with detailed progress tracking
      await this.startProgressMonitoring();

      const summary = await this.testRunnerService.runCompleteTestSuite(
        testRunId,
        (
          current: number,
          total: number,
          currentSummary?: TestExecutionSummary
        ) => {
          // Progress tracking
          this.fluentUIManager?.setProgress(current, total);

          // Update status to show current progress
          this.fluentUIManager?.setStatus(
            `${TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.EXECUTION_PROGRESS} (${current}/${total} tests completed)`
          );

          // Log progress milestones
          if (this.isFirstTest(current)) {
            this.fluentUIManager?.setStatus(
              `${TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.EXECUTION_STARTED} (${current}/${total} tests completed)`
            );
            this.log(
              TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.SUCCESS,
              TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES
                .AUTHENTICATION_COMPLETED
            );
            this.log(
              TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.INFO,
              TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES
                .EXECUTION_STARTED_TESTS
            );
          }

          // Log completion when all tests are processed
          if (current === total) {
            this.log(
              TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.INFO,
              `🏁 Test execution completed: ${current}/${total} tests processed`
            );
          }
        }
      );

      // Update summary
      this.currentSummary = summary;

      // CRITICAL: Stop progress monitoring BEFORE setting final summary to prevent race condition
      this.stopProgressMonitoring();

      // Reconcile final summary from Dataverse to capture multiturn parent rollups
      // Use a short retry to allow final writes/rollups to land, then prefer DB buckets
      let finalSummaryForUI: TestExecutionSummary = summary;
      const reconciled = await this.reconcileFinalSummaryFromDatabase();
      if (reconciled) {
        finalSummaryForUI = reconciled;
      }

      // Update the UI with the reconciled DB summary (or fallback) BEFORE logging completion
      this.fluentUIManager?.setSummary(finalSummaryForUI);

      // Call the UI's comprehensive completion logging with the calculated execution time
      if (finalSummaryForUI.duration ?? summary.duration) {
        const durationMs = finalSummaryForUI.duration ?? summary.duration!;
        const durationSec = this.convertToSeconds(durationMs);
        this.fluentUIManager.logTestRunCompletion(
          finalSummaryForUI,
          durationSec
        );
      } else {
        this.fluentUIManager.logTestRunCompletion(finalSummaryForUI);
      }

      // Mark that tests have been executed
      this.hasExistingResults = true;
      this.fluentUIManager.setHasExistingResults(true);

      this.fluentUIManager.setStatus(
        TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.EXECUTION_COMPLETED
      );
    } catch (error) {
      // Error handling
      const errorMessage = this.getErrorMessage(error);

      // CRITICAL: Force UI to show logs by ensuring FluentUI manager is in error state

      // First, ensure the UI is not in a loading/running state
      this.fluentUIManager.setRunning(false);

      // Set status immediately to show failure
      this.fluentUIManager.setStatus("❌ Test execution failed");

      // Clear progress only when stopping execution completely
      this.fluentUIManager.clearResults();

      // Simplified error logging - avoid duplicates
      this.log(
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
        "🚨 CRITICAL ERROR: Test execution failed"
      );

      // Enhanced error logging based on error type - with comprehensive detection
      if (
        errorMessage.toLowerCase().includes("auth") ||
        errorMessage.toLowerCase().includes("credential") ||
        errorMessage.toLowerCase().includes("unauthorized") ||
        errorMessage.toLowerCase().includes("401") ||
        errorMessage.toLowerCase().includes("clientid") ||
        errorMessage.toLowerCase().includes("tenantid")
      ) {
        // Single authentication error message instead of multiple duplicates
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
          `🔐 Authentication Error: ${errorMessage}`
        );
      } else if (
        errorMessage.toLowerCase().includes("agent") ||
        errorMessage.toLowerCase().includes("connection") ||
        errorMessage.toLowerCase().includes("bot") ||
        errorMessage.toLowerCase().includes("identifier") ||
        errorMessage.toLowerCase().includes("copilot") ||
        errorMessage.toLowerCase().includes("environment")
      ) {
        // For non-authentication errors, show the error details first
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
          `Error details: ${errorMessage}`
        );
        // Use FluentUI for specialized agent error message only
        try {
          this.fluentUIManager.logAgentConnectionError();
        } catch (agentLogError) {
          // Agent error logging failed - silently continue
        }
      } else {
        // For any other error type, show error details
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
          `Error details: ${errorMessage}`
        );
        // For any other error type
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
          "💥 Unexpected error occurred during test execution"
        );
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
          "💥 Execution Error: " + errorMessage
        );
      }

      // Refresh from database in case some tests were completed
      try {
        await this.refreshTestExecutionHistoryFromDatabase();
      } catch (refreshError) {
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES.REFRESH_FAILED
        );
      }
    } finally {
      this.isExecuting = false;
      this.fluentUIManager.setRunning(false);
    }
  }

  /**
   * Rebuild the final donut summary from Dataverse history counts to ensure
   * multiturn parent rollups are reflected accurately.
   * Performs a short retry/backoff for eventual consistency.
   */
  private async reconcileFinalSummaryFromDatabase(): Promise<TestExecutionSummary | null> {
    if (!this.entityId) return null;

    const totalPlanned = await this.getTotalTestCountSafely();
    // Allow more time for Dataverse to finish rollups/async updates for multiturn
    const maxAttempts = 20; // up to ~10s total
    const delayMs = 500;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const historyData =
          await this.testRunnerService.getTestExecutionHistory(this.entityId);

        // If we have any results, build a summary using planned total as denominator
        const sumBuckets =
          historyData.success +
          historyData.failed +
          historyData.error +
          historyData.unknown +
          historyData.pending;

        const hasAny =
          historyData.total >
          TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT;

        // Prefer a fully consistent state where all parent tests are represented
        if (hasAny && sumBuckets === totalPlanned) {
          const finalSummary = this.createTestExecutionSummary(
            historyData,
            totalPlanned,
            this.currentSummary?.startTime ?? new Date(),
            new Date(),
            this.currentSummary?.startTime && this.currentSummary?.endTime
              ? this.currentSummary!.endTime!.getTime() -
                  this.currentSummary!.startTime!.getTime()
              : undefined
          );

          // Cache the reconciled summary
          this.currentSummary = finalSummary;
          return finalSummary;
        }
        // If we have any results but not fully consistent yet, keep retrying
      } catch (_err) {
        // ignore and retry
      }

      // short backoff between attempts
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    return null;
  }

  /**
   * Get the current test run ID
   * @returns Test run entity ID or null if not available
   */
  private getTestRunId(): string | null {
    return this.entityId;
  }

  /**
   * Load existing test execution history from database
   */
  private async loadTestExecutionHistory(): Promise<void> {
    try {
      // Use the current test run ID for filtering historical data
      if (!this.entityId) {
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.WARNING,
          TEST_RUNNER_CONTROLLER_CONSTANTS.ERROR_MESSAGES.NO_TEST_RUN_ID
        );
        return;
      }

      // Get historical test execution data from cat_copilottestresult table
      const historyData = await this.testRunnerService.getTestExecutionHistory(
        this.entityId
      );
      const totalPlanned = await this.getTotalTestCountSafely();

      // Only show Test Execution History section if there are result records
      if (this.hasResults(historyData.total)) {
        // Build comprehensive results summary message
        const resultParts = [
          `${historyData.success} successful`,
          `${historyData.failed} failed`,
          `${historyData.error} errors`,
        ];

        if (historyData.unknown > 0) {
          resultParts.push(`${historyData.unknown} unknown`);
        }

        if (historyData.pending > 0) {
          resultParts.push(`${historyData.pending} pending`);
        }

        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.INFO,
          `Found ${historyData.total} existing test results: ${resultParts.join(
            ", "
          )}`
        );

        // Convert historical data to TestExecutionSummary format for the donut chart
        const historicalSummary = this.createTestExecutionSummary(
          historyData,
          totalPlanned
        );

        // Update the donut chart with historical data (this will make the section visible)
        this.fluentUIManager?.setSummary(historicalSummary);

        // Disable the Run All Tests button since results already exist
        this.hasExistingResults = true;
        this.fluentUIManager.setHasExistingResults(true);

        // Update status to show historical data is loaded
        this.fluentUIManager.setStatus(
          `Test results found (${historyData.total} results for this test run)`
        );

        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.SUCCESS,
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES.EXECUTION_IS_COMPLETE
        );
      }
      // } else {
      //   // No historical data - keep summary section hidden and button enabled
      //   this.log(
      //     TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.INFO,
      //     TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES.NO_PREVIOUS_RESULTS
      //   );
      // }

      // Start progress monitoring if we have partial results (tests in progress)
      if (
        this.hasResults(historyData.total) &&
        historyData.total < (await this.getTotalTestCountSafely())
      ) {
        // Tests are in progress, start monitoring
        await this.startProgressMonitoring();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : TEST_RUNNER_CONTROLLER_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR;

      this.fluentUIManager.setStatus("Failed to load historical data");
      this.log(
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES.HISTORY_LOAD_FAILED
      );
      this.log(
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
        `Error details: ${errorMessage}`
      );
    }
  }

  /**
   * Refresh test execution history from database
   */
  private async refreshTestExecutionHistoryFromDatabase(): Promise<void> {
    if (!this.entityId) {
      this.log(
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.WARNING,
        TEST_RUNNER_CONTROLLER_CONSTANTS.ERROR_MESSAGES.NO_TEST_RUN_ID
      );
      return;
    }

    try {
      // Get fresh historical test execution data from cat_copilottestresult table
      const historyData = await this.testRunnerService.getTestExecutionHistory(
        this.entityId
      );
      const totalPlanned = await this.getTotalTestCountSafely();

      if (this.hasResults(historyData.total)) {
        // Convert historical data to TestExecutionSummary format for the donut chart
        const historicalSummary = this.createTestExecutionSummary(
          historyData,
          totalPlanned
        );

        // Update the donut chart with fresh historical data from database
        this.fluentUIManager?.setSummary(historicalSummary);
      }
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);

      this.log(
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES.REFRESH_FAILED
      );
      this.log(
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
        `Refresh error details: ${errorMessage}`
      );
    }
  }

  /**
   * Safely get total test count, returning 0 if there's an error
   * @returns Total number of tests that should be executed for this run
   */
  private async getTotalTestCountSafely(): Promise<number> {
    if (!this.entityId) {
      return TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT;
    }

    try {
      return await this.testRunnerService.getTotalTestCountForRun(
        this.entityId
      );
    } catch (error) {
      return TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT;
    }
  }

  /**
   * Start periodic progress monitoring when there are existing test results
   */
  private async startProgressMonitoring(): Promise<void> {
    if (this.isMonitoringProgress || !this.entityId) {
      return;
    }

    this.isMonitoringProgress = true;

    try {
      // Get total test count for this run
      this.totalTestCount =
        await this.testRunnerService.getTotalTestCountForRun(this.entityId);

      if (
        this.totalTestCount ===
        TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT
      ) {
        this.isMonitoringProgress = false;
        return;
      }

      // Start the periodic monitoring
      this.progressMonitorInterval = setInterval(async () => {
        await this.checkAndUpdateProgress();
      }, TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.MONITORING_INTERVAL) as unknown as number; // Check every 2 seconds

      // Initial progress check
      await this.checkAndUpdateProgress();
    } catch (error) {
      this.isMonitoringProgress = false;
    }
  }

  /**
   * Stop the periodic progress monitoring
   */
  private stopProgressMonitoring(): void {
    if (this.progressMonitorInterval) {
      clearInterval(this.progressMonitorInterval);
      this.progressMonitorInterval = null;
    }
    this.isMonitoringProgress = false;
  }

  /**
   * Check current progress and update UI accordingly
   */
  private async checkAndUpdateProgress(): Promise<void> {
    if (!this.entityId) {
      return;
    }

    try {
      // Get current test execution results
      const historyData = await this.testRunnerService.getTestExecutionHistory(
        this.entityId
      );

      if (
        historyData.total ===
        TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT
      ) {
        // No results yet, continue monitoring
        return;
      }

      // Check if tests are complete
      const isComplete = historyData.total >= this.totalTestCount;
      const totalPlanned =
        this.totalTestCount || (await this.getTotalTestCountSafely());
      // Always reflect DB result code distribution in the donut mid-run
      const historicalSummary = this.createTestExecutionSummary(
        historyData,
        totalPlanned
      );

      if (isComplete) {
        // Tests are complete, stop monitoring and update UI
        this.stopProgressMonitoring();
        this.hasExistingResults = true;

        if (!this.isExecuting) {
          this.fluentUIManager.setHasExistingResults(true);
        }

        this.fluentUIManager.setStatus(
          `Test results found (${historyData.total} results for this test run)`
        );

        // Hide progress bar since tests are complete - only clear if not running
        if (!this.isExecuting) {
          this.fluentUIManager.clearResults(); // Clear any existing progress display
        }

        // Set donut from latest DB state to ensure codes match final rollup
        this.fluentUIManager?.setSummary(historicalSummary);

        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.SUCCESS,
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES.EXECUTION_IS_COMPLETE
        );
      } else {
        // Tests are still in progress, show current progress
        this.fluentUIManager.setProgress(
          historyData.total,
          this.totalTestCount
        );
        this.fluentUIManager.setStatus(
          `${TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.EXECUTION_PROGRESS} (${historyData.total}/${this.totalTestCount} tests completed)`
        );

        // During active execution, always update donut to show real-time progress
        this.fluentUIManager?.setSummary(historicalSummary);
      }
    } catch (error) {
      // Don't stop monitoring on errors, just continue silently
    }
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    // Stop progress monitoring
    this.stopProgressMonitoring();
  }

  /**
   * Get current execution state
   * @returns Object containing current execution state information
   */
  public getExecutionState(): {
    isExecuting: boolean;
    hasExistingResults: boolean;
    currentSummary: TestExecutionSummary | null;
  } {
    return {
      isExecuting: this.isExecuting,
      hasExistingResults: this.hasExistingResults,
      currentSummary: this.currentSummary,
    };
  }
}
