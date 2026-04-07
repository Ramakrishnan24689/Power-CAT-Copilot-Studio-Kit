namespace POWERCAT.Plugins.PowerShield
{
    using System;
    using System.Collections.Generic;
    using System.Text;
    using Microsoft.Crm.Sdk.Messages;
    using Microsoft.Xrm.Sdk;
    using Microsoft.Xrm.Sdk.Query;

    /// <summary>
    /// Shared utilities for PowerShield notification plugins.
    /// Provides settings lookup, recipient resolution, email sending, and HTML template building.
    /// </summary>
    internal static class NotificationHelper
    {
        // ── Status constants (cat_status OptionSet values) ──────────────────
        internal const int StatusDraft = 1;
        internal const int StatusSubmitted = 2;
        internal const int StatusWithdrawn = 3;
        internal const int StatusAutoRejected = 4;
        internal const int StatusUnderReview = 5;
        internal const int StatusApproved = 6;
        internal const int StatusRejected = 7;
        internal const int StatusImplementing = 8;
        internal const int StatusImplemented = 9;
        internal const int StatusImplementedWithErrors = 10;

        // ── Setting keys (stored in cat_powershieldsettings.cat_settingkey) ─
        internal const string SettingSenderMailbox = "Notification.SenderMailbox";
        internal const string SettingAdminDL = "Notification.AdminDL";
        internal const string SettingEnabled = "Notification.Enabled";
        internal const string SettingAppUrl = "Notification.AppUrl";

        // ── Entity / attribute constants ────────────────────────────────────
        private const string SettingsEntity = "cat_powershieldsettings";
        private const string SettingsKeyColumn = "cat_settingkey";
        private const string SettingsValueColumn = "cat_settingvalue";
        private const string ParticipantEntity = "cat_policyrequestparticipant";
        private const string ParticipantUpnColumn = "cat_participantupn";
        private const string ParticipantRequestLookup = "cat_policyrequestid";

        // ── Email template constants ────────────────────────────────────────
        private const string HeaderBgColor = "#6b21c8";
        private const string FooterText = "This is an automated notification from PowerShield. Do not reply to this email.";

        // ─────────────────────────────────────────────────────────────────────
        // Settings
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Reads a setting value from cat_powershieldsettings by key.
        /// Returns the cat_settingvalue if found, otherwise null.
        /// </summary>
        internal static string GetSettingValue(
            IOrganizationService service,
            ITracingService trace,
            string settingKey)
        {
            var query = new QueryExpression(SettingsEntity)
            {
                ColumnSet = new ColumnSet(SettingsValueColumn),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression(SettingsKeyColumn, ConditionOperator.Equal, settingKey),
                        new ConditionExpression("statecode", ConditionOperator.Equal, 0),
                    },
                },
                TopCount = 1,
            };

            var result = service.RetrieveMultiple(query);
            if (result.Entities.Count == 0)
            {
                trace.Trace("GetSettingValue: setting '{0}' not found.", settingKey);
                return null;
            }

            var value = result.Entities[0].GetAttributeValue<string>(SettingsValueColumn);
            trace.Trace("GetSettingValue: '{0}' = '{1}'.", settingKey, value ?? "(null)");
            return value;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Recipient Resolution
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Returns a deduplicated list of email addresses: the maker (request creator)
        /// plus all participants on the request.
        /// </summary>
        internal static List<string> ResolveMakerAndParticipants(
            IOrganizationService service,
            ITracingService trace,
            Guid requestId,
            string makerUpn)
        {
            var emails = new List<string>();
            if (!string.IsNullOrWhiteSpace(makerUpn))
            {
                emails.Add(makerUpn);
            }

            var query = new QueryExpression(ParticipantEntity)
            {
                ColumnSet = new ColumnSet(ParticipantUpnColumn),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression(
                            ParticipantRequestLookup,
                            ConditionOperator.Equal,
                            requestId),
                    },
                },
                TopCount = 100,
            };

            var result = service.RetrieveMultiple(query);
            foreach (var entity in result.Entities)
            {
                var upn = entity.GetAttributeValue<string>(ParticipantUpnColumn);
                if (!string.IsNullOrWhiteSpace(upn) &&
                    !ContainsIgnoreCase(emails, upn))
                {
                    emails.Add(upn);
                }
            }

            trace.Trace("ResolveMakerAndParticipants: {0} recipient(s) for request {1}.",
                emails.Count, requestId);
            return emails;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Approver Resolution
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Resolves an AAD Object ID to a system user's full name.
        /// Returns "Unknown" if the user cannot be found.
        /// </summary>
        internal static string ResolveApproverName(
            IOrganizationService service,
            ITracingService trace,
            string aadObjectId)
        {
            if (string.IsNullOrWhiteSpace(aadObjectId))
            {
                trace.Trace("ResolveApproverName: AAD Object ID is empty.");
                return "Unknown";
            }

            var query = new QueryExpression("systemuser")
            {
                ColumnSet = new ColumnSet("fullname"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("azureactivedirectoryobjectid", ConditionOperator.Equal, aadObjectId),
                        new ConditionExpression("isdisabled", ConditionOperator.Equal, false),
                    },
                },
                TopCount = 1,
            };

            var result = service.RetrieveMultiple(query);
            if (result.Entities.Count > 0)
            {
                var fullName = result.Entities[0].GetAttributeValue<string>("fullname");
                if (!string.IsNullOrWhiteSpace(fullName))
                {
                    trace.Trace("ResolveApproverName: resolved '{0}' to '{1}'.", aadObjectId, fullName);
                    return fullName;
                }
            }

            trace.Trace("ResolveApproverName: could not resolve '{0}'.", aadObjectId);
            return "Unknown";
        }

        // ─────────────────────────────────────────────────────────────────────
        // Email Sending
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Creates an email activity record and sends it via SendEmailRequest.
        /// Uses the sender mailbox (queue or user) configured in settings.
        /// Never throws — logs errors to trace and returns silently.
        /// </summary>
        internal static void SendNotificationEmail(
            IOrganizationService service,
            ITracingService trace,
            string senderMailbox,
            List<string> recipientEmails,
            string subject,
            string htmlBody,
            Guid regardingRequestId)
        {
            try
            {
                if (recipientEmails == null || recipientEmails.Count == 0)
                {
                    trace.Trace("SendNotificationEmail: no recipients. Skipping.");
                    return;
                }

                var senderRef = ResolveSenderReference(service, trace, senderMailbox);
                if (senderRef == null)
                {
                    trace.Trace("SendNotificationEmail: could not resolve sender '{0}'. Skipping.", senderMailbox);
                    return;
                }

                var fromParty = new Entity("activityparty");
                fromParty["partyid"] = senderRef;

                var toParties = new EntityCollection();
                foreach (var email in recipientEmails)
                {
                    var toParty = new Entity("activityparty");
                    toParty["addressused"] = email;
                    toParties.Entities.Add(toParty);
                }

                var emailEntity = new Entity("email");
                emailEntity["from"] = new EntityCollection(new List<Entity> { fromParty });
                emailEntity["to"] = toParties;
                emailEntity["subject"] = subject;
                emailEntity["description"] = htmlBody;
                emailEntity["directioncode"] = true; // Outgoing
                emailEntity["regardingobjectid"] = new EntityReference("cat_policyrequest", regardingRequestId);

                var emailId = service.Create(emailEntity);
                trace.Trace("SendNotificationEmail: created email activity {0}.", emailId);

                var sendRequest = new SendEmailRequest
                {
                    EmailId = emailId,
                    IssueSend = true,
                    TrackingToken = string.Empty,
                };

                service.Execute(sendRequest);
                trace.Trace("SendNotificationEmail: email sent successfully to {0} recipient(s).",
                    recipientEmails.Count);
            }
            catch (Exception ex)
            {
                // CRITICAL: Never throw from notification — log and continue
                trace.Trace("SendNotificationEmail: FAILED — {0}", ex.ToString());
            }
        }

        /// <summary>
        /// Resolves the sender email to an EntityReference — tries queue first, then systemuser.
        /// Returns null if neither found.
        /// </summary>
        internal static EntityReference ResolveSenderReference(
            IOrganizationService service,
            ITracingService trace,
            string senderEmail)
        {
            // Try queue first (recommended for shared/service mailboxes)
            var queueQuery = new QueryExpression("queue")
            {
                ColumnSet = new ColumnSet("queueid"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("emailaddress", ConditionOperator.Equal, senderEmail),
                        new ConditionExpression("statecode", ConditionOperator.Equal, 0),
                    },
                },
                TopCount = 1,
            };

            var queueResult = service.RetrieveMultiple(queueQuery);
            if (queueResult.Entities.Count > 0)
            {
                trace.Trace("ResolveSenderReference: resolved '{0}' as queue.", senderEmail);
                return new EntityReference("queue", queueResult.Entities[0].Id);
            }

            // Fallback: try systemuser
            var userQuery = new QueryExpression("systemuser")
            {
                ColumnSet = new ColumnSet("systemuserid"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("internalemailaddress", ConditionOperator.Equal, senderEmail),
                        new ConditionExpression("isdisabled", ConditionOperator.Equal, false),
                    },
                },
                TopCount = 1,
            };

            var userResult = service.RetrieveMultiple(userQuery);
            if (userResult.Entities.Count > 0)
            {
                trace.Trace("ResolveSenderReference: resolved '{0}' as systemuser.", senderEmail);
                return new EntityReference("systemuser", userResult.Entities[0].Id);
            }

            trace.Trace("ResolveSenderReference: could not resolve '{0}' as queue or systemuser.", senderEmail);
            return null;
        }

        // ─────────────────────────────────────────────────────────────────────
        // Email HTML Builders
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>N1 — New Request Submitted (→ Admin DL).</summary>
        internal static string BuildSubmittedEmailHtml(
            string requestName, string makerUpn, string submittedDate, string deepLink)
        {
            var details = new StringBuilder();
            AppendDetailRow(details, "Request", requestName);
            AppendDetailRow(details, "Submitted by", makerUpn);
            AppendDetailRow(details, "Date", FormatDate(submittedDate));

            return BuildEmailHtml(
                statusText: "Submitted",
                statusBg: "#f0ebff",
                statusColor: "#6b21c8",
                mainMessage: $"A new policy request <strong>{Encode(requestName)}</strong> has been submitted and is awaiting review.",
                detailRows: details.ToString(),
                optionalBlock: null,
                deepLink: deepLink);
        }

        /// <summary>N2 — Request Approved (→ Maker + Participants).</summary>
        internal static string BuildApprovedEmailHtml(
            string requestName, string approverName, string decisionDate,
            string adminComment, string deepLink)
        {
            var details = new StringBuilder();
            AppendDetailRow(details, "Request", requestName);
            AppendDetailRow(details, "Approved by", approverName);
            AppendDetailRow(details, "Date", FormatDate(decisionDate));

            string commentBlock = null;
            if (!string.IsNullOrWhiteSpace(adminComment))
            {
                AppendDetailRow(details, "Admin Notes", adminComment);
            }

            return BuildEmailHtml(
                statusText: "Approved",
                statusBg: "#e6f7ed",
                statusColor: "#0f8f5e",
                mainMessage: $"Your policy request <strong>{Encode(requestName)}</strong> has been approved.",
                detailRows: details.ToString(),
                optionalBlock: commentBlock,
                deepLink: deepLink);
        }

        /// <summary>N3 — Request Rejected (→ Maker + Participants).</summary>
        internal static string BuildRejectedEmailHtml(
            string requestName, string approverName, string decisionDate,
            string adminComment, string deepLink)
        {
            var details = new StringBuilder();
            AppendDetailRow(details, "Request", requestName);
            AppendDetailRow(details, "Rejected by", approverName);
            AppendDetailRow(details, "Date", FormatDate(decisionDate));

            if (!string.IsNullOrWhiteSpace(adminComment))
            {
                AppendDetailRow(details, "Reason", adminComment);
            }

            return BuildEmailHtml(
                statusText: "Rejected",
                statusBg: "#fde8e8",
                statusColor: "#b91c1c",
                mainMessage: $"Your policy request <strong>{Encode(requestName)}</strong> has been rejected.",
                detailRows: details.ToString(),
                optionalBlock: null,
                deepLink: deepLink);
        }

        /// <summary>N4 — DLP Policy Created / Implemented (→ Maker + Participants).</summary>
        internal static string BuildCompletedEmailHtml(
            string requestName, string dlpPolicyName, string completedDate, string deepLink)
        {
            var details = new StringBuilder();
            AppendDetailRow(details, "Request", requestName);
            AppendDetailRow(details, "DLP Policy", dlpPolicyName ?? "N/A");
            AppendDetailRow(details, "Date", FormatDate(completedDate));

            return BuildEmailHtml(
                statusText: "Completed",
                statusBg: "#e6f7ed",
                statusColor: "#0f8f5e",
                mainMessage: $"The DLP policy for request <strong>{Encode(requestName)}</strong> has been successfully created.",
                detailRows: details.ToString(),
                optionalBlock: null,
                deepLink: deepLink);
        }

        /// <summary>N5 — Policy Creation Failed / ImplementedWithErrors (→ Maker + Participants + Admin DL).</summary>
        internal static string BuildFailedEmailHtml(
            string requestName, string errorSummary, string deepLink)
        {
            var details = new StringBuilder();
            AppendDetailRow(details, "Request", requestName);
            AppendDetailRow(details, "Error", errorSummary ?? "No error details available.");

            return BuildEmailHtml(
                statusText: "Policy Failed",
                statusBg: "#fde8e8",
                statusColor: "#b91c1c",
                mainMessage: $"The DLP policy creation for request <strong>{Encode(requestName)}</strong> encountered errors.",
                detailRows: details.ToString(),
                optionalBlock: null,
                deepLink: deepLink);
        }

        /// <summary>N6 — Request Auto-Rejected (→ Maker + Participants).</summary>
        internal static string BuildAutoRejectedEmailHtml(
            string requestName, string date, string deepLink)
        {
            var details = new StringBuilder();
            AppendDetailRow(details, "Request", requestName);
            AppendDetailRow(details, "Date", FormatDate(date));

            return BuildEmailHtml(
                statusText: "Auto-Rejected",
                statusBg: "#fde8e8",
                statusColor: "#b91c1c",
                mainMessage: $"Your policy request <strong>{Encode(requestName)}</strong> has been automatically rejected because it did not meet the eligibility criteria.",
                detailRows: details.ToString(),
                optionalBlock: null,
                deepLink: deepLink);
        }

        /// <summary>N7 — Request Withdrawn (→ Admin DL, only if previously Submitted or UnderReview).</summary>
        internal static string BuildWithdrawnEmailHtml(
            string requestName, string makerUpn, string previousStatus, string deepLink)
        {
            var details = new StringBuilder();
            AppendDetailRow(details, "Request", requestName);
            AppendDetailRow(details, "Withdrawn by", makerUpn);
            AppendDetailRow(details, "Previous Status", previousStatus);

            return BuildEmailHtml(
                statusText: "Withdrawn",
                statusBg: "#f0f0f4",
                statusColor: "#9090a0",
                mainMessage: $"Policy request <strong>{Encode(requestName)}</strong> has been withdrawn by the maker.",
                detailRows: details.ToString(),
                optionalBlock: null,
                deepLink: deepLink);
        }

        /// <summary>N8 — New Comment on a Policy Request.</summary>
        internal static string BuildCommentEmailHtml(
            string requestName, string commenterUpn, string commentPreview, string deepLink)
        {
            var details = new StringBuilder();
            AppendDetailRow(details, "Request", requestName);
            AppendDetailRow(details, "Comment by", commenterUpn);
            AppendDetailRow(details, "Comment", commentPreview);

            return BuildEmailHtml(
                statusText: "New Comment",
                statusBg: "#e8f0fe",
                statusColor: "#1a56db",
                mainMessage: $"A new comment has been posted on policy request <strong>{Encode(requestName)}</strong>.",
                detailRows: details.ToString(),
                optionalBlock: null,
                deepLink: deepLink);
        }

        // ─────────────────────────────────────────────────────────────────────
        // HTML Template Helpers
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>
        /// Builds the full email HTML using the consistent PowerShield email skeleton.
        /// </summary>
        private static string BuildEmailHtml(
            string statusText, string statusBg, string statusColor,
            string mainMessage, string detailRows,
            string optionalBlock, string deepLink)
        {
            var sb = new StringBuilder(2048);
            sb.Append("<!DOCTYPE html><html><head>");
            sb.Append("<meta charset=\"utf-8\">");
            sb.Append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">");
            sb.Append("</head>");
            sb.Append("<body style=\"margin:0;padding:0;font-family:'Segoe UI',Arial,sans-serif;background-color:#f4f4f6;\">");
            sb.Append("<table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" style=\"max-width:600px;margin:0 auto;background:#ffffff;\">");

            // Header bar
            sb.AppendFormat(
                "<tr><td style=\"background-color:{0};padding:20px 24px;\">" +
                "<span style=\"color:#ffffff;font-size:18px;font-weight:600;\">PowerShield</span>" +
                "</td></tr>",
                HeaderBgColor);

            // Status badge
            sb.AppendFormat(
                "<tr><td style=\"padding:24px 24px 0;\">" +
                "<span style=\"display:inline-block;padding:4px 12px;border-radius:12px;" +
                "background-color:{0};color:{1};font-size:13px;font-weight:600;\">{2}</span>" +
                "</td></tr>",
                statusBg, statusColor, Encode(statusText));

            // Main content
            sb.AppendFormat(
                "<tr><td style=\"padding:16px 24px;\">" +
                "<p style=\"font-size:15px;color:#1a1a2e;margin:0 0 16px;\">{0}</p>" +
                "<table style=\"width:100%;border-collapse:collapse;\">{1}</table>" +
                "</td></tr>",
                mainMessage, detailRows);

            // Optional block (e.g., admin comment)
            if (!string.IsNullOrWhiteSpace(optionalBlock))
            {
                sb.Append(optionalBlock);
            }

            // CTA button
            if (!string.IsNullOrWhiteSpace(deepLink))
            {
                sb.AppendFormat(
                    "<tr><td style=\"padding:8px 24px 24px;\">" +
                    "<a href=\"{0}\" style=\"display:inline-block;padding:10px 24px;" +
                    "background-color:{1};color:#ffffff;text-decoration:none;" +
                    "border-radius:4px;font-size:14px;font-weight:600;\">" +
                    "View Request in PowerShield &#x2192;</a>" +
                    "</td></tr>",
                    Encode(deepLink), HeaderBgColor);
            }

            // Footer
            sb.AppendFormat(
                "<tr><td style=\"padding:16px 24px;border-top:1px solid #e5e5ea;background-color:#f9f9fb;\">" +
                "<p style=\"font-size:11px;color:#9090a0;margin:0;\">{0}</p>" +
                "</td></tr>",
                FooterText);

            sb.Append("</table></body></html>");
            return sb.ToString();
        }

        /// <summary>Appends a label-value detail row to the email body.</summary>
        private static void AppendDetailRow(StringBuilder sb, string label, string value)
        {
            sb.AppendFormat(
                "<tr>" +
                "<td style=\"padding:6px 0;color:#6e6e80;font-size:13px;width:130px;vertical-align:top;\">{0}</td>" +
                "<td style=\"padding:6px 0;color:#1a1a2e;font-size:13px;\">{1}</td>" +
                "</tr>",
                Encode(label), Encode(value ?? string.Empty));
        }

        // ─────────────────────────────────────────────────────────────────────
        // Internal Utilities
        // ─────────────────────────────────────────────────────────────────────

        /// <summary>HTML-encodes a string to prevent injection in email bodies.</summary>
        private static string Encode(string value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;
            return value
                .Replace("&", "&amp;")
                .Replace("<", "&lt;")
                .Replace(">", "&gt;")
                .Replace("\"", "&quot;");
        }

        /// <summary>Formats an ISO datetime string to a user-friendly format, or returns "N/A" if empty.</summary>
        private static string FormatDate(string isoDate)
        {
            if (string.IsNullOrWhiteSpace(isoDate)) return "N/A";

            DateTime dt;
            if (DateTime.TryParse(isoDate, System.Globalization.CultureInfo.InvariantCulture,
                    System.Globalization.DateTimeStyles.None, out dt))
            {
                return dt.ToString("MMM dd, yyyy 'at' hh:mm tt", System.Globalization.CultureInfo.InvariantCulture);
            }

            return isoDate;
        }

        /// <summary>Case-insensitive contains check for a string list.</summary>
        internal static bool ContainsIgnoreCase(List<string> list, string value)
        {
            foreach (var item in list)
            {
                if (string.Equals(item, value, StringComparison.OrdinalIgnoreCase))
                    return true;
            }
            return false;
        }

        /// <summary>Removes a value from the list (case-insensitive). Used to prevent self-notification.</summary>
        internal static void RemoveIgnoreCase(List<string> list, string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            list.RemoveAll(item => string.Equals(item, value, StringComparison.OrdinalIgnoreCase));
        }
    }
}
