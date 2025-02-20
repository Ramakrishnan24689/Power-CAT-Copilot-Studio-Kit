/**
 * Type definitions for the TestRunExecutor service
 */
export interface AuthState {
  state: string;
  codeVerifier: string;
  timestamp: number;
}

export interface AuthResponse {
  authCode: string | null;
  codeVerifier: string | null;
}

export interface CopilotConfiguration {
  cat_clientid: string;
  cat_tenantid: string;
  cat_userauthenticationcode: number;
  cat_scope: string;
}

export interface ActionMetadata {
  boundParameter: string;
  parameterTypes: {
    [key: string]: {
      typeName: string;
      structuralProperty: number;
    };
  };
  operationType: number;
  operationName: string;
}

export interface ActionExecutionRequest {
  entity: {
    entityType: string;
    id: string | null;
  };
  AuthCode: string | null;
  CodeVerifier: string | null;
  CopilotConfigurationId: string;
  CopilotTestRunId: string | null;
  CopilotTestSetId: string;
  getMetadata(): ActionMetadata;
}
