// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using System;
using Newtonsoft.Json;

namespace POWERCAT.Plugins.ConversationKpi
{
    /// <summary>
    /// Custom class for value converter
    /// </summary>
    public class ValueConverter : JsonConverter<Value>
    {
        /// <summary>
        /// Read json method for custom converter of Value type
        /// </summary>
        /// <param name="reader"></param>
        /// <param name="objectType"></param>
        /// <param name="existingValue"></param>
        /// <param name="hasExistingValue"></param>
        /// <param name="serializer"></param>
        /// <returns>Deserialized Json</returns>
        public override Value ReadJson(JsonReader reader, Type objectType, Value existingValue, bool hasExistingValue, JsonSerializer serializer)
        {
            // If the JSON is a plain string, stuff it into newValue
            if (reader.TokenType == JsonToken.String)
            {
                return new Value
                {
                    newValue = (string)reader.Value
                };
            }

            // Otherwise, let Newtonsoft populate your Value class normally
            return serializer.Deserialize<Value>(reader);
        }

        /// <summary>
        /// Write json method to serialization 
        /// </summary>
        /// <param name="writer"></param>
        /// <param name="value"></param>
        /// <param name="serializer"></param>
        public override void WriteJson(JsonWriter writer, Value value, JsonSerializer serializer)
        {
            // If this Value was just a string, write it as a string
            if (value.newValue != null && value.intentTitle == null && value.intents == null)
            {
                writer.WriteValue(value.newValue);
            }
            else
            {
                // Else write the full object
                serializer.Serialize(writer, value);
            }
        }
    }
}

