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
            List<OrganizationRequest> createRequests = new List<OrganizationRequest>();
            string errorLogId = null;
            try
            {
                // Get Conversation Transcripts details
                string conversationTranscripts = context.InputParameters["cat_ConversationTranscriptsList"] as string;
                errorLogId = context.InputParameters["cat_ErrorLogId"] as string;
                var inputRecords = JsonConvert.DeserializeObject<List<ConversationTranscriptModel>>(conversationTranscripts);

                // Separate Teams channel records (processed individually, not grouped)
                var teamsChannelRecords = new List<ConversationTranscriptModel>();
                var nonTeamsRecords = new List<ConversationTranscriptModel>();

                foreach (var record in inputRecords)
                {
                    if (IsTeamsChannelRecord(record))
                    {
                        teamsChannelRecords.Add(record);
                    }
                    else
                    {
                        nonTeamsRecords.Add(record);
                    }
                }

                var groupedRecords = nonTeamsRecords
                    .Where(r => r.Name != null)
                    .GroupBy(r => r.Name)
                    .ToList();

                var transcriptNames = inputRecords
                    .Where(r => !string.IsNullOrEmpty(r.Name))
                    .Select(r => r.Name)
                    .ToList();

                // Fetch existing Agent Transcripts based on Conversation Transcript Names
                var existingRecords = FetchExistingAgentTranscripts(organizationService, tracingService, transcriptNames);

                // Prepare ExecuteMultiple request
                foreach (var group in groupedRecords)
                {
                    // group is ordered by conversation start time and batch id
                    var orderedrecord = group.OrderBy(r => r.BatchId).ThenBy(r => r.ConversationStartTime);

                    if (orderedrecord.Count() == 1)
                    {
                        var record = group.First();
                        // Check if Agent Transcript record already present
                        if (!string.IsNullOrEmpty(record.ConversationTranscriptId) &&
                            !existingRecords.Contains(record.ConversationTranscriptId))
                        {
                            var createRequest = new CreateRequest
                            {
                                    Target = CreateAgentTranscriptEntity(record, null, false)
                            };
                            createRequests.Add(createRequest);
                        }
                    }
                    if (orderedrecord.Count() > 1)
                    {
                        // Create parent Agent Transcript
                        var parentRecord = orderedrecord.First();
                        if (!string.IsNullOrEmpty(parentRecord.ConversationTranscriptId) &&
                            !existingRecords.Contains(parentRecord.ConversationTranscriptId))
                        {
                            var parentAgentTranscript = CreateAgentTranscriptEntity(parentRecord, null, true);
                            Guid parentId = organizationService.Create(parentAgentTranscript);
                            // Create child Agent Transcripts
                            foreach (var childRecord in orderedrecord.Skip(1))
                            {
                                var createRequest = new CreateRequest
                                {
                                    Target = CreateAgentTranscriptEntity(childRecord, parentId, false)
                                };
                                createRequests.Add(createRequest);
                            }
                        }
                    }
                }

                // Process ungrouped teams channel records individually
                foreach (var record in teamsChannelRecords)
                {
                    if (!string.IsNullOrEmpty(record.ConversationTranscriptId) &&
                        !existingRecords.Contains(record.ConversationTranscriptId))
                    {
                        var createRequest = new CreateRequest
                        {
                            Target = CreateAgentTranscriptEntity(record, null, false)
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
                    foreach (var responseItem in responseWithResults.Responses)
                    {
                        if (responseItem.Fault != null)
                        {
                            // Construct failure message with GUID and error message
                            string failedRecordInfo = $"Record creation failed with error: {responseItem.Fault.Message}";
                            failedRecords.AppendLine(failedRecordInfo);
                        }
                    }

                    // Check for failed records
                    if (failedRecords.Length > 0)
                    {
                        string errorMessage = failedRecords.Length > 1000000 ? failedRecords.ToString().Substring(0, 1000000) : failedRecords.ToString();
                        AppendErrorDetails(organizationService, tracingService, errorLogId, errorMessage);
                    }
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
                tracingService.Trace($"An unexpected error occurred in method GenerateAgentTranscripts. Details: {ex.Message}");
                throw ex;
            }
            finally
            {
                tracingService.Trace("Plugin execution finished.");
            }
        }

        /// <summary>
        /// Creates an Agent Transcript entity from a ConversationTranscriptModel
        /// </summary>
        /// <param name="record">Conversation transcript record</param>
        /// <param name="parentId">Parent transcript ID (for child records)</param>
        /// <param name="isParent">Whether this is a parent transcript</param>
        /// <returns>Entity configured as an agent transcript</returns>
        private Entity CreateAgentTranscriptEntity(ConversationTranscriptModel record, Guid? parentId, bool isParent)
        {
            var entity = new Entity("cat_agenttranscripts")
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
                ["cat_iscopyfulltranscriptenabled"] = record.CopyFullTranscript,
                ["ttlinseconds"] = 259200,
                ["cat_batchid"] = record.BatchId
            };

            if (isParent)
            {
                entity["cat_isparent"] = true;
            }

            if (parentId.HasValue)
            {
                entity["cat_parent"] = new EntityReference("cat_agenttranscripts", parentId.Value);
            }

            return entity;
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
                        ColumnSet = new ColumnSet("cat_name", "cat_conversationtranscriptid"),
                        Criteria = new FilterExpression
                        {
                            Conditions =
                                {
                                    new ConditionExpression("cat_name", ConditionOperator.In, transcriptNames.ToArray()),
                                    new ConditionExpression("cat_parent", ConditionOperator.DoesNotContainValues, true)
                                }
                        }
                    };

                    EntityCollection results = organizationService.RetrieveMultiple(query);
                    foreach (var entity in results.Entities)
                    {
                        existingTranscriptNames.Add(entity.GetAttributeValue<string>("cat_conversationtranscriptid"));
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

        /// <summary>
        /// Append error details based on failed records.
        /// /// </summary>
        /// <param name="organizationService">Organization Service</param>
        /// <param name="tracingService">Tracing Service</param>
        /// <param name="errorLogId">Error Log Id</param
        /// <param name="failedRecords">Failed Records</param
        private void AppendErrorDetails(IOrganizationService organizationService, ITracingService tracingService, string errorLogId, string failedRecordsError)
        {
            try
            {
                //Retrieve existing error details
                Entity copilotstudiokitlogs = organizationService.Retrieve("cat_copilotstudiokitlogs", new Guid(errorLogId), new ColumnSet("cat_copilotstudiokitlogsid", "cat_errormessage"));
                string errorMessage = copilotstudiokitlogs.GetAttributeValue<string>("cat_errormessage");

                // Update the error message
                errorMessage = $"{errorMessage}{Environment.NewLine}{failedRecordsError}";                
                copilotstudiokitlogs["cat_errormessage"] = errorMessage.Length > 1000000 ? errorMessage.Substring(0, 1000000) : errorMessage;  // Due to column length limitation
                copilotstudiokitlogs["cat_executionstatuscode"] = new OptionSetValue(4);
                organizationService.Update(copilotstudiokitlogs);
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An error occurred in method AppendErrorDetails. Details:: {ex.Message}");
                throw ex;
            }
        }

        /// <summary>
        /// Checks if a conversation transcript record belongs to the Teams channel
        /// by parsing the content and looking for channelId "msteams" in valid activity types.
        /// </summary>
        /// <param name="record">Conversation transcript record</param>
        /// <returns>True if the record is from the Teams channel</returns>
        private bool IsTeamsChannelRecord(ConversationTranscriptModel record)
        {
            if (string.IsNullOrEmpty(record.Content))
            {
                return false;
            }

            try
            {
                var transcript = JsonConvert.DeserializeObject<TranscriptModel>(record.Content);
                if (transcript?.activities == null)
                {
                    return false;
                }

                foreach (var activity in transcript.activities)
                {
                    var isValidType = activity.type == "event" || activity.type == "message" || activity.type == "conversationUpdate";
                    if (!isValidType)
                    {
                        continue;
                    }

                    var activityChannelId = activity.channelId ?? activity.valueToken?["channelId"]?.ToString();
                    if (activityChannelId != null && activityChannelId != "msteams")
                    {
                        return false;
                    }
                    if (activityChannelId == "msteams")
                    {
                        return true;
                    }
                }
            }
            catch
            {
                return false;
            }

            return false;
        }
    }
}
