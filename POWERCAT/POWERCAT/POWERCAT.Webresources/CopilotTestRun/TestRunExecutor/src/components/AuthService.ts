import { AuthState, AuthResponse } from "./Types";
import { CONFIG } from "./Config";

/**
 * @class AuthService
 * @description Service to handle authentication for the TestRunExecutor.
 */
export class AuthService {
  private clientId: string;
  private tenantId: string;
  private scopes: string[];
  private clientUrl: string;

  constructor(
    clientId: string,
    tenantId: string,
    scope: string,
    clientUrl: string
  ) {
    this.clientId = clientId;
    this.tenantId = tenantId;
    this.scopes = [scope];
    this.clientUrl = clientUrl;
  }

  /**
   * @function generateRandomString
   * @description Generates a random string of specified length using unbiased random selection.
   * @param length - Length of the random string.
   * @returns Random string.
   */
  private generateRandomString(length: number): string {
    const chars = CONFIG.AUTH.POSSIBLE_CHARS;
    const result = new Array(length);

    for (let i = 0; i < length; i++) {
      let randomByte;
      // Use rejection sampling to avoid modulo bias
      do {
        randomByte = crypto.getRandomValues(new Uint8Array(1))[0];
      } while (randomByte >= Math.floor(256 / chars.length) * chars.length);

      result[i] = chars[randomByte % chars.length];
    }

    return result.join("");
  }

  /**
   * @function generateCodeChallenge
   * @description Generates a code challenge from the code verifier.
   * @param codeVerifier - Code verifier.
   * @returns Code challenge.
   */
  private async generateCodeChallenge(codeVerifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(codeVerifier);
    const digest = await window.crypto.subtle.digest("SHA-256", data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  /**
   * @function validateAuthResponse
   * @description Validates the authentication response.
   * @param code authorization code.
   * @param state state.
   * @returns authorization code.
   */
  private async validateAuthResponse(
    code: string,
    state: string
  ): Promise<string | null> {
    const storedStateData = sessionStorage.getItem(CONFIG.AUTH.STATE_KEY);
    if (!storedStateData) {
      throw new Error("No stored state found");
    }

    const { state: storedState } = JSON.parse(storedStateData) as AuthState;

    if (!code || !state) {
      throw new Error("Authorization code or state missing from response");
    }

    if (state !== storedState) {
      throw new Error("State mismatch - possible CSRF attack");
    }

    return code;
  }

  /**
   * @function getAuthorizationCode
   * @description Retrieves the authorization code and code verifier.
   * @returns Authorization code and code verifier.
   */
  public async getAuthorizationCode(): Promise<AuthResponse> {
    return new Promise((resolve, reject) => {
      try {
        const state = this.generateRandomString(CONFIG.AUTH.STATE_LENGTH);
        const codeVerifier = this.generateRandomString(
          CONFIG.AUTH.CODE_VERIFIER_LENGTH
        );

        sessionStorage.setItem(
          CONFIG.AUTH.STATE_KEY,
          JSON.stringify({
            state,
            codeVerifier,
            timestamp: Date.now(),
          } as AuthState)
        );

        this.generateCodeChallenge(codeVerifier).then((codeChallenge) => {
          const params = new URLSearchParams({
            client_id: this.clientId,
            response_type: "code",
            redirect_uri: this.clientUrl,
            scope: this.scopes.join(" "),
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256",
            prompt: "login",
            response_mode: "fragment",
          });

          const authUrl = `https://login.microsoftonline.com/${
            this.tenantId
          }/oauth2/v2.0/authorize?${params.toString()}`;
          const { WIDTH, HEIGHT } = CONFIG.AUTH;
          const left = window.screen.width / 2 - WIDTH / 2;
          const top = window.screen.height / 2 - HEIGHT / 2;

          const authWindow = window.open(
            authUrl,
            "Login",
            `width=${WIDTH},height=${HEIGHT},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
          );

          if (!authWindow) {
            reject(
              new Error(
                "Popup window was blocked. Please allow popups for this site."
              )
            );
            return;
          }

          let pollTimer: number;
          const cleanup = () => {
            clearInterval(pollTimer);
            if (!authWindow.closed) {
              authWindow.close();
            }
          };

          pollTimer = window.setInterval(() => {
            try {
              if (authWindow.closed) {
                cleanup();
                resolve({ authCode: null, codeVerifier: null });
                return;
              }

              const currentUrl = authWindow.location.href;
              if (currentUrl.includes("#")) {
                cleanup();
                const fragment = new URLSearchParams(
                  authWindow.location.hash.substring(1)
                );
                const code = fragment.get("code");
                const returnedState = fragment.get("state");

                if (code && returnedState) {
                  this.validateAuthResponse(code, returnedState).then(
                    (validatedCode) => {
                      if (validatedCode) {
                        const storedData = sessionStorage.getItem(
                          CONFIG.AUTH.STATE_KEY
                        );
                        const { codeVerifier } = storedData
                          ? (JSON.parse(storedData) as AuthState)
                          : { codeVerifier: null };
                        resolve({ authCode: validatedCode, codeVerifier });
                      } else {
                        resolve({ authCode: null, codeVerifier: null });
                      }
                    }
                  );
                } else {
                  resolve({ authCode: null, codeVerifier: null });
                }
              }
            } catch (error) {
              if (
                !(error instanceof Error) ||
                !error.message.includes("cross-origin")
              ) {
                cleanup();
                reject(new Error(`Error polling auth window: ${error}`));
              }
            }
          }, CONFIG.AUTH.POLL_INTERVAL);

          setTimeout(() => {
            cleanup();
            resolve({ authCode: null, codeVerifier: null });
          }, CONFIG.AUTH.AUTH_TIMEOUT);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
