/**
 * PostExecuteActions.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides comprehensive service for managing post-execution actions in the Agent testing framework.
 * Orchestrates rollup calculations, enrichment processes, and analytics integration after test
 * execution completion with intelligent action sequencing and dependency management.
 *
 * Exports:
 *   - PostExecuteActions: Main class for post-execution workflow management and enrichment actions.
 *
 * Usage:
 *   const postActions = new PostExecuteActions(context);
 *   await postActions.invokeRunRollupColumnsUpdates(testRunId);
 *   await postActions.invokeConditionalEnrichmentActions(testRunId, config, testSetId);
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import type { AgentConfiguration } from "../shared/models/DataModels";

/**
 * Service for managing post-execution actions in Microsoft Dataverse
 *
 * Orchestrates comprehensive post-test execution workflows including rollup calculations,
 * enrichment processes, and analytics integration. Handles conditional execution based
 * on agent configuration settings and provides intelligent action sequencing.
 *
 * Post-Execution Workflow:
 * 1. Rollup column calculations for test run statistics
 * 2. Conditional enrichment actions based on configuration
 * 3. Conversation transcripts processing (if enabled)
 * 4. Azure Application Insights integration (if configured)
 * 5. AI Builder analysis for advanced result processing
 *
 * @extends DataverseOperationBase
 */
export class PostExecuteActions extends DataverseOperationBase {
  /**
   * Initialize PostExecuteActions service
   * @param context - PowerApps Component Framework context for Dataverse access
   */
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "PostExecuteActions");
  }

  /**
   * Invoke rollup columns update action for test run statistics aggregation
   *
   * Executes the cat_RunRollupColumnsUpdates action to calculate and update
   * aggregate statistics.
   *
   * Action Details:
   * - Action Name: cat_RunRollupColumnsUpdates
   * - Target Entity: cat_copilottestruns
   * - Purpose: Aggregate test result statistics and timing metrics
   * - Dependencies: Must execute after all test results are created
   *
   * @param testRunId - GUID of the test run to calculate rollups for
   * @returns Promise resolving to boolean indicating successful rollup execution
   * @throws Error if action execution fails or test run not found
   * @public
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
   * Invoke conditional enrichment actions based on agent configuration settings
   *
   * Orchestrates multiple enrichment processes based on the agent configuration,
   * executing only those enrichment actions that are enabled and properly configured.
   * Implements intelligent action sequencing to optimize performance and dependencies.
   *
   * Enrichment Actions:
   * 1. Conversation Transcripts Enrichment (if isEnrichedWithConversationTranscripts)
   * 2. Azure Application Insights Enrichment (if isAzureApplicationInsightsEnabled)
   * 3. AI Builder Analysis (if Generated Answers enabled but Azure Insights disabled)
   *
   *
   * @param testRunId - GUID of the test run for enrichment processing
   * @param configuration - Agent configuration with enrichment flags and settings
   * @param testSetId - GUID of the test set for context and correlation
   * @returns Promise resolving when all enabled enrichment actions complete
   * @throws Error if critical enrichment action execution fails
   * @public
   */
  async invokeConditionalEnrichmentActions(
    testRunId: string,
    configuration: AgentConfiguration,
    testSetId: string
  ): Promise<void> {
    return this.executeOperation(async () => {
      // 1. Conversation Transcripts Enrichment
      if (configuration.isEnrichedWithConversationTranscripts) {
        await this.invokeDataverseConversationTranscriptsEnrichment(
          testRunId,
          configuration.id,
          testSetId
        );
      }

      // 2. Azure Application Insights Enrichment
      if (configuration.isAzureApplicationInsightsEnabled) {
        await this.invokeAzureApplicationInsightsEnrichment(
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
        await this.invokeAIBuilderAnalysis(testRunId, testSetId);
      }
    }, "Invoke conditional enrichment actions");
  }

  /**
   * Invoke Dataverse Conversation Transcripts Enrichment action
   * Action Details:
   * - Action Name: cat_RunDataverseConversationTranscriptsEnrichment
   * - Target Entity: cat_copilottestruns
   * - Purpose: Analyze conversation transcripts for topic and plan validation
   * - Processing: Asynchronous with optional delay management
   *
   * @param testRunId - GUID of the test run for transcript analysis
   * @param configurationId - GUID of the agent configuration for context
   * @param testSetId - GUID of the test set for correlation and tracking
   * @returns Promise resolving to boolean indicating successful enrichment initiation
   * @throws Error if action execution fails or insufficient configuration
   * @public
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
   * Action Details:
   * - Action Name: cat_RunAzureApplicationInsightsEnrichment
   * - Target Entity: cat_copilottestruns
   * - Purpose: Integrate telemetry and performance data from Azure Application Insights
   * - Processing: Asynchronous with configurable delay management
   *
   * @param testRunId - GUID of the test run for insights integration
   * @param configurationId - GUID of the agent configuration with insights settings
   * @param testSetId - GUID of the test set for correlation and tracking
   * @returns Promise resolving to boolean indicating successful enrichment initiation
   * @throws Error if action execution fails or insights configuration invalid
   * @public
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
   * Invoke AI Builder Analysis action for advanced test result processing
   * Action Details:
   * - Action Name: cat_RunAIBuilderAnalysis
   * - Target Entity: cat_copilottestruns
   * - Purpose: AI-powered analysis of generative answers and test results
   * - Execution Condition: Only when Azure Application Insights is disabled
   *
   * @param testRunId - GUID of the test run for AI Builder analysis
   * @param testSetId - GUID of the test set for context and correlation
   * @returns Promise resolving to boolean indicating successful analysis initiation
   * @throws Error if action execution fails or AI Builder not configured
   * @public
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
