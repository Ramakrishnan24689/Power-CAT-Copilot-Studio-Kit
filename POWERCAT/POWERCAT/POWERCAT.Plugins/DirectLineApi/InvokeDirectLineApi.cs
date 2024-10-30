// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using System;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace POWERCAT.Plugins.DirectLineApi
{
    /// <summary>
    /// Plugin class to invoke direct line apis of Copilot Studio.
    /// </summary>
    public class InvokeDirectLineApi : IPlugin
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
                //Invokes direct line apis.
                InvokeDirectLineApiUsingMessage(context, tracingService);
            }
        }

        /// <summary>
        /// Invokes direct line apis based on message name.
        /// </summary>
        /// <param name="context">Plugin context.</param>
        /// <param name="tracingService">Plugin tracing service.</param>
        private void InvokeDirectLineApiUsingMessage(IPluginExecutionContext context, ITracingService tracingService)
        {
            string messageName = context.MessageName;
            try
            {
                #region variable declaration
                string botFrameworkUri = string.Empty;
                string token = string.Empty;
                string conversationId = string.Empty;
                string tokenResponse = string.Empty;
                #endregion
               
                //Invoke apis based on message name
                switch (messageName)
                {
                    case "cat_GenerateTokenFromSecret":
                        string secret = (string)context.InputParameters["cat_Secret"];
                        botFrameworkUri = (string)context.InputParameters["cat_BotFrameworkUri"];
                        tokenResponse = GenerateDirectLineTokenFromSecretAsync(secret, botFrameworkUri).Result;
                        break;
                    case "cat_GenerateTokenFromEndpoint":
                        string endpoint = (string)context.InputParameters["cat_Endpoint"];
                        tokenResponse = GenerateDirectLineTokenFromEndpointAsync(endpoint).Result;
                        break;
                    case "cat_InitiateConversation":
                        token = (string)context.InputParameters["cat_Token"];
                        botFrameworkUri = (string)context.InputParameters["cat_BotFrameworkUri"];
                        tokenResponse = InitiateConversationAsync(token, botFrameworkUri).Result;
                        break;
                    case "cat_SendMessageOrEvent":
                        token = (string)context.InputParameters["cat_Token"];
                        botFrameworkUri = (string)context.InputParameters["cat_BotFrameworkUri"];
                        conversationId = (string)context.InputParameters["cat_ConverationId"];
                        string body = (string)context.InputParameters["cat_Body"];
                        tokenResponse = SendMessageOrEventAsync(token, botFrameworkUri, conversationId, body).Result;
                        break;
                    case "cat_GetResponse":
                        token = (string)context.InputParameters["cat_Token"];
                        botFrameworkUri = (string)context.InputParameters["cat_BotFrameworkUri"];
                        conversationId = (string)context.InputParameters["cat_ConverationId"];
                        tokenResponse = GetResponseAsync(token, botFrameworkUri, conversationId).Result;
                        break;
                    default:
                        tracingService.Trace("The plug-in is not associated with the expected message.");
                        break;
                }

                context.OutputParameters["cat_Response"] = tokenResponse ?? "Null response found.";
            }
            catch (Exception ex)
            {
                tracingService.Trace("Message Name: {0}", ex.ToString());
                throw new InvalidPluginExecutionException($"An error occurred in {messageName}: {ex}");
            }
        }

        /// <summary>
        /// Generates the direct line token using secret asynchronously.
        /// </summary>
        /// <param name="secret">Secret.</param>
        /// <param name="botFrameworkUri">Bot Framework Uri.</param>
        /// <returns>The token response.</returns>
        private async Task<String> GenerateDirectLineTokenFromSecretAsync(string secret, string botFrameworkUri)
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", secret);
            HttpResponseMessage response = await _httpClient.PostAsync(botFrameworkUri + "/v3/directline/tokens/generate", null);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{await response.Content.ReadAsStringAsync()}";
        }

        /// <summary>
        /// Generates the direct line token using endpoint asynchronously.
        /// </summary>
        /// <param name="endpoint">Token endpoint.</param>
        /// <returns>The token response.</returns>
        private async Task<String> GenerateDirectLineTokenFromEndpointAsync(string endpoint)
        {
            HttpResponseMessage response = await _httpClient.GetAsync(endpoint);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{await response.Content.ReadAsStringAsync()}";
        }

        /// <summary>
        /// Initiates the conversation asynchronously.
        /// </summary>
        /// <param name="token">Token.</param>
        /// <param name="botFrameworkUri">Bot Framework Uri.</param>
        /// <returns>The token response.</returns>
        private async Task<String> InitiateConversationAsync(string token, string botFrameworkUri)
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            HttpResponseMessage response = await _httpClient.PostAsync(botFrameworkUri + "/v3/directline/conversations", null);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{await response.Content.ReadAsStringAsync()}";
        }

        /// <summary>
        /// Sends a message or event asynchronously.
        /// </summary>
        /// <param name="token">Token.</param>
        /// <param name="botFrameworkUri">Bot Framework Uri.</param>
        /// <param name="conversationId">Conversation Id.</param>
        /// <param name="body">Request body.</param>
        /// <returns>The token response.</returns>
        private async Task<String> SendMessageOrEventAsync(string token, string botFrameworkUri, string conversationId, string body)
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            StringContent content = new StringContent(body, Encoding.UTF8, "application/json");
            HttpResponseMessage response = await _httpClient.PostAsync(botFrameworkUri + "/v3/directline/conversations/" + conversationId + "/activities", content);
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{await response.Content.ReadAsStringAsync()}";
        }

        /// <summary>
        /// Gets the response asynchronously.
        /// </summary>
        /// <param name="token">Token.</param>
        /// <param name="botFrameworkUri">Bot Framework Uri.</param>
        /// <param name="conversationId">Conversation Id.</param>
        /// <returns>The token response.</returns>
        private async Task<String> GetResponseAsync(string token, string botFrameworkUri, string conversationId)
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
            HttpResponseMessage response = await _httpClient.GetAsync(botFrameworkUri + "/v3/directline/conversations/" + conversationId + "/activities");
            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadAsStringAsync();
            }
            return $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{await response.Content.ReadAsStringAsync()}";
        }
    }
}
