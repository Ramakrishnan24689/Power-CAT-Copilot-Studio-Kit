// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Class module for User Prompts.
    /// </summary>
    public class ProcessUserPrompts
    {
        /// <summary>
        /// Generate User Prompts KPI payload.
        /// </summary>
        /// <param name="indexedModels">Indexed transcript activities.</param>
        /// <param name="conversationId">Conversation Id.</param>
        /// <param name="agentId">Agent Id.</param>
        /// <returns>User prompts json.</returns>
        public string ProcessForUserPrompts(List<Activity> indexedModels, string conversationId, string agentId)
        {
            var userPrompts = new List<ConversationTurn>();

            if (indexedModels == null || !indexedModels.Any())
            {
                return JsonConvert.SerializeObject(userPrompts);
            }

            try
            {
                var sessionInfoActivities = indexedModels
                    .Select((activity, index) => new { activity, index })
                    .Where(item => item.activity != null && item.activity.valueType == "SessionInfo")
                    .ToList();

                for (var index = 0; index < indexedModels.Count; index++)
                {
                    var activity = indexedModels[index];
                    if (activity == null || !string.Equals(activity.type, "message", StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    var speaker = GetSpeaker(activity);
                    if (string.IsNullOrWhiteSpace(speaker))
                    {
                        continue;
                    }

                    var message = GetMessageContent(activity);
                    var adaptiveCardAttachments = GetAdaptiveCardAttachments(activity.attachments);
                    if (string.IsNullOrWhiteSpace(message) && (adaptiveCardAttachments == null || !adaptiveCardAttachments.Any()))
                    {
                        continue;
                    }

                    var nextSession = sessionInfoActivities.FirstOrDefault(item => item.index > index);

                    userPrompts.Add(new ConversationTurn
                    {
                        SessionID = nextSession == null ? null : $"{agentId}-{conversationId}-{nextSession.activity.timestamp}-{nextSession.activity.id}",
                        Speaker = speaker,
                        Message = message,
                        Attachments = adaptiveCardAttachments
                    });
                }
            }
            catch
            {
                return JsonConvert.SerializeObject(userPrompts);
            }

            return JsonConvert.SerializeObject(userPrompts);
        }

        /// <summary>
        /// Resolves the speaker type for a transcript activity.
        /// </summary>
        /// <param name="activity">Transcript activity.</param>
        /// <returns>Resolved speaker value.</returns>
        private static string GetSpeaker(Activity activity)
        {
            var from = activity?.from;
            if (from == null)
            {
                return null;
            }

            if (from.IsBot)
            {
                return "agent";
            }

            if (from.IsUser)
            {
                return "user";
            }

            if (HasIdentityValue(from.id, "bot", "agent") || HasIdentityValue(from.name, "bot", "agent"))
            {
                return "agent";
            }

            if (HasIdentityValue(from.id, "user") || HasIdentityValue(from.name, "user"))
            {
                return "user";
            }

            return null;
        }

        /// <summary>
        /// Checks whether an identity value matches any expected candidate values.
        /// </summary>
        /// <param name="value">Identity value to evaluate.</param>
        /// <param name="candidates">Allowed candidate values.</param>
        /// <returns><c>true</c> when the value matches a candidate; otherwise, <c>false</c>.</returns>
        private static bool HasIdentityValue(string value, params string[] candidates)
        {
            return !string.IsNullOrWhiteSpace(value) &&
                candidates.Any(candidate => string.Equals(value, candidate, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Gets normalized message text from an activity.
        /// </summary>
        /// <param name="activity">Transcript activity.</param>
        /// <returns>Trimmed message text when available; otherwise, <c>null</c>.</returns>
        private static string GetMessageContent(Activity activity)
        {
            return string.IsNullOrWhiteSpace(activity.text) ? null : activity.text.Trim();
        }

        /// <summary>
        /// Filters attachments to adaptive card payloads only.
        /// </summary>
        /// <param name="attachments">Activity attachments.</param>
        /// <returns>Adaptive card attachments when present; otherwise, <c>null</c>.</returns>
        private static List<Attachment> GetAdaptiveCardAttachments(List<Attachment> attachments)
        {
            if (attachments == null || !attachments.Any())
            {
                return null;
            }

            return attachments
                .Where(attachment => attachment != null &&
                    string.Equals(attachment.contentType, "application/vnd.microsoft.card.adaptive", StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
    }
}
