/**
 * Dataverse Configuration
 * Centralized configuration for Dataverse table names, field names, and entity-specific constants
 */

/**
 * Dataverse table (entity) names for Web API operations
 */
export const DataverseEntities = {
    /** Bot entity table */
    Bot: 'bot',
    /** Bot component entity table */
    BotComponent: 'botcomponent',
    /** Agent reviews custom table - API endpoint name */
    AgentReviews: 'cat_agentreviews',  // Main entity for CRUD operations
    /** Agent reviews file upload endpoint - special for file operations */
    AgentReviewsFileUpload: 'cat_agentreviewses',  // File upload endpoint
    /** First Run Experience tracking custom table */
    AgentReviewFRE: 'cat_agentreviewfre',
} as const;

/**
 * Dataverse table logical names (for schema/solution references)
 */
export const DataverseLogicalNames = {
    /** Agent reviews custom table - logical name */
    AgentReviews: 'cat_agentreviews',  // Logical name used in Power Apps schema
    /** First Run Experience tracking custom table */
    AgentReviewFRE: 'cat_agentreviewfre',
} as const;

/**
 * Bot entity field names
 */
export const BotFields = {
    Id: 'botid',
    Name: 'name',
    StateCode: 'statecode',
    IconBase64: 'iconbase64',
    ComponentIdUnique: 'componentidunique',
    Configuration: 'configuration',
    SynchronizationStatus: 'synchronizationstatus',
    PublishedOn: 'publishedon',
    SchemaName: 'schemaname',
} as const;

/**
 * Bot Component entity field names
 */
export const BotComponentFields = {
    Id: 'botcomponentid',
    Name: 'name',
    ComponentType: 'componenttype',
    ParentBotId: 'parentbotid', // Direct field, not lookup (_parentbotid_value was causing errors)
    Data: 'data',
    Description: 'description',
    Category: 'category',
    Language: 'language',
    CreatedOn: 'createdon',
    ModifiedOn: 'modifiedon',
} as const;

/**
 * Agent Review entity field names (cat_agentreviewses)
 */
export const AgentReviewFields = {
    Id: 'cat_agentreviewsid',  // Actual field name from JSON response
    Name: 'cat_name',
    BotId: 'cat_botid',
    BotName: 'cat_botname',
    ComponentIdUnique: 'cat_componentidunique',
    OverallScore: 'cat_overallscore',
    PatternScore: 'cat_patternscore',
    InstructionScore: 'cat_instructionscore',
    TotalPatterns: 'cat_totalpatterns',
    PassedPatterns: 'cat_passedpatterns',
    FailedPatterns: 'cat_failedpatterns',
    TotalIssues: 'cat_totalissues',
    HighSeverityIssues: 'cat_highseverityissues',
    ReviewResultFile: 'cat_reviewresultfile', // File column for large JSON payloads
    ReviewDate: 'cat_reviewdate',
    ReviewStatus: 'cat_reviewstatus',
    // PDF fields for storing generated review reports
    ReviewPdf: 'cat_reviewpdfreport',
    ReviewPdfName: 'cat_reviewpdfreport_name',
} as const;

/**
 * First Run Experience entity field names (cat_agentreviewfre)
 */
export const FREFields = {
    Id: 'cat_agentreviewfreid',
    User: 'cat_user', // Lookup field to systemuser table
    Completed: 'cat_completed',
    CompletedOn: 'cat_completeddate',
} as const;

/**
 * Review status choice values
 */
export const ReviewStatus = {
    /** Review is completed */
    Completed: 33535000,
    /** Review is in draft state */
    Draft: 33535001,
    /** Review is archived */
    Archived: 33535002,
} as const;

/**
 * Bot state codes
 */
export const BotStateCode = {
    Active: 0,
    Inactive: 1,
} as const;

/**
 * API version path
 */
export const API_VERSION = 'v9.2';

/**
 * Base API path for Dataverse
 */
export const BASE_API_PATH = `/api/data/${API_VERSION}`;
