namespace POWERCAT.Plugins.PowerShield
{
    using System;
    using System.Collections.Generic;
    using Microsoft.Xrm.Sdk;

    /// <summary>
    /// Sends email notifications when a Policy Request's status changes.
    /// Covers 7 notification events (N1–N7) per the PowerShield notification spec.
    ///
    /// Registration:
    ///   Message: Update, Entity: cat_policyrequest,
    ///   Stage: 40 (Post-Operation), Mode: Asynchronous
    ///   Filtering Attributes: cat_status
    ///   Pre-Image: "preImagePR" (cat_status)
    ///   Post-Image: "postImagePR" (cat_status, cat_policyrequestname, cat_createdbyupn,
    ///       cat_admincomment, cat_dlppolicyname, cat_lasterrorsummary, cat_decidedon,
    ///       cat_approvedbyaadobjectid, cat_submittedon)
    /// </summary>
    public class PolicyRequestNotificationPlugin : IPlugin
    {
        private const string PreImageAlias = "preImagePR";
        private const string PostImageAlias = "postImagePR";
        private const string StatusAttribute = "cat_status";

        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("PolicyRequestNotificationPlugin: Execute started.");

                var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = factory.CreateOrganizationService(null); // SYSTEM context

                trace.Trace("Message: {0}, Entity: {1}, Stage: {2}, Depth: {3}.",
                    context.MessageName, context.PrimaryEntityName, context.Stage, context.Depth);

                // Extract Pre-Image and Post-Image
                if (!context.PreEntityImages.TryGetValue(PreImageAlias, out Entity preImage))
                {
                    trace.Trace("PolicyRequestNotificationPlugin: PreImage not found. Exiting.");
                    return;
                }

                if (!context.PostEntityImages.TryGetValue(PostImageAlias, out Entity postImage))
                {
                    trace.Trace("PolicyRequestNotificationPlugin: PostImage not found. Exiting.");
                    return;
                }

                var preStatusOsv = preImage.GetAttributeValue<OptionSetValue>(StatusAttribute);
                var postStatusOsv = postImage.GetAttributeValue<OptionSetValue>(StatusAttribute);

                if (preStatusOsv == null || postStatusOsv == null)
                {
                    trace.Trace("PolicyRequestNotificationPlugin: status OptionSetValue is null. Exiting.");
                    return;
                }

                int preStatus = preStatusOsv.Value;
                int postStatus = postStatusOsv.Value;

                trace.Trace("PolicyRequestNotificationPlugin: status changed from {0} to {1}.", preStatus, postStatus);

                if (preStatus == postStatus)
                {
                    trace.Trace("PolicyRequestNotificationPlugin: status unchanged. Exiting.");
                    return;
                }

                // ── Notification logic — wrapped in try/catch (never rethrow) ──
                try
                {
                    ProcessStatusChange(service, trace, context, preStatus, postStatus, postImage);
                }
                catch (Exception ex)
                {
                    // Notification failure must never block the status update
                    trace.Trace("PolicyRequestNotificationPlugin: notification failed (non-fatal) — {0}", ex.ToString());
                }

                trace.Trace("PolicyRequestNotificationPlugin: Execute completed successfully.");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("PolicyRequestNotificationPlugin: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"PolicyRequestNotificationPlugin failed: {ex.Message}", ex);
            }
        }

        /// <summary>
        /// Core notification dispatch — determines which event to fire and sends the email.
        /// </summary>
        private static void ProcessStatusChange(
            IOrganizationService service,
            ITracingService trace,
            IPluginExecutionContext context,
            int preStatus,
            int postStatus,
            Entity postImage)
        {
            // Read settings
            string senderMailbox = NotificationHelper.GetSettingValue(service, trace, NotificationHelper.SettingSenderMailbox);
            string adminDL = NotificationHelper.GetSettingValue(service, trace, NotificationHelper.SettingAdminDL);
            string enabledStr = NotificationHelper.GetSettingValue(service, trace, NotificationHelper.SettingEnabled);
            string appUrl = NotificationHelper.GetSettingValue(service, trace, NotificationHelper.SettingAppUrl);

            bool enabled = !string.Equals(enabledStr, "false", StringComparison.OrdinalIgnoreCase);
            if (!enabled)
            {
                trace.Trace("PolicyRequestNotificationPlugin: notifications disabled. Skipping.");
                return;
            }

            if (string.IsNullOrWhiteSpace(senderMailbox))
            {
                trace.Trace("PolicyRequestNotificationPlugin: sender mailbox not configured. Skipping.");
                return;
            }

            // Read request fields from PostImage
            string requestName = postImage.GetAttributeValue<string>("cat_policyrequestname");
            string makerUpn = postImage.GetAttributeValue<string>("cat_createdbyupn");
            string adminComment = postImage.GetAttributeValue<string>("cat_admincomment");
            string dlpPolicyName = postImage.GetAttributeValue<string>("cat_dlppolicyname");
            string errorSummary = postImage.GetAttributeValue<string>("cat_lasterrorsummary");
            string approverAadId = postImage.GetAttributeValue<string>("cat_approvedbyaadobjectid");
            Guid requestId = context.PrimaryEntityId;

            // Date fields
            var submittedOn = postImage.GetAttributeValue<DateTime?>("cat_submittedon");
            var decidedOn = postImage.GetAttributeValue<DateTime?>("cat_decidedon");
            string submittedDate = submittedOn.HasValue
                ? submittedOn.Value.ToString("o")
                : null;
            string decisionDate = decidedOn.HasValue
                ? decidedOn.Value.ToString("o")
                : null;

            // Build deep link
            string deepLink = !string.IsNullOrWhiteSpace(appUrl)
                ? $"{appUrl.TrimEnd('/')}#/requests/{requestId}"
                : null;

            trace.Trace("PolicyRequestNotificationPlugin: requestName='{0}', makerUpn='{1}', requestId='{2}'.",
                requestName, makerUpn, requestId);

            string subject;
            string body;
            List<string> recipients;

            switch (postStatus)
            {
                // ── N1: Submitted ────────────────────────────────────────
                case NotificationHelper.StatusSubmitted:
                    if (string.IsNullOrWhiteSpace(adminDL))
                    {
                        trace.Trace("PolicyRequestNotificationPlugin: N1 — Admin DL not configured. Skipping.");
                        return;
                    }

                    subject = $"[PowerShield] New Request Submitted — {requestName}";
                    body = NotificationHelper.BuildSubmittedEmailHtml(requestName, makerUpn, submittedDate, deepLink);
                    recipients = new List<string> { adminDL };
                    NotificationHelper.SendNotificationEmail(service, trace, senderMailbox, recipients, subject, body, requestId);
                    break;

                // ── N6: AutoRejected ─────────────────────────────────────
                case NotificationHelper.StatusAutoRejected:
                    subject = $"[PowerShield] Request Auto-Rejected — {requestName}";
                    body = NotificationHelper.BuildAutoRejectedEmailHtml(requestName, decisionDate, deepLink);
                    recipients = NotificationHelper.ResolveMakerAndParticipants(service, trace, requestId, makerUpn);
                    NotificationHelper.SendNotificationEmail(service, trace, senderMailbox, recipients, subject, body, requestId);
                    break;

                // ── N2: Approved ─────────────────────────────────────────
                case NotificationHelper.StatusApproved:
                    var approverNameApproved = NotificationHelper.ResolveApproverName(service, trace, approverAadId);
                    subject = $"[PowerShield] Request Approved — {requestName}";
                    body = NotificationHelper.BuildApprovedEmailHtml(requestName, approverNameApproved, decisionDate, adminComment, deepLink);
                    recipients = NotificationHelper.ResolveMakerAndParticipants(service, trace, requestId, makerUpn);
                    NotificationHelper.SendNotificationEmail(service, trace, senderMailbox, recipients, subject, body, requestId);
                    break;

                // ── N3: Rejected ─────────────────────────────────────────
                case NotificationHelper.StatusRejected:
                    var approverNameRejected = NotificationHelper.ResolveApproverName(service, trace, approverAadId);
                    subject = $"[PowerShield] Request Rejected — {requestName}";
                    body = NotificationHelper.BuildRejectedEmailHtml(requestName, approverNameRejected, decisionDate, adminComment, deepLink);
                    recipients = NotificationHelper.ResolveMakerAndParticipants(service, trace, requestId, makerUpn);
                    NotificationHelper.SendNotificationEmail(service, trace, senderMailbox, recipients, subject, body, requestId);
                    break;

                // ── N4: Implemented ──────────────────────────────────────
                case NotificationHelper.StatusImplemented:
                    subject = $"[PowerShield] DLP Policy Created — {requestName}";
                    body = NotificationHelper.BuildCompletedEmailHtml(requestName, dlpPolicyName, decisionDate, deepLink);
                    recipients = NotificationHelper.ResolveMakerAndParticipants(service, trace, requestId, makerUpn);
                    NotificationHelper.SendNotificationEmail(service, trace, senderMailbox, recipients, subject, body, requestId);
                    break;

                // ── N5: ImplementedWithErrors ────────────────────────────
                case NotificationHelper.StatusImplementedWithErrors:
                    subject = $"[PowerShield] Policy Creation Failed — {requestName}";
                    body = NotificationHelper.BuildFailedEmailHtml(requestName, errorSummary, deepLink);
                    recipients = NotificationHelper.ResolveMakerAndParticipants(service, trace, requestId, makerUpn);
                    // Also notify admin DL
                    if (!string.IsNullOrWhiteSpace(adminDL) &&
                        !NotificationHelper.ContainsIgnoreCase(recipients, adminDL))
                    {
                        recipients.Add(adminDL);
                    }
                    NotificationHelper.SendNotificationEmail(service, trace, senderMailbox, recipients, subject, body, requestId);
                    break;

                // ── N7: Withdrawn (conditional) ─────────────────────────
                case NotificationHelper.StatusWithdrawn:
                    if (preStatus == NotificationHelper.StatusSubmitted ||
                        preStatus == NotificationHelper.StatusUnderReview)
                    {
                        if (string.IsNullOrWhiteSpace(adminDL))
                        {
                            trace.Trace("PolicyRequestNotificationPlugin: N7 — Admin DL not configured. Skipping.");
                            return;
                        }

                        string previousStatusLabel = preStatus == NotificationHelper.StatusSubmitted
                            ? "Submitted"
                            : "Under Review";

                        subject = $"[PowerShield] Request Withdrawn — {requestName}";
                        body = NotificationHelper.BuildWithdrawnEmailHtml(requestName, makerUpn, previousStatusLabel, deepLink);
                        recipients = new List<string> { adminDL };
                        NotificationHelper.SendNotificationEmail(service, trace, senderMailbox, recipients, subject, body, requestId);
                    }
                    else
                    {
                        trace.Trace("PolicyRequestNotificationPlugin: Withdrawn from status {0} — no notification.", preStatus);
                    }
                    break;

                default:
                    trace.Trace("PolicyRequestNotificationPlugin: no notification for status {0}.", postStatus);
                    break;
            }
        }
    }
}
