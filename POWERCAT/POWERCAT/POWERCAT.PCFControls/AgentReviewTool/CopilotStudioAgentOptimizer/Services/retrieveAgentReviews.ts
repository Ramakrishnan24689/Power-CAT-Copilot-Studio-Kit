import type { AgentReviewRecord, AgentReviewsResponse } from '../types';

/**
 * Retrieves completed agent reviews from Dataverse cat_agentreviews table
 * @param webAPI - PCF WebAPI instance
 * @param reviewStatus - Optional review status filter (335350000 = Completed)
 * @returns Promise with reviews response
 */
export async function retrieveAgentReviews(
    webAPI: ComponentFramework.WebApi,
    reviewStatus?: number
): Promise<AgentReviewsResponse> {
    
    // Build OData query - only include fields that actually exist in the table
    let query = '?$select=cat_agentreviewsid,cat_name,cat_botid,cat_botname,cat_componentidunique,';
    query += 'cat_overallscore,cat_patternscore,cat_instructionscore,cat_totalpatterns,';
    query += 'cat_passedpatterns,cat_failedpatterns,cat_totalissues,cat_highseverityissues,';
    query += 'cat_reviewresultjson,cat_reviewdate,cat_reviewstatus,cat_reviewpdfreport,cat_reviewpdfreport_name,_ownerid_value';
    // NOTE: PDF fields now available in schema (cat_reviewpdfreport, cat_reviewpdfreport_name)
    
    // Filter by review status if provided (default to Completed = 335350000)
    const statusFilter = reviewStatus ?? 335350000;
    query += `&$filter=cat_reviewstatus eq ${statusFilter}`;
    
    // Order by review date descending (most recent first)
    query += '&$orderby=cat_reviewdate desc';
    
    console.log('[retrieveAgentReviews] Making paginated API call:', {
        entity: 'cat_agentreviews',
        query: query,
        statusFilter: statusFilter
    });
    
    try {
        // Handle pagination - collect all pages
        const allEntities: AgentReviewRecord[] = [];
        let currentQuery = query;
        let pageCount = 0;
        
        do {
            pageCount++;
            console.log(`[retrieveAgentReviews] Fetching page ${pageCount}...`);
            
            const result = await webAPI.retrieveMultipleRecords(
                'cat_agentreviews',
                currentQuery
            );
            
            console.log(`[retrieveAgentReviews] Page ${pageCount} response:`, {
                count: result.entities.length,
                hasNextLink: !!result.nextLink,
                totalCollected: allEntities.length + result.entities.length,
                sampleEntity: result.entities[0] ? {
                    id: result.entities[0].cat_agentreviewsid,
                    name: result.entities[0].cat_name,
                    status: result.entities[0].cat_reviewstatus
                } : null,
                allEntityIds: result.entities.map((e: ComponentFramework.WebApi.Entity) => e.cat_agentreviewsid as string)
            });
            
            // Add entities from this page
            allEntities.push(...(result.entities as AgentReviewRecord[]));
            
            // Check if there's a next page
            if (result.nextLink) {
                // Extract the query part from nextLink URL
                const nextUrl = new URL(result.nextLink);
                currentQuery = nextUrl.search; // This includes the '?' prefix
                console.log(`[retrieveAgentReviews] Next page query:`, currentQuery);
            } else {
                currentQuery = '';
                break;
            }
            
            // Safety check to prevent infinite loops
            if (pageCount > 100) {
                console.warn('[retrieveAgentReviews] Breaking pagination loop at 100 pages for safety');
                break;
            }
            
        } while (currentQuery);
        
        console.log('[retrieveAgentReviews] Pagination complete:', {
            totalPages: pageCount,
            totalRecords: allEntities.length,
            entityIds: allEntities.map((e: AgentReviewRecord) => e.cat_agentreviewsid),
            statuses: allEntities.map((e: AgentReviewRecord) => e.cat_reviewstatus),
            sampleEntities: allEntities.slice(0, 3).map(r => ({
                id: r.cat_agentreviewsid,
                botName: r.cat_botname,
                componentId: r.cat_componentidunique,
                score: r.cat_overallscore,
                status: r.cat_reviewstatus
            }))
        });
        
        // Transform to expected response format
        const response: AgentReviewsResponse = {
            '@odata.context': '',
            value: allEntities
        };
        
        console.log('[retrieveAgentReviews] Final response prepared:', {
            totalRecords: response.value.length,
            pagesFetched: pageCount
        });
        
        return response;
    } catch (error) {
        console.error('[retrieveAgentReviews] API Error:', error);
        console.log('[retrieveAgentReviews] Error details:', {
            name: (error as Error)?.name,
            message: (error as Error)?.message,
            status: (error as {status?: number})?.status,
            statusText: (error as {statusText?: string})?.statusText,
            entityName: 'cat_agentreviews',
            query: query
        });
        
        // Return empty response instead of throwing to prevent app crash
        // This allows the app to continue working even if the table doesn't exist
        const emptyResponse: AgentReviewsResponse = {
            '@odata.context': '',
            value: []
        };
        
        console.log('[retrieveAgentReviews] Returning empty response due to error');
        return emptyResponse;
    }
}

/**
 * Creates a map of componentIdUnique -> latest review record for quick lookup
 * @param reviews - Array of review records
 * @returns Map with componentIdUnique as key and review record as value
 */
export function createReviewMap(reviews: AgentReviewRecord[]): Map<string, AgentReviewRecord> {
    const reviewMap = new Map<string, AgentReviewRecord>();
    
    // Group by componentIdUnique and keep only the most recent (already sorted by date desc)
    reviews.forEach(review => {
        if (review.cat_componentidunique && !reviewMap.has(review.cat_componentidunique)) {
            reviewMap.set(review.cat_componentidunique, review);
        }
    });
    return reviewMap;
}
