using System;
using Microsoft.Crm.Sdk.Messages;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace POWERCAT.Plugins.PowerShield
{
    /// <summary>
    /// Manages record-level sharing on cat_policyrequest when participants are
    /// added to or removed from cat_policyrequestparticipant.
    ///
    /// Registration:
    ///   Create  – Post-Operation, Synchronous, no images
    ///   Delete  – Post-Operation, Synchronous, Pre-Image "PreImageParticipant"
    ///             (attributes: cat_policyrequestid, cat_participantaadobjectid)
    /// </summary>
    public class ParticipantSharingPlugin : IPlugin
    {
        private const AccessRights ParticipantAccess =
            AccessRights.ReadAccess |
            AccessRights.WriteAccess |
            AccessRights.AppendAccess |
            AccessRights.AppendToAccess;

        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("ParticipantSharingPlugin: Execute started.");

                var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = factory.CreateOrganizationService(null); // SYSTEM context

                trace.Trace("Message: {0}, Entity: {1}, Stage: {2}, Depth: {3}.",
                    context.MessageName, context.PrimaryEntityName, context.Stage, context.Depth);

                switch (context.MessageName)
                {
                    case "Create":
                        HandleCreate(context, service, trace);
                        break;
                    case "Delete":
                        HandleDelete(context, service, trace);
                        break;
                    default:
                        throw new InvalidPluginExecutionException(
                            $"ParticipantSharingPlugin: unexpected message '{context.MessageName}'.");
                }

                trace.Trace("ParticipantSharingPlugin: Execute completed successfully.");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("ParticipantSharingPlugin: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"ParticipantSharingPlugin failed: {ex.Message}", ex);
            }
        }

        private static void HandleCreate(
            IPluginExecutionContext context,
            IOrganizationService service,
            ITracingService trace)
        {
            trace.Trace("HandleCreate: extracting Target entity.");
            var target = (Entity)context.InputParameters["Target"];

            var aadObjectId = target.GetAttributeValue<string>("cat_participantaadobjectid");
            var policyRequestRef = target.GetAttributeValue<EntityReference>("cat_policyrequestid");

            trace.Trace("HandleCreate: AAD Object ID = '{0}', Policy Request = '{1}'.",
                aadObjectId ?? "(null)",
                policyRequestRef?.Id.ToString() ?? "(null)");

            if (string.IsNullOrWhiteSpace(aadObjectId) || policyRequestRef == null)
            {
                trace.Trace("HandleCreate: missing required fields. Skipping share.");
                return;
            }

            var systemUserId = ResolveSystemUserId(service, trace, aadObjectId);
            if (systemUserId == Guid.Empty)
                return;

            try
            {
                var request = new GrantAccessRequest
                {
                    Target = policyRequestRef,
                    PrincipalAccess = new PrincipalAccess
                    {
                        Principal = new EntityReference("systemuser", systemUserId),
                        AccessMask = ParticipantAccess,
                    },
                };

                service.Execute(request);
                trace.Trace("HandleCreate: granted access on {0} to systemuser {1}.",
                    policyRequestRef.Id, systemUserId);
            }
            catch (Exception ex)
            {
                trace.Trace("HandleCreate: GrantAccessRequest failed — {0}", ex.ToString());
                throw;
            }
        }

        private static void HandleDelete(
            IPluginExecutionContext context,
            IOrganizationService service,
            ITracingService trace)
        {
            trace.Trace("HandleDelete: retrieving PreImage.");

            if (!context.PreEntityImages.TryGetValue("PreImageParticipant", out Entity preImage))
            {
                throw new InvalidPluginExecutionException(
                    "ParticipantSharingPlugin: PreImageParticipant not registered for Delete step.");
            }

            var aadObjectId = preImage.GetAttributeValue<string>("cat_participantaadobjectid");
            var policyRequestRef = preImage.GetAttributeValue<EntityReference>("cat_policyrequestid");

            trace.Trace("HandleDelete: AAD Object ID = '{0}', Policy Request = '{1}'.",
                aadObjectId ?? "(null)",
                policyRequestRef?.Id.ToString() ?? "(null)");

            if (string.IsNullOrWhiteSpace(aadObjectId) || policyRequestRef == null)
            {
                trace.Trace("HandleDelete: missing required fields in PreImage. Skipping revoke.");
                return;
            }

            var systemUserId = ResolveSystemUserId(service, trace, aadObjectId);
            if (systemUserId == Guid.Empty)
                return;

            try
            {
                var request = new RevokeAccessRequest
                {
                    Target = policyRequestRef,
                    Revokee = new EntityReference("systemuser", systemUserId),
                };

                service.Execute(request);
                trace.Trace("HandleDelete: revoked access on {0} from systemuser {1}.",
                    policyRequestRef.Id, systemUserId);
            }
            catch (Exception ex)
            {
                trace.Trace("HandleDelete: RevokeAccessRequest failed — {0}", ex.ToString());
                throw;
            }
        }

        private static Guid ResolveSystemUserId(
            IOrganizationService service,
            ITracingService trace,
            string aadObjectId)
        {
            var query = new QueryExpression("systemuser")
            {
                ColumnSet = new ColumnSet("systemuserid"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression(
                            "azureactivedirectoryobjectid",
                            ConditionOperator.Equal,
                            aadObjectId),
                        new ConditionExpression(
                            "isdisabled",
                            ConditionOperator.Equal,
                            false),
                    },
                },
                TopCount = 1,
            };

            var results = service.RetrieveMultiple(query);
            if (results.Entities.Count == 0)
            {
                trace.Trace("No active systemuser found for AAD Object ID '{0}'. Skipping.", aadObjectId);
                return Guid.Empty;
            }

            return results.Entities[0].Id;
        }
    }
}
