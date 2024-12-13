// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessSessionInsight
    {
        public List<SessionDetail> ProcessTranscript(string conversationId, TranscriptModel model)
        {
            //Filtering the SessionInfo details.
            List<SessionDetail> session = model.activities
                                          .Where(activity => activity.valueType == "SessionInfo" && activity.value != null)
                                          .Select(activity => new SessionDetail
                                          {
                                              SessionID = $"{conversationId}-{activity.timestamp}-{activity.id}",
                                              Engagement = activity.value.type,
                                              Outcome = activity.value.outcome,
                                              CSAT = activity.value.csatScore,
                                              TurnCount = activity.value.turnCount,
                                              ImpliedSuccess = activity.value.impliedSuccess,
                                              StartTimeUtc = DateTimeOffset.Parse(activity.value.startTimeUtc.ToString()).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"),
                                              EndTimeUtc = DateTimeOffset.Parse(activity.value?.endTimeUtc.ToString()).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ"),
                                              OutcomeReason = activity.value.outcomeReason,
                                          }).ToList();

            return session;

        }

        public GlobalSessionDetail GetGlobalDetails(List<SessionDetail> processedDetails)
        {
            //Calculating the global values for a transcript
            GlobalSessionDetail globalSessionDetail = new GlobalSessionDetail
            {
                SessionCount = processedDetails.Count,
                TotalCsat = processedDetails.Sum(s => s.CSAT),
                CsatCount = processedDetails.Count(s => s.CSAT > 0),
                TotalTurnCount = processedDetails.Sum(s => s.TurnCount),
                AvgCsat = 0
            };

            if (globalSessionDetail.CsatCount > 0 && globalSessionDetail.TotalCsat > 0){
                globalSessionDetail.AvgCsat = Math.Round((globalSessionDetail.TotalCsat / globalSessionDetail.CsatCount) ?? 0, 2);
            }

            if (processedDetails.All(p => p.Outcome.Contains("Resolved"))){
                globalSessionDetail.GlobalOutcome = 2;
            }else if (processedDetails.Count(p => p.Outcome.Contains("HandOff")) >= 1){
                globalSessionDetail.GlobalOutcome = 4;
            }else if (processedDetails.Count(p => p.Outcome.Contains("Resolved")) >= 1){
                globalSessionDetail.GlobalOutcome = 3;
            }else if (processedDetails.Count(p => p.Outcome.Contains("Abandoned")) >= 1){
                globalSessionDetail.GlobalOutcome = 5;
            }else{
                globalSessionDetail.GlobalOutcome = 1;
            }
            return globalSessionDetail;
        }

        public ConversationInfoDetail ProcessConversationInfoDetails(TranscriptModel model)
        {
            var firstElement = model?.activities?.FirstOrDefault();
            var lastElement = model?.activities?.LastOrDefault();
            string userId = string.Empty;
            userId = model.activities
                   .Where(activity => activity.from != null && (activity.from.role == 1))
                   .Select(activity => activity.from.id)
                   .FirstOrDefault() ?? string.Empty;

            ConversationInfoDetail conversationInfoDetails =
                                       new ConversationInfoDetail
                                       {
                                           Timestamp = firstElement?.timestamp,
                                           ConversationDuration = lastElement?.timestamp - firstElement?.timestamp,
                                           UserId = userId
                                       };
            return conversationInfoDetails;
        }
    }
}
