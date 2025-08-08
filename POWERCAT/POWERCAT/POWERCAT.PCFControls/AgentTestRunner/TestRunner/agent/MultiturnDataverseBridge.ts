/**
 * Simple bridge for MultiturnConversationManager to use operations directly
 * This provides only the methods needed by multiturn operations
 */

import { AgentTestResultOperations } from "../dataverse/AgentTestResultOperations";
import { AgentTestSetOperations } from "../dataverse/AgentTestSetOperations";
import { AgentTestRunOperations } from "../dataverse/AgentTestRunOperations";
import { AgentConfigurationOperations } from "../dataverse/AgentConfigurationOperations";
import { IDataverseOperations } from "./IDataverseOperations";
import type {
  AgentTestCase,
  AgentTestRun,
  AgentTestSet,
  AgentConfiguration,
  AgentResponse,
} from "../shared/models/DataModels";

/**
 * Minimal bridge for multiturn operations
 * Provides only the methods needed by MultiturnConversationManager
 */
export class MultiturnDataverseBridge implements IDataverseOperations {
  private readonly testResultOps: AgentTestResultOperations;
  private readonly testSetOps: AgentTestSetOperations;
  private readonly testRunOps: AgentTestRunOperations;
  private readonly configOps: AgentConfigurationOperations;

  constructor(context: ComponentFramework.Context<unknown>) {
    this.testResultOps = new AgentTestResultOperations(context);
    this.testSetOps = new AgentTestSetOperations(context);
    this.testRunOps = new AgentTestRunOperations(context);
    this.configOps = new AgentConfigurationOperations(context);
  }

  // Only the methods needed by multiturn operations
  async createTestResult(
    testCase: AgentTestCase,
    testRunId: string,
    agentResponse: AgentResponse,
    configuration: AgentConfiguration,
    parentTestResultId?: string
  ): Promise<string | null> {
    return this.testResultOps.createTestResult(
      testCase,
      testRunId,
      agentResponse,
      configuration,
      parentTestResultId
    );
  }

  async createPlaceholderTestResultWithConversationId(
    parentTestCase: AgentTestCase,
    testRunId: string,
    conversationId: string
  ): Promise<string | null> {
    return this.testResultOps.createPlaceholderTestResult(
      parentTestCase,
      testRunId,
      conversationId
    );
  }

  async updateParentTestResult(
    parentTestResultId: string,
    childResults: { resultCode: number; critical: boolean }[]
  ): Promise<boolean> {
    return this.testResultOps.updateParentTestResult(
      parentTestResultId,
      childResults
    );
  }

  async getTestResultCode(testResultId: string): Promise<number | null> {
    return this.testResultOps.getTestResultCode(testResultId);
  }

  async getTestSet(testSetId: string): Promise<AgentTestSet> {
    return this.testSetOps.getTestSet(testSetId);
  }

  async getTestCases(testSetId: string): Promise<AgentTestCase[]> {
    return this.testSetOps.getTestCases(testSetId);
  }

  async getTestRun(testRunId: string): Promise<AgentTestRun> {
    return this.testRunOps.getTestRun(testRunId);
  }

  async getConfiguration(configId: string): Promise<AgentConfiguration> {
    return this.configOps.getConfiguration(configId);
  }
}
