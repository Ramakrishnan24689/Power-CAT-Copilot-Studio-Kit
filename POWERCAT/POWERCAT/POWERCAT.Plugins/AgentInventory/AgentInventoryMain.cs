// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Text;
using Microsoft.Xrm.Sdk;
using Newtonsoft.Json;
using static POWERCAT.Plugins.AgentInventory.AgentDataModel;

namespace POWERCAT.Plugins.AgentInventory
{
    /// <summary>
    /// Agent inventory plugin main class
    /// </summary>
    public class AgentInventoryMain : IPlugin
    {
        /// <summary>
        /// Entry point to the plugin execution method
        /// </summary>
        public void Execute(IServiceProvider serviceProvider)
        {
            ITracingService tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            IPluginExecutionContext context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            IOrganizationServiceFactory factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            IOrganizationService organizationService = factory.CreateOrganizationService(context.UserId);

            try
            {
                tracingService.Trace("Plugin execution started");

                //Check if the custom api call is cat_AgentInventory
                if (context.MessageName == "cat_AgentInventory")
                {
                    //Agent input as a json from api
                    string jsonData = (string)context.InputParameters["cat_AgentInput"];

                    //Deserializing json input into AgentInput in AgentInputDataModel
                    var json = JsonConvert.DeserializeObject<AgentInput>(jsonData);

                    AgentRepository agentOperation = new AgentRepository(organizationService, tracingService);

                    //Process the agent data for agent creation
                    var getAgentData = agentOperation.GetAgentData(json.AgentDetails, json.AgentComponentDetails);

                    //Delete and create the agent in agent details table
                    var createdAgent = agentOperation.CreateAgent(getAgentData);

                    //If agent creation is successfully completed then set the output to the api
                    if (createdAgent != null)
                    {
                        //Set the created agent guid to the api output
                        context.OutputParameters["cat_AgentOutput"] = createdAgent;
                    }
                    else
                    {
                        tracingService.Trace($"Plugin execution failed. \r\nCreated guid is - {createdAgent.ToString()}");
                    }

                }
                //Check if the custom api call is cat_ExtractWorkFlowData
                else if (context.MessageName == "cat_ExtractWorkFlowData")
                {
                    //list of WorkFlows as a json string from custom api
                    string jsonData = (string)context.InputParameters["cat_ExtractWorkFlowInput"];

                    AgentDataProcessor agentDataProcess = new AgentDataProcessor();

                    var result = agentDataProcess.ExtractWorkFlowData(jsonData);

                    if (!string.IsNullOrEmpty(result))
                    {
                        //Set output - list of connections extracted from workflows as json string
                        context.OutputParameters["cat_ExtractWorkFlowOutput"] = result;
                    }
                }
                //Check if custom API call is for tenant usage report generation
                else if (context.MessageName == "cat_GenerateTenantUsageReport")
                {
                    string logId = (string)context.InputParameters["cat_UsageLogId"];
                    string base64EncodedUsageData = (string)context.InputParameters["cat_UsageInput"];

                    //Decode the data
                    byte[] decodedBytes = Convert.FromBase64String(base64EncodedUsageData);
                    string decodedUsageCsv = Encoding.UTF8.GetString(decodedBytes);

                    AgentUsageData usageDataOperation = new AgentUsageData(organizationService, tracingService);

                    //Create usage data in TenantUsageData table
                    bool result = usageDataOperation.UpdateAgentUsageData(decodedUsageCsv, logId);

                    if (result)
                    {
                        context.OutputParameters["cat_UsageOutput"] = result;
                    }
                    else
                    {
                        tracingService.Trace($"Plugin execution failed.");
                    }
                }
            }
            catch (Exception ex)
            {
                tracingService.Trace($"An unexpected error occurred in method Execute. Details: {ex.Message}");
                throw new InvalidPluginExecutionException($"An unexpected error occurred in method Execute. Details:{ex.Message}", ex);
            }
        }
    }
}