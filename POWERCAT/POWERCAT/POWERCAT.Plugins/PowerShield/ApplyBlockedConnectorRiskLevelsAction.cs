using System;
using System.Collections.Generic;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace POWERCAT.Plugins.PowerShield
{
    /// <summary>
    /// Custom API plugin: cat_ApplyBlockedConnectorRiskLevels
    ///
    /// Called as the last action of the "Sync flow | Connectors" cloud flow.
    /// Reads all active cat_powershieldblockedconnectors records and applies
    /// two blocking rules:
    ///   1. cat_connectorkey   — blocks the specific connector whose key matches.
    ///   2. cat_publishername  — blocks ALL connectors whose cat_publisher matches.
    /// Each row uses one field or the other (mutually exclusive). Connector IDs
    /// collected from both rules are deduplicated before writing so no connector
    /// receives a redundant update. cat_risklevel = 4 (Blocked) is stamped on
    /// every matched connector.
    ///
    /// Stale-connector deactivation is handled by cat_DeactivateStaleConnectors
    /// (PowerShield.Plugins.DeactivateStaleConnectorsAction) — this action has
    /// no deactivation responsibility.
    ///
    /// Scope: Only SETS risk level to Blocked — does not clear risk levels when a
    /// connector is removed from the blocked list (out of scope v1).
    ///
    /// Registration:
    ///   Custom API — Unbound Action
    ///   Message:  cat_ApplyBlockedConnectorRiskLevels
    ///   Plugin:   PowerShield.Plugins.ApplyBlockedConnectorRiskLevelsAction
    ///
    /// Input Parameters:
    ///   (none)
    ///
    /// Output Parameters:
    ///   UpdatedCount (Integer) — number of distinct cat_connector records stamped with cat_risklevel = 4
    ///   SkippedCount (Integer) — number of blocked keys/publisher names with no matching cat_connector record
    /// </summary>
    public class ApplyBlockedConnectorRiskLevelsAction : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("ApplyBlockedConnectorRiskLevelsAction: Execute started.");

                var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = factory.CreateOrganizationService(null); // SYSTEM context

                // --- Step 1: Fetch all active blocked rules (connector keys + publisher names) ---
                var (blockedKeys, blockedPublisherNames) = FetchBlockedRules(service, trace);
                trace.Trace(
                    "ApplyBlockedConnectorRiskLevelsAction: found {0} distinct blocked key(s) and {1} distinct blocked publisher name(s).",
                    blockedKeys.Count, blockedPublisherNames.Count);

                if (blockedKeys.Count == 0 && blockedPublisherNames.Count == 0)
                {
                    trace.Trace("ApplyBlockedConnectorRiskLevelsAction: no active blocked rules found — exiting early.");
                    context.OutputParameters["UpdatedCount"] = 0;
                    context.OutputParameters["SkippedCount"] = 0;
                    return;
                }

                // --- Step 2: Fetch matching cat_connector records by key ---
                var connectorIdsToBlock = new HashSet<Guid>();
                var matchedKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                if (blockedKeys.Count > 0)
                {
                    var matchedByKey = FetchMatchedConnectors(service, blockedKeys, trace);
                    trace.Trace(
                        "ApplyBlockedConnectorRiskLevelsAction: {0} cat_connector record(s) matched by key.",
                        matchedByKey.Count);

                    foreach (var connector in matchedByKey)
                    {
                        connectorIdsToBlock.Add(connector.Id);
                        var key = connector.GetAttributeValue<string>("cat_connectorkey");
                        if (!string.IsNullOrEmpty(key))
                            matchedKeys.Add(key);
                    }
                }

                // --- Step 3: Fetch matching cat_connector records by publisher name ---
                var matchedPublisherNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

                if (blockedPublisherNames.Count > 0)
                {
                    var matchedByPublisher = FetchMatchedConnectorsByPublishers(service, blockedPublisherNames, trace);
                    trace.Trace(
                        "ApplyBlockedConnectorRiskLevelsAction: {0} cat_connector record(s) matched by publisher.",
                        matchedByPublisher.Count);

                    foreach (var connector in matchedByPublisher)
                    {
                        connectorIdsToBlock.Add(connector.Id); // HashSet deduplicates
                        var pub = connector.GetAttributeValue<string>("cat_publisher");
                        if (!string.IsNullOrEmpty(pub))
                            matchedPublisherNames.Add(pub);
                    }
                }

                trace.Trace(
                    "ApplyBlockedConnectorRiskLevelsAction: {0} distinct connector(s) to stamp as Blocked.",
                    connectorIdsToBlock.Count);

                // --- Step 4: Stamp cat_risklevel = 4 (Blocked) on each unique connector ---
                int updatedCount = 0;
                foreach (var connectorId in connectorIdsToBlock)
                {
                    var update = new Entity("cat_connector", connectorId)
                    {
                        ["cat_risklevel"] = new OptionSetValue(4),
                    };
                    service.Update(update);
                    updatedCount++;
                    trace.Trace(
                        "ApplyBlockedConnectorRiskLevelsAction: set cat_risklevel=4 on connector ({0}).",
                        connectorId);
                }

                // --- Step 5: Count rules that had no matching cat_connector record ---
                int skippedCount = 0;
                foreach (var key in blockedKeys)
                {
                    if (!matchedKeys.Contains(key))
                    {
                        skippedCount++;
                        trace.Trace("ApplyBlockedConnectorRiskLevelsAction: no cat_connector record found for blocked key '{0}'.", key);
                    }
                }
                foreach (var pub in blockedPublisherNames)
                {
                    if (!matchedPublisherNames.Contains(pub))
                    {
                        skippedCount++;
                        trace.Trace("ApplyBlockedConnectorRiskLevelsAction: no cat_connector record found for blocked publisher '{0}'.", pub);
                    }
                }

                // --- Step 6: Set output parameters ---
                context.OutputParameters["UpdatedCount"] = updatedCount;
                context.OutputParameters["SkippedCount"] = skippedCount;

                trace.Trace(
                    "ApplyBlockedConnectorRiskLevelsAction: complete — updated={0}, skipped={1}.",
                    updatedCount, skippedCount);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("ApplyBlockedConnectorRiskLevelsAction: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"ApplyBlockedConnectorRiskLevelsAction failed: {ex.Message}", ex);
            }
        }

        // -----------------------------------------------------------------------
        // Fetch all active cat_powershieldblockedconnectors records and return
        // two deduplicated sets (case-insensitive):
        //   ConnectorKeys    — rows where cat_connectorkey is populated
        //   PublisherNames   — rows where cat_publishername is populated
        // Rows are mutually exclusive (admin fills one field or the other).
        // -----------------------------------------------------------------------

        private static (HashSet<string> ConnectorKeys, HashSet<string> PublisherNames) FetchBlockedRules(
            IOrganizationService service,
            ITracingService trace)
        {
            var keys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var publishers = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            var query = new QueryExpression("cat_powershieldblockedconnectors")
            {
                ColumnSet = new ColumnSet("cat_connectorkey", "cat_publishername"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("statecode", ConditionOperator.Equal, 0),
                    }
                },
                PageInfo = new PagingInfo { Count = 5000, PageNumber = 1, ReturnTotalRecordCount = false },
            };

            EntityCollection page;
            do
            {
                page = service.RetrieveMultiple(query);
                foreach (var record in page.Entities)
                {
                    var key = record.GetAttributeValue<string>("cat_connectorkey");
                    if (!string.IsNullOrEmpty(key))
                        keys.Add(key);

                    var pub = record.GetAttributeValue<string>("cat_publishername");
                    if (!string.IsNullOrEmpty(pub))
                        publishers.Add(pub);
                }
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            while (page.MoreRecords);

            trace.Trace(
                "ApplyBlockedConnectorRiskLevelsAction: fetched blocked rules across {0} page(s).",
                query.PageInfo.PageNumber - 1);

            return (keys, publishers);
        }

        // -----------------------------------------------------------------------
        // Fetch cat_connector records whose cat_connectorkey is in the blocked set.
        // -----------------------------------------------------------------------

        private static List<Entity> FetchMatchedConnectors(
            IOrganizationService service,
            HashSet<string> blockedKeys,
            ITracingService trace)
        {
            var results = new List<Entity>();

            var query = new QueryExpression("cat_connector")
            {
                ColumnSet = new ColumnSet("cat_connectorid", "cat_connectorkey"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("cat_connectorkey", ConditionOperator.In, (object[])new List<string>(blockedKeys).ToArray()),
                    }
                },
                PageInfo = new PagingInfo { Count = 5000, PageNumber = 1, ReturnTotalRecordCount = false },
            };

            EntityCollection page;
            do
            {
                page = service.RetrieveMultiple(query);
                results.AddRange(page.Entities);
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            while (page.MoreRecords);

            trace.Trace(
                "ApplyBlockedConnectorRiskLevelsAction: fetched {0} matching connector(s) by key across {1} page(s).",
                results.Count, query.PageInfo.PageNumber - 1);

            return results;
        }

        // -----------------------------------------------------------------------
        // Fetch cat_connector records whose cat_publisher is in the blocked
        // publisher names set. Returns cat_connectorid and cat_publisher columns.
        // -----------------------------------------------------------------------

        private static List<Entity> FetchMatchedConnectorsByPublishers(
            IOrganizationService service,
            HashSet<string> publisherNames,
            ITracingService trace)
        {
            var results = new List<Entity>();

            var query = new QueryExpression("cat_connector")
            {
                ColumnSet = new ColumnSet("cat_connectorid", "cat_publisher"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("cat_publisher", ConditionOperator.In, (object[])new List<string>(publisherNames).ToArray()),
                    }
                },
                PageInfo = new PagingInfo { Count = 5000, PageNumber = 1, ReturnTotalRecordCount = false },
            };

            EntityCollection page;
            do
            {
                page = service.RetrieveMultiple(query);
                results.AddRange(page.Entities);
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            while (page.MoreRecords);

            trace.Trace(
                "ApplyBlockedConnectorRiskLevelsAction: fetched {0} matching connector(s) by publisher across {1} page(s).",
                results.Count, query.PageInfo.PageNumber - 1);

            return results;
        }
    }
}
