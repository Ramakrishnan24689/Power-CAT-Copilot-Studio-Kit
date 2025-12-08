/**
 * AI Service Type Definitions
 * Types for AI prompt response operations
 */

/**
 * Input for retrieving AI prompt response
 */
export interface RetrievePromptResponseInput {
    Prompt: string;
    BotId: string;
    promptSchema: string;
    MaxTokens?: number;
    Temperature?: number;
    TopP?: number;
}

/**
 * File output from AI response
 */
export interface FileOutput {
    id: string;
    url: string;
    filename: string;
    mimeType: string;
    size: number;
}

/**
 * Structured output from AI response
 */
export interface StructuredOutput {
    type: string;
    value: string;
}

/**
 * Prediction output from AI response
 */
export interface PredictionOutput {
    text: string;
    finish_reason: string;
    files?: FileOutput[];
    structured_outputs?: StructuredOutput[];
}

/**
 * V2 response format from AI service
 */
export interface ResponseV2 {
    id: string;
    predictions: PredictionOutput[];
}

/**
 * Complete AI prompt response output
 */
export interface RetrievePromptResponseOutput {
    response_v2: ResponseV2;
}
