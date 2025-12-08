import * as yaml from 'js-yaml';
import type { ParsedTopic } from '../types';

/**
 * Preprocess YAML content to fix common indentation issues
 */
function preprocessYAML(content: string): string {
    if (!content) return content;
    
    // Split into lines
    const lines = content.split('\n');
    const processedLines: string[] = [];
    let previousIndent = 0;
    
    for (const line of lines) {
        // Skip empty lines
        if (line.trim() === '') {
            processedLines.push(line);
            continue;
        }
        
        // Fix common indentation issues:
        // 1. Remove any tabs and replace with spaces (YAML doesn't allow tabs)
        let processed = line.replace(/\t/g, '  ');
        
        // 2. Detect and fix badly indented mapping entries (key: value with wrong indent)
        const trimmed = processed.trim();
        
        // Skip comments
        if (trimmed.startsWith('#')) {
            processedLines.push(processed);
            continue;
        }
        
        if (trimmed.includes(':')) {
            // Get the leading whitespace
            const leadingSpaceMatch = /^\s*/.exec(processed);
            const leadingSpace = leadingSpaceMatch?.[0] ?? '';
            let spaceCount = leadingSpace.length;
            
            // If indentation is not a multiple of 2, adjust it
            // This handles common copy-paste issues where indentation gets corrupted
            if (spaceCount % 2 !== 0) {
                // Round down to nearest even number
                spaceCount = Math.floor(spaceCount / 2) * 2;
            }
            
            // Additional check: if indent jumped by more than 4 spaces from previous line
            // (likely a badly nested entry), cap it to previous + 2
            if (spaceCount > previousIndent + 4) {
                console.warn(`[YAML-PREPROCESS] Large indent jump detected (${previousIndent} → ${spaceCount}), capping to ${previousIndent + 2}`);
                spaceCount = previousIndent + 2;
            }
            
            // Check if key contains special YAML characters that need quoting
            // Extract the key part (everything before the first colon)
            const colonIndex = trimmed.indexOf(':');
            const key = trimmed.substring(0, colonIndex);
            const valueAndRest = trimmed.substring(colonIndex);
            
            // If key starts with @ or contains other special chars, and isn't already quoted
            if (/^[@&*!|>%]/.test(key) && !(/^['"]/.test(key))) {
                console.warn(`[YAML-PREPROCESS] Quoting special key: ${key}`);
                const adjustedSpace = ' '.repeat(spaceCount);
                processed = `${adjustedSpace}'${key}'${valueAndRest}`;
                previousIndent = spaceCount;
            } else {
                const adjustedSpace = ' '.repeat(spaceCount);
                processed = adjustedSpace + trimmed;
                previousIndent = spaceCount;
            }
        } else if (trimmed.startsWith('-')) {
            // List item - should align with parent
            const leadingSpaceMatch = /^\s*/.exec(processed);
            const leadingSpace = leadingSpaceMatch?.[0] ?? '';
            let spaceCount = leadingSpace.length;
            
            if (spaceCount % 2 !== 0) {
                spaceCount = Math.floor(spaceCount / 2) * 2;
            }
            
            const adjustedSpace = ' '.repeat(spaceCount);
            processed = adjustedSpace + trimmed;
        }
        
        processedLines.push(processed);
    }
    
    return processedLines.join('\n');
}

/**
 * Parse YAML content from bot component
 * Primary: js-yaml library
 * Fallback: Regex extraction
 */
export function parseComponentYAML(content: string, componentName: string): Partial<ParsedTopic> {
    console.log(`🔍 [YAML-PARSER] ================= PARSING COMPONENT: ${componentName} =================`);
    console.log(`🔍 [YAML-PARSER] Content length: ${content?.length} characters`);
    console.log(`🔍 [YAML-PARSER] First 200 chars:`, content?.substring(0, 200) + '...');
    
    // Preprocess YAML to fix common indentation issues
    const preprocessedContent = preprocessYAML(content);
    
    try {
        // Try parsing with js-yaml first
        console.log(`🔍 [YAML-PARSER] Attempting js-yaml parsing for ${componentName}...`);
        const parsed = yaml.load(preprocessedContent);
        
        if (typeof parsed === 'object' && parsed !== null) {
            console.log(`✅ [YAML-PARSER] SUCCESS: YAML parsed for ${componentName}`);
            console.log(`🔍 [YAML-PARSER] Available keys:`, Object.keys(parsed));
            
            const result = extractFieldsFromParsedYAML(parsed, componentName);
            console.log(`✅ [YAML-PARSER] Extracted fields for ${componentName}:`, { 
                ModelName: result.ModelName, 
                ModelDescription: result.ModelDescription?.substring(0, 50) + '...',
                InputVars: result.InputVariables?.length ?? 0,
                OutputVars: result.OutputVariables?.length ?? 0,
                TriggerQueries: result.TriggerQueries?.length ?? 0,
                Conditions: result.Conditions?.length ?? 0
            });
            console.log(`🔍 [YAML-PARSER] ================= END PARSING: ${componentName} =================`);
            return result;
        } else {
            console.warn(`❌ [YAML-PARSER] INVALID: Parsed YAML for ${componentName} is not an object:`, typeof parsed);
        }
    } catch (yamlError) {
        console.error(`❌ [YAML-PARSER] FAILED: js-yaml parsing failed for ${componentName}:`, yamlError);
        console.log(`🔄 [YAML-PARSER] Switching to regex fallback for ${componentName}`);
    }

    // Fallback to regex extraction
    console.log(`🔄 [YAML-PARSER] Using regex fallback for ${componentName}`);
    const fallbackResult = extractFieldsWithRegex(content, componentName);
    console.log(`🔄 [YAML-PARSER] Regex fallback result:`, {
        ModelName: fallbackResult.ModelName,
        ModelDescription: fallbackResult.ModelDescription
    });
    console.log(`🔍 [YAML-PARSER] ================= END PARSING: ${componentName} =================`);
    return fallbackResult;
}

/**
 * Extract fields from successfully parsed YAML object
 * Note: Using any for YAML parsing is necessary as structure is dynamic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFieldsFromParsedYAML(parsed: any, componentName: string): Partial<ParsedTopic> {
    const result: Partial<ParsedTopic> = {
        TopicName: componentName,
    };

    // Extract model name and description from correct fields
    // Real structure uses modelDisplayName and modelDescription (not model.name)
    if (parsed.modelDisplayName || parsed.model) {
        result.ModelName = (parsed.modelDisplayName ?? parsed.model?.name ?? parsed.model) as string;
        console.log(`[extractFieldsFromParsedYAML] Found ModelName for ${componentName}:`, result.ModelName);
    } else {
        result.ModelName = ''; // Set to empty string instead of undefined
        console.warn(`[extractFieldsFromParsedYAML] No ModelName found for ${componentName}. Available fields:`, Object.keys(parsed).join(', '));
    }
    
    if (parsed.modelDescription || parsed.model?.description) {
        result.ModelDescription = (parsed.modelDescription ?? parsed.model?.description) as string;
        console.log(`[extractFieldsFromParsedYAML] Found ModelDescription for ${componentName}:`, result.ModelDescription?.substring(0, 50));
    } else {
        result.ModelDescription = ''; // Set to empty string instead of undefined
        console.warn(`[extractFieldsFromParsedYAML] No ModelDescription found for ${componentName}`);
    }

    if (parsed.inputs || parsed.inputVariables || parsed.input || parsed.inputType) {
        const inputs = (parsed.inputType?.properties ?? parsed.inputs ?? parsed.inputVariables ?? parsed.input);
        result.InputVariables = extractVariables(inputs);
    }

    if (parsed.outputs || parsed.outputVariables || parsed.output || parsed.outputType) {
        const outputs = (parsed.outputType?.properties ?? parsed.outputs ?? parsed.outputVariables ?? parsed.output);
        result.OutputVariables = extractVariables(outputs);
    }

    // Extract TriggerQueries (trigger phrases for topics)
    if (parsed.triggerQueries || parsed.triggers || parsed.sampleQueries || parsed.samplePhrases) {
        const triggers = (parsed.triggerQueries ?? parsed.triggers ?? parsed.sampleQueries ?? parsed.samplePhrases);
        if (Array.isArray(triggers)) {
            result.TriggerQueries = triggers.map(t => ({ item: typeof t === 'string' ? t : String(t) }));
        } else if (typeof triggers === 'string') {
            result.TriggerQueries = [{ item: triggers }];
        }
    }

    if (parsed.conditions || parsed.rules) {
        const conditions = (parsed.conditions ?? parsed.rules);
        result.Conditions = Array.isArray(conditions) 
            ? conditions.map(c => typeof c === 'string' ? c : JSON.stringify(c))
            : [String(conditions)];
    }

    return result;
}

/**
 * Extract variables from various YAML formats
 * Returns variables with their metadata for missing field detection
 * Note: Using any for YAML parsing is necessary as structure is dynamic
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractVariables(vars: any): { VariableName: string; VariableDescription?: string; displayName?: string }[] {
    if (!vars) return [];

    // Handle array format (legacy or simple list)
    if (Array.isArray(vars)) {
        return vars.map(v => {
            if (typeof v === 'string') {
                return { VariableName: v };
            }
            if (typeof v === 'object' && v !== null) {
                // Try to extract a meaningful name from the object
                const extractedName = v.name ?? v.Name ?? v.VariableName ?? v.displayName ?? 
                                    (typeof v.toString === 'function' && v.toString() !== '[object Object]' 
                                        ? v.toString() 
                                        : Object.keys(v)[0] ?? 'UnknownVariable');
                
                return {
                    VariableName: extractedName as string,
                    VariableDescription: (v.description ?? v.Description ?? v.VariableDescription) as string | undefined,
                    displayName: (v.displayName) as string | undefined,
                };
            }
            return { VariableName: String(v) };
        });
    }

    // Handle object format (inputType.properties / outputType.properties)
    // KEY is the variable name, VALUE has displayName and description
    if (typeof vars === 'object') {
        return Object.entries(vars).map(([key, value]) => {
            // Check if value is an object with displayName/description (standard Copilot Studio format)
            if (typeof value === 'object' && value !== null) {
                return {
                    VariableName: key, // Property key is the actual variable name
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    displayName: (value as any).displayName as string | undefined,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    VariableDescription: (value as any).description as string | undefined,
                };
            }
            // Simple string value (key: "description" format)
            return {
                VariableName: key,
                VariableDescription: typeof value === 'string' ? value : undefined,
            };
        });
    }

    return [];
}

/**
 * Fallback: Extract fields using regex patterns
 * Handles cases where YAML is malformed but still readable
 */
function extractFieldsWithRegex(content: string, componentName: string): Partial<ParsedTopic> {
    const result: Partial<ParsedTopic> = {
        TopicName: componentName,
        ModelName: '', // Initialize with empty string
        ModelDescription: '', // Initialize with empty string
    };

    // Extract model display name (correct field name in Copilot Studio)
    const modelNameMatch = /modelDisplayName[:\s]+['"]*([^'"\n]+)['"]*!/i.exec(content) 
        ?? /model[:\s]+['"]*([^'"\n]+)['"]*!/i.exec(content);
    if (modelNameMatch?.[1]) {
        result.ModelName = modelNameMatch[1].trim();
    }

    // Extract model description (correct field name in Copilot Studio)
    const modelDescMatch = /modelDescription[:\s]+['"]*([^'"\n]+)['"]*!/i.exec(content)
        ?? /(?:model[_\s]*)*description[:\s]+['"]*([^'"\n]+)['"]*!/i.exec(content);
    if (modelDescMatch?.[1]) {
        result.ModelDescription = modelDescMatch[1].trim();
    }

    // Extract input variables (look for input/inputs sections)
    const inputMatches = /(?:input|inputs)[:\s]*\n?((?:\s*-\s*[^\n]+\n?)*)/i.exec(content);
    if (inputMatches?.[1]) {
        result.InputVariables = extractVariablesFromText(inputMatches[1]);
    }

    // Extract output variables
    const outputMatches = /(?:output|outputs)[:\s]*\n?((?:\s*-\s*[^\n]+\n?)*)/i.exec(content);
    if (outputMatches?.[1]) {
        result.OutputVariables = extractVariablesFromText(outputMatches[1]);
    }

    return result;
}

/**
 * Extract variable names from text block (fallback)
 */
function extractVariablesFromText(text: string): { VariableName: string; VariableDescription?: string }[] {
    const lines = text.split('\n').filter(line => line.trim());
    const variables: { VariableName: string; VariableDescription?: string }[] = [];

    for (const line of lines) {
        // Match patterns like "- variableName" or "variableName: description"
        const match = /[-\s]*([a-zA-Z_][a-zA-Z0-9_]*)[:\s]*(.*)/.exec(line);
        if (match) {
            variables.push({
                VariableName: match[1].trim(),
                VariableDescription: match[2] ? match[2].trim() : undefined,
            });
        }
    }

    return variables;
}

/**
 * Extract agent instructions from Custom GPT component
 * Returns undefined silently if no instructions found (not all components have instructions)
 */
export function extractAgentInstructions(content: string): string | undefined {
    console.log(`🤖 [INSTRUCTIONS-PARSER] ============= EXTRACTING AGENT INSTRUCTIONS =============`);
    console.log(`🤖 [INSTRUCTIONS-PARSER] Content length: ${content?.length} characters`);
    console.log(`🤖 [INSTRUCTIONS-PARSER] Content preview:`, content?.substring(0, 200) + '...');
    
    // Preprocess YAML to fix common issues (same as parseComponentYAML)
    const preprocessedContent = preprocessYAML(content);
    
    try {
        console.log(`🤖 [INSTRUCTIONS-PARSER] Attempting YAML parsing...`);
        const parsed = yaml.load(preprocessedContent);
        
        if (typeof parsed === 'object' && parsed !== null) {
            console.log(`✅ [INSTRUCTIONS-PARSER] YAML parsed successfully`);
            console.log(`🤖 [INSTRUCTIONS-PARSER] Available top-level keys:`, Object.keys(parsed));
            
            // Check common instruction field names
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const anyParsed = parsed as any;
            
            // Log what we're checking
            console.log(`🤖 [INSTRUCTIONS-PARSER] Field type check:`, {
                instructions: typeof anyParsed.instructions,
                systemInstructions: typeof anyParsed.systemInstructions,
                prompt: typeof anyParsed.prompt,
                agentInstructions: typeof anyParsed.agentInstructions,
                instruction: typeof anyParsed.instruction,
                systemPrompt: typeof anyParsed.systemPrompt,
            });
            
            const instructions = anyParsed.instructions 
                ?? anyParsed.systemInstructions 
                ?? anyParsed.prompt
                ?? anyParsed.agentInstructions
                ?? anyParsed.instruction
                ?? anyParsed.systemPrompt;
            
            if (instructions) {
                const instructionText = typeof instructions === 'string' ? instructions : JSON.stringify(instructions);
                console.log(`✅ [INSTRUCTIONS-PARSER] Successfully extracted instructions (length: ${instructionText.length})`);
                console.log(`✅ [INSTRUCTIONS-PARSER] Preview:`, instructionText.substring(0, 150) + '...');
                return instructionText;
            } else {
                console.log(`❌ [INSTRUCTIONS-PARSER] No instruction fields found. Full keys: ${Object.keys(parsed).join(', ')}`);
            }
        }
    } catch (error) {
        console.error(`❌ [INSTRUCTIONS-PARSER] YAML parsing failed:`, error);
        console.log(`🔄 [INSTRUCTIONS-PARSER] Attempting regex fallback...`);
    }
    
    // Fallback to regex extraction (always try, even if YAML parsing succeeded but found nothing)
    // This ensures we capture instructions even with bad indentation
    console.log(`🔄 [INSTRUCTIONS-PARSER] Attempting robust regex fallback...`);
    
    // Try multiple patterns in order of specificity
    // Using [\s\S] instead of /s flag for ES2017 compatibility
    const patterns = [
        // Pattern 1: Standard YAML format (key: value on same line or next line)
        /(?:^|\n)\s*(?:instructions|prompt|agentInstructions|instruction|systemPrompt)\s*:\s*([\s\S]+?)(?=\n\s*\w+\s*:|$)/i,
        
        // Pattern 2: With leading space (common formatting issue in sample data)
        /(?:^|\n)\s+(?:instructions|prompt|agentInstructions|instruction|systemPrompt)\s*:\s*([\s\S]+?)(?=\n\s*\w+\s*:|$)/i,
        
        // Pattern 3: Multiline format (value continues on following lines with indentation)
        /(?:instructions|prompt|agentInstructions|instruction|systemPrompt)\s*:\s*\n\s+([\s\S]+?)(?=\n\S|\n\s*\w+\s*:|$)/i,
        
        // Pattern 4: Most permissive - capture until next top-level key or end
        /(?:instructions|prompt|agentInstructions|instruction|systemPrompt)\s*:\s*([^\n]*(?:\n(?!\w+:)[^\n]*)*)/i,
    ];
    
    for (let i = 0; i < patterns.length; i++) {
        const match = patterns[i].exec(content);
        if (match?.[1]) {
            const extracted = match[1].trim();
            if (extracted && extracted.length > 0) {
                console.log(`✅ [INSTRUCTIONS-PARSER] Pattern ${i + 1} extracted instructions (length: ${extracted.length})`);
                console.log(`✅ [INSTRUCTIONS-PARSER] Preview:`, extracted.substring(0, 150) + '...');
                return extracted;
            }
        }
    }
    
    console.log(`❌ [INSTRUCTIONS-PARSER] All fallback patterns failed - no instructions found`);
    console.log(`❌ [INSTRUCTIONS-PARSER] Returning undefined`);
    return undefined;
}
