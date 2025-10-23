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
        /// Usage History Table Name
        /// </summary>
        private readonly string _usageHistoryTableName;

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
            this._usageHistoryTableName = "cat_agentusagehistory";
        }

        /// <summary>
        /// Stores usage data in the Agent Usage History table with date-based records.
        /// </summary>
        /// <param name="usageData">Structured usage data to be recorded.</param>
        /// <param name="logId">Log ID for error tracking.</param>
        /// <param name="refreshStatus">Refresh status to track whether the record is successfully updated or created.</param>
        /// <returns>True if the data was successfully updated; otherwise, false.</returns>
        public bool UpdateAgentUsageData(string usageData, string logId, string refreshStatus)
        {
            bool result = false;
            try
            {
                var usageDataUpdateRequests = GenerateUsageUpdateRequests(usageData, refreshStatus);

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
        /// Processes usage data and generates upsert requests for daily usage records in the Agent Usage History table.
        /// </summary>
        /// <param name="usageData">Usage metrics CSV data.</param>
        /// <param name="refreshStatus">Refresh status to track whether the record is successfully updated or created.</param>
        /// <returns>A collection of create/update requests to apply usage data to daily history records.</returns>
        public OrganizationRequestCollection GenerateUsageUpdateRequests(string usageData, string refreshStatus)
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

                        // Parse the date from field[8] - skip record if date is invalid
                        if (string.IsNullOrEmpty(fields[8]) || !DateTime.TryParse(fields[8], out DateTime parsedDate))
                        {
                            _tracingService.Trace($"Skipping record with invalid or missing date: {fields[8]}");
                            continue; // Skip this record if date is invalid or missing
                        }

                        parsedDate = parsedDate.Date; // Ensure time component is removed

                        usageRecords.Add(new AgentTenantUsageData
                        {
                            EnvironmentID = fields[0],
                            EnvironmentName = fields[1],
                            AgentName = fields[2],
                            AgentID = fields[3],
                            Feature = fields[5],
                            BilledMessages = !string.IsNullOrEmpty(fields[6]) ? ConvertStringToDecimal(fields[6]) : 0,
                            NonBilledMessages = !string.IsNullOrEmpty(fields[7]) ? ConvertStringToDecimal(fields[7]) : 0,
                            UsageDate = parsedDate
                        });
                    }

                    // Group by Agent, Environment, Date, AND Feature (each feature gets its own record)
                    var groupedByAgentDateFeature = usageRecords
                        .GroupBy(record => new
                        {
                            record.AgentID,
                            record.EnvironmentID,
                            record.UsageDate,
                            record.Feature
                        });

                    foreach (var group in groupedByAgentDateFeature)
                    {
                        // Sum up billed/non-billed messages for this specific agent/date/feature combination
                        var totalBilledMessages = group.Sum(x => x.BilledMessages);
                        var totalNonBilledMessages = group.Sum(x => x.NonBilledMessages);

                        string environmentId = group.Key.EnvironmentID;
                        string agentId = group.Key.AgentID;
                        DateTime usageDate = group.Key.UsageDate;
                        string featureName = group.Key.Feature;

                        // Get or create usage history entity for this specific agent/date/feature
                        var usageEntity = BuildUsageHistoryEntity(environmentId, agentId, usageDate, featureName,
                            totalBilledMessages, totalNonBilledMessages, refreshStatus);

                        if (usageEntity != null)
                        {
                            if (usageEntity.Id == Guid.Empty)
                            {
                                // New record - use CreateRequest
                                updateRequests.Add(new CreateRequest { Target = usageEntity });
                            }
                            else
                            {
                                // Existing record - use UpdateRequest
                                updateRequests.Add(new UpdateRequest { Target = usageEntity });
                            }
                        }
                    }

                    //For last usage data in agent details table
                    // Group by Agent, Environment, Date, AND Feature (each feature gets its own record)
                    var groupedByAgentLastUsage = usageRecords
                        .GroupBy(record => new
                        {
                            record.AgentID
                        })
                        .Select(r => r.OrderByDescending(c => c.UsageDate).First());

                    foreach (var group in groupedByAgentLastUsage)
                    {
                        string environmentId = group.EnvironmentID;
                        string agentId = group.AgentID;
                        DateTime usageDate = group.UsageDate;
                        string featureName = group.Feature;

                        // Get or update last usage entity for this specific agent/date/feature
                        var usageEntity = BuildLastUsageEntity(environmentId, agentId, usageDate, featureName);

                        if (usageEntity != null)
                        {
                            // UpdateRequest
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
        /// Builds or retrieves usage history entity for a specific agent, date, and feature.
        /// </summary>
        /// <param name="environmentId">The environment identifier.</param>
        /// <param name="agentId">The agent identifier.</param>
        /// <param name="usageDate">The usage date.</param>
        /// <param name="featureName">The feature name.</param>
        /// <param name="billedMessages">Total billed messages for this feature.</param>
        /// <param name="nonBilledMessages">Total non-billed messages for this feature.</param>
        /// <param name="refreshStatus">Refresh status to track whether the record is successfully updated or created.</param>
        /// <returns>An Entity object for usage history record.</returns>
        private Entity BuildUsageHistoryEntity(string environmentId, string agentId, DateTime usageDate,
            string featureName, decimal billedMessages, decimal nonBilledMessages, string refreshStatus)
        {
            try
            {
                var agentDetailsId = FindAgentDetailsRecord(environmentId, agentId);
                if (agentDetailsId == Guid.Empty)
                {
                    return null;
                }

                // Query to check if record already exists for this agent/date/feature combination
                var query = new QueryExpression(_usageHistoryTableName)
                {
                    ColumnSet = new ColumnSet("cat_agentusagehistoryid"),
                    TopCount = 1,
                    Criteria =
                    {
                        Conditions =
                        {
                            new ConditionExpression("cat_agentid", ConditionOperator.Equal, agentId),
                            new ConditionExpression("cat_environmentid", ConditionOperator.Equal, environmentId),
                            new ConditionExpression("cat_usagedate", ConditionOperator.On, usageDate),
                            new ConditionExpression("cat_featurename", ConditionOperator.Equal, featureName)
                        }
                    }
                };

                var existingRecords = _organizationService.RetrieveMultiple(query);
                Entity entity;

                if (existingRecords.Entities.Any())
                {
                    // Update existing record
                    var existingRecord = existingRecords.Entities.First();
                    entity = new Entity(_usageHistoryTableName) { Id = existingRecord.Id };
                }
                else
                {
                    // Create new record
                    entity = new Entity(_usageHistoryTableName);
                    entity["cat_agentid"] = agentId;
                    entity["cat_environmentid"] = environmentId;
                    entity["cat_usagedate"] = usageDate;
                    entity["cat_featurename"] = featureName;
                }

                // Set lookup to parent agent details if exists
                if (agentDetailsId != Guid.Empty)
                {
                    entity["cat_agent"] = new EntityReference(_tableName, agentDetailsId);
                }

                // Set the usage data in the new schema columns
                entity["cat_billedcopilotcredits"] = billedMessages;
                entity["cat_nonbilledcopilotcredits"] = nonBilledMessages;

                // Set refresh status
                entity["cat_refreshstatus"] = refreshStatus;

                return entity;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in BuildUsageHistoryEntity. Details: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Builds or retrieves last usage entity for a specific agent, date, and feature.
        /// </summary>
        /// <param name="environmentId">The environment identifier.</param>
        /// <param name="agentId">The agent identifier.</param>
        /// <param name="usageDate">The usage date.</param>
        /// <param name="featureName">The feature name.</param>
        /// <returns>An Entity object for usage history record.</returns>
        private Entity BuildLastUsageEntity(string environmentId, string agentId, DateTime usageDate, string featureName)
        {
            try
            {
                var agentDetailsId = FindAgentDetailsRecord(environmentId, agentId);
                if (agentDetailsId == Guid.Empty)
                {
                    return null;
                }

                Entity entity = new Entity(_tableName) { Id = agentDetailsId };

                // Set the last usage data
                entity["cat_lastusagefeature"] = featureName;
                entity["cat_lastusagedate"] = usageDate;

                return entity;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in BuildLastUsageEntity. Details: {ex.Message}");
                throw;
            }
        }

        /// <summary>
        /// Finds the agent details record ID for lookup relationship.
        /// </summary>
        /// <param name="environmentId">The environment identifier.</param>
        /// <param name="agentId">The agent identifier.</param>
        /// <returns>The agent details record ID, or Guid.Empty if not found.</returns>
        private Guid FindAgentDetailsRecord(string environmentId, string agentId)
        {
            try
            {
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

                var records = _organizationService.RetrieveMultiple(query);
                return records.Entities.Any() ? records.Entities.First().Id : Guid.Empty;
            }
            catch
            {
                return Guid.Empty;
            }
        }

        /// <summary>
        /// Converts string to decimal for precise usage values with up to 15 decimal places.
        /// </summary>
        /// <param name="stringValue">The string value to convert.</param>
        /// <returns>Value converted as decimal.</returns>
        public decimal ConvertStringToDecimal(string stringValue)
        {
            try
            {
                if (string.IsNullOrEmpty(stringValue))
                {
                    return 0m;
                }
                return Convert.ToDecimal(stringValue);
            }
            catch (Exception ex)
            {
                throw;
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
