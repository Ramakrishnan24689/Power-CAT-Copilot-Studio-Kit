using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using System;

namespace POWERCAT.Plugins.CopilotTestRun
{
    /// <summary>
    /// Plugin class to calculate rollup field.
    /// </summary>
    public class CalculateRollupFieldPlugin : IPlugin
    {
        /// <summary>
        /// Executes the plugin logic.
        /// </summary>
        /// <param name="serviceProvider">The service provider.</param>
        public void Execute(IServiceProvider serviceProvider)
        {
            // Obtain the tracing service
            ITracingService tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            // Obtain the execution context from the service provider.  
            IPluginExecutionContext context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            // Get the field name, target entity name, and target entity id from input parameters
            string fieldName = (string)context.InputParameters["cat_TargetFieldName"];
            var targetEntity = (string)context.InputParameters["cat_TargetEntityName"];
            var targetId = (string)context.InputParameters["cat_TargetEntityId"];

            // Create the organization service factory and service
            IOrganizationServiceFactory serviceFactory =
               (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            IOrganizationService service = serviceFactory.CreateOrganizationService(context.UserId);

            try
            {
                tracingService.Trace("CalculateRollupField initiating..");

                // Create the CalculateRollupFieldRequest with the target entity and field name
                CalculateRollupFieldRequest calRollupRequest = new CalculateRollupFieldRequest
                {
                    Target = new EntityReference(targetEntity, new Guid(targetId)),
                    FieldName = fieldName
                };

                // Execute the CalculateRollupFieldRequest and get the response
                CalculateRollupFieldResponse response = (CalculateRollupFieldResponse)service.Execute(calRollupRequest);

                // Set the output parameter with the response message
                context.OutputParameters["cat_Response"] = "Rollup field updated successfully.";
            }
            catch (Exception ex)
            {
                // Log the exception
                tracingService.Trace("CalculateRollupField Exception: {0}", ex.ToString());
                throw;
            }
        }
    }
}
