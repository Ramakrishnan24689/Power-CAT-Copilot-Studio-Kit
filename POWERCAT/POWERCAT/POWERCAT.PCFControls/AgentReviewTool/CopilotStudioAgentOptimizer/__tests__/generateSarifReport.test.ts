/// <reference types="@testing-library/jest-dom" />

/**
 * Tests for SARIF Report Generation
 * Validates Static Analysis Results Interchange Format compliance
 */

import { generateSarifReport } from '../Services/generateSarifReport';
import type { Pattern } from '../types';

describe('generateSarifReport', () => {
    const createMockPattern = (overrides: Partial<Pattern> = {}): Pattern => ({
        PatternName: 'test-pattern',
        PatternDescription: 'Test pattern description',
        Status: true,
        Topics: [],
        Recommendation: 'Test recommendation',
        ...overrides
    });

    describe('SARIF Format Compliance', () => {
        it('should generate valid SARIF structure for empty patterns', () => {
            const result = generateSarifReport([]);
            
            expect(result).toHaveProperty('version', '2.1.0');
            expect(result).toHaveProperty('$schema');
            expect(result).toHaveProperty('runs');
            expect(Array.isArray(result.runs)).toBe(true);
            expect(result.runs).toHaveLength(1);
            
            const run = result.runs[0];
            expect(run).toHaveProperty('tool');
            expect(run).toHaveProperty('results');
            expect(Array.isArray(run.results)).toBe(true);
        });

        it('should include required SARIF tool information', () => {
            const result = generateSarifReport([]);
            const tool = result.runs[0].tool;
            
            expect(tool).toHaveProperty('driver');
            expect(tool.driver).toHaveProperty('name');
            expect(tool.driver).toHaveProperty('version');
            expect(tool.driver).toHaveProperty('informationUri');
        });

        it('should generate results for failing patterns', () => {
            const failingPattern = createMockPattern({
                PatternName: 'fail-001',
                PatternDescription: 'This pattern failed',
                Status: false,
                Topics: [
                    {
                        item: 'Issue found',
                        current: 'problematic value',
                        suggested: 'better value'
                    }
                ]
            });

            const result = generateSarifReport([failingPattern]);
            
            expect(result.runs[0].results).toHaveLength(1);
            
            const sarifResult = result.runs[0].results[0];
            expect(sarifResult).toHaveProperty('ruleId');
            expect(sarifResult).toHaveProperty('message');
            expect(sarifResult).toHaveProperty('level');
        });

        it('should not generate results for passing patterns', () => {
            const passingPattern = createMockPattern({
                Status: true
            });

            const result = generateSarifReport([passingPattern]);
            
            expect(result.runs[0].results).toHaveLength(0);
        });
    });

    describe('Pattern Processing', () => {
        it('should handle mixed passing and failing patterns', () => {
            const patterns = [
                createMockPattern({ PatternName: '1', Status: true }),
                createMockPattern({ 
                    PatternName: '2', 
                    Status: false,
                    Topics: [{ item: 'Issue 1', current: 'bad', suggested: 'good' }]
                }),
                createMockPattern({ PatternName: '3', Status: true }),
                createMockPattern({ 
                    PatternName: '4', 
                    Status: false,
                    Topics: [{ item: 'Issue 2', current: 'also bad', suggested: 'also good' }]
                })
            ];

            const result = generateSarifReport(patterns);
            
            // Should only have results for failing patterns (2 and 4)
            expect(result.runs[0].results).toHaveLength(2);
            
            const ruleIds = result.runs[0].results.map(r => r.ruleId);
            expect(ruleIds).toContain('2');
            expect(ruleIds).toContain('4');
            expect(ruleIds).not.toContain('1');
            expect(ruleIds).not.toContain('3');
        });

        it('should handle patterns with multiple topics', () => {
            const patternWithMultipleIssues = createMockPattern({
                PatternName: 'multi-001',
                Status: false,
                Topics: [
                    { item: 'First issue', current: 'bad1', suggested: 'good1' },
                    { item: 'Second issue', variable: 'var2', current: 'bad2', suggested: 'good2' },
                    { item: 'Third issue', current: 'bad3', suggested: 'good3' }
                ]
            });

            const result = generateSarifReport([patternWithMultipleIssues]);
            
            expect(result.runs[0].results).toHaveLength(1);
            
            const sarifResult = result.runs[0].results[0];
            expect(sarifResult.message.text).toContain('First issue');
            expect(sarifResult.message.text).toContain('Second issue');
            expect(sarifResult.message.text).toContain('Third issue');
        });

        it('should handle patterns with no topics', () => {
            const patternWithNoTopics = createMockPattern({
                PatternName: 'no-topics',
                Status: false,
                Topics: []
            });

            const result = generateSarifReport([patternWithNoTopics]);
            
            expect(result.runs[0].results).toHaveLength(1);
            
            const sarifResult = result.runs[0].results[0];
            expect(sarifResult.message.text).toBeDefined();
            expect(sarifResult.message.text.length).toBeGreaterThan(0);
        });

        it('should handle patterns with undefined/null topics', () => {
            const patternWithNullTopics = createMockPattern({
                PatternName: 'null-topics',
                Status: false,
                Topics: undefined as any
            });

            const result = generateSarifReport([patternWithNullTopics]);
            
            expect(result.runs[0].results).toHaveLength(1);
            expect(result.runs[0].results[0].message.text).toBeDefined();
        });
    });

    describe('Severity Mapping', () => {
        it('should assign appropriate severity levels', () => {
            const patterns = [
                createMockPattern({
                    PatternName: 'critical-001',
                    Status: false,
                    Topics: [{ item: 'Critical security issue', current: 'vulnerable', suggested: 'secure' }]
                }),
                createMockPattern({
                    PatternName: 'warning-001', 
                    Status: false,
                    Topics: [{ item: 'Performance concern', current: 'slow', suggested: 'fast' }]
                })
            ];

            const result = generateSarifReport(patterns);
            
            expect(result.runs[0].results).toHaveLength(2);
            
            result.runs[0].results.forEach(sarifResult => {
                expect(['error', 'warning', 'note', 'info']).toContain(sarifResult.level);
            });
        });
    });

    describe('Message Formatting', () => {
        it('should create clear, actionable messages', () => {
            const pattern = createMockPattern({
                PatternName: 'msg-test',
                PatternDescription: 'Authentication pattern validation',
                Status: false,
                Topics: [
                    {
                        item: 'Missing authentication check',
                        variable: 'authToken',
                        current: 'not validated',
                        suggested: 'validate before use'
                    }
                ]
            });

            const result = generateSarifReport([pattern]);
            const message = result.runs[0].results[0].message.text;
            
            // Message should be descriptive and actionable
            expect(message).toContain('Missing authentication check');
            expect(message.length).toBeGreaterThan(10);
        });

        it('should handle topics with missing fields gracefully', () => {
            const pattern = createMockPattern({
                Status: false,
                Topics: [
                    { item: 'Issue with minimal data' },
                    { item: undefined, current: 'some value' } as any,
                    { suggested: 'only suggestion' } as any
                ]
            });

            expect(() => generateSarifReport([pattern])).not.toThrow();
            
            const result = generateSarifReport([pattern]);
            expect(result.runs[0].results[0].message.text).toBeDefined();
        });
    });

    describe('Metadata and Extensions', () => {
        it('should include pattern metadata in SARIF extensions', () => {
            const pattern = createMockPattern({
                PatternName: 'meta-001',
                PatternDescription: 'Pattern with rich metadata',
                Status: false,
                Topics: [{ item: 'Test issue', current: 'bad', suggested: 'good' }]
            });

            const result = generateSarifReport([pattern]);
            const sarifResult = result.runs[0].results[0];
            
            // Should include pattern-specific information
            expect(sarifResult.ruleId).toBe('meta-001');
        });

        it('should handle patterns with special characters in descriptions', () => {
            const pattern = createMockPattern({
                PatternName: 'special-chars',
                PatternDescription: 'Pattern with "quotes", <tags>, and émojis 🚀',
                Status: false,
                Topics: [
                    {
                        item: 'Issue with special chars: @#$%^&*()',
                        current: 'value with "quotes" and <brackets>',
                        suggested: 'clean value'
                    }
                ]
            });

            expect(() => generateSarifReport([pattern])).not.toThrow();
            
            const result = generateSarifReport([pattern]);
            expect(result.runs[0].results).toHaveLength(1);
        });
    });

    describe('Edge Cases and Error Handling', () => {
        it('should handle empty pattern array', () => {
            const result = generateSarifReport([]);
            
            expect(result).toBeDefined();
            expect(result.runs[0].results).toHaveLength(0);
        });

        it('should handle null/undefined pattern fields', () => {
            const malformedPattern = {
                PatternName: null,
                PatternDescription: undefined,
                Status: false,
                Topics: null
            } as any;

            expect(() => generateSarifReport([malformedPattern])).not.toThrow();
        });

        it('should handle very large pattern arrays', () => {
            const largePatternArray = Array.from({ length: 1000 }, (_, i) =>
                createMockPattern({
                    PatternName: `pattern-${i}`,
                    Status: i % 2 === 0, // Half failing, half passing
                    Topics: i % 2 === 0 ? [] : [{ item: `Issue ${i}`, current: 'bad', suggested: 'good' }]
                })
            );

            const result = generateSarifReport(largePatternArray);
            
            // Should only include results for failing patterns (odd indices)
            expect(result.runs[0].results).toHaveLength(500);
        });
    });

    describe('SARIF Schema Validation', () => {
        it('should generate SARIF that matches expected schema structure', () => {
            const patterns = [
                createMockPattern({
                    PatternName: 'schema-test',
                    Status: false,
                    Topics: [{ item: 'Schema validation test', current: 'invalid', suggested: 'valid' }]
                })
            ];

            const result = generateSarifReport(patterns);
            
            // Validate top-level structure
            expect(result).toMatchObject({
                version: '2.1.0',
                $schema: expect.stringContaining('sarif-schema'),
                runs: expect.arrayContaining([
                    expect.objectContaining({
                        tool: expect.objectContaining({
                            driver: expect.objectContaining({
                                name: expect.any(String),
                                version: expect.any(String)
                            })
                        }),
                        results: expect.arrayContaining([
                            expect.objectContaining({
                                ruleId: expect.any(String),
                                message: expect.objectContaining({
                                    text: expect.any(String)
                                }),
                                level: expect.stringMatching(/^(error|warning|note|info)$/)
                            })
                        ])
                    })
                ])
            });
        });
    });
});
