namespace POWERCAT.Plugins.PowerShield
{
    using System;
    using System.Collections.Generic;
    using Microsoft.Xrm.Sdk;
    using Microsoft.Xrm.Sdk.Query;

    /// <summary>
    /// Sends email notifications when a new comment is posted on a Policy Request.
    /// Notification direction depends on the commenter's role:
    ///   - If commenter is Maker  → notify Admin DL
    ///   - If commenter is Admin  → notify Maker + Participants (minus the commenter)
    ///
    /// Registration:
    ///   Message: Create, Entity: cat_powershieldpolicyrequestcomment,
    ///   Stage: 40 (Post-Operation), Mode: Asynchronous
    ///   Pre-Image: (none — Create message)
    ///   Post-Image: (none — read from Target)
    /// </summary>
    public class CommentNotificationPlugin : IPlugin
    {
        private const string CommentEntity = "cat_powershieldpolicyrequestcomment";
        private const string CommentBodyColumn = "cat_commentbody";
        private const string AuthorUpnColumn = "cat_authorupn";
        private const string AuthorRoleColumn = "cat_authorrole";
        private const string ParentRequestLookup = "cat_policyrequest";
        private const string RequestEntity = "cat_policyrequest";
        private const string RequestNameColumn = "cat_policyrequestname";
        private const string MakerUpnColumn = "cat_createdbyupn";
        private const int CommentPreviewMaxLength = 500;

        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("CommentNotificationPlugin: Execute started.");

                var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = factory.CreateOrganizationService(null); // SYSTEM context

                trace.Trace("Message: {0}, Entity: {1}, Stage: {2}, Depth: {3}.",
                    context.MessageName, context.PrimaryEntityName, context.Stage, context.Depth);

                // Extract Target entity
                if (!context.InputParameters.Contains("Target") ||
                    !(context.InputParameters["Target"] is Entity target))
                {
                    trace.Trace("CommentNotificationPlugin: Target not found. Exiting.");
                    return;
                }

                // Read comment fields from Target
                string commentBody = target.GetAttributeValue<string>(CommentBodyColumn);
                string authorUpn = target.GetAttributeValue<string>(AuthorUpnColumn);
                string authorRole = target.GetAttributeValue<string>(AuthorRoleColumn);
                var parentRequestRef = target.GetAttributeValue<EntityReference>(ParentRequestLookup);

                if (parentRequestRef == null)
                {
                    trace.Trace("CommentNotificationPlugin: parent request lookup is null. Exiting.");
                    return;
                }

                Guid requestId = parentRequestRef.Id;
                trace.Trace("CommentNotificationPlugin: authorUpn='{0}', authorRole='{1}', requestId='{2}'.",
                    authorUpn, authorRole, requestId);

                // ── Notification logic — wrapped in try/catch (never rethrow) ──
                try
                {
                    ProcessComment(service, trace, requestId, commentBody, authorUpn, authorRole);
                }
                catch (Exception ex)
                {
                    // Notification failure must never block the comment creation
                    trace.Trace("CommentNotificationPlugin: notification failed (non-fatal) — {0}", ex.ToString());
                }

                trace.Trace("CommentNotificationPlugin: Execute completed successfully.");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("CommentNotificationPlugin: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"CommentNotificationPlugin failed: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Core notification logic for comment creation (N8).
        /// </summary>
        private static void ProcessComment(
            IOrganizationService service,
            ITracingService trace,
            Guid requestId,
            string commentBody,
            string authorUpn,
            string authorRole)
        {
            // Read settings
            string senderMailbox = NotificationHelper.GetSettingValue(service, trace, NotificationHelper.SettingSenderMailbox);
            string adminDL = NotificationHelper.GetSettingValue(service, trace, NotificationHelper.SettingAdminDL);
            string enabledStr = NotificationHelper.GetSettingValue(service, trace, NotificationHelper.SettingEnabled);
            string appUrl = NotificationHelper.GetSettingValue(service, trace, NotificationHelper.SettingAppUrl);

            bool enabled = !string.Equals(enabledStr, "false", StringComparison.OrdinalIgnoreCase);
            if (!enabled)
            {
                trace.Trace("CommentNotificationPlugin: notifications disabled. Skipping.");
                return;
            }

            if (string.IsNullOrWhiteSpace(senderMailbox))
            {
                trace.Trace("CommentNotificationPlugin: sender mailbox not configured. Skipping.");
                return;
            }

            // Retrieve parent request for name and maker UPN
            var request = service.Retrieve(RequestEntity, requestId,
                new ColumnSet(RequestNameColumn, MakerUpnColumn));

            string requestName = request.GetAttributeValue<string>(RequestNameColumn);
            string makerUpn = request.GetAttributeValue<string>(MakerUpnColumn);

            trace.Trace("CommentNotificationPlugin: requestName='{0}', makerUpn='{1}'.", requestName, makerUpn);

            // Build deep link
            string deepLink = !string.IsNullOrWhiteSpace(appUrl)
                ? $"{appUrl.TrimEnd('/')}#/requests/{requestId}"
                : null;

            // Comment preview (first 500 chars)
            string commentPreview = string.IsNullOrWhiteSpace(commentBody)
                ? "(empty comment)"
                : commentBody.Length > CommentPreviewMaxLength
                    ? commentBody.Substring(0, CommentPreviewMaxLength) + "…"
                    : commentBody;

            // Determine notification direction using cat_authorrole
            List<string> recipients;
            bool isMaker = string.Equals(authorRole, "Maker", StringComparison.OrdinalIgnoreCase);

            if (isMaker)
            {
                // Commenter is the Maker → notify Admin DL
                trace.Trace("CommentNotificationPlugin: commenter is Maker → notifying Admin DL.");
                if (string.IsNullOrWhiteSpace(adminDL))
                {
                    trace.Trace("CommentNotificationPlugin: Admin DL not configured. Skipping.");
                    return;
                }
                recipients = new List<string> { adminDL };
            }
            else
            {
                // Commenter is Admin (or other) → notify Maker + Participants, minus commenter
                trace.Trace("CommentNotificationPlugin: commenter is Admin → notifying Maker + Participants.");
                recipients = NotificationHelper.ResolveMakerAndParticipants(service, trace, requestId, makerUpn);

                // Remove the commenter from recipients (don't notify yourself)
                if (!string.IsNullOrWhiteSpace(authorUpn))
                {
                    NotificationHelper.RemoveIgnoreCase(recipients, authorUpn);
                }
            }

            // Build and send email
            string subject = $"[PowerShield] New Comment on {requestName}";
            string body = NotificationHelper.BuildCommentEmailHtml(requestName, authorUpn ?? "Unknown", commentPreview, deepLink);

            NotificationHelper.SendNotificationEmail(service, trace, senderMailbox, recipients, subject, body, requestId);
        }
    }
}
