// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace POWERCAT.Plugins.ShareAppWithAdminUsers
{
    /// <summary>
    /// Fires when a security role is removed from a user or team.
    ///
    /// Plugin registration:
    ///   Message:           Disassociate
    ///   Primary entity:    (blank)
    ///   Secondary entity:  (blank)
    ///   Stage:             PostOperation
    ///   Mode:              Synchronous (or Async)
    ///
    /// Behavior:
    ///   - Listens to systemuserroles_association (user ↔ role)
    ///     and teamroles_association (team ↔ role).
    ///   - If at least one of the removed roles is in the AllowedRoleNames
    ///     list, calls the custom API cat_ShareAppWithAdminsandMakers with
    ///     cat_Operation = "Unshare". The downstream cloud flow then evaluates
    ///     whether the principal still has any allow-listed role; if not, it
    ///     removes the principal's permissions on the Admin / Maker apps.
    /// </summary>
    public sealed class RemoveAppShareOnRoleDisassociatePlugin : IPlugin
    {
        // Message this plugin is registered against.
        private const string MessageName = "Disassociate";

        // Operation value forwarded to the custom API. The same API also
        // handles "Share" (called by the Associate plugin).
        private const string OperationName = "Unshare";

        private const string UserRoleRelationshipName = "systemuserroles_association";
        private const string TeamRoleRelationshipName = "teamroles_association";
        private const string SystemUserLogicalName = "systemuser";
        private const string TeamLogicalName = "team";
        private const string RoleLogicalName = "role";

        private const string CustomActionName = "cat_ShareAppWithAdminsandMakers";
        private const string CustomActionOperationParameter = "cat_Operation";
        private const string CustomActionPrincipalTypeParameter = "cat_PrincipalType";
        private const string CustomActionAffectedRoleNamesParameter = "cat_AffectedRoleNames";
        private const string CustomActionUserIdParameter = "cat_SystemUserId";
        private const string CustomActionTeamIdParameter = "cat_TeamId";

        private const string PrincipalTypeUser = "User";
        private const string PrincipalTypeGroup = "Group";

        // Only role removals matching one of these names trigger unshare logic.
        // Comparison is case-insensitive.
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

            try
            {
                // Defensive: ensure the plugin is wired to the right message.
                if (!string.Equals(context.MessageName, MessageName, StringComparison.OrdinalIgnoreCase))
                    return;

                // The Disassociate message exposes the relationship being modified.
                var relationship = context.InputParameters.Contains("Relationship")
                    ? context.InputParameters["Relationship"] as Relationship
                    : null;
                if (relationship == null)
                    return;

                // Decide whether the role is being removed from a user or from a team.
                // expectedPrincipal = expected logical name of the Target entity.
                // principalType    = value forwarded to the custom API.
                string expectedPrincipal;
                string principalType;
                if (string.Equals(relationship.SchemaName, UserRoleRelationshipName, StringComparison.OrdinalIgnoreCase))
                {
                    expectedPrincipal = SystemUserLogicalName;
                    principalType = PrincipalTypeUser;
                }
                else if (string.Equals(relationship.SchemaName, TeamRoleRelationshipName, StringComparison.OrdinalIgnoreCase))
                {
                    expectedPrincipal = TeamLogicalName;
                    principalType = PrincipalTypeGroup;
                }
                else
                {
                    // Some other association we don't care about.
                    return;
                }

                // Target = the principal (user or team) the role is being removed from.
                var target = context.InputParameters.Contains("Target")
                    ? context.InputParameters["Target"] as EntityReference
                    : null;
                if (target == null ||
                    !string.Equals(target.LogicalName, expectedPrincipal, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                // RelatedEntities = the role(s) being removed from the target.
                var related = context.InputParameters.Contains("RelatedEntities")
                    ? context.InputParameters["RelatedEntities"] as EntityReferenceCollection
                    : null;
                if (related == null || related.Count == 0)
                    return;

                // Keep only role references.
                var roleIds = new List<Guid>();
                foreach (var er in related)
                {
                    if (string.Equals(er.LogicalName, RoleLogicalName, StringComparison.OrdinalIgnoreCase))
                        roleIds.Add(er.Id);
                }

                if (roleIds.Count == 0)
                    return;

                // Use the calling user's context so security trimming applies normally.
                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);

                // Look up role names and keep only those in the allow-list.
                // Note: Retrieve still works here because the role row itself isn't deleted —
                // only the link between the principal and the role is removed.
                var matchedRoleNames = new List<string>();
                foreach (var roleId in roleIds)
                {
                    var role = service.Retrieve(RoleLogicalName, roleId, new ColumnSet("name"));
                    var roleName = role.GetAttributeValue<string>("name");
                    if (!string.IsNullOrEmpty(roleName) && AllowedRoleNames.Contains(roleName))
                        matchedRoleNames.Add(roleName);
                }

                // Nothing to do unless at least one allow-listed role was removed.
                if (matchedRoleNames.Count == 0)
                    return;

                tracingService?.Trace(
                    "Invoking custom action '{0}' (operation='{1}') for {2} {3}.",
                    CustomActionName, OperationName, principalType, target.Id);

                // Build and execute the custom API request. The cloud flow bound
                // to this API performs the actual app un-sharing (after first
                // checking whether the principal still has any allow-listed role).
                //
                // Parameters (all prefixed with the publisher 'cat_'):
                //   cat_Operation         "Unshare"
                //   cat_PrincipalType     "User" or "Group"
                //   cat_AffectedRoleNames CSV of allow-listed roles that were just removed
                //   cat_SystemUserId      Target user id   (empty when principal is a team)
                //   cat_TeamId            Target team id   (empty when principal is a user)
                var request = new OrganizationRequest(CustomActionName);
                request[CustomActionOperationParameter] = OperationName;
                request[CustomActionPrincipalTypeParameter] = principalType;
                request[CustomActionAffectedRoleNamesParameter] = string.Join(",", matchedRoleNames);
                request[CustomActionUserIdParameter] = principalType == PrincipalTypeUser ? target.Id.ToString() : string.Empty;
                request[CustomActionTeamIdParameter] = principalType == PrincipalTypeGroup ? target.Id.ToString() : string.Empty;

                var response = service.Execute(request);

                tracingService?.Trace(
                    "'{0}' executed successfully. ResponseName='{1}'.",
                    CustomActionName,
                    response?.ResponseName);
            }
            catch (InvalidPluginExecutionException ipex)
            {
                tracingService?.Trace("InvalidPluginExecutionException: {0}", ipex);
                throw;
            }
            catch (Exception ex)
            {
                tracingService?.Trace("Unhandled exception in {0}: {1}", nameof(RemoveAppShareOnRoleDisassociatePlugin), ex);
                throw new InvalidPluginExecutionException(
                    string.Format("An error occurred while invoking {0}: {1}", CustomActionName, ex.Message), ex);
            }
        }
    }
}
