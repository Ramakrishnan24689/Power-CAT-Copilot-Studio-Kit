// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json.Linq;
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

            var botMessagesDictionary = model
                .Where(activity => activity.type == "message" &&
                                   activity.from != null &&
                                   activity.from.role == 0 &&
                                   !string.IsNullOrEmpty(activity.id) &&
                                   !string.IsNullOrEmpty(activity.text))
                .GroupBy(activity => activity.id)
                .ToDictionary(group => group.Key, group => group.Last().text);

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
                if (!string.IsNullOrEmpty(feedback.replyToId) &&
                    botMessagesDictionary.TryGetValue(feedback.replyToId, out string message))
                {
                    agentMessage = message;
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
}