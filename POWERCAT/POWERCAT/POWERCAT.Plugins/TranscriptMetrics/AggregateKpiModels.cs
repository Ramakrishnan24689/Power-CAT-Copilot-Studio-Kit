// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Runtime.Serialization;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    [DataContract]
    public class ConversationRecord
    {
        [DataMember(Name = "ConversationId")]
        public string ConversationId { get; set; }

        [DataMember(Name = "ConversationStartTime")]
        public DateTime? ConversationStartTime { get; set; }

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
    /// Aggregated KPI data for a (channelId, isDesignMode) group.
    /// </summary>
    public class KpiGroup
    {
        public string ChannelId { get; set; }
        public bool IsDesignMode { get; set; }
        public int TotalConversations { get; set; }
        public int EngagedCount { get; set; }
        public int UnengagedCount { get; set; }
        public int ResolvedCount { get; set; }
        public int AbandonedCount { get; set; }
        public int TotalTurns { get; set; }
        public int FeedbackLikeCount { get; set; }
        public int FeedbackDislikeCount { get; set; }
        public int FeedbackTextCount { get; set; }
    }
}