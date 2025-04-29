// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Class module for Traversed Components
    /// </summary>
    public class ProcessTraversedComponents
    {
        /// <summary>
        /// Generate Traversed Components KPIs
        /// </summary>
        /// <param name="model">Transcript Activity Model</param>
        /// <param name="conversationId">Conversation Id</param>
        /// <param name="agentId">Agent Id</param>
        /// <returns>Traversed Components List</returns>
        public List<TraversedComponents> ProcessForTraversedComponents(List<Activity> model, string conversationId, string agentId)
        {
            // Filter and preprocess relevant activities
            var transcriptActivities = model
                .Where(activity =>
                    activity.valueType == "IntentRecognition" ||
                    activity.valueType == "DialogRedirect" ||
                    activity.valueType == "UnknownIntent" ||
                    activity.name == "startConversation")
                .OrderBy(activity => activity.index)
                .ToList();

            // Preprocess SessionInfo activities and sort it for efficient lookups
            var sessionInfoActivities = model
                .Where(activity => activity.valueType == "SessionInfo")
                .OrderBy(activity => activity.index)
                .ToList();

            // Process relevant activities
            var traversedComponents = new List<TraversedComponents>();
            foreach (var currentElement in transcriptActivities)
            {
                // Find the next SessionInfo after currentElement.index
                var nextSession = sessionInfoActivities
                    .FirstOrDefault(session => session.index > currentElement.index);

                traversedComponents.Add(new TraversedComponents
                {
                    SessionID = $"{agentId}-{conversationId}-{nextSession.timestamp}-{nextSession.id}",
                    ComponentType = "Topic",
                    Trigger = GetTrigger(currentElement.valueType, currentElement.name),
                    ComponentID = GetComponentID(currentElement.valueType, currentElement.value, currentElement.name)
                });
            }

            return traversedComponents;
        }

        /// <summary>
        /// Get trigger type based on value type
        /// </summary>
        /// <param name="valueType">Value Type</param>
        /// <param name="name">Name to check Conversation Start event</param>
        /// <returns>Trigger Type</returns>
        public static string GetTrigger(string valueType, string name)
        {
            if (name == "startConversation")
                return "Conversation Start";

            switch (valueType)
            {
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

        /// <summary>
        /// Get Component Id
        /// </summary>
        /// <param name="valueType">Value Type</param
        /// <param name="value">Activity Value</param>
        /// <param name="name">Name to check Conversation Start event</param>
        /// <returns>Component Id</returns>
        string GetComponentID(string valueType, dynamic value, string name)
        {
            if (name == "startConversation")
                return null;

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
                    return string.Empty;
            }
        }
    }
}