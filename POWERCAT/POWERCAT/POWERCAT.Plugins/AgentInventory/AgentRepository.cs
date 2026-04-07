// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json.Linq;
using static POWERCAT.Plugins.AgentInventory.AgentDataModel;
using static POWERCAT.Plugins.AgentInventory.AgentDataProcessor;

namespace POWERCAT.Plugins.AgentInventory
{
    /// <summary>
    /// Agent repository class for the agent operations.
    /// </summary>
    public class AgentRepository
    {
        /// <summary>
        /// Organization Service
        /// </summary>
        private readonly IOrganizationService _organizationService;

        /// <summary>
        /// Tracing Service
        /// </summary>
        private readonly ITracingService _tracingService;

        /// <summary>
        /// Table Name
        /// </summary>
        private readonly string _tableName;

        /// <summary>
        /// Constructor to initialize Organization, Tracing services and Table name
        /// </summary>
        /// <param name="organizationService">Organization Service</param>
        /// <param name="tracingService">Tracing Service</param>
        public AgentRepository(IOrganizationService organizationservice, ITracingService tracingservice)
        {
            this._organizationService = organizationservice;
            this._tracingService = tracingservice;

            //Set table name of the Agent Inventory
            this._tableName = "cat_agentdetails";
        }

        /// <summary>
        /// Create agent in the agent details table.
        /// </summary>
        /// <param name="agentDetails">Agent details input for creating agent.</param>
        /// <returns>Created agent detail id and its components.</returns>
        public CreateAgentResponse CreateAgent(AgentDetails agentDetails)
        {
            try
            {
                Guid? createdRecordId = null;

                //Get entity for creating agent
                Entity entity = GetAgentEntity(agentDetails);

                //Create an agent in the agent details table
                createdRecordId = _organizationService.Create(entity);

                string prompts = entity.Contains("cat_prompts") ? entity.GetAttributeValue<string>("cat_prompts") : null;
                string connections = entity.Contains("cat_connections") ? entity.GetAttributeValue<string>("cat_connections") : null;

                return new CreateAgentResponse
                {
                    AgentDetailsId = createdRecordId,
                    AgentComponents = new AgentComponents
                    {
                        Prompts = prompts ?? string.Empty,
                        Connections = connections ?? string.Empty
                    }
                };
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"Agent creation failed for id - {agentDetails.ID.ToString()}. \n Details: {ex.Message}");
                throw ex;
            }
        }

        /// <summary>
        /// Process agent data for the create operation.
        /// </summary>
        /// <param name="agentDetails">Agent Details.</param>
        /// <param name="agentComponentDetails">Agent component details.</param>
        /// <returns>agentDetails.</returns>
        public AgentDetails GetAgentData(AgentDetails agentDetails, List<AgentComponentDetails> agentComponentDetails)
        {
            try
            {
                AgentDataProcessor agentDataProcess = new AgentDataProcessor();

                //Get description from agent components
                agentDetails.Description = agentComponentDetails.Where(obj => obj.ComponentType == 15 && obj.ComponentTypeName == "Custom GPT"
                                                          && obj.Description != null).FirstOrDefault()?.Description ?? string.Empty;

                //Get instructions from agent components
                var instructions = agentComponentDetails.Where(obj => obj.ComponentType == 15 && obj.ComponentTypeName == "Custom GPT");
                if (instructions.Any())
                {
                    agentDetails.Instructions = agentDataProcess.ExtractComponentsData(instructions.ToList(), ComponentKeyEnum.Instructions);
                }

                //Get DefaultApplicationId from synchronizationStatus json in agent details
                var synchronizationStatus = !string.IsNullOrEmpty(agentDetails.SynchronizationStatus) ? JObject.Parse(agentDetails.SynchronizationStatus) : null;
                agentDetails.DefaultApplicationId = synchronizationStatus != null ? agentDataProcess.ParseJsonData(synchronizationStatus, "applicationId") : string.Empty;

                //Get prompts from the data(yaml) in agent components
                var promptsList = agentComponentDetails.Where(obj => obj.Data != null && (obj.Data.Contains("InvokeAIBuilderModelAction") || obj.Data.Contains("InvokeAIBuilderModelTaskAction")));
                if (promptsList.Any())
                {
                    var prompts = agentDataProcess.ExtractComponentsData(promptsList.ToList(), ComponentKeyEnum.InvokeAIBuilderModelAction);
                    agentDetails.Prompts = !string.IsNullOrEmpty(prompts) ? prompts : string.Empty;
                }

                //Get httprequests from the data(yaml) in agent components
                var httpRequestsList = agentComponentDetails.Where(obj => obj.Data != null && obj.Data.Contains("HttpRequestAction"));
                if (httpRequestsList.Any())
                {
                    var httpRequestaction = agentDataProcess.ExtractComponentsData(httpRequestsList.ToList(), ComponentKeyEnum.HttpRequestAction);
                    agentDetails.HttpRequests = !string.IsNullOrEmpty(httpRequestaction) ? httpRequestaction : string.Empty;
                }

                //Get knowledge sources from the data(yaml) in agent components
                var knowledgeSourceList = agentComponentDetails.Where(
                                                        obj => (obj.ComponentType == 16 && obj.ComponentTypeName == "Knowledge Source")
                                                                || (obj.ComponentType == 14 && obj.ComponentTypeName == "Bot File Attachment"));
                if (knowledgeSourceList.Any())
                {
                    var kowledgeSources = agentDataProcess.ExtractComponentsData(knowledgeSourceList.ToList(), ComponentKeyEnum.KnowledgeSources);
                    agentDetails.KnowledgeSources = !string.IsNullOrEmpty(kowledgeSources) ? kowledgeSources : string.Empty;
                }

                //If knowledge sources has value then set to true
                agentDetails.UsesKnowledgeSources = !string.IsNullOrEmpty(agentDetails.KnowledgeSources) ? true : false;

                //If prompts has value then set to true
                agentDetails.UsesPrompts = !string.IsNullOrEmpty(agentDetails.Prompts) ? true : false;

                //If httprequests has value then set to true
                agentDetails.UsesHttpRequests = !string.IsNullOrEmpty(agentDetails.HttpRequests) ? true : false;

                //If agent has skills then set to true
                agentDetails.UsesSkills = agentComponentDetails.Where(
                                                        obj => obj.Data != null && obj.ComponentType == 9 &&
                                                               obj.Data.Contains("InvokeSkillAction")).Count() > 0;

                //If agent has tools then set to true
                agentDetails.UsesTools = agentComponentDetails.Where(
                                                        obj => obj.Data != null && obj.ComponentType == 9 &&
                                                               obj.Data.Contains("TaskDialog")).Count() > 0;

                //Get classicDataSources from the data(yaml) in agent components
                var classicDataSourcesList = agentComponentDetails.Where(
                                                        obj => obj.Data != null && obj.ComponentType == 9 &&
                                                               obj.Data.Contains("- kind: SearchAndSummarizeContent") &&
                                                               (obj.Data.Replace(" ", "").Contains("publicDataSource:\r\nsites:") ||
                                                               obj.Data.Replace(" ", "").Contains("customDataSource:\r\nsearchResults:") ||
                                                               obj.Data.Replace(" ", "").Contains("sharePointSearchDataSource:\r\nsites:") ||
                                                               obj.Data.Replace(" ", "").Contains("azureOpenAIOnYourDataSource:\r\ndataSources:")));
                if (classicDataSourcesList.Any())
                {
                    var classicDataSources = agentDataProcess.ExtractComponentsData(classicDataSourcesList.ToList(), ComponentKeyEnum.ClassicDataSources);
                    agentDetails.ClassicDataSources = !string.IsNullOrEmpty(classicDataSources) ? classicDataSources : string.Empty;
                }

                //Get Agent Triggers from the data(yaml) in agent components
                var agentTriggersList = agentComponentDetails.Where(obj => obj.ComponentType == 17 && obj.ComponentTypeName == "External Trigger");
                if (agentTriggersList.Any())
                {
                    var agentTriggers = agentDataProcess.ExtractComponentsData(agentTriggersList.ToList(), ComponentKeyEnum.AgentTriggers);
                    agentDetails.AgentTriggers = !string.IsNullOrEmpty(agentTriggers) ? agentTriggers : string.Empty;
                }

                //Get connections from the data(yaml) in agent components
                var connectionsLists = agentComponentDetails.Where(obj => obj.Data != null && (obj.Data.Contains("connectionReference:") || obj.Data.Contains("flowId:")));
                if (connectionsLists.Any())
                {
                    var connections = agentDataProcess.ExtractComponentsData(connectionsLists.ToList(), ComponentKeyEnum.Connections);
                    agentDetails.Connections = !string.IsNullOrEmpty(connections) ? connections : string.Empty;
                }

                //If connections in agent has connection mode as maker then true
                if (!string.IsNullOrEmpty(agentDetails.Connections))
                {
                    agentDetails.UsesConnectorMakerAuthContext = JArray.Parse(agentDetails.Connections).Where(obj => obj["Type"]?.ToString() == "Agent" && obj["ConnectionMode"]?.ToString() == "Maker").Any();
                }

                //If agent uses classic data sources then true
                agentDetails.UsesClassicGenerativeAnswersSources = !string.IsNullOrEmpty(agentDetails.ClassicDataSources) ? true : false;

                //If Agent Trigger is available then true
                agentDetails.AutonomousAgent = !string.IsNullOrEmpty(agentDetails.AgentTriggers) ? true : false;

                //If agent uses MCP then true
                agentDetails.UsesMCP = agentComponentDetails.Where(
                                                        obj => obj.Data != null && obj.ComponentType == 9 &&
                                                               obj.Data.Contains("kind: InvokeExternalAgentTaskAction")).Any();

                //If agent uses customized knowledge source then true
                agentDetails.UsesCustomKnowledgeSource = agentComponentDetails.Where(
                                                        obj => obj.Data != null && obj.ComponentType == 9 &&
                                                               obj.Data.StartsWith("kind: AdaptiveDialog\r\nbeginDialog:\r\n  kind: OnKnowledgeRequested")).Any();

                //If agent uses customized response then true
                agentDetails.UsesCustomizedResponse = agentComponentDetails.Where(
                                                        obj => obj.Data != null && obj.ComponentType == 9 &&
                                                               obj.Data.Contains("- kind: AnswerQuestionWithAI")).Any();

                //Get GenerativeActionsEnabled, useModelKnowledge, isSemanticSearchEnabled from configuration json in agent details
                if (!string.IsNullOrEmpty(agentDetails.Configuration))
                {
                    var configJson = JObject.Parse(agentDetails.Configuration);

                    //If GenerativeActionsEnabled is true then OrchestrationType is generative else classic
                    var generativeActionsEnabled = agentDataProcess.ParseJsonData(configJson, "GenerativeActionsEnabled").ToLower();
                    agentDetails.OrchestrationType = (!string.IsNullOrEmpty(generativeActionsEnabled) && generativeActionsEnabled != "false" ? true : false) ? "Generative" : "Classic";

                    var modelKnowledge = agentDataProcess.ParseJsonData(configJson, "useModelKnowledge").ToLower();
                    agentDetails.UsesAIKnowledge = !string.IsNullOrEmpty(modelKnowledge) && modelKnowledge != "false" ? true : false;

                    var enhanceSearchResult = agentDataProcess.ParseJsonData(configJson, "isSemanticSearchEnabled").ToLower();
                    agentDetails.UsesEnhancedSearchResult = !string.IsNullOrEmpty(enhanceSearchResult) && enhanceSearchResult != "false" ? true : false;

                    var fileInput = agentDataProcess.ParseJsonData(configJson, "isFileAnalysisEnabled").ToLower();
                    agentDetails.UsesFileInput = !string.IsNullOrEmpty(fileInput) && fileInput != "false" ? true : false;

                    var deepReasoningModels = agentDataProcess.ParseJsonData(configJson, "optInUseLatestModels").ToLower();
                    agentDetails.UsesDeepReasoningModels = !string.IsNullOrEmpty(deepReasoningModels) && deepReasoningModels != "false" ? true : false;

                }

                // Determines whether the agent utilizes generative AI capabilities by evaluating multiple other properties.
                // If any of the following properties are true: 
                // UsesTools, UsesAIKnowledge, UsesKnowledgeSources, UsesPrompts, UsesClassicGenerativeAnswersSources, UsesMCP, and UsesCustomizedResponse. 
                // Also checks if the orchestration type is explicitly set to "Generative".
                agentDetails.UsesGenAI = agentDetails.UsesTools || agentDetails.UsesAIKnowledge ||
                                             agentDetails.UsesKnowledgeSources || agentDetails.UsesPrompts || agentDetails.UsesClassicGenerativeAnswersSources ||
                                             agentDetails.UsesMCP || agentDetails.UsesCustomizedResponse ||
                                             string.Equals(agentDetails.OrchestrationType, "Generative", StringComparison.OrdinalIgnoreCase);

                // Check if web search enabled 
                agentDetails.WebSearchEnabled = agentComponentDetails.Where(obj => obj.ComponentType == 15 && obj.ComponentTypeName == "Custom GPT" && obj.Data.Contains("gptCapabilities:\r\n") && obj.Data.Contains("webBrowsing: true")).Any();

                // Returns true if test evaluation is configured for the agent. 
                agentDetails.UsesEvaluation = agentComponentDetails.Where(
                                                        obj => obj.Data != null && obj.ComponentType == 19 &&
                                                               obj.ComponentTypeName == "Test Case").Count() > 0;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"Agent data process failed for id {agentDetails.ID.ToString()}. \r\nDetails: {ex.Message}");
                throw ex;
            }
            return agentDetails;
        }

        /// <summary>
        /// Create entity for creating agent in the agent details table.
        /// </summary>
        /// <param name="agentDetails">Agent details input for creating agent entity.</param>
        /// <returns>Entity for an agent.</returns>
        public Entity GetAgentEntity(AgentDetails agentDetails)
        {
            try
            {
                const int yesValue = 1;
                const int noValue = 0;
                const int unknownValue = 2;

                Entity entity = new Entity(_tableName);

                //Details of the agent
                entity["cat_agentid"] = agentDetails.ID.ToString();
                entity["cat_name"] = agentDetails.Name;
                entity["cat_type"] = !string.IsNullOrWhiteSpace(agentDetails.Template) && agentDetails.Template.StartsWith("gpt-", StringComparison.OrdinalIgnoreCase) ? "Declarative" : "Custom";
                entity["cat_template"] = agentDetails.Template;
                entity["cat_agentcreatedin"] = "Copilot Studio";
                entity["cat_agentschemaname"] = agentDetails.AgentSchemaName;
                entity["cat_hassysadminaccesscode"] = new OptionSetValue(yesValue);
                entity["cat_hasppacenvmismatchcode"] = new OptionSetValue(noValue);

                //Environment details of the agent
                entity["cat_environmentname"] = agentDetails.EnvironmentName;
                entity["cat_environmentid"] = agentDetails.EnvironmentId.ToString();
                entity["cat_environmenttype"] = agentDetails.EnvironmentType;
                entity["cat_environmenturl"] = agentDetails.EnvironmentUrl;
                entity["cat_location"] = agentDetails.Location;

                //Agent created and modified details
                entity["cat_agentcreatedby"] = agentDetails.AgentCreatedBy;
                entity["cat_agentcreateddate"] = !string.IsNullOrEmpty(agentDetails.AgentCreatedDate) ? DateTime.Parse(agentDetails.AgentCreatedDate?.ToString()).ToUniversalTime() : (DateTime?)null;
                entity["cat_agentmodifiedby"] = agentDetails.AgentModifiedBy;
                entity["cat_agentmodifieddate"] = !string.IsNullOrEmpty(agentDetails.AgentModifiedDate) ? DateTime.Parse(agentDetails.AgentModifiedDate?.ToString()).ToUniversalTime() : (DateTime?)null;
                entity["cat_agentcreatedbyadid"] = !string.IsNullOrEmpty(agentDetails.AgentCreatedByADID) ? agentDetails.AgentCreatedByADID : string.Empty;
                entity["cat_agentcreatedbyupn"] = !string.IsNullOrEmpty(agentDetails.AgentCreatedByUPN) ? agentDetails.AgentCreatedByUPN : string.Empty;
                entity["cat_agentowner"] = agentDetails.AgentOwner;
                entity["cat_agentowneremail"] = !string.IsNullOrEmpty(agentDetails.AgentOwnerEmail) ? agentDetails.AgentOwnerEmail : string.Empty;

                //Agent publish details
                entity["cat_publishedcode"] = !string.IsNullOrEmpty(agentDetails.PublishedDate) ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_publishedby"] = !string.IsNullOrEmpty(agentDetails.PublishedBy) ? agentDetails.PublishedBy : string.Empty;
                entity["cat_publisheddate"] = !string.IsNullOrEmpty(agentDetails.PublishedDate) ? DateTime.Parse(agentDetails.PublishedDate?.ToString()).ToUniversalTime() : (DateTime?)null;

                //Agent Specifications
                entity["cat_orchestrationtype"] = !string.IsNullOrEmpty(agentDetails.OrchestrationType) ? agentDetails.OrchestrationType : "Classic";
                entity["cat_enduserauthenticationtype"] = agentDetails.EndUserAuthenticationType;
                entity["cat_defaultapplicationid"] = agentDetails.DefaultApplicationId;
                entity["cat_description"] = agentDetails.Description;
                entity["cat_instructions"] = agentDetails.Instructions;
                entity["cat_managedstate"] = agentDetails.IsManaged == true ? "Managed" : "Unmanaged";

                var isTranscript = unknownValue;
                if (agentDetails.IsTranscriptAvailable == yesValue)
                {
                    isTranscript = yesValue;
                }
                else if (agentDetails.IsTranscriptAvailable == noValue)
                {
                    isTranscript = noValue;
                }
                entity["cat_istranscriptavailablecode"] = new OptionSetValue(isTranscript);

                //Agent Configurations
                entity["cat_usesgenaicode"] = agentDetails.UsesGenAI ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesaiknowledgecode"] = agentDetails.UsesAIKnowledge ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesenhancedsearchresultscode"] = agentDetails.UsesEnhancedSearchResult ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesfileinputcode"] = agentDetails.UsesFileInput ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesdeepreasoningmodelscode"] = agentDetails.UsesDeepReasoningModels ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);

                //Agent features
                entity["cat_usestoolscode"] = agentDetails.UsesTools ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usespromptscode"] = agentDetails.UsesPrompts ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_useshttprequestscode"] = agentDetails.UsesHttpRequests ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesskillscode"] = agentDetails.UsesSkills ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesknowledgesourcescode"] = agentDetails.UsesKnowledgeSources ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_autonomousagentcode"] = agentDetails.AutonomousAgent ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesclassicgenerativeanswerssourcescode"] = agentDetails.UsesClassicGenerativeAnswersSources ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesmcpcode"] = agentDetails.UsesMCP ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usescustomizedresponsecode"] = agentDetails.UsesCustomizedResponse ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesconnectormakerauthcontextcode"] = agentDetails.UsesConnectorMakerAuthContext ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usescustomknowledgesourcecode"] = agentDetails.UsesCustomKnowledgeSource ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_websearchenabledcode"] = agentDetails.WebSearchEnabled ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);
                entity["cat_usesevaluationcode"] = agentDetails.UsesEvaluation ? new OptionSetValue(yesValue) : new OptionSetValue(noValue);

                //Agent Components
                entity["cat_prompts"] = agentDetails.Prompts;
                entity["cat_httprequestactions"] = agentDetails.HttpRequests;
                entity["cat_knowledgesources"] = agentDetails.KnowledgeSources;
                entity["cat_classicdatasources"] = agentDetails.ClassicDataSources;
                entity["cat_connections"] = agentDetails.Connections;
                entity["cat_agenttriggers"] = agentDetails.AgentTriggers;

                return entity;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"Agent entity creation failed for id - {agentDetails.ID.ToString()}. \n Details: {ex.Message}");
                throw ex;
            }
        }
    }
}
