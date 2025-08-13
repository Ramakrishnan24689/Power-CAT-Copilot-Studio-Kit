/**
 * DataverseOperationBase.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides abstract base class for all Dataverse operation implementations with consistent
 * error handling, context management, and action execution patterns. Includes standardized
 * metadata definitions for Dataverse actions and utility methods for organization access.
 *
 * Exports:
 *   - ActionMetadata: Interface for Dataverse action metadata definitions.
 *   - DataverseOperationBase: Abstract base class for Dataverse operations.
 *
 * Usage:
 *   class MyOperations extends DataverseOperationBase {
 *     constructor(context) { super(context, "MyOperations"); }
 *     async myMethod() { return this.executeOperation(async () => { ... }, "My operation"); }
 *   }
 */

export interface ActionMetadata {
  boundParameter: string;
  parameterTypes: Record<
    string,
    {
      typeName: string;
      structuralProperty: number;
    }
  >;
  operationType: number;
  operationName: string;
}

/**
 * Abstract base class for all Dataverse operation classes
 * Provides common context, error handling, and utility methods for consistent operation patterns
 * @abstract DataverseOperationBase
 */
export abstract class DataverseOperationBase {
  protected context: ComponentFramework.Context<unknown>;
  protected serviceName: string;

  /**
   * Initialize base Dataverse operation class with context and service identification
   * @param context - Power Platform Component Framework context for API access
   * @param serviceName - Name of the derived service class for logging and identification
   */
  constructor(
    context: ComponentFramework.Context<unknown>,
    serviceName: string
  ) {
    this.context = context;
    this.serviceName = serviceName;
  }

  /**
   * Helper method to extract error message from unknown error type for consistent error reporting
   * @param error - Error object or unknown type from catch blocks
   * @returns Human-readable error message string
   */
  protected extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }

  /**
   * Execute a Dataverse operation with consistent error handling and logging
   * Throws errors for proper exception handling in calling code
   * @param operation - The Dataverse operation function to execute
   * @param operationName - Description of the operation for logging and debugging
   * @returns Promise resolving to operation result
   * @throws {Error} Re-throws original error after processing for proper error handling
   */
  protected async executeOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      throw errorMessage;
    }
  }

  /**
   * Execute a Dataverse operation safely without throwing exceptions
   * Returns null on failure for operations where error handling is optional
   * @param operation - The Dataverse operation function to execute
   * @param operationName - Description of the operation for logging and debugging
   * @returns Promise resolving to operation result or null on failure
   */
  protected async executeOperationSafely<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      console.error(
        `[${this.serviceName}] Failed to execute operation "${operationName}": ${errorMessage}`
      );
      return null;
    }
  }

  /**
   * Get organization URL from Power Platform context for API operations
   * @returns Organization URL string or empty string if not available
   */
  protected getOrgUrl(): string {
    return (
      (
        this.context as ComponentFramework.Context<unknown> & {
          page: { getClientUrl(): string };
        }
      ).page?.getClientUrl() || ""
    );
  }

  /**
   * Get organization hostname from context without protocol and paths for action requests
   * @returns Organization host string (e.g., "organization.crm.dynamics.com") or fallback value
   */
  protected getOrgHost(): string {
    const orgUrl = this.getOrgUrl();
    if (!orgUrl) return "";

    try {
      const url = new URL(orgUrl);
      return url.hostname;
    } catch (error) {
      // Fallback: try to extract hostname manually
      const match = orgUrl.match(/https?:\/\/([^/]+)/);
      return match ? match[1] : orgUrl;
    }
  }

  /**
   * Create action-specific request based on predefined action metadata
   * Dynamically builds request object with proper parameters for Dataverse actions
   * @param actionName - Name of the Dataverse action to invoke
   * @param entityId - GUID of the target entity record
   * @param actionRequest - Request parameters specific to the action
   * @returns Action execution request object with metadata and parameters
   * @throws {Error} When action name is not recognized in metadata definitions
   * @private
   */
  private createActionRequest(
    actionName: string,
    entityId: string,
    actionRequest: Record<string, unknown>
  ): Record<string, unknown> {
    const baseEntity = {
      entityType: "cat_copilottestrun",
      id: entityId,
    };

    // Define action metadata based on Dataverse action schemas
    const actionMetadata: Record<string, ActionMetadata> = {
      cat_RunRollupColumnsUpdates: {
        boundParameter: "entity",
        parameterTypes: {
          entity: {
            typeName: "mscrm.cat_copilottestrun",
            structuralProperty: 5,
          },
          DataverseUriHost: { typeName: "Edm.String", structuralProperty: 1 },
          CopilotTestRunId: { typeName: "Edm.String", structuralProperty: 1 },
        },
        operationType: 0,
        operationName: actionName,
      },
      cat_RunAIBuilderAnalysis: {
        boundParameter: "entity",
        parameterTypes: {
          entity: {
            typeName: "mscrm.cat_copilottestrun",
            structuralProperty: 5,
          },
          CopilotTestRunId: { typeName: "Edm.String", structuralProperty: 1 },
          CopilotTestSetId: { typeName: "Edm.String", structuralProperty: 1 },
        },
        operationType: 0,
        operationName: actionName,
      },
      cat_RunAzureApplicationInsightsEnrichment: {
        boundParameter: "entity",
        parameterTypes: {
          entity: {
            typeName: "mscrm.cat_copilottestrun",
            structuralProperty: 5,
          },
          SkipDelay: { typeName: "Edm.Boolean", structuralProperty: 1 },
          CopilotConfigurationId: {
            typeName: "Edm.String",
            structuralProperty: 1,
          },
          CopilotTestRunId: { typeName: "Edm.String", structuralProperty: 1 },
          CopilotTestSetId: { typeName: "Edm.String", structuralProperty: 1 },
        },
        operationType: 0,
        operationName: actionName,
      },
      cat_RunCopilotTests: {
        boundParameter: "entity",
        parameterTypes: {
          entity: {
            typeName: "mscrm.cat_copilottestrun",
            structuralProperty: 5,
          },
          AuthCode: { typeName: "Edm.String", structuralProperty: 1 },
          CodeVerifier: { typeName: "Edm.String", structuralProperty: 1 },
          CopilotConfigurationId: {
            typeName: "Edm.String",
            structuralProperty: 1,
          },
          CopilotTestRunId: { typeName: "Edm.String", structuralProperty: 1 },
          CopilotTestSetId: { typeName: "Edm.String", structuralProperty: 1 },
        },
        operationType: 0,
        operationName: actionName,
      },
      cat_RunDataverseConversationTranscriptsEnrichment: {
        boundParameter: "entity",
        parameterTypes: {
          entity: {
            typeName: "mscrm.cat_copilottestrun",
            structuralProperty: 5,
          },
          SkipDelay: { typeName: "Edm.Boolean", structuralProperty: 1 },
          CopilotConfigurationId: {
            typeName: "Edm.String",
            structuralProperty: 1,
          },
          CopilotTestRunId: { typeName: "Edm.String", structuralProperty: 1 },
          CopilotTestSetId: { typeName: "Edm.String", structuralProperty: 1 },
        },
        operationType: 0,
        operationName: actionName,
      },
    };

    const metadata = actionMetadata[actionName];
    if (!metadata) {
      throw new Error(`Unknown action: ${actionName}`);
    }

    // Create the action execution request dynamically
    const request: Record<string, unknown> = {
      entity: baseEntity,
      getMetadata: () => metadata,
    };

    // Add only the parameters that are defined in the metadata (excluding 'entity')
    Object.keys(metadata.parameterTypes).forEach((paramName) => {
      if (paramName !== "entity" && actionRequest[paramName] !== undefined) {
        request[paramName] = actionRequest[paramName];
      }
    });

    return request;
  }

  /**
   * Execute a standard Dataverse action with consistent error handling and response processing
   * Handles authentication, response parsing, and error scenarios for action execution
   * @param entityType - Dataverse entity logical name (not used in current implementation)
   * @param entityId - GUID of the target entity record
   * @param actionName - Name of the Dataverse action to invoke
   * @param actionRequest - Request body parameters for the action
   * @returns Promise resolving to boolean indicating success or failure
   */
  protected async executeDataverseAction(
    entityType: string,
    entityId: string,
    actionName: string,
    actionRequest: Record<string, unknown>
  ): Promise<boolean> {
    const result = await this.executeOperationSafely(async () => {
      try {
        // Create action-specific request based on action metadata
        const actionExecutionRequest = this.createActionRequest(
          actionName,
          entityId,
          actionRequest
        );

        const webAPI = this.context.webAPI as unknown as {
          execute: (request: unknown) => Promise<Response>;
        };
        const response = await webAPI.execute(actionExecutionRequest);

        if (response.ok) {
          return true;
        } else {
          console.error(
            `[${this.serviceName}] Dataverse action "${actionName}" failed with HTTP status: ${response.status} ${response.statusText}`
          );
          return false;
        }
      } catch (error) {
        return false;
      }
    }, `Execute ${actionName} action`);

    return result ?? false;
  }
}
