/**
 * Base class for Dataverse operations
 * Provides common functionality and patterns for all Dataverse services
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

interface ActionExecutionRequest {
  entity: {
    entityType: string;
    id: string | null;
  };
  DataverseUriHost: string;
  CopilotTestRunId: string;
  getMetadata(): ActionMetadata;
}

/**
 * Abstract base class for all Dataverse operation classes
 * Provides common context, error handling, and utility methods
 */
export abstract class DataverseOperationBase {
  protected context: ComponentFramework.Context<unknown>;
  protected serviceName: string;

  /**
   * Initialize base Dataverse operation class
   * @param context - Power Platform Component Framework context
   * @param serviceName - Name of the derived service for logging
   */
  constructor(
    context: ComponentFramework.Context<unknown>,
    serviceName: string
  ) {
    this.context = context;
    this.serviceName = serviceName;
  }

  /**
   * Helper method to extract error message from unknown error type
   * @param error - Error object or unknown type
   * @returns Error message string
   */
  protected extractErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }

  /**
   * Execute a Dataverse operation with consistent error handling and logging
   * @param operation - The Dataverse operation to execute
   * @param operationName - Description of the operation for logging
   * @returns Promise resolving to operation result
   */
  protected async executeOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      throw error;
    }
  }

  /**
   * Execute a Dataverse operation safely (won't throw, returns null on failure)
   * @param operation - The Dataverse operation to execute
   * @param operationName - Description of the operation for logging
   * @returns Promise resolving to operation result or null
   */
  protected async executeOperationSafely<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const errorMessage = this.extractErrorMessage(error);
      return null;
    }
  }

  /**
   * Get organization URL from context
   * @returns Organization URL string
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
   * Get organization host from context (without protocol and paths)
   * @returns Organization host string (e.g., "copilotstudiokit-plan.crm.dynamics.com")
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
   * Create action-specific request based on action metadata
   * @param actionName - Name of the action to invoke
   * @param entityId - GUID of the entity
   * @param actionRequest - Request parameters
   * @returns Action execution request object
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

    // Define action metadata based on the provided XML schema
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
   * Execute a standard Dataverse fetch action
   * @param entityType - Dataverse entity logical name
   * @param entityId - GUID of the entity
   * @param actionName - Name of the action to invoke
   * @param actionRequest - Request body for the action
   * @returns Promise resolving to boolean indicating success
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

        // Execute using PCF WebAPI - use unknown cast to avoid TypeScript issues
        const webAPI = this.context.webAPI as unknown as {
          execute: (request: unknown) => Promise<Response>;
        };
        const response = await webAPI.execute(actionExecutionRequest);

        if (response.ok) {
          // Try to get response body if available
          try {
            const responseBody = await (response.json?.() ??
              Promise.resolve({}));
          } catch (textError) {
            // Response might not have JSON content, which is fine
          }

          return true;
        } else {
          let errorText = "";
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = "Unable to read error response";
          }

          // If it's a 401, this might be an authentication issue
          if (response.status === 401) {
            // Handle authentication error
          }

          return false;
        }
      } catch (error) {
        return false;
      }
    }, `Execute ${actionName} action`);

    return result ?? false;
  }
}
