// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Input DTO matching Power Automate Select output for ProcessConversationTranscriptsBatch.
    /// </summary>
    [System.Runtime.Serialization.DataContract]
    public class TranscriptInputModel
    {
        [JsonProperty("ConversationId")]
        public string ConversationId { get; set; }

        [JsonProperty("Content")]
        public string Content { get; set; }

        [JsonProperty("ConversationDate")]
        public string ConversationDate { get; set; }

        [JsonProperty("AgentConfigurationId")]
        public string AgentConfigurationId { get; set; }

        [JsonProperty("RecordName")]
        public string RecordName { get; set; }

        [JsonProperty("AgentName")]
        public string AgentName { get; set; }

        [JsonProperty("ConversationTranscriptGuid")]
        public string ConversationTranscriptGuid { get; set; }
    }
}