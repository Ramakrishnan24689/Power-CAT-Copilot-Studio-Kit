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

            try
            {
                if (!string.Equals(context.MessageName, AssociateMessage, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                var relationship = context.InputParameters.Contains("Relationship")
                    ? context.InputParameters["Relationship"] as Relationship
                    : null;

                if (relationship == null)
                {
                    return;
                }

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
                    return;
                }

                var targetPrincipal = context.InputParameters.Contains("Target")
                    ? context.InputParameters["Target"] as EntityReference
                    : null;

                if (targetPrincipal == null)
                {
                    return;
                }

                if (!string.Equals(targetPrincipal.LogicalName, expectedPrincipalLogicalName, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }

                var relatedEntities = context.InputParameters.Contains("RelatedEntities")
                    ? context.InputParameters["RelatedEntities"] as EntityReferenceCollection
                    : null;

                if (relatedEntities == null || relatedEntities.Count == 0)
                {
                    return;
                }

                var roleIds = new List<Guid>();
                for (int i = 0; i < relatedEntities.Count; i++)
                {
                    var er = relatedEntities[i];
                    if (string.Equals(er.LogicalName, RoleLogicalName, StringComparison.OrdinalIgnoreCase))
                        roleIds.Add(er.Id);
                }

                if (roleIds.Count == 0)
                {
                    return;
                }

                var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = serviceFactory.CreateOrganizationService(context.UserId);

                bool anyAllowed = false;
                foreach (var roleId in roleIds)
                {
                    var role = service.Retrieve(RoleLogicalName, roleId, new ColumnSet("name"));
                    var roleName = role.GetAttributeValue<string>("name");

                    if (!string.IsNullOrEmpty(roleName) && AllowedRoleNames.Contains(roleName))
                    {
                        anyAllowed = true;
                        break;
                    }
                }

                if (!anyAllowed)
                {
                    return;
                }

                tracingService.Trace(
                    "Invoking custom action '{0}' for {1} {2}.",
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

                var response = service.Execute(request);

                tracingService.Trace(
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
                tracingService?.Trace("Unhandled exception in {0}: {1}", nameof(ShareAppOnRoleAssociatePlugin), ex);
                throw new InvalidPluginExecutionException(
                    string.Format("An error occurred while invoking {0}: {1}", CustomActionName, ex.Message), ex);
            }
        }
    }
}
