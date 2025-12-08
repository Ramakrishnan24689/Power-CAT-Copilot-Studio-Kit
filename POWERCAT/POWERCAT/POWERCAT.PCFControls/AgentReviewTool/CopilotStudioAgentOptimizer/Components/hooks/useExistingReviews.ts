import * as React from 'react';
import { ReviewService } from '../../Services';
import type { BotDetail, AgentReviewRecord } from '../../types';
import { ReviewStatus } from '../../config';
import { useServiceContext } from '../context';

// Lazy-load sample data only when needed
const getSampleData = async () => {
    const { sampleAgentReviews } = await import('../../__tests__/fixtures/sampleAgentReviews');
    return { sampleAgentReviews };
};

interface UseExistingReviewsOptions {
    useTestHarness: boolean;
}

/**
 * Custom hook for managing existing reviews and stats
 * Extracted from BotsDataGrid for better separation of concerns
 */
export function useExistingReviews({ useTestHarness }: UseExistingReviewsOptions) {
    const { webAPI } = useServiceContext();
    const [existingReviews, setExistingReviews] = React.useState<Map<string, AgentReviewRecord>>(new Map());
    const [isLoadingReviews, setIsLoadingReviews] = React.useState(false);
    const [reviewedCount, setReviewedCount] = React.useState<number | undefined>(undefined);
    const [averageScore, setAverageScore] = React.useState<number | undefined>(undefined);
    const [totalIssues, setTotalIssues] = React.useState<number | undefined>(undefined);

    // Load existing completed reviews
    const loadExistingReviews = React.useCallback(async () => {
        console.log('[useExistingReviews] 🔄 Loading reviews - useTestHarness:', useTestHarness);
        
        // Clear any potential cache conflicts
        console.log('[useExistingReviews] 🧹 Clearing review-related cache...');
        
        setIsLoadingReviews(true);

        try {
            let reviews: AgentReviewRecord[];
            const reviewService = new ReviewService(webAPI);

            if (useTestHarness) {
                console.log('[useExistingReviews] Using sample agent reviews');
                const { sampleAgentReviews } = await getSampleData();
                reviews = sampleAgentReviews.value;
            } else {
                console.log('[useExistingReviews] Fetching from Dataverse - cat_agentreviewses table');
                try {
                    console.log(`[useExistingReviews] 🔍 First attempting with status filter = ${ReviewStatus.Completed}`);
                    reviews = await reviewService.getAllReviews(ReviewStatus.Completed);
                    console.log('[useExistingReviews] Dataverse response with status filter:', reviews);
                    
                    // If no reviews with completed status, try fetching all reviews to debug
                    if (!reviews || reviews.length === 0) {
                        console.log('[useExistingReviews] 🚨 No completed reviews found. Checking for ANY reviews...');
                        console.log('[useExistingReviews] 🔍 Now attempting without status filter to see all records');
                        const allReviews = await reviewService.getAllReviews();
                        console.log('[useExistingReviews] All reviews (any status):', allReviews);
                        
                        if (allReviews && allReviews.length > 0) {
                            console.log('[useExistingReviews] ⚠️ Found reviews with different status codes:', 
                                allReviews.map((r: AgentReviewRecord) => ({
                                    id: r.cat_agentreviewsid,
                                    status: r.cat_reviewstatus,
                                    botName: r.cat_botname
                                })));
                            reviews = allReviews;
                        } else {
                            reviews = [];
                        }
                    }
                } catch (fetchError) {
                    console.error('[useExistingReviews] Error fetching reviews:', fetchError);
                    throw fetchError;
                }
            }

            console.log('[useExistingReviews] 🔍 Raw response analysis:', {
                isArray: Array.isArray(reviews),
                length: reviews.length,
                sampleItems: reviews.slice(0, 2).map((item: AgentReviewRecord) => ({
                    id: item?.cat_agentreviewsid,
                    status: item?.cat_reviewstatus,
                    score: item?.cat_overallscore
                }))
            });

            // Create map for quick lookup by componentIdUnique
            const reviewMap = reviewService.createReviewMap(reviews);
            setExistingReviews(reviewMap);
            
            // Update reviewed count with total from all pages
            setReviewedCount(reviews.length);
            console.log('[useExistingReviews] Set reviewedCount to:', reviews.length);
            
            // Calculate average score and total issues from all reviews
            let calculatedAvgScore = 0;
            let calculatedTotalIssues = 0;
            
            if (reviews.length > 0) {
                console.log('[useExistingReviews] Sample review data for calculation:', 
                    reviews.slice(0, 3).map((r: AgentReviewRecord) => ({
                        id: r.cat_agentreviewsid,
                        score: r.cat_overallscore,
                        issues: r.cat_totalissues,
                        componentId: r.cat_componentidunique
                    })));
                
                const totalScore = reviews.reduce((sum: number, review: AgentReviewRecord): number => {
                    const score = Number(review.cat_overallscore ?? 0);
                    console.log(`[useExistingReviews] Adding score: ${score} (from review ${review.cat_agentreviewsid})`);
                    return sum + score;
                }, 0);
                
                calculatedAvgScore = Math.round(totalScore / reviews.length);
                setAverageScore(calculatedAvgScore);
                
                calculatedTotalIssues = reviews.reduce((sum: number, review: AgentReviewRecord): number => {
                    const issues = Number(review.cat_totalissues ?? 0);
                    console.log(`[useExistingReviews] Adding issues: ${issues} (from review ${review.cat_agentreviewsid})`);
                    return sum + issues;
                }, 0);
                setTotalIssues(calculatedTotalIssues);
                
                console.log('[useExistingReviews] Score calculation:', {
                    totalScore,
                    reviewCount: reviews.length,
                    calculatedAvgScore,
                    calculatedTotalIssues
                });
            } else {
                console.log('[useExistingReviews] No reviews found, setting scores to 0');
                setAverageScore(0);
                setTotalIssues(0);
            }

            console.log('[useExistingReviews] Loaded existing reviews:', {
                count: reviewMap.size,
                totalReviews: reviews.length,
                averageScore: calculatedAvgScore,
                totalIssues: calculatedTotalIssues,
                componentIds: Array.from(reviewMap.keys())
            });

        } catch (error) {
            console.error('[useExistingReviews] Failed to load existing reviews:', error);
            console.log('[useExistingReviews] Error details:', {
                name: (error as Error)?.name,
                message: (error as Error)?.message,
                stack: (error as Error)?.stack,
                useTestHarness
            });
            // Set empty map and zero counts on error to allow component to continue
            setExistingReviews(new Map());
            setReviewedCount(0);
            setAverageScore(0);
            setTotalIssues(0);
            console.log('[useExistingReviews] Reset all stats to 0 due to error');
        } finally {
            setIsLoadingReviews(false);
        }
    }, [useTestHarness, webAPI]); // Remove averageScore, totalIssues dependencies that cause circular updates

    // Add this function to efficiently update a single review without refetching all data
    const updateReviewInCache = React.useCallback((newReview: AgentReviewRecord, componentIdUnique: string) => {
        console.log('[useExistingReviews] 🚀 Updating review in cache:', {
            componentIdUnique,
            newScore: newReview.cat_overallscore,
            newIssues: newReview.cat_totalissues
        });
        
        // Get the old review if it exists
        const oldReview = existingReviews.get(componentIdUnique);
        
        // Update the map with new/updated review
        const updatedMap = new Map(existingReviews);
        updatedMap.set(componentIdUnique, newReview);
        setExistingReviews(updatedMap);
        
        // Recalculate stats incrementally (much faster than refetching all)
        if (oldReview) {
            // Update existing review - adjust counts
            console.log('[useExistingReviews] ✏️ Updating existing review');
            
            // Average score: remove old, add new
            const currentTotal = (averageScore ?? 0) * (reviewedCount ?? 0);
            const oldScore = oldReview.cat_overallscore ?? 0;
            const newScore = newReview.cat_overallscore ?? 0;
            const newTotal = currentTotal - oldScore + newScore;
            const newAvg = Math.round(newTotal / (reviewedCount ?? 1));
            
            // Total issues: subtract old, add new  
            const oldIssues = oldReview.cat_totalissues ?? 0;
            const newIssues = newReview.cat_totalissues ?? 0;
            const updatedTotalIssues = (totalIssues ?? 0) - oldIssues + newIssues;
            
            setAverageScore(newAvg);
            setTotalIssues(updatedTotalIssues);
            
            console.log('[useExistingReviews] ✅ Updated stats for existing review:', {
                oldScore, newScore, newAvg,
                oldIssues, newIssues, updatedTotalIssues,
                reviewedCount
            });
            
        } else {
            // New review - increment counts
            console.log('[useExistingReviews] ➕ Adding new review');
            
            const newReviewedCount = (reviewedCount ?? 0) + 1;
            const currentTotal = (averageScore ?? 0) * (reviewedCount ?? 0);
            const newScore = newReview.cat_overallscore ?? 0;
            const newTotal = currentTotal + newScore;
            const newAvg = Math.round(newTotal / newReviewedCount);
            
            const newIssues = newReview.cat_totalissues ?? 0;
            const updatedTotalIssues = (totalIssues ?? 0) + newIssues;
            
            setReviewedCount(newReviewedCount);
            setAverageScore(newAvg);
            setTotalIssues(updatedTotalIssues);
            
            console.log('[useExistingReviews] ✅ Added new review stats:', {
                newReviewedCount, newScore, newAvg, newIssues, updatedTotalIssues
            });
        }
    }, [existingReviews, reviewedCount, averageScore, totalIssues]);

    return {
        existingReviews,
        isLoadingReviews,
        reviewedCount,
        averageScore,
        totalIssues,
        loadExistingReviews,
        updateReviewInCache,
    };
}
