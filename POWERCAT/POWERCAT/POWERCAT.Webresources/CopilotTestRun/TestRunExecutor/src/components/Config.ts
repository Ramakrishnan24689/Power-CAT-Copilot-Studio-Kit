/**
 * Configuration constants for the TestRunExecutor service
 */
export const CONFIG = {
  AUTH: {
    STATE_KEY: "agent_auth_state",
    POSSIBLE_CHARS:
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
    STATE_LENGTH: 32,
    CODE_VERIFIER_LENGTH: 64,
    AUTH_WINDOW_WIDTH: 600,
    AUTH_WINDOW_HEIGHT: 600,
    POLL_INTERVAL: 100,
    AUTH_TIMEOUT: 300000, // 5 minutes
    WIDTH: 600,
    HEIGHT: 600,
  },
  NOTIFICATIONS: {
    PROGRESS: {
      id: "TESTRUN_ACTION_NOTIFICATION",
      message: "Test Run execution is in progress.",
      type: "INFO" as const,
    },
    WARNING: {
      id: "TESTRUN_WARNING_NOTIFICATION",
      type: "WARNING" as const,
    },
    ERROR: {
      id: "TESTRUN_ONSAVE_NOTIFICATION",
      type: "ERROR" as const,
    },
  },
  RECORD: {
    MAX_WAIT_TIME: 7000,
    CHECK_INTERVAL: 200,
  },
  USER_AUTH_ENABLED: 2,
};
