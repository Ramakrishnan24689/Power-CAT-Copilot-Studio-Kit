// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Runtime.Serialization;
using Newtonsoft.Json;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    [DataContract]
    public class ConversationRecord
    {
        [DataMember(Name = "AgentName")]
        public string AgentName { get; set; }

        [DataMember(Name = "ConversationId")]
        public string ConversationId { get; set; }

        [DataMember(Name = "ConversationDate")]
        public string ConversationDate { get; set; }

        [DataMember(Name = "isDesignMode")]
        public bool IsDesignMode { get; set; }

        [DataMember(Name = "channelId")]
        public string ChannelId { get; set; }

        [DataMember(Name = "SessionInfo")]
        public List<SessionInfo> SessionInfo { get; set; }

        [DataMember(Name = "feedback")]
        public List<FeedbackItem> Feedback { get; set; }

        [DataMember(Name = "botmessages")]
        public List<Activity> BotMessagesActivities { get; set; }

        /// <summary>
        /// Dictionary of bot messages keyed by activity ID for quick lookup.
        /// Populated during processing.
        /// </summary>
        [JsonIgnore]
        public Dictionary<string, string> BotMessages { get; set; }
    }

    /// <summary>
    /// Agent metadata containing configuration information.
    /// This class is extensible - additional properties can be added as needed.
    /// </summary>
    [DataContract]
    public class AgentMetadata
    {
        [DataMember(Name = "agentConfigurationName")]
        public string AgentConfigurationName { get; set; }

        [DataMember(Name = "agentConfigurationId")]
        public string AgentConfigurationId { get; set; }
    }

    [DataContract]
    public class Activity
    {
        [DataMember(Name = "id")]
        public string Id { get; set; }

        [DataMember(Name = "type")]
        public string Type { get; set; }

        [DataMember(Name = "text")]
        public string Text { get; set; }

        [DataMember(Name = "from")]
        public ActivityFrom From { get; set; }

        [DataMember(Name = "replyToId")]
        public string ReplyToId { get; set; }
    }

    [DataContract]
    public class ActivityFrom
    {
        [DataMember(Name = "id")]
        public string Id { get; set; }

        [DataMember(Name = "role")]
        public int Role { get; set; }
    }

    [DataContract]
    public class SessionInfo
    {
        [DataMember(Name = "valueType")]
        public string ValueType { get; set; }

        [DataMember(Name = "id")]
        public string Id { get; set; }

        [DataMember(Name = "type")]
        public string Type { get; set; }

        [DataMember(Name = "timestamp")]
        public long Timestamp { get; set; }

        [DataMember(Name = "value")]
        public SessionValue Value { get; set; }
    }

    [DataContract]
    public class SessionValue
    {
        [DataMember(Name = "startTimeUtc")]
        public DateTime? StartTimeUtc { get; set; }

        [DataMember(Name = "endTimeUtc")]
        public DateTime? EndTimeUtc { get; set; }

        [DataMember(Name = "type")]
        public string Type { get; set; }

        [DataMember(Name = "outcome")]
        public string Outcome { get; set; }

        [DataMember(Name = "turnCount")]
        public int TurnCount { get; set; }

        [DataMember(Name = "csatScore")]
        public int? CsatScore { get; set; }

        [DataMember(Name = "impliedSuccess")]
        public bool ImpliedSuccess { get; set; }

        [DataMember(Name = "outcomeReason")]
        public string OutcomeReason { get; set; }

        [DataMember(Name = "lastUserIntentId")]
        public string LastUserIntentId { get; set; }
    }

    [DataContract]
    public class FeedbackItem
    {
        [DataMember(Name = "id")]
        public string Id { get; set; }

        [DataMember(Name = "type")]
        public string Type { get; set; }

        [DataMember(Name = "timestamp")]
        public long Timestamp { get; set; }

        [DataMember(Name = "replyToId")]
        public string ReplyToId { get; set; }

        [DataMember(Name = "value")]
        public FeedbackValue Value { get; set; }
    }

    [DataContract]
    public class FeedbackValue
    {
        [DataMember(Name = "actionName")]
        public string ActionName { get; set; }

        [DataMember(Name = "actionValue")]
        public FeedbackActionValue ActionValue { get; set; }
    }

    [DataContract]
    public class FeedbackActionValue
    {
        [DataMember(Name = "feedback")]
        [JsonConverter(typeof(FeedbackDetailConverter))]
        public FeedbackDetail Feedback { get; set; }

        [DataMember(Name = "reaction")]
        public string Reaction { get; set; }
    }

    [DataContract]
    public class FeedbackDetail
    {
        [DataMember(Name = "feedbackText")]
        public string FeedbackText { get; set; }
    }

    /// <summary>
    /// Custom JSON converter for FeedbackDetail that handles both object and string (escaped JSON) formats.
    /// </summary>
    public class FeedbackDetailConverter : JsonConverter<FeedbackDetail>
    {
        public override FeedbackDetail ReadJson(JsonReader reader, Type objectType, FeedbackDetail existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            if (reader.TokenType == JsonToken.Null)
            {
                return null;
            }

            // If the JSON is a string, it might be escaped JSON - try to parse it
            if (reader.TokenType == JsonToken.String)
            {
                string stringValue = (string)reader.Value;
                if (string.IsNullOrEmpty(stringValue))
                {
                    return null;
                }

                try
                {
                    // Try to deserialize the string as JSON
                    return JsonConvert.DeserializeObject<FeedbackDetail>(stringValue);
                }
                catch
                {
                    // If it's not valid JSON, treat it as raw feedback text
                    return new FeedbackDetail { FeedbackText = stringValue };
                }
            }

            // Otherwise, let Newtonsoft deserialize the object normally
            if (reader.TokenType == JsonToken.StartObject)
            {
                return serializer.Deserialize<FeedbackDetail>(reader);
            }

            return null;
        }

        public override void WriteJson(JsonWriter writer, FeedbackDetail value, JsonSerializer serializer)
        {
            serializer.Serialize(writer, value);
        }
    }

    /// <summary>
    /// Aggregated KPI data for a (conversationDate, channelId, dataSourceCode) group.
    /// </summary>
    public class KpiGroup
    {
        public DateTime ConversationDate { get; set; }
        public string ChannelId { get; set; }
        public int DataSourceCode { get; set; }
        public int TotalConversations { get; set; }
        public int SessionCount { get; set; }
        public int EngagedCount { get; set; }
        public int UnengagedCount { get; set; }
        public int ResolvedCount { get; set; }
        public int AbandonedCount { get; set; }
        public int EscalatedCount { get; set; }
        public int TotalTurns { get; set; }
        public int FeedbackLikeCount { get; set; }
        public int FeedbackDislikeCount { get; set; }
        public int CsatScore { get; set; }
        public int CsatCount { get; set; }
        public List<FeedbackDetailRecord> FeedbackDetails { get; set; } = new List<FeedbackDetailRecord>();
    }

    /// <summary>
    /// Detailed feedback record correlating user feedback with the agent's message.
    /// </summary>
    public class FeedbackDetailRecord
    {
        [JsonProperty("Agent Name")]
        public string AgentName { get; set; }

        [JsonProperty("Conversation Id")]
        public string ConversationId { get; set; }

        [JsonProperty("Agent Message")]
        public string AgentMessage { get; set; }

        [JsonProperty("Feedback Text")]
        public string FeedbackText { get; set; }

        [JsonProperty("Feedback Reaction")]
        public string FeedbackReaction { get; set; }
    }
}