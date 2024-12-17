// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Class module for Tracked Variables
    /// </summary>
    public class ProcessTrackedVariables
    {
        /// <summary>
        /// Generate Tracked Variables KPIs
        /// </summary>
        /// <param name="model">Transcript Activity Model</param>
        /// <param name="conversationId">Conversation Id</param>
        /// <returns>Tracked Variables List</returns>
        public List<TrackedVariable> ProcessForTrackedVariables(List<Activity> model, string variableNames, string conversationId)
        {
            // Check for variableNames
            if (string.IsNullOrEmpty(variableNames)){
                return new List<TrackedVariable>();
            }

            // Parse variable names into a HashSet
            var variableNamesSet = new HashSet<string>(JsonConvert.DeserializeObject<string[]>(variableNames));

            // Filter VariableAssignment activities
            var transcriptActivities = model
                .Where(activity => activity.valueType == "VariableAssignment" && variableNamesSet.Contains(activity.value.id))
                .ToList();

            // Preprocess SessionInfo activities and sort it for efficient lookups
            var sessionInfoActivities = model
                .Where(activity => activity.valueType == "SessionInfo")
                .OrderBy(activity => activity.index)
                .ToList();

            // Process tracked variables
            var trackedVariables = new List<TrackedVariable>();
            foreach (var currentElement in transcriptActivities)
            {
                // Find the next SessionInfo after currentElement.index
                var nextSession = sessionInfoActivities
                    .FirstOrDefault(session => session.index > currentElement.index);

                // Add to tracked variables
                trackedVariables.Add(new TrackedVariable
                {
                    SessionID = $"{conversationId}-{nextSession.timestamp}-{nextSession.id}",
                    VariableName = currentElement.value.id,
                    VariableValue = currentElement.value.newValue ?? string.Empty
                });
            }

            return trackedVariables;
        }
    }
}
