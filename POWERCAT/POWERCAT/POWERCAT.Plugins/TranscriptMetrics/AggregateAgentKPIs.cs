// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Aggregates agent KPIs from conversation transcripts stored in Dataverse.
    /// </summary>
    public class AggregateAgentKPIs
    {
        private const string TranscriptTableLogicalName = "cat_agentconversation";
        private const string MetricsTableLogicalName = "cat_transcriptmetrics";

        private readonly IOrganizationService _organizationService;
        private readonly ITracingService _tracingService;

        /// <summary>
        /// Initializes a new instance of the <see cref="AggregateAgentKPIs"/> class.
        /// </summary>
        /// <param name="organizationService">The organization service.</param>
        /// <param name="tracingService">The tracing service.</param>
        public AggregateAgentKPIs(IOrganizationService organizationService, ITracingService tracingService)
        {
            _organizationService = organizationService ?? throw new ArgumentNullException(nameof(organizationService));
            _tracingService = tracingService ?? throw new ArgumentNullException(nameof(tracingService));
        }

        /// <summary>
        /// Executes the KPI aggregation logic.
        /// </summary>
        /// <param name="context">The plugin execution context.</param>
        public void Execute(IPluginExecutionContext context)
        {
            try
            {
                // 1. Extract input parameters
                string agentId = GetInputParameter<string>(context, "agentId");
                string agentMetadataJson = GetInputParameter<string>(context, "agentMetadata");
                DateTime conversationDate = GetInputParameter<DateTime>(context, "conversationDate");

                // 2. Validate inputs
                if (string.IsNullOrWhiteSpace(agentId))
                {
                    SetErrorResponse(context, "agentId is required.");
                    throw new InvalidPluginExecutionException("agentId is required.");
                }

                if (string.IsNullOrWhiteSpace(agentMetadataJson))
                {
                    SetErrorResponse(context, "agentMetadata is required.");
                    throw new InvalidPluginExecutionException("agentMetadata is required.");
                }

                // 3. Parse agent metadata
                AgentMetadata agentMetadata = null;
                try
                {
                    agentMetadata = JsonConvert.DeserializeObject<AgentMetadata>(agentMetadataJson);
                }
                catch (Exception ex)
                {
                    SetErrorResponse(context, $"Failed to parse agentMetadata: {ex.Message}");
                    throw new InvalidPluginExecutionException($"Failed to parse agentMetadata: {ex.Message}", ex);
                }

                // 4. Fetch conversation records from Dataverse table
                List<ConversationRecord> conversations = FetchConversationRecords(agentId, agentMetadata, conversationDate);

                if (conversations == null || conversations.Count == 0)
                {
                    _tracingService.Trace("No unprocessed conversation records found.");
                    context.OutputParameters["IsSuccess"] = true;
                    context.OutputParameters["SuccessCount"] = 0;
                    context.OutputParameters["FailureCount"] = 0;
                    context.OutputParameters["ErrorMessage"] = "No unprocessed records found.";
                    return;
                }

                _tracingService.Trace($"Processing {conversations.Count} conversations");

                // 5. Group and aggregate KPIs
                List<KpiGroup> kpiGroups = AggregateKpis(conversations, agentMetadata);

                _tracingService.Trace($"Aggregated into {kpiGroups.Count} groups");

                // 6. Batch upsert using ExecuteMultipleRequest
                Dictionary<int, bool> groupResults = UpsertKpiRecords(context, kpiGroups, agentId, agentMetadata);

                // 7. Update workflow status on conversation records based on upsert results
                UpdateConversationWorkflowStatus(kpiGroups, groupResults);

                _tracingService.Trace("AggregateAgentKPIs completed successfully");
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
        /// Gets an input parameter from the context.
        /// </summary>
        private T GetInputParameter<T>(IPluginExecutionContext context, string parameterName)
        {
            if (context.InputParameters.Contains(parameterName))
            {
                return (T)context.InputParameters[parameterName];
            }
            return default;
        }

        /// <summary>
        /// Fetches unprocessed conversation records from the cat_agentconversation table.
        /// Handles paging to retrieve all matching records.
        /// </summary>
        private List<ConversationRecord> FetchConversationRecords(string agentId, AgentMetadata agentMetadata, DateTime conversationDate)
        {
            var query = new QueryExpression(TranscriptTableLogicalName)
            {
                ColumnSet = new ColumnSet(
                    "cat_agentconversationid",
                    "cat_agentname",
                    "cat_conversationid",
                    "cat_conversationdate",
                    "cat_isdesignmode",
                    "cat_channelid",
                    "cat_sessioninfo",
                    "cat_feedback",
                    "cat_botmessages"
                ),
                PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = 1,
                    ReturnTotalRecordCount = false
                }
            };

            // Filter by agent configuration
            if (!string.IsNullOrEmpty(agentMetadata?.AgentConfigurationId) &&
                Guid.TryParse(agentMetadata.AgentConfigurationId, out Guid configId))
            {
                query.Criteria.AddCondition("cat_agentconfigurationid", ConditionOperator.Equal, configId);
            }
            // Check if mandatory field is empty
            if (conversationDate == default(DateTime))
            {
                throw new ArgumentException("Conversation date is required.", nameof(conversationDate));
            }

            // Apply filter - use Date only (without time) to avoid timezone shifting issues
            // The On operator compares dates, so we only need the date portion
            var dateOnly = conversationDate.Date;
            query.Criteria.AddCondition("cat_conversationdate", ConditionOperator.On, dateOnly);

            var conversations = new List<ConversationRecord>();

            // Paging loop to retrieve all records
            while (true)
            {
                var results = _organizationService.RetrieveMultiple(query);

                foreach (var entity in results.Entities)
                {
                    var dateValue = entity.GetAttributeValue<DateTime?>("cat_conversationdate");
                    if (!dateValue.HasValue)
                    {
                        _tracingService.Trace($"Skipping record {entity.Id} - ConversationDate is null");
                        continue;
                    }

                    

                    

                    var record = new ConversationRecord
                    {
                        EntityId = entity.Id,
                        AgentName = entity.GetAttributeValue<string>("cat_agentname"),
                        ConversationId = entity.GetAttributeValue<string>("cat_conversationid"),
                        ConversationDate = entity.GetAttributeValue<DateTime?>("cat_conversationdate")?.ToString("yyyy-MM-dd"),
                        IsDesignMode = entity.GetAttributeValue<bool>("cat_isdesignmode"),
                        ChannelId = entity.GetAttributeValue<string>("cat_channelid")
                    };

                    // Parse JSON columns
                    string sessionInfoJson = entity.GetAttributeValue<string>("cat_sessioninfo");
                    if (!string.IsNullOrEmpty(sessionInfoJson))
                    {
                        try
                        {
                            record.SessionInfo = JsonConvert.DeserializeObject<List<SessionInfo>>(sessionInfoJson);
                        }
                        catch (Exception ex)
                        {
                            _tracingService.Trace($"Failed to parse SessionInfo for {record.ConversationId}: {ex.Message}");
                        }
                    }

                    string feedbackJson = entity.GetAttributeValue<string>("cat_feedback");
                    if (!string.IsNullOrEmpty(feedbackJson))
                    {
                        try
                        {
                            record.Feedback = JsonConvert.DeserializeObject<List<FeedbackItem>>(feedbackJson);
                        }
                        catch (Exception ex)
                        {
                            _tracingService.Trace($"Failed to parse Feedback for {record.ConversationId}: {ex.Message}");
                        }
                    }

                    string botMessagesJson = entity.GetAttributeValue<string>("cat_botmessages");
                    if (!string.IsNullOrEmpty(botMessagesJson))
                    {
                        try
                        {
                            record.BotMessagesActivities = JsonConvert.DeserializeObject<List<Activity>>(botMessagesJson);
                        }
                        catch (Exception ex)
                        {
                            _tracingService.Trace($"Failed to parse BotMessages for {record.ConversationId}: {ex.Message}");
                        }
                    }

                    conversations.Add(record);
                }

                // Check if there are more records to retrieve
                if (results.MoreRecords)
                {
                    query.PageInfo.PageNumber++;
                    query.PageInfo.PagingCookie = results.PagingCookie;
                }
                else
                {
                    break;
                }
            }

            _tracingService.Trace($"Retrieved {conversations.Count} total conversation records");
            return conversations;
        }

        /// <summary>
        /// Aggregates KPIs by grouping conversations by conversationDate, channelId, and dataSourceCode.
        /// </summary>
        private List<KpiGroup> AggregateKpis(List<ConversationRecord> conversations, AgentMetadata agentMetadata)
        {
            // First, build BotMessages dictionary for each conversation
            foreach (var conversation in conversations)
            {
                conversation.BotMessages = new Dictionary<string, string>();
                if (conversation.BotMessagesActivities != null)
                {
                    foreach (var activity in conversation.BotMessagesActivities)
                    {
                        // Bot messages have type "message" and from.role == 0
                        if (string.Equals(activity.Type, "message", StringComparison.OrdinalIgnoreCase) &&
                            activity.From?.Role == 0 &&
                            !string.IsNullOrEmpty(activity.Id) &&
                            !string.IsNullOrEmpty(activity.Text))
                        {
                            conversation.BotMessages[activity.Id] = activity.Text;
                        }
                    }
                }
            }

            var groups = conversations
                .GroupBy(c => new { c.ChannelId, c.IsDesignMode })
                .Select(g =>
                {
                    // Get ConversationDate from first conversation in group (all should have same date)
                    var firstConversation = g.First();
                    // Parse the ConversationDate string back to DateTime
                    DateTime conversationDate;
                    if (!DateTime.TryParse(firstConversation.ConversationDate, out conversationDate))
                    {
                        throw new InvalidPluginExecutionException($"Invalid or empty ConversationDate for conversation {firstConversation.ConversationId}.");
                    }
                    // Derive DataSourceCode from IsDesignMode: Production (1) if false, TestData (2) if true
                    int dataSourceCode = g.Key.IsDesignMode ? 2 : 1;
                    var kpi = new KpiGroup
                    {
                        ConversationDate = conversationDate,
                        ChannelId = g.Key.ChannelId ?? string.Empty,
                        DataSourceCode = dataSourceCode,
                        TotalConversations = g.Count(),
                        SourceConversationIds = g.Select(c => c.EntityId).ToList()
                    };

                    foreach (var conversation in g)
                    {
                        // Process all SessionInfo items
                        if (conversation.SessionInfo != null)
                        {
                            foreach (var sessionInfo in conversation.SessionInfo)
                            {
                                var sessionValue = sessionInfo?.Value;
                                if (sessionValue != null)
                                {
                                    // Increment session count
                                    kpi.SessionCount++;

                                    // Session type counts
                                    if (string.Equals(sessionValue.Type, "Engaged", StringComparison.OrdinalIgnoreCase))
                                        kpi.EngagedCount++;
                                    else if (string.Equals(sessionValue.Type, "Unengaged", StringComparison.OrdinalIgnoreCase))
                                        kpi.UnengagedCount++;

                                    // Outcome counts
                                    if (string.Equals(sessionValue.Outcome, "Resolved", StringComparison.OrdinalIgnoreCase))
                                        kpi.ResolvedCount++;
                                    else if (string.Equals(sessionValue.Outcome, "Abandoned", StringComparison.OrdinalIgnoreCase))
                                        kpi.AbandonedCount++;
                                    else if (string.Equals(sessionValue.Outcome, "HandOff", StringComparison.OrdinalIgnoreCase))
                                        kpi.EscalatedCount++;

                                    // Turn count
                                    kpi.TotalTurns += sessionValue.TurnCount;

                                    // CSAT score
                                    if (sessionValue.CsatScore.HasValue && sessionValue.CsatScore.Value > 0)
                                    {
                                        kpi.CsatScore += sessionValue.CsatScore.Value;
                                        kpi.CsatCount++;
                                    }
                                }
                            }
                        }

                        // Feedback counts and details
                        if (conversation.Feedback != null)
                        {
                            foreach (var feedback in conversation.Feedback)
                            {
                                var reaction = feedback.Value?.ActionValue?.Reaction;
                                var feedbackText = feedback.Value?.ActionValue?.Feedback?.FeedbackText;

                                if (string.Equals(reaction, "like", StringComparison.OrdinalIgnoreCase))
                                    kpi.FeedbackLikeCount++;
                                else if (string.Equals(reaction, "dislike", StringComparison.OrdinalIgnoreCase))
                                    kpi.FeedbackDislikeCount++;

                                // Build detailed feedback record with agent message correlation
                                string agentMessage = null;
                                if (!string.IsNullOrEmpty(feedback.ReplyToId) &&
                                    conversation.BotMessages != null &&
                                    conversation.BotMessages.TryGetValue(feedback.ReplyToId, out string message))
                                {
                                    agentMessage = message;
                                }

                                // Only add to details if there's a reaction or feedback text
                                if (!string.IsNullOrEmpty(reaction) || !string.IsNullOrEmpty(feedbackText))
                                {
                                    kpi.FeedbackDetails.Add(new FeedbackDetailRecord
                                    {
                                        AgentName = conversation.AgentName,
                                        ConversationId = conversation.ConversationId,
                                        AgentMessage = agentMessage,
                                        FeedbackText = feedbackText,
                                        FeedbackReaction = reaction
                                    });
                                }
                            }
                        }
                    }

                    return kpi;
                })
                .ToList();

            return groups;
        }

        /// <summary>
        /// Upserts KPI records to Dataverse using ExecuteMultipleRequest.
        /// Uses alternate key for upsert behavior.
        /// </summary>
        /// <returns>Dictionary mapping KPI group index to success status.</returns>
        private Dictionary<int, bool> UpsertKpiRecords(
            IPluginExecutionContext context,
            List<KpiGroup> kpiGroups,
            string agentId,
            AgentMetadata agentMetadata)
        {
            var groupResults = new Dictionary<int, bool>();

            var requestWithResults = new ExecuteMultipleRequest
            {
                Requests = new OrganizationRequestCollection(),
                Settings = new ExecuteMultipleSettings
                {
                    ContinueOnError = true,
                    ReturnResponses = true
                }
            };

            foreach (var kpi in kpiGroups)
            {
                // Build entity with alternate key for upsert
                var entity = new Entity(MetricsTableLogicalName);
                
                // Set alternate key attributes for matching existing records


                entity.KeyAttributes["cat_conversationdate"] = kpi.ConversationDate.Date;
                entity.KeyAttributes["cat_agentconfigurationname"] = agentMetadata.AgentConfigurationName;
                entity.KeyAttributes["cat_channelid"] = kpi.ChannelId;
                entity.KeyAttributes["cat_datasourcecode"] = new OptionSetValue(kpi.DataSourceCode);

                // Determine data source name for primary name field
                string dataSourceName = kpi.DataSourceCode == 2 ? "TestData" : "Production";

                entity["cat_agentid"] = agentId;

                // Primary name
                entity["cat_transcriptmetricname"] = $"{kpi.ConversationDate.Date:yyyy-MM-dd}-{agentMetadata.AgentConfigurationName}-{kpi.ChannelId}-{dataSourceName}";
                entity["cat_agentconfigurationname"] = agentMetadata.AgentConfigurationName;

                entity["cat_datasourcecode"] = new OptionSetValue(kpi.DataSourceCode);
                // agentMetadata.AgentConfigurationId is a GUID string and not null/empty here
                if (Guid.TryParse(agentMetadata.AgentConfigurationId, out Guid configId))
                {
                    entity["cat_agentconfigurationid"] = new EntityReference("cat_copilotconfiguration", configId);
                }
                else
                {
                    _tracingService.Trace($"Invalid AgentConfigurationId GUID format: {agentMetadata.AgentConfigurationId}. Skipping configuration reference.");
                }

                // KPI columns
                entity["cat_totalconversations"] = kpi.TotalConversations;
                entity["cat_sessioncount"] = kpi.SessionCount;
                entity["cat_engagedcount"] = kpi.EngagedCount;
                entity["cat_unengagedcount"] = kpi.UnengagedCount;
                entity["cat_resolvedcount"] = kpi.ResolvedCount;
                entity["cat_abandonedcount"] = kpi.AbandonedCount;
                entity["cat_escalatedcount"] = kpi.EscalatedCount;
                entity["cat_totalturns"] = kpi.TotalTurns;
                entity["cat_feedbacklikecount"] = kpi.FeedbackLikeCount;
                entity["cat_feedbackdislikecount"] = kpi.FeedbackDislikeCount;
                entity["cat_csatscore"] = kpi.CsatScore;
                entity["cat_csatcount"] = kpi.CsatCount;

                // Feedback details JSON
                if (kpi.FeedbackDetails != null && kpi.FeedbackDetails.Count > 0)
                {
                    entity["cat_feedbackdetails"] = JsonConvert.SerializeObject(kpi.FeedbackDetails);
                }

                // UpsertRequest: creates if not exists, updates if exists (based on alternate key)
                UpsertRequest request = new UpsertRequest() { Target = entity };
                requestWithResults.Requests.Add(request);
            }

            if (requestWithResults.Requests.Count == 0)
            {
                _tracingService.Trace("No records to upsert");
                context.OutputParameters["IsSuccess"] = true;
                context.OutputParameters["SuccessCount"] = 0;
                context.OutputParameters["FailureCount"] = 0;
                context.OutputParameters["ErrorMessage"] = string.Empty;
                return groupResults;
            }

            _tracingService.Trace($"Executing batch upsert for {requestWithResults.Requests.Count} records");

            var response = (ExecuteMultipleResponse)_organizationService.Execute(requestWithResults);

            // Check for errors and track per-group results
            int successCount = 0;
            int failureCount = 0;
            var errors = new List<string>();

            foreach (var responseItem in response.Responses)
            {
                if (responseItem.Fault != null)
                {
                    failureCount++;
                    groupResults[responseItem.RequestIndex] = false;
                    errors.Add($"Index {responseItem.RequestIndex}: {responseItem.Fault.Message}");
                }
                else
                {
                    successCount++;
                    groupResults[responseItem.RequestIndex] = true;
                }
            }

            _tracingService.Trace($"Upsert results - Success: {successCount}, Failures: {failureCount}");

            // Set output parameters with detailed results
            context.OutputParameters["IsSuccess"] = failureCount == 0;
            context.OutputParameters["SuccessCount"] = successCount;
            context.OutputParameters["FailureCount"] = failureCount;

            if (failureCount > 0)
            {
                string errorDetails = string.Join("; ", errors.Take(5));
                context.OutputParameters["ErrorMessage"] = $"Upsert completed with {failureCount} errors. First errors: {errorDetails}";
            }
            else
            {
                context.OutputParameters["ErrorMessage"] = string.Empty;
            }

            return groupResults;
        }

        /// <summary>
        /// Updates the workflow status on conversation records based on upsert results.
        /// </summary>
        /// <param name="kpiGroups">The KPI groups with source conversation IDs.</param>
        /// <param name="groupResults">Dictionary mapping group index to success/failure.</param>
        private void UpdateConversationWorkflowStatus(List<KpiGroup> kpiGroups, Dictionary<int, bool> groupResults)
        {
            const int BatchSize = 500; // Dataverse limit is 1000, using 500 for safety

            var updateRequests = new List<UpdateRequest>();

            for (int i = 0; i < kpiGroups.Count; i++)
            {
                // Determine status: 2 = Successful, 3 = Failed
                int statusCode = groupResults.ContainsKey(i) && groupResults[i] ? 2 : 3;

                foreach (var conversationId in kpiGroups[i].SourceConversationIds)
                {
                    if (conversationId != Guid.Empty)
                    {
                        var entity = new Entity(TranscriptTableLogicalName, conversationId);
                        entity["cat_workflowstatus"] = new OptionSetValue(statusCode);

                        updateRequests.Add(new UpdateRequest { Target = entity });
                    }
                }
            }

            if (updateRequests.Count == 0)
            {
                return;
            }

            _tracingService.Trace($"Updating workflow status for {updateRequests.Count} conversation records in batches of {BatchSize}");

            // Process in batches
            for (int batchStart = 0; batchStart < updateRequests.Count; batchStart += BatchSize)
            {
                var batch = updateRequests.Skip(batchStart).Take(BatchSize).ToList();

                var requestWithResults = new ExecuteMultipleRequest
                {
                    Requests = new OrganizationRequestCollection(),
                    Settings = new ExecuteMultipleSettings
                    {
                        ContinueOnError = true,
                        ReturnResponses = false
                    }
                };

                foreach (var request in batch)
                {
                    requestWithResults.Requests.Add(request);
                }

                _tracingService.Trace($"Executing batch {(batchStart / BatchSize) + 1} with {batch.Count} records");
                _organizationService.Execute(requestWithResults);
            }
        }

        /// <summary>
        /// Sets error response output parameters.
        /// </summary>
        private void SetErrorResponse(IPluginExecutionContext context, string errorMessage)
        {
            context.OutputParameters["IsSuccess"] = false;
            context.OutputParameters["SuccessCount"] = 0;
            context.OutputParameters["FailureCount"] = 1;
            context.OutputParameters["ErrorMessage"] = errorMessage;
        }
    }
}