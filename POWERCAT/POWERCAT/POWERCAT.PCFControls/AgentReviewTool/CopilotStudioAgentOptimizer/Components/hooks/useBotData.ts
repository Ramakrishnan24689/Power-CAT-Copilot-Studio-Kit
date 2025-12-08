import * as React from 'react';
import { BotService } from '../../Services';
import type { BotDetail, BotConfiguration } from '../../types';
import { BotFields, buildQuery, OrderDirection } from '../../config';
import { useServiceContext } from '../context';

// Mock data for development/fallback scenarios
const getMockData = () => {
    return {
        sampleBotDetails: {
            '@odata.context': 'https://sample.crm.dynamics.com/api/data/v9.1/$metadata#bots',
            value: [
                {
                    '@odata.etag': 'W/"123456789"',
                    overriddencreatedon: null,
                    modifiedon: '2024-12-01T14:30:00Z',
                    supportedlanguages: null,
                    solutionid: 'fd140aaf-4df4-11dd-bd17-0019b9312238',
                    importsequencenumber: null,
                    _owningteam_value: null,
                    ismanaged: false,
                    _ownerid_value: 'user1-guid',
                    _modifiedby_value: 'user1-guid',
                    applicationmanifestinformation: null,
                    authenticationtrigger: 0,
                    _publishedby_value: null,
                    componentstate: 0,
                    utcconversiontimezonecode: null,
                    iconbase64: null,
                    configuration: JSON.stringify({
                        $kind: 'Microsoft.Composer.WebChat.TurnContext',
                        settings: {
                            GenerativeActionsEnabled: true
                        },
                        gPTSettings: {
                            $kind: 'Microsoft.Composer.WebChat.GPTSettings',
                            defaultSchemaName: 'conversation'
                        },
                        aISettings: {
                            $kind: 'Microsoft.Composer.WebChat.AISettings',
                            useModelKnowledge: true,
                            isSemanticSearchEnabled: true,
                            optInUseLatestModels: true
                        },
                        recognizer: {
                            $kind: 'Microsoft.Composer.WebChat.Recognizer'
                        }
                    }),
                    language: 1033,
                    publishedon: '2024-11-15T10:00:00Z',
                    synchronizationstatus: JSON.stringify({
                        $kind: 'Microsoft.Composer.WebChat.SynchronizationStatus',
                        contentVersion: 1,
                        lastFinishedPublishOperation: {
                            $kind: 'Microsoft.Composer.WebChat.PublishOperation',
                            operationStart: '2024-11-15T09:55:00Z',
                            operationEnd: '2024-11-15T10:00:00Z',
                            status: 'Completed'
                        },
                        lastPublishedDetails: {
                            $kind: 'Microsoft.Composer.WebChat.PublishedDetails',
                            authenticationMode: 'None'
                        },
                        currentSynchronizationState: {
                            $kind: 'Microsoft.Composer.WebChat.SynchronizationState',
                            botRegistration: {
                                $kind: 'Microsoft.Composer.WebChat.BotRegistration',
                                botRegistrationIdConsumptionTime: '2024-11-15T10:00:00Z',
                                applicationId: 'app-guid-1',
                                isAppAvailableInTenant: true
                            },
                            provisioningStatus: 'Completed'
                        }
                    }),
                    statecode: 0,
                    botid: 'bot-001',
                    overwritetime: '2024-11-15T10:00:00Z',
                    _createdonbehalfby_value: null,
                    _modifiedonbehalfby_value: null,
                    versionnumber: 123456,
                    origin: null,
                    _owningbusinessunit_value: 'bu-guid',
                    authenticationconfiguration: null,
                    statuscode: 1,
                    schemaname: 'CustomerSupportAgent',
                    authenticationmode: 0,
                    createdon: '2024-11-15T10:00:00Z',
                    timezoneruleversionnumber: 4,
                    name: 'Customer Support Agent',
                    runtimeprovider: 0,
                    _providerconnectionreferenceid_value: null,
                    accesscontrolpolicy: 0,
                    template: 'PowerVirtualAgents',
                    _createdby_value: 'user1-guid',
                    authorizedsecuritygroupids: null,
                    componentidunique: 'component-guid-1',
                    _owninguser_value: 'user1-guid',
                    iscustomizable: {
                        Value: true,
                        CanBeChanged: true,
                        ManagedPropertyLogicalName: 'iscustomizable'
                    }
                },
                {
                    '@odata.etag': 'W/"123456790"',
                    overriddencreatedon: null,
                    modifiedon: '2024-11-28T16:45:00Z',
                    supportedlanguages: null,
                    solutionid: 'fd140aaf-4df4-11dd-bd17-0019b9312238',
                    importsequencenumber: null,
                    _owningteam_value: null,
                    ismanaged: false,
                    _ownerid_value: 'user2-guid',
                    _modifiedby_value: 'user2-guid',
                    applicationmanifestinformation: null,
                    authenticationtrigger: 0,
                    _publishedby_value: null,
                    componentstate: 0,
                    utcconversiontimezonecode: null,
                    iconbase64: null,
                    configuration: JSON.stringify({
                        $kind: 'Microsoft.Composer.WebChat.TurnContext',
                        settings: {
                            GenerativeActionsEnabled: true
                        },
                        gPTSettings: {
                            $kind: 'Microsoft.Composer.WebChat.GPTSettings',
                            defaultSchemaName: 'conversation'
                        },
                        aISettings: {
                            $kind: 'Microsoft.Composer.WebChat.AISettings',
                            useModelKnowledge: false,
                            isSemanticSearchEnabled: true,
                            optInUseLatestModels: false
                        },
                        recognizer: {
                            $kind: 'Microsoft.Composer.WebChat.Recognizer'
                        }
                    }),
                    language: 1033,
                    publishedon: '2024-11-20T09:15:00Z',
                    synchronizationstatus: JSON.stringify({
                        $kind: 'Microsoft.Composer.WebChat.SynchronizationStatus',
                        contentVersion: 1,
                        lastFinishedPublishOperation: {
                            $kind: 'Microsoft.Composer.WebChat.PublishOperation',
                            operationStart: '2024-11-20T09:10:00Z',
                            operationEnd: '2024-11-20T09:15:00Z',
                            status: 'Completed'
                        },
                        lastPublishedDetails: {
                            $kind: 'Microsoft.Composer.WebChat.PublishedDetails',
                            authenticationMode: 'None'
                        },
                        currentSynchronizationState: {
                            $kind: 'Microsoft.Composer.WebChat.SynchronizationState',
                            botRegistration: {
                                $kind: 'Microsoft.Composer.WebChat.BotRegistration',
                                botRegistrationIdConsumptionTime: '2024-11-20T09:15:00Z',
                                applicationId: 'app-guid-2',
                                isAppAvailableInTenant: true
                            },
                            provisioningStatus: 'Completed'
                        }
                    }),
                    statecode: 0,
                    botid: 'bot-002',
                    overwritetime: '2024-11-20T09:15:00Z',
                    _createdonbehalfby_value: null,
                    _modifiedonbehalfby_value: null,
                    versionnumber: 123457,
                    origin: null,
                    _owningbusinessunit_value: 'bu-guid',
                    authenticationconfiguration: null,
                    statuscode: 1,
                    schemaname: 'SalesAssistant',
                    authenticationmode: 0,
                    createdon: '2024-11-20T09:15:00Z',
                    timezoneruleversionnumber: 4,
                    name: 'Sales Assistant Bot',
                    runtimeprovider: 0,
                    _providerconnectionreferenceid_value: null,
                    accesscontrolpolicy: 0,
                    template: 'PowerVirtualAgents',
                    _createdby_value: 'user2-guid',
                    authorizedsecuritygroupids: null,
                    componentidunique: 'component-guid-2',
                    _owninguser_value: 'user2-guid',
                    iscustomizable: {
                        Value: true,
                        CanBeChanged: true,
                        ManagedPropertyLogicalName: 'iscustomizable'
                    }
                },
                {
                    '@odata.etag': 'W/"123456791"',
                    overriddencreatedon: null,
                    modifiedon: '2024-11-25T13:10:00Z',
                    supportedlanguages: null,
                    solutionid: 'fd140aaf-4df4-11dd-bd17-0019b9312238',
                    importsequencenumber: null,
                    _owningteam_value: null,
                    ismanaged: false,
                    _ownerid_value: 'user3-guid',
                    _modifiedby_value: 'user3-guid',
                    applicationmanifestinformation: null,
                    authenticationtrigger: 0,
                    _publishedby_value: null,
                    componentstate: 0,
                    utcconversiontimezonecode: null,
                    iconbase64: null,
                    configuration: JSON.stringify({
                        $kind: 'Microsoft.Composer.WebChat.TurnContext',
                        settings: {
                            GenerativeActionsEnabled: true
                        },
                        gPTSettings: {
                            $kind: 'Microsoft.Composer.WebChat.GPTSettings',
                            defaultSchemaName: 'conversation'
                        },
                        aISettings: {
                            $kind: 'Microsoft.Composer.WebChat.AISettings',
                            useModelKnowledge: true,
                            isSemanticSearchEnabled: false,
                            optInUseLatestModels: true
                        },
                        recognizer: {
                            $kind: 'Microsoft.Composer.WebChat.Recognizer'
                        }
                    }),
                    language: 1033,
                    publishedon: '2024-10-30T11:20:00Z',
                    synchronizationstatus: JSON.stringify({
                        $kind: 'Microsoft.Composer.WebChat.SynchronizationStatus',
                        contentVersion: 1,
                        lastFinishedPublishOperation: {
                            $kind: 'Microsoft.Composer.WebChat.PublishOperation',
                            operationStart: '2024-10-30T11:15:00Z',
                            operationEnd: '2024-10-30T11:20:00Z',
                            status: 'Completed'
                        },
                        lastPublishedDetails: {
                            $kind: 'Microsoft.Composer.WebChat.PublishedDetails',
                            authenticationMode: 'None'
                        },
                        currentSynchronizationState: {
                            $kind: 'Microsoft.Composer.WebChat.SynchronizationState',
                            botRegistration: {
                                $kind: 'Microsoft.Composer.WebChat.BotRegistration',
                                botRegistrationIdConsumptionTime: '2024-10-30T11:20:00Z',
                                applicationId: 'app-guid-3',
                                isAppAvailableInTenant: true
                            },
                            provisioningStatus: 'Completed'
                        }
                    }),
                    statecode: 0,
                    botid: 'bot-003',
                    overwritetime: '2024-10-30T11:20:00Z',
                    _createdonbehalfby_value: null,
                    _modifiedonbehalfby_value: null,
                    versionnumber: 123458,
                    origin: null,
                    _owningbusinessunit_value: 'bu-guid',
                    authenticationconfiguration: null,
                    statuscode: 1,
                    schemaname: 'HRVirtualAssistant',
                    authenticationmode: 0,
                    createdon: '2024-10-30T11:20:00Z',
                    timezoneruleversionnumber: 4,
                    name: 'HR Onboarding Helper',
                    runtimeprovider: 0,
                    _providerconnectionreferenceid_value: null,
                    accesscontrolpolicy: 0,
                    template: 'PowerVirtualAgents',
                    _createdby_value: 'user3-guid',
                    authorizedsecuritygroupids: null,
                    componentidunique: 'component-guid-3',
                    _owninguser_value: 'user3-guid',
                    iscustomizable: {
                        Value: true,
                        CanBeChanged: true,
                        ManagedPropertyLogicalName: 'iscustomizable'
                    }
                }
            ]
        }
    };
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
            const { sampleBotDetails } = getMockData();
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
            const { sampleBotDetails } = getMockData();
            const filtered = sampleBotDetails.value.filter(isGenerativeActionsEnabled);
            setAllBots(filtered);
            setFilteredBots(filtered);
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
