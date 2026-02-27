// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Microsoft.Xrm.Sdk;
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
        /// Processes csv content and return the usage data in json.
        /// </summary>
        /// <param name="usageData">Usage metrics CSV data.</param>
        /// <returns>Usage history records in json.</returns>
        public string ProcessUsageData(string usageData)
        {
            try
            {
                var usageRecords = new List<AgentTenantUsageData>();

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

                    // If no rows found, return empty list
                    if (!usageRecords.Any())
                        return string.Empty;

                    var agentUsages = usageRecords
                                        .GroupBy(r => r.AgentID)
                                        .Select(agentGroup =>
                                        {
                                            // Per-date/feature
                                            var usageList = agentGroup
                                                .GroupBy(r => new { r.UsageDate, r.Feature })
                                                .Select(group =>
                                                {
                                                    return new UsageRecord
                                                    {
                                                        Feature = group.Key.Feature,
                                                        Date = group.Key.UsageDate,
                                                        Billed = group.Sum(x => x.BilledMessages),
                                                        NonBilled = group.Sum(x => x.NonBilledMessages)
                                                    };
                                                })
                                                .ToList();

                                            // Feature-level aggregation for agent details
                                            var featureUsageList = agentGroup
                                                .GroupBy(record => record.Feature)
                                                .Select(featureGroup => new Dictionary<string, object>
                                                {
                                                    { "Feature", featureGroup.Key },
                                                    { "Billed", featureGroup.Sum(x => x.BilledMessages) },
                                                    { "NonBilled", featureGroup.Sum(x => x.NonBilledMessages) }
                                                })
                                                .ToList();

                                            // Serialize feature-level aggregation to JSON
                                            string featureUsageJson = featureUsageList.Count() > 0 ? JsonConvert.SerializeObject(featureUsageList, Formatting.None) : string.Empty;

                                            return new AgentUsageOutput
                                            {
                                                ID = agentGroup.Key,
                                                Usage = usageList,
                                                UsageJson = featureUsageJson
                                            };
                                        })
                                        .OrderBy(a => a.ID)
                                        .ToList();

                    var agentUsageJson = agentUsages.Count() > 0 ? JsonConvert.SerializeObject(agentUsages, Formatting.None) : string.Empty;
                    return agentUsageJson;
                }
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method ProcessUsageData. Details: {ex.Message}");
                throw ex;
            }
        }

        /// <summary>
        /// Stores usage data in the Agent Usage History table with date-based records.
        /// </summary>
        /// <param name="usageData">Structured agent and usage data to be recorded.</param>
        /// <returns>True if the data successfully created; otherwise, false.</returns>
        public bool CreateUsageData(AgentUsageInput usageData)
        {
            bool result = false;

            try
            {
                string agentID = usageData.AgentID;
                string environmentID = usageData.EnvironmentID;

                Guid agentDetailsID = usageData.AgentDetailsID;
                List<UsageRecord> usages = usageData.Usages;

                var requests = GenerateUsageEntity(usages, agentID, environmentID, agentDetailsID);

                // Execute in batch
                if (requests.Entities.Any())
                {
                    const int batchSize = 1000;

                    for (int i = 0; i < requests.Entities.Count; i += batchSize)
                    {
                        var batch = requests.Entities
                            .Skip(i)
                            .Take(batchSize)
                            .ToList();

                        var entityCollection = new EntityCollection(batch)
                        {
                            EntityName = requests.EntityName
                        };

                        var request = new OrganizationRequest("CreateMultiple")
                        {
                            ["Targets"] = entityCollection
                        };

                        _organizationService.Execute(request);
                    }

                    result = true;
                }

                return result;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method CreateUsageData. Details: {ex.Message}");
                throw ex;
            }
        }

        /// <summary>
        /// Entity collection of usage records.
        /// </summary>
        /// <param name="usageData">Usage data.</param>
        /// <returns>Entity collection usage records.</returns>
        public EntityCollection GenerateUsageEntity(List<UsageRecord> usageData, string agentId, string environmentId, Guid agentDetailsId)
        {
            try
            {
                var entityCollection = new EntityCollection
                {
                    EntityName = _usageHistoryTableName
                };

                foreach (var usage in usageData)
                {
                    // Create new record
                    Entity entity = new Entity(_usageHistoryTableName);
                    entity["cat_agentid"] = agentId;
                    entity["cat_environmentid"] = environmentId;
                    entity["cat_usagedate"] = usage.Date;
                    entity["cat_featurename"] = usage.Feature;

                    // Set lookup to parent agent details if exists
                    if (agentDetailsId != Guid.Empty)
                    {
                        entity["cat_agent"] = new EntityReference(_tableName, agentDetailsId);
                    }

                    // Set the usage data in the new schema columns
                    entity["cat_billedcopilotcredits"] = usage.Billed;
                    entity["cat_nonbilledcopilotcredits"] = usage.NonBilled;

                    entityCollection.Entities.Add(entity);
                }
                return entityCollection;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method GenerateUsageEntity. Details: {ex.Message}");
                throw ex;
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
    }
}
