/**
 * AgentConfigurationOperations.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides Dataverse operations for managing agent configuration data and cloud environment detection.
 * Handles retrieval of agent configurations and Power Automate region mapping for multi-cloud support.
 * Extends DataverseOperationBase for consistent error handling and logging.
 *
 * Exports:
 *   - AgentConfigurationOperations: Main class for agent configuration and environment operations.
 *
 * Usage:
 *   const configOps = new AgentConfigurationOperations(context);
 *   const config = await configOps.getConfiguration(configId);
 *   const cloudInfo = await configOps.getCloudParameterFromEnvironment();
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import type { AgentConfiguration } from "../shared/models/DataModels";

/**
 * Service for managing agent configuration operations in Dataverse
 * Handles retrieval of configuration data and cloud environment detection
 * @class AgentConfigurationOperations
 */
export class AgentConfigurationOperations extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "AgentConfigurationOperations");
  }

  /**
   * Retrieve Agent Configuration by ID from Dataverse
   * @param configId - GUID of the configuration record
   * @returns Promise resolving to AgentConfiguration object with all necessary properties
   * @throws {Error} When configuration retrieval fails or record not found
   */
  async getConfiguration(configId: string): Promise<AgentConfiguration> {
    return this.executeOperation(async () => {
      const response = await this.context.webAPI.retrieveRecord(
        "cat_copilotconfiguration",
        configId,
        "?$select=cat_clientid,cat_tenantid,cat_environmentid,cat_agentidentifier,cat_isazureapplicationinsightsenabled,cat_isenrichedwithconversationtranscripts,cat_isgeneratedanswersanalysisenabled"
      );

      return {
        id: response.cat_copilotconfigurationid,
        clientId: response.cat_clientid,
        tenantId: response.cat_tenantid,
        environmentId: response.cat_environmentid,
        agentIdentifier: response.cat_agentidentifier,
        isGeneratedAnswersAnalysisEnabled:
          response.cat_isgeneratedanswersanalysisenabled,
        isAzureApplicationInsightsEnabled:
          response.cat_isazureapplicationinsightsenabled,
        isEnrichedWithConversationTranscripts:
          response.cat_isenrichedwithconversationtranscripts,
      };
    }, "Get configuration");
  }

  /**
   * Get cloud parameter value by retrieving and mapping Power Automate Region environment variable
   * Supports multi-cloud deployments including Commercial, GCC, GCC High, and DoD environments
   * @returns Promise resolving to cloud parameter value and optional error message for diagnostics
   */
  async getCloudParameterFromEnvironment(): Promise<{
    cloud: string;
    error?: string;
  }> {
    try {
      // Get the environment variable definition by schema name
      const definitionResponse =
        await this.context.webAPI.retrieveMultipleRecords(
          "environmentvariabledefinition",
          `?$filter=schemaname eq 'cat_PowerAutomateEndpoint'&$select=environmentvariabledefinitionid,defaultvalue`
        );

      if (
        !definitionResponse.entities ||
        definitionResponse.entities.length === 0
      ) {
        return {
          cloud: "",
          error:
            "⚠️ Power Automate Region environment variable not found. Defaulting to Commercial cloud. Please create this environment variable with values: Commercial, GCC, GCC High, or DoD.",
        };
      }

      const definitionId =
        definitionResponse.entities[0].environmentvariabledefinitionid;
      const defaultValue = definitionResponse.entities[0].defaultvalue;

      // Try to get the current environment-specific value
      const valueResponse = await this.context.webAPI.retrieveMultipleRecords(
        "environmentvariablevalue",
        `?$filter=_environmentvariabledefinitionid_value eq '${definitionId}'&$select=value&$top=1`
      );

      // Get the actual value (environment-specific or default)
      let powerAutomateRegion: string | null = null;
      if (valueResponse.entities && valueResponse.entities.length > 0) {
        powerAutomateRegion =
          valueResponse.entities[0].value || defaultValue || null;
      } else {
        powerAutomateRegion = defaultValue || null;
      }

      // Map Power Automate region to cloud parameter
      let cloud = "";
      if (powerAutomateRegion) {
        const region = powerAutomateRegion.toLowerCase().trim();
        switch (region) {
          case "commercial":
            cloud = "";
            break;
          case "gcc":
            cloud = "gcc";
            break;
          case "gcc high":
          case "gcchigh":
          case "gcc (high)":
          case "gcc(high)":
            cloud = "gcchigh";
            break;
          case "dod":
            cloud = "dod";
            break;
          case "china":
            cloud = "china";
            break;
          default:
            cloud = ""; // Default to Commercial
        }
      }

      // Check if we had to default due to unknown region value
      if (
        powerAutomateRegion &&
        cloud === "" &&
        !["commercial", ""].includes(powerAutomateRegion.toLowerCase().trim())
      ) {
        return {
          cloud: "",
          error: `⚠️ Unknown Power Automate Region value: '${powerAutomateRegion}' in environment variable. Defaulting to Commercial cloud. Valid values are: Commercial, GCC, GCC High, or DoD.`,
        };
      }

      return { cloud };
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return {
        cloud: "",
        error: `❌ Failed to retrieve Power Automate Region environment variable: ${errorMessage}. Defaulting to Commercial cloud. Please check your environment configuration.`,
      };
    }
  }
}
