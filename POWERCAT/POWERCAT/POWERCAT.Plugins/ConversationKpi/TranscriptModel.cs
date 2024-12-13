// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json;
using System;
using System.Collections.Generic;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class Activity
    {
        public string valueType { get; set; }
        public string type { get; set; }
        public int timestamp { get; set; }
        public From from { get; set; }
        public Value value { get; set; }
        public string id { get; set; }
        public string channelId { get; set; }
        public string text { get; set; }
        public List<Attachment> attachments { get; set; }
        public string textFormat { get; set; }
        public string replyToId { get; set; }
        public string name { get; set; }
        public ChannelData channelData { get; set; }
    }

    public class ChannelData
    {
        [JsonProperty("pva:gpt-feedback")]
        public PvaGptFeedback pvagptfeedback { get; set; }
    }

    public class PvaGptFeedback
    {
        public List<object> endpoints { get; set; }
        public SummarizationOpenAIResponse summarizationOpenAIResponse { get; set; }
        public List<object> searchResults { get; set; }
        public List<object> verifiedSearchResults { get; set; }
        public List<object> searchErrors { get; set; }
        public List<object> searchLogs { get; set; }
        public List<object> searchTerms { get; set; }
        public string message { get; set; }
        public string activityId { get; set; }
        public string conversationId { get; set; }
        public bool performedContentProvenanceCheck { get; set; }
        public bool performedContentModerationCheck { get; set; }
        public string cdsBotId { get; set; }
        public string tenantId { get; set; }
        public string environmentId { get; set; }
        public string gptAnswerState { get; set; }
        public bool triggeredGptFallback { get; set; }
        public string completionState { get; set; }
    }

    public class SummarizationOpenAIResponse
    {
        public Result result { get; set; }
        public string rawSummary { get; set; }
        public int completionTokens { get; set; }
        public int promptTokens { get; set; }
        public string prompt { get; set; }
        public string completionResponse { get; set; }
        public string errorCode { get; set; }
    }

    public class Result
    {
        public string summary { get; set; }
        public string textSummary { get; set; }
        public string speechSummary { get; set; }
        public List<TextCitation> textCitations { get; set; }
        public bool containsConfidentialData { get; set; }
        public string messageId { get; set; }
    }

    public class TextCitation
    {
        public string id { get; set; }
        public string text { get; set; }
        public string title { get; set; }
        public string type { get; set; }
        public int position { get; set; }
        public string entityType { get; set; }
        public string entityContext { get; set; }
        public string url { get; set; }
        public string searchSourceId { get; set; }
    }

    public class Attachment
    {
        public string contentType { get; set; }
        public Content content { get; set; }
    }

    public class Body
    {
        public string connectionName { get; set; }
    }

    public class Button
    {
        public string type { get; set; }
        public string title { get; set; }
        public string text { get; set; }
        public string value { get; set; }
    }

    public class Content
    {
        public string text { get; set; }
        public string connectionName { get; set; }
        public TokenExchangeResource tokenExchangeResource { get; set; }
        public List<Button> buttons { get; set; }
    }

    public class From
    {
        public string id { get; set; }
        public int role { get; set; }
    }

    public class IntentScore
    {
        public double? score { get; set; }
        public Properties properties { get; set; }
    }

    public class Properties
    {
        public int Type { get; set; }
        public string Title { get; set; }
    }

    public class TranscriptModel
    {
        public List<Activity> activities { get; set; }
    }

    public class TokenExchangeResource
    {
        public string id { get; set; }
        public string uri { get; set; }
        public string providerId { get; set; }
    }

    public class Value
    {
        public bool isDesignMode { get; set; }
        public string locale { get; set; }
        public string targetDialogId { get; set; }
        public int? targetDialogType { get; set; }
        public int? status { get; set; }
        public Body body { get; set; }
        public string intentTitle { get; set; }
        public int? intentType { get; set; }
        public string triggerUtterance { get; set; }
        public string normalizedTriggerUtterance { get; set; }
        public string intentId { get; set; }
        public IntentScore intentScore { get; set; }
        public DateTime? startTimeUtc { get; set; }
        public DateTime? endTimeUtc { get; set; }
        public string type { get; set; }
        public string outcome { get; set; }
        public int? turnCount { get; set; }
        public string lastTriggeredIntentId { get; set; }
        public string lastUserIntentId { get; set; }
        public bool? impliedSuccess { get; set; }
        public string outcomeReason { get; set; }
        public int? csatScore { get; set; }
        public string userQuery { get; set; }
        public string name { get; set; }
        public string id { get; set; }
        public string newValue { get; set; }
        public string gptAnswerState { get; set; }
        public List<Intent> intents { get; set; }
    }

    public class Intent
    {
        public string intentId { get; set; }
        public IntentScore intentScore { get; set; }
    }
}
