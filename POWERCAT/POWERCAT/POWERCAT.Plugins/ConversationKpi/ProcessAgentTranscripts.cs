using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using static POWERCAT.Plugins.ConversationKpi.ConversationKpiMain;

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
                                        <attribute name='cat_agenttranscriptsid' />
                                        <attribute name='cat_transcriptcontent' />
                                        <attribute name='cat_agentconfiguration' />
                                        <attribute name='cat_agentid' />
                                        <attribute name='cat_conversationdate' />
                                        <attribute name='cat_conversationid' />
                                        <attribute name='cat_trackedvariables' />
                                        <filter type='and'>
                                          <condition attribute='cat_workflowstatus' operator='eq' value='1'/>
                                          <condition attribute='cat_agenttranscriptsid' operator='in'>
                                            {0}
                                          </condition>
                                        </filter>
                                      </entity>
                                    </fetch>"
                ;
                fetchXml = string.Format(fetchXml, valuesXml);

                // Retrieve the transcripts
                EntityCollection agentTranscriptList = _organizationService.RetrieveMultiple(new FetchExpression(fetchXml));

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
                        Guid agentTranscriptId = agentTranscript.Id;
                        string conversationId = agentTranscript.GetAttributeValue<string>("cat_conversationid").ToString();
                        string transcript = agentTranscript.GetAttributeValue<string>("cat_transcriptcontent");
                        string trackedVaribales = agentTranscript.GetAttributeValue<string>("cat_trackedvariables");
                        TranscriptModel transcriptModel = JsonConvert.DeserializeObject<TranscriptModel>(transcript);

                        // Add the index to each model
                        var indexedModels = transcriptModel.activities.Select((model, index) =>
                        {
                            model.index = index;
                            return model;
                        }).ToList();

                        ProcessDetails processDetails = new ProcessDetails
                        {
                            AgentTranscriptId = agentTranscriptId,
                            AgentConfigurationId = ((EntityReference)agentTranscript["cat_agentconfiguration"]).Id.ToString(),
                            AgentId = agentTranscript.GetAttributeValue<string>("cat_agentid"),
                            ConversationId = conversationId,
                            ConversationDate = (DateTime)agentTranscript["cat_conversationdate"],
                            SessionDetails = processSessionInsight.ProcessTranscript(indexedModels, conversationId),
                            ConversationInfoDetails = processSessionInsight.ProcessConversationInfoDetails(transcriptModel),
                            TrackedVariables = processTrackedVariables.ProcessForTrackedVariables(indexedModels, trackedVaribales, conversationId),
                            UnrecognizedUtterances = processUnrecognizedUtterances.ProcessForUnrecognizedUtterances(indexedModels, conversationId),
                            AmbiguousUtterances = processAmbiguousUtterances.ProcessForAmbiguousUtterances(indexedModels, conversationId),
                            TraversedComponentsList = processTraversedComponents.ProcessForTraversedComponents(indexedModels, conversationId),
                            GenerativeAnswersList = processGenerativeAnswersArray.ProcessForGenerativeAnswers(indexedModels, conversationId),
                        };
                        processDetails.GlobalSessionDetail = processSessionInsight.GetGlobalDetails(processDetails.SessionDetails);
                        processDetailsList.Add(processDetails);
                    }

                    // Upsert Conversation KPIs
                    EntityCollection entitiesToUpsert = GetCollectionOfEntitiesToCreate(processDetailsList);
                    
                    ExecuteBatchRequests(entitiesToUpsert, UpdateAgentTranScriptStatus);
                }
            }
            catch (InvalidPluginExecutionException ex)
            {
                _tracingService.Trace($"Exception: {ex.Message}");
                throw;
            }
            catch (DivideByZeroException ex)
            {
                _tracingService.Trace($"Error: Division by zero. Details: {ex.Message}");
            }
            catch (FormatException ex)
            {
                _tracingService.Trace($"Error: Invalid format. Details: {ex.Message}");
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method GenerateConversationKpis. Details: {ex.Message}");
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
        private void UpdateAgentTranScriptStatus(ExecuteMultipleResponse responseWithResults)
        {
            try
            {
                // Update status
                EntityCollection agentTransciptList = new EntityCollection();
                foreach (var responseItem in responseWithResults.Responses)
                {
                    Entity entity = new Entity("cat_agenttranscripts")
                    {
                        Id = ((UpsertResponse)responseItem.Response).Target.Id
                    };
                    if (responseItem.Fault == null)
                    {
                        entity["cat_workflowstatus"] = new OptionSetValue(2);           // Completed                    
                    }
                    else
                    {
                        entity["cat_workflowstatus"] = new OptionSetValue(3);          // Failed
                        entity["cat_workflowerror"] = responseItem.Fault.Message;     // Error details
                    }
                    agentTransciptList.Entities.Add(entity);
                }
                ExecuteBatchRequests(agentTransciptList, null);
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An error occurred in method UpdateAgentTranScriptStatus. Details: {ex.Message}");
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
                    Entity ConversationKpi = new Entity("cat_copilotkpi", "cat_copilotkpiid", processDetails.AgentTranscriptId);
                    ConversationKpi["cat_name"] = processDetails.ConversationId + "-" + processDetails.ConversationInfoDetails?.Timestamp;
                    ConversationKpi["cat_copilotconfigurationid"] = new EntityReference("cat_copilotconfiguration", new Guid(processDetails.AgentConfigurationId));
                    ConversationKpi["cat_copilotid"] = processDetails.AgentId;
                    ConversationKpi["cat_conversationid"] = processDetails.ConversationId;
                    ConversationKpi["cat_conversationdate"] = processDetails.ConversationDate;
                    ConversationKpi["cat_conversationduration"] = processDetails.ConversationInfoDetails?.ConversationDuration;
                    ConversationKpi["cat_globaloutcomecode"] = new OptionSetValue((int)processDetails.GlobalSessionDetail?.GlobalOutcome);
                    if (processDetails.GlobalSessionDetail?.AvgCsat > 0)
                    {
                        ConversationKpi["cat_csat"] = Convert.ToDecimal(processDetails.GlobalSessionDetail?.AvgCsat);
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
            }
            return entityCollection;
        }

        /// <summary>
        /// Common method for ExecuteMultipleRequests
        /// </summary>
        /// <param name="entityCollection"> Entity collection for update/upsert </param
        /// <param name="callback"> Callback function </param>
        public void ExecuteBatchRequests(EntityCollection entityCollection,
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

                callback?.Invoke(responseWithResults);
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An error occurred in method ExecuteBatchRequests. Details: {ex.Message}");
            }
        }
    }
}
