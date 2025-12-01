using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using static POWERCAT.Plugins.ConversationKpi.ConversationKpiMain;
using System.IdentityModel.Metadata;
using System.Collections;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessAgentTranscripts
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
        /// Callback function for processing KPI response
        /// </summary>
        public delegate void CallbackFunction(ExecuteMultipleResponse responseWithResults, Dictionary<Guid, Guid> idDictionary);

        /// <summary>
        /// Constructor to initialize Organization & Tracing services
        /// </summary>
        /// <param name="organizationService">Organization Service</param>
        /// <param name="tracingService">Tracing Service</param>
        public ProcessAgentTranscripts(IOrganizationService organizationService, ITracingService tracingService)
        {
            _organizationService = organizationService;
            _tracingService = tracingService;
        }

        /// <summary>
        /// Generate Conversation KPIs based on Agent conversation transcripts
        /// </summary>
        /// <param name="context">Plugin context.</param>
        public void GenerateConversationKpis(IPluginExecutionContext context)
        {
            try
            {
                // Prepare fetch xml based on Agent Transcript Ids
                string agentTranscriptsIds = context.InputParameters["cat_AgentTranscriptsIds"] as string;
                string[] agentTranscriptsIdsArray = JsonConvert.DeserializeObject<string[]>(agentTranscriptsIds);
                string valuesXml = string.Join("", agentTranscriptsIdsArray.Select(id => $"<value>{id}</value>"));
                string fetchXml = @"<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false'>
                                      <entity name='cat_agenttranscripts'>
                                        <attribute name='cat_name' />
                                        <attribute name='cat_agenttranscriptsid' />
                                        <attribute name='cat_transcriptcontent' />
                                        <attribute name='cat_agentconfiguration' />
                                        <attribute name='cat_agentid' />
                                        <attribute name='cat_conversationdate' />
                                        <attribute name='cat_conversationid' />
                                        <attribute name='cat_trackedvariables' />
                                        <attribute name='cat_conversationtranscriptid' />
                                        <attribute name='cat_iscopyfulltranscriptenabled' />
                                        <attribute name='cat_batchid' />
                                        <attribute name='cat_isparent' />
                                        <filter type='and'>
                                          <condition attribute='cat_workflowstatus' operator='eq' value='1'/>
                                          <condition attribute='cat_agenttranscriptsid' operator='in'>
                                            {0}
                                          </condition>
                                        </filter>
                                      </entity>
                                    </fetch>";
                fetchXml = string.Format(fetchXml, valuesXml);

                // Retrieve the transcripts
                EntityCollection agentTranscriptList = _organizationService.RetrieveMultiple(new FetchExpression(fetchXml));

                //Dictionary to update agent status
                Dictionary<Guid, Guid> idDictionary = new Dictionary<Guid, Guid>();
                
                // Track duplicate agent transcript IDs to update them as completed
                List<Guid> duplicateAgentTranscriptIds = new List<Guid>();

                if (agentTranscriptList.Entities.Count > 0)
                {
                    // Process transcripts
                    List<ProcessDetails> processDetailsList = new List<ProcessDetails>();
                    ProcessSessionInsight processSessionInsight = new ProcessSessionInsight();
                    ProcessTrackedVariables processTrackedVariables = new ProcessTrackedVariables();
                    ProcessUnrecognizedUtterances processUnrecognizedUtterances = new ProcessUnrecognizedUtterances();
                    ProcessAmbiguousUtterances processAmbiguousUtterances = new ProcessAmbiguousUtterances();
                    ProcessTraversedComponents processTraversedComponents = new ProcessTraversedComponents();
                    ProcessGenerativeAnswersArray processGenerativeAnswersArray = new ProcessGenerativeAnswersArray();

                    foreach (Entity agentTranscript in agentTranscriptList.Entities)
                    {
                        string conversationId = agentTranscript.GetAttributeValue<string>("cat_conversationid").ToString();
                        string transcript = agentTranscript.GetAttributeValue<string>("cat_transcriptcontent");
                        string trackedVaribales = agentTranscript.GetAttributeValue<string>("cat_trackedvariables");
                        string agentId = agentTranscript.GetAttributeValue<string>("cat_agentid");
                        TranscriptModel transcriptModel = JsonConvert.DeserializeObject<TranscriptModel>(transcript);

                        Guid conversationTranscriptId = new Guid((string)agentTranscript["cat_conversationtranscriptid"]);
                        Guid agentTranscriptId = ((Guid)agentTranscript["cat_agenttranscriptsid"]);
                        bool isParentTranscript = agentTranscript.GetAttributeValue<bool>("cat_isparent");

                        if(isParentTranscript == true)
                        {
                            //fetchxml to get child transcripts for parent transcript
                            string agentfetchXml = @"<fetch version='1.0' output-format='xml-platform' mapping='logical' distinct='false'>
                                                      <entity name='cat_agenttranscripts'>
                                                        <attribute name='cat_agenttranscriptsid' />
                                                        <attribute name='cat_name' />
                                                        <attribute name='cat_agenttranscriptsid' />
                                                        <attribute name='cat_transcriptcontent' />
                                                        <attribute name='cat_batchid' />
                                                        <attribute name='cat_isparent' />
                                                        <filter type='and'>
                                                          <condition attribute='cat_parent' operator='eq' value='" + agentTranscript.Id + @"' />
                                                        </filter>
                                                        <order attribute='cat_batchid' />
                                                      </entity>
                                                    </fetch>";
                            EntityCollection duplicateTranscripts = _organizationService.RetrieveMultiple(new FetchExpression(agentfetchXml));

                            // loop through duplicate transcripts and parse the transcripts add to parent transcriptModel
                            foreach (Entity duplicateTranscript in duplicateTranscripts.Entities)
                            {
                                string duplicateTranscriptContent = duplicateTranscript.GetAttributeValue<string>("cat_transcriptcontent");
                                TranscriptModel duplicateTranscriptModel = JsonConvert.DeserializeObject<TranscriptModel>(duplicateTranscriptContent);
                                // activities add to parent transcriptModel
                                transcriptModel.activities.AddRange(duplicateTranscriptModel.activities);
                                // track duplicate transcript ids to update status as completed
                                duplicateAgentTranscriptIds.Add(duplicateTranscript.Id);
                            }

                            var serializedTranscript = JsonConvert.SerializeObject(transcriptModel);
                            // size is less than 1 MB add parent transcript
                            if (serializedTranscript.Length < 1048576)
                            {
                                transcript = serializedTranscript;
                            }
                        }

                        // Add the index to each model
                        var indexedModels = transcriptModel.activities.Select((model, index) =>
                        {
                            model.index = index;
                            return model;
                        }).ToList();

                        ProcessDetails processDetails = new ProcessDetails
                        {
                            AgentConfigurationId = ((EntityReference)agentTranscript["cat_agentconfiguration"]).Id.ToString(),
                            AgentId = agentId,
                            ConversationId = conversationId,
                            ConversationDate = (DateTime)agentTranscript["cat_conversationdate"],
                            TranscriptContent = transcript,
                            ConversationTranscriptId = conversationTranscriptId.ToString(),
                            CopyFullTranscript = agentTranscript.GetAttributeValue<bool>("cat_iscopyfulltranscriptenabled"),
                            SessionDetails = processSessionInsight.ProcessTranscript(indexedModels, conversationId, agentId),
                            ConversationInfoDetails = processSessionInsight.ProcessConversationInfoDetails(transcriptModel),
                            TrackedVariables = processTrackedVariables.ProcessForTrackedVariables(indexedModels, trackedVaribales, conversationId, agentId),
                            UnrecognizedUtterances = processUnrecognizedUtterances.ProcessForUnrecognizedUtterances(indexedModels, conversationId, agentId),
                            AmbiguousUtterances = processAmbiguousUtterances.ProcessForAmbiguousUtterances(indexedModels, conversationId, agentId),
                            TraversedComponentsList = processTraversedComponents.ProcessForTraversedComponents(indexedModels, conversationId, agentId),
                            GenerativeAnswersList = processGenerativeAnswersArray.ProcessForGenerativeAnswers(indexedModels, conversationId, agentId),
                        };
                        processDetails.GlobalSessionDetail = processSessionInsight.GetGlobalDetails(processDetails.SessionDetails);
                        processDetailsList.Add(processDetails);

                        // Populate the dictionary from the EntityCollection
                        idDictionary[conversationTranscriptId] = agentTranscriptId;
                    }

                    // Upsert Conversation KPIs
                    EntityCollection entitiesToUpsert = GetCollectionOfEntitiesToCreate(processDetailsList);
                    
                    ExecuteBatchRequests(entitiesToUpsert, idDictionary, (response, dict) => 
                    {
                        UpdateAgentTranScriptStatus(response, dict);
                        UpdateDuplicateTranscriptsAsCompleted(duplicateAgentTranscriptIds);
                    });
                }
            }
            catch (InvalidPluginExecutionException ex)
            {
                _tracingService.Trace($"Exception: {ex.Message}");
                throw ex;
            }
            catch (DivideByZeroException ex)
            {
                _tracingService.Trace($"Error: Division by zero. Details: {ex.Message}");
                throw ex;
            }
            catch (FormatException ex)
            {
                _tracingService.Trace($"Error: Invalid format. Details: {ex.Message}");
                throw ex;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method GenerateConversationKpis. Details: {ex.Message}");
                throw ex;
            }
            finally
            {
                _tracingService.Trace("Plugin execution finished.");
            }
        }

        /// <summary>
        /// Updates Agent Transcript status based on Upsert operation response
        /// </summary>
        /// <param name="responseWithResults">Conversation KPI Upsert operation response.</param>
        private void UpdateAgentTranScriptStatus(ExecuteMultipleResponse responseWithResults, Dictionary<Guid, Guid> idDictionary)
        {
            try
            {
                // Update status
                EntityCollection agentTransciptList = new EntityCollection();
                foreach (var responseItem in responseWithResults.Responses)
                {
                    Entity entity = new Entity("cat_agenttranscripts")
                    {
                        Id = idDictionary[((UpsertResponse)responseItem.Response).Target.Id]
                    };

                    if (responseItem.Fault == null)
                    {
                        entity["cat_workflowstatus"] = new OptionSetValue(2);         // Completed                    
                    }
                    else
                    {
                        entity["cat_workflowstatus"] = new OptionSetValue(3);         // Failed
                        entity["cat_workflowerror"] = responseItem.Fault.Message;     // Error details
                    }
                    agentTransciptList.Entities.Add(entity);
                }
                ExecuteBatchRequests(agentTransciptList, null, null);
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An error occurred in method UpdateAgentTranScriptStatus. Details: {ex.Message}");
                throw ex;
            }
        }

        /// <summary>
        /// Collect Conversation KPI entities
        /// </summary>
        /// <param name="processDetailsList">Conversation KPI details</param>
        /// <returns>Entity Collection</returns>
        public EntityCollection GetCollectionOfEntitiesToCreate(List<ProcessDetails> processDetailsList)
        {
            // Create Conversation KPI entity collection
            EntityCollection entityCollection = new EntityCollection();
            try
            {
                foreach (var processDetails in processDetailsList)
                {
                    Entity ConversationKpi = new Entity("cat_copilotkpi", "cat_copilotkpiid", processDetails.ConversationTranscriptId);
                    ConversationKpi["cat_name"] = processDetails.ConversationId + "-" + processDetails.ConversationInfoDetails?.Timestamp;
                    ConversationKpi["cat_copilotconfigurationid"] = new EntityReference("cat_copilotconfiguration", new Guid(processDetails.AgentConfigurationId));
                    ConversationKpi["cat_copilotid"] = processDetails.AgentId;
                    ConversationKpi["cat_conversationid"] = processDetails.ConversationId;
                    ConversationKpi["cat_conversationdate"] = processDetails.ConversationDate;
                    ConversationKpi["cat_conversationduration"] = processDetails.ConversationInfoDetails?.ConversationDuration;
                    ConversationKpi["cat_globaloutcomecode"] = new OptionSetValue((int)processDetails.GlobalSessionDetail?.GlobalOutcome);
                    if (processDetails.GlobalSessionDetail?.AvgCsat > 0) {
                        ConversationKpi["cat_csat"] = Convert.ToDecimal(processDetails.GlobalSessionDetail?.AvgCsat);
                    }
                    if (processDetails.CopyFullTranscript) {
                        ConversationKpi["cat_transcriptcontent"] = processDetails.TranscriptContent;
                    }                    
                    ConversationKpi["cat_sessions"] = processDetails.GlobalSessionDetail?.SessionCount;
                    ConversationKpi["cat_turns"] = processDetails.GlobalSessionDetail?.TotalTurnCount;
                    ConversationKpi["cat_userid"] = Convert.ToString(processDetails.ConversationInfoDetails?.UserId);
                    ConversationKpi["cat_sessionsdetails"] = JsonConvert.SerializeObject(processDetails.SessionDetails);
                    ConversationKpi["cat_ambiguousutterances"] = JsonConvert.SerializeObject(processDetails.AmbiguousUtterances);
                    ConversationKpi["cat_unrecognizedutterances"] = JsonConvert.SerializeObject(processDetails.UnrecognizedUtterances);
                    ConversationKpi["cat_traversedcomponents"] = JsonConvert.SerializeObject(processDetails.TraversedComponentsList);
                    ConversationKpi["cat_trackedvariables"] = JsonConvert.SerializeObject(processDetails.TrackedVariables);
                    ConversationKpi["cat_generativeanswers"] = JsonConvert.SerializeObject(processDetails.GenerativeAnswersList);
                    entityCollection.Entities.Add(ConversationKpi);
                }
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An error occurred in method GetCollectionOfEntitiesToCreate. Details: {ex.Message}");
                throw ex;
            }
            return entityCollection;
        }

        /// <summary>
        /// Common method for ExecuteMultipleRequests
        /// </summary>
        /// <param name="entityCollection"> Entity collection for update/upsert </param
        /// <param name="callback"> Callback function </param>
        public void ExecuteBatchRequests(EntityCollection entityCollection, Dictionary<Guid, Guid> idDictionary,
            CallbackFunction callback)
        {
            try
            {
                // Create an ExecuteMultipleRequest object.
                ExecuteMultipleRequest requestWithResults = new ExecuteMultipleRequest()
                {
                    Settings = new ExecuteMultipleSettings()
                    {
                        ContinueOnError = true,
                        ReturnResponses = true
                    },
                    Requests = new OrganizationRequestCollection()
                };

                // Add a Create/Update Request for each entity to the request collection.
                foreach (var entity in entityCollection.Entities)
                {
                    if (entity.Id != Guid.Empty)
                    {
                        UpdateRequest updateRequest = new UpdateRequest { Target = entity };
                        requestWithResults.Requests.Add(updateRequest);
                    }
                    else
                    {
                        UpsertRequest request = new UpsertRequest() { Target = entity };
                        requestWithResults.Requests.Add(request);
                    }
                }

                // Execute all the requests in the request collection using a single web method call.
                ExecuteMultipleResponse responseWithResults =
                (ExecuteMultipleResponse)_organizationService.Execute(requestWithResults);

                callback?.Invoke(responseWithResults, idDictionary);
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An error occurred in method ExecuteBatchRequests. Details: {ex.Message}");
                throw ex;
            }
        }

        /// <summary>
        /// Updates duplicate agent transcripts as completed
        /// </summary>
        /// <param name="duplicateAgentTranscriptIds">List of duplicate agent transcript IDs</param>
        private void UpdateDuplicateTranscriptsAsCompleted(List<Guid> duplicateAgentTranscriptIds)
        {
            try
            {
                if (duplicateAgentTranscriptIds == null || duplicateAgentTranscriptIds.Count == 0)
                {
                    return;
                }

                EntityCollection duplicateTranscriptList = new EntityCollection();
                foreach (Guid duplicateId in duplicateAgentTranscriptIds)
                {
                    Entity entity = new Entity("cat_agenttranscripts")
                    {
                        Id = duplicateId,
                        ["cat_workflowstatus"] = new OptionSetValue(2) // Completed
                    };
                    duplicateTranscriptList.Entities.Add(entity);
                }
                
                _tracingService.Trace($"Updating {duplicateAgentTranscriptIds.Count} duplicate transcripts as completed");
                ExecuteBatchRequests(duplicateTranscriptList, null, null);
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An error occurred in method UpdateDuplicateTranscriptsAsCompleted. Details: {ex.Message}");
                throw ex;
            }
        }
    }
}
