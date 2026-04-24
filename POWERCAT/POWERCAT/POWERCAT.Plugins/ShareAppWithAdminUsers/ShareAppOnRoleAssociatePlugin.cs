// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace POWERCAT.Plugins.ShareAppWithAdminUsers
{
    /// <summary>
    /// Plugin registration:
    ///   Message:        Associate
    ///   Primary Entity: (none - leave blank)
    ///   Stage:          PostOperation (40)
    ///   Mode:           Synchronous (or Asynchronous)
    ///
    /// Fires when a security role is associated to a system user via the
    /// systemuserroles_association relationship, then invokes the custom
    /// action cat_ShareAppWithAdminsandMakers.
    /// </summary>
    public class ShareAppOnRoleAssociatePlugin : IPlugin
    {
        private const string AssociateMessage = "Associate";
        private const string UserRoleRelationshipName = "systemuserroles_association";
        private const string TeamRoleRelationshipName = "teamroles_association";
        private const string SystemUserLogicalName = "systemuser";
        private const string TeamLogicalName = "team";
        private const string RoleLogicalName = "role";
        private const string CustomActionName = "cat_ShareAppWithAdminsandMakers";
        private const string CustomActionUserIdParameter = "cat_SystemUserId";
        private const string CustomActionTeamIdParameter = "cat_TeamId";
        private const string CustomActionPrincipalTypeParameter = "cat_PrincipalType";

        private const string PrincipalTypeUser = "User";
        private const string PrincipalTypeGroup = "Group";

        private static readonly HashSet<string> AllowedRoleNames =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "CSK - Administrator",
                "System Administrator",
                "CSK - Maker"
            };

        public void Execute(IServiceProvider serviceProvider)
        {
            if (serviceProvider == null)
                throw new ArgumentNullException(nameof(serviceProvider));

            var tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));

            tracingService.Trace("=== {0}.Execute START ===", nameof(ShareAppOnRoleAssociatePlugin));
            tracingService.Trace(
                "Context: MessageName='{0}', Stage={1}, Mode={2}, Depth={3}, CorrelationId={4}",
                context.MessageName, context.Stage, context.Mode, context.Depth, context.CorrelationId);
            tracingService.Trace(
                "Users: UserId={0}, InitiatingUserId={1}, OrgName='{2}', OrgId={3}",
                context.UserId, context.InitiatingUserId, context.OrganizationName, context.OrganizationId);
            tracingService.Trace(
                "PrimaryEntity='{0}', PrimaryEntityId={1}, SecondaryEntity='{2}'",
                context.PrimaryEntityName, context.PrimaryEntityId, context.SecondaryEntityName);

            try
            {
                tracingService.Trace("InputParameters count = {0}", context.InputParameters.Count);
                foreach (var kv in context.InputParameters)
                {
                    tracingService.Trace("  InputParameter[{0}] = {1}", kv.Key, kv.Value?.GetType().Name ?? "null");
                }

                if (!string.Equals(context.MessageName, AssociateMessage, StringComparison.OrdinalIgnoreCase))
                {
                    tracingService.Trace(
                        "GUARD 1 FAILED: MessageName '{0}' != '{1}'. Exiting.",
                        context.MessageName, AssociateMessage);
                    return;
                }
                tracingService.Trace("GUARD 1 PASSED: MessageName is '{0}'.", AssociateMessage);

                var relationship = context.InputParameters.Contains("Relationship")
                    ? context.InputParameters["Relationship"] as Relationship
                    : null;

                if (relationship == null)
                {
                    tracingService.Trace("GUARD 2 FAILED: 'Relationship' InputParameter is null or missing. Exiting.");
                    return;
                }

                tracingService.Trace(
                    "Relationship found: SchemaName='{0}', PrimaryEntityRole={1}",
                    relationship.SchemaName, relationship.PrimaryEntityRole);

                string expectedPrincipalLogicalName;
                string principalType;
                if (string.Equals(relationship.SchemaName, UserRoleRelationshipName, StringComparison.OrdinalIgnoreCase))
                {
                    expectedPrincipalLogicalName = SystemUserLogicalName;
                    principalType = PrincipalTypeUser;
                }
                else if (string.Equals(relationship.SchemaName, TeamRoleRelationshipName, StringComparison.OrdinalIgnoreCase))
                {
                    expectedPrincipalLogicalName = TeamLogicalName;
                    principalType = PrincipalTypeGroup;
                }
                else
                {
                    tracingService.Trace(
                        "GUARD 2 FAILED: Relationship '{0}' is not '{1}' or '{2}'. Exiting.",
                        relationship.SchemaName, UserRoleRelationshipName, TeamRoleRelationshipName);
                    return;
                }
                tracingService.Trace(
                    "GUARD 2 PASSED: Relationship is '{0}' -> principal '{1}' (type '{2}').",
                    relationship.SchemaName, expectedPrincipalLogicalName, principalType);

                var targetPrincipal = context.InputParameters.Contains("Target")
                    ? context.InputParameters["Target"] as EntityReference
                    : null;

                if (targetPrincipal == null)
                {
                    tracingService.Trace("GUARD 3 FAILED: 'Target' InputParameter is null or not EntityReference. Exiting.");
                    return;
                }

                tracingService.Trace(
                    "Target EntityReference: LogicalName='{0}', Id={1}, Name='{2}'",
                    targetPrincipal.LogicalName, targetPrincipal.Id, targetPrincipal.Name);

                if (!string.Equals(targetPrincipal.LogicalName, expectedPrincipalLogicalName, StringComparison.OrdinalIgnoreCase))
                {
                    tracingService.Trace(
                        "GUARD 3 FAILED: Target.LogicalName '{0}' != '{1}'. Exiting.",
                        targetPrincipal.LogicalName, expectedPrincipalLogicalName);
                    return;
                }
                tracingService.Trace("GUARD 3 PASSED: Target is a '{0}'.", expectedPrincipalLogicalName);

                var relatedEntities = context.InputParameters.Contains("RelatedEntities")
                    ? context.InputParameters["RelatedEntities"] as EntityReferenceCollection
                    : null;

                if (relatedEntities == null || relatedEntities.Count == 0)
                {
                    tracingService.Trace("GUARD 4 FAILED: RelatedEntities is null or empty. Exiting.");
                    return;
                }

                tracingService.Trace("RelatedEntities count = {0}", relatedEntities.Count);
                var roleIds = new List<Guid>();
                for (int i = 0; i < relatedEntities.Count; i++)
                {
                    var er = relatedEntities[i];
                    tracingService.Trace(
                        "  RelatedEntities[{0}]: LogicalName='{1}', Id={2}",
                        i, er.LogicalName, er.Id);
                    if (string.Equals(er.LogicalName, RoleLogicalName, StringComparison.OrdinalIgnoreCase))
                        roleIds.Add(er.Id);
                }

                if (roleIds.Count == 0)
                {
                    tracingService.Trace("GUARD 4 FAILED: No role EntityReferences found in RelatedEntities. Exiting.");
                    return;
                }
                tracingService.Trace("GUARD 4 PASSED: {0} role(s) found in RelatedEntities.", roleIds.Count);

                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);
                tracingService.Trace("IOrganizationService created in context of UserId={0}.", context.UserId);

                bool anyAllowed = false;
                foreach (var roleId in roleIds)
                {
                    var role = service.Retrieve(RoleLogicalName, roleId, new ColumnSet("name"));
                    var roleName = role.GetAttributeValue<string>("name");
                    tracingService.Trace("  Role {0} name = '{1}'", roleId, roleName);

                    if (!string.IsNullOrEmpty(roleName) && AllowedRoleNames.Contains(roleName))
                    {
                        tracingService.Trace("  Role '{0}' is in allowed list.", roleName);
                        anyAllowed = true;
                        break;
                    }
                }

                if (!anyAllowed)
                {
                    tracingService.Trace(
                        "GUARD 5 FAILED: None of the assigned roles match allowed list ({0}). Exiting.",
                        string.Join(", ", AllowedRoleNames));
                    return;
                }
                tracingService.Trace("GUARD 5 PASSED: At least one assigned role is in the allowed list.");

                tracingService.Trace(
                    "All guards passed. Preparing to invoke custom action '{0}' for {1} {2}.",
                    CustomActionName, principalType, targetPrincipal.Id);

                var request = new OrganizationRequest(CustomActionName);
                request[CustomActionPrincipalTypeParameter] = principalType;
                if (principalType == PrincipalTypeUser)
                {
                    request[CustomActionUserIdParameter] = targetPrincipal.Id.ToString();
                    request[CustomActionTeamIdParameter] = string.Empty;
                }
                else
                {
                    request[CustomActionUserIdParameter] = string.Empty;
                    request[CustomActionTeamIdParameter] = targetPrincipal.Id.ToString();
                }

                tracingService.Trace(
                    "Executing OrganizationRequest '{0}' with {1}='{2}', {3}='{4}', {5}='{6}'...",
                    CustomActionName,
                    CustomActionPrincipalTypeParameter, request[CustomActionPrincipalTypeParameter],
                    CustomActionUserIdParameter, request[CustomActionUserIdParameter],
                    CustomActionTeamIdParameter, request[CustomActionTeamIdParameter]);

                var response = service.Execute(request);

                tracingService.Trace(
                    "'{0}' executed successfully. Response ResponseName='{1}', Results count = {2}",
                    CustomActionName,
                    response?.ResponseName,
                    response?.Results?.Count ?? 0);

                if (response?.Results != null)
                {
                    foreach (var kv in response.Results)
                    {
                        tracingService.Trace("  Response[{0}] = {1}", kv.Key, kv.Value);
                    }
                }

                tracingService.Trace("=== {0}.Execute END (success) ===", nameof(ShareAppOnRoleAssociatePlugin));
            }
            catch (InvalidPluginExecutionException ipex)
            {
                tracingService?.Trace("InvalidPluginExecutionException: {0}", ipex);
                throw;
            }
            catch (Exception ex)
            {
                tracingService?.Trace("Unhandled exception in {0}: {1}", nameof(ShareAppOnRoleAssociatePlugin), ex);
                throw new InvalidPluginExecutionException(
                    string.Format("An error occurred while invoking {0}: {1}", CustomActionName, ex.Message), ex);
            }
        }
    }
}
