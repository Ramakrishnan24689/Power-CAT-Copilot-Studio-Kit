// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Class module for Session Insights
    /// </summary>
    public class ProcessSessionInsight
    {
        /// <summary>
        /// Generate Session Insights KPIs
        /// </summary>
        /// <param name="model">Transcript Activity Model</param>
        /// <param name="conversationId">Conversation Id</param>
        /// <param name="agentId">Agent Id</param>
        /// <returns>Session Details List.</returns>
        /// <exception cref="InvalidOperationException">Thrown when no session details are found.</exception>
        public List<SessionDetail> ProcessTranscript(List<Activity> model, string conversationId, string agentId)
        {
            var sessionDetails = model
                .Where(activity => activity.valueType == "SessionInfo" && activity.value != null)
                .Select(activity => new SessionDetail
                {
                    SessionID = $"{agentId}-{conversationId}-{activity.timestamp}-{activity.id}",
                    Engagement = activity.value.type,
                    Outcome = activity.value.outcome,
                    CSAT = activity.value.csatScore,
                    TurnCount = activity.value.turnCount,
                    ImpliedSuccess = activity.value.impliedSuccess,
                    StartTimeUtc = DateTimeOffset.Parse(activity.value.startTimeUtc?.ToString())
                        .ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    EndTimeUtc = DateTimeOffset.Parse(activity.value.endTimeUtc?.ToString())
                        .ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"),
                    OutcomeReason = activity.value.outcomeReason
                })
                .ToList();

            if (sessionDetails == null || !sessionDetails.Any())
            {
                throw new InvalidOperationException("No session details found in the transcript.");
            }

            return sessionDetails;
        }

        /// <summary>
        /// Get Global Session Details
        /// </summary>
        /// <param name="sessionDetails">Session Details</param>
        /// <returns>Global Session Details List</returns>
        public GlobalSessionDetail GetGlobalDetails(List<SessionDetail> sessionDetails)
        {
            int csatCount = sessionDetails.Count(s => s.CSAT > 0);
            double totalCsat = sessionDetails.Sum(s => s.CSAT ?? 0);
            int totalTurnCount = (int)sessionDetails.Sum(s => s.TurnCount);

            // Calculate GlobalOutcome in priority order
            int globalOutcome = sessionDetails.All(p => p.Outcome.Contains("Resolved")) ? 2 :
                                sessionDetails.Any(p => p.Outcome.Contains("HandOff")) ? 4 :
                                sessionDetails.Any(p => p.Outcome.Contains("Resolved")) ? 3 :
                                sessionDetails.Any(p => p.Outcome.Contains("Abandoned")) ? 5 : 1;

            return new GlobalSessionDetail
            {
                SessionCount = sessionDetails.Count,
                TotalCsat = totalCsat,
                CsatCount = csatCount,
                TotalTurnCount = totalTurnCount,
                AvgCsat = csatCount > 0 ? Math.Round(totalCsat / csatCount, 2) : 0,
                GlobalOutcome = globalOutcome
            };
        }

        /// <summary>
        /// Get Conversation Details
        /// </summary>
        /// <param name="model">Transcript Model</param>
        /// <returns>Conversation Details List</returns>
        public ConversationInfoDetail ProcessConversationInfoDetails(TranscriptModel model)
        {
            if (model?.activities == null || !model.activities.Any())
                return null;

            var firstElement = model.activities.First();
            var lastElement = model.activities.Last();
            var firstUserActivity = model.activities
                .FirstOrDefault(activity => activity.from != null && activity.from.IsUser);

            string userId = firstUserActivity?.from?.id ?? string.Empty;
            string aadObjectId = firstUserActivity?.from?.aadObjectId ?? string.Empty;

            return new ConversationInfoDetail
            {
                Timestamp = firstElement.timestamp,
                ConversationDuration = lastElement.timestamp - firstElement.timestamp,
                UserId = userId,
                AadObjectId = aadObjectId
            };
        }
    }
}
