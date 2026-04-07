using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace POWERCAT.Plugins.PowerShield
{
    /// <summary>
    /// Maintains cat_powershieldservicetreemembers in sync with the cat_membersinfo
    /// JSON column on cat_servicetree.
    ///
    /// cat_membersinfo holds the canonical member list as a JSON array:
    ///   [{ "dvUserId": "&lt;systemuser GUID&gt;", "displayName": "...", "upn": "...", "aadObjectId": "..." }]
    ///
    /// The code app writes cat_membersinfo on every create/edit; this plugin translates
    /// that JSON into cat_powershieldservicetreemembers child records atomically.
    /// Because the plugin runs synchronously in the same transaction, any failure rolls
    /// back the parent cat_servicetree create or update as well.
    ///
    /// Registration (2 steps):
    ///   Step 1 — Message: Create, Entity: cat_servicetree,
    ///            Stage: 40 (Post-Operation), Mode: Asynchronous, No images
    ///
    ///   Step 2 — Message: Update, Entity: cat_servicetree,
    ///            Stage: 40 (Post-Operation), Mode: Asynchronous, No images
    ///            Filtering Attributes: cat_membersinfo
    ///
    /// Note: Both steps must be Asynchronous. A synchronous Post-Create plugin
    /// fails with 0x80040217 ("Entity Does Not Exist") when creating child records
    /// that reference the newly-created cat_servicetree, because the record is not
    /// yet visible across all Dataverse read paths within the uncommitted transaction.
    /// Async execution runs after commit, guaranteeing the parent is fully resolvable.
    /// </summary>
    public class ServiceTreeMembersSyncPlugin : IPlugin
    {
        private const string MembersInfoAttribute = "cat_membersinfo";
        private const string MemberEntity         = "cat_powershieldservicetreemembers";
        private const string ServiceTreeEntity    = "cat_servicetree";
        private const string MemberLookup         = "cat_member";
        private const string ServiceTreeLookup    = "cat_servicetree";
        private const string NameAttribute        = "cat_name";

        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("ServiceTreeMembersSyncPlugin: Execute started.");

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
                    case "Update":
                        HandleUpdate(context, service, trace);
                        break;
                    default:
                        throw new InvalidPluginExecutionException(
                            $"ServiceTreeMembersSyncPlugin: unexpected message '{context.MessageName}'.");
                }

                trace.Trace("ServiceTreeMembersSyncPlugin: Execute completed successfully.");
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("ServiceTreeMembersSyncPlugin: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"ServiceTreeMembersSyncPlugin failed: {ex.Message}", ex);
            }
        }

        // -----------------------------------------------------------------------
        // Create handler — reads cat_membersinfo from Target and creates members
        // -----------------------------------------------------------------------

        private static void HandleCreate(
            IPluginExecutionContext context,
            IOrganizationService service,
            ITracingService trace)
        {
            var target = (Entity)context.InputParameters["Target"];

            var membersInfoJson = target.GetAttributeValue<string>(MembersInfoAttribute);
            if (string.IsNullOrWhiteSpace(membersInfoJson))
            {
                trace.Trace("HandleCreate: cat_membersinfo is absent or empty. Skipping.");
                return;
            }

            var members = ParseMembersJson(membersInfoJson, trace);
            trace.Trace("HandleCreate: parsed {0} member(s) from cat_membersinfo.", members.Count);

            CreateMemberRecords(service, trace, context.PrimaryEntityId, members);
            trace.Trace("HandleCreate: created {0} member record(s) for service tree {1}.",
                members.Count, context.PrimaryEntityId);
        }

        // -----------------------------------------------------------------------
        // Update handler — delete-all + re-create from cat_membersinfo
        // -----------------------------------------------------------------------

        private static void HandleUpdate(
            IPluginExecutionContext context,
            IOrganizationService service,
            ITracingService trace)
        {
            var target = (Entity)context.InputParameters["Target"];

            // Defensive: filtering attribute registration should guarantee this, but guard anyway.
            if (!target.Contains(MembersInfoAttribute))
            {
                trace.Trace("HandleUpdate: cat_membersinfo not in Target attributes. Skipping.");
                return;
            }

            var membersInfoJson = target.GetAttributeValue<string>(MembersInfoAttribute);
            if (string.IsNullOrWhiteSpace(membersInfoJson))
            {
                trace.Trace("HandleUpdate: cat_membersinfo is empty. Skipping.");
                return;
            }

            var members = ParseMembersJson(membersInfoJson, trace);
            trace.Trace("HandleUpdate: parsed {0} member(s) from cat_membersinfo.", members.Count);

            // Delete all existing member records for this service tree.
            var existingIds = FetchExistingMemberIds(service, trace, context.PrimaryEntityId);
            trace.Trace("HandleUpdate: deleting {0} existing member record(s).", existingIds.Count);
            foreach (var memberId in existingIds)
            {
                service.Delete(MemberEntity, memberId);
            }

            // Re-create from the updated JSON.
            CreateMemberRecords(service, trace, context.PrimaryEntityId, members);
            trace.Trace("HandleUpdate: created {0} member record(s) for service tree {1}.",
                members.Count, context.PrimaryEntityId);
        }

        // -----------------------------------------------------------------------
        // Shared: create cat_powershieldservicetreemembers records from DTO list
        // -----------------------------------------------------------------------

        private static void CreateMemberRecords(
            IOrganizationService service,
            ITracingService trace,
            Guid serviceTreeId,
            List<ServiceTreeMemberDto> members)
        {
            for (int i = 0; i < members.Count; i++)
            {
                var member = members[i];

                if (string.IsNullOrWhiteSpace(member.DvUserId))
                {
                    throw new InvalidPluginExecutionException(
                        $"ServiceTreeMembersSyncPlugin: member at index {i} has a missing or empty dvUserId.");
                }

                if (!Guid.TryParse(member.DvUserId, out Guid userGuid))
                {
                    throw new InvalidPluginExecutionException(
                        $"ServiceTreeMembersSyncPlugin: member at index {i} has an invalid dvUserId '{member.DvUserId}'.");
                }

                var entity = new Entity(MemberEntity)
                {
                    [NameAttribute]      = member.DisplayName ?? string.Empty,
                    [MemberLookup]       = new EntityReference("systemuser", userGuid),
                    [ServiceTreeLookup]  = new EntityReference(ServiceTreeEntity, serviceTreeId),
                };

                service.Create(entity);
                trace.Trace("CreateMemberRecords: created member record for user {0} ('{1}') on tree {2}.",
                    userGuid, member.DisplayName ?? "(no name)", serviceTreeId);
            }
        }

        // -----------------------------------------------------------------------
        // Query existing member record IDs for a service tree (for replace-all)
        // -----------------------------------------------------------------------

        private static List<Guid> FetchExistingMemberIds(
            IOrganizationService service,
            ITracingService trace,
            Guid serviceTreeId)
        {
            var query = new QueryExpression(MemberEntity)
            {
                ColumnSet = new ColumnSet("cat_powershieldservicetreemembersid"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression(
                            ServiceTreeLookup,
                            ConditionOperator.Equal,
                            serviceTreeId),
                    },
                },
                PageInfo = new PagingInfo
                {
                    Count = 5000,
                    PageNumber = 1,
                    ReturnTotalRecordCount = false,
                },
            };

            var ids = new List<Guid>();
            EntityCollection page;
            do
            {
                page = service.RetrieveMultiple(query);
                foreach (var e in page.Entities)
                    ids.Add(e.Id);
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            while (page.MoreRecords);

            trace.Trace("FetchExistingMemberIds: found {0} existing member record(s) for tree {1}.",
                ids.Count, serviceTreeId);
            return ids;
        }

        // -----------------------------------------------------------------------
        // JSON deserialization — DataContractJsonSerializer pattern (consistent
        // with DeactivateStaleConnectorsAction and UpsertConnectorsAction)
        // -----------------------------------------------------------------------

        private static List<ServiceTreeMemberDto> ParseMembersJson(string json, ITracingService trace)
        {
            try
            {
                var serializer = new DataContractJsonSerializer(typeof(List<ServiceTreeMemberDto>));
                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                {
                    var list = (List<ServiceTreeMemberDto>)serializer.ReadObject(stream)
                               ?? new List<ServiceTreeMemberDto>();
                    return list;
                }
            }
            catch (Exception ex)
            {
                trace.Trace("ServiceTreeMembersSyncPlugin: JSON parse error — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"ServiceTreeMembersSyncPlugin: failed to parse cat_membersinfo JSON: {ex.Message}", ex);
            }
        }

        // -----------------------------------------------------------------------
        // DTO — mirrors the ServiceTreeMemberEntry TypeScript interface
        // -----------------------------------------------------------------------

        [DataContract]
        internal class ServiceTreeMemberDto
        {
            [DataMember(Name = "dvUserId")]
            public string DvUserId { get; set; }

            [DataMember(Name = "displayName")]
            public string DisplayName { get; set; }

            [DataMember(Name = "upn")]
            public string Upn { get; set; }

            [DataMember(Name = "aadObjectId")]
            public string AadObjectId { get; set; }
        }
    }
}
