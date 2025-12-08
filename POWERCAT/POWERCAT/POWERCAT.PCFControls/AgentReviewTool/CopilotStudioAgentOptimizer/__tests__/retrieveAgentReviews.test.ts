/// <reference types="@testing-library/jest-dom" />

/**
 * Tests for Agent Review Service
 * Validates the core business logic for retrieving and processing agent reviews
 */

import { retrieveAgentReviews, createReviewMap } from '../Services/retrieveAgentReviews';
import type { AgentReviewRecord, AgentReviewsResponse } from '../types';

// Mock the WebAPI
const createMockWebAPI = (): ComponentFramework.WebApi => ({
    createRecord: jest.fn(),
    deleteRecord: jest.fn(),
    updateRecord: jest.fn(),
    retrieveRecord: jest.fn(),
    retrieveMultipleRecords: jest.fn(),
} as unknown as ComponentFramework.WebApi);

describe('retrieveAgentReviews', () => {
    let mockWebAPI: ComponentFramework.WebApi;

    beforeEach(() => {
        mockWebAPI = createMockWebAPI();
        jest.clearAllMocks();
    });

    const createMockWebAPIResponse = (overrides = {}): any => ({
        entities: [
            {
                cat_agentreviewsid: 'review-123',
                cat_name: 'Test Review',
                cat_botid: 'bot-123',
                cat_botname: 'Test Agent',
                cat_componentidunique: 'comp-123',
                cat_overallscore: 85,
                cat_patternscore: 90,
                cat_instructionscore: 80,
                cat_totalpatterns: 10,
                cat_passedpatterns: 8,
                cat_failedpatterns: 2,
                cat_totalissues: 5,
                cat_highseverityissues: 1,
                cat_reviewdate: '2024-12-04T10:00:00Z',
                cat_reviewstatus: 335350000,
                _ownerid_value: 'owner-123',
                ...overrides
            }
        ]
    });

    describe('Successful Retrieval', () => {
        it('should retrieve agent reviews successfully', async () => {
            const mockResponse = createMockWebAPIResponse();
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            const result = await retrieveAgentReviews(mockWebAPI);

            expect(result).toBeDefined();
            expect(result.value).toBeDefined();
            expect(Array.isArray(result.value)).toBe(true);
            expect(result.value).toHaveLength(1);
            expect(result.value[0]).toMatchObject({
                cat_agentreviewsid: 'review-123',
                cat_botname: 'Test Agent',
                cat_overallscore: 85
            });
        });

        it('should handle multiple agent reviews', async () => {
            const mockResponse = {
                entities: [
                    {
                        cat_agentreviewsid: 'review-1',
                        cat_botname: 'Agent One',
                        cat_overallscore: 85
                    },
                    {
                        cat_agentreviewsid: 'review-2', 
                        cat_botname: 'Agent Two',
                        cat_overallscore: 90
                    },
                    {
                        cat_agentreviewsid: 'review-3',
                        cat_botname: 'Agent Three',
                        cat_overallscore: 75
                    }
                ]
            };
            
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            const result = await retrieveAgentReviews(mockWebAPI);

            expect(result.value).toHaveLength(3);
            expect(result.value.map(r => r.cat_agentreviewsid)).toEqual(['review-1', 'review-2', 'review-3']);
            expect(result.value.map(r => r.cat_botname)).toEqual(['Agent One', 'Agent Two', 'Agent Three']);
            expect(result.value.map(r => r.cat_overallscore)).toEqual([85, 90, 75]);
        });

        it('should handle empty results', async () => {
            const mockResponse = {
                entities: []
            };
            
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            const result = await retrieveAgentReviews(mockWebAPI);

            expect(result).toBeDefined();
            expect(result.value).toBeDefined();
            expect(Array.isArray(result.value)).toBe(true);
            expect(result.value).toHaveLength(0);
        });
    });

    describe('Data Transformation', () => {
        it('should preserve all review data fields', async () => {
            const mockReview = {
                cat_agentreviewsid: 'review-full',
                cat_name: 'Complete Review',
                cat_botid: 'bot-456',
                cat_botname: 'Full Test Agent',
                cat_componentidunique: 'comp-456',
                cat_overallscore: 92,
                cat_patternscore: 95,
                cat_instructionscore: 89,
                cat_totalpatterns: 15,
                cat_passedpatterns: 14,
                cat_failedpatterns: 1,
                cat_totalissues: 2,
                cat_highseverityissues: 0,
                cat_reviewdate: '2024-12-04T15:30:00Z',
                cat_reviewstatus: 335350000,
                cat_reviewpdfreport: 'base64content',
                cat_reviewpdfreport_name: 'review-report.pdf',
                _ownerid_value: 'owner-456'
            };

            const mockResponse: AgentReviewsResponse = {
                '@odata.context': '',
                value: [mockReview as AgentReviewRecord]
            };
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            const result = await retrieveAgentReviews(mockWebAPI);
            const review = result.value[0];

            expect(review.cat_agentreviewsid).toBe('review-full');
            expect(review.cat_botname).toBe('Full Test Agent');
            expect(review.cat_overallscore).toBe(92);
            expect(review.cat_patternscore).toBe(95);
            expect(review.cat_instructionscore).toBe(89);
            expect(review.cat_reviewdate).toBe('2024-12-04T15:30:00Z');
            expect(review.cat_reviewpdfreport).toBe('base64content');
        });

        it('should handle missing optional fields', async () => {
            const mockReview = {
                cat_agentreviewsid: 'review-minimal',
                cat_name: 'Minimal Review',
                cat_botid: 'bot-minimal',
                cat_botname: 'Minimal Agent',
                cat_componentidunique: 'comp-minimal',
                cat_overallscore: 70,
                cat_reviewdate: '2024-12-04T10:00:00Z'
                // Missing optional fields like PDF report, owner, etc.
            };

            const mockResponse: AgentReviewsResponse = {
                '@odata.context': '',
                value: [mockReview as AgentReviewRecord]
            };
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            const result = await retrieveAgentReviews(mockWebAPI);
            const review = result.value[0];

            expect(review.cat_agentreviewsid).toBe('review-minimal');
            expect(review.cat_botname).toBe('Minimal Agent');
            expect(review.cat_overallscore).toBe(70);
            expect(review.cat_reviewpdfreport).toBeUndefined();
            expect(review._ownerid_value).toBeUndefined();
        });

        it('should handle multiple pages of results', async () => {
            const firstPageResponse = {
                entities: [
                    { cat_agentreviewsid: 'review-1', cat_botname: 'Agent 1' }
                ],
                nextLink: 'https://test.crm.dynamics.com/api/data/v9.1/cat_agentreviews?$skiptoken=page2'
            };

            const secondPageResponse = {
                entities: [
                    { cat_agentreviewsid: 'review-2', cat_botname: 'Agent 2' }
                ]
            };

            (mockWebAPI.retrieveMultipleRecords as jest.Mock)
                .mockResolvedValueOnce(firstPageResponse)
                .mockResolvedValueOnce(secondPageResponse);

            const result = await retrieveAgentReviews(mockWebAPI);

            expect(result.value).toHaveLength(2);
            expect(result.value[0].cat_agentreviewsid).toBe('review-1');
            expect(result.value[1].cat_agentreviewsid).toBe('review-2');
            expect(mockWebAPI.retrieveMultipleRecords).toHaveBeenCalledTimes(2);
        });
    });

    describe('Error Handling', () => {
        it('should handle WebAPI network errors gracefully', async () => {
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockRejectedValue(
                new Error('Network error')
            );

            const result = await retrieveAgentReviews(mockWebAPI);

            // Should return empty response instead of throwing
            expect(result).toBeDefined();
            expect(result.value).toEqual([]);
        });

        it('should handle WebAPI timeout gracefully', async () => {
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockRejectedValue(
                new Error('Request timeout')
            );

            const result = await retrieveAgentReviews(mockWebAPI);

            // Should return empty response instead of throwing
            expect(result).toBeDefined();
            expect(result.value).toEqual([]);
        });

        it('should handle malformed WebAPI response gracefully', async () => {
            // Missing value array
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue({
                '@odata.context': 'test'
            });

            const result = await retrieveAgentReviews(mockWebAPI);

            // Should handle gracefully and return empty response
            expect(result).toBeDefined();
            expect(result.value).toEqual([]);
        });

        it('should handle null response gracefully', async () => {
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(null);

            const result = await retrieveAgentReviews(mockWebAPI);

            // Should return empty response instead of throwing
            expect(result).toBeDefined();
            expect(result.value).toEqual([]);
        });

        it('should handle undefined response gracefully', async () => {
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(undefined);

            const result = await retrieveAgentReviews(mockWebAPI);

            // Should return empty response instead of throwing
            expect(result).toBeDefined();
            expect(result.value).toEqual([]);
        });
    });

    describe('Query Construction', () => {
        it('should call WebAPI with correct entity and query parameters', async () => {
            const mockResponse = createMockAgentReviewResponse();
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            await retrieveAgentReviews(mockWebAPI);

            expect(mockWebAPI.retrieveMultipleRecords).toHaveBeenCalledWith(
                'cat_agentreviews',
                expect.stringContaining('$select=')
            );

            const callArgs = (mockWebAPI.retrieveMultipleRecords as jest.Mock).mock.calls[0];
            const query = callArgs[1];

            // Should include essential fields
            expect(query).toContain('cat_agentreviewsid');
            expect(query).toContain('cat_botname');
            expect(query).toContain('cat_overallscore');
        });

        it('should include status filter and ordering in query', async () => {
            const mockResponse = createMockAgentReviewResponse();
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            await retrieveAgentReviews(mockWebAPI, 335350000); // Completed status

            const callArgs = (mockWebAPI.retrieveMultipleRecords as jest.Mock).mock.calls[0];
            const query = callArgs[1];

            expect(query).toContain('$filter=cat_reviewstatus eq 335350000');
            expect(query).toContain('$orderby=cat_reviewdate desc');
        });

        it('should use default status filter when not provided', async () => {
            const mockResponse = createMockAgentReviewResponse();
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            await retrieveAgentReviews(mockWebAPI); // No status provided

            const callArgs = (mockWebAPI.retrieveMultipleRecords as jest.Mock).mock.calls[0];
            const query = callArgs[1];

            expect(query).toContain('$filter=cat_reviewstatus eq 335350000'); // Default to Completed
        });
    });

    describe('Performance Considerations', () => {
        it('should handle large result sets efficiently', async () => {
            // Create a large mock response
            const largeReviews = Array.from({ length: 100 }, (_, i) => ({
                cat_agentreviewsid: `review-${i}`,
                cat_botname: `Agent ${i}`,
                cat_overallscore: 70 + (i % 30),
                cat_reviewdate: '2024-12-04T10:00:00Z'
            }));

            const mockResponse = {
                entities: largeReviews
            };

            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            const startTime = Date.now();
            const result = await retrieveAgentReviews(mockWebAPI);
            const endTime = Date.now();

            expect(result.value).toHaveLength(100);
            // Should process in reasonable time (less than 1 second for 100 records)
            expect(endTime - startTime).toBeLessThan(1000);
        });

        it('should handle pagination correctly', async () => {
            const mockResponse = createMockAgentReviewResponse();
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            await retrieveAgentReviews(mockWebAPI);

            // Check that pagination logic is handled (even if single page)
            expect(mockWebAPI.retrieveMultipleRecords).toHaveBeenCalledTimes(1);
        });

        it('should prevent infinite pagination loops', async () => {
            // Mock a response that would cause infinite loop without safety check
            const mockResponse = {
                entities: [{ cat_agentreviewsid: 'test' }],
                nextLink: 'https://same.url.again/cat_agentreviews'
            };

            // Make it return the same nextLink indefinitely
            (mockWebAPI.retrieveMultipleRecords as jest.Mock).mockResolvedValue(mockResponse);

            const result = await retrieveAgentReviews(mockWebAPI);

            // Should break after safety limit (100 pages) and return accumulated results
            expect(result).toBeDefined();
            expect(mockWebAPI.retrieveMultipleRecords).toHaveBeenCalledTimes(100); // Safety limit
        });
    });

    describe('Utility Functions', () => {
        it('should create review map correctly', () => {
            const mockReviews: AgentReviewRecord[] = [
                {
                    cat_agentreviewsid: 'review-1',
                    cat_name: 'Review 1',
                    cat_componentidunique: 'comp-1',
                    cat_botname: 'Agent 1',
                    cat_overallscore: 85
                } as AgentReviewRecord,
                {
                    cat_agentreviewsid: 'review-2', 
                    cat_name: 'Review 2',
                    cat_componentidunique: 'comp-2',
                    cat_botname: 'Agent 2',
                    cat_overallscore: 90
                } as AgentReviewRecord,
                {
                    cat_agentreviewsid: 'review-3',
                    cat_name: 'Review 3', 
                    cat_componentidunique: 'comp-1', // Duplicate component
                    cat_botname: 'Agent 1 Updated',
                    cat_overallscore: 95
                } as AgentReviewRecord
            ];

            const reviewMap = createReviewMap(mockReviews);

            expect(reviewMap.size).toBe(2); // Only unique componentIds
            expect(reviewMap.has('comp-1')).toBe(true);
            expect(reviewMap.has('comp-2')).toBe(true);
            
            // Should keep first review for comp-1 (since reviews assumed to be pre-sorted by date desc)
            expect(reviewMap.get('comp-1')?.cat_agentreviewsid).toBe('review-1');
        });

        it('should handle empty review array', () => {
            const reviewMap = createReviewMap([]);
            expect(reviewMap.size).toBe(0);
        });

        it('should handle reviews without componentIdUnique', () => {
            const mockReviews: AgentReviewRecord[] = [
                {
                    cat_agentreviewsid: 'review-1',
                    cat_name: 'Review 1',
                    cat_componentidunique: undefined as any,
                    cat_botname: 'Agent 1'
                } as AgentReviewRecord
            ];

            const reviewMap = createReviewMap(mockReviews);
            expect(reviewMap.size).toBe(0); // Should skip reviews without componentIdUnique
        });
    });
});