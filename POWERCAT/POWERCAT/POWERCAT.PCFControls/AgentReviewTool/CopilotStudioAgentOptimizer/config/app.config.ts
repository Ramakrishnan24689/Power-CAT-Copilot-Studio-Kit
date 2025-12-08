/**
 * Application Configuration
 * Centralized application-wide constants and thresholds
 */

/**
 * Local storage keys
 */
export const StorageKeys = {
    /** First Run Experience tracking key */
    FirstRunExperience: 'copilot_agent_optimizer_fre',
} as const;

/**
 * Component parsing thresholds
 */
export const ComponentThresholds = {
    /** Number of bot components to use local parsing vs API call */
    LocalParsingThreshold: 10,
} as const;

/**
 * Score thresholds and ranges
 */
export const ScoreThresholds = {
    /** Minimum score value */
    MinScore: 0,
    /** Maximum score value */
    MaxScore: 100,
    /** Excellent score threshold */
    ExcellentThreshold: 90,
    /** Good score threshold */
    GoodThreshold: 75,
    /** Fair score threshold */
    FairThreshold: 60,
    /** Poor score threshold (below this is failing) */
    PoorThreshold: 60,
} as const;

/**
 * Severity levels for SARIF findings
 */
export const SeverityLevels = {
    None: 'none',
    Note: 'note',
    Warning: 'warning',
    Error: 'error',
} as const;

/**
 * SARIF reporting constants
 */
export const SarifConfig = {
    /** SARIF schema version */
    SchemaVersion: '2.1.0',
    /** SARIF schema URI */
    SchemaUri: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
    /** Tool name */
    ToolName: 'Copilot Studio Agent Optimizer',
    /** Tool version */
    ToolVersion: '1.0.0',
} as const;

/**
 * UI display constants
 */
export const UIConstants = {
    /** Default dialog width */
    DefaultDialogWidth: '90%',
    /** Default dialog max width */
    DefaultDialogMaxWidth: '1400px',
    /** Default grid page size */
    DefaultGridPageSize: 10,
    /** Grid page size options */
    GridPageSizeOptions: [10, 25, 50, 100],
} as const;

/**
 * Date formatting constants
 */
export const DateFormats = {
    /** Short date format */
    ShortDate: 'MM/dd/yyyy',
    /** Long date format */
    LongDate: 'MMMM dd, yyyy',
    /** Date and time format */
    DateTime: 'MM/dd/yyyy HH:mm:ss',
    /** ISO 8601 format */
    ISO: 'yyyy-MM-dd\'T\'HH:mm:ss.SSSxxx',
} as const;

/**
 * Component types (from botcomponent.componenttype)
 */
export const ComponentTypes = {
    /** Topic component type */
    Topic: 1,
    /** Other component types can be added here as discovered */
} as const;
