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
    /// Custom API plugin: cat_UpsertConnectorActions
    ///
    /// Called by the "Sync flow | Connector Actions" cloud flow once per connector.
    /// Parses the JSON array of connector actions returned by the Flow API, then
    /// creates, updates, or deactivates cat_connectoractions records in Dataverse.
    ///
    /// Registration:
    ///   Custom API — Unbound Action
    ///   Message:  cat_UpsertConnectorActions
    ///   Plugin:   PowerShield.Plugins.UpsertConnectorActionsAction
    ///
    /// Input Parameters:
    ///   ConnectorId          (String) — GUID of the cat_connector record
    ///   ConnectorActionsJson (String) — JSON array of connector actions from the Flow API
    ///
    /// Output Parameters:
    ///   CreatedCount     (Integer) — number of new cat_connectoractions records created
    ///   UpdatedCount     (Integer) — number of existing records updated
    ///   DeactivatedCount (Integer) — number of stale records deactivated (cat_isactive=false)
    /// </summary>
    public class UpsertConnectorActionsAction : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("UpsertConnectorActionsAction: Execute started.");

                var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = factory.CreateOrganizationService(null); // SYSTEM context

                // --- Read input parameters ---
                if (!context.InputParameters.ContainsKey("ConnectorId") ||
                    !context.InputParameters.ContainsKey("ConnectorActionsJson"))
                {
                    throw new InvalidPluginExecutionException(
                        "UpsertConnectorActionsAction: required input parameters 'ConnectorId' and 'ConnectorActionsJson' are missing.");
                }

                var connectorIdStr = context.InputParameters["ConnectorId"] as string;
                var actionsJson = context.InputParameters["ConnectorActionsJson"] as string;

                if (string.IsNullOrWhiteSpace(connectorIdStr))
                    throw new InvalidPluginExecutionException("UpsertConnectorActionsAction: 'ConnectorId' is empty.");

                if (string.IsNullOrWhiteSpace(actionsJson))
                    throw new InvalidPluginExecutionException("UpsertConnectorActionsAction: 'ConnectorActionsJson' is empty.");

                if (!Guid.TryParse(connectorIdStr, out Guid connectorId))
                    throw new InvalidPluginExecutionException(
                        $"UpsertConnectorActionsAction: 'ConnectorId' is not a valid GUID: '{connectorIdStr}'.");

                trace.Trace("UpsertConnectorActionsAction: ConnectorId = {0}.", connectorId);

                // --- Parse incoming actions ---
                var incomingActions = ParseActionsJson(actionsJson, trace);
                trace.Trace("UpsertConnectorActionsAction: parsed {0} actions from JSON.", incomingActions.Count);

                // --- Load existing cat_connectoractions for this connector ---
                var existingActions = FetchExistingActions(service, connectorId, trace);
                trace.Trace("UpsertConnectorActionsAction: found {0} existing records in Dataverse.", existingActions.Count);

                // Build a lookup: actionKey → (recordId, isActive)
                var existingByKey = new Dictionary<string, ExistingAction>(StringComparer.OrdinalIgnoreCase);
                foreach (var rec in existingActions)
                {
                    var key = rec.GetAttributeValue<string>("cat_actionkey");
                    if (!string.IsNullOrEmpty(key))
                    {
                        existingByKey[key] = new ExistingAction
                        {
                            RecordId = rec.Id,
                            IsActive = rec.GetAttributeValue<bool>("cat_isactive"),
                        };
                    }
                }

                // Build set of keys coming from the API
                var incomingKeys = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                foreach (var action in incomingActions)
                {
                    if (!string.IsNullOrEmpty(action.Name))
                        incomingKeys.Add(action.Name);
                }

                var connectorRef = new EntityReference("cat_connector", connectorId);
                var now = DateTime.UtcNow;
                int createdCount = 0, updatedCount = 0, deactivatedCount = 0;

                // --- Create or update ---
                foreach (var action in incomingActions)
                {
                    if (string.IsNullOrEmpty(action.Name))
                    {
                        trace.Trace("UpsertConnectorActionsAction: skipping action with empty name.");
                        continue;
                    }

                    var summary = action.Properties?.Summary ?? string.Empty;
                    var description = action.Properties?.Description ?? string.Empty;
                    if (description.Length > 2000)
                        description = description.Substring(0, 2000);

                    if (existingByKey.TryGetValue(action.Name, out ExistingAction existing))
                    {
                        // Update existing record
                        var update = new Entity("cat_connectoraction", existing.RecordId)
                        {
                            ["cat_actionkey"]           = action.Name,
                            ["cat_actionname"]          = summary,
                            ["cat_connectoractionname"] = summary,
                            ["cat_actiondescription"]   = description,
                            ["cat_connectorid"]         = connectorRef,
                            ["cat_isactive"]            = true,
                            ["cat_actionstatus"]        = new OptionSetValue(1),
                            ["cat_lastsyncdatetime"]    = now,
                        };
                        service.Update(update);
                        updatedCount++;
                        trace.Trace("UpsertConnectorActionsAction: updated action '{0}' ({1}).", action.Name, existing.RecordId);
                    }
                    else
                    {
                        // Create new record
                        var create = new Entity("cat_connectoraction")
                        {
                            ["cat_actionkey"]           = action.Name,
                            ["cat_actionname"]          = summary,
                            ["cat_connectoractionname"] = summary,
                            ["cat_actiondescription"]   = description,
                            ["cat_connectorid"]         = connectorRef,
                            ["cat_isactive"]            = true,
                            ["cat_actionstatus"]        = new OptionSetValue(1),
                            ["cat_lastsyncdatetime"]    = now,
                        };
                        service.Create(create);
                        createdCount++;
                        trace.Trace("UpsertConnectorActionsAction: created action '{0}'.", action.Name);
                    }
                }

                // --- Deactivate stale actions ---
                foreach (var kvp in existingByKey)
                {
                    if (!incomingKeys.Contains(kvp.Key) && kvp.Value.IsActive)
                    {
                        var deactivate = new Entity("cat_connectoraction", kvp.Value.RecordId)
                        {
                            ["cat_isactive"]         = false,
                            ["cat_lastsyncdatetime"] = now,
                        };
                        service.Update(deactivate);
                        deactivatedCount++;
                        trace.Trace("UpsertConnectorActionsAction: deactivated stale action '{0}' ({1}).", kvp.Key, kvp.Value.RecordId);
                    }
                }

                // --- Set output parameters ---
                context.OutputParameters["CreatedCount"]     = createdCount;
                context.OutputParameters["UpdatedCount"]     = updatedCount;
                context.OutputParameters["DeactivatedCount"] = deactivatedCount;

                trace.Trace(
                    "UpsertConnectorActionsAction: complete — created={0}, updated={1}, deactivated={2}.",
                    createdCount, updatedCount, deactivatedCount);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("UpsertConnectorActionsAction: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"UpsertConnectorActionsAction failed: {ex.Message}", ex);
            }
        }

        // -----------------------------------------------------------------------
        // JSON parsing via DataContractJsonSerializer (.NET 4.6.2 built-in)
        // -----------------------------------------------------------------------

        private static List<ConnectorActionDto> ParseActionsJson(string json, ITracingService trace)
        {
            try
            {
                var serializer = new DataContractJsonSerializer(
                    typeof(List<ConnectorActionDto>),
                    new DataContractJsonSerializerSettings { UseSimpleDictionaryFormat = true });

                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                {
                    return (List<ConnectorActionDto>)serializer.ReadObject(stream)
                           ?? new List<ConnectorActionDto>();
                }
            }
            catch (Exception ex)
            {
                trace.Trace("UpsertConnectorActionsAction: JSON parse error — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"UpsertConnectorActionsAction: failed to parse 'ConnectorActionsJson': {ex.Message}", ex);
            }
        }

        // -----------------------------------------------------------------------
        // Dataverse query — paginated to handle connectors with many actions
        // -----------------------------------------------------------------------

        private static List<Entity> FetchExistingActions(
            IOrganizationService service,
            Guid connectorId,
            ITracingService trace)
        {
            var results = new List<Entity>();
            var query = new QueryExpression("cat_connectoraction")
            {
                ColumnSet = new ColumnSet("cat_connectoractionid", "cat_actionkey", "cat_isactive"),
                Criteria = new FilterExpression
                {
                    Conditions =
                    {
                        new ConditionExpression("cat_connectorid", ConditionOperator.Equal, connectorId),
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

            trace.Trace("UpsertConnectorActionsAction: fetched {0} existing records across {1} page(s).",
                results.Count, query.PageInfo.PageNumber - 1);

            return results;
        }

        // -----------------------------------------------------------------------
        // DTOs
        // -----------------------------------------------------------------------

        private struct ExistingAction
        {
            public Guid RecordId;
            public bool IsActive;
        }

        [DataContract]
        private class ConnectorActionDto
        {
            [DataMember(Name = "name")]
            public string Name { get; set; }

            [DataMember(Name = "properties")]
            public ConnectorActionPropertiesDto Properties { get; set; }
        }

        [DataContract]
        private class ConnectorActionPropertiesDto
        {
            [DataMember(Name = "summary")]
            public string Summary { get; set; }

            [DataMember(Name = "description")]
            public string Description { get; set; }
        }
    }
}
