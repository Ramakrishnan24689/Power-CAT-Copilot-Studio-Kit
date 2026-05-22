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
        /// <summary>
        /// Processes transcript activities and returns tool execution records for the conversation.
        /// </summary>
        /// <param name="model">The transcript activities to process.</param>
        /// <param name="conversationId">The conversation identifier used to build session ids.</param>
        /// <param name="agentId">The agent identifier used to build session ids.</param>
        /// <returns>The tool executions found in the transcript.</returns>
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
                        TaskDialogId = GetPropertyValue(activity.valueToken, "taskDialogId"),
                        RawStepType = GetPropertyValue(activity.valueToken, "type"),
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
                if (IsSkippedTaskDialogId(triggeredStep.TaskDialogId))
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
                    FailureMessage = string.Equals(executionStatus, "Failed", StringComparison.OrdinalIgnoreCase)
                        ? GetFailureMessage(finishedStep)
                        : null
                });
            }

            foreach (var receivedStep in receivedSteps.OrderBy(step => step.Index))
            {
                if (!HasIdentifyingMetadata(receivedStep)
                    || IsSkippedTaskDialogId(receivedStep.TaskDialogId)
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

        /// <summary>
        /// Enriches a plan step with metadata from a matching bind update.
        /// </summary>
        /// <param name="planStep">The plan step to enrich.</param>
        /// <param name="bindUpdates">The bind updates available in the transcript.</param>
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

        /// <summary>
        /// Enriches a triggered step with metadata from matching bind updates and received plan steps.
        /// </summary>
        /// <param name="triggeredStep">The triggered step to enrich.</param>
        /// <param name="bindUpdates">The bind updates available in the transcript.</param>
        /// <param name="receivedSteps">The received plan steps available in the transcript.</param>
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

        /// <summary>
        /// Copies missing plan step metadata from the source context to the target context.
        /// </summary>
        /// <param name="target">The plan step context to update.</param>
        /// <param name="source">The plan step context containing metadata.</param>
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

        /// <summary>
        /// Finds the finished step that matches the specified triggered step.
        /// </summary>
        /// <param name="triggeredStep">The triggered step to match.</param>
        /// <param name="finishedSteps">The finished steps available in the transcript.</param>
        /// <param name="matchedFinishIndexes">The finished step indexes already matched to triggered steps.</param>
        /// <returns>The matching finished step, or null when no match is found.</returns>
        private static FinishedStepContext FindMatchingFinishedStep(
            TriggeredStepContext triggeredStep,
            List<FinishedStepContext> finishedSteps,
            HashSet<int> matchedFinishIndexes)
        {
            var candidateFinishedSteps = finishedSteps
                .Where(step => !matchedFinishIndexes.Contains(step.Index))
                .Where(step => string.Equals(step.SessionID, triggeredStep.SessionID, StringComparison.OrdinalIgnoreCase))
                .Where(step => step.Index > triggeredStep.Index && step.Index < triggeredStep.SessionEndIndex);

            var exactMatch = candidateFinishedSteps
                .Where(step => !string.IsNullOrWhiteSpace(triggeredStep.StepId)
                    && string.Equals(step.StepId, triggeredStep.StepId, StringComparison.OrdinalIgnoreCase))
                .OrderBy(step => step.Index)
                .FirstOrDefault();

            if (exactMatch != null)
            {
                matchedFinishIndexes.Add(exactMatch.Index);
                return exactMatch;
            }

            var taskDialogMatch = candidateFinishedSteps
                .Where(step => IsSamePlan(triggeredStep, step))
                .Where(step => !string.IsNullOrWhiteSpace(triggeredStep.TaskDialogId)
                    && string.Equals(step.TaskDialogId, triggeredStep.TaskDialogId, StringComparison.OrdinalIgnoreCase))
                .OrderBy(step => step.Index)
                .FirstOrDefault();

            if (taskDialogMatch != null)
            {
                matchedFinishIndexes.Add(taskDialogMatch.Index);
                return taskDialogMatch;
            }

            var rawStepTypeMatch = candidateFinishedSteps
                .Where(step => IsSamePlan(triggeredStep, step))
                .Where(step => !string.IsNullOrWhiteSpace(triggeredStep.RawStepType)
                    && string.Equals(step.RawStepType, triggeredStep.RawStepType, StringComparison.OrdinalIgnoreCase))
                .OrderBy(step => step.Index)
                .FirstOrDefault();

            if (rawStepTypeMatch != null)
            {
                matchedFinishIndexes.Add(rawStepTypeMatch.Index);
                return rawStepTypeMatch;
            }

            if (!HasUsableCorrelationMetadata(triggeredStep))
            {
                var fallbackMatch = candidateFinishedSteps
                    .Where(step => IsSamePlan(triggeredStep, step))
                    .OrderBy(step => step.Index)
                    .FirstOrDefault();

                if (fallbackMatch != null)
                {
                    matchedFinishIndexes.Add(fallbackMatch.Index);
                }

                return fallbackMatch;
            }

            return null;
        }

        /// <summary>
        /// Determines whether a finished step is in the same plan as a triggered step.
        /// </summary>
        /// <param name="triggeredStep">The triggered step to compare.</param>
        /// <param name="finishedStep">The finished step to compare.</param>
        /// <returns>True when both steps have the same plan identifier; otherwise, false.</returns>
        private static bool IsSamePlan(TriggeredStepContext triggeredStep, FinishedStepContext finishedStep)
        {
            return !string.IsNullOrWhiteSpace(triggeredStep.PlanIdentifier)
                && !string.IsNullOrWhiteSpace(finishedStep.PlanIdentifier)
                && string.Equals(finishedStep.PlanIdentifier, triggeredStep.PlanIdentifier, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Determines whether a triggered step has metadata that can safely correlate to a finished step.
        /// </summary>
        /// <param name="triggeredStep">The triggered step to evaluate.</param>
        /// <returns>True when correlation metadata exists; otherwise, false.</returns>
        private static bool HasUsableCorrelationMetadata(TriggeredStepContext triggeredStep)
        {
            return !string.IsNullOrWhiteSpace(triggeredStep.StepId)
                || !string.IsNullOrWhiteSpace(triggeredStep.TaskDialogId)
                || !string.IsNullOrWhiteSpace(triggeredStep.RawStepType);
        }

        /// <summary>
        /// Determines whether a received plan step has a matching triggered step.
        /// </summary>
        /// <param name="receivedStep">The received plan step to check.</param>
        /// <param name="triggeredSteps">The triggered steps available in the transcript.</param>
        /// <returns>True when a matching triggered step exists; otherwise, false.</returns>
        private static bool HasMatchingTriggeredStep(PlanStepContext receivedStep, List<TriggeredStepContext> triggeredSteps)
        {
            return triggeredSteps.Any(triggeredStep =>
                string.Equals(triggeredStep.SessionID, receivedStep.SessionID, StringComparison.OrdinalIgnoreCase)
                && triggeredStep.Index > receivedStep.Index
                && triggeredStep.Index < receivedStep.SessionEndIndex
                && IsSameStep(receivedStep, triggeredStep));
        }

        /// <summary>
        /// Determines whether two plan step contexts refer to the same step.
        /// </summary>
        /// <param name="first">The first plan step context.</param>
        /// <param name="second">The second plan step context.</param>
        /// <returns>True when both contexts identify the same step; otherwise, false.</returns>
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

        /// <summary>
        /// Resolves the execution status for a finished step.
        /// </summary>
        /// <param name="finishedStep">The finished step to evaluate.</param>
        /// <returns>The execution status value.</returns>
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

        /// <summary>
        /// Determines whether a finished step contains failure signals.
        /// </summary>
        /// <param name="finishedStep">The finished step to evaluate.</param>
        /// <returns>True when a failure signal exists; otherwise, false.</returns>
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
                || HasNonEmptyProperty(observation, "exception")
                || IsTrueProperty(observation, "isError"))
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

        /// <summary>
        /// Gets a failure message from a finished step.
        /// </summary>
        /// <param name="finishedStep">The finished step containing failure details.</param>
        /// <returns>The failure message, or null when no message is found.</returns>
        private static string GetFailureMessage(FinishedStepContext finishedStep)
        {
            if (finishedStep == null)
            {
                return null;
            }

            var observation = finishedStep.Observation;
            return SanitizeFailureMessage(GetNestedPropertyValue(observation, "error", "message"))
                ?? SanitizeFailureMessage(GetNestedPropertyValue(observation, "error", "innerError", "error", "message"))
                ?? SanitizeFailureMessage(GetSimplePropertyValue(observation, "error"))
                ?? SanitizeFailureMessage(GetNestedPropertyValue(observation, "exception", "message"))
                ?? SanitizeFailureMessage(GetSimplePropertyValue(observation, "exception"))
                ?? SanitizeFailureMessage(GetFirstArrayMessage(observation, "errors"))
                ?? SanitizeFailureMessage(GetSimplePropertyValue(observation, "message"))
                ?? GetContentFailureMessage(observation)
                ?? SanitizeFailureMessage(GetNestedPropertyValue(finishedStep.SourceToken, "error", "message"))
                ?? SanitizeFailureMessage(GetNestedPropertyValue(finishedStep.SourceToken, "error", "innerError", "error", "message"))
                ?? SanitizeFailureMessage(GetSimplePropertyValue(finishedStep.SourceToken, "error"))
                ?? SanitizeFailureMessage(GetNestedPropertyValue(finishedStep.SourceToken, "exception", "message"))
                ?? SanitizeFailureMessage(GetSimplePropertyValue(finishedStep.SourceToken, "exception"))
                ?? SanitizeFailureMessage(GetFirstArrayMessage(finishedStep.SourceToken, "errors"))
                ?? SanitizeFailureMessage(GetSimplePropertyValue(finishedStep.SourceToken, "message"))
                ?? (!string.IsNullOrWhiteSpace(finishedStep.State) && !IsSuccessLike(finishedStep.State)
                    ? SanitizeFailureMessage(finishedStep.State)
                    : null);
        }

        /// <summary>
        /// Gets a compact failure message from MCP/tool content items.
        /// </summary>
        /// <param name="observation">The observation token to inspect.</param>
        /// <returns>The failure message, or null when none is found.</returns>
        private static string GetContentFailureMessage(JToken observation)
        {
            var contentArray = GetPropertyToken(observation, "content") as JArray;
            if (contentArray == null)
            {
                return null;
            }

            foreach (var contentItem in contentArray)
            {
                var text = GetSimplePropertyValue(contentItem, "text");
                if (string.IsNullOrWhiteSpace(text))
                {
                    continue;
                }

                var jsonMessage = GetMessageFromJsonText(text);
                if (!string.IsNullOrWhiteSpace(jsonMessage))
                {
                    return SanitizeFailureMessage(jsonMessage);
                }

                var message = SanitizeFailureMessage(text);
                if (!string.IsNullOrWhiteSpace(message))
                {
                    return message;
                }
            }

            return null;
        }

        /// <summary>
        /// Gets a compact message from JSON encoded text.
        /// </summary>
        /// <param name="text">The text to parse.</param>
        /// <returns>The message, or null when no known message property is found.</returns>
        private static string GetMessageFromJsonText(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return null;
            }

            try
            {
                var token = JToken.Parse(text);
                return GetNestedPropertyValue(token, "error", "message")
                    ?? GetNestedPropertyValue(token, "error", "innerError", "error", "message")
                    ?? GetNestedPropertyValue(token, "innerError", "error", "message")
                    ?? GetNestedPropertyValue(token, "exception", "message")
                    ?? GetSimplePropertyValue(token, "message");
            }
            catch (Newtonsoft.Json.JsonException)
            {
                return null;
            }
        }

        /// <summary>
        /// Normalizes and limits a failure message for KPI storage.
        /// </summary>
        /// <param name="message">The failure message to sanitize.</param>
        /// <returns>The sanitized failure message, or null when empty.</returns>
        private static string SanitizeFailureMessage(string message)
        {
            const int maxFailureMessageLength = 500;
            if (string.IsNullOrWhiteSpace(message))
            {
                return null;
            }

            var compactMessage = string.Join(" ", message
                .Split(new[] { '\r', '\n', '\t' }, StringSplitOptions.RemoveEmptyEntries)
                .Select(part => part.Trim())
                .Where(part => !string.IsNullOrWhiteSpace(part)));

            if (compactMessage.Length <= maxFailureMessageLength)
            {
                return compactMessage;
            }

            return compactMessage.Substring(0, maxFailureMessageLength) + "...";
        }

        /// <summary>
        /// Parses an execution time value into seconds.
        /// </summary>
        /// <param name="executionTime">The execution time value to parse.</param>
        /// <returns>The execution time in seconds, or null when the value cannot be parsed.</returns>
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

        /// <summary>
        /// Resolves the normalized tool step type for a plan step.
        /// </summary>
        /// <param name="step">The plan step context to evaluate.</param>
        /// <param name="finishedStep">The matching finished step, when available.</param>
        /// <returns>The resolved step type.</returns>
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

            if (string.Equals(step?.RawStepType, "Action", StringComparison.OrdinalIgnoreCase))
            {
                return "Action";
            }

            return "Other";
        }

        /// <summary>
        /// Determines whether an observation represents a custom prompt result.
        /// </summary>
        /// <param name="observation">The observation token to evaluate.</param>
        /// <returns>True when the observation represents a custom prompt result; otherwise, false.</returns>
        private static bool IsCustomPromptObservation(JToken observation)
        {
            return observation != null
                && GetPropertyToken(observation, "predictionOutput") != null
                && !string.IsNullOrWhiteSpace(GetPropertyValue(observation, "operationStatus"));
        }

        /// <summary>
        /// Normalizes known task dialog ids to display-friendly values.
        /// </summary>
        /// <param name="taskDialogId">The task dialog id to normalize.</param>
        /// <returns>The normalized task dialog id.</returns>
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

        /// <summary>
        /// Determines whether an activity matches a transcript value type.
        /// </summary>
        /// <param name="activity">The activity to evaluate.</param>
        /// <param name="valueType">The expected value type.</param>
        /// <returns>True when the activity value type or name matches; otherwise, false.</returns>
        private static bool IsActivityMatch(Activity activity, string valueType)
        {
            return activity != null
                && (string.Equals(activity.valueType, valueType, StringComparison.OrdinalIgnoreCase)
                    || string.Equals(activity.name, valueType, StringComparison.OrdinalIgnoreCase));
        }

        /// <summary>
        /// Determines whether a plan step has enough metadata to identify a tool execution.
        /// </summary>
        /// <param name="step">The plan step context to evaluate.</param>
        /// <returns>True when identifying metadata exists; otherwise, false.</returns>
        private static bool HasIdentifyingMetadata(PlanStepContext step)
        {
            return step != null
                && (!string.IsNullOrWhiteSpace(step.TaskDialogId)
                    || !string.IsNullOrWhiteSpace(step.RawStepType));
        }

        /// <summary>
        /// Determines whether a task dialog id should be skipped for tool execution metrics.
        /// </summary>
        /// <param name="taskDialogId">The task dialog id to evaluate.</param>
        /// <returns>True when the task dialog id should be skipped; otherwise, false.</returns>
        private static bool IsSkippedTaskDialogId(string taskDialogId)
        {
            if (string.IsNullOrWhiteSpace(taskDialogId))
            {
                return false;
            }

            return string.Equals(taskDialogId, "P:UniversalSearchTool", StringComparison.OrdinalIgnoreCase)
                || taskDialogId.IndexOf(".topic.", StringComparison.OrdinalIgnoreCase) >= 0
                || taskDialogId.IndexOf(".InvokeConnectedAgentTaskAction.", StringComparison.OrdinalIgnoreCase) >= 0
                || taskDialogId.IndexOf(".agent.", StringComparison.OrdinalIgnoreCase) >= 0;
        }

        /// <summary>
        /// Determines whether a status value represents success.
        /// </summary>
        /// <param name="value">The status value to evaluate.</param>
        /// <returns>True when the value represents success; otherwise, false.</returns>
        private static bool IsSuccessLike(string value)
        {
            return string.Equals(value, "completed", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "success", StringComparison.OrdinalIgnoreCase)
                || string.Equals(value, "succeeded", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Determines whether a JSON token has a non-empty property value.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <param name="propertyName">The property name to find.</param>
        /// <returns>True when the property exists and is non-empty; otherwise, false.</returns>
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

        /// <summary>
        /// Determines whether a JSON token has a property set to true.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <param name="propertyName">The property name to find.</param>
        /// <returns>True when the property value is true; otherwise, false.</returns>
        private static bool IsTrueProperty(JToken token, string propertyName)
        {
            var propertyToken = GetPropertyToken(token, propertyName);
            if (propertyToken == null || propertyToken.Type == JTokenType.Null || propertyToken.Type == JTokenType.Undefined)
            {
                return false;
            }

            if (propertyToken.Type == JTokenType.Boolean)
            {
                return propertyToken.Value<bool>();
            }

            return string.Equals(propertyToken.ToString(), "true", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// Gets a simple JSON property value as a string without serializing objects or arrays.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <param name="propertyName">The property name to find.</param>
        /// <returns>The simple property value, or null when the property is not simple.</returns>
        private static string GetSimplePropertyValue(JToken token, string propertyName)
        {
            var propertyToken = GetPropertyToken(token, propertyName);
            if (propertyToken == null || propertyToken.Type == JTokenType.Null || propertyToken.Type == JTokenType.Undefined)
            {
                return null;
            }

            if (propertyToken.Type == JTokenType.String
                || propertyToken.Type == JTokenType.Integer
                || propertyToken.Type == JTokenType.Float
                || propertyToken.Type == JTokenType.Boolean)
            {
                return propertyToken.ToString();
            }

            return null;
        }

        /// <summary>
        /// Gets the first message from an array property.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <param name="propertyName">The array property name to find.</param>
        /// <returns>The first message value, or null when none is found.</returns>
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

                var message = GetSimplePropertyValue(child, "message");
                if (!string.IsNullOrWhiteSpace(message))
                {
                    return message;
                }
            }

            return null;
        }

        /// <summary>
        /// Gets a nested JSON property value as a string.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <param name="propertyNames">The nested property names to traverse.</param>
        /// <returns>The nested property value, or null when the property is not found.</returns>
        private static string GetNestedPropertyValue(JToken token, params string[] propertyNames)
        {
            var nestedToken = GetNestedPropertyToken(token, propertyNames);
            if (nestedToken == null || nestedToken.Type == JTokenType.Null || nestedToken.Type == JTokenType.Undefined)
            {
                return null;
            }

            return nestedToken.Type == JTokenType.String ? nestedToken.ToString() : nestedToken.ToString(Newtonsoft.Json.Formatting.None);
        }

        /// <summary>
        /// Gets a nested JSON property token.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <param name="propertyNames">The nested property names to traverse.</param>
        /// <returns>The nested property token, or null when the property is not found.</returns>
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

        /// <summary>
        /// Gets a step id from a JSON token.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <returns>The step id, or null when no id is found.</returns>
        private static string GetStepId(JToken token)
        {
            return GetPropertyValue(token, "stepId")
                ?? GetPropertyValue(token, "id");
        }

        /// <summary>
        /// Gets a JSON property value as a string.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <param name="propertyName">The property name to find.</param>
        /// <returns>The property value, or null when the property is not found.</returns>
        private static string GetPropertyValue(JToken token, string propertyName)
        {
            var propertyToken = GetPropertyToken(token, propertyName);
            if (propertyToken == null || propertyToken.Type == JTokenType.Null || propertyToken.Type == JTokenType.Undefined)
            {
                return null;
            }

            return propertyToken.Type == JTokenType.String ? propertyToken.ToString() : propertyToken.ToString(Newtonsoft.Json.Formatting.None);
        }

        /// <summary>
        /// Gets a JSON property token by name using case-insensitive matching.
        /// </summary>
        /// <param name="token">The JSON token to inspect.</param>
        /// <param name="propertyName">The property name to find.</param>
        /// <returns>The property token, or null when the property is not found.</returns>
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

        /// <summary>
        /// Creates a plan step context from a transcript JSON token.
        /// </summary>
        /// <param name="sourceToken">The source JSON token for the plan step.</param>
        /// <param name="index">The transcript activity index.</param>
        /// <param name="sessionContext">The session context for the activity.</param>
        /// <returns>The created plan step context.</returns>
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

        /// <summary>
        /// Resolves the session context for an activity based on the next session info activity.
        /// </summary>
        /// <param name="sessionInfoActivities">The session info activities in the transcript.</param>
        /// <param name="activityIndex">The current activity index.</param>
        /// <param name="conversationId">The conversation identifier used to build the session id.</param>
        /// <param name="agentId">The agent identifier used to build the session id.</param>
        /// <returns>The resolved session context.</returns>
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
