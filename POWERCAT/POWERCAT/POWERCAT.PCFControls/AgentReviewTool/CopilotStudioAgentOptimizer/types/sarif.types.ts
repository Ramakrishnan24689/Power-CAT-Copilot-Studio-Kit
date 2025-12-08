/**
 * SARIF Report Type Definitions
 * Types for Static Analysis Results Interchange Format (SARIF) reports
 */

/**
 * Complete SARIF report structure
 */
export interface SarifReport {
    version: string;
    $schema: string;
    runs: SarifRun[];
}

/**
 * Single SARIF run (contains results from one analysis)
 */
export interface SarifRun {
    tool: {
        driver: {
            name: string;
            version: string;
            informationUri: string;
            rules: SarifRule[];
        };
    };
    results: SarifResult[];
}

/**
 * SARIF rule definition
 */
export interface SarifRule {
    id: string;
    name: string;
    shortDescription: { text: string };
    fullDescription: { text: string };
    helpUri?: string;
}

/**
 * SARIF result (individual issue/finding)
 */
export interface SarifResult {
    ruleId: string;
    level: "error" | "warning" | "note";
    message: { text: string };
    locations: {
        physicalLocation: {
            artifactLocation: { uri: string };
            region?: { startLine: number; endLine: number };
        };
    }[];
}
