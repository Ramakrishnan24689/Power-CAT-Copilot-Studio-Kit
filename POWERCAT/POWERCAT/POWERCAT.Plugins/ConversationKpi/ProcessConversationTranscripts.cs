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
                // Get Conversation Transcripts details
                string conversationTranscripts = context.InputParameters["cat_ConversationTranscriptsList"] as string;
                var inputRecords = JsonConvert.DeserializeObject<List<ConversationTranscriptModel>>(conversationTranscripts);

                // Extract Conversation Transcript Names from input
                var transcriptNames = inputRecords
                    .Where(r => !string.IsNullOrEmpty(r.Name))
                    .Select(r => r.Name)
                    .ToList();

                // Fetch existing Agent Transcripts based on Conversation Transcript Names
                var existingRecords = FetchExistingAgentTranscripts(organizationService, tracingService, transcriptNames);

                // Prepare ExecuteMultiple request
                var createRequests = new List<OrganizationRequest>();
                foreach (var record in inputRecords)
                {
                    // Check if Agent Transcript record already present
                    if (!string.IsNullOrEmpty(record.Name) &&
                        !existingRecords.Contains(record.Name))
                    {
                        var createRequest = new CreateRequest
                        {
                            Target = new Entity("cat_agenttranscripts")
                            {
                                ["cat_transcriptcontent"] = record.Content,
                                ["cat_conversationdate"] = record.ConversationStartTime,
                                ["cat_agentid"] = record.AgentId,
                                ["cat_agentconfiguration"] = new EntityReference("cat_copilotconfiguration", new Guid(record.AgentConfigurationId)),
                                ["cat_conversationid"] = record.ConversationId,
                                ["cat_trackedvariables"] = record.TrackedVariables,
                                ["cat_name"] = record.Name,
                                ["cat_workflowstatus"] = new OptionSetValue(1),
                                ["cat_conversationtranscriptid"] = record.ConversationTranscriptId,
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
                            string failedRecordInfo = $"Record creation failed with error: {responseItem.Fault.Message}";
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
                throw ex;
            }
            catch (FormatException ex)
            {
                tracingService.Trace($"Error: Invalid format. Details: {ex.Message}");
                throw ex;
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An unexpected error occurred in method GenerateConversationKpis. Details: {ex.Message}");
                throw ex;
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
        /// <param name="transcriptNames">Conversation Transcript Names</param
        private HashSet<string> FetchExistingAgentTranscripts(IOrganizationService organizationService, ITracingService tracingService, List<string> transcriptNames)
        {
            try
            {
                var existingTranscriptNames = new HashSet<string>();

                if (transcriptNames.Any())
                {
                    QueryExpression query = new QueryExpression("cat_agenttranscripts")
                    {
                        ColumnSet = new ColumnSet("cat_name"),
                        Criteria = new FilterExpression
                        {
                            Conditions =
                                {
                                    new ConditionExpression("cat_name", ConditionOperator.In, transcriptNames.ToArray())
                                }
                        }
                    };

                    EntityCollection results = organizationService.RetrieveMultiple(query);
                    foreach (var entity in results.Entities)
                    {
                        existingTranscriptNames.Add(entity.GetAttributeValue<String>("cat_name"));
                    }
                }

                return existingTranscriptNames;
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An error occurred in method FetchExistingAgentTranscripts. Details:: {ex.Message}");
                throw ex;
            }
        }
    }
}
