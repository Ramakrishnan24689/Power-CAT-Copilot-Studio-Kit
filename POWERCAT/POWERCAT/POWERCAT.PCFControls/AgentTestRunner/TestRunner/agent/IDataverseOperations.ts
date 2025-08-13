/**
 * IDataverseOperations.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Defines the contract for Dataverse operations required by multiturn conversation components.
 * This interface ensures consistent data access patterns across different implementation layers.
 *
 * Exports:
 *   - IDataverseOperations: Interface defining required Dataverse operations for agent testing.
 *
 * Usage:
 *   Implement this interface to provide Dataverse access to multiturn conversation managers.
 *   Used by MultiturnConversationManager and related components for data persistence.
 */

import type {
  AgentTestCase,
  AgentTestRun,
  AgentTestSet,
  AgentConfiguration,
  AgentResponse,
} from "../shared/models/DataModels";

/**
 * IDataverseOperations
 *
 * Contract interface defining the required Dataverse operations for multiturn conversation testing.
 * Provides abstraction layer between business logic and data access implementations.
 *
 * This interface ensures consistent data operations across different components while allowing
 * for flexible implementation strategies (direct operations, bridge patterns, etc.).
 */
export interface IDataverseOperations {
  /**
   * Creates a test result record in Dataverse for a completed test case.
   * @param testCase - The test case that was executed.
   * @param testRunId - The ID of the test run this result belongs to.
   * @param agentResponse - The response received from the agent.
   * @param configuration - The agent configuration used for the test.
   * @param parentTestResultId - Optional parent test result ID for multiturn scenarios.
   * @returns Promise resolving to the created test result ID, or null if creation failed.
   */
  createTestResult(
    testCase: AgentTestCase,
    testRunId: string,
    agentResponse: AgentResponse,
    configuration: AgentConfiguration,
    parentTestResultId?: string
  ): Promise<string | null>;

  /**
   * Creates a placeholder test result with an associated conversation ID.
   * Used for parent test cases in multiturn scenarios before child tests are executed.
   * @param parentTestCase - The parent test case requiring a placeholder result.
   * @param testRunId - The ID of the test run.
   * @param conversationId - The conversation ID to associate with the placeholder.
   * @returns Promise resolving to the created placeholder test result ID, or null if creation failed.
   */
  createPlaceholderTestResultWithConversationId(
    parentTestCase: AgentTestCase,
    testRunId: string,
    conversationId: string
  ): Promise<string | null>;

  /**
   * Updates a parent test result with aggregated results from child test executions.
   * @param parentTestResultId - The ID of the parent test result to update.
   * @param childResults - Array of child test results with result codes and criticality flags.
   * @returns Promise resolving to true if update succeeded, false otherwise.
   */
  updateParentTestResult(
    parentTestResultId: string,
    childResults: { resultCode: number; critical: boolean }[]
  ): Promise<boolean>;

  /**
   * Retrieves the result code for a specific test result.
   * @param testResultId - The ID of the test result to query.
   * @returns Promise resolving to the result code, or null if not found.
   */
  getTestResultCode(testResultId: string): Promise<number | null>;

  /**
   * Retrieves a test set by its ID.
   * @param testSetId - The ID of the test set to retrieve.
   * @returns Promise resolving to the test set data.
   */
  getTestSet(testSetId: string): Promise<AgentTestSet>;

  /**
   * Retrieves all test cases belonging to a specific test set.
   * @param testSetId - The ID of the test set whose test cases to retrieve.
   * @returns Promise resolving to an array of test cases.
   */
  getTestCases(testSetId: string): Promise<AgentTestCase[]>;

  /**
   * Retrieves a test run by its ID.
   * @param testRunId - The ID of the test run to retrieve.
   * @returns Promise resolving to the test run data.
   */
  getTestRun(testRunId: string): Promise<AgentTestRun>;

  /**
   * Retrieves an agent configuration by its ID.
   * @param configId - The ID of the configuration to retrieve.
   * @returns Promise resolving to the agent configuration data.
   */
  getConfiguration(configId: string): Promise<AgentConfiguration>;
}
