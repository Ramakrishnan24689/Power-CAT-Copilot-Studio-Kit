/**
 * Bot Component Type Definitions
 * Types for Dataverse botcomponents table and local parsing
 */

/**
 * Bot Component Types from Microsoft Dataverse
 * Reference: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/reference/entities/botcomponent#componenttype-choicesoptions
 */
export enum ComponentType {
    Topic = 0,
    Skill = 1,
    BotVariable = 2,
    BotEntity = 3,
    Dialog = 4,
    Trigger = 5,
    LanguageUnderstanding = 6,
    LanguageGeneration = 7,
    DialogSchema = 8,
    TopicV2 = 9,
    BotTranslationsV2 = 10,
    BotEntityV2 = 11,
    BotVariableV2 = 12,
    SkillV2 = 13,
    BotFileAttachment = 14,
    CustomGPT = 15,              // Custom GPT component
    KnowledgeSource = 16,        // Knowledge source component
    ExternalTrigger = 17,
    CopilotSettings = 18,
    TestCase = 19,               // Test case component
}

/**
 * Raw bot component from Dataverse botcomponents table
 */
export interface BotComponent {
    botcomponentid: string;
    name: string;
    componenttype: ComponentType;
    /** Parent bot ID */
    parentbotid?: string;
    /** YAML representation of the component */
    data?: string;
    description?: string;
    category?: string;
    language?: number;
    createdon?: string;
    modifiedon?: string;
}

/**
 * Parsed topic/component data from YAML
 */
export interface ParsedTopic {
    TopicName: string;
    ModelName?: string;
    ModelDescription?: string;
    InputVariables?: { VariableName: string; VariableDescription?: string }[];
    OutputVariables?: { VariableName: string; VariableDescription?: string }[];
    TriggerQueries?: { item: string }[]; // Trigger phrases for the topic
    Conditions?: string[]; // Additional conditions/rules
}

/**
 * Stage A compatible output from local YAML parsing
 * Used as default approach for all bots, with AI fallback when parsing fails
 */
export interface LocalStageAOutput {
    IsGenerativeOrchestration?: boolean;
    BotId?: string;
    BotName?: string;
    failed_components?: string[]; // Components that failed to parse
    AgentInstructions?: string;
    Components: {
        Topics: ParsedTopic[];
        Tools?: { item: string }[]; // Optional - not needed for Stage B
        KnowledgeSources?: { item: string }[]; // Optional - not needed for Stage B
        TestCases?: string[]; // Optional in schema
    };
    MissingFields?: {
        MissingModelNames: string[]; // Topic names
        MissingModelDescriptions: string[]; // Topic names
        MissingInputVariableNames: { topic: string; variable: string }[]; // Variables missing displayName
        MissingInputVariableDescriptions: { topic: string; variable: string }[]; // Variables missing description
        MissingOutputVariableNames: { topic: string; variable: string }[]; // Variables missing displayName
        MissingOutputVariableDescriptions: { topic: string; variable: string }[]; // Variables missing description
        MissingTestCases: boolean; // True if no test cases found
    };
    // NOTE: UnclearFields is NOT needed - Stage B AI analyzes Components.Topics directly
    // The Topics array contains all variable data (ModelName, ModelDescription, InputVariables, OutputVariables)
    // Stage B determines which values are unclear by analyzing the actual content
}
