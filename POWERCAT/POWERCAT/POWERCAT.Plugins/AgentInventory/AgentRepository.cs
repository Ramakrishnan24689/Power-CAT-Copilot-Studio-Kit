// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json.Linq;
using static POWERCAT.Plugins.AgentInventory.AgentDataModel;

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
        /// <returns>Guid of created agent.</returns>
        public Guid? CreateAgent(AgentDetails agentDetails)
        {
            Guid? createdRecordId = null;
            try
            {
                //Get entity for creating agent
                Entity entity = GetAgentEntity(agentDetails);

                //Delete agent in the agent details table
                bool deletedResult = DeleteAgent(_tableName, agentDetails.ID);

                if (deletedResult == true)
                {
                    //Create an agent in the agent details table
                    createdRecordId = _organizationService.Create(entity);
                }
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"Agent creation failed for id - {agentDetails.ID.ToString()}. \n Details: {ex.Message}");
                throw ex;
            }
            return createdRecordId;
        }

        /// <summary>
        /// Delete agent in the agent details table.
        /// </summary>
        /// <param name="tableName">Agent details table name for deleting the agent.</param>
        /// <param name="agentDetails">Agent details for deleting agent in the agent details table.</param>
        /// <returns>bool value to indicate the deletion status.</returns>
        public bool DeleteAgent(string tableName, Guid agentId)
        {
            bool result = false;
            try
            {
                //Query expression for the delete operation
                QueryExpression query = new QueryExpression(tableName)
                {
                    ColumnSet = new ColumnSet("cat_agentid")
                };
                query.Criteria.AddCondition("cat_agentid", ConditionOperator.Equal, agentId);

                //Get agents data from the agent details table
                EntityCollection entities = _organizationService.RetrieveMultiple(query);

                if (entities.Entities.Count > 0)
                {
                    foreach (var item in entities.Entities)
                    {
                        //Delete the agent in the agent details table
                        _organizationService.Delete(tableName, item.Id);
                    }
                }
                result = true;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"Agent deletion failed for id - {agentId.ToString()}. \n Details: {ex.Message}");
                throw ex;
            }
            return result;
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
                    agentDetails.Instructions = agentDataProcess.ExtractComponentsData(instructions.ToList(), "instructions");
                }

                //Get DefaultApplicationId from synchronizationStatus json in agent details
                var synchronizationStatus = !string.IsNullOrEmpty(agentDetails.SynchronizationStatus) ? JObject.Parse(agentDetails.SynchronizationStatus) : null;
                agentDetails.DefaultApplicationId = synchronizationStatus != null ? agentDataProcess.ParseJsonData(synchronizationStatus, "applicationId") : string.Empty;

                //Get prompts from the data(yaml) in agent components
                var promptsList = agentComponentDetails.Where(obj => obj.Data != null && obj.Data.Contains("InvokeAIBuilderModelAction"));
                if (promptsList.Any())
                {
                    var prompts = agentDataProcess.ExtractComponentsData(promptsList.ToList(), "InvokeAIBuilderModelAction");
                    agentDetails.Prompts = !string.IsNullOrEmpty(prompts) ? prompts : string.Empty;
                }

                //Get httprequests from the data(yaml) in agent components
                var httpRequestsList = agentComponentDetails.Where(obj => obj.Data != null && obj.Data.Contains("HttpRequestAction"));
                if (httpRequestsList.Any())
                {
                    var httpRequestaction = agentDataProcess.ExtractComponentsData(httpRequestsList.ToList(), "HttpRequestAction");
                    agentDetails.HttpRequests = !string.IsNullOrEmpty(httpRequestaction) ? httpRequestaction : string.Empty;
                }

                //Get knowledge sources from the data(yaml) in agent components
                var knowledgeSourceList = agentComponentDetails.Where(
                                                        obj => (obj.ComponentType == 16 && obj.ComponentTypeName == "Knowledge Source")
                                                                || (obj.ComponentType == 14 && obj.ComponentTypeName == "Bot File Attachment"));
                if (knowledgeSourceList.Any())
                {
                    var kowledgeSources = agentDataProcess.ExtractComponentsData(knowledgeSourceList.ToList(), "KnowledgeSources");
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

                //If agent has actions then set to true
                agentDetails.UsesActions = agentComponentDetails.Where(
                                                        obj => obj.Data != null && obj.ComponentType == 9 &&
                                                               obj.Data.Contains("TaskDialog")).Count() > 0;

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

                }

                //If agent has actions or prompts or knowledge sources or orchestration type is generative or ai knowledge is true the set to true
                agentDetails.UsesGenAI = agentDetails.UsesActions || agentDetails.UsesAIKnowledge ||
                                             agentDetails.UsesKnowledgeSources || agentDetails.UsesPrompts ||
                                             string.Equals(agentDetails.OrchestrationType, "Generative", StringComparison.OrdinalIgnoreCase);
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
                Entity entity = new Entity(_tableName);

                //Details of the agent
                entity["cat_agentid"] = agentDetails.ID.ToString();
                entity["cat_name"] = agentDetails.Name;
                entity["cat_type"] = agentDetails.Type;

                //Environment details of the agent
                entity["cat_environmentname"] = agentDetails.EnvironmentName;
                entity["cat_environmentid"] = agentDetails.EnvironmentId.ToString();
                entity["cat_environmenttype"] = agentDetails.EnvironmentType;

                //Agent created and modified details
                entity["cat_agentcreatedby"] = agentDetails.AgentCreatedBy;
                entity["cat_agentcreateddate"] = !string.IsNullOrEmpty(agentDetails.AgentCreatedDate) ? DateTime.Parse(agentDetails.AgentCreatedDate?.ToString()).ToUniversalTime() : (DateTime?)null;
                entity["cat_agentmodifiedby"] = agentDetails.AgentModifiedBy;
                entity["cat_agentmodifieddate"] = !string.IsNullOrEmpty(agentDetails.AgentModifiedDate) ? DateTime.Parse(agentDetails.AgentModifiedDate?.ToString()).ToUniversalTime() : (DateTime?)null;

                //Agent publish details
                entity["cat_published"] = !string.IsNullOrEmpty(agentDetails.PublishedDate) ? true : false;
                entity["cat_publishedby"] = !string.IsNullOrEmpty(agentDetails.PublishedBy) ? agentDetails.PublishedBy : string.Empty;
                entity["cat_publisheddate"] = !string.IsNullOrEmpty(agentDetails.PublishedDate) ? DateTime.Parse(agentDetails.PublishedDate?.ToString()).ToUniversalTime() : (DateTime?)null;

                //Agent Specifications
                entity["cat_orchestrationtype"] = agentDetails.OrchestrationType;
                entity["cat_enduserauthenticationtype"] = agentDetails.EndUserAuthenticationType;
                entity["cat_defaultapplicationid"] = agentDetails.DefaultApplicationId;
                entity["cat_description"] = agentDetails.Description;
                entity["cat_instructions"] = agentDetails.Instructions;
                entity["cat_managedstate"] = agentDetails.IsManaged == true ? "Managed" : "Unmanaged";

                //Agent features
                entity["cat_usesgenai"] = agentDetails.UsesGenAI;
                entity["cat_usesaiknowledge"] = agentDetails.UsesAIKnowledge;
                entity["cat_usesenhancedsearchresults"] = agentDetails.UsesEnhancedSearchResult;
                entity["cat_usesactions"] = agentDetails.UsesActions;
                entity["cat_usesprompts"] = agentDetails.UsesPrompts;
                entity["cat_useshttprequests"] = agentDetails.UsesHttpRequests;
                entity["cat_usesskills"] = agentDetails.UsesSkills;
                entity["cat_usesknowledgesources"] = agentDetails.UsesKnowledgeSources;
                
                //Agent Components
                entity["cat_prompts"] = agentDetails.Prompts;
                entity["cat_httprequestactions"] = agentDetails.HttpRequests;
                entity["cat_knowledgesources"] = agentDetails.KnowledgeSources;

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
