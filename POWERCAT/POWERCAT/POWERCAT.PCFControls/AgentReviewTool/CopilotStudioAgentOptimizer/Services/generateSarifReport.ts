/**
 * Generate SARIF (Static Analysis Results Interchange Format) 2.1.0 report
 * from Agent Review results for integration with security/code quality tools
 */

import type { ReviewResult, Pattern, ComplianceIssue } from '../types';

interface SarifReport {
    version: string;
    $schema: string;
    runs: SarifRun[];
}

interface SarifRun {
    tool: {
        driver: {
            name: string;
            version: string;
            informationUri: string;
            rules: SarifRule[];
        };
    };
    results: SarifResult[];
}

interface SarifRule {
    id: string;
    name: string;
    shortDescription: { text: string };
    fullDescription: { text: string };
    help?: { text: string; markdown?: string };
    properties?: {
        tags?: string[];
        precision?: string;
        'security-severity'?: string;
    };
}

interface SarifResult {
    ruleId: string;
    message: { text: string };
    level: 'error' | 'warning' | 'note';
    locations?: {
        physicalLocation: {
            artifactLocation: { uri: string };
            region?: { 
                startLine: number; 
                endLine?: number;
                startColumn?: number;
                endColumn?: number;
                snippet?: { text: string };
            };
        };
    }[];
    properties?: {
        tags?: string[];
    };
}

/**
 * Generate SARIF 2.1.0 compliant report from review result
 */
export function generateSarifReport(reviewResult: ReviewResult): string {
    const rules: SarifRule[] = [];
    const results: SarifResult[] = [];

    // Process Pattern Evaluation (Stage B)
    if (reviewResult.patternEvaluation?.Patterns) {
        reviewResult.patternEvaluation.Patterns.forEach((pattern: Pattern, index: number) => {
            const ruleId = `pattern-${sanitizeRuleId(pattern.PatternName)}`;
            
            // Add rule definition
            rules.push({
                id: ruleId,
                name: pattern.PatternName,
                shortDescription: { text: pattern.PatternName },
                fullDescription: { text: pattern.PatternDescription },
                help: { 
                    text: pattern.Recommendation,
                    markdown: `**${pattern.PatternName}**\n\n${pattern.PatternDescription}\n\n**Recommendation:** ${pattern.Recommendation}`
                },
                properties: {
                    tags: ['best-practice', 'pattern-analysis'],
                    precision: pattern.Topics.length > 5 ? 'high' : 'medium',
                },
            });

            // Add result if pattern failed
            if (!pattern.Status && pattern.Topics.length > 0) {
                results.push({
                    ruleId,
                    message: { 
                        text: `${pattern.PatternName}: Found in ${pattern.Topics.length} topic(s). ${pattern.Recommendation}` 
                    },
                    level: pattern.Topics.length > 5 ? 'error' : 'warning',
                    locations: pattern.Topics.map((topic: { item: string }) => ({
                        physicalLocation: {
                            artifactLocation: { uri: `copilot-studio://bot/${reviewResult.botId}/topic/${encodeURIComponent(topic.item)}` },
                            region: { 
                                startLine: 1,
                                snippet: { text: topic.item }
                            },
                        },
                    })),
                });
            }
        });
    }

    // Process Instruction Evaluation (Stage C)
    if (reviewResult.instructionEvaluation?.issues) {
        reviewResult.instructionEvaluation.issues.forEach((issue: ComplianceIssue) => {
            const ruleId = `compliance-${issue.id}`;
            
            // Add rule definition
            rules.push({
                id: ruleId,
                name: `Compliance: ${issue.id}`,
                shortDescription: { text: issue.description },
                fullDescription: { text: `${issue.description} (${issue.guidelineReference})` },
                help: { 
                    text: issue.recommendation,
                    markdown: `**${issue.description}**\n\n**Guideline:** ${issue.guidelineReference}\n\n**Recommendation:** ${issue.recommendation}`
                },
                properties: {
                    tags: ['compliance', 'agent-instructions'],
                    precision: issue.severity === 'high' ? 'high' : issue.severity === 'medium' ? 'medium' : 'low',
                    'security-severity': issue.severity === 'high' ? '8.0' : issue.severity === 'medium' ? '5.0' : '2.0',
                },
            });

            // Add result
            results.push({
                ruleId,
                message: { text: `${issue.description}. Recommendation: ${issue.recommendation}` },
                level: issue.severity === 'high' ? 'error' : issue.severity === 'medium' ? 'warning' : 'note',
                locations: [{
                    physicalLocation: {
                        artifactLocation: { uri: `copilot-studio://bot/${reviewResult.botId}/instructions` },
                        region: { 
                            startLine: 1
                        },
                    },
                }],
            });
        });
    }

    const sarifReport: SarifReport = {
        version: '2.1.0',
        $schema: 'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json',
        runs: [{
            tool: {
                driver: {
                    name: 'Copilot Studio Agent Optimizer',
                    version: '1.0.0',
                    informationUri: 'https://learn.microsoft.com/microsoft-copilot-studio/',
                    rules,
                },
            },
            results,
        }],
    };

    return JSON.stringify(sarifReport, null, 2);
}

/**
 * Sanitize pattern name for use as rule ID
 */
function sanitizeRuleId(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

/**
 * Download SARIF report as .sarif file
 */
export function downloadSarifReport(reviewResult: ReviewResult): void {
    const sarifContent = generateSarifReport(reviewResult);
    const blob = new Blob([sarifContent], { type: 'application/sarif+json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-review-${reviewResult.botName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.sarif`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    console.log('[SARIF] Downloaded SARIF report for:', reviewResult.botName);
}
