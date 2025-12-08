import { BotService } from './domain/BotService';
import { parseComponentYAML, extractAgentInstructions } from './parseYAML';
import { ComponentType, type BotComponent, type LocalStageAOutput, type ParsedTopic } from '../types';

/**
 * Extract Stage A compatible data by parsing YAML locally
 * Used as default approach for all bots to save AI compute, with AI fallback when parsing fails
 */
export async function extractStageADataLocally(
    webAPI: ComponentFramework.WebApi,
    botId: string,
    botName: string
): Promise<LocalStageAOutput> {
    
    console.log(`🔄 [STAGE A LOCAL] 📥 INPUT: Bot ${botName} (${botId}) - Starting local YAML extraction`);
    
    // Retrieve all components for this bot
    const botService = new BotService(webAPI);
    const components = await botService.getBotComponents(botId);
    
    console.log(`🔄 [STAGE A LOCAL] 📊 Processing ${components.length} components for bot ${botName}`);

    const output: LocalStageAOutput = {
        IsGenerativeOrchestration: false,
        BotId: botId,
        BotName: botName,
        failed_components: [], // Track components that failed to parse
        Components: {
            Topics: [],
            Tools: [],
            KnowledgeSources: [],
            TestCases: [],
        },
        MissingFields: {
            MissingModelNames: [],
            MissingModelDescriptions: [],
            MissingInputVariableNames: [],
            MissingInputVariableDescriptions: [],
            MissingOutputVariableNames: [],
            MissingOutputVariableDescriptions: [],
            MissingTestCases: false, // Will be set to true if no test cases found
        },
    };

    // Process each component based on type
    for (const component of components) {
        processComponent(component, output);
    }

    // Check if test cases are missing after processing all components
    if (!output.Components.TestCases || output.Components.TestCases.length === 0) {
        output.MissingFields!.MissingTestCases = true;
    }

    // Clean up internal displayName fields from variables before returning
    // (displayName was used for missing field detection, but final output should only have VariableName & VariableDescription)
    output.Components.Topics = output.Components.Topics.map(topic => ({
        ...topic,
        InputVariables: topic.InputVariables?.map(({ VariableName, VariableDescription }) => ({ 
            VariableName, 
            VariableDescription 
        })),
        OutputVariables: topic.OutputVariables?.map(({ VariableName, VariableDescription }) => ({ 
            VariableName, 
            VariableDescription 
        }))
    }));
    
    console.log(`🔄 [STAGE A LOCAL] 📤 FINAL OUTPUT:`, {
        botName: output.BotName,
        botId: output.BotId,
        topics: output.Components.Topics.length,
        tools: output.Components.Tools?.length ?? 0,
        testCases: output.Components.TestCases?.length ?? 0,
        failedComponents: output.failed_components?.length ?? 0,
        missingFields: {
            modelNames: output.MissingFields?.MissingModelNames.length ?? 0,
            modelDescriptions: output.MissingFields?.MissingModelDescriptions.length ?? 0,
            testCases: output.MissingFields?.MissingTestCases ?? false
        }
    });
    
    // Log clean JSON output for browser console inspection
    console.log('🔄 [STAGE A LOCAL] 📄 Full JSON Output:', JSON.stringify(output, null, 2));

    return output;
}

/**
 * Process individual component and add to output
 */
function processComponent(component: BotComponent, output: LocalStageAOutput): void {
    const { componenttype, name, data } = component;

    if (!data) {
        console.warn(`[processComponent] No data for component: ${name}`);
        return;
    }

    switch (componenttype) {
        case ComponentType.CustomGPT: {
            // Extract agent instructions from Custom GPT component
            const instructions = extractAgentInstructions(data);
            if (instructions) {
                output.AgentInstructions = instructions;
                output.IsGenerativeOrchestration = true;
            }
            break;
        }

        case ComponentType.TopicV2:
        case ComponentType.Topic: {
            // Check if this is actually a Tool/Action by examining the YAML
            // Topics without "kind: AdaptiveDialog" are Tools/Actions
            const isAdaptiveDialog = data.includes('kind: AdaptiveDialog');
            
            if (!isAdaptiveDialog) {
                // This is a Tool/Action, not a conversational topic
                output.Components.Tools!.push({ item: name });
                console.log(`[processComponent] Added Tool (Topic-based action): ${name} (type ${componenttype})`);
                break;
            }

            // Parse topic YAML (this is a real conversational topic)
            const parsedTopic = parseComponentYAML(data, name);
            const topic: ParsedTopic = {
                TopicName: name,
                ModelName: parsedTopic.ModelName,
                ModelDescription: parsedTopic.ModelDescription,
                InputVariables: parsedTopic.InputVariables,
                OutputVariables: parsedTopic.OutputVariables,
                Conditions: parsedTopic.Conditions,
            };

            output.Components.Topics.push(topic);

            // Track missing fields for quality reporting
            if (!topic.ModelName || topic.ModelName.trim() === '') {
                output.MissingFields!.MissingModelNames.push(name);
            }
            
            if (!topic.ModelDescription || topic.ModelDescription.trim() === '') {
                output.MissingFields!.MissingModelDescriptions.push(name);
            }
            
            // Check for missing variable names/descriptions
            // VariableName comes from property key (always present), but displayName and description might be missing
            if (topic.InputVariables && topic.InputVariables.length > 0) {
                topic.InputVariables.forEach((v: { VariableName: string; VariableDescription?: string; displayName?: string }) => {
                    // Check for missing displayName (metadata)
                    if (!v.displayName || v.displayName.trim() === '') {
                        output.MissingFields!.MissingInputVariableNames.push({ 
                            topic: name, 
                            variable: v.VariableName ?? 'unnamed' 
                        });
                    }
                    
                    // Check for missing description
                    if (!v.VariableDescription || v.VariableDescription.trim() === '') {
                        output.MissingFields!.MissingInputVariableDescriptions.push({ 
                            topic: name, 
                            variable: v.VariableName ?? 'unnamed' 
                        });
                    }
                });
            }
            
            if (topic.OutputVariables && topic.OutputVariables.length > 0) {
                topic.OutputVariables.forEach((v: { VariableName: string; VariableDescription?: string; displayName?: string }) => {
                    // Check for missing displayName (metadata)
                    if (!v.displayName || v.displayName.trim() === '') {
                        output.MissingFields!.MissingOutputVariableNames.push({ 
                            topic: name, 
                            variable: v.VariableName ?? 'unnamed' 
                        });
                    }
                    
                    // Check for missing description
                    if (!v.VariableDescription || v.VariableDescription.trim() === '') {
                        output.MissingFields!.MissingOutputVariableDescriptions.push({ 
                            topic: name, 
                            variable: v.VariableName ?? 'unnamed' 
                        });
                    }
                });
            }
            break;
        }

        case ComponentType.Dialog:
        case ComponentType.Skill:
        case ComponentType.SkillV2:
        case ComponentType.ExternalTrigger: {
            // Track tools (Dialogs/Skills/External Triggers are invokable components)
            output.Components.Tools!.push({ item: name });
            console.log(`[processComponent] Added Tool: ${name} (type ${componenttype})`);
            break;
        }

        case ComponentType.KnowledgeSource:
        case ComponentType.BotEntity:
        case ComponentType.BotEntityV2: {
            // Knowledge sources (type 16) or entities that look like knowledge sources
            if (componenttype === ComponentType.KnowledgeSource || 
                name.toLowerCase().includes('knowledge') || 
                name.toLowerCase().includes('source')) {
                output.Components.KnowledgeSources!.push({ item: name });
                console.log(`[processComponent] Added KnowledgeSource: ${name} (type ${componenttype})`);
            }
            break;
        }

        case ComponentType.TestCase: {
            // Test case components (type 19)
            output.Components.TestCases ??= [];
            output.Components.TestCases.push(name);
            console.log(`[processComponent] Added TestCase: ${name}`);
            break;
        }

        default:
            // Fallback: Check name patterns for missed components
            if (name.toLowerCase().includes('test') || name.toLowerCase().includes('testcase')) {
                output.Components.TestCases ??= [];
                output.Components.TestCases.push(name);
                console.log(`[processComponent] Found test case by name pattern: ${name} (type ${componenttype})`);
            } else {
                // Other component types - log for awareness
                console.log(`[processComponent] Skipping unknown component type ${componenttype}: ${name}`);
            }
            break;
    }
}

/**
 * Generate missing fields pattern for Stage B
 * Prepends quality issues to Stage B evaluation
 */
export function generateMissingFieldsPattern(missingFields: LocalStageAOutput['MissingFields']): string {
    if (!missingFields) return '';

    const patterns: string[] = [];

    if (missingFields.MissingModelNames.length > 0) {
        patterns.push(
            `MISSING_MODEL_NAMES: The following topics are missing model name specifications: ${missingFields.MissingModelNames.join(', ')}. ` +
            `This indicates incomplete AI model configuration and should be flagged as a quality issue.`
        );
    }

    if (missingFields.MissingModelDescriptions.length > 0) {
        patterns.push(
            `MISSING_MODEL_DESCRIPTIONS: The following topics lack model descriptions: ${missingFields.MissingModelDescriptions.join(', ')}. ` +
            `This reduces maintainability and understanding of AI model purposes.`
        );
    }

    if (missingFields.MissingInputVariableNames.length > 0) {
        const issues = missingFields.MissingInputVariableNames.map(v => `${v.topic}.${v.variable}`).join(', ');
        patterns.push(
            `MISSING_INPUT_VARIABLE_NAMES: The following input variables are missing displayName: ${issues}. ` +
            `Each input variable must have a clear displayName to specify what data is expected.`
        );
    }

    if (missingFields.MissingInputVariableDescriptions.length > 0) {
        const issues = missingFields.MissingInputVariableDescriptions.map(v => `${v.topic}.${v.variable}`).join(', ');
        patterns.push(
            `MISSING_INPUT_VARIABLE_DESCRIPTIONS: The following input variables are missing descriptions: ${issues}. ` +
            `Add descriptions to explain the purpose and format of each input variable.`
        );
    }

    if (missingFields.MissingOutputVariableNames.length > 0) {
        const issues = missingFields.MissingOutputVariableNames.map(v => `${v.topic}.${v.variable}`).join(', ');
        patterns.push(
            `MISSING_OUTPUT_VARIABLE_NAMES: The following output variables are missing displayName: ${issues}. ` +
            `Each output variable must have a clear displayName to specify what data is produced.`
        );
    }

    if (missingFields.MissingOutputVariableDescriptions.length > 0) {
        const issues = missingFields.MissingOutputVariableDescriptions.map(v => `${v.topic}.${v.variable}`).join(', ');
        patterns.push(
            `MISSING_OUTPUT_VARIABLE_DESCRIPTIONS: The following output variables are missing descriptions: ${issues}. ` +
            `Add descriptions to explain the purpose and format of each output variable.`
        );
    }

    if (missingFields.MissingTestCases) {
        patterns.push(
            `MISSING_TEST_CASES: This bot has no test cases defined. ` +
            `Test cases are critical for validating agent behavior and ensuring quality. ` +
            `Add test cases to cover key conversation flows and edge cases.`
        );
    }

    return patterns.join('\n\n');
}

/**
 * Analyze local Stage A data and generate Pattern objects for manual quality checks
 * This supplements AI Stage B evaluation with deterministic local analysis
 */
export function analyzeLocalPatterns(stageAData: LocalStageAOutput): import('../types').Pattern[] {
    console.log(`🔄 [STAGE A LOCAL] 🔍 ANALYZE: Starting local pattern analysis...`);
    
    const patterns: import('../types').Pattern[] = [];
    
    // Handle case where MissingFields might not exist - create empty structure
    const missingFields = stageAData.MissingFields ?? {
        MissingModelNames: [],
        MissingModelDescriptions: [],
        MissingInputVariableNames: [],
        MissingInputVariableDescriptions: [],
        MissingOutputVariableNames: [],
        MissingOutputVariableDescriptions: [],
        MissingTestCases: false
    };

    console.log(`🔄 [STAGE A LOCAL] 📊 Missing fields summary:`, {
        modelNames: missingFields.MissingModelNames?.length ?? 0,
        modelDescriptions: missingFields.MissingModelDescriptions?.length ?? 0,
        inputVarNames: missingFields.MissingInputVariableNames?.length ?? 0,
        inputVarDescriptions: missingFields.MissingInputVariableDescriptions?.length ?? 0,
        outputVarNames: missingFields.MissingOutputVariableNames?.length ?? 0,
        outputVarDescriptions: missingFields.MissingOutputVariableDescriptions?.length ?? 0,
        testCases: !!missingFields.MissingTestCases
    });

    console.log('[analyzeLocalPatterns] Analyzing missing fields:', missingFields);

    // Pattern 1: Missing Model Name - ALWAYS ADD (even if empty Topics - shows as Pass)
    patterns.push({
        PatternName: 'Missing Model Name',
        PatternDescription: 'Topics missing model name specifications',
        Status: (missingFields.MissingModelNames?.length ?? 0) === 0, // true = Pass (no issues)
        Topics: (missingFields.MissingModelNames ?? []).map(name => ({
            item: name,
            variable: undefined,
            current: undefined,
            suggested: 'Add concise, descriptive model name'
        })),
        Recommendation: 'Add a concise, meaningful ModelName describing the topic purpose and when it should be invoked.'
    });

    // Pattern 2: Missing Model Description - ALWAYS ADD
    patterns.push({
        PatternName: 'Missing Model Description',
        PatternDescription: 'Topics missing model descriptions',
        Status: (missingFields.MissingModelDescriptions?.length ?? 0) === 0,
        Topics: (missingFields.MissingModelDescriptions ?? []).map(name => ({
            item: name,
            variable: undefined,
            current: undefined,
            suggested: 'Add detailed description of topic purpose'
        })),
        Recommendation: 'Provide a short description explaining the topic\'s purpose and trigger conditions.'
    });

    // Pattern 3: Missing Input Variable Name (displayName) - ALWAYS ADD
    patterns.push({
        PatternName: 'Missing Input Variable Name',
        PatternDescription: 'Input variables missing displayName',
        Status: (missingFields.MissingInputVariableNames?.length ?? 0) === 0,
        Topics: (missingFields.MissingInputVariableNames ?? []).map(v => ({
            item: v.topic,
            variable: v.variable,
            current: undefined,
            suggested: 'Add descriptive camelCase displayName'
        })),
        Recommendation: 'Add a clear displayName to each input variable to specify what data is expected. Use descriptive camelCase names (e.g., userId, orderDetails).'
    });

    // Pattern 4: Missing Input Variable Description - ALWAYS ADD
    patterns.push({
        PatternName: 'Missing Input Variable Description',
        PatternDescription: 'Input variables missing description',
        Status: (missingFields.MissingInputVariableDescriptions?.length ?? 0) === 0,
        Topics: (missingFields.MissingInputVariableDescriptions ?? []).map(v => ({
            item: v.topic,
            variable: v.variable,
            current: undefined,
            suggested: 'Add clear description of variable purpose and format'
        })),
        Recommendation: 'Add a description to each input variable explaining its purpose, expected format, and constraints.'
    });

    // Pattern 5: Missing Output Variable Name (displayName) - ALWAYS ADD
    patterns.push({
        PatternName: 'Missing Output Variable Name',
        PatternDescription: 'Output variables missing displayName',
        Status: (missingFields.MissingOutputVariableNames?.length ?? 0) === 0,
        Topics: (missingFields.MissingOutputVariableNames ?? []).map(v => ({
            item: v.topic,
            variable: v.variable,
            current: undefined,
            suggested: 'Add descriptive camelCase displayName'
        })),
        Recommendation: 'Add a clear displayName to each output variable to specify what data is produced. Use descriptive camelCase names (e.g., resultStatus, reportUrl).'
    });

    // Pattern 6: Missing Output Variable Description - ALWAYS ADD
    patterns.push({
        PatternName: 'Missing Output Variable Description',
        PatternDescription: 'Output variables missing description',
        Status: (missingFields.MissingOutputVariableDescriptions?.length ?? 0) === 0,
        Topics: (missingFields.MissingOutputVariableDescriptions ?? []).map(v => ({
            item: v.topic,
            variable: v.variable,
            current: undefined,
            suggested: 'Add detailed description of variable content'
        })),
        Recommendation: 'Add a description to each output variable explaining what it contains, its format, and how it should be used by downstream topics.'
    });

    // NOTE: "Unclear" patterns are NOT generated locally
    // Stage B AI analyzes Components.Topics directly (ModelName, ModelDescription, InputVariables, OutputVariables)
    // and determines which values are unclear/vague, generating "Unclear" patterns with context-aware suggestions

    // Pattern 7: Excessive Tools Usage
    const totalTools = stageAData.Components.Tools?.length ?? 0;
    const hasExcessiveTools = totalTools > 25;
    console.log(`🔄 [STAGE A LOCAL] 🔧 Excessive Tools Check: ${totalTools} tools (threshold: 25, excessive: ${hasExcessiveTools})`);
    patterns.push({
        PatternName: 'Excessive Tools Usage',
        PatternDescription: hasExcessiveTools ? 
            `This agent has ${totalTools} tools configured, which may increase complexity` :
            `Tools usage is appropriate (${totalTools} tools configured)`,
        Status: !hasExcessiveTools,
        Topics: hasExcessiveTools ? stageAData.Components.Tools?.map((tool: { item: string }) => ({
            item: tool.item,
            current: 'configured',
            suggested: 'Review if needed'
        })) ?? [] : [],
        Recommendation: hasExcessiveTools ? 
            'Consider reducing complexity by removing unused tools or grouping related functionality.' :
            'Tools usage is within acceptable limits.'
    });

    // Pattern 8: No Test Cases Found
    const testCaseCount = stageAData.Components.TestCases?.length ?? 0;
    const topicCount = stageAData.Components.Topics?.length ?? 0;
    const hasInadequateTestCases = topicCount > 0 && testCaseCount < 10;
    
    // Determine severity based on test case count
    let testCaseSeverity: "high" | "medium" | "low" | undefined;
    if (hasInadequateTestCases) {
        if (testCaseCount === 0) {
            testCaseSeverity = 'high';  // No test cases at all
        } else if (testCaseCount < 5) {
            testCaseSeverity = 'medium'; // Less than 5 test cases
        } else {
            testCaseSeverity = 'low';    // 5-9 test cases
        }
    }
    
    console.log(`🔄 [STAGE A LOCAL] 🧪 Test Cases Check: ${testCaseCount} test cases, ${topicCount} topics (inadequate: ${hasInadequateTestCases}, severity: ${testCaseSeverity ?? 'none'})`);
    
    patterns.push({
        PatternName: 'No Test Cases Found',
        PatternDescription: hasInadequateTestCases ? 
            `Test coverage is inadequate: ${testCaseCount} test case(s) found, at least 10 expected` :
            `Test coverage is adequate: ${testCaseCount} test cases found (atleast 10 expected)`,
        Status: !hasInadequateTestCases,
        Topics: hasInadequateTestCases && stageAData.Components.Topics ? stageAData.Components.Topics.map((topic: ParsedTopic) => ({
            item: topic.TopicName,
            current: testCaseCount === 0 ? 'no test coverage' : 'insufficient test coverage',
            suggested: 'Add test cases'
        })) : [],
        Recommendation: hasInadequateTestCases ?
            'Add test cases to validate conversation flows and ensure quality. Each major topic should have corresponding test cases.' :
            'Test case coverage is present.',
        severity: testCaseSeverity
    });

    console.log(`🔄 [STAGE A LOCAL] 📤 OUTPUT: Generated ${patterns.length} patterns:`);
    patterns.forEach((pattern, index) => {
        console.log(`🔄 [STAGE A LOCAL] ${pattern.Status ? '✅' : '❌'} Pattern ${index + 1}: ${pattern.PatternName} (${pattern.Topics.length} topics)`);
    });

    return patterns;
}
