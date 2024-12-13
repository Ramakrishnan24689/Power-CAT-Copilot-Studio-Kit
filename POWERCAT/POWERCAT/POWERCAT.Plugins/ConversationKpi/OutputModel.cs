// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessDetails
    {
        public Guid AgentTranscriptId { get; set; }
        public List<SessionDetail> SessionDetails { get; set; } = new List<SessionDetail>();
        public GlobalSessionDetail GlobalSessionDetail { get; set; }
        public List<TrackedVariable> TrackedVariables { get; set; } = new List<TrackedVariable>();
        public List<UnrecognizedUtterances> UnrecognizedUtterances { get; set; } = new List<UnrecognizedUtterances>();
        public List<AmbiguousUtterances> AmbiguousUtterances { get; set; } = new List<AmbiguousUtterances>();
        public List<TraversedComponents> TraversedComponentsList { get; set; } = new List<TraversedComponents>();
        public List<GenerativeAnswers> GenerativeAnswersList { get; set; } = new List<GenerativeAnswers>();
        public ConversationInfoDetail ConversationInfoDetails { get; set; }
        public string AgentConfigurationId { get; set; }
        public string AgentId { get; set; }
        public string ConversationId { get; set; }
        public DateTime ConversationDate { get; set; }
    }

    public class ConversationInfoDetail
    {
        public int? ConversationDuration { get; set; }
        public int? Timestamp { get; set; }
        public string UserId { get; set; }
    }

    public class SessionDetail
    {
        public string SessionID { get; set; }
        public string StartTimeUtc { get; set; }
        public string EndTimeUtc { get; set; }
        public string Engagement { get; set; }
        public string Outcome { get; set; }
        public int? TurnCount { get; set; }
        public int? CSAT { get; set; }
        public bool? ImpliedSuccess { get; set; }
        public string OutcomeReason { get; set; }

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

    public class TraversedComponents
    {
        public string SessionID { get; set; }
        public string ComponentType { get; set; }
        public string Trigger { get; set; }
        public string ComponentID { get; set; }
    }

    public class GenerativeAnswers
    {
        public string SessionID { get; set; }
        public string UserQuery { get; set; }
        public string GeneratedAnswer { get; set; }
        public string Status { get; set; }
        public bool? UsedAIKnowledge { get; set; }
    }

    public class TrackedVariable
    {
        public string SessionID { get; set; }
        public string VariableName { get; set; }
        public string VariableValue { get; set; }
    }

    public class UnrecognizedUtterances
    {
        public string SessionID { get; set; }
        public string UnrecognizedUtterance { get; set; }
        public string Status { get; set; }
        public bool UsedGenerativeAnswer { get; set; }
        public bool? UsedAIKnowledge { get; set; }
    }
    public class AmbiguousUtterances
    {
        public string SessionID { get; set; }
        public string IntentCandidatesId { get; set; }
        public string AmbiguousUtterance  { get; set; }
        public List<IntentCandidates> IntentCandidates { get; set; } = new List<IntentCandidates>();
    }
    public class IntentCandidates
    {
        public string IntentId { get; set; }
        public string Title { get; set; }
        public double? IntentScore { get; set; }
    }
}
