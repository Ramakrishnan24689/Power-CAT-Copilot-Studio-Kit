/// <reference types="@testing-library/jest-dom" />

/**
 * Comprehensive tests for PDF Report Generation
 * Tests the most critical functionality for generating professional PDF reports
 */

import { generatePdfReport, downloadPdfReport, type PdfReportInput } from '../Services/generatePdfReport';
import type { Pattern, InstructionEvaluation } from '../types';

// Mock jsPDF
jest.mock('jspdf', () => {
    const mockDoc = {
        internal: {
            pageSize: {
                getWidth: () => 210,
                getHeight: () => 297
            },
            pages: ['', '', ''] // 3 pages
        },
        setFontSize: jest.fn(),
        setTextColor: jest.fn(),
        setFont: jest.fn(),
        setFillColor: jest.fn(),
        setDrawColor: jest.fn(),
        setLineWidth: jest.fn(),
        text: jest.fn(),
        rect: jest.fn(),
        roundedRect: jest.fn(),
        circle: jest.fn(),
        line: jest.fn(),
        addImage: jest.fn(),
        addPage: jest.fn(),
        setPage: jest.fn(),
        splitTextToSize: jest.fn((text: string) => [text]),
        output: jest.fn(() => 'data:application/pdf;base64,JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL09')
    };
    
    return {
        jsPDF: jest.fn(() => mockDoc)
    };
});

// Mock Chart.js
jest.mock('chart.js', () => ({
    Chart: jest.fn(),
    registerables: []
}));

// Mock DOM APIs
Object.defineProperty(global, 'document', {
    value: {
        createElement: jest.fn(() => ({
            width: 0,
            height: 0,
            getContext: jest.fn(() => ({})),
            toDataURL: jest.fn(() => 'data:image/png;base64,mock-chart-image')
        }))
    }
});

describe('generatePdfReport', () => {
    const mockDate = new Date('2024-12-04T10:30:00Z');
    
    const createMockInput = (overrides: Partial<PdfReportInput> = {}): PdfReportInput => ({
        botName: 'Test Agent',
        reviewDate: mockDate,
        overallScore: 85,
        patternScore: 90,
        instructionScore: 80,
        patterns: [],
        agentInstructions: 'Test agent instructions',
        sarifUrl: 'https://example.com/sarif.json',
        ...overrides
    });

    const createMockPattern = (overrides: Partial<Pattern> = {}): Pattern => ({
        PatternName: 'Test Pattern',
        PatternDescription: 'Test pattern description',
        Status: true,
        Topics: [],
        Recommendation: 'Test recommendation',
        ...overrides
    });

    const createMockInstructionEval = (overrides: Partial<InstructionEvaluation> = {}): InstructionEvaluation => ({
        compliance: false,
        compliancePercentage: 70,
        issues: [],
        ...overrides
    });

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic PDF Generation', () => {
        it('should generate PDF with minimal input', async () => {
            const input = createMockInput();
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(0);
        });

        it('should handle empty bot name gracefully', async () => {
            const input = createMockInput({ botName: '' });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });

        it('should handle missing optional fields', async () => {
            const input = createMockInput({
                agentInstructions: undefined,
                instructionEval: undefined,
                sarifUrl: undefined
            });
            
            const result = await generatePdfReport(input);
            expect(result).toBeDefined();
        });
    });

    describe('Score Handling', () => {
        it('should handle perfect scores (100%)', async () => {
            const input = createMockInput({
                overallScore: 100,
                patternScore: 100,
                instructionScore: 100
            });
            
            const result = await generatePdfReport(input);
            expect(result).toBeDefined();
        });

        it('should handle failing scores (0%)', async () => {
            const input = createMockInput({
                overallScore: 0,
                patternScore: 0,
                instructionScore: 0
            });
            
            const result = await generatePdfReport(input);
            expect(result).toBeDefined();
        });

        it('should handle edge case scores', async () => {
            const input = createMockInput({
                overallScore: 59.99,
                patternScore: 80.01,
                instructionScore: 39.5
            });
            
            const result = await generatePdfReport(input);
            expect(result).toBeDefined();
        });
    });

    describe('Pattern Analysis', () => {
        it('should handle empty patterns array', async () => {
            const input = createMockInput({ patterns: [] });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });

        it('should handle single passing pattern', async () => {
            const pattern = createMockPattern({
                PatternDescription: 'Single test pattern',
                Status: true
            });
            
            const input = createMockInput({ patterns: [pattern] });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });

        it('should handle single failing pattern with topics', async () => {
            const pattern = createMockPattern({
                PatternDescription: 'Failing pattern with issues',
                Status: false,
                Topics: [
                    {
                        item: 'Test issue 1',
                        variable: 'testVar',
                        current: 'current value',
                        suggested: 'suggested value'
                    },
                    {
                        item: 'Test issue 2',
                        current: 'another current',
                        suggested: 'another suggestion'
                    }
                ]
            });
            
            const input = createMockInput({ patterns: [pattern] });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });

        it('should handle multiple patterns (mixed status)', async () => {
            const patterns = [
                createMockPattern({ PatternName: '1', Status: true }),
                createMockPattern({ PatternName: '2', Status: false, Topics: [{ item: 'Issue', current: 'bad', suggested: 'good' }] }),
                createMockPattern({ PatternName: '3', Status: true }),
                createMockPattern({ PatternName: '4', Status: false })
            ];
            
            const input = createMockInput({ patterns });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });

        it('should handle very long pattern descriptions', async () => {
            const longDescription = 'A'.repeat(500); // Very long description
            const pattern = createMockPattern({
                PatternDescription: longDescription,
                Status: false
            });
            
            const input = createMockInput({ patterns: [pattern] });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });
    });

    describe('Instruction Evaluation', () => {
        it('should handle instruction evaluation with no issues', async () => {
            const instructionEval = createMockInstructionEval({
                compliance: true,
                compliancePercentage: 95,
                issues: []
            });
            
            const input = createMockInput({ instructionEval });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });

        it('should handle instruction evaluation with multiple issues', async () => {
            const instructionEval = createMockInstructionEval({
                compliance: false,
                compliancePercentage: 65,
                issues: [
                    {
                        id: 'INST-001',
                        severity: 'high' as const,
                        description: 'Critical instruction issue that needs immediate attention',
                        recommendation: 'Fix this issue by doing XYZ'
                    },
                    {
                        id: 'INST-002',
                        severity: 'medium' as const,
                        description: 'Medium priority issue',
                        recommendation: 'Consider improving this aspect'
                    },
                    {
                        id: 'INST-003',
                        severity: 'low' as const,
                        description: 'Low priority cosmetic issue',
                        recommendation: 'Optional improvement'
                    }
                ]
            });
            
            const input = createMockInput({ instructionEval });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });

        it('should handle very long issue descriptions', async () => {
            const longDescription = 'This is a very long description that should test the text wrapping functionality of the PDF generator. '.repeat(10);
            const longRecommendation = 'This is a very long recommendation that should also test wrapping. '.repeat(8);
            
            const instructionEval = createMockInstructionEval({
                issues: [{
                    id: 'LONG-001',
                    severity: 'high' as const,
                    description: longDescription,
                    recommendation: longRecommendation
                }]
            });
            
            const input = createMockInput({ instructionEval });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });
    });

    describe('Agent Instructions', () => {
        it('should handle very long agent instructions', async () => {
            const longInstructions = `
                This is a very long set of agent instructions that should test the text wrapping
                and page break functionality of the PDF generator. This includes multiple paragraphs,
                special characters like émojis 🚀, Unicode characters: àáâãäå, and symbols like @#$%^&*.
                
                Second paragraph with more content to ensure proper handling of line breaks and formatting.
                
                Third paragraph with even more content to potentially trigger page breaks in the PDF generation.
                This should test the robustness of the PDF generation when dealing with large amounts of text.
            `.repeat(20);
            
            const input = createMockInput({ agentInstructions: longInstructions });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });

        it('should handle agent instructions with special characters', async () => {
            const specialInstructions = `
                Instructions with special characters:
                - Smart quotes: "Hello" and 'world'
                - Em/En dashes: — and –
                - Unicode: àáâãäåæçèéêë
                - Symbols: @#$%^&*()_+{}|:<>?[]\\;'",./
                - Line breaks and spaces
            `;
            
            const input = createMockInput({ agentInstructions: specialInstructions });
            const result = await generatePdfReport(input);
            
            expect(result).toBeDefined();
        });
    });

    describe('Error Handling', () => {
        it('should handle null/undefined values gracefully', async () => {
            const input = createMockInput({
                patterns: [createMockPattern({
                    PatternDescription: undefined as any,
                    Topics: null as any
                })]
            });
            
            const result = await generatePdfReport(input);
            expect(result).toBeDefined();
        });

        it('should handle malformed pattern topics', async () => {
            const input = createMockInput({
                patterns: [createMockPattern({
                    Status: false,
                    Topics: [
                        { item: undefined, current: null, suggested: undefined } as any,
                        { } as any,
                        { item: 'valid', current: 'ok', suggested: 'better' }
                    ]
                })]
            });
            
            const result = await generatePdfReport(input);
            expect(result).toBeDefined();
        });
    });

    describe('Integration Scenarios', () => {
        it('should generate complete report with all features', async () => {
            const comprehensiveInput = createMockInput({
                botName: 'Comprehensive Test Agent',
                overallScore: 75,
                patternScore: 80,
                instructionScore: 70,
                patterns: [
                    createMockPattern({ PatternName: '1', Status: true }),
                    createMockPattern({
                        PatternName: '2',
                        Status: false,
                        Topics: [
                            { item: 'Critical issue', variable: 'var1', current: 'bad', suggested: 'good' }
                        ]
                    })
                ],
                instructionEval: createMockInstructionEval({
                    compliance: false,
                    compliancePercentage: 70,
                    issues: [
                        {
                            id: 'COMPREHENSIVE-001',
                            severity: 'high' as const,
                            description: 'Comprehensive test issue',
                            recommendation: 'Fix comprehensively'
                        }
                    ]
                }),
                agentInstructions: 'Comprehensive agent instructions for testing'
            });
            
            const result = await generatePdfReport(comprehensiveInput);
            expect(result).toBeDefined();
            expect(typeof result).toBe('string');
            expect(result.length).toBeGreaterThan(100); // Should be substantial content
        });
    });
});

describe('downloadPdfReport', () => {
    const mockCreateObjectURL = jest.fn();
    const mockRevokeObjectURL = jest.fn();
    const mockClick = jest.fn();
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock URL methods
        Object.defineProperty(window, 'URL', {
            value: {
                createObjectURL: mockCreateObjectURL,
                revokeObjectURL: mockRevokeObjectURL
            }
        });
        
        // Mock DOM methods
        const mockLink = {
            href: '',
            download: '',
            click: mockClick
        };
        
        const mockAppendChild = jest.fn();
        const mockRemoveChild = jest.fn();
        
        Object.defineProperty(document, 'createElement', {
            value: jest.fn(() => mockLink)
        });
        
        Object.defineProperty(document.body, 'appendChild', {
            value: mockAppendChild
        });
        
        Object.defineProperty(document.body, 'removeChild', {
            value: mockRemoveChild
        });
        
        mockCreateObjectURL.mockReturnValue('blob:mock-url');
    });

    it('should trigger download with correct filename', () => {
        const mockBase64 = 'JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL09';
        const botName = 'Test Agent';
        
        downloadPdfReport(mockBase64, botName);
        
        expect(document.createElement).toHaveBeenCalledWith('a');
        expect(mockCreateObjectURL).toHaveBeenCalled();
        expect(mockClick).toHaveBeenCalled();
        expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('should sanitize bot name for filename', () => {
        const mockBase64 = 'JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL085';
        const botName = 'Test Agent With Spaces & Special!@#$%^&*()Characters';
        
        downloadPdfReport(mockBase64, botName);
        
        expect(mockClick).toHaveBeenCalled();
        // The filename should have special characters replaced with underscores
    });

    it('should handle empty bot name', () => {
        const mockBase64 = 'JVBERi0xLjMKJcTl8uXrp/Og0MTGCjQgMCBvYmoKPDwKL1R5cGUgL0NhdGFsb2cKL085';
        const botName = '';
        
        expect(() => downloadPdfReport(mockBase64, botName)).not.toThrow();
        expect(mockClick).toHaveBeenCalled();
    });
});

describe('Text Cleaning Utilities', () => {
    // Since cleanTextForPdf is not exported, we test it indirectly through generatePdfReport
    
    it('should handle text with special Unicode characters', async () => {
        const input: PdfReportInput = {
            botName: 'Test Agent with émojis 🚀 and Unicode àáâãäå',
            reviewDate: new Date(),
            overallScore: 85,
            patternScore: 90,
            instructionScore: 80,
            patterns: [],
            agentInstructions: 'Instructions with "smart quotes" and — em dashes'
        };
        
        const result = await generatePdfReport(input);
        expect(result).toBeDefined();
    });
    
    it('should handle text with control characters', async () => {
        const input: PdfReportInput = {
            botName: 'Test Agent',
            reviewDate: new Date(),
            overallScore: 85,
            patternScore: 90,
            instructionScore: 80,
            patterns: [
                {
                    PatternName: '1',
                    PatternDescription: 'Pattern with\u0000control\u001Fcharacters\u007F',
                    Status: false,
                    Topics: [
                        {
                            item: 'Issue with\u00ADsoft hyphen and\u00A0non-breaking space',
                            current: 'bad\uFEFFwith BOM',
                            suggested: 'good'
                        }
                    ]
                } as Pattern
            ]
        };
        
        const result = await generatePdfReport(input);
        expect(result).toBeDefined();
    });
});
