/**
 * Sample response for cat_agentreviewses table query
 * Simulates retrieveMultipleRecords response with completed reviews
 */

import type { AgentReviewRecord, AgentReviewsResponse } from '../../types';

// Sample completed reviews for testing
export const sampleAgentReviews: AgentReviewsResponse = {
    '@odata.context': "/api/data/v9.2/$metadata#cat_agentreviewses",
    value: [
        {
            cat_agentreviewsid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
            cat_name: 'Energy Feedback Collector - 11/18/2025',
            cat_botid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            cat_botname: 'Energy Feedback Collector',
            cat_componentidunique: '12643364-5b24-41c2-a95b-d0671076d828',
            cat_overallscore: 85,
            cat_patternscore: 90,
            cat_instructionscore: 80,
            cat_totalpatterns: 10,
            cat_passedpatterns: 9,
            cat_failedpatterns: 1,
            cat_totalissues: 3,
            cat_highseverityissues: 1,
            cat_reviewdate: '2025-11-18T10:30:00Z',
            cat_reviewstatus: 33535000, // Completed
            _ownerid_value: '59c44d60-2962-f011-bec2-7c1e5213ac98',
            _ownerid_value_formatted: 'John Doe',
            _ownerid_value_lookuplogicalname: 'systemuser'
        },
        {
            cat_agentreviewsid: 'b2c3d4e5-f6a7-8901-bcde-fg2345678901',
            cat_name: 'Customer Support Bot - 11/17/2025',
            cat_botid: 'cc2c497f-183f-58b6-ad03-1b38c41fa1cd',
            cat_botname: 'Customer Support Bot',
            cat_componentidunique: '23754475-6c35-52d3-b0a6-e1782187e939',
            cat_overallscore: 72,
            cat_patternscore: 70,
            cat_instructionscore: 75,
            cat_totalpatterns: 12,
            cat_passedpatterns: 8,
            cat_failedpatterns: 4,
            cat_totalissues: 7,
            cat_highseverityissues: 2,
            cat_reviewdate: '2025-11-17T14:20:00Z',
            cat_reviewstatus: 33535000, // Completed
            _ownerid_value: '59c44d60-2962-f011-bec2-7c1e5213ac98',
            _ownerid_value_formatted: 'John Doe',
            _ownerid_value_lookuplogicalname: 'systemuser'
        },
        {
            cat_agentreviewsid: 'c3d4e5f6-a7b8-9012-cdef-gh3456789012',
            cat_name: 'Sales Advisor - 11/16/2025',
            cat_botid: '23456789-2345-2345-2345-234567890123',
            cat_botname: 'Sales Advisor',
            cat_componentidunique: '3c4d5e6f-7a8b-9012-cdef-345678901cde',
            cat_overallscore: 95,
            cat_patternscore: 100,
            cat_instructionscore: 90,
            cat_totalpatterns: 8,
            cat_passedpatterns: 8,
            cat_failedpatterns: 0,
            cat_totalissues: 1,
            cat_highseverityissues: 0,
            cat_reviewdate: '2025-11-16T09:15:00Z',
            cat_reviewstatus: 33535000, // Completed
            _ownerid_value: '59c44d60-2962-f011-bec2-7c1e5213ac98',
            _ownerid_value_formatted: 'John Doe',
            _ownerid_value_lookuplogicalname: 'systemuser'
        }
    ]
};
