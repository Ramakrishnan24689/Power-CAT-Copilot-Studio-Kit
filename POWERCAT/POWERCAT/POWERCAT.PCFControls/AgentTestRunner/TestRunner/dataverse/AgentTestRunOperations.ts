/**
 * Agent Test Run Operations for Dataverse
 * Handles operations related to agent test runs
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import type {
  AgentTestRun,
  AgentConfiguration,
} from "../shared/models/DataModels";

/**
 * Service for managing agent test run operations in Dataverse
 * Handles retrieval and updates of test run data
 */
export class AgentTestRunOperations extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "AgentTestRunOperations");
  }

  /**
   * Retrieve Agent Test Run information by ID
   * @param testRunId - GUID of the test run
   * @returns Promise resolving to AgentTestRun object
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
   * @param testRunId - GUID of the test run
   * @param statusCode - New status code to set
   * @param configuration - Optional configuration for enrichment status (only used when completing test run)
   * @returns Promise resolving to boolean indicating success
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
        // 5 = Enabled, 4 = Disabled
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
