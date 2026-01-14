// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using System;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Plugin class to aggregate Transcript Metrics
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
            if ((context.Stage.Equals(20) || context.Stage.Equals(30) || context.Stage.Equals(40)) && context.MessageName == "cat_AggregateAgentKPIs")
            {
                AggregateAgentKPIs aggregateAgentKPIs = new AggregateAgentKPIs(organizationService, tracingService);
                aggregateAgentKPIs.Execute(context);
            }
        }
    }
}