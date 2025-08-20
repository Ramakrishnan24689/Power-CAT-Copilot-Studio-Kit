/**
 * PowerPlatformAuthService.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides secure Power Platform authentication using Microsoft Authentication Library (MSAL).
 * Handles token acquisition, caching, and management for Power Platform API operations
 * with support for SSO silent authentication flows leveraging existing user context.
 *
 * Exports:
 *   - AgentConfig: Configuration interface for authentication parameters.
 *   - PowerPlatformAuthService: Main class for secure token acquisition and management.
 *
 * Usage:
 *   const authService = new PowerPlatformAuthService();
 *   authService.initialize(agentConfig);
 *   const token = await authService.acquireToken();
 */

import {
  PublicClientApplication,
  Configuration,
  AuthenticationResult,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";

/**
 * Configuration interface for agent authentication
 * @interface AgentConfig
 */
export interface AgentConfig {
  clientId: string;
  tenantId: string;
  environmentId: string;
  agentIdentifier: string;
}

/**
 * Power Platform Authentication service using MSAL (Microsoft Authentication Library)
 * Provides secure token acquisition for Power Platform operations with automatic token caching
 * and support for SSO silent authentication flows leveraging existing user context.
 * @class PowerPlatformAuthService
 */
export class PowerPlatformAuthService {
  private msalInstance: PublicClientApplication | null = null;
  private config: AgentConfig | null = null;
  private readonly scopes = ["https://api.powerplatform.com/.default"];
  private cachedToken: string | null = null;
  private tokenExpiryTime: Date | null = null;

  /**
   * Initialize MSAL instance with agent configuration
   * Sets up authentication parameters and creates MSAL client for SSO token acquisition
   * @param agentConfig - Configuration containing clientId, tenantId, environmentId, and agentIdentifier
   * @throws {Error} When required configuration parameters are missing
   */
  initialize(agentConfig: AgentConfig): void {
    // Validate required configuration
    if (!agentConfig.clientId || !agentConfig.tenantId) {
      throw new Error("ClientId and TenantId are required for authentication");
    }

    this.config = agentConfig;

    // Get client URL from current window context
    const clientUrl =
      typeof window !== "undefined" ? window.location.origin : "";

    // Configure MSAL using SSO
    const msalConfig: Configuration = {
      auth: {
        clientId: agentConfig.clientId,
        authority: `https://login.microsoftonline.com/${agentConfig.tenantId}`,
        redirectUri: clientUrl,
      },
      cache: {
        cacheLocation: "memoryStorage",
      },
    };

    this.msalInstance = new PublicClientApplication(msalConfig);
  }

  /**
   * Acquire authentication token using SSO silent flow with account resolution
   * Returns cached token if valid, otherwise performs SSO silent authentication
   * @returns {Promise<string>} Access token for Agent SDK operations
   * @throws {Error} When authentication initialization or token acquisition fails
   */
  async acquireToken(): Promise<string> {
    // Return cached token if still valid
    if (this.isCachedTokenValid()) {
      return this.cachedToken!;
    }

    this.validateInitialization();

    try {
      // Initialize the MSAL application
      await this.msalInstance!.initialize();

      // Try to get existing accounts first
      const accounts = this.msalInstance!.getAllAccounts();

      let authResult: AuthenticationResult;

      if (accounts.length > 0) {
        // Set the active account for MSAL
        this.msalInstance!.setActiveAccount(accounts[0]);

        // Use acquireTokenSilent with account hint if available
        const silentRequest = {
          scopes: this.scopes,
          account: accounts[0],
        };

        authResult = await this.msalInstance!.acquireTokenSilent(silentRequest);
      } else {
        // No accounts available, need interactive login
        const interactiveRequest = {
          scopes: this.scopes,
        };

        authResult = await this.msalInstance!.acquireTokenPopup(
          interactiveRequest
        );

        // Set the account as active after successful login
        if (authResult.account) {
          this.msalInstance!.setActiveAccount(authResult.account);
        }
      }

      if (!authResult || !authResult.accessToken) {
        throw new Error("Authentication returned invalid result");
      }

      return this.cacheAndReturnToken(authResult);
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        // If silent auth fails, try interactive authentication
        try {
          const interactiveRequest = {
            scopes: this.scopes,
          };

          const authResult = await this.msalInstance!.acquireTokenPopup(
            interactiveRequest
          );

          // Set the account as active after successful login
          if (authResult.account) {
            this.msalInstance!.setActiveAccount(authResult.account);
          }

          return this.cacheAndReturnToken(authResult);
        } catch (interactiveError) {
          throw new Error(
            `Authentication failed. Please check app registration permissions: ${this.getErrorMessage(
              interactiveError
            )}.`
          );
        }
      }

      throw new Error(
        "Failed to authenticate for Agent SDK access. Error: " +
          this.getErrorMessage(error)
      );
    }
  }

  /**
   * Check if authentication service has been properly initialized
   * @returns {boolean} True if MSAL instance and configuration are available
   */
  isInitialized(): boolean {
    return this.msalInstance !== null && this.config !== null;
  }

  /**
   * Check if cached token is still valid and not expired
   * @returns {boolean} True if cached token exists and hasn't expired
   * @private
   */
  private isCachedTokenValid(): boolean {
    return Boolean(
      this.cachedToken &&
        this.tokenExpiryTime &&
        new Date() < this.tokenExpiryTime
    );
  }

  /**
   * Validate that MSAL has been properly initialized before token operations
   * @throws {Error} When MSAL instance or configuration is missing
   * @private
   */
  private validateInitialization(): void {
    if (!this.msalInstance || !this.config) {
      throw new Error(
        "PowerPlatform Auth not initialized - call initialize() with config first"
      );
    }
  }

  /**
   * Cache the authentication token and return it for immediate use
   * @param result - Authentication result from MSAL containing token and expiry
   * @returns {string} Access token for API operations
   * @private
   */
  private cacheAndReturnToken(result: AuthenticationResult): string {
    // Cache the token and expiry time for future use
    this.cachedToken = result.accessToken;
    this.tokenExpiryTime = result.expiresOn || null;

    return result.accessToken;
  }

  /**
   * Extract error message from unknown error object for consistent error reporting
   * @param error - Error object of unknown type
   * @returns {string} Human-readable error message
   * @private
   */
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }
}
