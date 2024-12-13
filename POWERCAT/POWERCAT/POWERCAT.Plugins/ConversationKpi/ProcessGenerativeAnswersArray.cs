// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessGenerativeAnswersArray
    {
        public List<GenerativeAnswers> ProcessForGenerativeAnswers(TranscriptModel model, string conversationId)
        {
            List<GenerativeAnswers> generativeAnswers = new List<GenerativeAnswers>();

            model.activities
                   .Where(activity => activity?.channelData?.pvagptfeedback != null)
                   .ToList()
                   .ForEach(currentElement =>
                   {
                       // Get Next SessionInfo for timestamp
                       var sessionInfoElements = model.activities
                          .Where(activity => activity.valueType == "SessionInfo" && activity.timestamp >= currentElement.timestamp)
                          .OrderBy(activity => activity.timestamp)
                          .ToList();

                       generativeAnswers.Add(new GenerativeAnswers
                       {
                           SessionID = $"{conversationId}-{sessionInfoElements.FirstOrDefault()?.timestamp}" +
                                       $"-{sessionInfoElements.FirstOrDefault()?.id}",
                           UserQuery = currentElement?.channelData?.pvagptfeedback?.message,
                           GeneratedAnswer = currentElement?.channelData?.pvagptfeedback?.summarizationOpenAIResponse?.result?.summary,
                           Status = currentElement?.channelData?.pvagptfeedback?.gptAnswerState,
                           UsedAIKnowledge = currentElement?.channelData?.pvagptfeedback?.triggeredGptFallback ?? false,
                       });
                   });

            return generativeAnswers;
        }
    }
}
