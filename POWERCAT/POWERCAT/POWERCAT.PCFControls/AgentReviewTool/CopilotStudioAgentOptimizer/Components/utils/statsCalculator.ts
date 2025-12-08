/**
 * Aggregate statistics calculator
 * Separated from sample data to avoid bundling sample data in production
 */

import type { AggregateStats, BotReviewSummary } from '../../types';

/**
 * Calculate aggregate statistics from review summaries
 * @param totalBots Total number of bots
 * @param reviewSummaries Array of review summaries for reviewed bots
 */
export function calculateAggregateStats(
    totalBots: number,
    reviewSummaries: BotReviewSummary[]
): AggregateStats {
    const reviewedCount = reviewSummaries.length;
    const reviewedPercentage = totalBots > 0 ? Math.round((reviewedCount / totalBots) * 100) : 0;
    
    const averageScore = reviewedCount > 0
        ? Math.round(reviewSummaries.reduce((sum, r) => sum + r.overallScore, 0) / reviewedCount)
        : 0;
    
    const totalIssues = reviewSummaries.reduce((sum, r) => sum + r.totalIssues, 0);
    const patternsFound = reviewedCount > 0 ? reviewedCount * 8 : 0; // Avg ~8 patterns per bot

    return {
        totalBots,
        reviewedBots: reviewedCount,
        reviewedPercentage,
        averageScore,
        totalIssues,
        patternsFound
    };
}
