// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Messages;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;

namespace POWERCAT.Plugins.TranscriptMetrics
{
    /// <summary>
    /// Updates workflow status for multiple records in batch.
    /// Input: JSON string array of GUIDs and workflow status code.
    /// </summary>
    public class UpdateWorkflowStatusBatch
    {
        private const string _entityName = "cat_agentinsightstranscriptstaging";

        private readonly IOrganizationService _organizationService;
        private readonly ITracingService _tracingService;

        /// <summary>
        /// Initializes a new instance of the <see cref="UpdateWorkflowStatusBatch"/> class.
        /// </summary>
        /// <param name="organizationService">The organization service for Dataverse operations.</param>
        /// <param name="tracingService">The tracing service for logging.</param>
        /// <exception cref="ArgumentNullException">Thrown when organizationService or tracingService is null.</exception>
        public UpdateWorkflowStatusBatch(IOrganizationService organizationService, ITracingService tracingService)
        {
            _organizationService = organizationService ?? throw new ArgumentNullException(nameof(organizationService));
            _tracingService = tracingService ?? throw new ArgumentNullException(nameof(tracingService));
        }

        /// <summary>
        /// Executes the batch update logic.
        /// </summary>
        /// <param name="context">The plugin execution context containing input and output parameters.</param>
        /// <exception cref="InvalidPluginExecutionException">Thrown when an error occurs during batch update.</exception>
        public void Execute(IPluginExecutionContext context)
        {
            try
            {
                // 1. Extract input parameters - RecordIds is now a JSON string array
                string recordIdsJson = context.InputParameters.Contains("RecordIds")
                    ? context.InputParameters["RecordIds"] as string
                    : null;

                string[] recordIds = !string.IsNullOrEmpty(recordIdsJson)
                    ? JsonConvert.DeserializeObject<string[]>(recordIdsJson)
                    : null;

                int workflowStatus = context.InputParameters.Contains("WorkflowStatus")
                    ? (int)context.InputParameters["WorkflowStatus"]
                    : 0;

                // 2. Validate inputs
                if (recordIds == null || recordIds.Length == 0)
                {
                    _tracingService.Trace("No record IDs provided.");
                    SetSuccessResponse(context, 0, 0);
                    return;
                }

                _tracingService.Trace($"Updating {recordIds.Length} records in '{_entityName}' to status {workflowStatus}");

                // 3. Parse GUIDs and build update requests
                var batchRequest = new ExecuteMultipleRequest
                {
                    Requests = new OrganizationRequestCollection(),
                    Settings = new ExecuteMultipleSettings
                    {
                        ContinueOnError = true,
                        ReturnResponses = true
                    }
                };
                var parseErrors = new List<string>();

                foreach (var recordId in recordIds)
                {
                    if (Guid.TryParse(recordId, out Guid id) && id != Guid.Empty)
                    {
                        var entity = new Entity(_entityName, id);
                        entity["cat_workflowstatus"] = new OptionSetValue(workflowStatus);
                        batchRequest.Requests.Add(new UpdateRequest { Target = entity });
                    }
                    else
                    {
                        parseErrors.Add(recordId ?? "(null)");
                    }
                }

                if (parseErrors.Count > 0)
                {
                    _tracingService.Trace($"Skipped {parseErrors.Count} invalid GUIDs");
                }

                if (batchRequest.Requests.Count == 0)
                {
                    _tracingService.Trace("No valid records to update");
                    SetSuccessResponse(context, 0, 0);
                    return;
                }

                // 4. Execute batch update
                int successCount = 0;
                int failureCount = 0;
                var errors = new List<string>();

                _tracingService.Trace($"Executing batch with {batchRequest.Requests.Count} records");

                var response = (ExecuteMultipleResponse)_organizationService.Execute(batchRequest);

                foreach (var responseItem in response.Responses)
                {
                    if (responseItem.Fault != null)
                    {
                        failureCount++;
                        if (errors.Count < 5)
                        {
                            errors.Add($"Index {responseItem.RequestIndex}: {responseItem.Fault.Message}");
                        }
                    }
                    else
                    {
                        successCount++;
                    }
                }

                _tracingService.Trace($"Update results - Success: {successCount}, Failures: {failureCount}");

                // 5. Set output parameters
                context.OutputParameters["IsSuccess"] = failureCount == 0;
                context.OutputParameters["SuccessCount"] = successCount;
                context.OutputParameters["FailureCount"] = failureCount;

                if (failureCount > 0)
                {
                    string errorDetails = string.Join("; ", errors);
                    context.OutputParameters["ErrorMessage"] = $"Completed with {failureCount} errors. First errors: {errorDetails}";
                }
                else
                {
                    context.OutputParameters["ErrorMessage"] = string.Empty;
                }
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                string errorMsg = $"An error occurred: {ex.Message}";
                SetErrorResponse(context, errorMsg);
                throw new InvalidPluginExecutionException(errorMsg, ex);
            }
        }

        /// <summary>
        /// Sets success response output parameters.
        /// </summary>
        /// <param name="context">The plugin execution context to set output parameters on.</param>
        /// <param name="successCount">The number of successfully processed records.</param>
        /// <param name="failureCount">The number of failed records.</param>
        private void SetSuccessResponse(IPluginExecutionContext context, int successCount, int failureCount)
        {
            context.OutputParameters["IsSuccess"] = true;
            context.OutputParameters["SuccessCount"] = successCount;
            context.OutputParameters["FailureCount"] = failureCount;
            context.OutputParameters["ErrorMessage"] = string.Empty;
        }

        /// <summary>
        /// Sets error response output parameters.
        /// </summary>
        /// <param name="context">The plugin execution context to set output parameters on.</param>
        /// <param name="errorMessage">The error message to include in the response.</param>
        private void SetErrorResponse(IPluginExecutionContext context, string errorMessage)
        {
            context.OutputParameters["IsSuccess"] = false;
            context.OutputParameters["SuccessCount"] = 0;
            context.OutputParameters["FailureCount"] = 0;
            context.OutputParameters["ErrorMessage"] = errorMessage;
        }
    }
}