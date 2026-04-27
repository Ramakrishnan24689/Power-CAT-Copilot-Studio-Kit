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

                switch (context.MessageName)
                {
                    case "cat_AgentInventory":
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
                        if (createdAgent.AgentDetailsId != null)
                        {
                            //Set the created agent guid to the api output
                            context.OutputParameters["cat_AgentOutput"] = createdAgent.AgentDetailsId;
                            context.OutputParameters["cat_AgentComponentsOutput"] = JsonConvert.SerializeObject(createdAgent.AgentComponents, Formatting.Indented);
                        }
                        else
                        {
                            tracingService.Trace($"Plugin execution failed. \r\nCreated guid is - {createdAgent.ToString()}");
                        }
                        break;

                    case "cat_ExtractWorkFlowData":
                        //list of WorkFlows as a json string from custom api
                        string workflowJsonData = (string)context.InputParameters["cat_ExtractWorkFlowInput"];

                        AgentDataProcessor agentDataProcess = new AgentDataProcessor();

                        var workflowResult = agentDataProcess.ExtractWorkFlowData(workflowJsonData);

                        if (!string.IsNullOrEmpty(workflowResult))
                        {
                            //Set output - list of connections extracted from workflows as json string
                            context.OutputParameters["cat_ExtractWorkFlowOutput"] = workflowResult;
                        }
                        break;

                    case "cat_GenerateTenantUsageReport":
                        string usageJson = (string)context.InputParameters["cat_UsageInput"];

                        var usage = JsonConvert.DeserializeObject<AgentUsageInput>(usageJson);

                        AgentUsageData createUsageDataOperation = new AgentUsageData(organizationService, tracingService);

                        //Create usage data in usage history table
                        bool result = createUsageDataOperation.CreateUsageData(usage);

                        context.OutputParameters["cat_UsageOutput"] = result;
                        break;

                    case "cat_AgentInventoryBulkDelete":
                        string deleteTableName = (string)context.InputParameters["cat_DeleteTableName"];
                        string recordIds = (string)context.InputParameters["cat_DeleteRecordIds"];

                        AgentInventoryDeleteOperation deleteOperation = new AgentInventoryDeleteOperation(organizationService, tracingService);

                        //Bulk delete data in agent inventory table
                        bool deleteResult = deleteOperation.BulkDeleteOperation(deleteTableName, recordIds);

                        context.OutputParameters["cat_DeleteResult"] = deleteResult;
                        break;

                    case "cat_QueryAgentInventoryData":
                        AgentInventoryQueryUtilities getAgentsCreationTimeline = new AgentInventoryQueryUtilities(organizationService, tracingService);

                        //Get aggregated and accumulated agents creation timeline
                        var timelineResult = getAgentsCreationTimeline.GetAgentsCreationTimeline();

                        context.OutputParameters["cat_ResultJson"] = timelineResult;
                        break;

                    default:
                        tracingService.Trace("The plug-in is not associated with the expected message.");
                        break;
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