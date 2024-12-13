// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License

using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessAmbiguousUtterances
    {
        public List<AmbiguousUtterances> ProcessForAmbiguousUtterances(TranscriptModel model, string conversationId)
        {
            List<AmbiguousUtterances> ambiguousUtterances = new List<AmbiguousUtterances>();
            List<IntentCandidates> intentCandidates = new List<IntentCandidates>();

            var transcriptData = model.activities
                       .Where(activity =>
                        activity.valueType == "IntentCandidates")
                      .ToList();
            
            transcriptData
               .Where(activity => activity.valueType == "IntentCandidates").ToList()
               .ForEach(currentElement =>
               {
                   // Get Next SessionInfo timestamp
                   var sessionInfoElements = model.activities
                          .Where(activity => activity.valueType == "SessionInfo" && activity.timestamp >= currentElement.timestamp)
                          .OrderBy(activity => activity.timestamp).ToList();

                   //traverse through each intent and add to intentCandidates
                   if (currentElement?.value?.intents != null)
                   {
                       foreach (var intent in currentElement.value.intents)
                       {
                           intentCandidates.Add(new IntentCandidates
                           {
                               IntentId = intent?.intentId,
                               Title = intent?.intentScore?.properties?.Title,
                               IntentScore = intent?.intentScore?.score                               
                           });
                       }
                   }
                   ambiguousUtterances.Add(new AmbiguousUtterances
                   {
                       SessionID = $"{conversationId}-{sessionInfoElements.FirstOrDefault()?.timestamp}"
                                        + $"-{sessionInfoElements.FirstOrDefault()?.id}",
                       IntentCandidatesId = currentElement?.id,
                       AmbiguousUtterance = currentElement?.value?.triggerUtterance,
                       IntentCandidates = intentCandidates
                   });

               });

            return ambiguousUtterances;
        }
    }
}
