using System;
using System.IO;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;

namespace POWERCAT.Plugins.PowerShield
{
    /// <summary>
    /// Custom API plugin: cat_UpsertConnector
    ///
    /// Called by the "Sync flow | Connectors" cloud flow once per connector inside
    /// Apply_to_each. Parses a single connector JSON object and creates or updates
    /// the matching cat_connector record in Dataverse.
    ///
    /// Registration:
    ///   Custom API — Unbound Action
    ///   Message:  cat_UpsertConnector
    ///   Plugin:   PowerShield.Plugins.UpsertConnectorsAction
    ///
    /// Input Parameters:
    ///   ConnectorJson (String) — JSON object for a single connector from the
    ///                            Power Apps API Get-Connectors response.
    ///
    /// Output Parameters:
    ///   Result (String) — "Created" if a new record was created, "Updated" if
    ///                     an existing record was updated.
    /// </summary>
    public class UpsertConnectorsAction : IPlugin
    {
        public void Execute(IServiceProvider serviceProvider)
        {
            var trace = (ITracingService)serviceProvider.GetService(typeof(ITracingService));

            try
            {
                trace.Trace("UpsertConnectorsAction: Execute started.");

                var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
                var factory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
                var service = factory.CreateOrganizationService(null); // SYSTEM context

                // --- Read input parameter ---
                if (!context.InputParameters.ContainsKey("ConnectorJson"))
                {
                    throw new InvalidPluginExecutionException(
                        "UpsertConnectorsAction: required input parameter 'ConnectorJson' is missing.");
                }

                var connectorJson = context.InputParameters["ConnectorJson"] as string;

                if (string.IsNullOrWhiteSpace(connectorJson))
                    throw new InvalidPluginExecutionException("UpsertConnectorsAction: 'ConnectorJson' is empty.");

                // --- Parse connector ---
                var connector = ParseConnectorJson(connectorJson, trace);

                if (string.IsNullOrEmpty(connector.Name))
                    throw new InvalidPluginExecutionException("UpsertConnectorsAction: connector 'name' is missing or empty.");

                trace.Trace("UpsertConnectorsAction: processing connector '{0}'.", connector.Name);

                // --- Build field values ---
                var props = connector.Properties ?? new ConnectorPropertiesDto();
                var displayName  = props.DisplayName ?? string.Empty;
                var description  = props.Description ?? string.Empty;
                var iconUrl      = props.IconUri ?? string.Empty;
                var category     = props.IsCustomApi ? "Custom" : "Standard";
                var isPremium    = string.Equals(props.Tier, "Premium", StringComparison.OrdinalIgnoreCase);
                var publisher    = props.Publisher ?? string.Empty;
                var releaseTag   = props.ReleaseTag ?? string.Empty;
                var blockedByAdmin = publisher.IndexOf("microsoft", StringComparison.OrdinalIgnoreCase) < 0;
                var detailsUrl   = "https://learn.microsoft.com/en-us/connectors/"
                                  + connector.Name.Replace("shared_", string.Empty) + "/";
                var now          = DateTime.UtcNow;

                // --- Look up existing record ---
                var existingId = FindExistingConnector(service, connector.Name, trace);

                string result;

                if (existingId.HasValue)
                {
                    var update = new Entity("cat_connector", existingId.Value)
                    {
                        ["cat_connectorkey"]        = connector.Name,
                        ["cat_displayname"]         = displayName,
                        ["cat_connectorname"]       = displayName,
                        ["cat_description"]         = description,
                        ["cat_iconurl"]             = iconUrl,
                        ["cat_category"]            = category,
                        ["cat_ispremium"]           = isPremium,
                        ["cat_publisher"]           = publisher,
                        ["cat_releasetag"]          = releaseTag,
                        ["cat_connectordetailsurl"] = detailsUrl,
                        ["cat_isactive"]            = true,
                        ["cat_lastsyncdatetime"]    = now,
                    };
                    service.Update(update);
                    result = "Updated";
                    trace.Trace("UpsertConnectorsAction: updated connector '{0}' ({1}).", connector.Name, existingId.Value);
                }
                else
                {
                    var create = new Entity("cat_connector")
                    {
                        ["cat_connectorkey"]        = connector.Name,
                        ["cat_displayname"]         = displayName,
                        ["cat_connectorname"]       = displayName,
                        ["cat_description"]         = description,
                        ["cat_iconurl"]             = iconUrl,
                        ["cat_category"]            = category,
                        ["cat_ispremium"]           = isPremium,
                        ["cat_publisher"]           = publisher,
                        ["cat_releasetag"]          = releaseTag,
                        ["cat_connectordetailsurl"] = detailsUrl,
                        ["cat_isactive"]            = true,
                        ["cat_lastsyncdatetime"]    = now,
                        ["cat_blockedbyadmin"]      = blockedByAdmin,
                    };
                    service.Create(create);
                    result = "Created";
                    trace.Trace("UpsertConnectorsAction: created connector '{0}'.", connector.Name);
                }

                context.OutputParameters["Result"] = result;
                trace.Trace("UpsertConnectorsAction: complete — result={0}.", result);
            }
            catch (InvalidPluginExecutionException)
            {
                throw;
            }
            catch (Exception ex)
            {
                trace.Trace("UpsertConnectorsAction: unhandled exception — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"UpsertConnectorsAction failed: {ex.Message}", ex);
            }
        }

        // -----------------------------------------------------------------------
        // Dataverse query — single-record lookup by cat_connectorkey
        // -----------------------------------------------------------------------

        private static Guid? FindExistingConnector(
            IOrganizationService service,
            string connectorKey,
            ITracingService trace)
        {
            var query = new QueryExpression("cat_connector")
            {
                ColumnSet = new ColumnSet("cat_connectorid"),
                Criteria = new FilterExpression(LogicalOperator.And),
                TopCount = 1,
            };
            query.Criteria.AddCondition("cat_connectorkey", ConditionOperator.Equal, connectorKey);

            var results = service.RetrieveMultiple(query);
            if (results.Entities.Count > 0)
            {
                trace.Trace("UpsertConnectorsAction: found existing record for '{0}'.", connectorKey);
                return results.Entities[0].Id;
            }

            trace.Trace("UpsertConnectorsAction: no existing record for '{0}'.", connectorKey);
            return null;
        }

        // -----------------------------------------------------------------------
        // JSON parsing via DataContractJsonSerializer (.NET 4.6.2 built-in)
        // -----------------------------------------------------------------------

        private static ConnectorDto ParseConnectorJson(string json, ITracingService trace)
        {
            try
            {
                var serializer = new DataContractJsonSerializer(
                    typeof(ConnectorDto),
                    new DataContractJsonSerializerSettings { UseSimpleDictionaryFormat = true });

                using (var stream = new MemoryStream(Encoding.UTF8.GetBytes(json)))
                {
                    return (ConnectorDto)serializer.ReadObject(stream)
                           ?? new ConnectorDto();
                }
            }
            catch (Exception ex)
            {
                trace.Trace("UpsertConnectorsAction: JSON parse error — {0}", ex.ToString());
                throw new InvalidPluginExecutionException(
                    $"UpsertConnectorsAction: failed to parse 'ConnectorJson': {ex.Message}", ex);
            }
        }

        // -----------------------------------------------------------------------
        // DTOs
        // -----------------------------------------------------------------------

        [DataContract]
        private class ConnectorDto
        {
            [DataMember(Name = "name")]
            public string Name { get; set; }

            [DataMember(Name = "properties")]
            public ConnectorPropertiesDto Properties { get; set; }
        }

        [DataContract]
        private class ConnectorPropertiesDto
        {
            [DataMember(Name = "displayName")]
            public string DisplayName { get; set; }

            [DataMember(Name = "description")]
            public string Description { get; set; }

            [DataMember(Name = "iconUri")]
            public string IconUri { get; set; }

            [DataMember(Name = "isCustomApi")]
            public bool IsCustomApi { get; set; }

            /// <summary>"Premium" or "Standard"</summary>
            [DataMember(Name = "tier")]
            public string Tier { get; set; }

            [DataMember(Name = "publisher")]
            public string Publisher { get; set; }

            [DataMember(Name = "releaseTag")]
            public string ReleaseTag { get; set; }
        }
    }
}
