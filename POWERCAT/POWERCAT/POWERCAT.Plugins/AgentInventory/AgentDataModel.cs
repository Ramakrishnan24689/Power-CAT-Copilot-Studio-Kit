// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;

namespace POWERCAT.Plugins.AgentInventory
{
    /// <summary>
    /// Represents input data model of an agent
    /// </summary>
    public class AgentDataModel
    {
        /// <summary>
        /// Represents Agent Input
        /// </summary>
        public class AgentInput
        {
            public AgentDetails AgentDetails { get; set; }
            public List<AgentComponentDetails> AgentComponentDetails { get; set; }
        }

        /// <summary>
        /// Represents Agent Details
        /// </summary>
        public class AgentDetails
        {
            public Guid ID { get; set; }
            public string Name { get; set; }
            public string Configuration { get; set; }
            public string SynchronizationStatus { get; set; }
            public string Type { get; set; }
            public string EnvironmentName { get; set; }
            public string EnvironmentId { get; set; }
            public string EnvironmentType { get; set; }
            public string EnvironmentUrl { get; set; }
            public string AgentCreatedDate { get; set; }
            public string AgentCreatedBy { get; set; }
            public string AgentModifiedDate { get; set; }
            public string AgentModifiedBy { get; set; }
            public string PublishedDate { get; set; }
            public string PublishedBy { get; set; }
            public string OrchestrationType { get; set; }
            public string EndUserAuthenticationType { get; set; }
            public bool IsManaged { get; set; }
            public string Template { get; set; }
            public bool IsTranscriptAvailable { get; set; }
            public string AgentCreatedByADID { get; set; }
            public string AgentCreatedByUPN { get; set; }
            public bool UsesGenAI { get; set; }
            public bool UsesAIKnowledge { get; set; }
            public bool UsesEnhancedSearchResult { get; set; }
            public bool UsesActions { get; set; }
            public bool UsesPrompts { get; set; }
            public bool UsesHttpRequests { get; set; }
            public bool UsesSkills { get; set; }
            public bool UsesKnowledgeSources { get; set; }
            public string Description { get; set; }
            public string Instructions { get; set; }
            public string Prompts { get; set; }
            public string HttpRequests { get; set; }
            public string KnowledgeSources { get; set; }
            public string DefaultApplicationId { get; set; }
            public bool AutonomousAgent { get; set; }
            public bool UsesClassicGenerativeAnswersSources { get; set; }
            public bool UsesMCP { get; set; }
            public bool UsesCustomizedResponse { get; set; }
            public bool UsesConnectorMakerAuthContext { get; set; }
            public bool UsesCloudFlowAuthContext { get; set; }
            public bool UsesCustomKnowledgeSource { get; set; }
            public string ClassicDataSources { get; set; }
            public string Connections { get; set; }
            public string AgentTriggers { get; set; }
            public bool UsesFileInput { get; set; }
            public bool UsesDeepReasoningModels { get; set; }
<<<<<<< HEAD
            public bool UsesEvaluation { get; set; }
=======
            public bool WebSearchEnabled { get; set; }

>>>>>>> 15d71373d2e66ac536dc3f1bfe0bf8f36d01fb48
        }

        /// <summary>
        /// Represents Agent Component Details
        /// </summary>
        public class AgentComponentDetails
        {
            public Guid BotComponentId { get; set; }
            public int ComponentType { get; set; }
            public string Data { get; set; }
            public string Description { get; set; }
            public string ComponentTypeName { get; set; }
            public string FileData { get; set; }
            public string FileDataName { get; set; }
            public string Name { get; set; }
            public string SchemaName { get; set; }
            public string CreatedOn { get; set; }
            public string CreatedBy { get; set; }
            public string ModifiedOn { get; set; }
            public string ModifiedBy { get; set; }
        }

        /// <summary>
        /// Represents Agent Uage Data
        /// </summary>
        public class AgentTenantUsageData
        {
            public string EnvironmentID { get; set; }
            public string EnvironmentName { get; set; }
            public string AgentName { get; set; }
            public string AgentID { get; set; }
            public string Feature { get; set; }
            public decimal BilledMessages { get; set; }
            public decimal NonBilledMessages { get; set; }
            public DateTime UsageDate { get; set; }
        }
    }
}
