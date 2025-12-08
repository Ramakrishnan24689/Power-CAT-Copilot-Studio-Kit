/**
 * Sample review history data
 * In production, this will come from a Dataverse custom table
 */

import type { BotReviewHistory, AggregateStats } from '../../types';

/**
 * Mock review history for sample bots
 * Note: Only includes bots that have been reviewed
 */
export const sampleReviewHistory: BotReviewHistory[] = [
    {
        botId: "bb1b386f-072e-47a5-9c92-0a27b30e90bc", // Energy Feedback Collector
        lastReviewedDate: "2025-11-15T14:30:00Z",
        overallScore: 85,
        totalIssues: 3,
        criticalIssues: 0,
        reviewedBy: "59c44d60-2962-f011-bec2-7c1e5213ac98"
    },
    {
        botId: "dd3d5a8f-294f-69c7-be14-2c49d52fb2de", // HR Assistant
        lastReviewedDate: "2025-11-10T09:15:00Z",
        overallScore: 72,
        totalIssues: 8,
        criticalIssues: 2,
        reviewedBy: "59c44d60-2962-f011-bec2-7c1e5213ac98"
    },
    {
        botId: "ff5f7c0f-4b6f-8be9-e036-4e6bf74gd4fg", // Sales Advisor
        lastReviewedDate: "2025-11-17T16:45:00Z",
        overallScore: 91,
        totalIssues: 2,
        criticalIssues: 0,
        reviewedBy: "59c44d60-2962-f011-bec2-7c1e5213ac98"
    }
];

/**
 * Helper function to get review history for a specific bot
 */
export function getReviewHistory(botId: string): BotReviewHistory | undefined {
    return sampleReviewHistory.find(review => review.botId === botId);
}

/**
 * Helper function to calculate aggregate stats
 */
export function calculateAggregateStats(botIds: string[]): AggregateStats {
    const reviewedBots = botIds
        .map(id => getReviewHistory(id))
        .filter((review): review is BotReviewHistory => review !== undefined);

    const totalBots = botIds.length;
    const reviewedCount = reviewedBots.length;
    const reviewedPercentage = totalBots > 0 ? Math.round((reviewedCount / totalBots) * 100) : 0;
    
    const averageScore = reviewedCount > 0
        ? Math.round(reviewedBots.reduce((sum, r) => sum + r.overallScore, 0) / reviewedCount)
        : 0;
    
    const totalIssues = reviewedBots.reduce((sum, r) => sum + r.totalIssues, 0);
    const patternsFound = reviewedBots.length > 0 ? reviewedBots.length * 8 : 0; // Avg ~8 patterns per bot

    return {
        totalBots,
        reviewedBots: reviewedCount,
        reviewedPercentage,
        averageScore,
        totalIssues,
        patternsFound
    };
}
