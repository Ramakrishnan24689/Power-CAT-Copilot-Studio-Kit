// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessUnrecognizedUtterances
    {
        public List<UnrecognizedUtterances> ProcessForUnrecognizedUtterances(TranscriptModel model, string conversationId)
        {
            var transcriptData = model.activities
            .Where(activity =>
             activity.valueType == "UnknownIntent" ||
             activity.valueType == "GPTAnswer" ||
            (activity.channelData != null && activity.channelData.pvagptfeedback != null))
           .ToList();

            List<UnrecognizedUtterances> unrecognizedUtterances = new List<UnrecognizedUtterances>();

            // Get Next SessionInfo Elements After UnknownIntent
            transcriptData
           .Where(activity => activity.valueType == "UnknownIntent").ToList()
           .ForEach(currentElement =>
           {
               // Get Next SessionInfo Timestamp
               var sessionInfoElements = model.activities
                  .Where(activity => activity.valueType == "SessionInfo" && activity.timestamp >= currentElement.timestamp)
                  .OrderBy(activity => activity.timestamp).ToList();

               // Get Next UnknownIntent
               var nextElement = model.activities
                   .Where(activity => activity.valueType == "UnknownIntent" &&
                               activity.timestamp > currentElement.timestamp)
                   .OrderBy(activity => activity.timestamp)
                   .FirstOrDefault();

               // Get GPTAnswer state
               var gptAnswerState = model.activities
                                   .Where(activity => activity.valueType == "GPTAnswer" &&
                                    activity.timestamp >= currentElement.timestamp &&
                                    (nextElement == null || activity.timestamp < nextElement.timestamp))
                                   .FirstOrDefault();

                // Get GPTFeedback
               var gptFeedback = model.activities
                                   .Where(activity => activity?.channelData?.pvagptfeedback != null &&
                                    activity.timestamp >= currentElement.timestamp &&
                                    (nextElement == null || activity.timestamp < nextElement.timestamp))
                                   .FirstOrDefault();

               unrecognizedUtterances.Add(new UnrecognizedUtterances
               {
                   SessionID = $"{conversationId}-{sessionInfoElements.FirstOrDefault()?.timestamp}" +
                               $"-{sessionInfoElements.FirstOrDefault()?.id}",
                   UnrecognizedUtterance = currentElement?.value?.userQuery,
                   Status = gptAnswerState?.value.gptAnswerState.Length > 0 ? gptAnswerState?.value?.gptAnswerState : "Fallback",
                   UsedGenerativeAnswer = gptAnswerState?.value.gptAnswerState.Length > 0,
                   UsedAIKnowledge = gptFeedback?.channelData?.pvagptfeedback?.triggeredGptFallback,
               });
           });
           return unrecognizedUtterances;
        }
    }
}