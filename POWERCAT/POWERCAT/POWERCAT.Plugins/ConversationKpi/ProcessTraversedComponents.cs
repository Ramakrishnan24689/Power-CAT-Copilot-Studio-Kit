// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessTraversedComponents
    {
        public List<TraversedComponents> ProcessForTraversedComponents(TranscriptModel model, string conversationId)
        {

            var transcriptData = model.activities
                        .Where(activity => activity.valueType == "IntentRecognition"
                                           || activity.valueType == "DialogRedirect"
                                           || activity.valueType == "UnknownIntent"
                                           || activity.valueType == "SessionInfo"
                                           || activity.name == "startConversation")
                      .ToList();

            List<TraversedComponents> traversedComponents = new List<TraversedComponents>();

            transcriptData.Where(activity => activity.name == "startConversation" || (activity.valueType == "DialogRedirect" ||
                                    activity.valueType == "UnknownIntent" || activity.valueType == "IntentRecognition"))
                       .ToList()
                       .ForEach(currentElement =>
                       {
                           // Get Next SessionInfo timestamp
                           var sessionInfoElements = model.activities
                               .Where(activity => activity.valueType == "SessionInfo" && activity.timestamp >= currentElement.timestamp)
                               .OrderBy(activity => activity.timestamp)
                               .ToList();

                           // Add the tracked variable to the list
                           traversedComponents.Add(new TraversedComponents
                           {
                               SessionID = $"{conversationId}-{sessionInfoElements.FirstOrDefault()?.timestamp}-" +
                                           $"{sessionInfoElements.FirstOrDefault()?.id}",
                               ComponentType = "Topic",
                               Trigger = GetTrigger(currentElement.valueType),
                               ComponentID = GetComponentID(currentElement.valueType, currentElement.value)
                           });
                       });

            return traversedComponents;
        }

        public static string GetTrigger(string valueType)
        {
            switch (valueType)
            {
                case "startConversation":
                    return "Conversation Start";
                case "IntentRecognition":
                    return "Intent Recognition";
                case "DialogRedirect":
                    return "Topic Redirect";
                case "UnknownIntent":
                    return "Unrecognized Intent";
                default:
                    break;
            }
            return string.Empty;
        }

        string GetComponentID(string valueType, dynamic value)
        {
            switch (valueType)
            {
                case "startConversation":
                    return null;
                case "IntentRecognition":
                    return $"{value.intentId}";
                case "DialogRedirect":
                    return $"{value.targetDialogId}";
                case "UnknownIntent":
                    return null;
                default:
                    return "Unknown-Component";
            }
        }
    }
}