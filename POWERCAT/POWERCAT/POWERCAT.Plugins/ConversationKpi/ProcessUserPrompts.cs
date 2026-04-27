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
        /// <param name="transcriptContent">Transcript content.</param>
        /// <param name="conversationId">Conversation Id.</param>
        /// <param name="agentId">Agent Id.</param>
        /// <returns>User prompts json.</returns>
        public string ProcessForUserPrompts(string transcriptContent, string conversationId, string agentId)
        {
            var userPrompts = new List<ConversationTurn>();

            if (string.IsNullOrWhiteSpace(transcriptContent))
            {
                return JsonConvert.SerializeObject(userPrompts);
            }

            try
            {
                var transcript = JsonConvert.DeserializeObject<TranscriptModel>(transcriptContent);
                if (transcript?.activities == null)
                {
                    return JsonConvert.SerializeObject(userPrompts);
                }

                var sessionInfoActivities = transcript.activities
                    .Select((activity, index) => new { activity, index })
                    .Where(item => item.activity != null && item.activity.valueType == "SessionInfo")
                    .ToList();

                for (var index = 0; index < transcript.activities.Count; index++)
                {
                    var activity = transcript.activities[index];
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

        private static bool HasIdentityValue(string value, params string[] candidates)
        {
            return !string.IsNullOrWhiteSpace(value) &&
                candidates.Any(candidate => string.Equals(value, candidate, StringComparison.OrdinalIgnoreCase));
        }

        private static string GetMessageContent(Activity activity)
        {
            return string.IsNullOrWhiteSpace(activity.text) ? null : activity.text.Trim();
        }

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
