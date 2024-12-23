using Microsoft.Xrm.Sdk.Query;
using Microsoft.Xrm.Sdk;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using Microsoft.Xrm.Sdk.Messages;
using Newtonsoft.Json;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Plugin class to generate Agent Transcripts
    /// </summary>
    public class ProcessConversationTranscripts
    {
        /// <summary>
        /// Generate Agent Transcripts based on Conversation Transcripts
        /// </summary>
        /// <param name="context">Plugin context</param>
        /// <param name="organizationService">Organization Service</param>
        /// <param name="tracingService">Tracing Service</param>
        public void GenerateAgentTranscripts(IPluginExecutionContext context, IOrganizationService organizationService, ITracingService tracingService)
        {
            try
            {
                // Prepare fetch xml based on Conversation Transcript Ids
                string conversationTranscripts = context.InputParameters["cat_ConversationTranscriptsList"] as string;
                var inputRecords = JsonConvert.DeserializeObject<List<ConversationTranscriptModel>>(conversationTranscripts);

                // Extract Conversation Transcript Ids from input
                var transcriptIds = inputRecords
                    .Where(r => !string.IsNullOrEmpty(r.ConversationTranscriptId))
                    .Select(r => r.ConversationTranscriptId)
                    .ToList();

                // Fetch existing Agent Transcripts based on Conversation Transcript Ids
                var existingRecords = FetchExistingAgentTranscripts(organizationService, tracingService, transcriptIds);

                // Prepare ExecuteMultiple request
                var createRequests = new List<OrganizationRequest>();
                foreach (var record in inputRecords)
                {
                    // Check if Agent Transcript record already present
                    if (!string.IsNullOrEmpty(record.ConversationTranscriptId) &&
                        !existingRecords.Contains(record.ConversationTranscriptId))
                    {
                        var createRequest = new CreateRequest
                        {
                            Target = new Entity("cat_agenttranscripts")
                            {
                                ["cat_agenttranscriptsid"] = new Guid(record.ConversationTranscriptId),
                                ["cat_transcriptcontent"] = record.Content,
                                ["cat_conversationdate"] = record.ConversationStartTime,
                                ["cat_agentid"] = record.AgentId,
                                ["cat_agentconfiguration"] = new EntityReference("cat_copilotconfiguration", new Guid(record.AgentConfigurationId)),
                                ["cat_conversationid"] = record.ConversationId,
                                ["cat_trackedvariables"] = record.TrackedVariables,
                                ["cat_name"] = record.Name,
                                ["cat_workflowstatus"] = new OptionSetValue(1)
                            }
                        };
                        createRequests.Add(createRequest);
                    }
                }

                // Execute in batch
                if (createRequests.Any())
                {
                    ExecuteMultipleRequest executeMultipleRequest = new ExecuteMultipleRequest
                    {                        
                        Settings = new ExecuteMultipleSettings
                        {
                            ContinueOnError = true,
                            ReturnResponses = true
                        },
                        Requests = new OrganizationRequestCollection()
                    };

                    executeMultipleRequest.Requests.AddRange(createRequests);
                    ExecuteMultipleResponse responseWithResults =
                   (ExecuteMultipleResponse)organizationService.Execute(executeMultipleRequest);

                    // Parse failed responses
                    var failedRecords = new StringBuilder();
                    foreach (var responseItem in responseWithResults.Responses) {
                        if (responseItem.Fault != null)
                        {
                            // Construct failure message with GUID and error message
                            string failedRecordInfo = $"Record with Id: {((CreateResponse)responseItem.Response).id} failed with error: {responseItem.Fault.Message}";
                            failedRecords.AppendLine(failedRecordInfo);
                        }
                    }

                    // Set output parameter for failures
                    context.OutputParameters["cat_FailedRecords"] = failedRecords.Length > 0 ? failedRecords.ToString() : "";
                }
            }
            catch (InvalidPluginExecutionException ex)
            {
                tracingService.Trace($"An error occurred in method GenerateAgentTranscripts. Details:: {ex.Message}");
                throw;
            }
            catch (FormatException ex)
            {
                tracingService.Trace($"Error: Invalid format. Details: {ex.Message}");
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An unexpected error occurred in method GenerateConversationKpis. Details: {ex.Message}");
            }
            finally
            {
                tracingService.Trace("Plugin execution finished.");
            }
        }

        /// <summary>
        /// Fetch exiting agent transcripts
        /// </summary>
        /// <param name="organizationService">Organization Service</param>
        /// <param name="tracingService">Tracing Service</param>
        /// <param name="transcriptIds">Conversation Transcript Ids</param
        private HashSet<string> FetchExistingAgentTranscripts(IOrganizationService organizationService, ITracingService tracingService, List<string> transcriptIds)
        {
            try
            {
                var existingTranscriptIds = new HashSet<string>();

                if (transcriptIds.Any())
                {
                    QueryExpression query = new QueryExpression("cat_agenttranscripts")
                    {
                        ColumnSet = new ColumnSet("cat_agenttranscriptsid"),
                        Criteria = new FilterExpression
                        {
                            Conditions =
                                {
                                    new ConditionExpression("cat_agenttranscriptsid", ConditionOperator.In, transcriptIds.ToArray())
                                }
                        }
                    };

                    EntityCollection results = organizationService.RetrieveMultiple(query);
                    foreach (var entity in results.Entities)
                    {
                        existingTranscriptIds.Add(entity.GetAttributeValue<Guid>("cat_agenttranscriptsid").ToString());
                    }
                }

                return existingTranscriptIds;
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An error occurred in method FetchExistingAgentTranscripts. Details:: {ex.Message}");
                throw;
            }
        }
    }
}
