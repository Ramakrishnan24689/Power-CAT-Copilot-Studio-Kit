using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace POWERCAT.Plugins.PowerShield
{
    /// <summary>
    /// Custom API plugin: cat_DeactivateStaleConnectors
    ///
    /// Called once by the "Sync flow | Connectors" cloud flow after the Apply_to_each
    /// loop completes. Receives the full set of connector keys observed in this sync
    /// run and sets cat_isactive = false on any cat_connector record whose key was
    /// not in that set.
    ///
    /// Registration:
    ///   Custom API — Unbound Action
    ///   Message:  cat_DeactivateStaleConnectors
    ///   Plugin:   PowerShield.Plugins.DeactivateStaleConnectorsAction
    ///
    /// Input Parameters:
    ///   ConnectorKeysJson (String) — JSON array of connector key strings observed
    ///                                in this sync run, e.g. ["shared_teams","shared_sharepointonline"].
    ///
    /// Output Parameters:
    ///   DeactivatedCount (Integer) — number of cat_connector records deactivated.
    /// </summary>
    public class DeactivateStaleConnectorsAction : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("DeactivateStaleConnectorsAction: Execute started.");

                var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = factory.CreateOrganizationService(null); // SYSTEM context

                // --- Read input parameter ---
                if (!context.InputParameters.ContainsKey("ConnectorKeysJson"))
                {
                    throw new InvalidPluginExecutionException(
                        "DeactivateStaleConnectorsAction: required input parameter 'ConnectorKeysJson' is missing.");
                }

                var keysJson = context.InputParameters["ConnectorKeysJson"] as string;

                if (string.IsNullOrWhiteSpace(keysJson))
                    throw new InvalidPluginExecutionException("DeactivateStaleConnectorsAction: 'ConnectorKeysJson' is empty.");

                // --- Parse incoming connector keys ---
                var incomingKeys = ParseKeysJson(keysJson, trace);
                trace.Trace("DeactivateStaleConnectorsAction: received {0} connector keys.", incomingKeys.Count);

                // --- Load all existing active connector records ---
                var existing = FetchActiveConnectors(service, trace);
                trace.Trace("DeactivateStaleConnectorsAction: found {0} active records in Dataverse.", existing.Count);

                // --- Deactivate any record whose key is absent from the incoming set ---
                var now = DateTime.UtcNow;
                var deactivatedCount = 0;

                foreach (var record in existing)
                {
                    var key = record.GetAttributeValue<string>("cat_connectorkey");

                    if (!string.IsNullOrEmpty(key) && !incomingKeys.Contains(key))
                    {
                        var update = new Entity("cat_connector", record.Id)
                        {
                            ["cat_isactive"]         = false,
                            ["cat_lastsyncdatetime"] = now,
                        };
                        service.Update(update);
                        deactivatedCount++;
                        trace.Trace("DeactivateStaleConnectorsAction: deactivated '{0}' ({1}).", key, record.Id);
                    }
                }

                context.OutputParameters["DeactivatedCount"] = deactivatedCount;
                trace.Trace("DeactivateStaleConnectorsAction: complete — deactivated={0}.", deactivatedCount);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("DeactivateStaleConnectorsAction: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"DeactivateStaleConnectorsAction failed: {ex.Message}", ex);
            }
        }

        // -----------------------------------------------------------------------
        // Dataverse query — paginated load of all active connectors
        // -----------------------------------------------------------------------

        private static List<Entity> FetchActiveConnectors(
            IOrganizationService service,
            ITracingService trace)
        {
            var results = new List<Entity>();
            var query = new QueryExpression("cat_connector")
            {
                ColumnSet = new ColumnSet("cat_connectorid", "cat_connectorkey"),
                Criteria = new FilterExpression(LogicalOperator.And),
                PageInfo = new PagingInfo { Count = 5000, PageNumber = 1, ReturnTotalRecordCount = false },
            };
            query.Criteria.AddCondition("cat_isactive", ConditionOperator.Equal, true);

            EntityCollection page;
            do
            {
                page = service.RetrieveMultiple(query);
                results.AddRange(page.Entities);
                query.PageInfo.PageNumber++;
                query.PageInfo.PagingCookie = page.PagingCookie;
            }
            while (page.MoreRecords);

            trace.Trace("DeactivateStaleConnectorsAction: fetched {0} active records across {1} page(s).",
                results.Count, query.PageInfo.PageNumber - 1);

            return results;
        }

        // -----------------------------------------------------------------------
        // JSON parsing — string array via DataContractJsonSerializer
        // -----------------------------------------------------------------------

        private static HashSet<string> ParseKeysJson(string json, ITracingService trace)
        {
            try
            {
                var serializer = new DataContractJsonSerializer(typeof(List<string>));

                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                {
                    var list = (List<string>)serializer.ReadObject(stream) ?? new List<string>();
                    return new HashSet<string>(list, StringComparer.OrdinalIgnoreCase);
                }
            }
            catch (Exception ex)
            {
                trace.Trace("DeactivateStaleConnectorsAction: JSON parse error — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"DeactivateStaleConnectorsAction: failed to parse 'ConnectorKeysJson': {ex.Message}", ex);
            }
        }
    }
}
