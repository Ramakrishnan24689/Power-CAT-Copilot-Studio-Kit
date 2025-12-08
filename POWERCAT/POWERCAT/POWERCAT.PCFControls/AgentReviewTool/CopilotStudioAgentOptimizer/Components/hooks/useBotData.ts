import * as React from 'react';
import { BotService } from '../../Services';
import type { BotDetail, BotConfiguration } from '../../types';
import { BotFields, buildQuery, OrderDirection } from '../../config';
import { useServiceContext } from '../context';

// Lazy-load sample data only when needed
const getSampleData = async () => {
    const { sampleBotDetails } = await import('../../__tests__/fixtures/sampleBotResponse');
    return { sampleBotDetails };
};

// Filter helper - check if bot has GenerativeActionsEnabled
function isGenerativeActionsEnabled(bot: BotDetail): boolean {
    try {
        if (!bot.configuration) return false;
        const config = JSON.parse(bot.configuration) as BotConfiguration;
        return config.settings?.GenerativeActionsEnabled ?? false;
    } catch {
        return false;
    }
}

interface UseBotDataOptions {
    useTestHarness: boolean;
}

/**
 * Custom hook for managing bot data loading, caching, and filtering
 * Extracted from BotsDataGrid for better separation of concerns
 */
export function useBotData({ useTestHarness }: UseBotDataOptions) {
    const { webAPI } = useServiceContext();
    const [allBots, setAllBots] = React.useState<BotDetail[]>([]);
    const [filteredBots, setFilteredBots] = React.useState<BotDetail[]>([]);
    const [searchValue, setSearchValue] = React.useState<string>('');
    const [isSearching, setIsSearching] = React.useState<boolean>(false);
    const searchTimeoutRef = React.useRef<number | null>(null);

    // Load all bots from API/cache (called once on mount or refresh)
    const loadAllBots = React.useCallback(async (forceRefresh = false) => {
        const cacheKey = 'agentOptimizer_allBots';
        
        if (useTestHarness) {
            // In test harness mode, load sample data
            const { sampleBotDetails } = await getSampleData();
            const filtered = sampleBotDetails.value.filter(isGenerativeActionsEnabled);
            setAllBots(filtered);
            setFilteredBots(filtered);
            setIsSearching(false);
            return;
        }

        setIsSearching(true);
        try {
            let generativeBots: BotDetail[];
            
            // Check localStorage cache if not forcing refresh
            if (!forceRefresh) {
                try {
                    const cached = localStorage.getItem(cacheKey);
                    if (cached) {
                        generativeBots = JSON.parse(cached) as BotDetail[];
                        console.log('[useBotData] ✓ Using cached bot data:', {
                            count: generativeBots.length,
                            cacheKey,
                            botNames: generativeBots.map(b => b.name),
                            source: 'localStorage'
                        });
                        setAllBots(generativeBots);
                        setFilteredBots(generativeBots);
                        setIsSearching(false);
                        return;
                    }
                } catch (error) {
                    console.warn('[useBotData] localStorage cache unavailable, proceeding with API call:', error);
                }
            } else {
                console.log('[useBotData] Force refresh requested - clearing cache');
                try {
                    localStorage.removeItem(cacheKey);
                } catch (error) {
                    console.warn('[useBotData] Failed to clear localStorage cache:', error);
                }
            }
            
            // Build OData query - fetch all bots
            const selectFields = [
                BotFields.Name,
                BotFields.Id,
                BotFields.StateCode,
                BotFields.IconBase64,
                BotFields.ComponentIdUnique,
                BotFields.Configuration,
            ];
            const filter = buildQuery({
                select: selectFields,
                orderBy: { field: BotFields.Name, direction: OrderDirection.Ascending },
            });
            console.log('[useBotData] Calling BotService.getAllBots with filter:', filter);

            // Call Dataverse API via service
            const botService = new BotService(webAPI);
            const response = await botService.getAllBots(filter);
            console.log('[useBotData] ✓ Retrieved bots from Dataverse:', {
                totalCount: response.value.length,
                source: 'Dataverse API',
                bots: response.value.map(b => ({ 
                    name: b.name, 
                    botid: b.botid,
                    hasConfig: !!b.configuration 
                }))
            });

            // Filter to only show bots with GenerativeActionsEnabled = true
            generativeBots = response.value.filter(isGenerativeActionsEnabled);
            console.log('[useBotData] ✓ Filtered to generative-enabled bots:', {
                originalCount: response.value.length,
                generativeCount: generativeBots.length,
                filteredOut: response.value.length - generativeBots.length,
                generativeBots: generativeBots.map(b => ({ name: b.name, botid: b.botid }))
            });

            setAllBots(generativeBots);
            setFilteredBots(generativeBots);
            
            // Cache the results
            try {
                localStorage.setItem(cacheKey, JSON.stringify(generativeBots));
                console.log('[useBotData] ✓ Cached bot data to localStorage:', {
                    count: generativeBots.length,
                    cacheKey,
                    timestamp: new Date().toISOString()
                });
            } catch (error) {
                console.warn('[useBotData] Failed to cache data to localStorage:', error);
            }
        } catch (error) {
            console.error('[useBotData] Load bots failed:', error);
            setAllBots([]);
            setFilteredBots([]);
        } finally {
            setIsSearching(false);
        }
    }, [useTestHarness, webAPI]);
    
    // Filter bots based on search query (client-side filtering)
    const filterBots = React.useCallback((query: string) => {
        if (!query.trim()) {
            // No search query - show all bots
            setFilteredBots(allBots);
            console.log('[useBotData] Filtered bots (no query):', { query: '', count: allBots.length });
        } else {
            // Filter by name (case-insensitive)
            const filtered = allBots.filter(bot =>
                bot.name.toLowerCase().includes(query.toLowerCase())
            );
            setFilteredBots(filtered);
            console.log('[useBotData] Filtered bots:', { query, count: filtered.length });
        }
    }, [allBots]);

    // Handle search input change with debounce (300ms)
    const handleSearchChange = React.useCallback((_ev: unknown, data: { value: string }) => {
        const newValue = data.value;
        setSearchValue(newValue);

        // Clear existing timeout
        if (searchTimeoutRef.current) {
            window.clearTimeout(searchTimeoutRef.current);
        }

        // Set new timeout for debounced search (client-side filtering)
        searchTimeoutRef.current = window.setTimeout(() => {
            filterBots(newValue);
        }, 300);
    }, [filterBots]);

    // Handle refresh - clear cache and reload
    const handleRefresh = React.useCallback(() => {
        console.log('[useBotData] 🔄 Refresh initiated - clearing cache and reloading');
        try {
            localStorage.removeItem('agentOptimizer_allBots');
            console.log('[useBotData] ✓ Cleared bot cache from localStorage');
        } catch (error) {
            console.warn('[useBotData] Failed to clear localStorage cache:', error);
        }
        setSearchValue(''); // Clear search
        loadAllBots(true).catch(err => console.error('[useBotData] ❌ Refresh error:', err));
    }, [loadAllBots]);

    // Initial load - test harness specific effect
    React.useEffect(() => {
        if (useTestHarness) {
            void (async () => {
                const { sampleBotDetails } = await getSampleData();
                const filtered = sampleBotDetails.value.filter(isGenerativeActionsEnabled);
                setAllBots(filtered);
                setFilteredBots(filtered);
            })();
        }
    }, [useTestHarness]);

    // Cleanup timeout on unmount
    React.useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                window.clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    return {
        allBots,
        filteredBots,
        searchValue,
        isSearching,
        loadAllBots,
        handleSearchChange,
        handleRefresh,
    };
}
