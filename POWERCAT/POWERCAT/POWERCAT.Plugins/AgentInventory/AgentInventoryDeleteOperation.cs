// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json.Linq;

namespace POWERCAT.Plugins.AgentInventory
{
    /// <summary>
    /// Bulk delete operations.
    /// </summary>
    public class AgentInventoryDeleteOperation
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
        /// Agent Details Table Name
        /// </summary>
        private readonly string _agentDetailsTableName;

        /// <summary>
        /// Usage History Table Name
        /// </summary>
        private readonly string _usageHistoryTableName;

        /// <summary>
        /// Constructor to initialize Organization, Tracing services and Table name
        /// </summary>
        /// <param name="organizationService">Organization Service</param>
        /// <param name="tracingService">Tracing Service</param>
        public AgentInventoryDeleteOperation(IOrganizationService organizationservice, ITracingService tracingservice)
        {
            this._organizationService = organizationservice;
            this._tracingService = tracingservice;

            //Set table name of the Agent Inventory
            this._agentDetailsTableName = "cat_agentdetails";
            this._usageHistoryTableName = "cat_agentusagehistory";
        }

        /// <summary>
        /// Delete the records in a table
        /// </summary>
        /// <param name="tableName">Table name</param>
        /// <param name="recordIds">List of record ids in json</param>
        /// <returns>True if the records deleted successfully; otherwise, false.</returns>
        public bool BulkDeleteOperation(string tableName, string recordIds)
        {
            try
            {
                bool result = false;

                if (tableName == _agentDetailsTableName || tableName == _usageHistoryTableName)
                {
                    // Parse the JSON string
                    var jsonObject = JObject.Parse(recordIds);

                    // Extract the array
                    JArray idsArray = (JArray)jsonObject["recordIds"];

                    var targets = new EntityReferenceCollection();

                    foreach (var id in idsArray)
                    {
                        targets.Add(new EntityReference(tableName, Guid.Parse(id.ToString())));
                    }

                    var request = new OrganizationRequest("DeleteMultiple")
                    {
                        ["Targets"] = targets
                    };

                    _organizationService.Execute(request);

                    result = true;
                }
                else
                {
                    result = false;
                }

                return result;
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method BulkDeleteOperation. Details: {ex.Message}");
                throw ex;
            }
        }
    }
}