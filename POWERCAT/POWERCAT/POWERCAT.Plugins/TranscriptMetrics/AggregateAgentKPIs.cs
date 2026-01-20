// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Aggregates agent KPIs from conversation transcripts.
    /// </summary>
    public class AggregateAgentKPIs
    {
        private const string TableLogicalName = "cat_transcriptmetrics";

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
                string resultJson = GetInputParameter<string>(context, "resultJson");

                // 2. Validate inputs
                if (string.IsNullOrWhiteSpace(agentId))
                {
                    SetErrorResponse(context, "agentId is required.");
                    throw new InvalidPluginExecutionException("agentId is required.");
                }

                if (string.IsNullOrWhiteSpace(resultJson))
                {
                    SetErrorResponse(context, "resultJson is required.");
                    throw new InvalidPluginExecutionException("resultJson is required.");
                }

                // 3. Parse JSON
                List<ConversationRecord> conversations = ParseJson(resultJson);

                if (conversations == null || conversations.Count == 0)
                {
                    SetErrorResponse(context, "resultJson must contain a valid non-empty JSON array.");
                    return;
                }

                _tracingService.Trace($"Processing {conversations.Count} conversations");

                // 5. Group and aggregate KPIs
                List<KpiGroup> kpiGroups = AggregateKpis(conversations);

                _tracingService.Trace($"Aggregated into {kpiGroups.Count} groups");

                // 6. Batch upsert using ExecuteMultipleRequest
                UpsertKpiRecords(context, kpiGroups, agentId);

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
        /// Parses the JSON string into a list of conversation records.
        /// </summary>
        private List<ConversationRecord> ParseJson(string json)
        {
            try
            {
                return JsonConvert.DeserializeObject<List<ConversationRecord>>(json);
            }
            catch (Exception ex)
            {
                throw new InvalidPluginExecutionException($"Failed to parse resultJson: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Aggregates KPIs by grouping conversations by conversationDate, channelId, and dataSourceCode.
        /// </summary>
        private List<KpiGroup> AggregateKpis(List<ConversationRecord> conversations)
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
                .Where(c => !string.IsNullOrWhiteSpace(c.ConversationDate) && DateTime.TryParse(c.ConversationDate, out _))
                .GroupBy(c => new {  c.ChannelId, c.IsDesignMode })
                .Select(g =>
                {
                    // Get ConversationDate from first conversation in group (all should have same date)
                    var firstConversation = g.First();
                    DateTime.TryParse(firstConversation.ConversationDate, out DateTime parsedDate);
                    // Derive DataSourceCode from IsDesignMode: Production (1) if false, TestData (2) if true
                    int dataSourceCode = g.Key.IsDesignMode ? 2 : 1;
                    var kpi = new KpiGroup
                    {
                        ConversationDate = parsedDate,
                        ChannelId = g.Key.ChannelId ?? string.Empty,
                        DataSourceCode = dataSourceCode,
                        TotalConversations = g.Count()
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
        private void UpsertKpiRecords(
            IPluginExecutionContext context,
            List<KpiGroup> kpiGroups,
            string agentId)
        {
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
                var entity = new Entity(TableLogicalName);

                // Set alternate key attributes for matching existing records
                entity.KeyAttributes["cat_conversationdate"] = kpi.ConversationDate;
                entity.KeyAttributes["cat_agentid"] = agentId;
                entity.KeyAttributes["cat_channelid"] = kpi.ChannelId;
                entity.KeyAttributes["cat_datasourcecode"] = new OptionSetValue(kpi.DataSourceCode);

                // Determine data source name for primary name field
                string dataSourceName = kpi.DataSourceCode == 2 ? "TestData" : "Production";

                // Primary name
                entity["cat_transcriptmetricname"] = $"{kpi.ConversationDate:yyyy-MM-dd}-{agentId}-{kpi.ChannelId}-{dataSourceName}";

                entity["cat_datasourcecode"] = new OptionSetValue(kpi.DataSourceCode);

                // KPI columns
                entity["cat_totalconversations"] = kpi.TotalConversations;
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
                return;
            }

            _tracingService.Trace($"Executing batch upsert for {requestWithResults.Requests.Count} records");

            var response = (ExecuteMultipleResponse)_organizationService.Execute(requestWithResults);

            // Check for errors
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