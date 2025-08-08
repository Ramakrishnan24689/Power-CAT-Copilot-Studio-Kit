import { CopilotStudioClient } from "@microsoft/agents-copilotstudio-client";
import type { ConnectionSettings } from "@microsoft/agents-copilotstudio-client";
import type { Activity } from "@microsoft/agents-activity";
import { PowerPlatformAuthService } from "../auth/PowerPlatformAuthService";
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

export class ConversationManager {
  private client: CopilotStudioClient | null = null;
  private config: ConnectionSettings | null = null;
  private auth: PowerPlatformAuthService;
  private isTokenValid = false;

  constructor() {
    this.auth = new PowerPlatformAuthService();
  }

  /**
   * Initializes the conversation manager with agent configuration
   * Sets up authentication and creates the CopilotStudio client
   * @param agentConfig - Configuration containing environment and authentication details
   */
  async initialize(agentConfig: AgentConfiguration): Promise<void> {
    this.config = {
      environmentId: agentConfig.environmentId,
      agentIdentifier: agentConfig.botIdentifier,
      appClientId: agentConfig.clientId,
      tenantId: agentConfig.tenantId,
      cloud: "",
    };

    // Only initialize auth if not already done
    if (!this.auth.isInitialized()) {
      this.auth.initialize({
        clientId: agentConfig.clientId,
        tenantId: agentConfig.tenantId,
        environmentId: agentConfig.environmentId,
        botIdentifier: agentConfig.botIdentifier,
      });
    }

    // Only acquire token if we don't have a valid one
    if (!this.isTokenValid) {
      const token = await this.auth.acquireToken();
      if (!token) {
        throw new Error(
          CONVERSATION_MANAGER_CONSTANTS.ERROR_MESSAGES.TOKEN_ACQUISITION_FAILED
        );
      }
      this.client = new CopilotStudioClient(this.config, token);
      this.isTokenValid = true;
    }
  }

  /**
   * Creates a new conversation with the CopilotStudio agent
   * Sends the initial conversation start event and returns conversation details
   * @returns Promise resolving to conversation ID and start activity
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

    const token = await this.auth.acquireToken();
    this.client = new CopilotStudioClient(this.config, token);

    // Always send start event as true to start the conversation
    const startActivity = await this.client.startConversationAsync(true);

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
   * Gets the current CopilotStudio client instance
   * @returns The client instance or null if not initialized
   */

  getClient(): CopilotStudioClient | null {
    return this.client;
  }

  /**
   * Refreshes the authentication token and recreates the client
   * Used when the current token has expired or is invalid
   */
  async refreshToken(): Promise<void> {
    if (!this.config) {
      throw new Error(
        CONVERSATION_MANAGER_CONSTANTS.ERROR_MESSAGES.NOT_INITIALIZED
      );
    }

    try {
      const token = await this.auth.acquireToken();
      this.client = new CopilotStudioClient(this.config, token);
      this.isTokenValid = true;
    } catch (error) {
      this.isTokenValid = false;
      throw error;
    }
  }

  /**
   * Checks if the conversation manager has been properly initialized
   * @returns True if both client and config are available
   */
  isInitialized(): boolean {
    return this.client !== null && this.config !== null;
  }
}
