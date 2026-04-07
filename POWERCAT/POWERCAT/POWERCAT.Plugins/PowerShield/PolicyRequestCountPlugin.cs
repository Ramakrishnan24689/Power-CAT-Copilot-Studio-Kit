using System;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace POWERCAT.Plugins.PowerShield
{
    /// <summary>
    /// Recomputes cat_requestenvironmentcount / cat_policyconnectorscount on the
    /// parent cat_policyrequest whenever a child environment or connector record
    /// is created or deleted.
    ///
    /// Registration (4 steps, all Post-Operation, Synchronous):
    ///   cat_policyrequestenvironment – Create  – no images
    ///   cat_policyrequestenvironment – Delete  – Pre-Image "PreImageChildRecord" (cat_policyrequestid)
    ///   cat_policyrequestconnector   – Create  – no images
    ///   cat_policyrequestconnector   – Delete  – Pre-Image "PreImageChildRecord" (cat_policyrequestid)
    /// </summary>
    public class PolicyRequestCountPlugin : IPlugin
    {
        private const string EnvironmentEntity = "cat_policyrequestenvironment";
        private const string ConnectorEntity = "cat_policyrequestconnector";
        private const string ParentEntity = "cat_policyrequest";
        private const string ParentLookup = "cat_policyrequestid";
        private const string PreImageAlias = "PreImageChildRecord";

        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("PolicyRequestCountPlugin: Execute started.");

                var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = factory.CreateOrganizationService(null); // SYSTEM context

                trace.Trace("Message: {0}, Entity: {1}, Stage: {2}, Depth: {3}.",
                    context.MessageName, context.PrimaryEntityName, context.Stage, context.Depth);

                // Resolve parent policy request reference
                var parentRef = GetPolicyRequestRef(context, trace);
                if (parentRef == null)
                {
                    trace.Trace("PolicyRequestCountPlugin: no parent reference found. Exiting.");
                    return;
                }

                // Determine which child entity triggered this and count its records
                string childEntity = context.PrimaryEntityName;
                int count = CountChildRecords(service, childEntity, parentRef.Id, trace);

                // Update only the relevant count field on the parent
                var update = new Entity(ParentEntity, parentRef.Id);

                if (string.Equals(childEntity, EnvironmentEntity, StringComparison.OrdinalIgnoreCase))
                {
                    update["cat_requestenvironmentcount"] = count;
                    trace.Trace("Setting cat_requestenvironmentcount = {0} on {1}.", count, parentRef.Id);
                }
                else if (string.Equals(childEntity, ConnectorEntity, StringComparison.OrdinalIgnoreCase))
                {
                    update["cat_policyconnectorscount"] = count;
                    trace.Trace("Setting cat_policyconnectorscount = {0} on {1}.", count, parentRef.Id);
                }
                else
                {
                    throw new InvalidPluginExecutionException(
                        $"PolicyRequestCountPlugin: unexpected entity '{childEntity}'.");
                }

                service.Update(update);
                trace.Trace("PolicyRequestCountPlugin: Execute completed successfully.");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("PolicyRequestCountPlugin: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"PolicyRequestCountPlugin failed: {ex.Message}", ex);
            }
        }

        private static EntityReference GetPolicyRequestRef(
            IPluginExecutionContext context,
            ITracingService trace)
        {
            EntityReference parentRef = null;

            switch (context.MessageName)
            {
                case "Create":
                    var target = (Entity)context.InputParameters["Target"];
                    parentRef = target.GetAttributeValue<EntityReference>(ParentLookup);
                    trace.Trace("Create: extracted parent ref = '{0}'.",
                        parentRef?.Id.ToString() ?? "(null)");
                    break;

                case "Delete":
                    if (!context.PreEntityImages.TryGetValue(PreImageAlias, out Entity preImage))
                    {
                        throw new InvalidPluginExecutionException(
                            $"PolicyRequestCountPlugin: Pre-Image '{PreImageAlias}' not registered for Delete step.");
                    }
                    parentRef = preImage.GetAttributeValue<EntityReference>(ParentLookup);
                    trace.Trace("Delete: extracted parent ref from PreImage = '{0}'.",
                        parentRef?.Id.ToString() ?? "(null)");
                    break;

                default:
                    throw new InvalidPluginExecutionException(
                        $"PolicyRequestCountPlugin: unexpected message '{context.MessageName}'.");
            }

            return parentRef;
        }

        private static int CountChildRecords(
            IOrganizationService service,
            string childEntity,
            Guid parentId,
            ITracingService trace)
        {
            var query = new QueryExpression(childEntity)
            {
                ColumnSet = new ColumnSet(false), // no columns needed, just counting
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression(
                            ParentLookup,
                            ConditionOperator.Equal,
                            parentId),
                    },
                },
                PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = 1,
                    ReturnTotalRecordCount = true,
                },
            };

            var result = service.RetrieveMultiple(query);
            int count = result.TotalRecordCount >= 0
                ? result.TotalRecordCount
                : result.Entities.Count;

            trace.Trace("CountChildRecords: {0} has {1} records for parent {2}.",
                childEntity, count, parentId);

            return count;
        }
    }
}
