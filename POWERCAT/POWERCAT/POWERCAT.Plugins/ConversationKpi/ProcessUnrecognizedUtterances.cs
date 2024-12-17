// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Class module for Unrecognized Utterances
    /// </summary>
    public class ProcessUnrecognizedUtterances
    {
        /// <summary>
        /// Generate Unrecognized Utterances KPIs
        /// </summary>
        /// <param name="model">Transcript Activity Model</param>
        /// <param name="conversationId">Conversation Id</param>
        /// <returns>Unrecognized Utterances List</returns>
        public List<UnrecognizedUtterances> ProcessForUnrecognizedUtterances(List<Activity> model, string conversationId)
        {
            // Filter activities
            var transcriptActivities = model
                                .Where(activity =>
                                    activity.valueType == "UnknownIntent" || activity.valueType == "GPTAnswer" ||
                                    (activity.channelData != null && activity.channelData.pvagptfeedback != null) ||
                                    activity.valueType == "SessionInfo")
                                .OrderBy(activity => activity.index)
                                .ToList();

            // Preprocess SessionInfo activities and sort it for efficient lookups
            var sessionInfoActivities = transcriptActivities
                .Where(activity => activity.valueType == "SessionInfo")
                .OrderBy(activity => activity.index)
                .ToList();


            var unknownIntentActivities = transcriptActivities
                .Where(activity => activity.valueType == "UnknownIntent")
                .ToList();

            var gptAnswerActivities = transcriptActivities
                .Where(activity => activity.valueType == "GPTAnswer")
                .ToList();

            var gptFeedbackActivities = transcriptActivities
                .Where(activity => activity.channelData?.pvagptfeedback != null)
                .ToList();

            // Prepare result list
            var unrecognizedUtterances = new List<UnrecognizedUtterances>();

            // Traverse Unknown Intents
            foreach (var currentElement in unknownIntentActivities)
            {
                // Find the next SessionInfo after currentElement.index
                var nextSession = sessionInfoActivities
                    .FirstOrDefault(session => session.index > currentElement.index);

                // Find the next UnknownIntent element
                var nextUnknownIntent = unknownIntentActivities
                    .FirstOrDefault(activity => activity.index > currentElement.index);

                // Find the relevant GPTAnswer state
                var gptAnswerState = gptAnswerActivities
                                    .FirstOrDefault(activity => activity.index > currentElement.index &&
                                        (nextUnknownIntent == null || activity.index < nextUnknownIntent.index));

                bool isgptAnswerStatePresent = gptAnswerState?.value.gptAnswerState.Length > 0;

                // Find the relevant GPTFeedback
                var gptFeedback = gptFeedbackActivities
                                  .FirstOrDefault(activity => activity.index > currentElement.index &&
                                        (nextUnknownIntent == null || activity.index < nextUnknownIntent.index));

                // Add to the result
                unrecognizedUtterances.Add(new UnrecognizedUtterances
                {
                    SessionID = $"{conversationId}-{nextSession?.timestamp}-{nextSession?.id}",
                    UnrecognizedUtterance = currentElement?.value?.userQuery,
                    Status = isgptAnswerStatePresent ? gptAnswerState.value.gptAnswerState : "Fallback",
                    UsedGenerativeAnswer = isgptAnswerStatePresent,
                    UsedAIKnowledge = gptFeedback?.channelData?.pvagptfeedback?.triggeredGptFallback,
                });
            }

            return unrecognizedUtterances;
        }
    }
}