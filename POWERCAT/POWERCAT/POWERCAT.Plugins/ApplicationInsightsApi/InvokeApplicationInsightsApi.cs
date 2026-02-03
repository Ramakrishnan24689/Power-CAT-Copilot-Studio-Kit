// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.Tasks;

namespace POWERCAT.Plugins.ApplicationInsightsApi
{
    /// <summary>
    /// Plugin class to invoke Azure Application Insights apis.
    /// </summary>
    public class InvokeApplicationInsightsApi : IPlugin
    {
        /// <summary>
        /// Represents a private instance of the HttpClient class.
        /// </summary>
        private HttpClient _httpClient;

        /// <summary>
        /// Executes the plugin logic.
        /// </summary>
        /// <param name="serviceProvider">The service provider.</param>
        public void Execute(IServiceProvider serviceProvider)
        {
            // Obtain the tracing service
            ITracingService tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            // Obtain the execution context from the service provider.  
            IPluginExecutionContext context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            IOrganizationServiceFactory serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            IOrganizationService service = serviceFactory.CreateOrganizationService(context.UserId);

            // Set HttpClient instance
            _httpClient = new HttpClient();

            // Check the stage - Main operation
            if (context.Stage.Equals(30))
            {
                //Invokes Azure Application Insights apis.
                InvokeAppInsightsApiUsingMessage(context, tracingService, service);
            }
        }

        /// <summary>
        /// Invokes Azure Application Insights apis based on message name.
        /// </summary>
        /// <param name="context">Plugin context.</param>
        /// <param name="tracingService">Plugin tracing service.</param>
        /// <param name="service">Organization service.</param>
        private void InvokeAppInsightsApiUsingMessage(IPluginExecutionContext context, ITracingService tracingService, IOrganizationService service)
        {
            #region variable declaration
            string messageName = context.MessageName;
            string response = string.Empty;
            #endregion

            try
            {
                //Invoke apis based on message name
                switch (messageName)
                {
                    case "cat_GenerateAppInsightsAccessToken":
                        string tenantId = (string)context.InputParameters["cat_AppInsightsTenantId"];
                        string clientId = (string)context.InputParameters["cat_AppInsightsClientId"];
                        string clientSecret = (string)context.InputParameters["cat_AppInsightsClientSecret"];
                        response = GenerateAppInsightsAccessTokenAsync(tenantId, clientId, clientSecret).Result;                        
                        break;
                    case "cat_ExecuteAppInsightsQuery":
                        string applicationId = (string)context.InputParameters["cat_AppInsightsApplicationId"];
                        string accessToken = (string)context.InputParameters["cat_AppInsightsAccessToken"];
                        string query = (string)context.InputParameters["cat_AppInsightsQuery"];
                        response = ExecuteAppInsightsQueryAsync(applicationId, accessToken, query).Result;
                        break;
                    case "cat_ExecuteAppInsightsQueryWithConfig":
                        string copilotConfigId = (string)context.InputParameters["cat_CopilotConfigurationId"];
                        string insightsQuery = (string)context.InputParameters["cat_AppInsightsQuery"];
                        response = ExecuteAppInsightsQueryWithConfigAsync(copilotConfigId, insightsQuery, service, tracingService).Result;
                        break;
                    default:
                        tracingService.Trace("The plug-in is not associated with the expected message.");
                        break;
                }

                context.OutputParameters["cat_AppInsightsResponse"] = response ?? "Null response found.";
            }
            catch (Exception ex)
            {
                tracingService.Trace("Message Name: {0}", ex.ToString());
                throw new InvalidPluginExecutionException($"An error occurred in {messageName}: {ex}");
            }
        }

        /// <summary>
        /// Executes Azure Application Insights query using configuration from Copilot Configuration record.
        /// Handles all steps: retrieving config, resolving secret, generating token, and executing query.
        /// </summary>
        /// <param name="copilotConfigId">Copilot Configuration record Id.</param>
        /// <param name="query">Kusto query to execute.</param>
        /// <param name="service">Organization service.</param>
        /// <param name="tracingService">Tracing service.</param>
        /// <returns>The query response.</returns>
        private async Task<string> ExecuteAppInsightsQueryWithConfigAsync(string copilotConfigId, string query, IOrganizationService service, ITracingService tracingService)
        {
            // Step 1: Get agent configuration details
            tracingService.Trace("Step 1: Retrieving agent configuration...");
            ColumnSet columns = new ColumnSet(
                "cat_azureappinsightsapplicationid",
                "cat_azureappinsightsclientid",
                "cat_azureappinsightstenantid",
                "cat_azureappinsightssecretlocationcode",
                "cat_azureappinsightssecret",
                "cat_azureappinsightsenvironmentvariable"
            );

            Entity agentConfigRecord = service.Retrieve("cat_copilotconfiguration", new Guid(copilotConfigId), columns);

            if (agentConfigRecord == null)
            {
                throw new InvalidPluginExecutionException("Failed to retrieve Agent configuration record.");
            }

            string applicationId = agentConfigRecord.GetAttributeValue<string>("cat_azureappinsightsapplicationid");
            string clientId = agentConfigRecord.GetAttributeValue<string>("cat_azureappinsightsclientid");
            string tenantId = agentConfigRecord.GetAttributeValue<string>("cat_azureappinsightstenantid");

            if (string.IsNullOrEmpty(applicationId) || string.IsNullOrEmpty(clientId) || string.IsNullOrEmpty(tenantId))
            {
                throw new InvalidPluginExecutionException("Missing required Azure Application Insights configuration (ApplicationId, ClientId, or TenantId).");
            }

            // Step 2: Get secret based on location (Dataverse or KeyVault via Environment Variable)
            tracingService.Trace("Step 2: Resolving client secret...");
            string clientSecret = GetAppInsightsClientSecret(agentConfigRecord, service, tracingService);

            if (string.IsNullOrEmpty(clientSecret))
            {
                throw new InvalidPluginExecutionException("Failed to retrieve Azure Application Insights client secret.");
            }

            // Step 3: Generate access token
            tracingService.Trace("Step 3: Generating access token...");
            string tokenResponse = await GenerateAppInsightsAccessTokenAsync(tenantId, clientId, clientSecret);

            if (tokenResponse.StartsWith("Error:"))
            {
                throw new InvalidPluginExecutionException($"Token generation failed: {tokenResponse}");
            }

            // Step 4: Parse the token response to extract access_token
            tracingService.Trace("Step 4: Parsing token response...");
            AppInsightsTokenResponse tokenData = JsonConvert.DeserializeObject<AppInsightsTokenResponse>(tokenResponse);

            if (tokenData == null || string.IsNullOrEmpty(tokenData.access_token))
            {
                throw new InvalidPluginExecutionException("Failed to parse access token from response.");
            }

            // Step 5: Execute the Application Insights query
            tracingService.Trace("Step 5: Executing Application Insights query...");
            string queryResponse = await ExecuteAppInsightsQueryAsync(applicationId, tokenData.access_token, query);

            if (queryResponse.StartsWith("Error:"))
            {
                throw new InvalidPluginExecutionException($"Application Insights query failed: {queryResponse}");
            }

            return queryResponse;
        }

        /// <summary>
        /// Retrieves the Azure Application Insights client secret based on the secret location code.
        /// </summary>
        /// <param name="agentConfigRecord">The agent configuration record.</param>
        /// <param name="service">The organization service instance.</param>
        /// <param name="tracingService">The tracing service.</param>
        /// <returns>The client secret.</returns>
        private string GetAppInsightsClientSecret(Entity agentConfigRecord, IOrganizationService service, ITracingService tracingService)
        {
            // Get the secret location code as an OptionSetValue
            OptionSetValue secretLocationCode = agentConfigRecord.GetAttributeValue<OptionSetValue>("cat_azureappinsightssecretlocationcode");
            string clientSecret = string.Empty;

            // Check if the OptionSetValue is not null
            // Value 2 = KeyVault (Environment Variable), Value 1 = Dataverse
            if (secretLocationCode != null && secretLocationCode.Value == 2)
            {
                // Get secret from KeyVault via Environment Variable
                string environmentVariableName = agentConfigRecord.GetAttributeValue<string>("cat_azureappinsightsenvironmentvariable");

                if (!string.IsNullOrEmpty(environmentVariableName))
                {
                    try
                    {
                        OrganizationRequest actionRequest = new OrganizationRequest("RetrieveEnvironmentVariableSecretValue");
                        actionRequest["EnvironmentVariableName"] = environmentVariableName;
                        OrganizationResponse response = service.Execute(actionRequest);

                        if (response.Results.Contains("EnvironmentVariableSecretValue"))
                        {
                            clientSecret = (string)response.Results["EnvironmentVariableSecretValue"];
                        }
                    }
                    catch (Exception ex)
                    {
                        tracingService.Trace($"Error retrieving secret from Environment Variable: {ex.Message}");
                        throw new InvalidPluginExecutionException("Error retrieving secret from Environment Variable: " + ex.Message);
                    }
                }
            }
            else
            {
                // Get secret directly from Dataverse field
                clientSecret = agentConfigRecord.GetAttributeValue<string>("cat_azureappinsightssecret");
            }

            return clientSecret;
        }

        /// <summary>
        /// Generates the access token using Microsoft Entra authentication asynchronously.
        /// </summary>
        /// <param name="tenantId">Tenant Id.</param>
        /// <param name="clientId">Azure Application Client Id.</param>
        /// <param name="clientSecret">Azure Application Client Secret.</param>
        /// <returns>The api response with access token.</returns>
        private async Task<String> GenerateAppInsightsAccessTokenAsync(string tenantId, string clientId, string clientSecret)
        {
            string body = $"grant_type=client_credentials&client_id={clientId}&resource=https://api.loganalytics.io&client_secret={clientSecret}";
            HttpContent content = new StringContent(body, Encoding.UTF8, "application/x-www-form-urlencoded");
            HttpResponseMessage response = await _httpClient.PostAsync("https://login.microsoftonline.com/" + tenantId + "/oauth2/token", content);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{await response.Content.ReadAsStringAsync()}";
        }

        /// <summary>
        /// Executes Azure Application Insights query asynchronously.
        /// </summary>
        /// <param name="applicationId">Azure Application Insights Application Id.</param>
        /// <param name="accessToken">Access Token.</param>
        /// <param name="query">Kusto query.</param>
        /// <returns>The query response.</returns>
        private async Task<String> ExecuteAppInsightsQueryAsync(string applicationId, string accessToken, string query)
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            
            // Escape the query string for JSON
            string escapedQuery = query.Replace("\n", "\\n").Replace("\r", "\\r").Replace("\"", "\\\"");
            // Generate api body 
            string body = $"{{ \"query\": \"{escapedQuery}\" }}";
            StringContent content = new StringContent(body, Encoding.UTF8, "application/json");

            HttpResponseMessage response = await _httpClient.PostAsync("https://api.applicationinsights.io/v1/apps/" + applicationId + "/query", content);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{await response.Content.ReadAsStringAsync()}";
        }
    }
}
