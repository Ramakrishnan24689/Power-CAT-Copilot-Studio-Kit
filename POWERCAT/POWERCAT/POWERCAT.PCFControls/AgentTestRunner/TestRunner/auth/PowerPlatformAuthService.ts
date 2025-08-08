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
  botIdentifier: string;
}

/**
 * Power Platform Authentication service using MSAL (Microsoft Authentication Library)
 * Provides secure token acquisition for Power Platform operations
 * @class PowerPlatformAuthService
 */
export class PowerPlatformAuthService {
  private msalInstance: PublicClientApplication | null = null;
  private config: AgentConfig | null = null;
  private scopes = ["https://api.powerplatform.com/.default"];
  private cachedToken: string | null = null;
  private tokenExpiryTime: Date | null = null;

  /**
   * Initialize MSAL instance with agent configuration
   * @param agentConfig - Configuration containing clientId, tenantId, etc.
   * @throws {Error} When required configuration is missing
   */
  initialize(agentConfig: AgentConfig): void {
    // Validate required configuration
    if (!agentConfig.clientId || !agentConfig.tenantId) {
      throw new Error("ClientId and TenantId are required for authentication");
    }

    this.config = agentConfig;

    // Configure MSAL with secure settings
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
   * Main method to acquire authentication token
   * Uses cached token if valid, otherwise performs authentication flow
   * @returns {Promise<string>} Access token for API calls
   * @throws {Error} When authentication fails
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
   * Check if authentication service is properly initialized
   * @returns {boolean} True if MSAL instance and config are available
   */
  isInitialized(): boolean {
    return this.msalInstance !== null && this.config !== null;
  }

  /**
   * Check if cached token is still valid
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
   * Validate that MSAL has been properly initialized
   * @throws {Error} When MSAL instance or config is missing
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
   * Initialize the MSAL instance asynchronously
   * @private
   */
  private async initializeMsalInstance(): Promise<void> {
    await this.msalInstance!.initialize();
  }

  /**
   * Ensure user has valid account, perform interactive login if needed
   * @returns {Promise<AccountInfo[]>} Array of user accounts
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
   * Attempt silent token acquisition, fallback to interactive if needed
   * @param accounts - User accounts from MSAL
   * @returns {Promise<string>} Access token
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
   * Perform interactive login when no accounts exist
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
   * Perform interactive token acquisition
   * @returns {Promise<AuthenticationResult>} Authentication result with token
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
   * Cache the authentication token and return it
   * @param result - Authentication result from MSAL
   * @returns {string} Access token
   * @private
   */
  private cacheAndReturnToken(result: AuthenticationResult): string {
    // Cache the token and expiry time for future use
    this.cachedToken = result.accessToken;
    this.tokenExpiryTime = result.expiresOn || null;

    return result.accessToken;
  }

  /**
   * Extract error message from unknown error object
   * @param error - Error object of unknown type
   * @returns {string} Error message string
   * @private
   */
  private getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Unknown error";
  }
}
