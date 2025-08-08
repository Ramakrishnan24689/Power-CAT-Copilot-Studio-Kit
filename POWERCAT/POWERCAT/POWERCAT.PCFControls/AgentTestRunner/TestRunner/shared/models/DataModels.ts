import type { Activity } from "@microsoft/agents-activity";

// Common types for agent responses
export interface AdaptiveCard {
  contentType: string;
  content: Record<string, unknown>;
}

export interface Attachment {
  contentType: string;
  content?: Record<string, unknown>;
  contentUrl?: string;
  name?: string;
}

export interface AgentTestRun {
  id: string;
  name: string;
  configurationId: string;
  testSetId: string;
}

export interface AgentConfiguration {
  id: string;
  clientId: string;
  tenantId: string;
  environmentId: string;
  botIdentifier: string;
  isAzureApplicationInsightsEnabled: boolean;
  isEnrichedWithConversationTranscripts: boolean;
  isGeneratedAnswersAnalysisEnabled: boolean;
}

export interface AgentTestSet {
  id: string;
  name: string;
  testCases?: AgentTestCase[];
}

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
  expectedTools?: string; // New field for Plan Validation test type (type 6)
  isStartConversationEventSent?: boolean;
  externalVariablesJson?: string;
  expectedAttachmentsJson?: string;
  secondsBeforeGettingAnswer?: number;
  comparisonOperatorCode?: number;
  operationTypeCode?: number; // New field for Adaptive Card operation type (1=Comparison Operator, 2=AI Validation, 3=Invoke Actions)
  validationInstructions?: string; // New field for validation instructions (used with Contains/Does not contain operations)
  adaptiveCardPayload?: string; // New field for adaptive card payload data
  parentId?: string; // For multiturn conversation support
  childTests?: AgentTestCase[]; // Child test cases for multiturn conversations
  order?: number; // For child test execution order
  critical?: boolean; // For determining if child test failure should stop parent execution (Yes/No choice field)
  cat_passthreshold?: number; // Pass threshold for test evaluation
}

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

export interface AgentResponse {
  message: string;
  timestamp: Date;
  success: boolean;
  responseTime: number;
  adaptiveCards?: AdaptiveCard[];
  attachments?: Attachment[];
  error?: string;
  isMatch?: boolean; // Added for response comparison
  conversationId?: string; // Added to track conversation ID for each test case
  suggestedActions?: SuggestedAction[]; // Added for suggested actions
  allResponses?: string; // JSON string of full responses (with suggested actions & attachments)
  responseIndex?: number; // Expected position of the response activity
  specificResponse?: string; // The specific response used for comparison
  startConversationActivity?: Activity; // Start conversation activity for multiturn scenarios
}

// Define interface for suggested actions
export interface SuggestedAction {
  type: string;
  title: string;
  text: string;
  value: string | Record<string, unknown>;
}

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
  successRate?: number; // Success rate percentage
  averageLatency?: number; // Average latency in milliseconds

  // Detailed result code breakdown
  resultCodeBreakdown?: {
    success: number; // Code 1
    failed: number; // Code 2
    unknown: number; // Code 3
    error: number; // Code 4
    pending: number; // Code 5
  };
}
