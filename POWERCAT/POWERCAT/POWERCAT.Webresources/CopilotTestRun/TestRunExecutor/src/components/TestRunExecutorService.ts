import { AuthService } from "./AuthService";
import { CONFIG } from "./Config";
import type { ActionExecutionRequest, CopilotConfiguration } from "./Types";

/**
 * @class TestRunExecutorService
 * @description Service to handle bot authentication and invoke action for test run execution.
 */
export class TestRunExecutorService {
  private formContext: Xrm.FormContext;
  private authService: AuthService;

  /**
   * @constructor
   * @param {string} clientId - The client ID of the Azure AD application.
   * @param {string} tenantId - The tenant ID of the Azure AD application.
   * @param {string} scope - The scope for the authentication.
   * @param {string} clientUrl - The URL of the client.
   * @param {Xrm.FormContext} formContext - The form context of the CRM form.
   */
  constructor(
    clientId: string,
    tenantId: string,
    scope: string,
    clientUrl: string,
    formContext: Xrm.FormContext
  ) {
    this.formContext = formContext;
    this.authService = new AuthService(clientId, tenantId, scope, clientUrl);
  }

  /**
   * @function waitForRecordId
   * @description Retrieves the record id with some delay.
   * @param maxWaitTime - Maximum wait time.
   * @param checkInterval - Check interval.
   * @returns Record Id.
   */
  private async waitForRecordId(
    maxWaitTime: number = CONFIG.RECORD.MAX_WAIT_TIME,
    checkInterval: number = CONFIG.RECORD.CHECK_INTERVAL
  ): Promise<string | null> {
    let recordId = this.formContext.data.entity.getId();
    let attempts = 0;
    const maxAttempts = maxWaitTime / checkInterval;

    while (!recordId && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      recordId = this.formContext.data.entity.getId();
      attempts++;
    }
    return recordId ? recordId.replace(/[{},]/g, "") : null;
  }

  /**
   * @function removeNotification
   * @description remove notification from form.
   * @uniqueId unique id for notification.
   */
  private removeNotification(uniqueId: string): void {
    setTimeout(() => {
      this.formContext.ui.clearFormNotification(uniqueId);
    }, 12000);
  }

  /**
   * @function invokeDataverseAction
   * @description Invokes the Dataverse action.
   * @param copilotConfigurationId The Copilot configuration ID.
   * @param authCode The authorization code.
   * @param codeVerifier The code verifier.
   * @param testRunWarningMessage The warning message for the test run.
   */
  private async invokeDataverseAction(
    copilotConfigurationId: string,
    authCode: string | null,
    codeVerifier: string | null,
    testRunWarningMessage: string | null
  ): Promise<void> {
    try {
      const copilotTestSetId = this.formContext
        .getAttribute("cat_copilottestsetid")
        .getValue()[0]
        .id.replace(/[{},]/g, "");

      const copilotTestRun = {
        entityType: this.formContext.data.entity.getEntityName(),
        id: await this.waitForRecordId(),
      };

      const actionExecutionRequest: ActionExecutionRequest = {
        entity: copilotTestRun,
        AuthCode: authCode,
        CodeVerifier: codeVerifier,
        CopilotConfigurationId: copilotConfigurationId,
        CopilotTestRunId: copilotTestRun.id,
        CopilotTestSetId: copilotTestSetId,
        getMetadata: () => ({
          boundParameter: "entity",
          parameterTypes: {
            entity: {
              typeName: "mscrm.cat_copilottestrun",
              structuralProperty: 5,
            },
            AuthCode: {
              typeName: "Edm.String",
              structuralProperty: 1,
            },
            CodeVerifier: {
              typeName: "Edm.String",
              structuralProperty: 1,
            },
            CopilotConfigurationId: {
              typeName: "Edm.String",
              structuralProperty: 1,
            },
            CopilotTestRunId: {
              typeName: "Edm.String",
              structuralProperty: 1,
            },
            CopilotTestSetId: {
              typeName: "Edm.String",
              structuralProperty: 1,
            },
          },
          operationType: 0,
          operationName: "cat_RunCopilotTests",
        }),
      };

      const result = await Xrm.WebApi.online.execute(actionExecutionRequest);
      if (result.ok) {
        const { PROGRESS, WARNING } = CONFIG.NOTIFICATIONS;
        this.formContext.ui.setFormNotification(
          PROGRESS.message,
          PROGRESS.type,
          PROGRESS.id
        );
        this.removeNotification(PROGRESS.id);

        if (testRunWarningMessage) {
          this.formContext.ui.setFormNotification(
            testRunWarningMessage,
            WARNING.type,
            WARNING.id
          );
          this.removeNotification(WARNING.id);
        }
      } else {
        throw new Error("Failed to execute the action.");
      }
    } catch (error) {
      throw new Error(
        `Failed to execute the action. Error Message: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * @function executeTestWithMicrosoftAuth
   * @description Opens the Agent Test Runner custom page for executing tests with Microsoft authentication.
   */
  private async executeTestWithMicrosoftAuth(): Promise<void> {
    try {
      // Wait for record ID to be available
      const recordId = await this.waitForRecordId();

      if (!recordId) {
        throw new Error("Unable to get record ID");
      }

      // Open custom page on the right side with full height
      const pageInput = {
        pageType: "custom",
        name: "cat_agenttestrunner_18503",
        entityName: this.formContext.data.entity.getEntityName(),
        recordId: recordId,
      };

      const navigationOptions = {
        target: 2, // Opens in dialog
        position: 2, // Opens on the far side (right side)
        height: { value: 100, unit: "%" }, // Full height
        width: { value: 45, unit: "%" }, // 40% width for side panel
        title: "Agent Test Runner",
      };

      await (Xrm.Navigation as any)
        .navigateTo(pageInput, navigationOptions)
        .then(() => {
          this.formContext.data.refresh(true);
        });
    } catch (error) {
      this.formContext.ui.setFormNotification(
        "Error opening Agent Test Runner page: " +
          (error instanceof Error ? error.message : "Unknown error"),
        "ERROR",
        "AGENT_TEST_RUNNER_ERROR"
      );
      setTimeout(() => {
        this.formContext.ui.clearFormNotification("AGENT_TEST_RUNNER_ERROR");
      }, 8000);
      throw error; // Re-throw to let the caller handle it
    }
  }

  /**
   * @function onSave
   * @description Handler for the OnSave event of the form.
   * @param executionContext - Dynamics 365 event context.
   */
  public static async onSave(
    executionContext: Xrm.Events.EventContext
  ): Promise<void> {
    if (!executionContext) return;

    const formContext = executionContext.getFormContext();
    // Run only on create form
    if (formContext.ui.getFormType() !== 1) {
      return;
    }

    try {
      const globalContext = Xrm.Utility.getGlobalContext();
      const clientUrl = globalContext.getClientUrl();

      // Retrieve the parent Copilot configuration record
      const copilotConfigId = formContext
        .getAttribute("cat_copilotconfigurationid")
        .getValue()[0]
        .id.replace(/[{},]/g, "");
      const copilotConfig = (await Xrm.WebApi.retrieveRecord(
        "cat_copilotconfiguration",
        copilotConfigId,
        "?$select=cat_clientid,cat_tenantid,cat_userauthenticationcode,cat_scope"
      )) as CopilotConfiguration;

      const service = new TestRunExecutorService(
        copilotConfig.cat_clientid,
        copilotConfig.cat_tenantid,
        copilotConfig.cat_scope,
        clientUrl,
        formContext
      );

      let authData: { authCode: string | null; codeVerifier: string | null } = {
        authCode: null,
        codeVerifier: null,
      };
      let testRunWarningMessage = "";

      // Run only if end-user authentication is enabled
      if (
        copilotConfig.cat_userauthenticationcode ===
        CONFIG.USER_AUTHENTICATION.ENTRA_ID_V2
      ) {
        authData = await service.authService.getAuthorizationCode();
        if (!authData.authCode || !authData.codeVerifier) {
          throw new Error(
            "Failed to obtain authorization code or code verifier"
          );
        }
        testRunWarningMessage =
          "This agent configuration is configured with end-user authentication, which relies on Entra ID tokens with a limited lifetime. Consider splitting your test set if it takes longer than an hour to complete.";
      }

      const userAuthCode = copilotConfig.cat_userauthenticationcode;

      // Define authentication types that use Dataverse action
      const dataverseActionAuthTypes = [
        CONFIG.USER_AUTHENTICATION.ENTRA_ID_V2,
        CONFIG.USER_AUTHENTICATION.NO_AUTH,
      ];

      // Handle different authentication types
      if (dataverseActionAuthTypes.indexOf(userAuthCode) !== -1) {
        await service.invokeDataverseAction(
          copilotConfigId,
          authData.authCode,
          authData.codeVerifier,
          testRunWarningMessage
        );
      } else if (
        userAuthCode === CONFIG.USER_AUTHENTICATION.MICROSOFT_AUTHENTICATION
      ) {
        await service.executeTestWithMicrosoftAuth();
      } else {
        // Handle unsupported authentication types
        throw new Error(
          `Unsupported authentication type: ${userAuthCode}. Please check the Agent Configuration.`
        );
      }
    } catch (error) {
      const { ERROR } = CONFIG.NOTIFICATIONS;
      formContext.ui.setFormNotification(
        `An error occurred while running the test. Please check the Agent Configuration. ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        ERROR.type,
        ERROR.id
      );
      TestRunExecutorService.prototype.removeNotification(ERROR.id);
    }
  }
}

// Expose the class to the global scope
(window as any).onSave = TestRunExecutorService.onSave;
