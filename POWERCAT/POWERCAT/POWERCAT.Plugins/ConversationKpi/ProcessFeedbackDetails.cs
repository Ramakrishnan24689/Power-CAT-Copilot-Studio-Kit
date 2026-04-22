// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Class module for Feedback Details
    /// </summary>
    public class ProcessFeedbackDetails
    {
        /// <summary>
        /// Generate Feedback Details KPIs
        /// </summary>
        /// <param name="model">Transcript Activity Model</param>
        /// <param name="conversationId">Conversation Id</param>
        /// <param name="agentId">Agent Id</param>
        /// <returns>Feedback Details List</returns>
        public List<FeedbackDetails> ProcessForFeedbackDetails(List<Activity> model, string conversationId, string agentId)
        {
            if (model == null || model.Count == 0)
            {
                return new List<FeedbackDetails>();
            }

            var messageActivitiesDictionary = model
                .Where(activity => activity.type == "message" &&
                                   activity.from != null &&
                                   !string.IsNullOrEmpty(activity.id))
                .GroupBy(activity => activity.id)
                .ToDictionary(group => group.Key, group => group.Last());

            var sessionInfoActivities = model
                .Where(activity => activity.valueType == "SessionInfo")
                .OrderBy(activity => activity.index)
                .ToList();

            var feedbackRows = model
                .Where(activity => activity.type == "invoke" &&
                                   activity.name == "message/submitAction" &&
                                   activity.valueToken?["actionName"]?.ToString() == "feedback")
                .ToList();

            var feedbackDetails = new List<FeedbackDetails>();

            foreach (var feedback in feedbackRows)
            {
                var reaction = feedback.valueToken?["actionValue"]?["reaction"]?.ToString();
                var feedbackValue = feedback.valueToken?["actionValue"]?["feedback"];
                var feedbackText = ExtractFeedbackText(feedbackValue);

                string agentMessage = null;
                string userMessage = null;
                if (!string.IsNullOrEmpty(feedback.replyToId) &&
                    messageActivitiesDictionary.TryGetValue(feedback.replyToId, out Activity agentMessageActivity))
                {
                    agentMessage = agentMessageActivity.text;

                    if (!string.IsNullOrEmpty(agentMessageActivity.replyToId) &&
                        messageActivitiesDictionary.TryGetValue(agentMessageActivity.replyToId, out Activity userMessageActivity))
                    {
                        userMessage = userMessageActivity.text;
                    }
                }

                if (string.IsNullOrEmpty(reaction) && string.IsNullOrEmpty(feedbackText))
                {
                    continue;
                }

                var nextSession = sessionInfoActivities.FirstOrDefault(session => session.index > feedback.index);

                feedbackDetails.Add(new FeedbackDetails
                {
                    SessionID = $"{agentId}-{conversationId}-{nextSession?.timestamp}-{nextSession?.id}",
                    AgentMessage = agentMessage,
                    UserMessage = userMessage,
                    FeedbackText = feedbackText,
                    FeedbackReaction = reaction
                });
            }

            return feedbackDetails;
        }

        /// <summary>
        /// Extracts the feedback text from a feedback payload.
        /// </summary>
        /// <param name="feedbackValue">The feedback payload token.</param>
        /// <returns>The extracted feedback text, or <c>null</c> if unavailable.</returns>
        private static string ExtractFeedbackText(JToken feedbackValue)
        {
            if (feedbackValue == null)
            {
                return null;
            }

            if (feedbackValue.Type == JTokenType.Object)
            {
                return feedbackValue["feedbackText"]?.ToString();
            }

            if (feedbackValue.Type == JTokenType.String)
            {
                var feedbackString = feedbackValue.ToString();
                if (string.IsNullOrWhiteSpace(feedbackString))
                {
                    return null;
                }

                try
                {
                    var parsedFeedback = JObject.Parse(feedbackString);
                    return parsedFeedback["feedbackText"]?.ToString();
                }
                catch
                {
                    return feedbackString;
                }
            }

            return feedbackValue.ToString();
        }
    }

    /// <summary>
    /// Class module for Knowledge Source Usage.
    /// </summary>
    public class ProcessKnowledgeSourceUsage
    {
        /// <summary>
        /// Generate Knowledge Source Usage KPIs.
        /// </summary>
        /// <param name="model">Transcript Activity Model.</param>
        /// <param name="conversationId">Conversation Id.</param>
        /// <param name="agentId">Agent Id.</param>
        /// <returns>Knowledge Source Usage List.</returns>
        public List<KnowledgeSourceUsage> ProcessForKnowledgeSourceUsage(List<Activity> model, string conversationId, string agentId)
        {
            if (model == null || model.Count == 0)
            {
                return new List<KnowledgeSourceUsage>();
            }

            var sessionInfoActivities = model
                .Where(activity => string.Equals(activity.valueType, "SessionInfo", StringComparison.OrdinalIgnoreCase))
                .OrderBy(activity => activity.index)
                .ToList();

            var searchQueryContexts = BuildSearchQueryContexts(model);
            var knowledgeSourceMap = new Dictionary<string, KnowledgeSourceUsage>(StringComparer.OrdinalIgnoreCase);

            foreach (var activity in model.OrderBy(currentActivity => currentActivity.index))
            {
                if (IsActivityMatch(activity, "UniversalSearchToolTraceData"))
                {
                    UpsertKnowledgeSources(knowledgeSourceMap, sessionInfoActivities, searchQueryContexts, activity, agentId, conversationId, true, false, false, "knowledgeSources");
                    UpsertKnowledgeSources(knowledgeSourceMap, sessionInfoActivities, searchQueryContexts, activity, agentId, conversationId, false, true, false, "outputKnowledgeSources");
                }

                if (IsActivityMatch(activity, "KnowledgeTraceData"))
                {
                    UpsertKnowledgeSources(knowledgeSourceMap, sessionInfoActivities, searchQueryContexts, activity, agentId, conversationId, false, false, true, "citedKnowledgeSources");
                }
            }

            return knowledgeSourceMap.Values
                .OrderBy(item => item.SessionID)
                .ThenBy(item => item.UserQuery)
                .ThenBy(item => item.KnowledgeSourceID)
                .ToList();
        }

        private static List<SearchQueryContext> BuildSearchQueryContexts(List<Activity> model)
        {
            return model
                .Where(activity => IsActivityMatch(activity, "DynamicPlanStepBindUpdate"))
                .Select(activity => new SearchQueryContext
                {
                    Index = activity.index,
                    SearchQuery = GetSearchQuery(activity),
                    StepKeys = GetActivityStepKeys(activity)
                })
                .Where(context => !string.IsNullOrWhiteSpace(context.SearchQuery))
                .OrderBy(context => context.Index)
                .ToList();
        }

        private static void UpsertKnowledgeSources(
            Dictionary<string, KnowledgeSourceUsage> knowledgeSourceMap,
            List<Activity> sessionInfoActivities,
            List<SearchQueryContext> searchQueryContexts,
            Activity activity,
            string agentId,
            string conversationId,
            bool available,
            bool used,
            bool cited,
            string propertyName)
        {
            foreach (var sourceId in GetKnowledgeSourceIds(activity.valueToken, propertyName))
            {
                var nextSession = sessionInfoActivities.FirstOrDefault(session => session.index > activity.index);
                var sessionId = $"{agentId}-{conversationId}-{nextSession?.timestamp}-{nextSession?.id}";
                var userQuery = ResolveUserQuery(searchQueryContexts, activity);
                var mergeKey = string.Join("|", sessionId ?? string.Empty, sourceId, userQuery ?? string.Empty);

                if (!knowledgeSourceMap.TryGetValue(mergeKey, out KnowledgeSourceUsage usage))
                {
                    usage = new KnowledgeSourceUsage
                    {
                        SessionID = sessionId,
                        KnowledgeSourceID = sourceId,
                        KnowledgeSourceType = GetKnowledgeSourceType(sourceId),
                        UserQuery = userQuery,
                    };
                    knowledgeSourceMap[mergeKey] = usage;
                }

                usage.Available = usage.Available || available;
                usage.Used = usage.Used || used;
                usage.Cited = usage.Cited || cited;
            }
        }

        private static string ResolveUserQuery(List<SearchQueryContext> searchQueryContexts, Activity activity)
        {
            var activityStepKeys = GetActivityStepKeys(activity);

            var queryContext = searchQueryContexts
                .Where(context => context.Index <= activity.index)
                .LastOrDefault(context => activityStepKeys.Count > 0 && context.StepKeys.Overlaps(activityStepKeys));

            if (queryContext != null)
            {
                return queryContext.SearchQuery;
            }

            return searchQueryContexts
                .Where(context => context.Index <= activity.index)
                .Select(context => context.SearchQuery)
                .LastOrDefault();
        }

        private static string GetSearchQuery(Activity activity)
        {
            return GetPropertyValue(activity.valueToken, "search_query")
                ?? GetPropertyValue(activity.valueToken, "searchQuery")
                ?? GetPropertyValue(activity.valueToken, "userQuery")
                ?? GetPropertyValue(activity.valueToken, "query");
        }

        private static HashSet<string> GetActivityStepKeys(Activity activity)
        {
            var stepKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            AddStepKey(stepKeys, activity.id);
            AddStepKey(stepKeys, activity.replyToId);
            AddStepKey(stepKeys, activity.value?.id);
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "id"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "stepId"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "planStepId"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "dynamicPlanStepId"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "toolCallId"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "activityId"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "parentActivityId"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "relatedActivityId"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "step.id"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "step.stepId"));
            AddStepKey(stepKeys, GetPropertyValue(activity.valueToken, "step.activityId"));
            return stepKeys;
        }

        private static void AddStepKey(HashSet<string> stepKeys, string candidate)
        {
            if (!string.IsNullOrWhiteSpace(candidate))
            {
                stepKeys.Add(candidate);
            }
        }

        private static IEnumerable<string> GetKnowledgeSourceIds(JToken token, string propertyName)
        {
            var propertyValue = FindPropertyValue(token, propertyName);
            if (propertyValue == null)
            {
                return Enumerable.Empty<string>();
            }

            var sourceIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            CollectKnowledgeSourceIds(propertyValue, sourceIds);
            return sourceIds;
        }

        private static void CollectKnowledgeSourceIds(JToken token, HashSet<string> sourceIds)
        {
            if (token == null)
            {
                return;
            }

            if (token.Type == JTokenType.String)
            {
                var candidate = token.ToString();
                if (IsLogicalKnowledgeSource(candidate))
                {
                    sourceIds.Add(candidate);
                }

                return;
            }

            if (token.Type == JTokenType.Array)
            {
                foreach (var child in token.Children())
                {
                    CollectKnowledgeSourceIds(child, sourceIds);
                }

                return;
            }

            if (token.Type == JTokenType.Object)
            {
                foreach (var property in token.Children<JProperty>())
                {
                    CollectKnowledgeSourceIds(property.Value, sourceIds);
                }
            }
        }

        private static bool IsLogicalKnowledgeSource(string sourceId)
        {
            if (string.IsNullOrWhiteSpace(sourceId))
            {
                return false;
            }

            if (Uri.IsWellFormedUriString(sourceId, UriKind.Absolute))
            {
                return false;
            }

            if (string.Equals(sourceId, "BingUnscopedSearchKnowledge", StringComparison.OrdinalIgnoreCase)
                || string.Equals(sourceId, "AzoresBingScopedSearch", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (sourceId.IndexOf(".knowledge.PublicSiteSearchSource.", StringComparison.OrdinalIgnoreCase) >= 0
                || sourceId.IndexOf(".knowledge.searchcontent.PublicSiteSearch.", StringComparison.OrdinalIgnoreCase) >= 0
                || sourceId.IndexOf(".action.", StringComparison.OrdinalIgnoreCase) >= 0
                || sourceId.IndexOf("turn", StringComparison.OrdinalIgnoreCase) == 0)
            {
                return false;
            }

            return sourceId.IndexOf(".topic.", StringComparison.OrdinalIgnoreCase) >= 0
                || sourceId.IndexOf(".file.", StringComparison.OrdinalIgnoreCase) >= 0
                || sourceId.IndexOf(".knowledge.", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static string GetKnowledgeSourceType(string sourceId)
        {
            if (sourceId.IndexOf(".topic.", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return "Topic";
            }

            if (sourceId.IndexOf(".file.", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return "File";
            }

            if (sourceId.IndexOf(".knowledge.", StringComparison.OrdinalIgnoreCase) >= 0)
            {
                return "Knowledge";
            }

            return string.Empty;
        }

        private static bool IsActivityMatch(Activity activity, string value)
        {
            return string.Equals(activity?.valueType, value, StringComparison.OrdinalIgnoreCase)
                || string.Equals(activity?.name, value, StringComparison.OrdinalIgnoreCase)
                || string.Equals(activity?.type, value, StringComparison.OrdinalIgnoreCase);
        }

        private static string GetPropertyValue(JToken token, string propertyPath)
        {
            var propertyValue = FindPropertyValue(token, propertyPath);
            return propertyValue == null || propertyValue.Type == JTokenType.Null
                ? null
                : propertyValue.ToString();
        }

        private static JToken FindPropertyValue(JToken token, string propertyPath)
        {
            if (token == null || string.IsNullOrWhiteSpace(propertyPath))
            {
                return null;
            }

            var pathSegments = propertyPath.Split('.');
            return FindPropertyValue(token, pathSegments, 0);
        }

        private static JToken FindPropertyValue(JToken token, string[] pathSegments, int depth)
        {
            if (token == null)
            {
                return null;
            }

            if (depth >= pathSegments.Length)
            {
                return token;
            }

            if (token.Type == JTokenType.Object)
            {
                var currentSegment = pathSegments[depth];
                foreach (var property in token.Children<JProperty>())
                {
                    if (string.Equals(property.Name, currentSegment, StringComparison.OrdinalIgnoreCase))
                    {
                        var matchedValue = FindPropertyValue(property.Value, pathSegments, depth + 1);
                        if (matchedValue != null)
                        {
                            return matchedValue;
                        }
                    }

                    var nestedValue = FindPropertyValue(property.Value, pathSegments, depth);
                    if (nestedValue != null)
                    {
                        return nestedValue;
                    }
                }
            }
            else if (token.Type == JTokenType.Array)
            {
                foreach (var child in token.Children())
                {
                    var nestedValue = FindPropertyValue(child, pathSegments, depth);
                    if (nestedValue != null)
                    {
                        return nestedValue;
                    }
                }
            }

            return null;
        }

        private class SearchQueryContext
        {
            public int Index { get; set; }
            public string SearchQuery { get; set; }
            public HashSet<string> StepKeys { get; set; } = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        }
    }
}