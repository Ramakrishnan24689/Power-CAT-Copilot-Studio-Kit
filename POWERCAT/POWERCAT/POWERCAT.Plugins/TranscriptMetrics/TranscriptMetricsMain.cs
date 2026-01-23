// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using System;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Plugin class to handle Transcript Metrics operations
    /// </summary>
    public class TranscriptMetricsMain : IPlugin
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

            // Check the stage - Main operation
            if (context.Stage.Equals(30))
            {
                switch (context.MessageName)
                {
                    case "cat_AggregateAgentKPIs":
                        var aggregateAgentKPIs = new AggregateAgentKPIs(organizationService, tracingService);
                        aggregateAgentKPIs.Execute(context);
                        break;
                    case "cat_ProcessConversationTranscriptsBatch":
                        var processTranscripts = new ProcessConversationTranscriptsBatch(organizationService, tracingService);
                        processTranscripts.Execute(context);
                        break;
                    default:
                        tracingService.Trace($"Unknown message: {context.MessageName}");
                        break;
                }
            }
        }
    }
}