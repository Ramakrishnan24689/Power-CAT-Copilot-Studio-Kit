// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License

using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Class module for Ambiguous Utterances
    /// </summary>
    public class ProcessAmbiguousUtterances
    {
        /// <summary>
        /// Generate Ambiguous Utterances KPIs
        /// </summary>
        /// <param name="model">Transcript Activity Model</param>
        /// <param name="conversationId">Conversation Id</param>
        /// <param name="agentId">Agent Id</param>
        /// <returns>Ambiguous Utterances List</returns>
        public List<AmbiguousUtterances> ProcessForAmbiguousUtterances(List<Activity> model, string conversationId, string agentId)
        {
            var ambiguousUtterances = new List<AmbiguousUtterances>();

            // Pre-filter IntentCandidates and SessionInfo
            var transcriptActivities = model
                .Where(activity => activity.valueType == "IntentCandidates")
                .ToList();

            // Preprocess SessionInfo activities and sort it for efficient lookups
            var sessionInfoActivities = model
                .Where(activity => activity.valueType == "SessionInfo")
                .OrderBy(activity => activity.index)
                .ToList();

            foreach (var currentElement in transcriptActivities)
            {
                // Find the next SessionInfo after currentElement.index
                var nextSession = sessionInfoActivities
                    .FirstOrDefault(session => session.index > currentElement.index);

                // Build the list of intent candidates
                var intentCandidates = currentElement?.value?.intents?
                    .Select(intent => new IntentCandidates
                    {
                        IntentId = intent?.intentId,
                        IntentScore = intent?.intentScore?.score,
                        Title = intent?.intentScore?.properties?.Title
                    }).ToList() ?? new List<IntentCandidates>();

                // Add the ambiguous utterance entry
                ambiguousUtterances.Add(new AmbiguousUtterances
                {
                    SessionID = $"{agentId}-{conversationId}-{nextSession?.timestamp}-{nextSession?.id}",
                    IntentCandidatesId = currentElement?.id,
                    AmbiguousUtterance = currentElement?.value?.triggerUtterance,
                    IntentCandidates = intentCandidates
                });
            }

            return ambiguousUtterances;
        }
    }
}
