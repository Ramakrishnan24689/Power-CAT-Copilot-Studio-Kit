/**
 * Review and Evaluation Type Definitions
 * Types for pattern evaluation, compliance checking, and review results
 */

// ===== Dataverse Review Record Types =====

/**
 * Agent review record from cat_agentreviews Dataverse table
 */
export interface AgentReviewRecord {
    cat_agentreviewsid: string;
    cat_name: string;
    cat_botid: string;
    cat_botname: string;
    cat_componentidunique: string;
    cat_overallscore: number;
    cat_patternscore: number;
    cat_instructionscore: number;
    cat_totalpatterns: number;
    cat_passedpatterns: number;
    cat_failedpatterns: number;
    cat_totalissues: number;
    cat_highseverityissues: number;
    cat_reviewdate: string;
    cat_reviewstatus?: number; // 33535000 = Completed, 33535001 = Draft, 33535002 = Archived  
    cat_reviewpdfreport?: string; // Base64 PDF content
    cat_reviewpdfreport_name?: string; // PDF filename
    _ownerid_value?: string;
    _ownerid_value_formatted?: string;
    _ownerid_value_lookuplogicalname?: string;
}

/**
 * OData response wrapper for review queries
 */
export interface AgentReviewsResponse {
    '@odata.context': string;
    value: AgentReviewRecord[];
}

// ===== Stage B - Pattern Evaluation Types =====

/**
 * Single pattern evaluation result
 */
export interface Pattern {
    PatternName: string;
    PatternDescription: string;
    Status: boolean; // true = compliant, false = issue detected
    Topics: {
        item: string;           // Topic name where issue was found
        variable?: string;      // Variable name (for variable-related patterns) - undefined for model patterns
        current?: string;       // Current unclear value
        suggested?: string;     // Suggested improvement
    }[]; // List of topics that violate this pattern (Stage B full schema)
    Recommendation: string;
    severity?: "high" | "medium" | "low"; // Optional severity for certain patterns (e.g., test cases)
}

/**
 * Complete pattern evaluation from Stage B
 */
export interface PatternEvaluation {
    Patterns: Pattern[];
    debug?: {
        note?: string;
        error?: string;
    };
}

// ===== Stage C - Agent Instructions Evaluation Types =====

/**
 * Single compliance issue found in agent instructions
 */
export interface ComplianceIssue {
    id: string;
    severity: "high" | "medium" | "low";
    description: string;
    guidelineReference: string;
    recommendation: string;
}

/**
 * Complete instruction evaluation from Stage C
 */
export interface InstructionEvaluation {
    compliance: boolean;
    compliancePercentage: number; // 0-100
    issues: ComplianceIssue[];
    summary: string;
    criteriaResults?: ComplianceCriteria[]; // Individual criteria pass/fail (optional - for enhanced display)
}

/**
 * Individual compliance criteria evaluation result
 */
export interface ComplianceCriteria {
    id: string; // e.g., "scope-definition", "privacy-guidelines"
    name: string; // e.g., "Scope Definition", "Privacy Guidelines"
    category: "Scope" | "Safety" | "Quality" | "UX";
    status: boolean; // true = passed, false = failed
    issueCount: number; // Number of issues related to this criteria
    relatedIssueIds?: string[]; // IDs of issues related to this criteria
}

// ===== Combined Review Result =====

/**
 * Complete review result combining all stages
 */
export interface ReviewResult {
    botId: string;
    botName: string;
    patternEvaluation?: PatternEvaluation;
    instructionEvaluation?: InstructionEvaluation;
    overallScore: number; // 0-100, calculated from pattern + instruction compliance
    timestamp: Date;
    pdfBase64?: string; // Base64 encoded PDF from Stage D
    pdfFileName?: string; // PDF filename from Stage D
    dataverseRecordId?: string; // ID of saved record in Dataverse
    error?: string;
}

// ===== Score Calculation Input =====

/**
 * Input for score calculation utility
 */
export interface ScoreInput {
    patternEvaluation?: PatternEvaluation;
    instructionEvaluation?: InstructionEvaluation;
}
