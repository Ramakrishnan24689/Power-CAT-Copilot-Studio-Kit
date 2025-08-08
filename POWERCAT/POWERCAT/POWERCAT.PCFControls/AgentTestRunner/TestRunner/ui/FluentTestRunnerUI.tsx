/**
 * FluentUI-based React components for test execution interface
 */

import React, { useMemo, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardPreview,
  Button,
  ProgressBar,
  Title3,
  Body1,
  Caption1,
  Spinner,
  makeStyles,
  shorthands,
  tokens,
  FluentProvider,
  webLightTheme,
  Badge,
  Divider,
  InfoLabel,
  MessageBar,
  MessageBarBody,
  Text,
  Tooltip,
  CounterBadge,
  Avatar,
  Field,
  Label,
} from "@fluentui/react-components";
import {
  CheckmarkCircle24Regular,
  ErrorCircle24Regular,
  Warning24Regular,
  Info24Regular,
  Clock24Regular,
  Beaker24Regular,
  Settings24Regular,
  Important24Regular,
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
    RUNNING: "Running Tests...",
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
    INITIALIZING: "Initializing...",
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
  logContent: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
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
  progressText: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorBrandForeground1,
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
  statusBadge: {
    marginLeft: tokens.spacingHorizontalS,
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
  progressStats: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: tokens.spacingVerticalS,
    background: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusSmall,
    marginBottom: tokens.spacingVerticalS,
  },
  logHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: tokens.spacingVerticalS,
  },
  avatarSection: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
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

  chartMetadata: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    justifyContent: "center",
    ...shorthands.padding("8px"),
  },
});
/**
 * Custom PlaySolid icon using Microsoft Fabric Icons font
 * F5B0 is the Unicode for PlaySolid in Fabric MDL2 Icons
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
    console.log("🔄 recentLogs useMemo triggered with logs array:", {
      logsArrayLength: logs.length,
      logsArray: logs,
      RECENT_LOGS_LIMIT:
        FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.RECENT_LOGS_LIMIT,
    });

    const recent = logs.slice(
      -FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.RECENT_LOGS_LIMIT
    );

    console.log("📋 TestRunnerUI recentLogs calculation:", {
      totalLogs: logs.length,
      recentLogsCount: recent.length,
      recentLogsSample: recent.slice(-3).map((log) => ({
        level: log.level,
        message: log.message.substring(0, 50) + "...",
      })),
    });
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
              disabled={isRunning || hasExistingResults}
              onClick={onRunTests}
            >
              {buttonText}
            </Button>
          </Tooltip>
        </div>

        <div className={styles.statusSection}>
          {hasExistingResults && (
            <Badge appearance="filled" color="success">
              <CounterBadge count={summary?.totalTests || 0} />
              Results Available
            </Badge>
          )}

          {isRunning && (
            <Badge appearance="filled" color="important">
              Running
            </Badge>
          )}
        </div>
      </Card>

      {/* Progress Section - Cleaned up */}
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
        {/* Test Results Summary - Cleaned up */}
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
        {(() => {
          console.log("🔍 UI Log Section Render Check:", {
            logsLength: logs.length,
            recentLogsLength: recentLogs.length,
            shouldShowLogs: logs.length > 0,
            logsSample: logs.slice(-2).map((log) => ({
              level: log.level,
              message: log.message.substring(0, 30) + "...",
            })),
          });
          return logs.length > 0;
        })() && (
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
 * React wrapper for the FluentUI Test Runner
 * Manages React root and provides interface for the PCF component
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

  private render(): void {
    console.log("🎨 FluentTestRunnerManager.render() called with state:", {
      isRunning: this.state.isRunning,
      hasExistingResults: this.state.hasExistingResults,
      status: this.state.status,
      logsCount: this.state.logs.length,
      lastFewLogs: this.state.logs.slice(-3).map((log) => ({
        level: log.level,
        message: log.message.substring(0, 50) + "...",
      })),
    });

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

  public setRunning(running: boolean): void {
    this.state.isRunning = running;
    this.render();
  }

  public setHasExistingResults(hasResults: boolean): void {
    this.state.hasExistingResults = hasResults;
    this.render();
  }

  public setStatus(status: string): void {
    this.state.status = status;
    this.render();
  }

  public setProgress(completed: number, total: number): void {
    this.state.progress = { completed, total };
    this.render();
  }

  public clearResults(): void {
    this.state.progress = undefined;
    this.render();
  }

  public setSummary(summary: TestExecutionSummary): void {
    this.state.summary = summary;
    this.render();
  }

  public addLog(
    level: (typeof FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS)[keyof typeof FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS],
    message: string
  ): void {
    console.log("📝 FluentTestRunnerManager.addLog() called with:", {
      level,
      message,
    });
    console.log(
      "📊 Current logs state before adding:",
      this.state.logs.length,
      "logs"
    );

    // CRITICAL FIX: Create new array instead of mutating existing one
    const newLogEntry = {
      level,
      message,
      timestamp: new Date(),
    };

    // Create a new logs array to ensure React detects the change
    const updatedLogs = [...this.state.logs, newLogEntry];

    console.log(
      "📊 Current logs state after adding:",
      updatedLogs.length,
      "logs"
    );

    // Keep only last 100 logs to prevent memory issues
    if (
      updatedLogs.length >
      FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.MAX_LOGS_LIMIT
    ) {
      this.state.logs = updatedLogs.slice(
        -FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.MAX_LOGS_LIMIT
      );
      console.log("✂️ Trimmed logs to:", this.state.logs.length);
    } else {
      this.state.logs = updatedLogs;
    }

    console.log("🔄 Calling render() after addLog");
    this.render();
  }

  // Helper methods for common log messages
  public logInfo(message: string): void {
    this.addLog(FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.INFO, message);
  }

  public logSuccess(message: string): void {
    this.addLog(FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.SUCCESS, message);
  }

  public logError(message: string): void {
    this.addLog(FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.ERROR, message);
  }

  public logWarning(message: string): void {
    this.addLog(FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.WARNING, message);
  }

  // Common status messages
  public logInitialized(): void {
    this.logSuccess("🚀 Agent Test Runner initialized and ready");
  }

  public logTestExecutionStarted(testRunName: string): void {
    this.logInfo(`🔄 Test execution started for Test Run: ${testRunName}`);
  }

  public logConfigurationLoaded(): void {
    this.logInfo("🔧 Loading agent configuration and test cases..");
  }

  public logAuthenticationStarted(): void {
    this.logInfo("🔐 Starting authentication and agent connection process..");
  }

  public logTestExecutionCompleted(): void {
    this.logSuccess("Test execution completed successfully!");
  }

  public logTestExecutionPhaseCompleted(
    completed: number,
    total: number
  ): void {
    this.logInfo(
      `🏁 Test execution phase completed: ${completed}/${total} tests processed`
    );
  }

  public logFinalResultsSummary(
    passed: number,
    failed: number,
    errors: number,
    unknown?: number,
    pending?: number
  ): void {
    // Debug logging to see what values are being passed
    console.log(
      `DEBUG: Final Results Summary - passed: ${passed}, failed: ${failed}, errors: ${errors}, unknown: ${
        unknown || 0
      }, pending: ${pending || 0}`
    );

    // Calculate total from all categories
    const totalCounted =
      passed + failed + errors + (unknown || 0) + (pending || 0);
    console.log(`DEBUG: Total counted from all categories: ${totalCounted}`);

    // Build comprehensive summary message
    const summaryParts = [`${passed} passed`, `${failed} failed`];
    if (errors > 0) summaryParts.push(`${errors} errors`);
    if (unknown && unknown > 0) summaryParts.push(`${unknown} unknown`);
    if (pending && pending > 0) summaryParts.push(`${pending} pending`);

    const summaryMessage = `📊 Final Results Summary: ${summaryParts.join(
      ", "
    )} (Total: ${totalCounted})`;

    this.logInfo(summaryMessage);
  }

  public logExecutionTime(seconds: number): void {
    const timeEmoji = String.fromCodePoint(0x23f1, 0xfe0f); // ⏱️ stopwatch emoji
    const formattedTime = this.formatExecutionTime(seconds);
    this.logInfo(`${timeEmoji} Total execution time: ${formattedTime}`);
  }

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
   * Logs complete test execution completion sequence
   * Call this when test execution finishes to log all completion messages
   */
  public logTestRunCompletion(
    summary: TestExecutionSummary,
    executionTimeSeconds?: number
  ): void {
    // Debug logging to see the actual summary object
    console.log("DEBUG: logTestRunCompletion summary object:", {
      totalTests: summary.totalTests,
      successTests: summary.successTests,
      failedTests: summary.failedTests,
      errorTests: summary.errorTests,
      unknownTests: summary.unknownTests,
      pendingTests: summary.pendingTests,
    });

    // Final results summary
    this.logFinalResultsSummary(
      summary.successTests || 0,
      summary.failedTests || 0,
      summary.errorTests || 0,
      summary.unknownTests || 0,
      summary.pendingTests || 0
    );

    // Execution time - if provided
    if (executionTimeSeconds !== undefined) {
      this.logExecutionTime(executionTimeSeconds);
    }
  }

  /**
   * Logs performance metrics and averages
   */
  public logPerformanceSummary(
    summary: TestExecutionSummary,
    executionTimeSeconds: number
  ): void {
    const totalTests = summary.totalTests || 0;
    if (totalTests > 0) {
      const avgTimePerTest = (executionTimeSeconds / totalTests).toFixed(2);
      this.logInfo(
        `📈 Performance: Average ${avgTimePerTest}s per test, ${totalTests} total tests executed`
      );
    }
  }

  public logNoResults(): void {
    this.logInfo(
      "📋 No previous test results found - ready for test execution"
    );
  }

  public logAuthenticationError(): void {
    this.logError(
      "❌ Authentication failed. Please check your credentials and try again."
    );
  }

  public logAgentConnectionError(): void {
    this.logError(
      "❌ Failed to connect to agent. Please verify your agent configuration."
    );
  }

  public setOnRunTestsCallback(callback: () => void): void {
    this.onRunTestsCallback = callback;
  }

  public destroy(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }
}
