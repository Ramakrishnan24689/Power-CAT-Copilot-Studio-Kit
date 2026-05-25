/**
 * DataModels.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides comprehensive type definitions for agent testing framework components.
 * Defines interfaces for test configurations, responses, results, and execution metadata
 *
 * Usage:
 *   import type { AgentTestCase, AgentResponse } from './DataModels';
 *   const testCase: AgentTestCase = { id: '...', name: '...', ... };
 *   const response: AgentResponse = { message: '...', timestamp: new Date(), ... };
 */

import type { Activity } from "@microsoft/agents-activity";

/**
 * Adaptive card content structure for agent responses
 */
export interface AdaptiveCard {
  contentType: string;
  content: Record<string, unknown>;
}

/**
 * Attachment content structure for agent responses
 */
export interface Attachment {
  contentType: string;
  content?: Record<string, unknown>;
  contentUrl?: string;
  name?: string;
}

/**
 * Test run configuration and metadata
 */
export interface AgentTestRun {
  id: string;
  name: string;
  configurationId: string;
  testSetId: string;
}

/**
 * Agent configuration settings for test execution
 */
export interface AgentConfiguration {
  id: string;
  clientId: string;
  tenantId: string;
  environmentId: string;
  agentIdentifier: string;
  isAzureApplicationInsightsEnabled: boolean;
  isEnrichedWithConversationTranscripts: boolean;
  isGeneratedAnswersAnalysisEnabled: boolean;
}

/**
 * Test set definition with optional test cases collection
 */
export interface AgentTestSet {
  id: string;
  name: string;
  testCases?: AgentTestCase[];
}

/**
 * Attachment data fetched from Dataverse file column
 */
export interface TestCaseAttachmentData {
  fileName: string;
  mimeType: string;
  base64Content: string;
}

/**
 * Individual test case configuration with validation settings
 */
export interface AgentTestCase {
  id: string;
  name: string;
  testUtterance: string;
  testSetId: string;
  expectedResponse?: string;
  testTypeCode: number;
  generativeAnswerOutcomeCode?: number;
  expectedPositionOfTheResponseActivity?: number;
  expectedTopicName?: string;
  expectedTools?: string;
  cat_passthreshold?: number;
  isStartConversationEventSent?: boolean;
  externalVariablesJson?: string;
  expectedAttachmentsJson?: string;
  secondsBeforeGettingAnswer?: number;
  comparisonOperatorCode?: number;
  operationTypeCode?: number; // Adaptive Card operation type (1=Comparison, 2=AI Validation, 3=Invoke Actions)
  validationInstructions?: string;
  adaptiveCardPayload?: string;
  parentId?: string; // Multiturn conversation support
  childTests?: AgentTestCase[]; // Child test cases for multiturn conversations
  order?: number; // Child test execution order
  critical?: boolean; // Critical test failure impact on parent execution
  includeAttachment?: boolean; // Whether to include an attachment with the test utterance
  attachmentFileName?: string; // File name from Dataverse file column
  attachmentData?: TestCaseAttachmentData; // Loaded attachment data (populated at runtime)
}

/**
 * Test result metadata
 */
export interface AgentTestResult {
  id?: string;
  name: string;
  testRunId: string;
  testCaseId: string;
  testUtterance: string;
  resultCode?: number;
  testTypeCode?: number;
  comparisonOperator?: number;
  actualResponse?: string;
  expectedResponse?: string;
  executionTimestamp: Date;
  responseTime?: number;
  errorDetails?: string;
  adaptiveCards?: AdaptiveCard[];
  attachments?: Attachment[];
}

/**
 * Agent response data with content and metadata
 */
export interface AgentResponse {
  message: string;
  timestamp: Date;
  success: boolean;
  responseTime: number;
  adaptiveCards?: AdaptiveCard[];
  attachments?: Attachment[];
  error?: string;
  isMatch?: boolean; // Response comparison result
  conversationId?: string;
  suggestedActions?: SuggestedAction[]; // Suggested actions collection
  allResponses?: string; // JSON string of full responses with suggested actions & attachments
  responseIndex?: number; // Expected position of the response activity
  specificResponse?: string; // Specific response used for comparison
  startConversationActivity?: Activity; // Start conversation activity for multiturn scenarios
}

/**
 * Suggested action structure for agent responses
 */
export interface SuggestedAction {
  type: string;
  title: string;
  text: string;
  value: string | Record<string, unknown>;
}

/**
 * Test execution summary with comprehensive metrics and result breakdown
 */
export interface TestExecutionSummary {
  totalTests: number;
  successTests: number;
  failedTests: number;
  errorTests: number;
  unknownTests?: number;
  pendingTests?: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  successRate?: number;
  averageLatency?: number;

  // Detailed result code breakdown
  resultCodeBreakdown?: {
    success: number;
    failed: number;
    unknown: number;
    error: number;
    pending: number;
  };
}
