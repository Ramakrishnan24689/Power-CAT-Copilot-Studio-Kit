/**
 * ConversationManager.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides a high-level interface for managing conversations with CopilotStudio agents.
 * Handles authentication, configuration, and client lifecycle for agent communication.
 *
 * Exports:
 *   - ConversationManager: Main class for initializing, starting, and managing agent conversations.
 *
 * Usage:
 *   const manager = new ConversationManager(context, errorCallback);
 *   await manager.initialize(agentConfig);
 *   const { conversationId, startActivity } = await manager.createConversation();
 */

import { CopilotStudioClient } from "@microsoft/agents-copilotstudio-client";
import type { ConnectionSettings } from "@microsoft/agents-copilotstudio-client";
import type { Activity } from "@microsoft/agents-activity";
import { PowerPlatformAuthService } from "../auth/PowerPlatformAuthService";
import { AgentConfigurationOperations } from "../dataverse/AgentConfigurationOperations";
import type { AgentConfiguration } from "../shared/models/DataModels";

/**
 * Constants for ConversationManager
 */
const CONVERSATION_MANAGER_CONSTANTS = {
  // Error messages
  ERROR_MESSAGES: {
    NOT_INITIALIZED:
      "Unable to connect to the agent. Please check your configuration and try again.",
    TOKEN_ACQUISITION_FAILED:
      "Authentication failed. Please check your credentials and try again.",
    CONVERSATION_CREATION_FAILED:
      "Failed to start conversation with the agent. Please try again later.",
  },
} as const;

/**
 * ConversationManager
 *
 * Manages authentication, configuration, and lifecycle of CopilotStudioClient for agent conversations.
 * Handles cloud environment detection, error reporting, and token refresh logic.
 */
export class ConversationManager {
  private client: CopilotStudioClient | null = null;
  private config: ConnectionSettings | null = null;
  private auth: PowerPlatformAuthService;
  private configurationOperations: AgentConfigurationOperations | null = null;
  private isTokenValid = false;
  private onError?: (error: string) => void;

  constructor(
    context?: ComponentFramework.Context<unknown>,
    onError?: (error: string) => void
  ) {
    this.auth = new PowerPlatformAuthService();
    this.onError = onError;

    if (context) {
      this.configurationOperations = new AgentConfigurationOperations(context);
    }
  }

  /**
   * Creates a CopilotStudio client with a valid authentication token.
   * Throws if configuration is missing or token acquisition fails.
   * @private
   */
  private async createClientWithToken(): Promise<void> {
    if (!this.config) {
      throw new Error(
        CONVERSATION_MANAGER_CONSTANTS.ERROR_MESSAGES.NOT_INITIALIZED
      );
    }

    const token = await this.auth.acquireToken();
    if (!token) {
      throw new Error(
        CONVERSATION_MANAGER_CONSTANTS.ERROR_MESSAGES.TOKEN_ACQUISITION_FAILED
      );
    }
    this.client = new CopilotStudioClient(this.config, token);
    this.isTokenValid = true;
  }

  /**
   * Initializes the conversation manager with agent configuration.
   * Sets up authentication, detects cloud, and prepares the CopilotStudio client.
   * @param agentConfig - Agent configuration containing Environment, Agent and Azure App details.
   */
  async initialize(agentConfig: AgentConfiguration): Promise<void> {
    // Retrieve cloud parameter from environment variable
    let cloud = "";

    if (this.configurationOperations) {
      try {
        const cloudResult =
          await this.configurationOperations.getCloudParameterFromEnvironment();
        cloud = cloudResult.cloud;

        // Log any errors or warnings about the cloud parameter
        if (cloudResult.error && this.onError) {
          this.onError(cloudResult.error);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        const fullError = `❌ Failed to retrieve cloud configuration value from environment variable: ${errorMessage}. Defaulting to Commercial cloud.`;

        if (this.onError) {
          this.onError(fullError);
        }

        // Continue with default (Commercial cloud)
        cloud = "";
      }
    } else {
      // If no context was provided, log warning and use default
      const warningMessage =
        "⚠️ No Dataverse context available. Using default Commercial cloud. Please ensure ConversationManager is initialized with context parameter.";

      if (this.onError) {
        this.onError(warningMessage);
      }
    }

    this.config = {
      environmentId: agentConfig.environmentId,
      agentIdentifier: agentConfig.agentIdentifier,
      appClientId: agentConfig.clientId,
      tenantId: agentConfig.tenantId,
      cloud: cloud,
    };

    // Only initialize auth if not already done
    if (!this.auth.isInitialized()) {
      this.auth.initialize({
        clientId: agentConfig.clientId,
        tenantId: agentConfig.tenantId,
        environmentId: agentConfig.environmentId,
        agentIdentifier: agentConfig.agentIdentifier,
      });
    }

    // Only acquire token if we don't have a valid one
    if (!this.isTokenValid) {
      await this.createClientWithToken();
    }
  }

  /**
   * Creates a new conversation with the CopilotStudio agent.
   * Sends the initial conversation start event and returns conversation details.
   * @returns Promise resolving to conversation ID and start activity.
   * @throws If the client is not initialized or conversation creation fails.
   */
  async createConversation(): Promise<{
    conversationId: string;
    startActivity: Activity | null;
  }> {
    if (!this.client || !this.config) {
      throw new Error(
        CONVERSATION_MANAGER_CONSTANTS.ERROR_MESSAGES.NOT_INITIALIZED
      );
    }

    // Only refresh client if we don't have a valid token
    if (!this.isTokenValid) {
      await this.createClientWithToken();
    }

    // Always send start event as true to start the conversation
    const startActivity = await this.client!.startConversationAsync(true);

    if (!startActivity.conversation || !startActivity.conversation.id) {
      throw new Error(
        CONVERSATION_MANAGER_CONSTANTS.ERROR_MESSAGES.CONVERSATION_CREATION_FAILED
      );
    }

    return {
      conversationId: startActivity.conversation.id,
      startActivity: startActivity,
    };
  }

  /**
   * Gets the current CopilotStudio client instance.
   * @returns The client instance or null if not initialized.
   */
  getClient(): CopilotStudioClient | null {
    return this.client;
  }

  /**
   * Refreshes the authentication token and recreates the client.
   * Used when the current token has expired or is invalid.
   * @throws If token acquisition fails.
   */
  async refreshToken(): Promise<void> {
    try {
      await this.createClientWithToken();
    } catch (error) {
      this.isTokenValid = false;
      throw error;
    }
  }

  /**
   * Checks if the conversation manager has been properly initialized.
   * @returns True if both client and config are available.
   */
  isInitialized(): boolean {
    return this.client !== null && this.config !== null;
  }
}
