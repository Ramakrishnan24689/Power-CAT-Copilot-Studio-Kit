// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using POWERCAT.Plugins.ConversationKpi;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Authentication;
using System.Text;
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
            IOrganizationServiceFactory serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            IOrganizationService service = serviceFactory.CreateOrganizationService(context.UserId);

            // Set HttpClient instance
            _httpClient = new HttpClient();

            // Check the stage - Main operation
            if (context.Stage.Equals(30))
            {
                //Invokes direct line apis.
                InvokeDirectLineApiUsingMessage(context, tracingService, service);
            }
        }

        /// <summary>
        /// Invokes direct line apis based on message name.
        /// </summary>
        /// <param name="context">Plugin context.</param>
        /// <param name="tracingService">Plugin tracing service.</param>
        private void InvokeDirectLineApiUsingMessage(IPluginExecutionContext context, ITracingService tracingService, IOrganizationService service)
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
                    case "cat_AuthenticateEndUser":
                        var requiredParams = new[] {
                            "cat_Token", "cat_BotFrameworkUri", "cat_ConverationId", "cat_AuthCode",
                            "cat_CodeVerifier", "cat_Id", "cat_ConnectionName", "cat_MessageId",
                            "cat_ClientUrl"
                        };
                        if (!ValidateRequiredParameters(context.InputParameters, requiredParams))
                        {
                            throw new InvalidPluginExecutionException("Missing required parameters");
                        }

                        token = (string)context.InputParameters["cat_Token"];
                        botFrameworkUri = (string)context.InputParameters["cat_BotFrameworkUri"];
                        conversationId = (string)context.InputParameters["cat_ConverationId"];
                        string authCode = (string)context.InputParameters["cat_AuthCode"];
                        string codeVerifier = (string)context.InputParameters["cat_CodeVerifier"];
                        string id = (string)context.InputParameters["cat_Id"];
                        string connectionName = (string)context.InputParameters["cat_ConnectionName"];
                        string messageId = (string)context.InputParameters["cat_MessageId"];
                        string agentConfigId = (string)context.InputParameters["cat_AgentConfigId"];
                        string clientUrl = (string)context.InputParameters["cat_ClientUrl"];

                        tokenResponse = AuthenticateEndUser(token, botFrameworkUri, conversationId, authCode,
                            codeVerifier, id, connectionName, messageId, agentConfigId, clientUrl, service).Result;
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

        /// <summary>
        /// Validates that all required parameters are present in the parameter collection.
        /// </summary>
        /// <param name="parameters">The collection of parameters to validate.</param>
        /// <param name="requiredParams">Array of required parameter names.</param>
        /// <returns>True if all required parameters are present and non-empty; otherwise, false.</returns>
        private bool ValidateRequiredParameters(ParameterCollection parameters, string[] requiredParams)
        {
            foreach (var param in requiredParams)
            {
                if (!parameters.Contains(param) || string.IsNullOrEmpty(parameters[param] as string))
                {
                    return false;
                }
            }
            return true;
        }

        /// <summary>
        /// Authenticates the end user using authorization code.
        /// </summary>
        /// <param name="token">The bearer direct line token for authentication.</param>
        /// <param name="botFrameworkUri">The base URI for the Bot Framework service.</param>
        /// <param name="conversationId">The unique identifier for the conversation.</param>
        /// <param name="authCode">The authorization code received from the authentication process.</param>
        /// <param name="codeVerifier">The code verifier used in the PKCE authentication flow.</param>
        /// <param name="id">The unique identifier for the authentication request.</param>
        /// <param name="connectionName">The name of the OAuth connection.</param>
        /// <param name="messageId">The unique identifier for the message.</param>
        /// <param name="agentConfigId">The unique identifier for the agent configuration.</param>
        /// <param name="clientUrl">The redirect URI for the OAuth flow.</param>
        /// <param name="service">The organization service instance.</param>
        /// <returns>A task that represents the asynchronous operation. The task result contains the response from the authentication process.</returns>
        private async Task<string> AuthenticateEndUser(string token, string botFrameworkUri, string conversationId, string authCode, string codeVerifier, string id,
            string connectionName, string messageId, string agentConfigId, string clientUrl,
            IOrganizationService service)
        {
            // Get agent configuration
            ColumnSet columns = new ColumnSet("cat_clientid", "cat_clientsecret", "cat_tenantid");
            Entity agentConfigRecord = service.Retrieve("cat_copilotconfiguration", new Guid(agentConfigId), columns);

            if (agentConfigRecord == null)
            {
                return "Failed to get Agent configuration record";
            }

            string clientId = agentConfigRecord.GetAttributeValue<string>("cat_clientid");
            string clientSecret = agentConfigRecord.GetAttributeValue<string>("cat_clientsecret");
            string tenantId = agentConfigRecord.GetAttributeValue<string>("cat_tenantid");

            // Exchange auth code for token
            using (var client = new HttpClient())
            {
                try
                {
                    // Get access token
                    var tokenResponse = await GetTokenAsync(client, authCode, codeVerifier, clientUrl,clientId, clientSecret, tenantId);

                    // Authenticate with bot
                    return await AuthenticateWithBotAsync(client, token, botFrameworkUri, conversationId,id, connectionName, messageId, tokenResponse.access_token);
                }
                catch (Exception ex)
                {
                    return $"Error: {ex.Message}";
                }
            }
        }

        /// <summary>
        /// Exchanges the authorization code for an access token.
        /// </summary>
        /// <param name="client">The HTTP client instance.</param>
        /// <param name="authCode">The authorization code to exchange.</param>
        /// <param name="codeVerifier">The code verifier used in the PKCE flow.</param>
        /// <param name="clientUrl">The redirect URI for the OAuth flow.</param>
        /// <param name="clientId">The client ID for the application.</param>
        /// <param name="clientSecret">The client secret for the application.</param>
        /// <param name="tenantId">The Azure AD tenant ID.</param>
        /// <returns>A task that represents the asynchronous operation. The task result contains the token response.</returns>
        private async Task<TokenResponse> GetTokenAsync(HttpClient client, string authCode,
            string codeVerifier, string clientUrl, string clientId, string clientSecret, string tenantId)
        {
            var postData = new Dictionary<string, string>
            {
                ["client_id"] = clientId,
                ["client_secret"] = clientSecret,
                ["code"] = authCode,
                ["code_verifier"] = codeVerifier,
                ["redirect_uri"] = clientUrl,
                ["grant_type"] = "authorization_code"
            };

            var content = new FormUrlEncodedContent(postData);
            var response = await client.PostAsync(
                $"https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token", content);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                throw new InvalidPluginExecutionException(
                    $"Token exchange failed. Status: {response.StatusCode}, Response: {responseContent}");
            }

            return JsonConvert.DeserializeObject<TokenResponse>(responseContent)
                ?? throw new InvalidPluginExecutionException("Deserialized token response is null.");
        }

        /// <summary>
        /// Authenticates with the bot using the obtained access token.
        /// </summary>
        /// <param name="client">The HTTP client instance.</param>
        /// <param name="token">The bearer token for authentication.</param>
        /// <param name="botFrameworkUri">The base URI for the Bot Framework service.</param>
        /// <param name="conversationId">The unique identifier for the conversation.</param>
        /// <param name="id">The unique identifier for the authentication request.</param>
        /// <param name="connectionName">The name of the OAuth connection.</param>
        /// <param name="messageId">The unique identifier for the message.</param>
        /// <param name="accessToken">The access token obtained from the token exchange.</param>
        /// <returns>A task that represents the asynchronous operation. The task result contains the bot's response.</returns>
        private async Task<string> AuthenticateWithBotAsync(HttpClient client, string token,
            string botFrameworkUri, string conversationId, string id, string connectionName, string messageId, string accessToken)
        {
            var requestBody = new
            {
                type = "invoke",
                name = "signin/tokenExchange",
                value = new
                {
                    id,
                    connectionName,
                    token = accessToken
                },
                from = new
                {
                    id = messageId,
                    role = "user",
                    name = "CopilotStudioKit"
                }
            };
            
            string body = JsonConvert.SerializeObject(requestBody);
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            var encodedBody = new StringContent(body, Encoding.UTF8, "application/json");
            var response = await client.PostAsync(
                $"{botFrameworkUri}/v3/directline/conversations/{conversationId}/activities",
                encodedBody);

            var responseContent = await response.Content.ReadAsStringAsync();
            return response.IsSuccessStatusCode
                ? responseContent
                : $"Error: {response.StatusCode} - {response.ReasonPhrase}\nResponse:\n{responseContent}";
        }
    }
}
