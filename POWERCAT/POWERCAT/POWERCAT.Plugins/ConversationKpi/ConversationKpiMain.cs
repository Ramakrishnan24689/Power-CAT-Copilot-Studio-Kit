// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using System;
using System.Collections.Generic;
using Newtonsoft.Json;
using System.Linq;
using Microsoft.Xrm.Sdk.Messages;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ConversationKpiMain : IPlugin
    {
        public delegate void CallbackFunction(ExecuteMultipleResponse responseWithResults, ITracingService tracingService);

        IOrganizationService organizationService;
        ITracingService tracingService;

        private string upsertDuration = "";
        private string createDuration = "";


        public void Execute(IServiceProvider serviceProvider)
        {
            // Obtain the tracing service
            tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            DateTime startTime = DateTime.UtcNow;

            try
            {                
                // Obtain the execution context from the service provider.  
                IPluginExecutionContext context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                // Obtain the organization factory service from the service provider.
                IOrganizationServiceFactory factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                // Use the factory to generate the organization service.
                organizationService = factory.CreateOrganizationService(context.UserId);

                tracingService.Trace("Plugin Execution Started..");

                string agentTranscriptsIds = context.InputParameters["cat_AgenttranscriptsIds"] as string;
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
                                          <condition attribute='cat_agenttranscriptsid' operator='in'>
                                            {0}
                                          </condition>
                                        </filter>
                                      </entity>
                                    </fetch>";
                fetchXml = string.Format(fetchXml, valuesXml);

                DateTime begin = DateTime.UtcNow;
                // Retrieve the transcripts
                EntityCollection agentTranscriptList = organizationService.RetrieveMultiple(new FetchExpression(fetchXml));
                DateTime retrieveMultipleTime = DateTime.UtcNow;
                tracingService.Trace($"RerieveMultiple execution duration: {(retrieveMultipleTime - begin).TotalSeconds:F2} seconds");

                tracingService.Trace($"RerieveMultiple count: {agentTranscriptList.Entities.Count}");

                List<ProcessDetails> processDetailsList = new List<ProcessDetails>();
                ProcessSessionInsight processSessionInsight = new ProcessSessionInsight();
                ProcessTrackedVariables processTrackedVariables = new ProcessTrackedVariables();
                ProcessUnrecognizedUtterances processUnrecognizedUtterances = new ProcessUnrecognizedUtterances();
                ProcessAmbiguousUtterances processAmbiguousUtterances = new ProcessAmbiguousUtterances();
                ProcessTraversedComponents processTraversedComponents = new ProcessTraversedComponents();
                ProcessGenerativeAnswersArray processGenerativeAnswersArray = new ProcessGenerativeAnswersArray();

                tracingService.Trace("Loop started");
                foreach (Entity agentTranscript in agentTranscriptList.Entities)
                {
                    Guid agentTranscriptId = agentTranscript.Id;
                    string conversationId = agentTranscript.GetAttributeValue<string>("cat_conversationid").ToString();
                    string transcript = agentTranscript.GetAttributeValue<string>("cat_transcriptcontent");
                    string trackedVaribales = agentTranscript.GetAttributeValue<string>("cat_trackedvariables");
                    tracingService.Trace("Loop started1");
                    TranscriptModel model = JsonConvert.DeserializeObject<TranscriptModel>(transcript);
                    tracingService.Trace("Loop started2");
                    string test1 = ((EntityReference)agentTranscript["cat_agentconfiguration"]).Id.ToString();
                        tracingService.Trace("Loop started3");
                    string test2 = agentTranscript.GetAttributeValue<string>("cat_agentid");
                    tracingService.Trace("Loop started4");
                    DateTime test3 = (DateTime)agentTranscript["cat_conversationdate"];
                    tracingService.Trace("Loop started4");

                    ProcessDetails processDetails = new ProcessDetails
                    {
                        AgentTranscriptId = agentTranscriptId,
                        AgentConfigurationId = ((EntityReference)agentTranscript["cat_agentconfiguration"]).Id.ToString(),
                        AgentId = agentTranscript.GetAttributeValue<string>("cat_agentid"),
                        ConversationId = conversationId,
                        ConversationDate = (DateTime)agentTranscript["cat_conversationdate"],
                        SessionDetails = processSessionInsight.ProcessTranscript(conversationId, model),
                        ConversationInfoDetails = processSessionInsight.ProcessConversationInfoDetails(model),
                        TrackedVariables = processTrackedVariables.ProcessForTrackedVariables(model, trackedVaribales, conversationId),
                        UnrecognizedUtterances = processUnrecognizedUtterances.ProcessForUnrecognizedUtterances(model, conversationId),
                        AmbiguousUtterances = processAmbiguousUtterances.ProcessForAmbiguousUtterances(model, conversationId),
                        TraversedComponentsList = processTraversedComponents.ProcessForTraversedComponents(model, conversationId),
                        GenerativeAnswersList = processGenerativeAnswersArray.ProcessForGenerativeAnswers(model, conversationId),
                    };
                    tracingService.Trace("Loop started3");
                    processDetails.GlobalSessionDetail = processSessionInsight.GetGlobalDetails(processDetails.SessionDetails);
                    processDetailsList.Add(processDetails);
                    tracingService.Trace("Loop started4");
                }
                DateTime calKPIs = DateTime.UtcNow;
                tracingService.Trace($"Creating KPIs execution duration: {(calKPIs - retrieveMultipleTime).TotalSeconds:F2} seconds");

                EntityCollection entitiesToUpsert = GetCollectionOfEntitiesToCreate(processDetailsList);
                tracingService.Trace($"entitiesToUpsert: {entitiesToUpsert.Entities.Count}");

                DateTime creatingCollections = DateTime.UtcNow;
                tracingService.Trace($"Creating collections execution duration: {(creatingCollections - calKPIs).TotalSeconds:F2} seconds");

                ExecuteBatchRequests(entitiesToUpsert, UpdateAgentTranScriptStatus);
                DateTime excuteBatchesTime = DateTime.UtcNow;
                tracingService.Trace($"Executing both ExcuteMultiple duration: {(excuteBatchesTime - creatingCollections).TotalSeconds:F2} seconds");

                // End Time
                DateTime endTime = DateTime.UtcNow;

                TimeSpan duration = endTime - startTime;
                tracingService.Trace($"Upsert duration: {upsertDuration} seconds");
                tracingService.Trace($"Update duration: {createDuration} seconds");
                tracingService.Trace($"Plugin execution duration: {duration.TotalSeconds:F2} seconds");
                context.OutputParameters["cat_TotalDuration"] = $"Total Duration: {duration.TotalSeconds}";
            }
            catch (InvalidPluginExecutionException ex)
            {
                tracingService.Trace($"Exception: {ex.Message}");
                throw; // Re-throw the exception to maintain the plugin behavior
            }
            catch (DivideByZeroException ex)
            {
                tracingService.Trace($"Error: Division by zero. Details: {ex.Message}");
            }
            catch (FormatException ex)
            {
                tracingService.Trace($"Error: Invalid format. Details: {ex.Message}");
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An unexpected error occurred. Details: {ex.Message}");
            }
            finally
            {
                tracingService.Trace("Plugin execution finished.");
            }
        }

        public void UpdateAgentTranScriptStatus(ExecuteMultipleResponse responseWithResults, ITracingService tracingService)
        {
            try
            {
                EntityCollection agentTransciptList = new EntityCollection();

                foreach (ExecuteMultipleResponseItem item in responseWithResults.Responses)
                {
                    Entity entity = new Entity("cat_agenttranscripts")
                    {
                        Id = ((UpsertResponse)item.Response).Target.Id
                    };
                    if (item.Fault == null)
                    {                
                        entity["cat_workflowstatus"] = new OptionSetValue(2); // Completed                    
                    }
                    else
                    {
                        entity["cat_workflowstatus"] = new OptionSetValue(3); // Failed
                        entity["cat_workflowerror"] = item.Fault.Message;
                    }
                    agentTransciptList.Entities.Add(entity);
                }
                ExecuteBatchRequests(agentTransciptList, null);
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An error occurred in method UpdateAgentTranScriptStatus. Details: {ex.Message}");
            }
        }

        /// <summary>
        /// Creating the collection of record for doing bulk insert
        /// </summary>
        /// <param name="processDetailsList"></param>
        /// <returns>Entity Collection</returns>
        public EntityCollection GetCollectionOfEntitiesToCreate(List<ProcessDetails> processDetailsList)
        {
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
                    if (processDetails.GlobalSessionDetail?.AvgCsat > 0){
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
                tracingService.Trace($"An error occurred in method GetCollectionOfEntitiesToCreate. Details: {ex.Message}");
            }
            return entityCollection;
        }

        public void ExecuteBatchRequests(EntityCollection entityCollection,
            CallbackFunction callback)
        {
            try
            {
                // Create an ExecuteMultipleRequest object.
                ExecuteMultipleRequest requestWithResults = new ExecuteMultipleRequest()
                {
                    // Assign settings that define execution behavior: continue on error, return responses. 
                    Settings = new ExecuteMultipleSettings()
                    {
                        ContinueOnError = true,
                        ReturnResponses = true
                    },
                    // Create an empty organization request collection.
                    Requests = new OrganizationRequestCollection()
                };

                bool flag = false;
                // Add a Create / Update Request for each entity to the request collection.
                foreach (var entity in entityCollection.Entities)
                {
                    if (entity.Id != Guid.Empty)
                    {
                        flag = true;
                        UpdateRequest updateRequest = new UpdateRequest { Target = entity };
                        requestWithResults.Requests.Add(updateRequest);
                    }
                    else
                    {
                        flag = false;
                        UpsertRequest request = new UpsertRequest() { Target = entity };
                        requestWithResults.Requests.Add(request);
                    }
                }

                DateTime start = DateTime.UtcNow;
                // Execute all the requests in the request collection using a single web method call.
                ExecuteMultipleResponse responseWithResults =
                    (ExecuteMultipleResponse)organizationService.Execute(requestWithResults);

                DateTime end = DateTime.UtcNow;

                if (!flag)
                {
                    upsertDuration = (end - start).TotalSeconds.ToString();
                }
                else
                {
                    createDuration = (end - start).TotalSeconds.ToString();
                }

                callback?.Invoke(responseWithResults, tracingService);
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An error occurred in method ExecuteBatchRequests. Details: {ex.Message}");
            }
        }
    }
}
