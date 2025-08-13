/**
 * AgentTestRunOperations.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides Dataverse operations for managing agent test run records and status updates.
 * Handles retrieval of test run information and status management with support for
 * enrichment configuration settings during test execution lifecycle.
 *
 * Exports:
 *   - AgentTestRunOperations: Main class for test run operations and status management.
 *
 * Usage:
 *   const testRunOps = new AgentTestRunOperations(context);
 *   const testRun = await testRunOps.getTestRun(testRunId);
 *   await testRunOps.updateTestRunStatus(testRunId, statusCode, config);
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import type {
  AgentTestRun,
  AgentConfiguration,
} from "../shared/models/DataModels";

/**
 * Service for managing agent test run operations in Dataverse
 * Handles retrieval and updates of test run data with enrichment status management
 * @class AgentTestRunOperations
 */
export class AgentTestRunOperations extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "AgentTestRunOperations");
  }

  /**
   * Retrieve Agent Test Run information by ID from Dataverse
   * @param testRunId - GUID of the test run record
   * @returns Promise resolving to AgentTestRun object with configuration and test set references
   * @throws {Error} When test run retrieval fails or record not found
   */
  async getTestRun(testRunId: string): Promise<AgentTestRun> {
    return this.executeOperation(async () => {
      const response = await this.context.webAPI.retrieveRecord(
        "cat_copilottestrun",
        testRunId,
        "?$select=cat_name,_cat_copilottestsetid_value,_cat_copilotconfigurationid_value"
      );

      return {
        id: response.cat_copilottestrunid,
        name: response.cat_name as string,
        configurationId: response._cat_copilotconfigurationid_value,
        testSetId: response._cat_copilottestsetid_value,
      };
    }, "Get test run");
  }

  /**
   * Update test run status code and optionally enrichment status codes
   * Handles status transitions and enrichment configuration when completing test runs
   * @param testRunId - GUID of the test run record to update
   * @param statusCode - New status code to set (1=Not Run, 2=Running, 3=Complete, 4=Not Available, 5=Pending, 6=Error)
   * @param configuration - Optional configuration for enrichment status (only used when completing test run)
   * @returns Promise resolving to boolean indicating success or failure
   */
  async updateTestRunStatus(
    testRunId: string,
    statusCode: number,
    configuration?: AgentConfiguration
  ): Promise<boolean> {
    const result = await this.executeOperationSafely(async () => {
      const updateData: Record<string, number> = {
        cat_runstatuscode: statusCode,
      };

      // If configuration is provided, also update enrichment status codes
      if (configuration) {
        // Set enrichment status codes based on configuration flags
        updateData.cat_appinsightsenrichmentstatuscode =
          configuration.isAzureApplicationInsightsEnabled ? 5 : 4;
        updateData.cat_generatedanswersanalysiscode =
          configuration.isGeneratedAnswersAnalysisEnabled ? 5 : 4;
        updateData.cat_dataverseenrichmentstatuscode =
          configuration.isEnrichedWithConversationTranscripts ? 5 : 4;
      }

      await this.context.webAPI.updateRecord(
        "cat_copilottestrun",
        testRunId,
        updateData
      );

      return true;
    }, "Update test run status");

    return result ?? false;
  }
}
