import type { LocalStageAOutput, ParsedTopic, Pattern } from '../../types';

/**
 * System topics that Stage B should ignore
 * These are automatically filtered out
 */
const SYSTEM_TOPICS = [
	'conversation start',
	'conversational boosting',
	'conversation boosting',
	'end of conversation',
	'escalate',
	'fallback',
	'multiple topics matched',
	'onerror',
	'on error',
	'reset conversation',
	'sign in',
	'start over',
	'greeting',
	'goodbye',
	'thank you'
];

/**
 * Check if a topic has any fields that Stage B can evaluate for UNCLEAR patterns
 * Stage B only checks UNCLEAR patterns when fields exist and are non-empty
 * 
 * Returns true if topic has at least one of:
 * - Non-empty ModelName
 * - Non-empty ModelDescription
 * - At least one InputVariable with non-empty VariableName
 * - At least one OutputVariable with non-empty VariableName
 */
function hasEvaluableFields(topic: ParsedTopic): boolean {
	// Has model name to check for unclear naming
	if (topic.ModelName?.trim()) {
		return true;
	}

	// Has model description to check for unclear description
	if (topic.ModelDescription?.trim()) {
		return true;
	}

	// Has input variables with names to check for unclear naming
	if (topic.InputVariables?.some(v => v.VariableName?.trim())) {
		return true;
	}

	// Has input variables with descriptions to check for unclear descriptions
	if (topic.InputVariables?.some(v => v.VariableDescription?.trim())) {
		return true;
	}

	// Has output variables with names to check for unclear naming
	if (topic.OutputVariables?.some(v => v.VariableName?.trim())) {
		return true;
	}

	// Has output variables with descriptions to check for unclear descriptions
	if (topic.OutputVariables?.some(v => v.VariableDescription?.trim())) {
		return true;
	}

	return false;
}

/**
 * Check if a topic is a system topic that should be excluded
 */
function isSystemTopic(topicName: string): boolean {
	const normalized = topicName.trim().toLowerCase();
	return SYSTEM_TOPICS.includes(normalized);
}

/**
 * Filter Stage A output to only include data needed by Stage B
 * 
 * Stage B only evaluates UNCLEAR patterns in these fields:
 * - ModelName, ModelDescription
 * - InputVariables (name + description)
 * - OutputVariables (name + description)
 * 
 * This filter:
 * 1. Removes system topics (always excluded)
 * 2. Removes topics with NO evaluable fields
 * 3. Strips unnecessary fields to reduce token usage:
 *    - Tools (checked by checkExcessTools instead)
 *    - KnowledgeSources (not evaluated)
 *    - TestCases (not evaluated)
 *    - Conditions (not evaluated per topic)
 * 
 * @param stageAOutput - Raw Stage A output with all topics and components
 * @returns Minimal output with only evaluable Topics (60-80% token reduction)
 */
export function filterForStageB(stageAOutput: LocalStageAOutput): LocalStageAOutput {
	const originalCount = stageAOutput.Components.Topics.length;

	const filteredTopics = stageAOutput.Components.Topics
		.filter(topic => {
			// Exclude system topics
			if (isSystemTopic(topic.TopicName)) {
				console.log(`[Stage B Filter] ❌ Excluding system topic: "${topic.TopicName}"`);
				return false;
			}

			// Exclude topics with nothing to evaluate
			const hasFields = hasEvaluableFields(topic);
			if (!hasFields) {
				console.log(`[Stage B Filter] ⚠️ Excluding empty topic: "${topic.TopicName}" (no evaluable fields)`);
				return false;
			}

			console.log(`[Stage B Filter] ✅ Including topic: "${topic.TopicName}"`);
			return true;
		})
		.map(topic => {
			// Strip Conditions field (not evaluated by Stage B)
			const { Conditions, ...topicWithoutConditions } = topic;
			return topicWithoutConditions;
		});

	const filteredCount = filteredTopics.length;
	const reduction = originalCount - filteredCount;
	const reductionPct = originalCount > 0 ? Math.round((reduction / originalCount) * 100) : 0;

	console.log(`[Stage B Filter] 📊 Topics: ${originalCount} → ${filteredCount} (${reduction} filtered, ${reductionPct}% reduction)`);

	// Return minimal structure: ONLY Topics (strip Tools, KnowledgeSources, TestCases)
	return {
		Components: {
			Topics: filteredTopics
		}
	};
}

/**
 * Check if tool count exceeds the threshold
 * This is a simple deterministic check that doesn't require AI evaluation
 * 
 * @param toolCount - Number of tools in the agent
 * @returns Pattern object if threshold exceeded, null otherwise
 */
export function checkExcessTools(toolCount: number): Pattern | null {
	const TOOL_THRESHOLD = 25;

	if (toolCount >= TOOL_THRESHOLD) {
		console.log(`[Excess Tools Check] ⚠️ Tool count ${toolCount} exceeds threshold ${TOOL_THRESHOLD}`);
		return {
			PatternName: 'Excess tools usage',
			PatternDescription: 'Tools limit threshold exceeded',
			Status: false,
			Topics: [],
			Recommendation: 'Reduce tool count or split logic into smaller topics.'
		};
	}

	console.log(`[Excess Tools Check] ✅ Tool count ${toolCount} is within threshold ${TOOL_THRESHOLD}`);
	return null;
}
