// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Globalization;
using System.Linq;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Newtonsoft.Json;

namespace POWERCAT.Plugins.AgentInventory
{
    /// <summary>
    /// Agent inventory query operations.
    /// </summary>
    public class AgentInventoryQueryUtilities
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
        public AgentInventoryQueryUtilities(IOrganizationService organizationservice, ITracingService tracingservice)
        {
            this._organizationService = organizationservice;
            this._tracingService = tracingservice;

            //Set table name of the Agent Inventory
            this._agentDetailsTableName = "cat_agentdetails";
            this._usageHistoryTableName = "cat_agentusagehistory";
        }

        /// <summary>
        /// Aggregate and accumulate agents creation timeline
        /// </summary>
        /// <returns>A json of aggregated timeline.</returns>
        public string GetAgentsCreationTimeline()
        {
            try
            {
                string fetchXml = $@"
                                <fetch version='1.0' top='5000' mapping='logical' aggregate='true'>
                                 <entity name='{_agentDetailsTableName}'>
                                    <attribute name='cat_agentcreateddate'
                                               alias='CreatedYear'
                                               groupby='true'
                                               dategrouping='year' />

                                    <attribute name='cat_agentcreateddate'
                                               alias='CreatedMonth'
                                               groupby='true'
                                               dategrouping='month' />

                                    <attribute name='cat_agentdetailsid'
                                               alias='TotalCount'
                                               aggregate='count' />

                                    <filter type='and'>
                                      <condition attribute='cat_agentcreateddate'
                                                 operator='not-null' />
                                    </filter>

                                  </entity>
                                </fetch>";

                var results = _organizationService.RetrieveMultiple(new FetchExpression(fetchXml));

                var sortedTimeline = results.Entities.Select(entity =>
                {
                    int year = Convert.ToInt32(((AliasedValue)entity["CreatedYear"]).Value);
                    int month = Convert.ToInt32(((AliasedValue)entity["CreatedMonth"]).Value);
                    int count = Convert.ToInt32(((AliasedValue)entity["TotalCount"]).Value);

                    return new
                    {
                        CreatedYearMonth = year * 100 + month,
                        CreatedMonth = CultureInfo.InvariantCulture
                                        .DateTimeFormat
                                        .GetAbbreviatedMonthName(month),
                        Count = count
                    };
                })
                .OrderBy(x => x.CreatedYearMonth)
                .ToList();

                // Step 2: Accumulate count
                int running = 0;

                var output = sortedTimeline.Select(x =>
                {
                    running += x.Count;

                    return new
                    {
                        YearMonth = x.CreatedYearMonth,
                        Month = x.CreatedMonth,
                        AccumulativeCount = running
                    };
                })
                .ToList();

                return JsonConvert.SerializeObject(output);
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"An unexpected error occurred in method GetAgentsCreationTimeline. Details: {ex.Message}");
                throw ex;
            }
        }
    }
}