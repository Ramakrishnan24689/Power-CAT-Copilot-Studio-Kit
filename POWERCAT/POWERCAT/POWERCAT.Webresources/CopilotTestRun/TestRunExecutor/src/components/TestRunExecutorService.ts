import {
  PublicClientApplication,
  Configuration,
  AuthenticationResult,
} from "@azure/msal-browser";

/**
 * @class TestRunExecutorService
 * @description Service to handle bot authentication and invoke action for test run execution.
 */
class TestRunExecutorService {
  private publicClientApplication: PublicClientApplication;
  private formContext: Xrm.FormContext;

  /**
   * @constructor
   * @param clientId - Client ID for Azure application.
   * @param tenantId - Tenant ID for Azure application.
   * @param clientUrl - URL of the client application.
   * @param formContext - Form context.
   */
  constructor(
    clientId: string,
    tenantId: string,
    clientUrl: string,
    formContext: Xrm.FormContext
  ) {
    const msalConfig: Configuration = {
      auth: {
        clientId: clientId,
        authority: `https://login.microsoftonline.com/${tenantId}`,
        redirectUri: clientUrl,
      },
      cache: {
        cacheLocation: "memoryStorage",
      },
    };
    this.publicClientApplication = new PublicClientApplication(msalConfig);
    this.formContext = formContext;
  }

  /**
   * @function getAccessTokenByMSAL
   * @description Retrieves an access token using MSAL.
   * @param globalContext - Dynamics 365 global context.
   * @param scope - Scope for the access token.
   * @returns Access token.
   */
  async getAccessTokenByMSAL(
    globalContext: any,
    scope: string
  ): Promise<string> {
    try {
      // Get the current user's email ID
      const emailID: string = await this.getCurrentUserEmailID(globalContext);

      const ssoRequest: { scopes: string[]; loginHint?: string } = {
        scopes: [scope],
        loginHint: emailID,
      };

      // Initialize the MSAL application
      await this.publicClientApplication.initialize();

      // Get the access token using SSO silent flow
      const authResult: AuthenticationResult =
        await this.publicClientApplication.ssoSilent(ssoRequest);

      if (!authResult || !authResult.accessToken) {
        throw new Error("Failed to authenticate user.");
      }
      return authResult.accessToken;
    } catch (error) {
      throw new Error(
        "Failed to authenticate user. Error Message: " + error.message
      );
    }
  }

  /**
   * @function getCurrentUserEmailID
   * @description Retrieves the logged in user's email ID.
   * @param globalContext - Dynamics 365 global context.
   * @returns User's email ID.
   */
  async getCurrentUserEmailID(globalContext: any): Promise<string> {
    try {
      const user = await Xrm.WebApi.retrieveRecord(
        "systemuser",
        globalContext.userSettings.userId,
        "?$select=domainname"
      );
      return user.domainname;
    } catch (error) {
      throw new Error(
        "Failed to retrieve user email address. Error Message: " + error.message
      );
    }
  }

  /**
   * @function waitForRecordId
   * @description Retrieves the record id with some delay.
   * @param maxWaitTime - Maximum wait time.
   * @param checkInterval - Check interval.
   * @returns Record Id.
   */
  private async waitForRecordId(
    maxWaitTime: number = 7000,
    checkInterval: number = 200
  ): Promise<string | null> {
    let recordId = this.formContext.data.entity.getId();
    let attempts = 0;
    const maxAttempts = maxWaitTime / checkInterval;

    while (!recordId && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      recordId = this.formContext.data.entity.getId();
      attempts++;
    }

    if (!recordId) {
      return null;
    }
    return recordId.replace(/[{},]/g, "");
  }

  /**
   * Invokes the Dataverse action.
   * @param copilotConfigurationId The Copilot configuration ID.
   * @param accessToken The access token.
   */
  private async invokeDataverseAction(
    copilotConfigurationId: string,
    accessToken: string | null,
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

      const actionExecutionRequest = {
        entity: copilotTestRun,
        AccessToken: accessToken,
        CopilotTestRunId: copilotTestRun.id,
        CopilotTestSetId: copilotTestSetId,
        CopilotConfigurationId: copilotConfigurationId,
        getMetadata: function () {
          return {
            boundParameter: "entity",
            parameterTypes: {
              entity: {
                typeName: "mscrm.cat_copilottestrun",
                structuralProperty: 5,
              },
              AccessToken: {
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
              CopilotConfigurationId: {
                typeName: "Edm.String",
                structuralProperty: 1,
              },
            },
            operationType: 0,
            operationName: "cat_RunCopilotTests",
          };
        },
      };

      const result = await Xrm.WebApi.online.execute(actionExecutionRequest);
      if (result.ok) {
        this.formContext.ui.setFormNotification(
          "Test Run execution is in progress.",
          "INFO",
          "TESTRUN_ACTION_NOTIFICATION"
        );
        this.removeNotification("TESTRUN_ACTION_NOTIFICATION");
        if (testRunWarningMessage !== null) {
          this.formContext.ui.setFormNotification(
            testRunWarningMessage,
            "WARNING",
            "TESTRUN_WARNING_NOTIFICATION"
          );
          this.removeNotification("TESTRUN_WARNING_NOTIFICATION");
        }
      } else {
        throw new Error("Failed to execute the action.");
      }
    } catch (error) {
      throw new Error(
        "Failed to execute the action. Error Message: " + error.message
      );
    }
  }

  /**
   * @function removeNotification remove notification from form.
   * @uniqueId unique id for notification.
   */
  private removeNotification(uniqueId: string) {
    setTimeout(() => {
      this.formContext.ui.clearFormNotification(uniqueId);
    }, 12000);
  }

  /**
   * @function onSave
   * @description Handler for the OnSave event of the form.
   * @param executionContext - Dynamics 365 event context.
   */
  static async onSave(executionContext: Xrm.Events.EventContext) {
    const formContext = executionContext.getFormContext();
    let accessToken = null;
    let testRunExecutorService: TestRunExecutorService;
    let testRunWarningMessage: string = null;

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
      const copilotConfig = await Xrm.WebApi.retrieveRecord(
        "cat_copilotconfiguration",
        copilotConfigId,
        "?$select=cat_clientid,cat_tenantid,cat_userauthenticationcode,cat_scope"
      );

      testRunExecutorService = new TestRunExecutorService(
        copilotConfig.cat_clientid,
        copilotConfig.cat_tenantid,
        clientUrl,
        formContext
      );
      // Run only if end-user authentication is enabled
      if (copilotConfig.cat_userauthenticationcode === 2) {
        accessToken = await testRunExecutorService.getAccessTokenByMSAL(
          globalContext,
          copilotConfig.cat_scope
        );
        testRunWarningMessage =
          "This agent configuration is configured with end-user authentication, which relies on Entra ID tokens with a limited lifetime. Consider splitting your test set if it takes longer than an hour to complete.";
      }

      await testRunExecutorService.invokeDataverseAction(
        copilotConfigId,
        accessToken,
        testRunWarningMessage
      );
    } catch (error) {
      formContext.ui.setFormNotification(
        "An error occurred while running the test. " + error.message,
        "ERROR",
        "TESTRUN_ONSAVE_NOTIFICATION"
      );
      testRunExecutorService.removeNotification("TESTRUN_ONSAVE_NOTIFICATION");
    }
  }
}

// Expose the class to the global scope
(window as any).TestRunExecutorService = TestRunExecutorService;
