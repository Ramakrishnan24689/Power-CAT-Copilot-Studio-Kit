// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Net;
using Microsoft.Xrm.Sdk;
using Microsoft.Crm.Sdk.Messages;

namespace POWERCAT.Plugins.AgentTemplate
{ 
    /// <summary>
    /// Provides solution-related operations for the AgentTemplate plugin.
    /// </summary>
    public class AgentTemplateOperations
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
        /// Constructor to initialize Organization & Tracing services
        /// </summary>
        /// <param name="organizationService">Organization Service</param>
        /// <param name="tracingService">Tracing Service</param>
        public AgentTemplateOperations(IOrganizationService organizationService, ITracingService tracingService)
        {
            _organizationService = organizationService;
            _tracingService = tracingService;
        }

        /// <summary>
        /// Downloads the solution package from the provided URL and returns it as a base64 string.
        /// </summary>
        /// <param name="solutionUrl">URL to the solution zip/content.</param>
        /// <returns>Base64-encoded solution bytes.</returns>
        public string DownloadSolutionBasedOnUrl(string solutionUrl)
        {
            if (string.IsNullOrWhiteSpace(solutionUrl))
            {
                _tracingService.Trace("DownloadSolutionBasedOnUrl: solutionUrl is null or empty.");
                throw new ArgumentException("solutionUrl must be provided", nameof(solutionUrl));
            }

            try
            {
                _tracingService.Trace($"DownloadSolutionBasedOnUrl: Downloading from URL: {solutionUrl}");

                using (var client = new WebClient())
                {
                    byte[] data = client.DownloadData(solutionUrl);
                    string base64 = Convert.ToBase64String(data);
                    _tracingService.Trace($"DownloadSolutionBasedOnUrl: Downloaded {data.Length} bytes.");
                    return base64;
                }
            }
            catch (Exception ex)
            {
                _tracingService.Trace($"DownloadSolutionBasedOnUrl: Exception - {ex.Message}");
                throw;
            }
        }
    }
}
