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
        public string ExtractComponentsData(List<AgentComponentDetails> components, string key)
        {

            var values = new List<Dictionary<string, string>>();

            string json = string.Empty;

            //Get regex pattern of the key
            var regex = GetRegexPattern(key);

            switch (key)
            {
                case "instructions":

                    var dataInstruction = components.FirstOrDefault()?.Data ?? string.Empty;

                    if (!string.IsNullOrEmpty(dataInstruction))
                    {
                        //Match data with regex
                        Match matchInstruction = Regex.Match(dataInstruction, regex, RegexOptions.Singleline);

                        //Set instruction value from the regex matched for yaml
                        json = matchInstruction.Groups[1].Value;
                    }
                    break;

                case "KnowledgeSources":

                    foreach (var item in components)
                    {
                        if (item.ComponentType == 14 && item.ComponentTypeName == "Bot File Attachment")
                        {
                            //Set knowledge source name and file data name of the file
                            var componentsDict = new Dictionary<string, string>
                            {
                                {AgentComponentsKnowledgeEnum.DisplayName.ToString(), item.Name},
                                {AgentComponentsKnowledgeEnum.KnowledgeType.ToString(), "File"},
                                {AgentComponentsKnowledgeEnum.Value.ToString(), item.FileDataName}
                            };

                            if (componentsDict.Count > 0)
                            {
                                values.Add(componentsDict);
                            }
                        }
                        else
                        {
                            var data = item.Data;

                            if (data != null)
                            {
                                //Match the data with regex
                                MatchCollection match = Regex.Matches(data, regex, RegexOptions.Singleline);

                                foreach (Match match2 in match)
                                {
                                    //Set knowledge sources value(Name from current item, knowledge type and value from the data yaml(matched regex))
                                    var componentsDict = new Dictionary<string, string>
                                    {
                                        { AgentComponentsKnowledgeEnum.DisplayName.ToString(), item.Name },
                                        { AgentComponentsKnowledgeEnum.KnowledgeType.ToString(), match2.Groups[1].Value },
                                        { AgentComponentsKnowledgeEnum.Value.ToString(), string.Concat(match2.Groups[2].Value, " - ", match2.Groups[3].Value)},
                                    };

                                    if (componentsDict.Count > 0)
                                    {
                                        values.Add(componentsDict);
                                    }

                                }
                            }
                        }
                    }
                    break;

                case "HttpRequestAction":

                    foreach (var item in components)
                    {
                        var data = item.Data;

                        if (data != null)
                        {
                            //Match the data with regex
                            MatchCollection match = Regex.Matches(data, regex, RegexOptions.Singleline);

                            foreach (Match match2 in match)
                            {
                                //Set httprequests value(Name from current item, displayname and value from the data yaml(matched regex))
                                var componentsDict = new Dictionary<string, string>
                                {
                                    {AgentComponentsKnowledgeEnum.TopicName.ToString(), item.Name },
                                    { AgentComponentsKnowledgeEnum.DisplayName.ToString(), match2.Groups[2].Value },
                                    { AgentComponentsKnowledgeEnum.Value.ToString(), match2.Groups[3].Value }
                                };

                                if (componentsDict.Count > 0)
                                {
                                    values.Add(componentsDict);
                                }
                            }
                        }
                    }
                    break;

                case "InvokeAIBuilderModelAction":

                    foreach (var item in components)
                    {
                        var data = item.Data;

                        if (data != null)
                        {
                            //Match the data with regex
                            MatchCollection match = Regex.Matches(data, regex, RegexOptions.Singleline);

                            foreach (Match match2 in match)
                            {
                                //Set prompts value(Name from current item, value from the data yaml(matched regex))
                                var componentsDict = new Dictionary<string, string>
                                {
                                    {AgentComponentsKnowledgeEnum.TopicName.ToString(), item.Name},
                                    {AgentComponentsKnowledgeEnum.PromptName.ToString(), string.Empty},   //value populated in power automate
                                    { AgentComponentsKnowledgeEnum.Value.ToString(), match2.Groups[3].Value}
                                };

                                if (componentsDict.Count > 0)
                                {
                                    values.Add(componentsDict);
                                }
                            }
                        }
                    }
                    break;

                default:
                    break;
            }

            if (values.Count > 0)
            {
                json = JsonConvert.SerializeObject(values, Formatting.Indented);
            }
            return json;
        }

        /// <summary>
        /// Get the regex pattern for the agent component action.
        /// </summary>
        /// <param name="key">key to get the regex pattern.</param>
        /// <returns>returns regex.</returns>
        public string GetRegexPattern(string key)
        {
            string regex = null;
            switch (key)
            {
                case "HttpRequestAction":
                    regex = @"\s*kind:\s*HttpRequestAction\s*id:\s*([^\s]+)\s*.*?(?:displayName:\s*\""?([^\\""\r\n]*)\""?)?\s*.*?url:\s*([^\s]+)";
                    break;

                case "InvokeAIBuilderModelAction":
                    regex = @"\s*kind:\s*InvokeAIBuilderModelAction\s*id:\s*([^\s]+)\s*.*?(?:displayName:\s*\""?([^\\""\r\n]*)\""?)?\s*.*?aIModelId:\s*([^\s]+)";
                    break;

                case "KnowledgeSources":
                    regex = @"\s*kind:\s*KnowledgeSourceConfiguration\s*source:\s*kind:\s*(\w+)\s*(\w+):\s*(\S+)";
                    break;

                case "instructions":
                    regex = @"\s*instructions: (.*?)(?=\s+\w+:|$)";
                    break;

                default:
                    break;
            }
            return regex;
        }

        /// <summary>
        /// Enumerator for agent component output.
        /// </summary>
        public enum AgentComponentsKnowledgeEnum
        {
            TopicName,
            DisplayName,
            Value,
            KnowledgeType,
            PromptName
        }
    }
}
