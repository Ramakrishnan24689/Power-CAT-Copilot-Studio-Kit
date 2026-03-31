// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using Microsoft.Xrm.Sdk;

namespace POWERCAT.Plugins.AgentTemplate
{
    /// <summary>
    /// Agent template plugin main class - routes custom API messages to AgentTemplateOperations.
    /// </summary>
    public class AgentTemplateMain : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            ITracingService tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            IPluginExecutionContext context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            IOrganizationServiceFactory factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            IOrganizationService organizationService = factory.CreateOrganizationService(context.UserId);

            try
            {
                tracingService.Trace("AgentTemplateMain execution started.");

                var operations = new AgentTemplateOperations(organizationService, tracingService);

                if (context.MessageName == "cat_DownloadSolutionBasedOnUrl")
                {
                    // Expecting input parameter: cat_SolutionUrl (string)
                    string solutionUrl = (string)context.InputParameters["cat_SolutionUrl"];
                    string base64Solution = operations.DownloadSolutionBasedOnUrl(solutionUrl);

                    // Output parameter: cat_DownloadSolutionOutput (base64 string)
                    context.OutputParameters["cat_DownloadSolutionOutput"] = base64Solution;
                }
            }
            catch (Exception ex)
            {
                tracingService.Trace($"AgentTemplateMain: Exception in Execute. Details: {ex.Message}");
                throw new InvalidPluginExecutionException($"An unexpected error occurred in AgentTemplateMain Execute. Details:{ex.Message}", ex);
            }
        }
    }
}
