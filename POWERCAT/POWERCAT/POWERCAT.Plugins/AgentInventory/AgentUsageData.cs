// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;
using static POWERCAT.Plugins.AgentInventory.AgentDataModel;

namespace POWERCAT.Plugins.AgentInventory
{
    /// <summary>
    /// Agent Tenant Usage class for usage data operations.
    /// </summary>
    public class AgentUsageData
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
        public AgentUsageData(IOrganizationService organizationservice, ITracingService tracingservice)
        {
            this._organizationService = organizationservice;
            this._tracingService = tracingservice;

            //Set table name of the Agent Inventory
            this._tableName = "cat_agentdetails";
        }

        /// <summary>
        /// Stores usage data in the Agent Details table.
        /// </summary>
        /// <param name="usageData">Structured usage data to be recorded.</param>
        /// <returns>True if the data was successfully updated; otherwise, false.</returns>
        public bool UpdateAgentUsageData(string usageData, string logId)
        {
            bool result = false;
            try
            {
                var usageDataUpdateRequests = GenerateUsageUpdateRequests(usageData);

                // Execute in batch
                if (usageDataUpdateRequests.Any())
                {
                    var executeMultipleRequest = new ExecuteMultipleRequest
                    {
                        Settings = new ExecuteMultipleSettings
                        {
                            ContinueOnError = true,
                            ReturnResponses = true
                        },
                        Requests = new OrganizationRequestCollection()
                    };

                    executeMultipleRequest.Requests.AddRange(usageDataUpdateRequests);
                    var responseWithResults = (ExecuteMultipleResponse)_organizationService.Execute(executeMultipleRequest);

                    // Parse failed responses
                    var failedRecords = new StringBuilder();
                    foreach (var responseItem in responseWithResults.Responses)
                    {
                        if (responseItem.Fault != null)
                        {
                            // Construct failure message with GUID and error message
                            string failedRecordInfo = $"Record update failed: {responseItem.Fault.Message}";
                            failedRecords.AppendLine(failedRecordInfo);
                        }
                    }

                    if (failedRecords.Length > 0)
                    {
                        result = false;
                        string errorMessage = failedRecords.Length > 1000000 ? failedRecords.ToString().Substring(0, 1000000) : failedRecords.ToString();
                        AppendErrorDetails(logId, errorMessage);
                        _tracingService.Trace("Error occured while updating usage data.");
                    }
                    else
                    {
                        result = true;
                    }
                }
                else
                {
                    result = true;
                }
                return result;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method update usage data. Details: {ex.Message}");
                throw ex;
            }
        }

        /// <summary>
        /// Processes usage data and generates update requests for the Agent Details table.
        /// </summary>
        /// <param name="usageData">Usage metrics.</param>
        /// <returns>A collection of update requests to apply usage data updates to agent records.</returns>
        public OrganizationRequestCollection GenerateUsageUpdateRequests(string usageData)
        {
            try
            {
                var usageRecords = new List<AgentTenantUsageData>();

                // Create a collection of updaterequest messages.
                var updateRequests = new OrganizationRequestCollection();

                using (var reader = new StringReader(usageData))
                {
                    //Set isfirstrowheader value to true to skip the first row for header
                    bool isFirstRowHeader = true;
                    string line;

                    while ((line = reader.ReadLine()) != null)
                    {
                        if (isFirstRowHeader)
                        {
                            isFirstRowHeader = false;
                            //Avoiding header, skip the steps and goes to next row
                            continue;
                        }

                        // Split the line by comma, handling quoted values correctly
                        string[] fields = line.Split(',').Select(field => field.Trim('"')).ToArray();

                        usageRecords.Add(new AgentTenantUsageData
                        {
                            EnvironmentID = fields[0],
                            EnvironmentName = fields[1],
                            AgentName = fields[2],
                            AgentID = fields[3],
                            Feature = fields[5],
                            BilledMessages = !string.IsNullOrEmpty(fields[6]) ? ConvertStringToNearestInt(fields[6]) : 0,
                            NonBilledMessages = !string.IsNullOrEmpty(fields[7]) ? ConvertStringToNearestInt(fields[7]) : 0
                        });
                    }

                    var groupedByAgent = usageRecords.GroupBy(record => record.AgentID);

                    foreach (var agentGroup in groupedByAgent)
                    {
                        var featureUsageList = agentGroup
                            .GroupBy(record => record.Feature)
                            .Select(featureGroup => new Dictionary<string, object>
                                {
                                    { "Feature", featureGroup.Key },
                                    { "BilledMessages", featureGroup.Sum(x => x.BilledMessages) },
                                    { "NonBilledMessages", featureGroup.Sum(x => x.NonBilledMessages) }
                                }).ToList();

                        string environmentId = agentGroup.First().EnvironmentID;
                        string agentId = agentGroup.Key;

                        var usageEntity = GetUsageEntity(environmentId, agentId, featureUsageList);

                        if (usageEntity != null)
                        {
                            updateRequests.Add(new UpdateRequest { Target = usageEntity });
                        }
                    }
                }
                return updateRequests;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method GenerateUsageUpdateRequests. Details: {ex.Message}");
                throw ex;
            }
        }
        /// <summary>
        /// Builds an entity to update usage data in the Agent Details table.
        /// </summary>
        /// <param name="environmentId">The environment identifier.</param>
        /// <param name="agentId">The agent identifier.</param>
        /// <param name="featureUsageData">A dictionary containing feature usage metrics.</param>
        /// <returns>An Entity object with updated usage data, or null if no matching record is found.</returns>
        public Entity GetUsageEntity(string environmentId, string agentId, List<Dictionary<string, object>> featureUsageData)
        {
            try
            {
                // Query to find the agent record to update
                var query = new QueryExpression(_tableName)
                {
                    ColumnSet = new ColumnSet("cat_agentdetailsid"),
                    TopCount = 1,
                    Criteria =
                    {
                        Conditions =
                        {
                            new ConditionExpression("cat_agentid", ConditionOperator.Equal, agentId),
                            new ConditionExpression("cat_environmentid", ConditionOperator.Equal, environmentId)
                        }
                    }
                };

                var agentRecords = _organizationService.RetrieveMultiple(query);

                if (agentRecords.Entities.Any())
                {
                    // Take the first matching record (assuming unique match)
                    var agentRecord = agentRecords.Entities.First();

                    // Entity to update the record
                    var entity = new Entity(_tableName) { Id = agentRecord.Id };


                    // feature columns available in the agent details table
                    var featureColumnMap = new Dictionary<string, string>
                    {
                        { "Agent action", "cat_usageagentaction" },
                        { "Classic answer", "cat_usageclassicanswer" },
                        { "Generative answer", "cat_usagegenerativeanswer" },
                        { "Agent flow actions", "cat_usageagentflowactions" },
                        { "Text & Gen AI Tools (Basic)", "cat_usagetextandgenaitoolsbasic" },
                        { "Text & Gen AI Tools (Standard)", "cat_usagetextandgenaitoolsstandard" },
                        { "Text & Gen AI Tools (Premium)", "cat_usagetextandgenaitoolspremium" }
                    };

                    foreach (var feature in featureUsageData)
                    {
                        if (feature.TryGetValue("Feature", out var featureNameObj) && featureNameObj is string featureName)
                        {
                            if (featureColumnMap.TryGetValue(featureName, out var columnName))
                            {
                                if (feature.TryGetValue("BilledMessages", out var billedMessages))
                                {
                                    entity[$"{columnName}billed"] = billedMessages;
                                }
                                if (feature.TryGetValue("NonBilledMessages", out var nonBilledMessages))
                                {
                                    entity[$"{columnName}nonbilled"] = nonBilledMessages;
                                }
                            }
                        }
                    }

                    entity["cat_usagedata"] = JsonConvert.SerializeObject(featureUsageData, Formatting.Indented);

                    return entity;
                }
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method get usage entity. Details: {ex.Message}");
                throw ex;
            }
            return null;
        }
        /// <summary>
        /// Converts a string representation of a number to the nearest integer.
        /// </summary>
        /// <param name="stringValue">The string value to convert.</param>
        /// <returns>Value converted as int.</returns>
        public int ConvertStringToNearestInt(string stringValue)
        {
            try
            {
                if (string.IsNullOrEmpty(stringValue))
                {
                    return 0;
                }
                decimal decimalValue = Convert.ToDecimal(stringValue);
                int roundedIntValue = (int)Math.Round(decimalValue);
                return roundedIntValue;
            }
            catch(Exception ex)
            {
                throw ex;
            }
        }
        /// <summary>
        /// Append error details based on failed records.
        /// </summary>
        /// <param name="logId">Error Log Id</param
        /// <param name="failedRecords">Failed Records</param
        private void AppendErrorDetails(string logId, string failedRecordsError)
        {
            try
            {
                //Retrieve existing error details
                Entity copilotstudiokitlogs = _organizationService.Retrieve("cat_copilotstudiokitlogs", new Guid(logId), new ColumnSet("cat_copilotstudiokitlogsid", "cat_errormessage"));
                string errorMessage = copilotstudiokitlogs.GetAttributeValue<string>("cat_errormessage");

                // Update the error message
                errorMessage = $"{errorMessage}{Environment.NewLine}{failedRecordsError}";
                copilotstudiokitlogs["cat_errormessage"] = errorMessage.Length > 1000000 ? errorMessage.Substring(0, 1000000) : errorMessage;  // Due to column length limitation
                copilotstudiokitlogs["cat_executionstatuscode"] = new OptionSetValue(4);
                _organizationService.Update(copilotstudiokitlogs);
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An error occurred in method AppendErrorDetails. Details: {ex.Message}");
                throw ex;
            }
        }
    }
}
