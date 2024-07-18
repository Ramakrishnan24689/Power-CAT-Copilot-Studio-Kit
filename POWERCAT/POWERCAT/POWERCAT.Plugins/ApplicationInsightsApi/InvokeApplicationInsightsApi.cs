// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
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

            // Set HttpClient instance
            _httpClient = new HttpClient();

            // Check the stage - Main operation
            if (context.Stage.Equals(30))
            {
                //Invokes Azure Application Insights apis.
                InvokeAppInsightsApiUsingMessage(context, tracingService);
            }
        }

        /// <summary>
        /// Invokes Azure Application Insights apis based on message name.
        /// </summary>
        /// <param name="context">Plugin context.</param>
        /// <param name="tracingService">Plugin tracing service.</param>
        private void InvokeAppInsightsApiUsingMessage(IPluginExecutionContext context, ITracingService tracingService)
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

            HttpResponseMessage response = await _httpClient.PostAsync("https://api.applicationinsights.io/v1/apps/" + applicationId + "/query?timespan=PT1H", content);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{await response.Content.ReadAsStringAsync()}";
        }
    }
}
