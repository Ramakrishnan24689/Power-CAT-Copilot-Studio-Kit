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
    QUARTER: 25, // 25% progress milestone
    HALF: 50, // 50% progress milestone
    THREE_QUARTERS: 75, // 75% progress milestone
    MILESTONE_INTERVAL: 10, // Interval for logging progress updates (every 10%)
  },

  LOG_LEVELS: {
    INFO: "info", // Informational messages
    SUCCESS: "success", // Success notifications
    WARNING: "warning", // Warning messages
    ERROR: "error", // Error messages
  } as const,

  STATUS_MESSAGES: {
    INITIALIZING: "Initializing test execution...",
    LOADING_CONFIG: "Loading test configuration...",
    AUTHENTICATING: "Authenticating and connecting to agent...",
    EXECUTION_STARTED: "Test execution started",
    EXECUTION_PROGRESS: "Progress",
    EXECUTION_COMPLETED: "✅ Test execution completed successfully",
    EXECUTION_FAILED: "❌ Test execution failed",
    REFRESHING_HISTORY: "Refreshing execution history...",
  },

  LOG_MESSAGES: {
    EXECUTION_STARTED: "Test execution started for Test Run",
    AUTHENTICATION_COMPLETED: "Authentication & connection to Agent completed",
    EXECUTION_STARTED_TESTS: "Executing tests now",
    EXECUTION_COMPLETED: "Test execution completed successfully!",
    EXECUTION_FAILED: "Test execution failed",
    READING_HISTORY: "Reading existing test run history...",
    HISTORY_LOAD_FAILED: "Failed to load test execution history",
    REFRESH_FAILED: "Failed to refresh test execution history from Dataverse",
    EXECUTION_IS_COMPLETE:
      "Test execution is either already started or completed",
    NO_PREVIOUS_RESULTS:
      "No previous test results found - ready for test execution",
  },

  ERROR_MESSAGES: {
    NO_TEST_RUN_ID: "Test Run ID is not available",
    UNKNOWN_ERROR: "Unknown error",
  },
} as const;

/**
 * Controller class that manages test execution workflow
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
   * Helper method to calculate progress percentage
   * @param current - Current count
   * @param total - Total count
   * @returns Percentage as rounded number
   */
  private calculatePercentage(current: number, total: number): number {
    return Math.round((current / total) * 100);
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
   * Helper method to convert duration from milliseconds to seconds
   * @param durationMs - Duration in milliseconds
   * @returns Duration in seconds
   */
  private convertToSeconds(durationMs: number): number {
    return Math.round(durationMs / 1000);
  }

  /**
   * Helper method to check if percentage is a progress milestone
   * @param percentage - Progress percentage to check
   * @returns True if percentage is a milestone
   */
  private isProgressMilestone(percentage: number): boolean {
    return (
      percentage ===
        TEST_RUNNER_CONTROLLER_CONSTANTS.PROGRESS_MILESTONES.QUARTER ||
      percentage ===
        TEST_RUNNER_CONTROLLER_CONSTANTS.PROGRESS_MILESTONES.HALF ||
      percentage ===
        TEST_RUNNER_CONTROLLER_CONSTANTS.PROGRESS_MILESTONES.THREE_QUARTERS
    );
  }

  /**
   * Helper method to check if percentage is a monitoring milestone
   * @param percentage - Progress percentage to check
   * @returns True if percentage is a monitoring milestone
   */
  private isMonitoringMilestone(percentage: number): boolean {
    return (
      percentage >
        TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT &&
      percentage %
        TEST_RUNNER_CONTROLLER_CONSTANTS.PROGRESS_MILESTONES
          .MILESTONE_INTERVAL ===
        TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT
    );
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
    // Debug: Check if FluentUI manager exists
    if (!this.fluentUIManager) {
      console.error("FluentUI manager is not available for logging:", {
        level,
        message,
      });
      return;
    }

    try {
      // Primary method: Log to UI for user feedback
      this.fluentUIManager.addLog(level, message);
      console.log("✅ Successfully logged to UI:", { level, message });
    } catch (uiError) {
      // Fallback method: If UI logging fails, use console for debugging
      console.error("UI logging failed, using fallback:", {
        level,
        message,
        uiError: uiError instanceof Error ? uiError.message : uiError,
      });

      // Try alternative FluentUI methods
      try {
        if (level === TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR) {
          this.fluentUIManager.logError(message);
          console.log("✅ Fallback error logging successful");
        } else if (
          level === TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.WARNING
        ) {
          this.fluentUIManager.logWarning(message);
          console.log("✅ Fallback warning logging successful");
        } else if (
          level === TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.SUCCESS
        ) {
          this.fluentUIManager.logSuccess(message);
          console.log("✅ Fallback success logging successful");
        } else {
          this.fluentUIManager.logInfo(message);
          console.log("✅ Fallback info logging successful");
        }
      } catch (fallbackError) {
        console.error("All logging methods failed:", {
          message,
          fallbackError:
            fallbackError instanceof Error
              ? fallbackError.message
              : fallbackError,
        });
      }
    }
  }

  /**
   * Initialize the controller and load existing test execution history
   */
  public async initialize(): Promise<void> {
    // Update initial state based on existing results
    this.fluentUIManager.setHasExistingResults(this.hasExistingResults);

    // Load existing test execution history
    await this.loadTestExecutionHistory();
  }

  /**
   * Execute all tests for the current test run
   * Orchestrates the complete test execution workflow
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
      const summary = await this.testRunnerService.runCompleteTestSuite(
        testRunId,
        (
          current: number,
          total: number,
          currentSummary?: TestExecutionSummary
        ) => {
          // Progress tracking with percentage
          const percentage = this.calculatePercentage(current, total);
          this.fluentUIManager?.setProgress(current, total);

          // Update status to show current progress
          this.fluentUIManager?.setStatus(
            `${TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.EXECUTION_PROGRESS} (${current}/${total} tests completed)`
          );

          // Update donut chart in real-time if we have current summary data
          if (
            currentSummary &&
            current >
              TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT
          ) {
            // Create a copy of the summary with updated totals for display
            const realTimeSummary: TestExecutionSummary = {
              ...currentSummary,
              // Keep the actual pending tests count (tests with result code 5)
              // Do NOT count unexecuted tests as "pending"
              pendingTests: currentSummary.pendingTests || 0,
              // Update success rate calculation
              successRate:
                current >
                TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT
                  ? this.calculateSuccessRate(
                      currentSummary.successTests,
                      current
                    )
                  : TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS
                      .INITIAL_TEST_COUNT,
            };

            // Update the donut chart with real-time progress
            this.fluentUIManager?.setSummary(realTimeSummary);
          }

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

          // Log only completion - no progress milestones
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

      // Debug logging to see the final summary received from test executor
      console.log("DEBUG: ExecutionController received final summary:", {
        totalTests: summary.totalTests,
        successTests: summary.successTests,
        failedTests: summary.failedTests,
        errorTests: summary.errorTests,
        unknownTests: summary.unknownTests,
        pendingTests: summary.pendingTests,
      });

      // Call the UI's comprehensive completion logging with the calculated execution time
      if (summary.duration) {
        const durationSec = this.convertToSeconds(summary.duration);
        this.fluentUIManager.logTestRunCompletion(summary, durationSec);
      } else {
        this.fluentUIManager.logTestRunCompletion(summary);
      }

      // Mark that tests have been executed
      this.hasExistingResults = true;
      this.fluentUIManager.setHasExistingResults(true);

      // Refresh Test Execution History from database to show accurate counts
      await this.refreshTestExecutionHistoryFromDatabase();

      this.fluentUIManager.setStatus(
        TEST_RUNNER_CONTROLLER_CONSTANTS.STATUS_MESSAGES.EXECUTION_COMPLETED
      );
    } catch (error) {
      // Error handling
      const errorMessage =
        error instanceof Error
          ? error.message
          : TEST_RUNNER_CONTROLLER_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR;

      // IMMEDIATE: Ensure error logging is working - multiple approaches
      console.error("🚨 TEST EXECUTION FAILED:", errorMessage);

      // CRITICAL: Force UI to show logs by ensuring FluentUI manager is in error state
      try {
        // First, ensure the UI is not in a loading/running state
        this.fluentUIManager.setRunning(false);

        // Set status immediately to show failure
        this.fluentUIManager.setStatus("❌ Test execution failed");

        // Clear any progress to ensure error is visible
        this.fluentUIManager.clearResults();
      } catch (statusError) {
        console.error("Status clearing failed:", statusError);
      }

      // Simplified error logging - avoid duplicates
      this.log(
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
        "🚨 CRITICAL ERROR: Test execution failed"
      );
      this.log(
        TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
        `Error details: ${errorMessage}`
      );

      // Enhanced error logging based on error type - with comprehensive detection
      if (
        errorMessage.toLowerCase().includes("auth") ||
        errorMessage.toLowerCase().includes("credential") ||
        errorMessage.toLowerCase().includes("unauthorized") ||
        errorMessage.toLowerCase().includes("401")
      ) {
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
          "🔐 Authentication failed - Please check your credentials and permissions"
        );
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.ERROR,
          "🔐 Authentication Error: " + errorMessage
        );
        // Use FluentUI for specialized error message
        try {
          this.fluentUIManager.logAuthenticationError();
        } catch (authLogError) {
          console.error("Authentication error logging failed:", authLogError);
        }
      } else if (
        errorMessage.toLowerCase().includes("agent") ||
        errorMessage.toLowerCase().includes("connection") ||
        errorMessage.toLowerCase().includes("bot") ||
        errorMessage.toLowerCase().includes("identifier") ||
        errorMessage.toLowerCase().includes("copilot") ||
        errorMessage.toLowerCase().includes("environment")
      ) {
        // Use FluentUI for specialized agent error message only
        try {
          this.fluentUIManager.logAgentConnectionError();
        } catch (agentLogError) {
          console.error("Agent error logging failed:", agentLogError);
        }
      } else {
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
        const historicalSummary: TestExecutionSummary = {
          totalTests: historyData.total,
          successTests: historyData.success,
          failedTests: historyData.failed,
          errorTests: historyData.error,
          unknownTests: historyData.unknown,
          pendingTests: historyData.pending,
          startTime: new Date(),
          successRate: this.calculateSuccessRate(
            historyData.success,
            historyData.total
          ),
          resultCodeBreakdown: {
            success: historyData.success,
            failed: historyData.failed,
            unknown: historyData.unknown,
            error: historyData.error,
            pending: historyData.pending,
          },
        };

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
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.INFO,
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES.EXECUTION_IS_COMPLETE
        );
      } else {
        // No historical data - keep summary section hidden and button enabled
        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.INFO,
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_MESSAGES.NO_PREVIOUS_RESULTS
        );
      }

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

      if (this.hasResults(historyData.total)) {
        // Convert historical data to TestExecutionSummary format for the donut chart
        const historicalSummary: TestExecutionSummary = {
          totalTests: historyData.total,
          successTests: historyData.success,
          failedTests: historyData.failed,
          errorTests: historyData.error,
          unknownTests: historyData.unknown,
          pendingTests: historyData.pending,
          startTime: new Date(),
          successRate: this.calculateSuccessRate(
            historyData.success,
            historyData.total
          ),
          resultCodeBreakdown: {
            success: historyData.success,
            failed: historyData.failed,
            unknown: historyData.unknown,
            error: historyData.error,
            pending: historyData.pending,
          },
        };

        // Update the donut chart with fresh historical data from database
        this.fluentUIManager?.setSummary(historicalSummary);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : TEST_RUNNER_CONTROLLER_CONSTANTS.ERROR_MESSAGES.UNKNOWN_ERROR;

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

      if (isComplete) {
        // Tests are complete, stop monitoring and update UI
        this.stopProgressMonitoring();
        this.hasExistingResults = true;

        this.fluentUIManager.setHasExistingResults(true);
        this.fluentUIManager.setStatus(
          `Test results found (${historyData.total} results for this test run)`
        );

        // Hide progress bar since tests are complete
        this.fluentUIManager.clearResults(); // Clear any existing progress display

        // Show the results summary
        await this.refreshTestExecutionHistoryFromDatabase();

        this.log(
          TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.INFO,
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

        // Log progress milestone if it's a significant update
        const percentage = this.calculatePercentage(
          historyData.total,
          this.totalTestCount
        );
        if (
          percentage >
            TEST_RUNNER_CONTROLLER_CONSTANTS.DEFAULTS.INITIAL_TEST_COUNT &&
          (this.isProgressMilestone(percentage) ||
            this.isMonitoringMilestone(percentage))
        ) {
          this.log(
            TEST_RUNNER_CONTROLLER_CONSTANTS.LOG_LEVELS.INFO,
            `Progress update: ${historyData.total}/${this.totalTestCount} tests completed (${percentage}%)`
          );
        }
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
