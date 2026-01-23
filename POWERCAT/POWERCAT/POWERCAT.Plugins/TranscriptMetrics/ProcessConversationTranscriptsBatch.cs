// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Processes conversation transcripts in batch and creates/updates Agent Conversation records.
    /// Receives pre-processed data from Power Automate and handles content parsing in plugin.
    /// </summary>
    public class ProcessConversationTranscriptsBatch
    {
        private const string AgentConversationTableLogicalName = "cat_agentconversation";
        private readonly IOrganizationService _organizationService;
        private readonly ITracingService _tracingService;

        /// <summary>
        /// Initializes a new instance of the <see cref="ProcessConversationTranscriptsBatch"/> class.
        /// </summary>
        public ProcessConversationTranscriptsBatch(IOrganizationService organizationService, ITracingService tracingService)
        {
            _organizationService = organizationService ?? throw new ArgumentNullException(nameof(organizationService));
            _tracingService = tracingService ?? throw new ArgumentNullException(nameof(tracingService));
        }

        /// <summary>
        /// Executes the batch processing logic.
        /// </summary>
        public void Execute(IPluginExecutionContext context)
        {
            try
            {
                // 1. Extract input parameters
                string recordsJson = context.InputParameters.Contains("Records")
                    ? context.InputParameters["Records"] as string
                    : null;

                if (string.IsNullOrWhiteSpace(recordsJson))
                {
                    SetErrorResponse(context, "Records parameter is required.");
                    throw new InvalidPluginExecutionException("Records parameter is required.");
                }

                // 2. Deserialize input records
                List<TranscriptInput> inputRecords;
                try
                {
                    inputRecords = JsonConvert.DeserializeObject<List<TranscriptInput>>(recordsJson);
                }
                catch (Exception ex)
                {
                    SetErrorResponse(context, $"Failed to parse Records: {ex.Message}");
                    throw new InvalidPluginExecutionException($"Failed to parse Records: {ex.Message}", ex);
                }
                if (inputRecords == null || inputRecords.Count == 0)
                {
                    _tracingService.Trace("No records to process.");
                    context.OutputParameters["IsSuccess"] = true;
                    context.OutputParameters["ProcessedCount"] = 0;
                    context.OutputParameters["ErrorMessage"] = "No records provided.";
                    return;
                }
                _tracingService.Trace($"Processing {inputRecords.Count} records");

                // 3. Collect all RecordNames from input
                var recordNames = inputRecords
                    .Where(r => !string.IsNullOrEmpty(r.RecordName))
                    .Select(r => r.RecordName)
                    .ToList();

                // 4. Fetch all existing records in one batch query
                var existingRecords = FetchExistingAgentConversations(recordNames);
                _tracingService.Trace($"Found {existingRecords.Count} existing records");

                // 5. Build upsert requests
                var upsertRequests = new ExecuteMultipleRequest
                {
                    Requests = new OrganizationRequestCollection(),
                    Settings = new ExecuteMultipleSettings
                    {
                        ContinueOnError = true,
                        ReturnResponses = true
                    }
                };

                foreach (var record in inputRecords)
                {
                    try
                    {
                        var agentConversation = ProcessRecord(record);

                        // Check if record exists using the pre-fetched dictionary
                        if (existingRecords.TryGetValue(record.RecordName, out Guid existingId))
                        {
                            agentConversation.Id = existingId;
                            upsertRequests.Requests.Add(new UpdateRequest { Target = agentConversation });
                        }
                        else
                        {
                            agentConversation.Id = Guid.NewGuid();
                            upsertRequests.Requests.Add(new CreateRequest { Target = agentConversation });
                        }
                    }
                    catch (Exception ex)
                    {
                        _tracingService.Trace($"Error processing record {record.RecordName}: {ex.Message}");
                    }
                }

                // 6. Execute batch upsert
                if (upsertRequests.Requests.Count == 0)
                {
                    _tracingService.Trace("No valid records to upsert");
                    context.OutputParameters["IsSuccess"] = true;
                    context.OutputParameters["ProcessedCount"] = 0;
                    context.OutputParameters["ErrorMessage"] = string.Empty;
                    return;
                }

                _tracingService.Trace($"Executing batch upsert for {upsertRequests.Requests.Count} records");
                var response = (ExecuteMultipleResponse)_organizationService.Execute(upsertRequests);

                // 7. Process response and set output parameters
                int successCount = 0;
                int failureCount = 0;
                var errors = new List<string>();

                foreach (var responseItem in response.Responses)
                {
                    if (responseItem.Fault != null)
                    {
                        failureCount++;
                        errors.Add($"Index {responseItem.RequestIndex}: {responseItem.Fault.Message}");
                    }
                    else
                    {
                        successCount++;
                    }
                }

                _tracingService.Trace($"Upsert results - Success: {successCount}, Failures: {failureCount}");

                context.OutputParameters["IsSuccess"] = failureCount == 0;
                context.OutputParameters["ProcessedCount"] = successCount;

                if (failureCount > 0)
                {
                    string errorDetails = string.Join("; ", errors.Take(5));
                    context.OutputParameters["ErrorMessage"] = $"Completed with {failureCount} errors. First errors: {errorDetails}";
                }
                else
                {
                    context.OutputParameters["ErrorMessage"] = string.Empty;
                }

                _tracingService.Trace("ProcessConversationTranscriptsBatch completed successfully");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                string errorMsg = $"An error occurred: {ex.Message}";
                SetErrorResponse(context, errorMsg);
                throw new InvalidPluginExecutionException(errorMsg, ex);
            }
        }

        /// <summary>
        /// Fetches all existing Agent Conversation records matching the provided RecordNames.
        /// Returns a dictionary of RecordName -> AgentConversationId.
        /// </summary>
        private Dictionary<string, Guid> FetchExistingAgentConversations(List<string> recordNames)
        {
            var existingRecords = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);

            if (recordNames == null || !recordNames.Any())
                return existingRecords;

            // FetchXML has a limit on IN clause, batch into chunks of 200
            const int batchSize = 200;
            var batches = recordNames
                .Select((name, index) => new { name, index })
                .GroupBy(x => x.index / batchSize)
                .Select(g => g.Select(x => x.name).ToList())
                .ToList();

            foreach (var batch in batches)
            {
                try
                {
                    var fetchXml = BuildFetchXmlForNames(batch);
                    _tracingService.Trace($"Fetching batch of {batch.Count} records");

                    var query = new FetchExpression(fetchXml);
                    var results = _organizationService.RetrieveMultiple(query);

                    foreach (var entity in results.Entities)
                    {
                        var name = entity.GetAttributeValue<string>("cat_name");
                        if (!string.IsNullOrEmpty(name) && !existingRecords.ContainsKey(name))
                        {
                            existingRecords[name] = entity.Id;
                        }
                    }
                }
                catch (Exception ex)
                {
                    _tracingService.Trace($"Error fetching batch: {ex.Message}");
                }
            }

            return existingRecords;
        }

        /// <summary>
        /// Builds FetchXML query to retrieve records by name using IN clause.
        /// </summary>
        private string BuildFetchXmlForNames(List<string> names)
        {
            var sb = new StringBuilder();
            sb.Append(@"<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false'>
                <entity name='cat_agentconversation'>
                    <attribute name='cat_agentconversationid' />
                    <attribute name='cat_name' />
                    <filter type='and'>
                        <condition attribute='cat_name' operator='in'>");

            foreach (var name in names)
            {
                var escapedName = System.Security.SecurityElement.Escape(name);
                sb.Append($"<value>{escapedName}</value>");
            }

            sb.Append(@"</condition>
                    </filter>
                </entity>
            </fetch>");

            return sb.ToString();
        }

        /// <summary>
        /// Processes a single transcript record and creates the Agent Conversation entity.
        /// Parses content JSON and extracts SessionInfo, Feedback, BotMessages, ChannelId, and IsDesignMode.
        /// </summary>
        private Entity ProcessRecord(TranscriptInput record)
        {
            // Parse content to get activities
            var activities = new List<JObject>();
            if (!string.IsNullOrEmpty(record.Content))
            {
                try
                {
                    var contentJson = JObject.Parse(record.Content);
                    activities = contentJson["activities"]?.ToObject<List<JObject>>() ?? new List<JObject>();
                }
                catch (Exception ex)
                {
                    _tracingService.Trace($"Error parsing content: {ex.Message}");
                }
            }

            // Filter: SessionInfo rows (type='trace' AND valueType='SessionInfo')
            var sessionInfoRows = activities
                .Where(a => a["type"]?.ToString() == "trace" &&
                           a["valueType"]?.ToString() == "SessionInfo")
                .ToList();

            // Filter: ConversationInfo rows (type='trace' AND valueType='ConversationInfo')
            var conversationInfoRows = activities
                .Where(a => a["type"]?.ToString() == "trace" &&
                           a["valueType"]?.ToString() == "ConversationInfo")
                .ToList();

            // Filter: Feedback rows (type='invoke' AND name='message/submitAction' AND value.actionName='feedback')
            var feedbackRows = activities
                .Where(a => a["type"]?.ToString() == "invoke" &&
                           a["name"]?.ToString() == "message/submitAction" &&
                           a["value"]?["actionName"]?.ToString() == "feedback")
                .ToList();

            // Filter: Channel ID rows
            var channelIdRows = activities
                .Where(a =>
                {
                    var type = a["type"]?.ToString();
                    var isValidType = type == "event" || type == "message" || type == "conversationUpdate";
                    var activityChannelId = a["channelId"]?.ToString() ?? a["value"]?["channelId"]?.ToString();
                    return isValidType && !string.IsNullOrEmpty(activityChannelId);
                })
                .ToList();

            // Filter: Bot messages (type='message' AND from.role=0)
            var botMessages = activities
                .Where(a => a["type"]?.ToString() == "message" &&
                           a["from"]?["role"]?.Value<int>() == 0)
                .ToList();

            // Determine channel ID
            string channelId = "Unknown";
            if (channelIdRows.Any())
            {
                channelId = channelIdRows.First()["channelId"]?.ToString() ?? "Unknown";
            }

            // Determine isDesignMode
            bool isDesignMode = false;
            if (conversationInfoRows.Any())
            {
                isDesignMode = conversationInfoRows.First()["value"]?["isDesignMode"]?.Value<bool>() ?? false;
            }

            // Create entity
            var entity = new Entity(AgentConversationTableLogicalName);
            entity["cat_name"] = record.RecordName;
            entity["cat_agentconfigurationid"] = new EntityReference("cat_copilotconfiguration", Guid.Parse(record.AgentConfigurationId));
            entity["cat_agentname"] = record.AgentName;
            entity["cat_botmessages"] = JsonConvert.SerializeObject(botMessages);
            entity["cat_channelid"] = channelId;
            entity["cat_conversationdate"] = DateTime.Parse(record.ConversationDate);
            entity["cat_conversationid"] = record.ConversationId;
            entity["cat_feedback"] = JsonConvert.SerializeObject(feedbackRows);
            entity["cat_isdesignmode"] = isDesignMode;
            entity["cat_sessioninfo"] = JsonConvert.SerializeObject(sessionInfoRows);
            entity["cat_workflowstatus"] = new OptionSetValue(1);
            entity["ttlinseconds"] = 86400; 

            return entity;
        }

        /// <summary>
        /// Sets error response output parameters.
        /// </summary>
        private void SetErrorResponse(IPluginExecutionContext context, string errorMessage)
        {
            context.OutputParameters["IsSuccess"] = false;
            context.OutputParameters["ProcessedCount"] = 0;
            context.OutputParameters["ErrorMessage"] = errorMessage;
        }
    }

    /// <summary>
    /// Input DTO matching Power Automate Select output for ProcessConversationTranscriptsBatch.
    /// </summary>
    [System.Runtime.Serialization.DataContract]
    public class TranscriptInput
    {
        [JsonProperty("ConversationId")]
        public string ConversationId { get; set; }

        [JsonProperty("Content")]
        public string Content { get; set; }

        [JsonProperty("ConversationDate")]
        public string ConversationDate { get; set; }

        [JsonProperty("AgentConfigurationId")]
        public string AgentConfigurationId { get; set; }

        [JsonProperty("RecordName")]
        public string RecordName { get; set; }

        [JsonProperty("AgentName")]
        public string AgentName { get; set; }
    }
}