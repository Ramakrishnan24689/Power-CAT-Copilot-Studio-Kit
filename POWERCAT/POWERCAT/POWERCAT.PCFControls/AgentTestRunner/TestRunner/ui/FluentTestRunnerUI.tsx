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
  Button,
  ProgressBar,
  Spinner,
  makeStyles,
  tokens,
  FluentProvider,
  webLightTheme,
  Badge,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Text,
  Link,
} from "@fluentui/react-components";
import {
  CheckmarkCircle24Filled,
  ErrorCircle24Regular,
  Warning24Regular,
  Info24Regular,
} from "@fluentui/react-icons";
import { createRoot, Root } from "react-dom/client";
import type { TestExecutionSummary } from "../shared/models/DataModels";
import FluentChart from "./FluentChart";

const ReadyCheckmarkIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="48"
    height="48"
    viewBox="0 0 48 49"
    fill="none"
  >
    <path
      d="M24 4.5C35.0457 4.5 44 13.4543 44 24.5C44 35.5457 35.0457 44.5 24 44.5C12.9543 44.5 4 35.5457 4 24.5C4 13.4543 12.9543 4.5 24 4.5Z"
      fill="url(#paint0_linear_7624_2330)"
    />
    <path
      d="M32.6339 18.1161C33.122 18.6043 33.122 19.3957 32.6339 19.8839L21.6339 30.8839C21.1457 31.372 20.3543 31.372 19.8661 30.8839L15.3661 26.3839C14.878 25.8957 14.878 25.1043 15.3661 24.6161C15.8543 24.128 16.6457 24.128 17.1339 24.6161L20.75 28.2322L30.8661 18.1161C31.3543 17.628 32.1457 17.628 32.6339 18.1161Z"
      fill="url(#paint1_linear_7624_2330)"
    />
    <defs>
      <linearGradient
        id="paint0_linear_7624_2330"
        x1="5.42857"
        y1="12"
        x2="33.0334"
        y2="40.6803"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#DCDCDC" />
        <stop offset="1" stopColor="#85908F" />
      </linearGradient>
      <linearGradient
        id="paint1_linear_7624_2330"
        x1="18.375"
        y1="19.1271"
        x2="21.586"
        y2="34.2408"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="white" />
        <stop offset="1" stopColor="#E3FFD9" />
      </linearGradient>
    </defs>
  </svg>
);

const FLUENT_TEST_RUNNER_UI_CONSTANTS = {
  SERVICE_NAME: "FluentTestRunnerUI",

  LOG_LEVELS: {
    INFO: "info",
    SUCCESS: "success",
    ERROR: "error",
    WARNING: "warning",
  } as const,

  UI_LIMITS: {
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

  MESSAGES: {
    READY_STATUS: "Ready to execute tests",
    LEARN_MORE: "Learn more",
  },

  STYLE_VALUES: {
    PADDING_TEMPLATE: "0",
    BORDER_WIDTH: "1px solid",
  },

  URLS: {
    LEARN_MORE:
      "https://github.com/microsoft/Power-CAT-Copilot-Studio-Kit/blob/main/MicrosoftAuthentication.md",
  },
} as const;

interface UILogEntry {
  level: (typeof FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS)[keyof typeof FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS];
  message: string;
  timestamp: Date;
}

const useStyles = makeStyles({
  container: {
    padding: tokens.spacingVerticalS,
    width: "100%",
    maxWidth: "100%",
    margin: "0",
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    boxSizing: "border-box",
    minHeight: "100%",
  },
  controlsCard: {
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: tokens.spacingVerticalS,
    gap: tokens.spacingHorizontalM,
    border: "none",
    boxShadow: tokens.shadow4,
    width: "100%",
    boxSizing: "border-box",
  },
  fabricIcon: {
    fontFamily: "'Segoe MDL2 Assets', 'FabricMDL2Icons'",
    fontSize: "16px",
    color: "white",
    display: "inline-block",
    fontWeight: "normal",
  },

  logCard: {
    padding: tokens.spacingVerticalS,
    flex: "1 1 auto",
    minHeight: "200px",
    overflow: "hidden",
    background: tokens.colorNeutralBackground1,
    border: "none",
    boxShadow: tokens.shadow4,
    width: "100%",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
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
  logMessage: {
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground1,
  },
  progressSection: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalM,
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
    gap: tokens.spacingVerticalS,
  },

  infoSection: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalS,
    background: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  buttonSection: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
  },
  chartContainer: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  headerStatusSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: tokens.spacingVerticalS,
    minWidth: "300px",
  },
  readySection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalXXL,
    textAlign: "center",
  },
  readyIcon: {
    color: tokens.colorPaletteGreenBackground3,
    fontSize: "48px",
    marginBottom: tokens.spacingVerticalS,
  },
  readyToBeginContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "24px",
    paddingBottom: "111px",
    textAlign: "center",
    minHeight: "80vh",
    height: "100%",
  },
  readyIconLarge: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  readyContentSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    textAlign: "center",
  },
  readyTitle: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase500,
    color: tokens.colorNeutralForeground1,
    margin: "0",
  },
  readyDescription: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground2,
    textAlign: "center",
    margin: "0",
    whiteSpace: "pre-line",
  },
  readyLink: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorBrandForeground1,
    textDecoration: "none",
  },
  runTestsButton: {
    backgroundColor: "#0f6cbd",
    color: tokens.colorNeutralForegroundOnBrand,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    border: "none",
  },
  inProgressMessageBar: {
    marginBottom: tokens.spacingVerticalM,
  },
  successMessageBar: {
    marginBottom: tokens.spacingVerticalM,
  },
  progressCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow:
      "0px 2px 4px 0px rgba(0,0,0,0.14), 0px 0px 2px 0px rgba(0,0,0,0.12)",
    marginBottom: tokens.spacingVerticalM,
    padding: "12px",
  },
  progressCardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    marginBottom: "6px",
  },
  progressIcon: {
    color: "#0f6cbd",
  },
  progressTitle: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground1,
    margin: "0",
  },
  progressBarWrapper: {
    marginLeft: "28px",
    marginRight: "26px",
    marginBottom: "8px",
  },
  progressBarStyle: {
    height: "2px",
    marginBottom: "3px",
    "& .fui-ProgressBar__bar": {
      backgroundColor: "#0f6cbd",
    },
    "& .fui-ProgressBar__track": {
      backgroundColor: "#e6e6e6",
    },
  },

  progressCountText: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightRegular,
    lineHeight: tokens.lineHeightBase200,
    color: tokens.colorNeutralForeground1,
    margin: "0",
  },
  summaryCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: "0px 4px 4px 0px rgba(0,0,0,0.25)",
    marginBottom: tokens.spacingVerticalM,
    overflow: "hidden",
  },
  summaryCardHeader: {
    padding: "10px",
    borderBottom: "none",
  },
  summaryCardTitle: {
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: tokens.lineHeightBase300,
    color: tokens.colorNeutralForeground1,
    margin: "0",
  },
  summaryCardBody: {
    padding: "0 10px 10px 10px",
  },
  executionLogsCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusMedium,
    boxShadow: "none",
    marginBottom: tokens.spacingVerticalM,
    overflow: "hidden",
  },
  successMessage: {
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: tokens.fontWeightMedium,
  },
  statusLabel: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalXS,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  statusLabelSuccess: {
    color: tokens.colorPaletteGreenForeground1,
  },
  statusLabelInProgress: {
    color: tokens.colorPaletteBlueForeground2,
  },
  statusMessage: {
    color: tokens.colorNeutralForeground2,
    marginBottom: tokens.spacingVerticalS,
  },
  statusLink: {
    marginBottom: tokens.spacingVerticalM,
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacingVerticalS,
  },
  progressLabel: {
    fontWeight: tokens.fontWeightSemibold,
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
  },
  cancelButton: {
    marginLeft: "auto",
  },
  thinProgressBar: {
    height: "4px",
    marginBottom: "2px",
  },
  progressText: {
    textAlign: "left",
    color: tokens.colorNeutralForeground2,
  },
  logTimestamp: {
    color: tokens.colorNeutralForeground3,
    marginLeft: "auto",
    textAlign: "right",
  },
});

/**
 * PlaySolid icon component using Microsoft Fabric Icons font.
 */
const PlaySolidIcon: React.FC = () => {
  const styles = useStyles();

  return <span className={styles.fabricIcon}>&#xF5B0;</span>;
};

interface TestRunnerUIProps {
  isRunning: boolean;
  hasExistingResults: boolean;
  status: string;
  progress?: { completed: number; total: number };
  summary?: TestExecutionSummary;
  logs: UILogEntry[];
  onRunTests: () => void;
}

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

  const statusIcon = useMemo(() => {
    if (isRunning) return <Spinner size="small" />;
    if (
      status.includes(
        FLUENT_TEST_RUNNER_UI_CONSTANTS.STATUS_ICONS.SUCCESS_INDICATOR
      )
    )
      return (
        <CheckmarkCircle24Filled color={tokens.colorPaletteGreenForeground1} />
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

  const getLogIcon = useCallback((level: string) => {
    switch (level) {
      case FLUENT_TEST_RUNNER_UI_CONSTANTS.LOG_LEVELS.SUCCESS:
        return (
          <CheckmarkCircle24Filled
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

  const buttonText = useMemo(() => {
    if (isRunning) return FLUENT_TEST_RUNNER_UI_CONSTANTS.BUTTON_TEXTS.RUNNING;
    return FLUENT_TEST_RUNNER_UI_CONSTANTS.BUTTON_TEXTS.RUN_ALL;
  }, [isRunning]);

  const recentLogs = useMemo(() => {
    const recent = logs.slice(
      -FLUENT_TEST_RUNNER_UI_CONSTANTS.UI_LIMITS.RECENT_LOGS_LIMIT
    );

    return recent;
  }, [logs]);

  return (
    <div className={styles.container}>
      {!isRunning &&
        !progress &&
        status === FLUENT_TEST_RUNNER_UI_CONSTANTS.MESSAGES.READY_STATUS && (
          <div className={styles.readyToBeginContainer}>
            <div className={styles.readyIconLarge}>
              <ReadyCheckmarkIcon />
            </div>
            <div className={styles.readyContentSection}>
              <div className={styles.readyTitle}>Ready to begin</div>
              <div className={styles.readyDescription}>
                Agent test runner initialized and ready.{"\n"}
                Click the button below to begin running the tests.{"\n"}
                <Link
                  href={FLUENT_TEST_RUNNER_UI_CONSTANTS.URLS.LEARN_MORE}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.readyLink}
                >
                  Learn more
                </Link>
              </div>
            </div>
            <Button
              appearance="primary"
              icon={<PlaySolidIcon />}
              onClick={onRunTests}
              className={styles.runTestsButton}
            >
              Run all tests
            </Button>
          </div>
        )}

      {(isRunning ||
        progress ||
        summary ||
        status !== FLUENT_TEST_RUNNER_UI_CONSTANTS.MESSAGES.READY_STATUS) && (
        <>
          {isRunning && (
            <MessageBar className={styles.inProgressMessageBar} intent="info">
              <MessageBarBody>
                <MessageBarTitle>In progress</MessageBarTitle>
                Keep this window open until the tests are finished. This may
                take a few minutes.{" "}
                <Link
                  href={FLUENT_TEST_RUNNER_UI_CONSTANTS.URLS.LEARN_MORE}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Learn more
                </Link>
              </MessageBarBody>
            </MessageBar>
          )}

          {/* Success Message Bar */}
          {!isRunning && summary && (
            <MessageBar className={styles.successMessageBar} intent="success">
              <MessageBarBody>
                <MessageBarTitle>Success</MessageBarTitle>
                All test executions completed successfully
              </MessageBarBody>
            </MessageBar>
          )}

          {/* Progress Card - Show when tests are running */}
          {isRunning && progress && (
            <Card className={styles.progressCard}>
              <div className={styles.progressCardHeader}>
                <Spinner size="extra-small" className={styles.progressIcon} />
                <Text className={styles.progressTitle}>Running tests</Text>
              </div>
              <div className={styles.progressBarWrapper}>
                <ProgressBar
                  value={progressPercentage / 100}
                  className={styles.progressBarStyle}
                />
                <Text className={styles.progressCountText}>
                  {progress.completed}/{progress.total} tests complete
                </Text>
              </div>
            </Card>
          )}

          {/* Test execution summary */}
          {summary && (
            <Card className={styles.summaryCard}>
              <CardHeader
                header={
                  <Text className={styles.summaryCardTitle}>
                    Test Execution Summary
                  </Text>
                }
              />
              <div className={styles.summaryCardBody}>
                <div className={styles.chartContainer}>
                  <FluentChart summary={summary} />
                </div>
              </div>
            </Card>
          )}

          {/* Execution Logs */}
          {logs.length > 0 && (
            <Card className={styles.executionLogsCard}>
              <CardHeader
                header={
                  <Text weight="semibold" size={400}>
                    Execution Logs
                  </Text>
                }
              />
              <div
                style={{
                  flex: "1 1 auto",
                  overflow: "auto",
                  minHeight: "0",
                  padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
                  gap: "0",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {recentLogs.map((log, index) => (
                  <div
                    key={index}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: tokens.spacingHorizontalXS,
                      padding: `${tokens.spacingVerticalXXS} 0`,
                      minHeight: "28px",
                    }}
                  >
                    <Badge
                      appearance="tint"
                      color={
                        log.level === "error"
                          ? "danger"
                          : log.level === "warning"
                          ? "warning"
                          : log.level === "success"
                          ? "success"
                          : "brand"
                      }
                      style={{
                        minWidth: "fit-content",
                        height: "16px",
                        fontSize: "10px",
                      }}
                    >
                      {log.level}
                    </Badge>
                    <Text
                      style={{
                        flex: "1",
                        paddingLeft: tokens.spacingHorizontalXXS,
                        fontSize: "14px",
                        lineHeight: "20px",
                      }}
                    >
                      {log.message}
                    </Text>
                    <Text
                      size={200}
                      style={{
                        minWidth: "fit-content",
                        fontSize: "12px",
                        color: tokens.colorNeutralForeground3,
                        paddingLeft: tokens.spacingHorizontalXS,
                      }}
                    >
                      {log.timestamp.toLocaleTimeString()}
                    </Text>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
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
