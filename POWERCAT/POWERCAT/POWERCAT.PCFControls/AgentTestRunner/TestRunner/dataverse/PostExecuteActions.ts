/**
 * Post-Execute Actions for Dataverse
 * Handles rollup calculations and enrichment actions after test execution
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import type { AgentConfiguration } from "../shared/models/DataModels";

/**
 * Service for managing post-execute actions in Dataverse
 * Handles rollup calculations and enrichment actions after test execution
 */
export class PostExecuteActions extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "PostExecuteActions");
  }

  /**
   * Invoke rollup columns update action for a test run
   * @param testRunId - GUID of the test run
   * @returns Promise resolving to boolean indicating success
   */
  async invokeRunRollupColumnsUpdates(testRunId: string): Promise<boolean> {
    const actionRequest = {
      DataverseUriHost: this.getOrgHost(), // Use hostname only, not full URL
      CopilotTestRunId: testRunId,
    };

    const result = await this.executeDataverseAction(
      "cat_copilottestruns",
      testRunId,
      "cat_RunRollupColumnsUpdates",
      actionRequest
    );

    return result;
  }

  /**
   * Invoke conditional enrichment actions based on configuration settings
   * @param testRunId - GUID of the test run
   * @param configuration - Agent configuration with enrichment flags
   * @param testSetId - GUID of the test set
   * @returns Promise resolving when all enrichment actions complete
   */
  async invokeConditionalEnrichmentActions(
    testRunId: string,
    configuration: AgentConfiguration,
    testSetId: string
  ): Promise<void> {
    return this.executeOperation(async () => {
      // 1. Conversation Transcripts Enrichment
      if (configuration.isEnrichedWithConversationTranscripts) {
        const result1 =
          await this.invokeDataverseConversationTranscriptsEnrichment(
            testRunId,
            configuration.id,
            testSetId
          );
      }

      // 2. Azure Application Insights Enrichment
      if (configuration.isAzureApplicationInsightsEnabled) {
        const result2 = await this.invokeAzureApplicationInsightsEnrichment(
          testRunId,
          configuration.id,
          testSetId
        );
      }

      // 3. AI Builder Analysis (only when Azure Insights is disabled but Generated Answers enabled)
      if (
        !configuration.isAzureApplicationInsightsEnabled &&
        configuration.isGeneratedAnswersAnalysisEnabled
      ) {
        const result3 = await this.invokeAIBuilderAnalysis(
          testRunId,
          testSetId
        );
      }
    }, "Invoke conditional enrichment actions");
  }

  /**
   * Invoke Dataverse Conversation Transcripts Enrichment action
   * @param testRunId - GUID of the test run
   * @param configurationId - GUID of the configuration
   * @param testSetId - GUID of the test set
   * @returns Promise resolving to boolean indicating success
   */
  async invokeDataverseConversationTranscriptsEnrichment(
    testRunId: string,
    configurationId: string,
    testSetId: string
  ): Promise<boolean> {
    const actionRequest = {
      CopilotTestRunId: testRunId,
      SkipDelay: false,
      CopilotConfigurationId: configurationId,
      CopilotTestSetId: testSetId,
    };

    return this.executeDataverseAction(
      "cat_copilottestruns",
      testRunId,
      "cat_RunDataverseConversationTranscriptsEnrichment",
      actionRequest
    );
  }

  /**
   * Invoke Azure Application Insights Enrichment action
   * @param testRunId - GUID of the test run
   * @param configurationId - GUID of the configuration
   * @param testSetId - GUID of the test set
   * @returns Promise resolving to boolean indicating success
   */
  async invokeAzureApplicationInsightsEnrichment(
    testRunId: string,
    configurationId: string,
    testSetId: string
  ): Promise<boolean> {
    const actionRequest = {
      CopilotTestRunId: testRunId,
      SkipDelay: false,
      CopilotConfigurationId: configurationId,
      CopilotTestSetId: testSetId,
    };

    return this.executeDataverseAction(
      "cat_copilottestruns",
      testRunId,
      "cat_RunAzureApplicationInsightsEnrichment",
      actionRequest
    );
  }

  /**
   * Invoke AI Builder Analysis action
   * @param testRunId - GUID of the test run
   * @param testSetId - GUID of the test set
   * @returns Promise resolving to boolean indicating success
   */
  async invokeAIBuilderAnalysis(
    testRunId: string,
    testSetId: string
  ): Promise<boolean> {
    const actionRequest = {
      CopilotTestRunId: testRunId,
      CopilotTestSetId: testSetId,
    };

    return this.executeDataverseAction(
      "cat_copilottestruns",
      testRunId,
      "cat_RunAIBuilderAnalysis",
      actionRequest
    );
  }
}
