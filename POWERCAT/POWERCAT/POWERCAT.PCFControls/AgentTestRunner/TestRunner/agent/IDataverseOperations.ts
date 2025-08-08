/**
 * Interface for Dataverse operations needed by multiturn conversation components
 */

import type {
  AgentTestCase,
  AgentTestRun,
  AgentTestSet,
  AgentConfiguration,
  AgentResponse,
} from "../shared/models/DataModels";

/**
 * Interface defining the Dataverse operations needed by multiturn components
 */
export interface IDataverseOperations {
  // Test Result Operations
  createTestResult(
    testCase: AgentTestCase,
    testRunId: string,
    agentResponse: AgentResponse,
    configuration: AgentConfiguration,
    parentTestResultId?: string
  ): Promise<string | null>;

  createPlaceholderTestResultWithConversationId(
    parentTestCase: AgentTestCase,
    testRunId: string,
    conversationId: string
  ): Promise<string | null>;

  updateParentTestResult(
    parentTestResultId: string,
    childResults: { resultCode: number; critical: boolean }[]
  ): Promise<boolean>;

  getTestResultCode(testResultId: string): Promise<number | null>;

  // Test Set Operations
  getTestSet(testSetId: string): Promise<AgentTestSet>;
  getTestCases(testSetId: string): Promise<AgentTestCase[]>;

  // Test Run Operations
  getTestRun(testRunId: string): Promise<AgentTestRun>;

  // Configuration Operations
  getConfiguration(configId: string): Promise<AgentConfiguration>;
}
