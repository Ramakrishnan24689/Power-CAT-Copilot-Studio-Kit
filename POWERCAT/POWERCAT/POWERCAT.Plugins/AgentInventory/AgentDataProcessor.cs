// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Newtonsoft.Json.Linq;
using Newtonsoft.Json;
using static POWERCAT.Plugins.AgentInventory.AgentDataModel;

namespace POWERCAT.Plugins.AgentInventory
{
    /// <summary>
    /// Class for Json and Yaml parser
    /// </summary>
    public class AgentDataProcessor
    {
        /// <summary>
        /// Json parser, to parse the data of an agent or agent component detail
        /// </summary>
        /// <param name="jsonData">Json data to be parsed.</param>
        /// <param name="findKey">Key to find the key value pair in json</param>
        /// <returns>Extracted values of the key from json.</returns>
        public string ParseJsonData(JToken jsonData, string findKey)
        {
            if (jsonData is JProperty property)
            {
                if (property.Name == findKey)
                {
                    return property.Value.ToString();
                }
            }
            foreach (JToken child in jsonData.Children())
            {
                string result = ParseJsonData(child, findKey);
                if (!string.IsNullOrEmpty(result))
                {
                    return result;
                }
            }
            return string.Empty;
        }

        /// <summary>
        /// For yaml parser, to parse the data of an agent or agent component detail
        /// </summary>
        /// <param name="components">yaml data to be parsed.</param>
        /// <param name="key">Key to find the key value pair in yaml</param>
        /// <returns>Extracted values of the key from yaml.</returns>
        public string ExtractComponentsData(List<AgentComponentDetails> agentComponents, ComponentKeyEnum componentKey)
        {
            //Initialize componentMetadataList variable for output - list of extracted componentmetadata
            var componentMetadataList = new List<Dictionary<string, string>>();

            //Initialize parsedResult variable for returning output
            string extractedResult = string.Empty;

            //Get regex pattern for the given component key
            var regexPattern = GetRegexPattern(componentKey);

            switch (componentKey)
            {
                case ComponentKeyEnum.Instructions:

                    var instructionYaml = agentComponents.FirstOrDefault()?.Data ?? string.Empty;

                    if (!string.IsNullOrEmpty(instructionYaml))
                    {
                        //Match instructions in yaml data with regex pattern
                        Match instructionMatch = Regex.Match(instructionYaml, regexPattern, RegexOptions.Singleline);

                        //Set the extracted instruction value to output
                        extractedResult = instructionMatch.Groups[1].Value;
                    }
                    break;

                case ComponentKeyEnum.KnowledgeSources:

                    foreach (var component in agentComponents)
                    {
                        if (component.ComponentType == 14 && component.ComponentTypeName == "Bot File Attachment")
                        {
                            //Set knowledge source name and file data name of the file
                            var componentMetadata = new Dictionary<string, string>
                            {
                                {ComponentMetaDataEnum.DisplayName.ToString(), component.Name},
                                {ComponentMetaDataEnum.KnowledgeType.ToString(), "File"},
                                {ComponentMetaDataEnum.Value.ToString(), component.FileDataName}
                            };

                            if (componentMetadata.Count > 0)
                            {
                                componentMetadataList.Add(componentMetadata);
                            }
                        }
                        else
                        {
                            var data = component.Data;

                            if (data != null)
                            {
                                //Match knowledge sources in yaml data with regex pattern
                                MatchCollection knowledgeSourceMatchResults = Regex.Matches(data, regexPattern, RegexOptions.Singleline);

                                foreach (Match knowledgeSourceMatch in knowledgeSourceMatchResults)
                                {
                                    //Set knowledge source value(Name from current item, knowledge type and value from the data yaml)
                                    var componentMetadata = new Dictionary<string, string>
                                    {
                                        { ComponentMetaDataEnum.DisplayName.ToString(), component.Name },
                                        { ComponentMetaDataEnum.KnowledgeType.ToString(), knowledgeSourceMatch.Groups[1].Value },
                                        { ComponentMetaDataEnum.Value.ToString(), string.Concat(knowledgeSourceMatch.Groups[2].Value, " - ", knowledgeSourceMatch.Groups[3].Value)},
                                    };

                                    if (componentMetadata.Count > 0)
                                    {
                                        componentMetadataList.Add(componentMetadata);
                                    }
                                }
                            }
                        }
                    }
                    break;

                case ComponentKeyEnum.HttpRequestAction:

                    foreach (var component in agentComponents)
                    {
                        var data = component.Data;

                        if (data != null)
                        {
                            //Match HttpRequestAction in yaml data with regex pattern
                            MatchCollection httpRequestActionMatchResults = Regex.Matches(data, regexPattern, RegexOptions.Singleline);

                            //Loop for all the HttpRequestAction matches
                            foreach (Match httpRequestActionMatch in httpRequestActionMatchResults)
                            {
                                //Set httprequests value(Name from current item, displayname and value from the data yaml)
                                var componentMetadata = new Dictionary<string, string>
                                {
                                    { ComponentMetaDataEnum.TopicName.ToString(), component.Name },
                                    { ComponentMetaDataEnum.DisplayName.ToString(), httpRequestActionMatch.Groups[2].Value },
                                    { ComponentMetaDataEnum.Value.ToString(), httpRequestActionMatch.Groups[3].Value }
                                };

                                if (componentMetadata.Count > 0)
                                {
                                    componentMetadataList.Add(componentMetadata);
                                }
                            }
                        }
                    }
                    break;

                case ComponentKeyEnum.InvokeAIBuilderModelAction:

                    foreach (var component in agentComponents)
                    {
                        var data = component.Data;

                        if (data != null)
                        {
                            //Match InvokeAIBuilderModelAction in yaml data with regex pattern
                            MatchCollection aiBuilderActionMatchResults = Regex.Matches(data, regexPattern, RegexOptions.Singleline);

                            //Loop for all the InvokeAIBuilderModelAction matches
                            foreach (Match aiBuilderActionMatch in aiBuilderActionMatchResults)
                            {
                                //Set prompts value(Name from current item, value from the data yaml)
                                var componentMetadata = new Dictionary<string, string>
                                {
                                    { ComponentMetaDataEnum.TopicName.ToString(), component.Name},
                                    { ComponentMetaDataEnum.PromptName.ToString(), string.Empty},   //value populated in agent inventory power automate grandchild flow
                                    { ComponentMetaDataEnum.Value.ToString(), aiBuilderActionMatch.Groups[3].Value}
                                };

                                if (componentMetadata.Count > 0)
                                {
                                    componentMetadataList.Add(componentMetadata);
                                }
                            }
                        }
                    }
                    break;

                case ComponentKeyEnum.ClassicDataSources:

                    //Initialize parsedComponents variable to hold - list of extracted classic data sources
                    var parsedComponents = new List<Dictionary<string, object>>();

                    //Get regex pattern for SearchAndSummarizeContent block
                    regexPattern = GetRegexPattern(ComponentKeyEnum.SearchAndSummarizeContentBlock);

                    foreach (var component in agentComponents)
                    {
                        var data = component.Data;

                        if (data != null)
                        {
                            //Match regex for SearchAndSummarizeContent(generative answer sources action)
                            MatchCollection searchAndSummarizeMatchResults = Regex.Matches(data, regexPattern, RegexOptions.Singleline);

                            //Loop for all SearchAndSummarizeContent matches
                            foreach (Match searchAndSummarizeMatch in searchAndSummarizeMatchResults)
                            {
                                // Extract the SearchAndSummarizeContent block
                                string searchAndSummarizeContent = searchAndSummarizeMatch.Value;

                                // List of known classic data sources to extract from SearchAndSummarizeContent block
                                string[] classicDataSourceKeys = {
                                    "publicDataSource",
                                    "sharePointSearchDataSource",
                                    "customDataSource",
                                    "azureOpenAIOnYourDataSource"
                                };

                                //Initialize classicDataSources variable to hold the extracted values of classic data sources
                                var classicDataSources = new Dictionary<string, object>();

                                // Loop through each key(classic data sources) and match regex for the key in SearchAndSummarizeContent block
                                foreach (var classicDataSourceKey in classicDataSourceKeys)
                                {
                                    //Extract Classic Data Sources like publicdatasource, sharepointdatasource, customdtasource, azureopenaidatasource
                                    var classicDataSourceNode = ExtractYamlBlock(searchAndSummarizeContent, classicDataSourceKey);
                                    string classicDataSourceContent = classicDataSourceNode != null ? classicDataSourceNode.Groups["block"].Value : null;

                                    if (!string.IsNullOrEmpty(classicDataSourceContent))
                                    {
                                        if (classicDataSourceKey == "azureOpenAIOnYourDataSource")
                                        {
                                            //Parse and extract key values in azureOpenAIOnYourDataSource block 
                                            var azureOpenAIDataSource = ParseAzureOpenAIDataSource(classicDataSourceContent);
                                            classicDataSources[classicDataSourceKey] = azureOpenAIDataSource;
                                        }
                                        else
                                        {
                                            var extractDataSource = new Dictionary<string, object>();

                                            //Parse and extract key values in data source like publicDataSource or sharePointSearchDataSource or customDataSource block 
                                            ExtractKeyValuePairs(classicDataSourceContent, extractDataSource);

                                            if (classicDataSourceKey == "publicDataSource" || classicDataSourceKey == "sharePointSearchDataSource")
                                            {
                                                classicDataSources[classicDataSourceKey] = extractDataSource["sites"];
                                            }
                                            else if (classicDataSourceKey == "customDataSource")
                                            {
                                                classicDataSources[classicDataSourceKey] = extractDataSource["searchResults"];
                                            }
                                        }
                                    }
                                }

                                if (classicDataSources.Count > 0)
                                {
                                    // Set values of classic data sources
                                    var componentMetadata = new Dictionary<string, object>
                                    {
                                        { ComponentMetaDataEnum.TopicName.ToString(), component.Name },
                                        { ComponentMetaDataEnum.Value.ToString(), classicDataSources }
                                    };

                                    if (componentMetadata.Count > 0)
                                    {
                                        parsedComponents.Add(componentMetadata);
                                    }
                                }
                            }
                        }
                    }

                    //Serialize the parsedComponents and assign it to the output variable extractedResult
                    extractedResult = JsonConvert.SerializeObject(parsedComponents, Formatting.Indented);
                    break;

                case ComponentKeyEnum.AgentTriggers:

                    //Initialize the agentTriggers variable to hold all the list of extracted agent triggers
                    List<string> agentTriggers = new List<string>();

                    foreach (var component in agentComponents)
                    {
                        var data = component.Data;

                        if (data != null)
                        {
                            //Match triggerConnectionType in yaml data with regex pattern
                            Match agentTriggerMatch = Regex.Match(data, regexPattern, RegexOptions.Singleline);

                            if (agentTriggerMatch.Success)
                            {
                                agentTriggers.Add(agentTriggerMatch.Groups[1].Value);
                            }
                        }
                    }

                    // If agentTriggers list is not empty, add to componentMetadataList
                    if (agentTriggers.Count > 0)
                    {
                        componentMetadataList.Add(new Dictionary<string, string>{
                            { ComponentMetaDataEnum.Triggers.ToString(), string.Join(", ", agentTriggers) }
                        });
                    }
                    break;

                case ComponentKeyEnum.Connections:

                    foreach (var component in agentComponents)
                    {
                        var data = component.Data;

                        if (data != null)
                        {
                            //Match connections and flowids in yaml data with regex pattern
                            MatchCollection connectionMatchResults = Regex.Matches(data, regexPattern, RegexOptions.Singleline);

                            //Loop for all connections matches
                            foreach (Match connectionMatch in connectionMatchResults)
                            {
                                var componentMetadata = new Dictionary<string, string>();

                                //if connections with connection name and connection mode exists in agent
                                if (connectionMatch.Groups[1].Success && connectionMatch.Groups[2].Success)
                                {
                                    //Set value(Name from current item, connection name, connection mode value from the data yaml)
                                    componentMetadata = new Dictionary<string, string>
                                    {
                                        {ComponentMetaDataEnum.Name.ToString(), string.Concat("TopicName - ",component.Name)},
                                        {ComponentMetaDataEnum.Type.ToString(), "Agent"},
                                        {ComponentMetaDataEnum.Connection.ToString(), connectionMatch.Groups[1].Value}, //Connection name
                                        {ComponentMetaDataEnum.ConnectionMode.ToString(), connectionMatch.Groups[2].Value} //invoker/maker
                                    };
                                }

                                //if flow exists in agent, add flow id
                                if (connectionMatch.Groups[3].Success)
                                {
                                    //Set value(value from the data yaml(matched regex))
                                    componentMetadata = new Dictionary<string, string>
                                    {
                                        {ComponentMetaDataEnum.Name.ToString(), string.Empty}, //populated in agent inventory child flow
                                        {ComponentMetaDataEnum.Type.ToString(), "Flow"},  //populated in agent inventory child flow
                                        {ComponentMetaDataEnum.Connection.ToString(), connectionMatch.Groups[3].Value}, //Flowid
                                        {ComponentMetaDataEnum.ConnectionMode.ToString(), string.Empty}   //populated in agent inventory child flow
                                    };
                                }
                                if (componentMetadata.Count > 0)
                                {
                                    componentMetadataList.Add(componentMetadata);
                                }
                            }
                        }
                    }
                    componentMetadataList = componentMetadataList.Distinct().ToList();
                    break;

                default:
                    break;
            }

            //If extractedResult has value set by Instruction or ClassicDataSource then return the value not required to serialize
            if (!string.IsNullOrEmpty(extractedResult))
            {
                return extractedResult;
            }
            else if (componentMetadataList.Count > 0)
            {
                extractedResult = JsonConvert.SerializeObject(componentMetadataList, Formatting.Indented);
            }
            return extractedResult;
        }

        /// <summary>
        /// Extracts a YAML block corresponding to a specified key.
        /// </summary>
        private static Match ExtractYamlBlock(string yaml, string key)
        {
            //Get regex for indentation
            string regexIndentPattern = GetRegexPattern(ComponentKeyEnum.Indent);

            //String format regexIndentPattern with key
            regexIndentPattern = string.Format(regexIndentPattern, key);

            //Get indentation of the given key in yaml by matching yaml with regex
            var indentMatch = Regex.Match(yaml, regexIndentPattern, RegexOptions.Multiline);

            if (indentMatch.Success)
            {
                string baseIndent = Regex.Escape(indentMatch.Groups["indent"].Value);

                //Get regex for extracting th yaml block for given key
                string regexPattern = GetRegexPattern(ComponentKeyEnum.ExtractYamlBlock);

                //String format regexIndentPattern with key
                regexPattern = string.Format(regexPattern, baseIndent, key);

                Match yamlBlockMatch = Regex.Match(yaml, regexPattern, RegexOptions.Multiline);

                return yamlBlockMatch;
            }
            return null;
        }

        /// <summary>
        /// Extracts simple key-value pairs and add to dictionary
        /// </summary>
        private static void ExtractKeyValuePairs(string yaml, Dictionary<string, object> keyValuePairs)
        {
            //For extracting all the key and values which has list from the yaml block
            //Get ExtractAllKeyValueList regex pattern
            string keyValueListRegex = GetRegexPattern(ComponentKeyEnum.ExtractAllKeyValueList);

            //Match regex with input yaml to get all key and values which has list
            var keyValueListMatchResults = Regex.Matches(yaml, keyValueListRegex, RegexOptions.Multiline);

            //Loop all key and values list matches
            foreach (Match keyValueListMatch in keyValueListMatchResults)
            {
                string key = keyValueListMatch.Groups["key"].Value.Trim();
                var values = new List<string>();

                //Skip if key is already available in the keyValuePairs dictionary
                if (!keyValuePairs.ContainsKey(key))
                {
                    //For extracting list of values from value
                    foreach (Match match in Regex.Matches(keyValueListMatch.Groups["list"].Value, @"-\s*(?<item>[^\r\n]+)"))
                    {
                        string rawString = match.Groups["item"].Value.Trim();
                        string formattedString = rawString.Contains('"') ? rawString.Replace('"', '\'') : rawString;
                        values.Add(formattedString);
                    }
                    keyValuePairs[key] = values;
                }
            }

            //For extracting all the key and values from the yaml block
            //Get ExtractAllKeyValue regex pattern
            string regex = GetRegexPattern(ComponentKeyEnum.ExtractAllKeyValue);

            //Match regex with input yaml to get all key values
            var keyValueMatchResults = Regex.Matches(yaml, regex, RegexOptions.Multiline);

            //Loop all key values matches
            foreach (Match keyValueMatch in keyValueMatchResults)
            {
                string key = keyValueMatch.Groups["key"].Value.Trim();

                //Skip if key is already available in the keyValuePairs dictionary
                if (!keyValuePairs.ContainsKey(key))
                {
                    string rawString = keyValueMatch.Groups["value"].Value.Trim();
                    string formattedString = rawString.Contains('"') ? rawString.Replace('"', '\'') : rawString;
                    keyValuePairs[key] = formattedString;
                }
            }
        }

        /// <summary>
        /// Extracts value for a given key in keyvalue pair.
        /// </summary>
        private static string ExtractValueForKey(string yaml, string key)
        {
            //Get regex for extracting value from KeyValue
            string regex = GetRegexPattern(ComponentKeyEnum.ExtractValueForKey);

            //String format regex with key
            regex = string.Format(regex, key);

            //Match the regex with yaml to extract the value for the given key
            var match = Regex.Match(yaml, regex);
            string valueMatch = match.Success ? match.Groups[1].Value.Trim() : null;
            return valueMatch;
        }

        /// <summary>
        /// Parses the Azure OpenAI data source block with nested YAML content.
        /// </summary>
        private static Dictionary<string, object> ParseAzureOpenAIDataSource(string azureOpenAIDataSourceBlock)
        {
            var parsedData = new Dictionary<string, object>();

            // Extract the "dataSources" block in azureOpenAIDataSourceBlock
            var dataSourceNode = ExtractYamlBlock(azureOpenAIDataSourceBlock, "dataSources");
            string dataSourceContent = dataSourceNode != null ? dataSourceNode.Groups["block"].Value : null;

            if (!string.IsNullOrEmpty(dataSourceContent))
            {
                var dataSources = new List<Dictionary<string, object>>();

                // Split the data source block into individual index blocks
                var indexBlocks = Regex.Split(dataSourceContent.Trim(), @"^\s*-\s*indexName:", RegexOptions.Multiline);

                //Loop all index block
                foreach (var indexBlock in indexBlocks)
                {
                    if (!string.IsNullOrWhiteSpace(indexBlock))
                    {
                        var indexMetadata = new Dictionary<string, object>();

                        // Extract index name from the index block
                        var indexNameMatch = Regex.Match(indexBlock, @"^\s*(?<name>[^\r\n]+)");
                        if (indexNameMatch.Success)
                        {
                            indexMetadata["indexName"] = indexNameMatch.Groups["name"].Value.Trim();
                        }

                        // Extract other key value pairs from the index block
                        ExtractKeyValuePairs(indexBlock, indexMetadata);

                        dataSources.Add(indexMetadata);
                    }
                }

                parsedData["dataSources"] = dataSources;
            }

            //For other fields in azureOpenAIDataSourceBlock
            string[] scalarKeys = { "apiVersion", "deployment", "temperature", "topP", "maxTokens", "stopSequence" };

            foreach (var scalarKey in scalarKeys)
            {
                if (scalarKey == "stopSequence")
                {
                    var stopSequenceNode = ExtractYamlBlock(azureOpenAIDataSourceBlock, "stopSequence");
                    if (stopSequenceNode != null)
                    {
                        ExtractKeyValuePairs(stopSequenceNode.Value, parsedData);
                    }
                }
                else
                {
                    var scalarValue = ExtractValueForKey(azureOpenAIDataSourceBlock, scalarKey);
                    if (!string.IsNullOrEmpty(scalarValue))
                    {
                        parsedData[scalarKey] = scalarValue;
                    }
                }
            }

            return parsedData;
        }

        /// <summary>
        /// Get the regex pattern for the agent component action.
        /// </summary>
        /// <param name="key">key to get the regex pattern.</param>
        /// <returns>returns regex</returns>
        private static string GetRegexPattern(ComponentKeyEnum key)
        {
            string regex = null;
            switch (key)
            {
                case ComponentKeyEnum.HttpRequestAction:
                    regex = @"\s*kind:\s*HttpRequestAction\s*id:\s*([^\s]+)\s*.*?(?:displayName:\s*\""?([^\\""\r\n]*)\""?)?\s*.*?url:\s*([^\s]+)";
                    break;

                case ComponentKeyEnum.InvokeAIBuilderModelAction:
                    regex = @"\s*kind:\s*InvokeAIBuilderModelAction\s*id:\s*([^\s]+)\s*.*?(?:displayName:\s*\""?([^\\""\r\n]*)\""?)?\s*.*?aIModelId:\s*([^\s]+)";
                    break;

                case ComponentKeyEnum.KnowledgeSources:
                    regex = @"\s*kind:\s*KnowledgeSourceConfiguration\s*source:\s*kind:\s*(\w+)\s*(\w+):\s*(\S+)";
                    break;

                case ComponentKeyEnum.Instructions:
                    regex = @"\s*instructions: (.*?)(?=\s+\w+:|$)";
                    break;

                case ComponentKeyEnum.SearchAndSummarizeContentBlock:
                    regex = @"- kind:\s*SearchAndSummarizeContent\b[\s\S]*?(?=\r\n\s*-\s*kind:|\z)";
                    break;

                case ComponentKeyEnum.DataSource:
                    regex = @"{0}:\s*((?:.|\r\n)*?)(?=\r\n\r\n|\z)";
                    break;

                case ComponentKeyEnum.Indent:
                    regex = @"(?<indent>^[ \t]*)-?[ \t]*{0}:\s*(?:\r?\n|\r?)";
                    break;

                case ComponentKeyEnum.ExtractYamlBlock:
                    regex = @"^{0}-?[ \t]*{1}:\s*\r?\n(?<block>(?:(?!^{0}\S)[ \t]*\S.*\r?\n|^\s*\r?\n)*)"; ;
                    break;

                case ComponentKeyEnum.ExtractAllKeyValue:
                    regex = @"^\s*(?<key>\w+):\s*(?<value>[^\r\n]+)";
                    break;

                case ComponentKeyEnum.ExtractAllKeyValueList:
                    regex = @"^\s*(?<key>\w+):\s*\r?\n(?<list>(?:\s*-\s*[^\r\n]+\r?\n?)+)";
                    break;

                case ComponentKeyEnum.ExtractValueForKey:
                    regex = @"{0}:\s*(.+)";
                    break;

                case ComponentKeyEnum.AgentTriggers:
                    regex = @"\s*triggerConnectionType:\s*([^\r\n]+)";
                    break;

                case ComponentKeyEnum.Connections:
                    regex = @"(?:connectionReference:\s*([^\s\r\n]+)[\s\S]*?connectionProperties:\s*[\r\n]+\s*mode:\s*([^\s\r\n]+))|flowId:\s*([^\s\r\n]+)";
                    break;

                default:
                    break;
            }
            return regex;
        }

        /// <summary>
        /// Extracting connections details from all workflow
        /// </summary>
        /// <param name="flows">list of workflow in json string.</param>
        /// <returns>Extracted list of connections details from workflow as json string.</returns>
        public string ExtractWorkFlowData(string flows)
        {
            try
            {
                //Parse list of workflow json
                JArray array = JArray.Parse(flows);

                //Extracting connection details of all workflows as list
                var result = array
                .SelectMany(item =>
                {
                    return ((JObject)item["clientdata"])?.Properties().Select(prop => new Dictionary<string, string>
                    {
                    { "FlowName", item["name"]?.ToString() ?? string.Empty },
                    { "Name", prop.Value["api"]?["name"]?.ToString() },
                    { "RuntimeSource", prop.Value["runtimeSource"]?.ToString() },
                    { "Impersonation", prop.Value["impersonation"]?.ToString() ?? string.Empty }
                    }) ?? Enumerable.Empty<Dictionary<string, string>>();
                })
                .ToList();

                //Return result as json string
                return JsonConvert.SerializeObject(result);
            }
            catch (Exception ex)
            {
                throw ex;
            }
            return string.Empty;
        }

        /// <summary>
        /// Enumerator for Component key
        /// </summary>
        public enum ComponentKeyEnum
        {
            HttpRequestAction,
            InvokeAIBuilderModelAction,
            KnowledgeSources,
            Instructions,
            SearchAndSummarizeContentBlock,
            DataSource,
            Indent,
            ExtractYamlBlock,
            ExtractAllKeyValue,
            ExtractAllKeyValueList,
            ExtractValueForKey,
            ClassicDataSources,
            AgentTriggers,
            Connections
        }

        /// <summary>
        /// Enumerator for ComponentMetaData Output
        /// </summary>
        public enum ComponentMetaDataEnum
        {
            TopicName,
            DisplayName,
            Value,
            KnowledgeType,
            PromptName,
            Triggers,
            ConnectionMode,
            Connection,
            Type,
            Name
        }
    }
}