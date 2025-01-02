// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using System;
using Microsoft.Xrm.Sdk.Messages;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Plugin class to generate Conversation KPIs
    /// </summary>
    public class ConversationKpiMain : IPlugin
    {
        /// <summary>
        /// Executes the plugin logic.
        /// </summary>
        /// <param name="serviceProvider">The service provider.</param>
        public void Execute(IServiceProvider serviceProvider)
        {
            ITracingService tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            IPluginExecutionContext context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            IOrganizationServiceFactory factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            IOrganizationService organizationService = factory.CreateOrganizationService(context.UserId);

            tracingService.Trace("Plugin Execution Started..");
            string messageName = context.MessageName;
            // Check the stage - Main operation
            if (context.Stage.Equals(30))
            {
                if (messageName == "cat_GenerateAgentTranscripts")
                {
                    ProcessConversationTranscripts processConversationTranscripts = new ProcessConversationTranscripts();
                    processConversationTranscripts.GenerateAgentTranscripts(context, organizationService, tracingService);
                }
                else if (messageName == "cat_GenerateConversationKpis")
                {
                    ProcessAgentTranscripts processAgentTranscripts = new ProcessAgentTranscripts(organizationService, tracingService);
                    processAgentTranscripts.GenerateConversationKpis(context);
                }
            }                
        }
    }
}
