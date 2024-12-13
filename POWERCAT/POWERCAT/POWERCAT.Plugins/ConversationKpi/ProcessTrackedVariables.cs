// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessTrackedVariables
    {
        public List<TrackedVariable> ProcessForTrackedVariables(TranscriptModel model, string variableNames, string conversationId)
        {
            //Filter data from transcript having only VariableAssignment and SessionInfo
            var transcriptData = model.activities
                       .Where(activity =>
                        activity.valueType == "VariableAssignment")
                      .ToList();

            // Convert variableNames to an array
            string[] variableNamesArray = JsonConvert.DeserializeObject<string[]>(variableNames);

            List<TrackedVariable> trackedVariables = new List<TrackedVariable>();

            // Loop through each variable in variableArray
            foreach (var variableName in variableNamesArray)
            {
                transcriptData
                            .Where(activity => activity.value.id == variableName)
                            .ToList()
                            .ForEach(currentElement =>
                            {
                                // Get Next SessionInfo timestamp
                                var sessionInfoElements = model.activities
                                    .Where(activity => activity.valueType == "SessionInfo" && activity.timestamp >= currentElement.timestamp)
                                    .OrderBy(activity => activity.timestamp)
                                    .ToList();

                                // Add the tracked variable to the list
                                trackedVariables.Add(new TrackedVariable
                                {
                                    SessionID = $"{conversationId}-" +
                                                $"{sessionInfoElements.FirstOrDefault()?.timestamp}" +
                                                $"-{sessionInfoElements.FirstOrDefault()?.id}",
                                    VariableName = currentElement.value.id ?? string.Empty,
                                    VariableValue = currentElement.value?.newValue ?? string.Empty
                                });
                            });
            }

            return trackedVariables;
        }
    }
}
