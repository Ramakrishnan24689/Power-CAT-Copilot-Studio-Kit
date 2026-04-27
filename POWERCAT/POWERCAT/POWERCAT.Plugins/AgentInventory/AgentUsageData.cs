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
        /// Stores usage data in the Agent Usage History table with date-based records.
        /// </summary>
        /// <param name="usageData">Structured agent and usage data to be recorded.</param>
        /// <returns>True if the data successfully created; otherwise, false.</returns>
        public bool CreateUsageData(AgentUsageInput usageData)
        {
            bool result = false;

            try
            {
                DateTime fromDate = usageData.FromDate;
                DateTime toDate = usageData.ToDate;
                List<UsageRecord> usages = usageData.Usages;

                var requests = GenerateUsageEntity(usages, fromDate, toDate);

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
        public EntityCollection GenerateUsageEntity(List<UsageRecord> usageData, DateTime fromDate, DateTime toDate)
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
                    entity["cat_agentid"] = usage.AgentId;
                    entity["cat_environmentid"] = usage.EnvId;
                    entity["cat_usagedate"] = usage.AsOfDate;
                    entity["cat_featurename"] = usage.Feature;

                    // Set the usage data in the new schema columns
                    entity["cat_billedcopilotcredits"] = usage.Billed;
                    entity["cat_nonbilledcopilotcredits"] = usage.NonBilled;

                    entity["cat_fromdate"] = fromDate;
                    entity["cat_todate"] = toDate;
                    entity["cat_toolinvoked"] = usage.Tool;
                    entity["cat_channelid"] = usage.Channel;
                    entity["cat_knowledgesources"] = usage.Knowledge;
                    entity["cat_llmmodel"] = usage.LLM;
                    entity["cat_users"] = usage.Users;

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
    }
}
