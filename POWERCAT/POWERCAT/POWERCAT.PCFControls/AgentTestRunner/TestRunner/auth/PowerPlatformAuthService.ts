/**
 * PowerPlatformAuthService.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides secure Power Platform authentication using Microsoft Authentication Library (MSAL).
 * Handles token acquisition, caching, and management for Power Platform API operations
 * with support for both silent and interactive authentication flows.
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
  AccountInfo,
  AuthenticationResult,
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
 * and support for both silent and interactive authentication flows.
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
   * Sets up authentication parameters and creates MSAL client for token acquisition
   * @param agentConfig - Configuration containing clientId, tenantId, environmentId, and agentIdentifier
   * @throws {Error} When required configuration parameters are missing
   */
  initialize(agentConfig: AgentConfig): void {
    // Validate required configuration
    if (!agentConfig.clientId || !agentConfig.tenantId) {
      throw new Error("ClientId and TenantId are required for authentication");
    }

    this.config = agentConfig;

    // Configure MSAL with secure settings for browser environment
    const msalConfig: Configuration = {
      auth: {
        clientId: agentConfig.clientId,
        authority: `https://login.microsoftonline.com/${agentConfig.tenantId}`,
        redirectUri:
          typeof window !== "undefined" ? window.location.origin : "",
      },
      cache: {
        cacheLocation: "localStorage", // Persistent storage for better UX
        storeAuthStateInCookie: true, // Additional security for certain browsers
      },
    };

    this.msalInstance = new PublicClientApplication(msalConfig);
  }

  /**
   * Acquire authentication token for Power Platform API calls
   * Returns cached token if valid, otherwise performs full authentication flow
   * @returns {Promise<string>} Access token for API operations
   * @throws {Error} When authentication initialization or token acquisition fails
   */
  async acquireToken(): Promise<string> {
    // Return cached token if still valid
    if (this.isCachedTokenValid()) {
      return this.cachedToken!;
    }

    this.validateInitialization();

    await this.initializeMsalInstance();
    const accounts = await this.ensureUserIsLoggedIn();
    const token = await this.acquireTokenSilentOrInteractive(accounts);

    return token;
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
        "PowerPlatform Auth not initialized - call initialize() first"
      );
    }
  }

  /**
   * Initialize the MSAL instance asynchronously for browser compatibility
   * @private
   */
  private async initializeMsalInstance(): Promise<void> {
    await this.msalInstance!.initialize();
  }

  /**
   * Ensure user has valid account, perform interactive login if needed
   * @returns {Promise<AccountInfo[]>} Array of authenticated user accounts
   * @private
   */
  private async ensureUserIsLoggedIn(): Promise<AccountInfo[]> {
    const accounts = this.msalInstance!.getAllAccounts();

    if (accounts.length === 0) {
      await this.performInteractiveLogin();
      return this.msalInstance!.getAllAccounts();
    }

    return accounts;
  }

  /**
   * Attempt silent token acquisition first, fallback to interactive if needed
   * @param accounts - Authenticated user accounts from MSAL
   * @returns {Promise<string>} Access token for API operations
   * @private
   */
  private async acquireTokenSilentOrInteractive(
    accounts: AccountInfo[]
  ): Promise<string> {
    try {
      // Try silent token acquisition first
      const result = await this.msalInstance!.acquireTokenSilent({
        scopes: this.scopes,
        account: accounts[0],
      });

      return this.cacheAndReturnToken(result);
    } catch (silentError) {
      // Silent failed, try interactive authentication
      const result = await this.performInteractiveLoginForToken();
      return this.cacheAndReturnToken(result);
    }
  }

  /**
   * Perform interactive login popup when no cached accounts exist
   * @throws {Error} When interactive login fails
   * @private
   */
  private async performInteractiveLogin(): Promise<void> {
    try {
      await this.msalInstance!.loginPopup({ scopes: this.scopes });
    } catch (loginError) {
      throw new Error(
        `Interactive login failed: ${this.getErrorMessage(loginError)}`
      );
    }
  }

  /**
   * Perform interactive token acquisition popup when silent acquisition fails
   * @returns {Promise<AuthenticationResult>} Authentication result with access token
   * @throws {Error} When interactive token acquisition fails
   * @private
   */
  private async performInteractiveLoginForToken(): Promise<AuthenticationResult> {
    try {
      const result = await this.msalInstance!.loginPopup({
        scopes: this.scopes,
      });
      return result;
    } catch (interactiveError) {
      throw new Error(
        `Interactive token acquisition failed: ${this.getErrorMessage(
          interactiveError
        )}`
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
