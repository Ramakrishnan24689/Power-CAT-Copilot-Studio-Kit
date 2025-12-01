// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Class module for Generative Answers
    /// </summary>
    public class ProcessGenerativeAnswersArray
    {
        /// <summary>
        /// Generate Generative Answers KPIs
        /// </summary>
        /// <param name="model">Transcript Activity Model</param>
        /// <param name="conversationId">Conversation Id</param>
        /// <param name="agentId">Agent Id</param>
        /// <returns>Generative Answers List</returns>
        public List<GenerativeAnswers> ProcessForGenerativeAnswers(List<Activity> model, string conversationId, string agentId)
        {
            // Filter activities with pvagptfeedback
            var transcriptActivities = model
                .Where(activity => activity?.channelData?.pvagptfeedback != null)
                .ToList();

            // Preprocess SessionInfo activities and sort it for efficient lookups
            var sessionInfoActivities = model
                .Where(activity => activity.valueType == "SessionInfo")
                .OrderBy(activity => activity.index)
                .ToList();

            var generativeAnswers = new List<GenerativeAnswers>();

            foreach (var currentElement in transcriptActivities)
            {
                // Find the next SessionInfo after the current activity
                var nextSession = sessionInfoActivities
                    .FirstOrDefault(session => session.index > currentElement.index);

                // Add the current activity's details to the result list
                generativeAnswers.Add(new GenerativeAnswers
                {
                    SessionID = $"{agentId}-{conversationId}-{nextSession?.timestamp}-{nextSession?.id}",
                    UserQuery = currentElement.channelData.pvagptfeedback?.message,
                    GeneratedAnswer = currentElement.channelData.pvagptfeedback?.summarizationOpenAIResponse?.result?.summary,
                    Status = currentElement.channelData.pvagptfeedback?.gptAnswerState,
                    UsedAIKnowledge = currentElement.channelData.pvagptfeedback?.triggeredGptFallback
                });
            }

            return generativeAnswers;
        }
    }
}
