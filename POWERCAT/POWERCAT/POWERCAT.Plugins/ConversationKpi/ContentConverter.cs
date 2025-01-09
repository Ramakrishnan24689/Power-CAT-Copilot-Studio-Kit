// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Custom class for json converter
    /// </summary>
    public class ContentConverter : JsonConverter
    {
        /// <summary>
        /// Specify which types this converter can handle.
        /// </summary>
        /// <param name="objectType">The object type.</param>
        /// <returns>Boolen indicating whether it can convert json</returns>
        public override bool CanConvert(Type objectType)
        {
            return objectType == typeof(object); // Flexible for dynamic types
        }

        /// <summary>
        /// Custom deserialization logic.
        /// </summary>
        /// <param name="reader">Json Reader object.</param>
        /// <param name="objectType">The object type.</param>
        /// <param name="existingValue">Existing value.</param>
        /// <param name="serializer">The serializer.</param>
        /// <returns>Json string</returns>
        public override object ReadJson(JsonReader reader, Type objectType, object existingValue, JsonSerializer serializer)
        {
            switch (reader.TokenType)
            {
                case JsonToken.String:
                    return reader.Value.ToString(); // Handle simple strings

                case JsonToken.StartObject:
                    // Dynamically parse as JObject for unknown structures
                    JObject obj = JObject.Load(reader);
                    return obj;

                case JsonToken.StartArray:
                    // Handle JSON arrays gracefully
                    JArray array = JArray.Load(reader);
                    return array;

                case JsonToken.Null:
                    return null;

                default:
                    // Skip unsupported token types
                    return null;
            }
        }

        /// <summary>
        /// Custom serialization logic.
        /// </summary>
        /// <param name="writer">Json Writer object.</param>
        /// <param name="value">Value.</param>
        /// <param name="serializer">The serializer.</param>
        public override void WriteJson(JsonWriter writer, object value, JsonSerializer serializer)
        {
            // Serialize back to JSON as is
            if (value != null)
            {
                serializer.Serialize(writer, value);
            }
            else
            {
                writer.WriteNull();
            }
        }
    }
}
