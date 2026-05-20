// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Crm.Sdk.Messages;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Aggregates agent KPIs from conversation transcripts stored in Dataverse.
    /// </summary>
    public class AggregateAgentKPIs
    {
        private const string _transcriptTableLogicalName = "cat_agentinsightstranscriptstaging";
        private const string _metricsTableLogicalName = "cat_transcriptmetrics";

        private readonly IOrganizationService _organizationService;
        private readonly ITracingService _tracingService;

        /// <summary>
        /// Initializes a new instance of the <see cref="AggregateAgentKPIs"/> class.
        /// </summary>
        /// <param name="organizationService">The organization service for Dataverse operations.</param>
        /// <param name="tracingService">The tracing service for logging.</param>
        /// <exception cref="ArgumentNullException">Thrown when organizationService or tracingService is null.</exception>
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
            const string methodName = nameof(Execute);
            try
            {
                // 1. Extract input parameters
                string agentId = GetInputParameter<string>(context, "agentId");
                string agentConfigurationDetailsJson = GetInputParameter<string>(context, "agentConfigurationDetails");
                DateTime conversationDate = GetInputParameter<DateTime>(context, "conversationDate");
                string connectedAgentDefinitionsJson = GetInputParameter<string>(context, "connectedAgentDefinitions");
                var connectedAgentNameMap = GetConnectedAgentNameMap(connectedAgentDefinitionsJson);

                // 2. Validate inputs
                if (string.IsNullOrWhiteSpace(agentId))
                {
                    SetErrorResponse(context, $"{methodName}: agentId is required.");
                    throw new InvalidPluginExecutionException($"{methodName}: agentId is required.");
                }

                if (string.IsNullOrWhiteSpace(agentConfigurationDetailsJson))
                {
                    SetErrorResponse(context, $"{methodName}: agentConfigurationDetails is required.");
                    throw new InvalidPluginExecutionException($"{methodName}: agentConfigurationDetails is required.");
                }

                // 3. Parse agent configuration details
                AgentConfigurationDetails agentConfigurationDetails = null;
                try
                {
                    agentConfigurationDetails = JsonConvert.DeserializeObject<AgentConfigurationDetails>(agentConfigurationDetailsJson);
                }
                catch (Exception ex)
                {
                    SetErrorResponse(context, $"{methodName}: Failed to parse agentConfigurationDetails: {ex.Message}");
                    throw new InvalidPluginExecutionException($"{methodName}: Failed to parse agentConfigurationDetails: {ex.Message}", ex);
                }

                // 4. Conversation Date validation
                if (conversationDate == default(DateTime))
                {
                    throw new ArgumentException($"{methodName}: Conversation date is required.", nameof(conversationDate));
                }

                // 4. Fetch conversation records from Dataverse table
                List<ConversationRecord> conversations = FetchConversationRecords(agentId, agentConfigurationDetails, conversationDate);

                if (conversations == null || conversations.Count == 0)
                {
                    _tracingService.Trace($"{methodName}: No unprocessed conversation records found.");
                    context.OutputParameters["IsSuccess"] = true;
                    context.OutputParameters["SuccessCount"] = 0;
                    context.OutputParameters["FailureCount"] = 0;
                    context.OutputParameters["ErrorMessage"] = "No unprocessed records found.";
                    return;
                }

                _tracingService.Trace($"{methodName}: Processing {conversations.Count} conversations");

                // 5. Group and aggregate KPIs
                List<KpiGroup> kpiGroups = AggregateKpis(conversations, agentConfigurationDetails, connectedAgentNameMap);

                _tracingService.Trace($"{methodName}: Aggregated into {kpiGroups.Count} groups");

                // 6. Batch upsert using ExecuteMultipleRequest
                Dictionary<int, bool> groupResults = UpsertKpiRecords(context, kpiGroups, agentId, agentConfigurationDetails);

                // 7. Get conversation IDs by status for reporting
                GetConversationIdsByStatus(kpiGroups, groupResults, out List<Guid> successConversationGuids, out List<Guid> failedConversationGuids);

                context.OutputParameters["FailedConversationGuids"] = failedConversationGuids.Count > 0
                    ? failedConversationGuids.Select(g => g.ToString()).ToArray()
                    : Array.Empty<string>();

                context.OutputParameters["SuccessConversationGuids"] = successConversationGuids.Count > 0
                    ? successConversationGuids.Select(g => g.ToString()).ToArray()
                    : Array.Empty<string>();

                _tracingService.Trace($"{methodName}: AggregateAgentKPIs completed successfully");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                string errorMsg = $"{methodName}: An error occurred: {ex.Message}";
                SetErrorResponse(context, errorMsg);
                throw new InvalidPluginExecutionException(errorMsg, ex);
            }
        }

        /// <summary>
        /// Gets an input parameter from the context.
        /// </summary>
        /// <typeparam name="T">The type of the parameter value.</typeparam>
        /// <param name="context">The plugin execution context.</param>
        /// <param name="parameterName">The name of the input parameter to retrieve.</param>
        /// <returns>The parameter value if found; otherwise, the default value of type T.</returns>
        private T GetInputParameter<T>(IPluginExecutionContext context, string parameterName)
        {
            if (context.InputParameters.Contains(parameterName))
            {
                return (T)context.InputParameters[parameterName];
            }
            return default;
        }

        private Dictionary<string, string> GetConnectedAgentNameMap(string connectedAgentDefinitionsJson)
        {
            const string methodName = nameof(GetConnectedAgentNameMap);
            var connectedAgentNameMap = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            if (string.IsNullOrWhiteSpace(connectedAgentDefinitionsJson))
            {
                _tracingService.Trace($"{methodName}: No connected agent definitions input parameter found");
                return connectedAgentNameMap;
            }

            try
            {
                var definitions = JsonConvert.DeserializeObject<List<ConnectedAgentDefinitionInput>>(connectedAgentDefinitionsJson);
                if (definitions == null)
                {
                    return connectedAgentNameMap;
                }

                foreach (var definition in definitions)
                {
                    if (string.IsNullOrWhiteSpace(definition?.SchemaName))
                    {
                        continue;
                    }

                    connectedAgentNameMap[definition.SchemaName.Trim()] = string.IsNullOrWhiteSpace(definition.Name)
                        ? definition.SchemaName.Trim()
                        : definition.Name.Trim();
                }

                _tracingService.Trace($"{methodName}: Loaded {connectedAgentNameMap.Count} connected agent definitions from input parameter");
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"{methodName}: Failed to parse connected agent definitions input parameter: {ex.Message}");
            }

            return connectedAgentNameMap;
        }

        /// <summary>
        /// Fetches unprocessed conversation records from the cat_agentinsightstranscriptstaging table.
        /// Handles paging to retrieve all matching records.
        /// </summary>
        /// <param name="agentId">The agent identifier to filter conversations.</param>
        /// <param name="agentConfigurationDetails">The agent configuration details containing filter criteria.</param>
        /// <param name="conversationDate">The date to filter conversations by.</param>
        /// <returns>A list of conversation records matching the filter criteria.</returns>
        private List<ConversationRecord> FetchConversationRecords(string agentId, AgentConfigurationDetails agentConfigurationDetails, DateTime conversationDate)
        {
            const string methodName = nameof(FetchConversationRecords);
            var query = new QueryExpression(_transcriptTableLogicalName)
            {
                ColumnSet = new ColumnSet(
                    "cat_name",
                    "cat_agentconversation",
                    "cat_agentname",
                    "cat_conversationid",
                    "cat_conversationdate",
                    "cat_datasourcecode",
                    "cat_channelid",
                    "cat_sessioninfo",
                    "cat_feedbackdetails",
                    "cat_connectedagentdetails",
                    "cat_runs",
                    "cat_successfulruns",
                    "cat_totaldurationseconds"
                ),
                PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = 1,
                    ReturnTotalRecordCount = false
                }
            };

            // Filter by agent configuration
            if (!string.IsNullOrEmpty(agentConfigurationDetails?.AgentConfigurationId) &&
                Guid.TryParse(agentConfigurationDetails.AgentConfigurationId, out Guid configId))
            {
                query.Criteria.AddCondition("cat_agentconfiguration", ConditionOperator.Equal, configId);
            }
            query.Criteria.AddCondition("cat_conversationdate", ConditionOperator.On, conversationDate.Date);
            var conversations = new List<ConversationRecord>();

            // Paging loop to retrieve all records
            while (true)
            {
                var results = _organizationService.RetrieveMultiple(query);
                foreach (var entity in results.Entities)
                {
                    var dateValue = entity.GetAttributeValue<DateTime?>("cat_conversationdate");
                    var record = new ConversationRecord
                    {
                        EntityId = entity.Id,
                        Name = entity.GetAttributeValue<string>("cat_name"),
                        AgentName = entity.GetAttributeValue<string>("cat_agentname"),
                        ConversationId = entity.GetAttributeValue<string>("cat_conversationid"),
                        ConversationDate = dateValue.Value.Date.ToString("yyyy-MM-dd"),
                        DataSourceCode = entity.GetAttributeValue<OptionSetValue>("cat_datasourcecode")?.Value ?? 1,
                        ChannelId = entity.GetAttributeValue<string>("cat_channelid"),
                        RunCount = entity.GetAttributeValue<int>("cat_runs"),
                        SuccessfulRunCount = entity.GetAttributeValue<int>("cat_successfulruns"),
                        TotalDurationSeconds = entity.GetAttributeValue<int>("cat_totaldurationseconds")
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
                            _tracingService.Trace($"{methodName}: Failed to parse SessionInfo for {record.ConversationId}: {ex.Message}");
                        }
                    }

                    string feedbackDetailsJson = entity.GetAttributeValue<string>("cat_feedbackdetails");
                    if (!string.IsNullOrEmpty(feedbackDetailsJson))
                    {
                        try
                        {
                            record.FeedbackDetails = JsonConvert.DeserializeObject<List<FeedbackDetailRecord>>(feedbackDetailsJson);
                        }
                        catch (Exception ex)
                        {
                            _tracingService.Trace($"{methodName}: Failed to parse FeedbackDetails for {record.ConversationId}: {ex.Message}");
                        }
                    }

                    string connectedAgentDetailsJson = entity.GetAttributeValue<string>("cat_connectedagentdetails");
                    if (!string.IsNullOrEmpty(connectedAgentDetailsJson))
                    {
                        try
                        {
                            record.ConnectedAgentDetails = JsonConvert.DeserializeObject<List<ConnectedAgentDetailRecord>>(connectedAgentDetailsJson);
                        }
                        catch (Exception ex)
                        {
                            _tracingService.Trace($"{methodName}: Failed to parse ConnectedAgentDetails for {record.ConversationId}: {ex.Message}");
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

            _tracingService.Trace($"{methodName}: Retrieved {conversations.Count} total conversation records");
            return conversations;
        }

        /// <summary>
        /// Aggregates KPIs by grouping conversations by conversationDate, channelId, and dataSourceCode.
        /// </summary>
        /// <param name="conversations">The list of conversation records to aggregate.</param>
        /// <param name="agentConfigurationDetails">The agent configuration details.</param>
        /// <returns>A list of KPI groups with aggregated metrics.</returns>
        private List<KpiGroup> AggregateKpis(
            List<ConversationRecord> conversations,
            AgentConfigurationDetails agentConfigurationDetails,
            Dictionary<string, string> connectedAgentNameMap)
        {
            const string methodName = nameof(AggregateKpis);
            var groups = conversations
                .GroupBy(c => new { c.ChannelId, c.DataSourceCode })
                .Select(g =>
                {
                    // Get ConversationDate from first conversation in group (all should have same date)
                    var firstConversation = g.First();
                    // Parse the ConversationDate string back to DateTime
                    DateTime conversationDate;
                    if (!DateTime.TryParse(firstConversation.ConversationDate, out conversationDate))
                    {
                        throw new InvalidPluginExecutionException($"{methodName}: Invalid or empty ConversationDate for conversation {firstConversation.ConversationId}.");
                    }
                    // Use DataSourceCode from the grouped key
                    int dataSourceCode = g.Key.DataSourceCode;
                    var kpi = new KpiGroup
                    {
                        ConversationDate = conversationDate,
                        ChannelId = g.Key.ChannelId ?? "Unknown",
                        AgentName = firstConversation.AgentName,
                        DataSourceCode = dataSourceCode,
                        TotalConversations = string.Equals(g.Key.ChannelId, "pva-autonomous", StringComparison.OrdinalIgnoreCase)
                            ? 0
                            : g.Select(c => c.Name).Where(n => !string.IsNullOrEmpty(n)).Distinct().Count(),
                        SourceConversationIds = g.Select(c => c.EntityId).ToList()
                    };

                    foreach (var conversation in g)
                    {
                        // Process all SessionInfo items
                        ProcessSessionInfoItems(conversation.SessionInfo, kpi, string.Equals(kpi.ChannelId, "pva-autonomous", StringComparison.OrdinalIgnoreCase));
                        kpi.RunCount += conversation.RunCount;
                        kpi.SuccessfulRunCount += conversation.SuccessfulRunCount;
                        kpi.TotalDurationSeconds += conversation.TotalDurationSeconds;
                        AggregateConnectedAgentDetails(conversation.ConnectedAgentDetails, kpi, connectedAgentNameMap);
                        // Aggregate pre-processed feedback details
                        if (conversation.FeedbackDetails != null)
                        {
                            foreach (var feedbackDetail in conversation.FeedbackDetails)
                            {
                                if (string.Equals(feedbackDetail.FeedbackReaction, "like", StringComparison.OrdinalIgnoreCase))
                                    kpi.FeedbackLikeCount++;
                                else if (string.Equals(feedbackDetail.FeedbackReaction, "dislike", StringComparison.OrdinalIgnoreCase))
                                    kpi.FeedbackDislikeCount++;
                                // Add pre-processed feedback detail directly
                                kpi.FeedbackDetails.Add(feedbackDetail);
                            }
                        }
                    }

                    if (kpi.RunCount > 0)
                    {
                        kpi.AverageDurationSeconds = (int)Math.Floor((double)kpi.TotalDurationSeconds / kpi.RunCount);
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
        /// <param name="context">The plugin execution context.</param>
        /// <param name="kpiGroups">The list of KPI groups to upsert.</param>
        /// <param name="agentId">The agent identifier.</param>
        /// <param name="agentConfigurationDetails">The agent configuration details.</param>
        /// <returns>Dictionary mapping KPI group index to success status.</returns>
        private Dictionary<int, bool> UpsertKpiRecords(
            IPluginExecutionContext context,
            List<KpiGroup> kpiGroups,
            string agentId,
            AgentConfigurationDetails agentConfigurationDetails)
        {
            const string methodName = nameof(UpsertKpiRecords);
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

            // Track KPI group identifiers for error reporting
            var requestIndexToKpiInfo = new List<(DateTime ConversationDate, string ChannelId, int DataSourceCode, string AgentConfigName)>();

            foreach (var kpi in kpiGroups)
            {
                // Build entity with alternate key for upsert
                var entity = new Entity(_metricsTableLogicalName);
                
                // Set alternate key attributes for matching existing records
                entity.KeyAttributes["cat_conversationdate"] = kpi.ConversationDate.Date;
                entity.KeyAttributes["cat_agentconfiguration"] = new EntityReference("cat_copilotconfiguration", Guid.Parse(agentConfigurationDetails.AgentConfigurationId));
                entity.KeyAttributes["cat_channelid"] = kpi.ChannelId;
                entity.KeyAttributes["cat_datasourcecode"] = new OptionSetValue(kpi.DataSourceCode);

                // Determine data source name for primary name field
                string dataSourceName = kpi.DataSourceCode == 2 ? "TestData" : "Production";
                entity["cat_agentid"] = agentId;

                // Primary name
                entity["cat_transcriptmetricname"] = $"{kpi.ConversationDate.Date:yyyy-MM-dd}-{agentConfigurationDetails.AgentConfigurationName}-{kpi.ChannelId}-{dataSourceName}";
                entity["cat_datasourcecode"] = new OptionSetValue(kpi.DataSourceCode);
                entity["cat_agentname"] = kpi.AgentName;

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
                entity["cat_runs"] = kpi.RunCount;
                entity["cat_successfulruns"] = kpi.SuccessfulRunCount;
                entity["cat_averagedurationseconds"] = kpi.AverageDurationSeconds;
                entity["cat_connectedagentdetails"] = kpi.ConnectedAgentSummaries.Count > 0
                    ? JsonConvert.SerializeObject(kpi.ConnectedAgentSummaries)
                    : null;

                // Note: Feedback details file upload happens after upsert in UploadFeedbackDetailsFile()

                // UpsertRequest: creates if not exists, updates if exists (based on alternate key)
                UpsertRequest request = new UpsertRequest() { Target = entity };
                requestWithResults.Requests.Add(request);
                requestIndexToKpiInfo.Add((kpi.ConversationDate, kpi.ChannelId, kpi.DataSourceCode, agentConfigurationDetails.AgentConfigurationName));
            }

            if (requestWithResults.Requests.Count == 0)
            {
                _tracingService.Trace($"{methodName}: No records to upsert");
                context.OutputParameters["IsSuccess"] = true;
                context.OutputParameters["SuccessCount"] = 0;
                context.OutputParameters["FailureCount"] = 0;
                context.OutputParameters["ErrorMessage"] = string.Empty;
                return groupResults;
            }

            _tracingService.Trace($"{methodName}: Executing batch upsert for {requestWithResults.Requests.Count} records");
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
                    var kpiInfo = requestIndexToKpiInfo.Count > responseItem.RequestIndex
                        ? requestIndexToKpiInfo[responseItem.RequestIndex]
                        : (ConversationDate: DateTime.MinValue, ChannelId: "Unknown", DataSourceCode: 0, AgentConfigName: "Unknown");
                    errors.Add($"{methodName}: AgentConfigurationName: {kpiInfo.AgentConfigName}, Date: {kpiInfo.ConversationDate:yyyy-MM-dd}, ChannelId: {kpiInfo.ChannelId}, DataSourceCode: {kpiInfo.DataSourceCode} - {responseItem.Fault.Message}");
                }
                else
                {
                    successCount++;
                    groupResults[responseItem.RequestIndex] = true;
                }
            }

            _tracingService.Trace($"{methodName}: Upsert results - Success: {successCount}, Failures: {failureCount}");

            // After the ExecuteMultiple upsert completes successfully, upload or clear files
            foreach (var responseItem in response.Responses)
            {
                if (responseItem.Fault == null && responseItem.Response is UpsertResponse upsertResponse)
                {
                    var kpi = kpiGroups[responseItem.RequestIndex];
                    if (kpi.FeedbackDetails != null && kpi.FeedbackDetails.Count > 0)
                    {
                        UploadFeedbackDetailsFile(upsertResponse.Target, kpi);
                    }
                    else
                    {
                        ClearFeedbackDetailsFile(upsertResponse.Target);
                    }
                }
            }

            // Set output parameters with detailed results
            context.OutputParameters["IsSuccess"] = failureCount == 0;
            context.OutputParameters["SuccessCount"] = successCount;
            context.OutputParameters["FailureCount"] = failureCount;

            if (failureCount > 0)
            {
                string errorDetails = string.Join(";\n ", errors.Take(5));
                context.OutputParameters["ErrorMessage"] = $"{methodName}: Upsert completed with {failureCount} errors. First errors: {errorDetails}";
            }
            else
            {
                context.OutputParameters["ErrorMessage"] = string.Empty;
            }

            return groupResults;
        }

        private void AggregateConnectedAgentDetails(
            List<ConnectedAgentDetailRecord> connectedAgentDetails,
            KpiGroup kpi,
            Dictionary<string, string> connectedAgentNameMap)
        {
            if (connectedAgentDetails == null || connectedAgentDetails.Count == 0)
            {
                return;
            }

            foreach (var connectedAgentDetail in connectedAgentDetails)
            {
                if (string.IsNullOrWhiteSpace(connectedAgentDetail?.TaskDialogId))
                {
                    continue;
                }

                string agentName;
                if (!connectedAgentNameMap.TryGetValue(connectedAgentDetail.TaskDialogId, out agentName) || string.IsNullOrWhiteSpace(agentName))
                {
                    agentName = connectedAgentDetail.TaskDialogId;
                }

                var summary = kpi.ConnectedAgentSummaries.FirstOrDefault(s => 
                    string.Equals(s.AgentName, agentName, StringComparison.OrdinalIgnoreCase) && 
                    string.Equals(s.Type, connectedAgentDetail.Type, StringComparison.OrdinalIgnoreCase));
                if (summary == null)
                {
                    summary = new ConnectedAgentSummaryRecord
                    {
                        AgentName = agentName,
                        Type = connectedAgentDetail.Type ?? "Unknown"
                    };
                    kpi.ConnectedAgentSummaries.Add(summary);
                }

                summary.TotalCount++;
                if (connectedAgentDetail.IsSuccess)
                {
                    summary.SuccessCount++;
                }
            }
        }

        /// <summary>
        /// Sets error response output parameters.
        /// </summary>
        /// <param name="context">The plugin execution context to set output parameters on.</param>
        /// <param name="errorMessage">The error message to include in the response.</param>
        private void SetErrorResponse(IPluginExecutionContext context, string errorMessage)
        {
            context.OutputParameters["IsSuccess"] = false;
            context.OutputParameters["SuccessCount"] = 0;
            context.OutputParameters["FailureCount"] = 1;
            context.OutputParameters["ErrorMessage"] = errorMessage;
        }

        /// <summary>
        /// Gets the conversation IDs from groups, separated by success/failure status.
        /// </summary>
        /// <param name="kpiGroups">The KPI groups with source conversation IDs.</param>
        /// <param name="groupResults">Dictionary mapping group index to success/failure.</param>
        /// <param name="successGuids">Output list of successful conversation GUIDs.</param>
        /// <param name="failedGuids">Output list of failed conversation GUIDs.</param>
        private void GetConversationIdsByStatus(
            List<KpiGroup> kpiGroups,
            Dictionary<int, bool> groupResults,
            out List<Guid> successGuids,
            out List<Guid> failedGuids)
        {
            const string methodName = nameof(GetConversationIdsByStatus);
            successGuids = new List<Guid>();
            failedGuids = new List<Guid>();

            for (int i = 0; i < kpiGroups.Count; i++)
            {
                if (groupResults.TryGetValue(i, out bool success))
                {
                    var targetList = success ? successGuids : failedGuids;
                    var sourceIds = kpiGroups[i].SourceConversationIds;

                    for (int j = 0; j < sourceIds.Count; j++)
                    {
                        if (sourceIds[j] != Guid.Empty)
                        {
                            targetList.Add(sourceIds[j]);
                        }
                    }
                }
            }

            _tracingService.Trace($"{methodName}: Found {successGuids.Count} successful and {failedGuids.Count} failed conversation IDs");
        }

        /// <summary>
        /// Processes all SessionInfo items for a conversation and updates the KPI counters.
        /// </summary>
        /// <param name="sessionInfoList">The list of session info items to process.</param>
        /// <param name="kpi">The KPI group to update.</param>
        private void ProcessSessionInfoItems(List<SessionInfo> sessionInfoList, KpiGroup kpi, bool excludeSessionCount)
        {
            if (sessionInfoList == null)
            {
                return;
            }

            foreach (var sessionInfo in sessionInfoList)
            {
                var sessionValue = sessionInfo?.Value;
                if (sessionValue != null)
                {
                    // Increment session count
                    if (!excludeSessionCount)
                    {
                        kpi.SessionCount++;
                    }

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

        /// <summary>
        /// Uploads the feedback details file to Dataverse after upsert.
        /// </summary>
        /// <param name="target">The target entity reference where the file is associated.</param>
        /// <param name="kpi">The KPI group containing the feedback details.</param>
        private void UploadFeedbackDetailsFile(EntityReference target, KpiGroup kpi)
        {
            const string methodName = nameof(UploadFeedbackDetailsFile);

            try
            {
                _tracingService.Trace($"{methodName}: Starting file upload for entity {target.LogicalName} with Id {target.Id}");
                _tracingService.Trace($"{methodName}: Feedback details count: {kpi.FeedbackDetails?.Count ?? 0}");

                // Convert feedback details to JSON and then to byte array
                string feedbackJson = JsonConvert.SerializeObject(kpi.FeedbackDetails);
                byte[] fileContent = System.Text.Encoding.UTF8.GetBytes(feedbackJson);

                _tracingService.Trace($"{methodName}: File content size: {fileContent.Length} bytes");

                // Generate filename upfront - required for InitializeFileBlocksUploadRequest
                string fileName = $"feedback_{kpi.ConversationDate:yyyyMMdd}_{kpi.ChannelId}.json";

                // Initialize the file column upload - FileName is required
                var initRequest = new InitializeFileBlocksUploadRequest
                {
                    Target = target,
                    FileAttributeName = "cat_feedbackdetailsfile",
                    FileName = fileName
                };

                _tracingService.Trace($"{methodName}: Initializing file blocks upload for attribute: {initRequest.FileAttributeName}, FileName: {fileName}");

                var initResponse = (InitializeFileBlocksUploadResponse)_organizationService.Execute(initRequest);

                _tracingService.Trace($"{methodName}: File blocks upload initialized. FileContinuationToken received: {!string.IsNullOrEmpty(initResponse.FileContinuationToken)}");

                const int blockSize = 4 * 1024 * 1024; // 4 MB blocks
                var blockList = new List<string>();
                int blockIndex = 0;

                for (int offset = 0; offset < fileContent.Length; offset += blockSize)
                {
                    int bytesToCopy = Math.Min(blockSize, fileContent.Length - offset);
                    byte[] blockData = new byte[bytesToCopy];
                    Buffer.BlockCopy(fileContent, offset, blockData, 0, bytesToCopy);

                    string blockId = Convert.ToBase64String(System.Text.Encoding.UTF8.GetBytes($"block{blockIndex:D6}"));
                    blockList.Add(blockId);

                    var uploadRequest = new UploadBlockRequest
                    {
                        FileContinuationToken = initResponse.FileContinuationToken,
                        BlockData = blockData,
                        BlockId = blockId
                    };

                    _tracingService.Trace($"{methodName}: Uploading block {blockIndex + 1} ({bytesToCopy} bytes) with Id: {blockId}");

                    _organizationService.Execute(uploadRequest);
                    blockIndex++;
                }

                _tracingService.Trace($"{methodName}: Uploaded {blockList.Count} blocks. Committing file upload.");

                var commitRequest = new CommitFileBlocksUploadRequest
                {
                    FileContinuationToken = initResponse.FileContinuationToken,
                    FileName = fileName,
                    MimeType = "application/json",
                    BlockList = blockList.ToArray()
                };

                _organizationService.Execute(commitRequest);

                _tracingService.Trace($"{methodName}: File upload committed successfully for record Id: {target.Id}");
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"{methodName}: ERROR - File upload failed. Exception: {ex.Message}");
                _tracingService.Trace($"{methodName}: ERROR - Stack trace: {ex.StackTrace}");

                if (ex.InnerException != null)
                {
                    _tracingService.Trace($"{methodName}: ERROR - Inner exception: {ex.InnerException.Message}");
                }

                _tracingService.Trace($"{methodName}: Continuing execution despite file upload failure");
            }
        }

        /// <summary>
        /// Clears the feedback details file column on the Dataverse record when no feedback data exists.
        /// </summary>
        /// <param name="target">The target entity reference to clear the file from.</param>
        private void ClearFeedbackDetailsFile(EntityReference target)
        {
            const string methodName = nameof(ClearFeedbackDetailsFile);
            try
            {
                // Retrieve the file column to check if an existing file needs to be removed
                var entity = _organizationService.Retrieve(
                    target.LogicalName,
                    target.Id,
                    new ColumnSet("cat_feedbackdetailsfile"));

                var fileId = entity.GetAttributeValue<Guid>("cat_feedbackdetailsfile");
                if (fileId == Guid.Empty)
                {
                    _tracingService.Trace($"{methodName}: No existing feedback file to clear for record {target.Id}");
                    return;
                }

                var deleteRequest = new DeleteFileRequest { FileId = fileId };
                _organizationService.Execute(deleteRequest);
                _tracingService.Trace($"{methodName}: Cleared feedback details file for record {target.Id}");
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"{methodName}: Failed to clear feedback details file: {ex.Message}");
                _tracingService.Trace($"{methodName}: Continuing execution despite file clear failure");
            }
        }
    }
}