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

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Processes conversation transcripts in batch and creates/updates daily aggregate records.
    /// Receives pre-processed data from Power Automate and handles content parsing in plugin.
    /// </summary>
    public class ProcessConversationTranscriptsBatch
    {
        private const string _tableName = "cat_agentinsightstranscriptstaging";
        private readonly IOrganizationService _organizationService;
        private readonly ITracingService _tracingService;

        /// <summary>
        /// Constructor to initialize Organization and Tracing services.
        /// </summary>
        /// <param name="organizationService">The organization service for Dataverse operations.</param>
        /// <param name="tracingService">The tracing service for logging.</param>
        /// <exception cref="ArgumentNullException">Thrown when organizationService or tracingService is null.</exception>
        public ProcessConversationTranscriptsBatch(IOrganizationService organizationService, ITracingService tracingService)
        {
            _organizationService = organizationService ?? throw new ArgumentNullException(nameof(organizationService));
            _tracingService = tracingService ?? throw new ArgumentNullException(nameof(tracingService));
        }

        /// <summary>
        /// Executes the batch processing logic.
        /// </summary>
        /// <param name="context">The plugin execution context containing input and output parameters.</param>
        /// <exception cref="InvalidPluginExecutionException">Thrown when required parameters are missing or processing fails.</exception>
        public void Execute(IPluginExecutionContext context)
        {
            const string methodName = nameof(Execute);
            try
            {
                // 1. Extract input parameters
                string recordsJson = context.InputParameters.Contains("Records")
                    ? context.InputParameters["Records"] as string
                    : null;

                if (string.IsNullOrWhiteSpace(recordsJson))
                {
                    SetErrorResponse(context, $"{methodName}: Records parameter is required.");
                    throw new InvalidPluginExecutionException($"{methodName}: Records parameter is required.");
                }

                // 2. Deserialize input records
                List<TranscriptInputModel> inputRecords;
                try
                {
                    inputRecords = JsonConvert.DeserializeObject<List<TranscriptInputModel>>(recordsJson);
                }
                catch (Exception ex)
                {
                    SetErrorResponse(context, $"{methodName}: Failed to parse Records: {ex.Message}");
                    throw new InvalidPluginExecutionException($"{methodName}: Failed to parse Records: {ex.Message}", ex);
                }

                _tracingService.Trace($"{methodName}: Processing {inputRecords.Count} records");

                // 3. Collect all ConversationTranscriptGuid from input (trimmed)
                var ConversationTranscriptGuids = inputRecords
                    .Where(r => !string.IsNullOrEmpty(r.ConversationTranscriptGuid))
                    .Select(r => r.ConversationTranscriptGuid.Trim())
                    .ToList();

                // 4. Fetch all existing records in one batch query
                var existingRecords = FetchExistingTranscriptStagingRecords(ConversationTranscriptGuids);
                _tracingService.Trace($"{methodName}: Found {existingRecords.Count} existing records");

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

                // Track record identifiers for error reporting
                var requestIndexToRecordInfo = new List<(string TranscriptGuid, string RecordName)>();
                foreach (var record in inputRecords)
                {
                    try
                    {
                        var transcriptGuid = record.ConversationTranscriptGuid?.Trim();
                        Entity entityToUpsert = ProcessTranscriptRecord(record);

                        if (!string.IsNullOrEmpty(transcriptGuid) &&
                            existingRecords.TryGetValue(transcriptGuid, out Guid existingId))
                        {
                            entityToUpsert.Id = existingId;
                        }
                        else
                        {
                            entityToUpsert.Id = Guid.NewGuid();
                        }

                        upsertRequests.Requests.Add(new UpsertRequest { Target = entityToUpsert });
                        requestIndexToRecordInfo.Add((transcriptGuid, record.RecordName));
                    }
                    catch (Exception ex)
                    {
                        _tracingService.Trace($"{methodName}: Error processing record {record.RecordName}: {ex.Message}");
                    }
                }

                // 6. Execute batch upsert in chunks for better performance
                if (upsertRequests.Requests.Count == 0)
                {
                    _tracingService.Trace($"{methodName}: No valid records to upsert");
                    context.OutputParameters["IsSuccess"] = true;
                    context.OutputParameters["ProcessedCount"] = 0;
                    context.OutputParameters["ErrorMessage"] = string.Empty;
                    return;
                }

                const int batchSize = 50; // Optimal batch size for Dataverse
                int totalRequests = upsertRequests.Requests.Count;
                _tracingService.Trace($"{methodName}: Executing batch upsert for {totalRequests} records in chunks of {batchSize}");

                // 7. Process response and set output parameters
                int successCount = 0;
                int failureCount = 0;
                var errors = new List<string>();

                for (int i = 0; i < totalRequests; i += batchSize)
                {
                    var batchRequest = new ExecuteMultipleRequest
                    {
                        Requests = new OrganizationRequestCollection(),
                        Settings = new ExecuteMultipleSettings
                        {
                            ContinueOnError = true,
                            ReturnResponses = false // Set to false for better performance
                        }
                    };

                    int batchEnd = Math.Min(i + batchSize, totalRequests);
                    for (int j = i; j < batchEnd; j++)
                    {
                        batchRequest.Requests.Add(upsertRequests.Requests[j]);
                    }

                    try
                    {
                        var response = (ExecuteMultipleResponse)_organizationService.Execute(batchRequest);

                        // Check for faults when ReturnResponses is false
                        if (response.IsFaulted)
                        {
                            foreach (var responseItem in response.Responses.Where(r => r.Fault != null))
                            {
                                failureCount++;
                                int originalIndex = i + responseItem.RequestIndex;
                                var recordInfo = requestIndexToRecordInfo.Count > originalIndex
                                    ? requestIndexToRecordInfo[originalIndex]
                                    : (TranscriptGuid: "Unknown", RecordName: "Unknown");
                                errors.Add($"{methodName}:TranscriptGuid: {recordInfo.TranscriptGuid}, RecordName: {recordInfo.RecordName} - {responseItem.Fault.Message}");
                            }
                            successCount += batchRequest.Requests.Count - response.Responses.Count(r => r.Fault != null);
                        }
                        else
                        {
                            successCount += batchRequest.Requests.Count;
                        }
                    }
                    catch (Exception ex)
                    {
                        _tracingService.Trace($"{methodName}: Batch {i / batchSize + 1} failed: {ex.Message}");
                        failureCount += batchRequest.Requests.Count;
                        errors.Add($"Batch {i / batchSize + 1} failed: {ex.Message}");
                    }
                }

                _tracingService.Trace($"{methodName}: Upsert results - Success: {successCount}, Failures: {failureCount}");

                context.OutputParameters["IsSuccess"] = failureCount == 0;
                context.OutputParameters["ProcessedCount"] = successCount;

                if (failureCount > 0)
                {
                    string errorDetails = string.Join("; ", errors.Take(5));
                    context.OutputParameters["ErrorMessage"] = $"{methodName}: Completed with {failureCount} errors. First errors: {errorDetails}";
                }
                else
                {
                    context.OutputParameters["ErrorMessage"] = string.Empty;
                }

                _tracingService.Trace($"{methodName}: ProcessConversationTranscriptsBatch completed successfully");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                string errorMsg = $"{methodName}: An error occurred in ProcessConversationTranscriptsBatch: {ex.Message}";
                SetErrorResponse(context, errorMsg);
                throw new InvalidPluginExecutionException(errorMsg, ex);
            }
        }

        /// <summary>
        /// Fetches all existing Transcript Staging records matching the provided TranscriptIds.
        /// </summary>
        /// <param name="transcriptGuids">The list of transcript GUIDs to search for.</param>
        /// <returns>A dictionary mapping ConversationTranscriptGuid to TranscriptStagingId.</returns>
        private Dictionary<string, Guid> FetchExistingTranscriptStagingRecords(List<string> transcriptGuids)
        {
            const string methodName = nameof(FetchExistingTranscriptStagingRecords);
            var existingRecords = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);

            if (transcriptGuids == null || !transcriptGuids.Any())
                return existingRecords;

            try
            {
                string valuesXml = string.Join("", transcriptGuids.Select(id => $"<value>{id.Trim()}</value>"));
                string fetchXml = @"<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false'>
                                      <entity name='cat_agentinsightstranscriptstaging'>
                                        <attribute name='cat_agentinsightstranscriptstagingid' />
                                        <attribute name='cat_transcriptguid' />
                                        <filter type='and'>
                                          <condition attribute='cat_transcriptguid' operator='in'>
                                            {0}
                                          </condition>
                                        </filter>
                                      </entity>
                                    </fetch>";
                fetchXml = string.Format(fetchXml, valuesXml);

                var query = new FetchExpression(fetchXml);
                var results = _organizationService.RetrieveMultiple(query);

                foreach (var entity in results.Entities)
                {
                    var id = entity.GetAttributeValue<string>("cat_transcriptguid");
                    if (!string.IsNullOrEmpty(id) && !existingRecords.ContainsKey(id))
                    {
                        existingRecords[id] = entity.Id;
                    }
                }

                _tracingService.Trace($"{methodName}: Fetched {results.Entities.Count} existing records");
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"{methodName}: Error fetching existing records: {ex.Message}");
            }

            return existingRecords;
        }

        /// <summary>
        /// Processes a single transcript record and creates the Agent Conversation entity.
        /// Parses content JSON and extracts SessionInfo, FeedbackDetails, ChannelId, and DataSourceCode.
        /// </summary>
        /// <param name="record">The transcript input model containing the record data to process.</param>
        /// <returns>An Entity object populated with the processed transcript data.</returns>
        private Entity ProcessTranscriptRecord(TranscriptInputModel record)
        {
            const string methodName = nameof(ProcessTranscriptRecord);

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
                    _tracingService.Trace($"{methodName}: Error parsing content: {ex.Message}");
                }
            }

            var sessionInfoRows = new List<JObject>();
            int dataSourceCode = 1;
            bool dataSourceCodeSet = false;
            JObject firstChannelRow = null;
            var messageActivitiesDictionary = new Dictionary<string, JObject>();
            var feedbackRows = new List<JObject>();

            foreach (var activity in activities)
            {
                var type = activity["type"]?.ToString();

                if (type == "trace")
                {
                    var valueType = activity["valueType"]?.ToString();
                    if (valueType == "SessionInfo")
                    {
                        sessionInfoRows.Add(activity);
                    }
                    else if (!dataSourceCodeSet && valueType == "ConversationInfo")
                    {
                        bool isDesignMode = activity["value"]?["isDesignMode"]?.Value<bool>() ?? false;
                        dataSourceCode = isDesignMode ? 2 : 1;
                        dataSourceCodeSet = true;
                    }
                }

                if (firstChannelRow == null)
                {
                    var isValidType = type == "event" || type == "message" || type == "conversationUpdate";
                    var activityChannelId = activity["channelId"]?.ToString() ?? activity["value"]?["channelId"]?.ToString();
                    if (isValidType && !string.IsNullOrEmpty(activityChannelId))
                    {
                        firstChannelRow = activity;
                    }
                }

                // Only collect bot messages and feedback rows when CaptureUserFeedback is enabled
                if (record.CaptureUserFeedback)
                {
                    if (type == "message")
                    {
                        var id = activity["id"]?.ToString();
                        if (!string.IsNullOrEmpty(id))
                        {
                            messageActivitiesDictionary[id] = activity;
                        }
                    }

                    if (type == "invoke" &&
                        activity["name"]?.ToString() == "message/submitAction" &&
                        activity["value"]?["actionName"]?.ToString() == "feedback")
                    {
                        feedbackRows.Add(activity);
                    }
                }
            }

            string channelId = firstChannelRow?["channelId"]?.ToString() ?? "Unknown";
            int runCount = 0;
            int successfulRunCount = 0;
            int totalDurationSeconds = 0;
            var connectedAgentDetails = ExtractConnectedAgentDetails(activities);

            if (string.Equals(channelId, "pva-autonomous", StringComparison.OrdinalIgnoreCase))
            {
                CalculateAutonomousRunMetrics(activities, out runCount, out successfulRunCount, out totalDurationSeconds);
            }

            var feedbackDetails = new List<FeedbackDetailRecord>();

            if (record.CaptureUserFeedback)
            {
                _tracingService.Trace($"{methodName}: Feedback rows found: {feedbackRows.Count}");

                foreach (var feedback in feedbackRows)
                {
                    var reaction = feedback["value"]?["actionValue"]?["reaction"]?.ToString();

                    var feedbackValue = feedback["value"]?["actionValue"]?["feedback"];
                    string feedbackText = null;

                    if (feedbackValue != null)
                    {
                        if (feedbackValue.Type == JTokenType.Object)
                        {
                            feedbackText = feedbackValue["feedbackText"]?.ToString();
                        }
                        else if (feedbackValue.Type == JTokenType.String)
                        {
                            var feedbackString = feedbackValue.ToString();
                            try
                            {
                                var parsedFeedback = JObject.Parse(feedbackString);
                                feedbackText = parsedFeedback["feedbackText"]?.ToString();
                            }
                            catch
                            {
                                feedbackText = feedbackString;
                            }
                        }
                    }

                    string agentMessage = null;
                    string userMessage = null;
                    var replyToId = feedback["replyToId"]?.ToString();
                    if (!string.IsNullOrEmpty(replyToId) && messageActivitiesDictionary.TryGetValue(replyToId, out JObject agentMessageActivity))
                    {
                        agentMessage = agentMessageActivity["text"]?.ToString();

                        var userReplyToId = agentMessageActivity["replyToId"]?.ToString();
                        if (!string.IsNullOrEmpty(userReplyToId) && messageActivitiesDictionary.TryGetValue(userReplyToId, out JObject userMessageActivity))
                        {
                            userMessage = userMessageActivity["text"]?.ToString();
                        }
                    }

                    if (!string.IsNullOrEmpty(reaction) || !string.IsNullOrEmpty(feedbackText))
                    {
                        feedbackDetails.Add(new FeedbackDetailRecord
                        {
                            AgentName = record.AgentName,
                            ConversationId = record.ConversationId,
                            AgentMessage = agentMessage,
                            UserMessage = userMessage,
                            FeedbackText = feedbackText,
                            FeedbackReaction = reaction
                        });
                    }
                }
            }
            else
            {
                _tracingService.Trace($"{methodName}: CaptureUserFeedback is disabled, skipping feedback processing.");
            }

            var entity = new Entity(_tableName);
            entity["cat_name"] = record.RecordName;
            entity["cat_agentconfiguration"] = new EntityReference("cat_copilotconfiguration", Guid.Parse(record.AgentConfigurationId));
            entity["cat_agentname"] = record.AgentName;
            entity["cat_transcriptguid"] = record.ConversationTranscriptGuid;
            entity["cat_channelid"] = channelId;
            entity["cat_conversationdate"] = DateTime.Parse(record.ConversationDate);
            entity["cat_conversationid"] = record.ConversationId;
            entity["cat_feedbackdetails"] = feedbackDetails.Count > 0 ? JsonConvert.SerializeObject(feedbackDetails) : null;
            entity["cat_connectedagentdetails"] = connectedAgentDetails.Count > 0 ? JsonConvert.SerializeObject(connectedAgentDetails) : null;
            entity["cat_datasourcecode"] = new OptionSetValue(dataSourceCode);
            entity["cat_sessioninfo"] = JsonConvert.SerializeObject(sessionInfoRows);
            entity["cat_runs"] = runCount;
            entity["cat_successfulruns"] = successfulRunCount;
            entity["cat_totaldurationseconds"] = totalDurationSeconds;
            entity["cat_workflowstatus"] = new OptionSetValue(1);
            entity["ttlinseconds"] = 259200;

            return entity;
        }

        /// <summary>
        /// Calculates autonomous run metrics from transcript activities.
        /// </summary>
        /// <param name="activities">The transcript activities.</param>
        /// <param name="runCount">The total run count.</param>
        /// <param name="successfulRunCount">The successful run count.</param>
        /// <param name="totalDurationSeconds">The total duration in seconds across all runs.</param>
        private void CalculateAutonomousRunMetrics(
            List<JObject> activities,
            out int runCount,
            out int successfulRunCount,
            out int totalDurationSeconds)
        {
            const string methodName = nameof(CalculateAutonomousRunMetrics);

            runCount = 0;
            successfulRunCount = 0;
            totalDurationSeconds = 0;

            if (activities == null || activities.Count == 0)
            {
                return;
            }

            foreach (var activity in activities)
            {
                if (!string.Equals(activity["type"]?.ToString(), "trace", StringComparison.OrdinalIgnoreCase) ||
                    !string.Equals(activity["valueType"]?.ToString(), "SessionInfo", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                runCount++;

                DateTime startTimeUtc;
                DateTime endTimeUtc;
                var startTimeValue = activity["value"]?["startTimeUtc"]?.ToString();
                var endTimeValue = activity["value"]?["endTimeUtc"]?.ToString();
                var sessionType = activity["value"]?["type"]?.ToString();
                var outcome = activity["value"]?["outcome"]?.ToString();
                var outcomeReason = activity["value"]?["outcomeReason"]?.ToString();
                var impliedSuccessValue = activity["value"]?["impliedSuccess"]?.ToString();

                if (!DateTime.TryParse(startTimeValue, out startTimeUtc) ||
                    !DateTime.TryParse(endTimeValue, out endTimeUtc) ||
                    endTimeUtc < startTimeUtc)
                {
                    continue;
                }

                bool impliedSuccess;
                var isSuccessfulRun = bool.TryParse(impliedSuccessValue, out impliedSuccess) &&
                    impliedSuccess;

                if (!isSuccessfulRun &&
                    !(string.Equals(sessionType, "Unengaged", StringComparison.OrdinalIgnoreCase) &&
                      string.Equals(outcomeReason, "NoError", StringComparison.OrdinalIgnoreCase) &&
                      string.Equals(outcome, "None", StringComparison.OrdinalIgnoreCase)) &&
                    !string.IsNullOrEmpty(outcomeReason) &&
                    (!outcomeReason.Contains("Error") ||
                     string.Equals(outcomeReason, "NoError", StringComparison.OrdinalIgnoreCase)))
                {
                    isSuccessfulRun = true;
                }

                if (isSuccessfulRun)
                {
                    successfulRunCount++;
                }

                totalDurationSeconds += (int)Math.Floor((endTimeUtc - startTimeUtc).TotalSeconds);
            }

            _tracingService.Trace($"{methodName}: Calculated autonomous metrics - Runs: {runCount}, SuccessfulRuns: {successfulRunCount}, TotalDurationSeconds: {totalDurationSeconds}");
        }

        /// <summary>
        /// Extracts connected agent details from transcript activities.
        /// </summary>
        /// <param name="activities">The transcript activities.</param>
        /// <returns>The connected agent detail records.</returns>
        private List<ConnectedAgentDetailRecord> ExtractConnectedAgentDetails(List<JObject> activities)
        {
            const string methodName = nameof(ExtractConnectedAgentDetails);
            var connectedAgentDetails = new List<ConnectedAgentDetailRecord>();

            if (activities == null || activities.Count == 0)
            {
                return connectedAgentDetails;
            }

            var pendingConnectedAgentCalls = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

            foreach (var activity in activities)
            {
                if (!string.Equals(activity["type"]?.ToString(), "event", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                var activityName = activity["name"]?.ToString();
                var valueType = activity["valueType"]?.ToString();
                var taskDialogId = activity["value"]?["taskDialogId"]?.ToString();

                if (string.Equals(valueType, "DynamicPlanStepTriggered", StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(activityName, "DynamicPlanStepTriggered", StringComparison.OrdinalIgnoreCase) &&
                    !string.IsNullOrEmpty(taskDialogId) &&
                    IsConnectedAgentTaskDialogId(taskDialogId))
                {
                    int pendingCount;
                    pendingConnectedAgentCalls.TryGetValue(taskDialogId, out pendingCount);
                    pendingConnectedAgentCalls[taskDialogId] = pendingCount + 1;
                    continue;
                }

                if (!string.Equals(activityName, "DynamicPlanStepFinished", StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrEmpty(taskDialogId) ||
                    !IsConnectedAgentTaskDialogId(taskDialogId))
                {
                    continue;
                }

                int pendingMatchedCount;
                if (!pendingConnectedAgentCalls.TryGetValue(taskDialogId, out pendingMatchedCount) || pendingMatchedCount == 0)
                {
                    continue;
                }

                if (pendingMatchedCount == 1)
                {
                    pendingConnectedAgentCalls.Remove(taskDialogId);
                }
                else
                {
                    pendingConnectedAgentCalls[taskDialogId] = pendingMatchedCount - 1;
                }

                var state = activity["value"]?["state"]?.ToString();
                connectedAgentDetails.Add(new ConnectedAgentDetailRecord
                {
                    TaskDialogId = taskDialogId,
                    IsSuccess = string.Equals(state, "completed", StringComparison.OrdinalIgnoreCase),
                    Type = GetConnectedAgentType(taskDialogId)
                });
            }

            foreach (var pendingConnectedAgentCall in pendingConnectedAgentCalls)
            {
                for (int i = 0; i < pendingConnectedAgentCall.Value; i++)
                {
                    connectedAgentDetails.Add(new ConnectedAgentDetailRecord
                    {
                        TaskDialogId = pendingConnectedAgentCall.Key,
                        IsSuccess = false,
                        Type = GetConnectedAgentType(pendingConnectedAgentCall.Key)
                    });
                }
            }

            _tracingService.Trace($"{methodName}: Extracted connected agent details - Count: {connectedAgentDetails.Count}");
            return connectedAgentDetails;
        }

        /// <summary>
        /// Determines whether the task dialog identifier represents a connected agent invocation.
        /// </summary>
        /// <param name="taskDialogId">The task dialog identifier to evaluate.</param>
        /// <returns><c>true</c> if the task dialog identifier matches a connected agent pattern; otherwise, <c>false</c>.</returns>
        private static bool IsConnectedAgentTaskDialogId(string taskDialogId)
        {
            return taskDialogId.IndexOf("InvokeConnectedAgentTaskAction", StringComparison.OrdinalIgnoreCase) >= 0 ||
                taskDialogId.IndexOf(".agent.", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        /// <summary>
        /// Gets the connected agent type represented by the task dialog identifier.
        /// </summary>
        /// <param name="taskDialogId">The task dialog identifier to evaluate.</param>
        /// <returns>The connected agent type, or <c>Unknown</c> when the type cannot be determined.</returns>
        private static string GetConnectedAgentType(string taskDialogId)
        {
            if (string.IsNullOrEmpty(taskDialogId))
            {
                return "Unknown";
            }

            if (taskDialogId.IndexOf("InvokeConnectedAgentTaskAction", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return "Copilot Studio";
            }

            if (taskDialogId.IndexOf(".agent.", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return "Child";
            }

            return "Unknown";
        }

        private class ConnectedAgentDetailRecord
        {
            public string TaskDialogId { get; set; }

            public bool IsSuccess { get; set; }

            public string Type { get; set; }
        }

        /// <summary>
        /// Sets error response output parameters.
        /// </summary>
        /// <param name="context">The plugin execution context to set output parameters on.</param>
        /// <param name="errorMessage">The error message to include in the response.</param>
        private void SetErrorResponse(IPluginExecutionContext context, string errorMessage)
        {
            context.OutputParameters["IsSuccess"] = false;
            context.OutputParameters["ProcessedCount"] = 0;
            context.OutputParameters["ErrorMessage"] = errorMessage;
        }
    }
}