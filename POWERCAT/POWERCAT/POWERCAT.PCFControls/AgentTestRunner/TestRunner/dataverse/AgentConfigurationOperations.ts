/**
 * Agent Configuration Operations for Dataverse
 * Handles operations related to agent configurations
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import type { AgentConfiguration } from "../shared/models/DataModels";

/**
 * Service for managing agent configuration operations in Dataverse
 * Handles retrieval of configuration data
 */
export class AgentConfigurationOperations extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "AgentConfigurationOperations");
  }

  /**
   * Retrieve Agent Configuration by ID
   * @param configId - GUID of the configuration
   * @returns Promise resolving to AgentConfiguration object
   */
  async getConfiguration(configId: string): Promise<AgentConfiguration> {
    return this.executeOperation(async () => {
      const response = await this.context.webAPI.retrieveRecord(
        "cat_copilotconfiguration",
        configId,
        "?$select=cat_clientid,cat_tenantid,cat_environmentid,cat_botidentifier,cat_isazureapplicationinsightsenabled,cat_isenrichedwithconversationtranscripts,cat_isgeneratedanswersanalysisenabled"
      );

      return {
        id: response.cat_copilotconfigurationid,
        clientId: response.cat_clientid,
        tenantId: response.cat_tenantid,
        environmentId: response.cat_environmentid,
        botIdentifier: response.cat_botidentifier,
        isGeneratedAnswersAnalysisEnabled:
          response.cat_isgeneratedanswersanalysisenabled,
        isAzureApplicationInsightsEnabled:
          response.cat_isazureapplicationinsightsenabled,
        isEnrichedWithConversationTranscripts:
          response.cat_isenrichedwithconversationtranscripts,
      };
    }, "Get configuration");
  }
}
