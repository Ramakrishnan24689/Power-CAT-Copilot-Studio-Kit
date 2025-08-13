/**
 * MultiturnDataverseBridge.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides a unified bridge pattern implementation for Dataverse operations
 * used in multiturn conversation scenarios. Abstracts access to test results,
 * test sets, test runs, and configuration data through a clean interface.
 *
 * Exports:
 *   - MultiturnDataverseBridge: Bridge implementation for IDataverseOperations interface.
 *
 * Usage:
 *   const bridge = new MultiturnDataverseBridge(context);
 *   const testResult = await bridge.createTestResult(testCase, testRunId, response, config);
 *   const parentResult = await bridge.updateParentTestResult(parentId, childResults);
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
 * Bridge pattern implementation providing unified access to Dataverse operations
 * for multiturn conversation testing scenarios
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

  /**
   * Creates a new test result record in Dataverse
   * @param testCase Test case definition
   * @param testRunId Associated test run identifier
   * @param agentResponse Agent response to record
   * @param configuration Agent configuration used
   * @param parentTestResultId Optional parent test result for multiturn scenarios
   * @returns Promise resolving to test result ID or null if creation failed
   */
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

  /**
   * Creates a placeholder test result with conversation ID for multiturn scenarios
   * @param parentTestCase Parent test case definition
   * @param testRunId Associated test run identifier
   * @param conversationId Conversation identifier for linking
   * @returns Promise resolving to test result ID or null if creation failed
   */
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

  /**
   * Updates parent test result with aggregated child results
   * @param parentTestResultId Parent test result identifier
   * @param childResults Array of child result summaries
   * @returns Promise resolving to true if update succeeded
   */
  async updateParentTestResult(
    parentTestResultId: string,
    childResults: { resultCode: number; critical: boolean }[]
  ): Promise<boolean> {
    return this.testResultOps.updateParentTestResult(
      parentTestResultId,
      childResults
    );
  }

  /**
   * Retrieves the result code for a specific test result
   * @param testResultId Test result identifier
   * @returns Promise resolving to result code or null if not found
   */
  async getTestResultCode(testResultId: string): Promise<number | null> {
    return this.testResultOps.getTestResultCode(testResultId);
  }

  /**
   * Retrieves test set configuration and metadata
   * @param testSetId Test set identifier
   * @returns Promise resolving to test set data
   */
  async getTestSet(testSetId: string): Promise<AgentTestSet> {
    return this.testSetOps.getTestSet(testSetId);
  }

  /**
   * Retrieves all test cases within a test set
   * @param testSetId Test set identifier
   * @returns Promise resolving to array of test cases
   */
  async getTestCases(testSetId: string): Promise<AgentTestCase[]> {
    return this.testSetOps.getTestCases(testSetId);
  }

  /**
   * Retrieves test run configuration and status
   * @param testRunId Test run identifier
   * @returns Promise resolving to test run data
   */
  async getTestRun(testRunId: string): Promise<AgentTestRun> {
    return this.testRunOps.getTestRun(testRunId);
  }

  /**
   * Retrieves Agent configuration settings
   * @param configId Agent Configuration Id
   * @returns Promise resolving to configuration data
   */
  async getConfiguration(configId: string): Promise<AgentConfiguration> {
    return this.configOps.getConfiguration(configId);
  }
}
