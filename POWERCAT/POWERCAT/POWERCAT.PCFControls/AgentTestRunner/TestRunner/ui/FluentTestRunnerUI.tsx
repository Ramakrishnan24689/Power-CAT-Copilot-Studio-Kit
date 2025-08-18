/**
 * FluentTestRunnerUI.tsx
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides FluentUI-based React components for test execution interface.
 * Handles test runner UI components, progress monitoring, logging, and user interactions.
 * Integrates with test execution services to provide comprehensive testing experience.
 *
 * Exports:
 *   - FluentTestRunnerManager: Primary UI management class for test execution interface.
 *   - TestRunnerUI: React component for test runner user interface.
 *
 * Usage:
 *   const uiManager = new FluentTestRunnerManager(containerElement);
 *   uiManager.setStatus("Ready for test execution");
 */

import React, { useMemo, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardPreview,
  Button,
  ProgressBar,
  Title3,
  Spinner,
  makeStyles,
  tokens,
  FluentProvider,
  webLightTheme,
  Badge,
  Divider,
  MessageBar,
  MessageBarBody,
  Text,
  Tooltip,
  CounterBadge, // Keep for commented out Results Available badge
} from "@fluentui/react-components";
import {
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  Warning24Regular,
  Info24Regular,
} from "@fluentui/react-icons";
import { createRoot, Root } from "react-dom/client";
import type { TestExecutionSummary } from "../shared/models/DataModels";
import FluentChart from "./FluentChart";

// Constants for FluentUI TestRunner components
const FLUENT_TEST_RUNNER_UI_CONSTANTS = {
  SERVICE_NAME: "FluentTestRunnerUI",

  LOG_LEVELS: {
    INFO: "info",
    SUCCESS: "success",
    ERROR: "error",
    WARNING: "warning",
  } as const,

  UI_LIMITS: {
    MAX_CONTAINER_WIDTH: "1200px",
    MAX_LOG_HEIGHT: "400px",
    MAX_LOG_SCROLL_HEIGHT: "300px",
    RECENT_LOGS_LIMIT: 50,
    MAX_LOGS_LIMIT: 100,
  },

  LAYOUT_VALUES: {
    CONTAINER_MARGIN: "0 auto",
    FLEX_ITEM: 1,
    INITIAL_PROGRESS: 0,
    PERCENTAGE_CONVERSION: 100,
  },

  STATUS_ICONS: {
    SUCCESS_INDICATOR: "✅",
    ERROR_INDICATOR: "❌",
    WARNING_INDICATOR: "⚠️",
  },

  BUTTON_TEXTS: {
    RUNNING: "Running Tests",
    RUN_ALL: "Run All Tests",
  },

  TITLES: {
    MAIN_TITLE: "PowerCAT Test Runner",
    STATUS_TITLE: "Current Status",
    PROGRESS_TITLE: "Progress",
    SUMMARY_TITLE: "Test Execution Summary",
    LOG_TITLE: "Execution Logs",
  },

  MESSAGES: {
    READY_STATUS: "Ready to execute tests",
    INITIALIZING: "Initializing",
    MEMORY_WARNING: "Keep only last 100 logs to prevent memory issues",
    EXECUTION_IN_PROGRESS: "Progress",
    TEST_RUN_IN_PROGRESS: "Test Run is in progress",
  },

  STYLE_VALUES: {
    PADDING_TEMPLATE: "0",
    BORDER_WIDTH: "1px solid",
  },
} as const;

/**
 * UI-specific log entry interface for display purposes
 */
interface UILogEntry {
  level: (typeof FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS)[keyof typeof FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS];
  message: string;
  timestamp: Date;
}

/**
 * Styles for the TestRunner UI components
 * Uses FluentUI design tokens for consistent theming
 */
const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalXL,
    maxWidth: FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.MAX_CONTAINER_WIDTH,
    margin: FLUENT_TEST_RUNNER_UI_CONSTANTS.LAYOUT_VALUES.CONTAINER_MARGIN,
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  controlsCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacingVerticalL,
    gap: tokens.spacingHorizontalL,
    border: "none",
    boxShadow: tokens.shadow4,
  },
  fabricIcon: {
    fontFamily: "'Segoe MDL2 Assets', 'FabricMDL2Icons'",
    fontSize: "16px",
    color: "white",
    display: "inline-block",
    fontWeight: "normal",
  },
  progressCard: {
    padding: tokens.spacingVerticalL,
    background: `linear-gradient(135deg, ${tokens.colorNeutralBackground1} 0%, ${tokens.colorNeutralBackground2} 100%)`,
    border: "none",
    boxShadow: tokens.shadow4,
  },
  logCard: {
    padding: tokens.spacingVerticalL,
    maxHeight: FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.MAX_LOG_HEIGHT,
    overflow: "auto",
    background: tokens.colorNeutralBackground1,
    border: "none",
    boxShadow: tokens.shadow4,
  },
  logEntry: {
    padding: `${tokens.spacingVerticalXS} ${FLUENT_TEST_RUNNER_UI_CONSTANTS.STYLE_VALUES.PADDING_TEMPLATE}`,
    borderBottom: `${FLUENT_TEST_RUNNER_UI_CONSTANTS.STYLE_VALUES.BORDER_WIDTH} ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    minHeight: "32px",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2,
    },
  },
  logTimestamp: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightRegular,
    fontFamily: tokens.fontFamilyMonospace,
    minWidth: "80px",
    flexShrink: 0,
  },
  logMessage: {
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground1,
  },
  progressSection: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
  },
  progressBarWrapper: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
  customProgressBar: {
    height: "12px",
    borderRadius: "6px",
  },
  statusSection: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
  },
  summaryCards: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalL,
  },
  summaryCard: {
    border: "none",
    boxShadow: tokens.shadow4,
  },
  infoSection: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  progressTextCenter: {
    textAlign: "center",
    padding: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
  },
  buttonSection: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  chartContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
});

/**
 * PlaySolid icon component using Microsoft Fabric Icons font.
 */
const PlaySolidIcon: React.FC = () => {
  const styles = useStyles();

  return <span className={styles.fabricIcon}>&#xF5B0;</span>;
};

/**
 * Props interface for the main TestRunner UI component
 */
interface TestRunnerUIProps {
  /** Whether tests are currently executing */
  isRunning: boolean;
  /** Whether existing test results are available */
  hasExistingResults: boolean;
  /** Current status message */
  status: string;
  /** Progress information for active test execution */
  progress?: { completed: number; total: number };
  /** Test execution summary data */
  summary?: TestExecutionSummary;
  /** Log entries for execution tracking */
  logs: UILogEntry[];
  /** Callback function to execute tests */
  onRunTests: () => void;
}

/**
 * Main TestRunner UI Component
 * Provides a comprehensive interface for test execution and monitoring
 */
/**
 * Main TestRunner UI component with comprehensive test execution interface.
 * @param props - Component props including execution state and callbacks.
 */
const TestRunnerUI: React.FC<TestRunnerUIProps> = ({
  isRunning,
  hasExistingResults,
  status,
  progress,
  summary,
  logs,
  onRunTests,
}) => {
  const styles = useStyles();

  /**
   * Memoized status icon based on current status
   */
  const statusIcon = useMemo(() => {
    if (isRunning) return <Spinner size="small" />;
    if (
      status.includes(
        FLUENT_TEST_RUNNER_UI_CONSTANTS.STATUS_ICONS.SUCCESS_INDICATOR
      )
    )
      return (
        <CheckmarkCircle24Regular color={tokens.colorPaletteGreenForeground1} />
      );
    if (
      status.includes(
        FLUENT_TEST_RUNNER_UI_CONSTANTS.STATUS_ICONS.ERROR_INDICATOR
      )
    )
      return <ErrorCircle24Regular color={tokens.colorPaletteRedForeground1} />;
    if (
      status.includes(
        FLUENT_TEST_RUNNER_UI_CONSTANTS.STATUS_ICONS.WARNING_INDICATOR
      )
    )
      return <Warning24Regular color={tokens.colorPaletteYellowForeground1} />;
    return <Info24Regular color={tokens.colorBrandForeground1} />;
  }, [isRunning, status]);

  /**
   * Callback to get log level icon
   */
  const getLogIcon = useCallback((level: string) => {
    switch (level) {
      case FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.SUCCESS:
        return (
          <CheckmarkCircle24Regular
            color={tokens.colorPaletteGreenForeground1}
          />
        );
      case FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.ERROR:
        return (
          <ErrorCircle24Regular color={tokens.colorPaletteRedForeground1} />
        );
      case FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.WARNING:
        return (
          <Warning24Regular color={tokens.colorPaletteYellowForeground1} />
        );
      default:
        return <Info24Regular color={tokens.colorBrandForeground1} />;
    }
  }, []);

  /**
   * Memoized progress percentage calculation
   */
  const progressPercentage = useMemo(() => {
    if (
      !progress ||
      progress.total ===
        FLUENT_TEST_RUNNER_UI_CONSTANTS.LAYOUT_VALUES.INITIAL_PROGRESS
    )
      return FLUENT_TEST_RUNNER_UI_CONSTANTS.LAYOUT_VALUES.INITIAL_PROGRESS;
    return (
      (progress.completed / progress.total) *
      FLUENT_TEST_RUNNER_UI_CONSTANTS.LAYOUT_VALUES.PERCENTAGE_CONVERSION
    );
  }, [progress]);

  /**
   * Memoized button text based on execution state
   */
  const buttonText = useMemo(() => {
    if (isRunning) return FLUENT_TEST_RUNNER_UI_CONSTANTS.BUTTON_TEXTS.RUNNING;
    return FLUENT_TEST_RUNNER_UI_CONSTANTS.BUTTON_TEXTS.RUN_ALL;
  }, [isRunning]);

  /**
   * Memoized recent logs for performance
   */
  const recentLogs = useMemo(() => {
    const recent = logs.slice(
      -FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.RECENT_LOGS_LIMIT
    );

    return recent;
  }, [logs]);

  return (
    <div className={styles.container}>
      {/* Header Section - Button left, Status right */}
      <Card className={styles.controlsCard}>
        <div className={styles.buttonSection}>
          <Tooltip
            content="Execute all configured test cases"
            relationship="label"
          >
            <Button
              appearance="primary"
              icon={<PlaySolidIcon />}
              size="large"
              disabled={isRunning /* || hasExistingResults */} // Temporarily allow re-runs
              onClick={onRunTests}
            >
              {buttonText}
            </Button>
          </Tooltip>
        </div>

        <div className={styles.statusSection}>
          {/* Temporarily commented out Results Available badge
          {hasExistingResults && (
            <Badge appearance="filled" color="success">
              <CounterBadge count={summary?.totalTests || 0} />
              Results Available
            </Badge>
          )}
          */}

          {isRunning && (
            <Badge appearance="filled" color="important">
              Running
            </Badge>
          )}
        </div>
      </Card>

      {(progress ||
        isRunning ||
        status !== FLUENT_TEST_RUNNER_UI_CONSTANTS.MESSAGES.READY_STATUS) && (
        <Card className={styles.progressCard}>
          <CardHeader
            header={
              <Text weight="bold" size={500}>
                {FLUENT_TEST_RUNNER_UI_CONSTANTS.TITLES.STATUS_TITLE}
              </Text>
            }
          />
          <div className={styles.progressSection}>
            {/* Status */}
            <MessageBar
              intent={
                status.includes("✅")
                  ? "success"
                  : status.includes("❌")
                  ? "error"
                  : status.includes("⚠️")
                  ? "warning"
                  : "info"
              }
            >
              <MessageBarBody>
                <div className={styles.statusSection}>
                  <Text>
                    {isRunning && progress
                      ? FLUENT_TEST_RUNNER_UI_CONSTANTS.MESSAGES
                          .TEST_RUN_IN_PROGRESS
                      : status}
                  </Text>
                </div>
              </MessageBarBody>
            </MessageBar>

            {progress && (
              <>
                <Divider />
                <div className={styles.progressBarWrapper}>
                  <Text size={300} weight="semibold">
                    {
                      FLUENT_TEST_RUNNER_UI_CONSTANTS.MESSAGES
                        .EXECUTION_IN_PROGRESS
                    }
                  </Text>
                  <ProgressBar
                    className={styles.customProgressBar}
                    value={
                      progressPercentage /
                      FLUENT_TEST_RUNNER_UI_CONSTANTS.LAYOUT_VALUES
                        .PERCENTAGE_CONVERSION
                    }
                    thickness="large"
                  />
                  <div className={styles.progressTextCenter}>
                    <Text size={300}>
                      {progress.completed} / {progress.total} tests completed
                    </Text>
                  </div>
                </div>
              </>
            )}
            {isRunning && !progress && (
              <div className={styles.infoSection}>
                <Spinner size="small" />
                <Text>
                  {FLUENT_TEST_RUNNER_UI_CONSTANTS.MESSAGES.INITIALIZING}
                </Text>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className={styles.summaryCards}>
        {summary && (
          <Card className={styles.summaryCard}>
            <CardHeader
              header={
                <Title3>
                  {FLUENT_TEST_RUNNER_UI_CONSTANTS.TITLES.SUMMARY_TITLE}
                </Title3>
              }
            />
            <CardPreview>
              <div className={styles.chartContainer}>
                <FluentChart summary={summary} />
              </div>
            </CardPreview>
          </Card>
        )}

        {/* Execution Log - Single line format */}
        {logs.length > 0 && (
          <Card className={`${styles.logCard} ${styles.summaryCard}`}>
            <CardHeader
              header={
                <Title3>
                  {FLUENT_TEST_RUNNER_UI_CONSTANTS.TITLES.LOG_TITLE}
                </Title3>
              }
            />

            <div
              style={{
                maxHeight:
                  FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS
                    .MAX_LOG_SCROLL_HEIGHT,
                overflow: "auto",
              }}
            >
              {recentLogs.map((log, index) => (
                <div key={index} className={styles.logEntry}>
                  <Text size={200} className={styles.logTimestamp}>
                    {log.timestamp.toLocaleTimeString()}
                  </Text>
                  <Badge
                    appearance="tint"
                    color={
                      log.level === "error"
                        ? "danger"
                        : log.level === "warning"
                        ? "warning"
                        : "brand"
                    }
                  >
                    {log.level}
                  </Badge>
                  <Text className={styles.logMessage}>{log.message}</Text>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default TestRunnerUI;

/**
 * FluentTestRunnerManager
 *
 * React wrapper for the FluentUI Test Runner interface.
 * Manages React root, provides interface for PCF component integration,
 * and handles comprehensive logging and state management for test execution.
 */
export class FluentTestRunnerManager {
  private root: Root | null = null;
  private container: HTMLElement;
  private state: {
    isRunning: boolean;
    hasExistingResults: boolean;
    status: string;
    progress?: { completed: number; total: number };
    summary?: TestExecutionSummary;
    logs: UILogEntry[];
  };
  private onRunTestsCallback?: () => void;

  /**
   * Creates a new FluentTestRunnerManager instance.
   * @param container - HTML element to render the React components into.
   */
  constructor(container: HTMLElement) {
    this.container = container;
    this.state = {
      isRunning: false,
      hasExistingResults: false,
      status: FLUENT_TEST_RUNNER_UI_CONSTANTS.MESSAGES.READY_STATUS,
      logs: [],
    };
    this.root = createRoot(container);
    this.render();

    // Add only initial ready log - other logs will be added during actual execution
    this.logInitialized();
  }

  /**
   * Renders the React components into the container with current state.
   * Creates FluentUI-wrapped TestRunnerUI component with current state data and callback handlers.
   * @private
   */
  private render(): void {
    if (this.root) {
      this.root.render(
        <FluentProvider theme={webLightTheme}>
          <TestRunnerUI
            {...this.state}
            onRunTests={() => this.onRunTestsCallback?.()}
          />
        </FluentProvider>
      );
    }
  }

  /**
   * Updates the test execution running state and triggers UI re-render.
   * Controls the visual state of running tests including button states and loading indicators.
   * @param running - Whether tests are currently executing.
   */
  public setRunning(running: boolean): void {
    this.state.isRunning = running;
    this.render();
  }

  /**
   * Updates the existing test results state and triggers UI re-render.
   * Controls visibility of result badges and button availability based on existing data.
   * @param hasResults - Whether existing test results are available for display.
   */
  public setHasExistingResults(hasResults: boolean): void {
    this.state.hasExistingResults = hasResults;
    this.render();
  }

  /**
   * Updates the status display text and triggers UI re-render.
   * Status message appears in the main progress card with appropriate styling based on content.
   * @param status - Current status message to display to users.
   */
  public setStatus(status: string): void {
    this.state.status = status;
    this.render();
  }

  /**
   * Updates test execution progress display with completion tracking.
   * Shows progress bar with percentage calculation and count display.
   * @param completed - Number of completed tests for progress calculation.
   * @param total - Total number of tests to be executed.
   */
  public setProgress(completed: number, total: number): void {
    this.state.progress = { completed, total };
    this.render();
  }

  /**
   * Clears progress and result displays by removing progress state.
   * Used to reset the UI when tests complete or when clearing previous execution data.
   */
  public clearResults(): void {
    this.state.progress = undefined;
    this.render();
  }

  /**
   * Updates test execution summary display with comprehensive result data.
   * Displays summary chart with test outcome breakdown and statistics.
   * @param summary - Test execution summary data including counts, rates, and timing information.
   */
  public setSummary(summary: TestExecutionSummary): void {
    this.state.summary = summary;
    this.render();
  }

  /**
   * Adds a timestamped log entry to the execution log display with automatic memory management.
   * Creates immutable log arrays for React change detection and limits total logs to prevent memory issues.
   * @param level - Log level for styling and categorization (info, success, error, warning).
   * @param message - Log message content to display to users.
   */
  public addLog(
    level: (typeof FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS)[keyof typeof FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS],
    message: string
  ): void {
    // Create new array instead of mutating existing one
    const newLogEntry = {
      level,
      message,
      timestamp: new Date(),
    };

    // Create a new logs array to ensure React detects the change
    const updatedLogs = [...this.state.logs, newLogEntry];

    // Keep only last 100 logs to prevent memory issues
    if (
      updatedLogs.length >
      FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.MAX_LOGS_LIMIT
    ) {
      this.state.logs = updatedLogs.slice(
        -FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.MAX_LOGS_LIMIT
      );
    } else {
      this.state.logs = updatedLogs;
    }

    this.render();
  }

  // Helper methods for common log messages with specific styling

  /**
   * Logs an informational message with info-level styling.
   * @param message - Information message to display in the execution log.
   */
  public logInfo(message: string): void {
    this.addLog(FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.INFO, message);
  }

  /**
   * Logs a success message with success-level styling and green visual indicators.
   * @param message - Success message to display in the execution log.
   */
  public logSuccess(message: string): void {
    this.addLog(FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.SUCCESS, message);
  }

  /**
   * Logs an error message with error-level styling and red visual indicators.
   * @param message - Error message to display in the execution log.
   */
  public logError(message: string): void {
    this.addLog(FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.ERROR, message);
  }

  /**
   * Logs a warning message with warning-level styling and yellow visual indicators.
   * @param message - Warning message to display in the execution log.
   */
  public logWarning(message: string): void {
    this.addLog(FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.WARNING, message);
  }

  // Common status messages for test execution lifecycle

  /**
   * Logs the initial setup completion message when the Test Runner is ready for operation.
   * Called once during component initialization to indicate successful setup.
   */
  public logInitialized(): void {
    this.logSuccess("🚀 Agent Test Runner initialized and ready");
  }

  /**
   * Logs the test execution start message with test run identification.
   * Provides users with confirmation that test execution has begun for a specific test run.
   * @param testRunName - Name or identifier of the test run being executed.
   */
  public logTestExecutionStarted(testRunName: string): void {
    this.logInfo(`🔄 Test execution started for Test Run: ${testRunName}`);
  }

  /**
   * Logs the configuration loading status during test execution initialization.
   * Indicates that agent configuration and test cases are being loaded from Dataverse.
   */
  public logConfigurationLoaded(): void {
    this.logInfo("🔧 Loading agent configuration and test cases");
  }

  /**
   * Logs the authentication process start during test execution setup.
   * Indicates that credential validation and agent connection process has begun.
   */
  public logAuthenticationStarted(): void {
    this.logInfo("🔐 Starting authentication and agent connection process");
  }

  /**
   * Logs formatted execution time with appropriate time units based on duration.
   * Automatically formats seconds into readable format (seconds, minutes, hours).
   * @param seconds - Total execution time in seconds to format and display.
   */
  public logExecutionTime(seconds: number): void {
    const timeEmoji = String.fromCodePoint(0x23f1, 0xfe0f); // ⏱️ stopwatch emoji
    const formattedTime = this.formatExecutionTime(seconds);
    this.logInfo(`${timeEmoji} Total execution time: ${formattedTime}`);
  }

  /**
   * Formats execution time duration into human-readable string with appropriate units.
   * Converts seconds to appropriate time format based on duration length.
   * @param seconds - Duration in seconds to format.
   * @returns Formatted time string (e.g., "45.2 seconds", "2m 30s", "1h 5m 20s").
   * @private
   */
  private formatExecutionTime(seconds: number): string {
    if (seconds < 60) {
      return `${seconds.toFixed(1)} seconds`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes}m ${remainingSeconds}s`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${hours}h ${minutes}m ${remainingSeconds}s`;
    }
  }

  /**
   * Logs comprehensive test execution completion sequence with detailed result breakdown.
   * Provides final summary statistics and optional execution timing information.
   * Calculates and displays complete test outcome distribution for user review.
   * @param summary - Test execution summary containing all test outcome counts and metadata.
   * @param executionTimeSeconds - Optional total execution time in seconds for performance display.
   */
  public logTestRunCompletion(
    summary: TestExecutionSummary,
    executionTimeSeconds?: number
  ): void {
    // Final results summary
    const passed = summary.successTests || 0;
    const failed = summary.failedTests || 0;
    const errors = summary.errorTests || 0;
    const unknown = summary.unknownTests || 0;
    const pending = summary.pendingTests || 0;

    // Calculate total from all categories
    const totalCounted = passed + failed + errors + unknown + pending;

    // Build comprehensive summary message
    const summaryParts = [`${passed} passed`, `${failed} failed`];
    if (errors > 0) summaryParts.push(`${errors} errors`);
    if (unknown > 0) summaryParts.push(`${unknown} unknown`);
    if (pending > 0) summaryParts.push(`${pending} pending`);

    const summaryMessage = `📊 Final Results Summary: ${summaryParts.join(
      ", "
    )} (Total: ${totalCounted})`;

    this.logInfo(summaryMessage);

    // Execution time - if provided
    if (executionTimeSeconds !== undefined) {
      this.logExecutionTime(executionTimeSeconds);
    }
  }

  /**
   * Logs agent connection failure error with user guidance for resolution.
   * Provides specific error message for agent connectivity issues and configuration verification steps.
   */
  public logAgentConnectionError(): void {
    this.logError(
      "❌ Failed to connect to agent. Please verify your agent configuration."
    );
  }

  /**
   * Sets the callback function for test execution button clicks.
   * Establishes the link between UI button interactions and test execution logic.
   * @param callback - Function to execute when Run Tests button is clicked by user.
   */
  public setOnRunTestsCallback(callback: () => void): void {
    this.onRunTestsCallback = callback;
  }

  /**
   * Cleans up React root and removes all event listeners for proper component disposal.
   * Ensures proper cleanup when the component is destroyed to prevent memory leaks.
   */
  public destroy(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
