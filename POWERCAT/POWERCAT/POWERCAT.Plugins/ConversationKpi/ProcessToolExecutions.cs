// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Linq;

namespace POWERCAT.Plugins.ConversationKpi
{
    public class ProcessToolExecutions
    {
        public List<ToolExecution> ProcessForToolExecutions(List<Activity> model, string conversationId, string agentId)
        {
            if (model == null || model.Count == 0)
            {
                return new List<ToolExecution>();
            }

            var orderedActivities = model.OrderBy(activity => activity.index).ToList();
            var sessionInfoActivities = orderedActivities
                .Where(activity => string.Equals(activity.valueType, "SessionInfo", StringComparison.OrdinalIgnoreCase))
                .OrderBy(activity => activity.index)
                .ToList();

            var bindUpdates = new List<PlanStepContext>();
            var receivedSteps = new List<PlanStepContext>();
            var triggeredSteps = new List<TriggeredStepContext>();
            var finishedSteps = new List<FinishedStepContext>();

            foreach (var activity in orderedActivities)
            {
                var sessionContext = ResolveSessionContext(sessionInfoActivities, activity.index, conversationId, agentId);

                if (IsActivityMatch(activity, "DynamicPlanStepBindUpdate"))
                {
                    bindUpdates.Add(CreatePlanStepContext(activity.valueToken, activity.index, sessionContext));
                    continue;
                }

                if (IsActivityMatch(activity, "DynamicPlanReceived"))
                {
                    var planIdentifier = GetPropertyValue(activity.valueToken, "planIdentifier");
                    var stepsToken = GetPropertyToken(activity.valueToken, "steps") as JArray;
                    if (stepsToken == null)
                    {
                        continue;
                    }

                    foreach (var stepToken in stepsToken)
                    {
                        var receivedStep = CreatePlanStepContext(stepToken, activity.index, sessionContext);
                        if (string.IsNullOrWhiteSpace(receivedStep.PlanIdentifier))
                        {
                            receivedStep.PlanIdentifier = planIdentifier;
                        }

                        receivedSteps.Add(receivedStep);
                    }

                    continue;
                }

                if (IsActivityMatch(activity, "DynamicPlanStepTriggered"))
                {
                    triggeredSteps.Add(new TriggeredStepContext
                    {
                        Index = activity.index,
                        SessionID = sessionContext.SessionID,
                        SessionEndIndex = sessionContext.SessionEndIndex,
                        PlanIdentifier = GetPropertyValue(activity.valueToken, "planIdentifier"),
                        StepId = GetStepId(activity.valueToken),
                        TaskDialogId = GetPropertyValue(activity.valueToken, "taskDialogId"),
                        RawStepType = GetPropertyValue(activity.valueToken, "type"),
                        SourceToken = activity.valueToken
                    });

                    continue;
                }

                if (IsActivityMatch(activity, "DynamicPlanStepFinished"))
                {
                    finishedSteps.Add(new FinishedStepContext
                    {
                        Index = activity.index,
                        SessionID = sessionContext.SessionID,
                        SessionEndIndex = sessionContext.SessionEndIndex,
                        PlanIdentifier = GetPropertyValue(activity.valueToken, "planIdentifier"),
                        StepId = GetStepId(activity.valueToken),
                        State = GetPropertyValue(activity.valueToken, "state"),
                        ExecutionTime = GetPropertyValue(activity.valueToken, "executionTime"),
                        Observation = GetPropertyToken(activity.valueToken, "observation"),
                        SourceToken = activity.valueToken
                    });
                }
            }

            foreach (var receivedStep in receivedSteps)
            {
                EnrichPlanStepContext(receivedStep, bindUpdates);
            }

            foreach (var triggeredStep in triggeredSteps)
            {
                EnrichPlanStepContext(triggeredStep, bindUpdates, receivedSteps);
            }

            var toolExecutions = new List<ToolExecution>();
            var matchedFinishIndexes = new HashSet<int>();

            foreach (var triggeredStep in triggeredSteps.OrderBy(step => step.Index))
            {
                if (ShouldSkipToolExecution(triggeredStep))
                {
                    continue;
                }

                var finishedStep = FindMatchingFinishedStep(triggeredStep, finishedSteps, matchedFinishIndexes);
                var executionStatus = ResolveExecutionStatus(finishedStep);

                toolExecutions.Add(new ToolExecution
                {
                    SessionID = triggeredStep.SessionID,
                    TaskDialogId = NormalizeTaskDialogId(triggeredStep.TaskDialogId),
                    StepType = ResolveStepType(triggeredStep, finishedStep),
                    ExecutionTimeSeconds = finishedStep == null ? (double?)null : ParseExecutionTimeSeconds(finishedStep.ExecutionTime),
                    ExecutionStatus = executionStatus,
                    Succeeded = string.Equals(executionStatus, "Succeeded", StringComparison.OrdinalIgnoreCase),
                    FailureMessage = string.Equals(executionStatus, "Failed", StringComparison.OrdinalIgnoreCase)
                        ? GetFailureMessage(finishedStep)
                        : null
                });
            }

            foreach (var receivedStep in receivedSteps.OrderBy(step => step.Index))
            {
                if (!HasIdentifyingMetadata(receivedStep)
                    || ShouldSkipToolExecution(receivedStep)
                    || HasMatchingTriggeredStep(receivedStep, triggeredSteps))
                {
                    continue;
                }

                toolExecutions.Add(new ToolExecution
                {
                    SessionID = receivedStep.SessionID,
                    TaskDialogId = NormalizeTaskDialogId(receivedStep.TaskDialogId),
                    StepType = ResolveStepType(receivedStep, null),
                    ExecutionTimeSeconds = null,
                    ExecutionStatus = "Skipped",
                    Succeeded = false,
                    FailureMessage = null
                });
            }

            return toolExecutions
                .OrderBy(item => item.SessionID)
                .ThenBy(item => item.TaskDialogId)
                .ThenBy(item => item.StepType)
                .ThenBy(item => item.ExecutionStatus)
                .ToList();
        }

        private static void EnrichPlanStepContext(PlanStepContext planStep, List<PlanStepContext> bindUpdates)
        {
            var matchingBindUpdate = bindUpdates
                .Where(step => string.Equals(step.SessionID, planStep.SessionID, StringComparison.OrdinalIgnoreCase))
                .Where(step => step.Index >= planStep.Index)
                .Where(step => IsSameStep(planStep, step))
                .OrderBy(step => step.Index)
                .FirstOrDefault();

            ApplyMetadata(planStep, matchingBindUpdate);
        }

        private static void EnrichPlanStepContext(TriggeredStepContext triggeredStep, List<PlanStepContext> bindUpdates, List<PlanStepContext> receivedSteps)
        {
            var matchingBindUpdate = bindUpdates
                .Where(step => string.Equals(step.SessionID, triggeredStep.SessionID, StringComparison.OrdinalIgnoreCase))
                .Where(step => step.Index >= triggeredStep.Index)
                .Where(step => IsSameStep(triggeredStep, step))
                .OrderBy(step => step.Index)
                .FirstOrDefault();

            ApplyMetadata(triggeredStep, matchingBindUpdate);

            var matchingReceivedStep = receivedSteps
                .Where(step => string.Equals(step.SessionID, triggeredStep.SessionID, StringComparison.OrdinalIgnoreCase))
                .Where(step => step.Index <= triggeredStep.Index)
                .Where(step => IsSameStep(triggeredStep, step))
                .OrderByDescending(step => step.Index)
                .FirstOrDefault();

            ApplyMetadata(triggeredStep, matchingReceivedStep);
        }

        private static void ApplyMetadata(PlanStepContext target, PlanStepContext source)
        {
            if (source == null)
            {
                return;
            }

            if (string.IsNullOrWhiteSpace(target.PlanIdentifier))
            {
                target.PlanIdentifier = source.PlanIdentifier;
            }

            if (string.IsNullOrWhiteSpace(target.StepId))
            {
                target.StepId = source.StepId;
            }

            if (string.IsNullOrWhiteSpace(target.TaskDialogId))
            {
                target.TaskDialogId = source.TaskDialogId;
            }

            if (string.IsNullOrWhiteSpace(target.RawStepType))
            {
                target.RawStepType = source.RawStepType;
            }

            if (target.SourceToken == null)
            {
                target.SourceToken = source.SourceToken;
            }
        }

        private static FinishedStepContext FindMatchingFinishedStep(
            TriggeredStepContext triggeredStep,
            List<FinishedStepContext> finishedSteps,
            HashSet<int> matchedFinishIndexes)
        {
            var exactMatch = finishedSteps
                .Where(step => !matchedFinishIndexes.Contains(step.Index))
                .Where(step => string.Equals(step.SessionID, triggeredStep.SessionID, StringComparison.OrdinalIgnoreCase))
                .Where(step => step.Index > triggeredStep.Index && step.Index < triggeredStep.SessionEndIndex)
                .Where(step => !string.IsNullOrWhiteSpace(triggeredStep.StepId)
                    && string.Equals(step.StepId, triggeredStep.StepId, StringComparison.OrdinalIgnoreCase))
                .Where(step => string.IsNullOrWhiteSpace(triggeredStep.PlanIdentifier)
                    || string.IsNullOrWhiteSpace(step.PlanIdentifier)
                    || string.Equals(step.PlanIdentifier, triggeredStep.PlanIdentifier, StringComparison.OrdinalIgnoreCase))
                .OrderBy(step => step.Index)
                .FirstOrDefault();

            if (exactMatch != null)
            {
                matchedFinishIndexes.Add(exactMatch.Index);
                return exactMatch;
            }

            var fallbackMatch = finishedSteps
                .Where(step => !matchedFinishIndexes.Contains(step.Index))
                .Where(step => string.Equals(step.SessionID, triggeredStep.SessionID, StringComparison.OrdinalIgnoreCase))
                .Where(step => step.Index > triggeredStep.Index && step.Index < triggeredStep.SessionEndIndex)
                .Where(step => !string.IsNullOrWhiteSpace(triggeredStep.PlanIdentifier)
                    && string.Equals(step.PlanIdentifier, triggeredStep.PlanIdentifier, StringComparison.OrdinalIgnoreCase))
                .OrderBy(step => step.Index)
                .FirstOrDefault();

            if (fallbackMatch != null)
            {
                matchedFinishIndexes.Add(fallbackMatch.Index);
            }

            return fallbackMatch;
        }

        private static bool HasMatchingTriggeredStep(PlanStepContext receivedStep, List<TriggeredStepContext> triggeredSteps)
        {
            return triggeredSteps.Any(triggeredStep =>
                string.Equals(triggeredStep.SessionID, receivedStep.SessionID, StringComparison.OrdinalIgnoreCase)
                && triggeredStep.Index > receivedStep.Index
                && triggeredStep.Index < receivedStep.SessionEndIndex
                && IsSameStep(receivedStep, triggeredStep));
        }

        private static bool IsSameStep(PlanStepContext first, PlanStepContext second)
        {
            if (first == null || second == null)
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(first.StepId) && !string.IsNullOrWhiteSpace(second.StepId))
            {
                return string.Equals(first.StepId, second.StepId, StringComparison.OrdinalIgnoreCase);
            }

            if (!string.IsNullOrWhiteSpace(first.PlanIdentifier) && !string.IsNullOrWhiteSpace(second.PlanIdentifier)
                && !string.Equals(first.PlanIdentifier, second.PlanIdentifier, StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(first.TaskDialogId) && !string.IsNullOrWhiteSpace(second.TaskDialogId))
            {
                return string.Equals(first.TaskDialogId, second.TaskDialogId, StringComparison.OrdinalIgnoreCase);
            }

            if (!string.IsNullOrWhiteSpace(first.RawStepType) && !string.IsNullOrWhiteSpace(second.RawStepType))
            {
                return string.Equals(first.RawStepType, second.RawStepType, StringComparison.OrdinalIgnoreCase);
            }

            return !string.IsNullOrWhiteSpace(first.PlanIdentifier)
                && string.Equals(first.PlanIdentifier, second.PlanIdentifier, StringComparison.OrdinalIgnoreCase);
        }

        private static string ResolveExecutionStatus(FinishedStepContext finishedStep)
        {
            if (finishedStep == null)
            {
                return "Incomplete";
            }

            if (HasFailureSignal(finishedStep))
            {
                return "Failed";
            }

            var state = finishedStep.State;
            if (IsSuccessLike(state) || IsSuccessLike(GetPropertyValue(finishedStep.Observation, "operationStatus")))
            {
                return "Succeeded";
            }

            return "Failed";
        }

        private static bool HasFailureSignal(FinishedStepContext finishedStep)
        {
            if (finishedStep == null)
            {
                return false;
            }

            if (!string.IsNullOrWhiteSpace(finishedStep.State) && !IsSuccessLike(finishedStep.State))
            {
                return true;
            }

            var observation = finishedStep.Observation;
            if (HasNonEmptyProperty(observation, "error")
                || HasNonEmptyProperty(observation, "errors")
                || HasNonEmptyProperty(observation, "exception"))
            {
                return true;
            }

            var operationStatus = GetPropertyValue(observation, "operationStatus");
            if (!string.IsNullOrWhiteSpace(operationStatus) && !IsSuccessLike(operationStatus))
            {
                return true;
            }

            return false;
        }

        private static string GetFailureMessage(FinishedStepContext finishedStep)
        {
            if (finishedStep == null)
            {
                return null;
            }

            var observation = finishedStep.Observation;
            return GetNestedPropertyValue(observation, "error", "message")
                ?? GetPropertyValue(observation, "error")
                ?? GetNestedPropertyValue(observation, "exception", "message")
                ?? GetPropertyValue(observation, "exception")
                ?? GetFirstArrayMessage(observation, "errors")
                ?? GetPropertyValue(observation, "message")
                ?? GetNestedPropertyValue(finishedStep.SourceToken, "error", "message")
                ?? GetPropertyValue(finishedStep.SourceToken, "error")
                ?? GetNestedPropertyValue(finishedStep.SourceToken, "exception", "message")
                ?? GetPropertyValue(finishedStep.SourceToken, "exception")
                ?? GetFirstArrayMessage(finishedStep.SourceToken, "errors")
                ?? GetPropertyValue(finishedStep.SourceToken, "message")
                ?? (!string.IsNullOrWhiteSpace(finishedStep.State) && !IsSuccessLike(finishedStep.State)
                    ? finishedStep.State
                    : null);
        }

        private static double? ParseExecutionTimeSeconds(string executionTime)
        {
            if (string.IsNullOrWhiteSpace(executionTime))
            {
                return null;
            }

            TimeSpan parsedTimeSpan;
            if (!TimeSpan.TryParse(executionTime, out parsedTimeSpan))
            {
                return null;
            }

            return Math.Round(parsedTimeSpan.TotalSeconds, 3);
        }

        private static string ResolveStepType(PlanStepContext step, FinishedStepContext finishedStep)
        {
            var rawTaskDialogId = step?.TaskDialogId;
            if (!string.IsNullOrWhiteSpace(rawTaskDialogId))
            {
                if (rawTaskDialogId.StartsWith("MCP:", StringComparison.OrdinalIgnoreCase))
                {
                    return "Mcp";
                }

                if (string.Equals(rawTaskDialogId, "P:UniversalSearchTool", StringComparison.OrdinalIgnoreCase))
                {
                    return "KnowledgeSource";
                }

                if (string.Equals(rawTaskDialogId, "P:CodeTool", StringComparison.OrdinalIgnoreCase))
                {
                    return "Code";
                }

                if (string.Equals(rawTaskDialogId, "P:ReasonerTool", StringComparison.OrdinalIgnoreCase))
                {
                    return "Reasoning";
                }
            }

            if (string.Equals(step?.RawStepType, "Action", StringComparison.OrdinalIgnoreCase)
                && IsCustomPromptObservation(finishedStep?.Observation))
            {
                return "CustomPrompt";
            }

            if (IsFlowStep(step))
            {
                return "Flow";
            }

            if (string.Equals(step?.RawStepType, "Action", StringComparison.OrdinalIgnoreCase))
            {
                return "Action";
            }

            return "Other";
        }

        private static bool IsCustomPromptObservation(JToken observation)
        {
            return observation != null
                && GetPropertyToken(observation, "predictionOutput") != null
                && !string.IsNullOrWhiteSpace(GetPropertyValue(observation, "operationStatus"));
        }

        private static bool IsFlowStep(PlanStepContext step)
        {
            if (step?.SourceToken == null)
            {
                return false;
            }

            var candidateValues = new[]
            {
                GetPropertyValue(step.SourceToken, "actionDefinitionType"),
                GetPropertyValue(step.SourceToken, "actionType"),
                GetPropertyValue(step.SourceToken, "definitionType"),
                GetPropertyValue(step.SourceToken, "operationType"),
                GetNestedPropertyValue(step.SourceToken, "actionDefinition", "type"),
                GetNestedPropertyValue(step.SourceToken, "actionDefinition", "definitionType"),
                GetNestedPropertyValue(step.SourceToken, "actionDefinition", "operationType")
            };

            return candidateValues.Any(value => IsFlowMetadataValue(value));
        }

        private static bool IsFlowMetadataValue(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return false;
            }

            return string.Equals(value, "Flow", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "CloudFlow", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "Cloud Flow", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "cloud-flow", StringComparison.OrdinalIgnoreCase);
        }

        private static string NormalizeTaskDialogId(string taskDialogId)
        {
            if (string.Equals(taskDialogId, "P:UniversalSearchTool", StringComparison.OrdinalIgnoreCase))
            {
                return "KnowledgeSource";
            }

            if (string.Equals(taskDialogId, "P:CodeTool", StringComparison.OrdinalIgnoreCase))
            {
                return "Code";
            }

            if (string.Equals(taskDialogId, "P:ReasonerTool", StringComparison.OrdinalIgnoreCase))
            {
                return "Reasoning";
            }

            return taskDialogId;
        }

        private static bool IsActivityMatch(Activity activity, string valueType)
        {
            return activity != null
                && (string.Equals(activity.valueType, valueType, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(activity.name, valueType, StringComparison.OrdinalIgnoreCase));
        }

        private static bool HasIdentifyingMetadata(PlanStepContext step)
        {
            return step != null
                && (!string.IsNullOrWhiteSpace(step.TaskDialogId)
                    || !string.IsNullOrWhiteSpace(step.RawStepType));
        }

        private static bool ShouldSkipToolExecution(PlanStepContext step)
        {
            if (step == null || string.IsNullOrWhiteSpace(step.TaskDialogId))
            {
                return false;
            }

            var taskDialogId = step.TaskDialogId;
            return string.Equals(taskDialogId, "P:UniversalSearchTool", StringComparison.OrdinalIgnoreCase)
                || taskDialogId.IndexOf(".topic.", StringComparison.OrdinalIgnoreCase) >= 0
                || taskDialogId.IndexOf(".InvokeConnectedAgentTaskAction.", StringComparison.OrdinalIgnoreCase) >= 0
                || taskDialogId.IndexOf("agent.Agent", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        private static bool IsSuccessLike(string value)
        {
            return string.Equals(value, "completed", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "success", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "succeeded", StringComparison.OrdinalIgnoreCase);
        }

        private static bool HasNonEmptyProperty(JToken token, string propertyName)
        {
            var propertyToken = GetPropertyToken(token, propertyName);
            if (propertyToken == null || propertyToken.Type == JTokenType.Null || propertyToken.Type == JTokenType.Undefined)
            {
                return false;
            }

            if (propertyToken.Type == JTokenType.String)
            {
                return !string.IsNullOrWhiteSpace(propertyToken.ToString());
            }

            if (propertyToken.Type == JTokenType.Array)
            {
                return propertyToken.Any();
            }

            return true;
        }

        private static string GetFirstArrayMessage(JToken token, string propertyName)
        {
            var arrayToken = GetPropertyToken(token, propertyName) as JArray;
            if (arrayToken == null)
            {
                return null;
            }

            foreach (var child in arrayToken)
            {
                if (child == null || child.Type == JTokenType.Null || child.Type == JTokenType.Undefined)
                {
                    continue;
                }

                if (child.Type == JTokenType.String)
                {
                    var value = child.ToString();
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        return value;
                    }
                }

                var message = GetPropertyValue(child, "message");
                if (!string.IsNullOrWhiteSpace(message))
                {
                    return message;
                }
            }

            return null;
        }

        private static string GetNestedPropertyValue(JToken token, params string[] propertyNames)
        {
            var nestedToken = GetNestedPropertyToken(token, propertyNames);
            if (nestedToken == null || nestedToken.Type == JTokenType.Null || nestedToken.Type == JTokenType.Undefined)
            {
                return null;
            }

            return nestedToken.Type == JTokenType.String ? nestedToken.ToString() : nestedToken.ToString(Newtonsoft.Json.Formatting.None);
        }

        private static JToken GetNestedPropertyToken(JToken token, params string[] propertyNames)
        {
            var currentToken = token;
            foreach (var propertyName in propertyNames)
            {
                currentToken = GetPropertyToken(currentToken, propertyName);
                if (currentToken == null)
                {
                    return null;
                }
            }

            return currentToken;
        }

        private static string GetStepId(JToken token)
        {
            return GetPropertyValue(token, "stepId")
                ?? GetPropertyValue(token, "id");
        }

        private static string GetPropertyValue(JToken token, string propertyName)
        {
            var propertyToken = GetPropertyToken(token, propertyName);
            if (propertyToken == null || propertyToken.Type == JTokenType.Null || propertyToken.Type == JTokenType.Undefined)
            {
                return null;
            }

            return propertyToken.Type == JTokenType.String ? propertyToken.ToString() : propertyToken.ToString(Newtonsoft.Json.Formatting.None);
        }

        private static JToken GetPropertyToken(JToken token, string propertyName)
        {
            var jsonObject = token as JObject;
            if (jsonObject == null)
            {
                return null;
            }

            var property = jsonObject.Properties()
                .FirstOrDefault(currentProperty => string.Equals(currentProperty.Name, propertyName, StringComparison.OrdinalIgnoreCase));

            return property?.Value;
        }

        private static PlanStepContext CreatePlanStepContext(JToken sourceToken, int index, SessionContext sessionContext)
        {
            if (sourceToken != null && sourceToken.Type == JTokenType.String)
            {
                return new PlanStepContext
                {
                    Index = index,
                    SessionID = sessionContext.SessionID,
                    SessionEndIndex = sessionContext.SessionEndIndex,
                    TaskDialogId = sourceToken.ToString(),
                    SourceToken = sourceToken
                };
            }

            return new PlanStepContext
            {
                Index = index,
                SessionID = sessionContext.SessionID,
                SessionEndIndex = sessionContext.SessionEndIndex,
                PlanIdentifier = GetPropertyValue(sourceToken, "planIdentifier"),
                StepId = GetStepId(sourceToken),
                TaskDialogId = GetPropertyValue(sourceToken, "taskDialogId"),
                RawStepType = GetPropertyValue(sourceToken, "type"),
                SourceToken = sourceToken
            };
        }

        private static SessionContext ResolveSessionContext(List<Activity> sessionInfoActivities, int activityIndex, string conversationId, string agentId)
        {
            var sessionInfo = sessionInfoActivities.FirstOrDefault(activity => activity.index > activityIndex);
            return new SessionContext
            {
                SessionID = $"{agentId}-{conversationId}-{sessionInfo?.timestamp}-{sessionInfo?.id}",
                SessionEndIndex = sessionInfo?.index ?? int.MaxValue
            };
        }

        private class SessionContext
        {
            public string SessionID { get; set; }
            public int SessionEndIndex { get; set; }
        }

        private class PlanStepContext
        {
            public int Index { get; set; }
            public string SessionID { get; set; }
            public int SessionEndIndex { get; set; }
            public string PlanIdentifier { get; set; }
            public string StepId { get; set; }
            public string TaskDialogId { get; set; }
            public string RawStepType { get; set; }
            public JToken SourceToken { get; set; }
        }

        private class TriggeredStepContext : PlanStepContext
        {
        }

        private class FinishedStepContext : PlanStepContext
        {
            public string State { get; set; }
            public string ExecutionTime { get; set; }
            public JToken Observation { get; set; }
        }
    }
}
