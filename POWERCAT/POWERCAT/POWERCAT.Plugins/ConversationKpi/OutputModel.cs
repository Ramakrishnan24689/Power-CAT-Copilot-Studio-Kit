// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json;
using System;
using System.Collections.Generic;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessDetails
    {
        public List<SessionDetail> SessionDetails { get; set; } = new List<SessionDetail>();
        public GlobalSessionDetail GlobalSessionDetail { get; set; }
        public List<TrackedVariable> TrackedVariables { get; set; } = new List<TrackedVariable>();
        public List<UnrecognizedUtterances> UnrecognizedUtterances { get; set; } = new List<UnrecognizedUtterances>();
        public List<AmbiguousUtterances> AmbiguousUtterances { get; set; } = new List<AmbiguousUtterances>();
        public List<TraversedComponents> TraversedComponentsList { get; set; } = new List<TraversedComponents>();
        public List<GenerativeAnswers> GenerativeAnswersList { get; set; } = new List<GenerativeAnswers>();
        public List<FeedbackDetails> FeedbackDetails { get; set; } = new List<FeedbackDetails>();
        public List<KnowledgeSource> KnowledgeSourcesList { get; set; } = new List<KnowledgeSource>();
        public ConversationInfoDetail ConversationInfoDetails { get; set; }
        public string AgentConfigurationId { get; set; }
        public string AgentId { get; set; }
        public string ConversationId { get; set; }
        public DateTime ConversationDate { get; set; }
        public string TranscriptContent { get; set; }
        public string UserPrompts { get; set; }
        public string ConversationTranscriptId { get; set; }
        public bool CopyFullTranscript { get; set; }
    }

    public class GlobalSessionDetail
    {
        public double? AvgCsat { get; set; }
        public double? TotalCsat { get; set; }
        public double? CsatCount { get; set; }
        public int? GlobalOutcome { get; set; }
        public int? SessionCount { get; set; }
        public int? TotalTurnCount { get; set; }
    }

    public class ConversationInfoDetail
    {
        public int? ConversationDuration { get; set; }
        public int? Timestamp { get; set; }
        public string UserId { get; set; }
        public string AadObjectId { get; set; }
        public string UserDisplayName { get; set; }
    }

    public class SessionDetail
    {
        [JsonProperty("Session ID", Order = 1)]
        public string SessionID { get; set; }
        [JsonProperty("Engagement", Order = 2)]
        public string Engagement { get; set; }
        [JsonProperty("Outcome", Order = 3)]
        public string Outcome { get; set; }
        [JsonProperty("CSAT", Order = 4)]
        public int? CSAT { get; set; }
        [JsonProperty("Turn Count", Order = 5)]
        public int? TurnCount { get; set; }
        [JsonProperty("Implied Success", Order = 6)]
        public bool? ImpliedSuccess { get; set; }
        [JsonProperty("Start Time (UTC)", Order = 7)]
        public string StartTimeUtc { get; set; }
        [JsonProperty("End Time (UTC)", Order = 8)]
        public string EndTimeUtc { get; set; }
        [JsonProperty("Outcome Reason", Order = 9)]
        public string OutcomeReason { get; set; }
    }

    public class ConversationTurn
    {
        [JsonProperty("Session ID", Order = 1)]
        public string SessionID { get; set; }
        [JsonProperty("Speaker", Order = 2)]
        public string Speaker { get; set; }
        [JsonProperty("Message", Order = 3)]
        public string Message { get; set; }
        [JsonProperty("Attachments", Order = 4)]
        public List<Attachment> Attachments { get; set; }
    }

    public class TraversedComponents
    {
        [JsonProperty("Session ID")]
        public string SessionID { get; set; }
        [JsonProperty("Component Type")]
        public string ComponentType { get; set; }
        public string Trigger { get; set; }
        [JsonProperty("Component ID")]
        public string ComponentID { get; set; }
    }

    public class GenerativeAnswers
    {
        [JsonProperty("Session ID")]
        public string SessionID { get; set; }
        [JsonProperty("User Query")]
        public string UserQuery { get; set; }
        [JsonProperty("Generated Answer")]
        public string GeneratedAnswer { get; set; }
        public string Status { get; set; }
        [JsonProperty("Used AI Knowledge")]
        public bool? UsedAIKnowledge { get; set; }
    }

    public class TrackedVariable
    {
        [JsonProperty("Session ID")]
        public string SessionID { get; set; }
        [JsonProperty("Name")]
        public string VariableName { get; set; }
        [JsonProperty("Value")]
        public string VariableValue { get; set; }
    }

    public class UnrecognizedUtterances
    {
        [JsonProperty("Session ID")]
        public string SessionID { get; set; }
        [JsonProperty("Unrecognized Utterance")]
        public string UnrecognizedUtterance { get; set; }
        public string Status { get; set; }
        [JsonProperty("Used Generative Answer")]
        public bool UsedGenerativeAnswer { get; set; }
        [JsonProperty("Used AI Knowledge")]
        public bool? UsedAIKnowledge { get; set; }
    }
    public class AmbiguousUtterances
    {
        [JsonProperty("Session ID")]
        public string SessionID { get; set; }
        [JsonProperty("Intent Candidates ID")]
        public string IntentCandidatesId { get; set; }
        [JsonProperty("Ambiguous Utterance")]
        public string AmbiguousUtterance { get; set; }
        [JsonProperty("Intent Candidates")]
        public List<IntentCandidates> IntentCandidates { get; set; } = new List<IntentCandidates>();
    }
    public class IntentCandidates
    {
        [JsonProperty("Intent Id")]
        public string IntentId { get; set; }
        [JsonProperty("Intent Score")]
        public double? IntentScore { get; set; }
        public string Title { get; set; }
        
    }

    public class ConversationTranscriptModel
    {
        public string ConversationId { get; set; }
        public string Content { get; set; }        
        public DateTime ConversationStartTime { get; set; }
        public string AgentId { get; set; }
        public string AgentConfigurationId { get; set; }
        public string ConversationTranscriptId { get; set; }        
        public string TrackedVariables { get; set; }
        public string Name { get; set; }
        public bool CopyFullTranscript { get; set; }
        public int BatchId { get; set; }
    }

    public class FeedbackDetails
    {
        [JsonProperty("Session ID")]
        public string SessionID { get; set; }
        [JsonProperty("Agent Message")]
        public string AgentMessage { get; set; }
        [JsonProperty("User Message")]
        public string UserMessage { get; set; }
        [JsonProperty("Feedback Text")]
        public string FeedbackText { get; set; }
        [JsonProperty("Feedback Reaction")]
        public string FeedbackReaction { get; set; }
    }

    public class KnowledgeSource
    {
        [JsonProperty("Session ID")]
        public string SessionID { get; set; }
        [JsonProperty("Knowledge Source ID")]
        public string KnowledgeSourceID { get; set; }
        [JsonProperty("Knowledge Source Type")]
        public string KnowledgeSourceType { get; set; }
        [JsonProperty("Available")]
        public bool Available { get; set; }
        [JsonProperty("Used")]
        public bool Used { get; set; }
        [JsonProperty("Cited")]
        public bool Cited { get; set; }
        [JsonProperty("User Query")]
        public string UserQuery { get; set; }
    }
}
