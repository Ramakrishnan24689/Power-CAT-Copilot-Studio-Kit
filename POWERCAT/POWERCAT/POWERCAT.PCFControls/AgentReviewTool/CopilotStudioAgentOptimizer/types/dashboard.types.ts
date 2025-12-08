/**
 * Dashboard Display and Statistics Type Definitions
 * Types for UI data grids and aggregated statistics
 */

// ===== Dashboard Display Types =====

/**
 * Topic detail for pattern display
 * Matches Stage B API response schema for Topics array
 */
export interface TopicDetail {
    item: string;           // Topic name where issue was found
    variable?: string;      // Variable name (for variable-related patterns) - undefined for model patterns
    current?: string;       // Current unclear value
    suggested?: string;     // Suggested improvement
}

/**
 * Display row for patterns data grid
 */
export interface PatternDisplayRow {
    patternName: string;
    category: "Model Naming" | "Model Description" | "Input Variables" | "Output Variables" | "Architecture" | "Evaluation" | "Unknown";
    status: "Pass" | "Fail";
    severity: "High" | "Medium" | "Low";
    topicCount: number;
    description: string;
    recommendation: string;
    topics: TopicDetail[];
}

/**
 * Display row for compliance criteria data grid (criteria-based view)
 */
export interface ComplianceDisplayRow {
    id: string; // Criteria ID
    name: string; // Criteria display name
    category: "Scope" | "Safety" | "Quality" | "UX";
    status: "Pass" | "Fail";
    issueCount: number; // Number of issues for this criteria
    severity: "High" | "Medium" | "Low"; // Inherent importance/priority of this criteria
    description: string; // What this criteria checks
    issues: string[]; // Descriptions of issues (if any)
    recommendations: string[]; // Recommended actions to fix issues
}

// ===== Statistics Types =====

/**
 * Aggregate statistics across all reviewed bots
 */
export interface AggregateStats {
    totalBots: number;
    reviewedBots: number;
    reviewedPercentage: number;
    averageScore: number;
    totalIssues: number;
    patternsFound: number;
}

/**
 * Summary of a single bot review
 */
export interface BotReviewSummary {
    overallScore: number;
    totalIssues: number;
}

/**
 * Historical review data for a single bot
 */
export interface BotReviewHistory {
    botId: string;
    lastReviewedDate: string; // ISO date string
    overallScore: number; // 0-100
    totalIssues: number;
    criticalIssues: number; // High severity count
    reviewedBy: string; // User ID who performed review
}
