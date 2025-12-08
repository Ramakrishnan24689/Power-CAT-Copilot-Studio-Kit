import * as React from 'react';
import {
    DataGrid,
    DataGridBody,
    DataGridRow,
    DataGridHeader,
    DataGridHeaderCell,
    DataGridCell,
    TableCellLayout,
    TableColumnDefinition,
    TableColumnSizingOptions,
    createTableColumn,
} from '@fluentui/react-table';
import { Button } from '@fluentui/react-button';
import { Card, CardHeader, Text } from '@fluentui/react-components';
import { Spinner } from '@fluentui/react-spinner';
import { SearchBox } from '@fluentui/react-search';
import { Tooltip } from '@fluentui/react-tooltip';
import { MessageBar, MessageBarBody, MessageBarTitle, MessageBarActions, MessageBarIntent, SplitButton, Menu, MenuTrigger, MenuPopover, MenuList, MenuItem, Badge, tokens, ProgressBar, Dialog, DialogTrigger, DialogSurface, DialogTitle, DialogBody } from '@fluentui/react-components';
import { makeStyles, Dropdown, Option } from '@fluentui/react-components';
import { BotSparkle24Regular, Dismiss24Regular, Lightbulb32Regular, Eye20Regular, BookRegular, DocumentRegular, DismissRegular, ChevronLeftRegular, ChevronRightRegular, DataUsageRegular, BrainCircuitRegular, DocumentCheckmarkRegular, CloudSyncRegular, CheckmarkCircleRegular, SparkleRegular } from '@fluentui/react-icons';
import { downloadSarifReport } from '../../../Services/generateSarifReport';
import { generatePdfReport, type PdfReportInput } from '../../../Services/generatePdfReport';
import { retrievePromptResponse, RetrievePromptResponseOutput } from '../../../Services/retrievePromptResponse';
import { BotService, ReviewService } from '../../../Services';
import { extractStageADataLocally, analyzeLocalPatterns } from '../../../Services/extractStageAData';
import { checkExcessTools } from '../../../Services/utils/stageBFilter';
import type { BotDetail, AgentReviewRecord } from '../../../types';
import { ReviewDialogContainer } from '../Review/ReviewDialogContainer';
import { DashboardStatsContainer } from '../Dashboard/DashboardStatsContainer';
import { ActionToolbar } from '../../shared/Toolbar';
import { WelcomeTourContainer } from '../Tour/WelcomeTourContainer';
import { ReviewStatus } from '../../../config';
import { useFirstTimeExperience, usePagination, useBotData, useExistingReviews } from '../../hooks';
import { useServiceContext } from '../../context';
import type { ReviewResult, PatternEvaluation, InstructionEvaluation, ComplianceIssue, BotConfiguration, Pattern } from '../../../types';
import { calculateOverallScore, getPatternSeverity } from '../../utils/scoreCalculator';

// Lazy-load sample data only when needed (tree-shaking optimization)
const getSampleData = async () => {
    const { sampleBotDetails } = await import('../../../__tests__/fixtures/sampleBotResponse');
    const { sampleStageAResponse } = await import('../../../__tests__/fixtures/sampleStageAResponse');
    const { sampleStageBResponse } = await import('../../../__tests__/fixtures/sampleStageBResponse');
    const { sampleAgentInstructionEvalResponse } = await import('../../../__tests__/fixtures/sampleAgentInstructionEval');
    const { sampleAgentReviews } = await import('../../../__tests__/fixtures/sampleAgentReviews');
    return { sampleBotDetails, sampleStageAResponse, sampleStageBResponse, sampleAgentInstructionEvalResponse, sampleAgentReviews };
};

export interface BotsDataGridProps {
    stageAModelId: string;
    stageBModelId: string;
    stageCModelId: string;
    stageDModelId: string;
    baseUrl: string;
    useTestHarness: boolean;
    onError?: (message: string | null) => void;
}

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        width: '100%',
        maxWidth: '100%',
        overflow: 'visible',
    },
    toolbarRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
    },
    searchBox: {
        minWidth: '300px',
        maxWidth: '400px',
    },
    dataGridWrapper: {
        border: '1px solid #E0E0E0',
        borderRadius: '8px',
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12), 0 0 1px rgba(0, 0, 0, 0.04)',
    },
    dataGridHeader: {
        minHeight: '52px',
        fontWeight: 'bold',
    },
    dataGridRow: {
        minHeight: '60px',
    },
    footer: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: '16px',
        paddingTop: '8px',
        paddingBottom: '16px',
        paddingLeft: '4px',
        paddingRight: '4px',
        marginTop: '0px',
        overflow: 'visible',
    },
    resourceCard: {
        cursor: 'pointer',
    },
    resourceCardHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
    },
    resourceIcon: {
        fontSize: '24px',
        color: '#077FAB',
    },
    resourceText: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    resourceTitle: {
        fontWeight: '600',
        fontSize: '14px',
    },
    resourceDescription: {
        fontSize: '12px',
        color: '#605E5C',
    },
});

/**
 * Column definitions for the data grid
 */
const getColumns = (existingReviews: Map<string, AgentReviewRecord>): TableColumnDefinition<BotDetail>[] => [
    createTableColumn<BotDetail>({
        columnId: 'name',
        compare: (a, b) => a.name.localeCompare(b.name),
        renderHeaderCell: () => <div style={{ paddingLeft: '16px', fontWeight: '600' }}>Name</div>,
        renderCell: (bot) => {
            const iconSrc = bot.iconbase64
                ? `data:image/png;base64,${bot.iconbase64}`
                : undefined;

            return (
                <TableCellLayout
                    style={{ paddingLeft: '16px' }}
                    media={iconSrc ? (
                        <img
                            src={iconSrc}
                            alt={`${bot.name} icon`}
                            style={{
                                width: '32px',
                                height: '32px',
                                objectFit: 'contain',
                                borderRadius: '4px'
                            }}
                        />
                    ) : undefined}
                >
                    {bot.name}
                </TableCellLayout>
            );
        },
    }),
    createTableColumn<BotDetail>({
        columnId: 'score',
        compare: (a, b) => {
            const scoreA = existingReviews.get(a.componentidunique)?.cat_overallscore ?? -1;
            const scoreB = existingReviews.get(b.componentidunique)?.cat_overallscore ?? -1;
            return scoreA - scoreB;
        },
        renderHeaderCell: () => <div style={{ fontWeight: '600' }}>Score</div>,
        renderCell: (bot) => {
            const review = existingReviews.get(bot.componentidunique);
            const score = review?.cat_overallscore;
            
            if (score === undefined || score === null) {
                return (
                    <TableCellLayout>
                        <Text style={{ color: '#605E5C' }}>--</Text>
                    </TableCellLayout>
                );
            }
            
            // Color code the score
            const scoreColor = score >= 80 ? '#107C10' : score >= 60 ? '#D83B01' : '#A80000';
            
            return (
                <TableCellLayout>
                    <Text style={{ fontWeight: 600, color: scoreColor }}>{score}%</Text>
                </TableCellLayout>
            );
        },
    }),
    createTableColumn<BotDetail>({
        columnId: 'issues',
        compare: (a, b) => {
            const issuesA = existingReviews.get(a.componentidunique)?.cat_totalissues ?? -1;
            const issuesB = existingReviews.get(b.componentidunique)?.cat_totalissues ?? -1;
            return issuesA - issuesB;
        },
        renderHeaderCell: () => <div style={{ fontWeight: '600' }}>Issues</div>,
        renderCell: (bot) => {
            const review = existingReviews.get(bot.componentidunique);
            const totalIssues = review?.cat_totalissues;
            const highSeverity = review?.cat_highseverityissues ?? 0;
            
            if (totalIssues === undefined || totalIssues === null) {
                return (
                    <TableCellLayout>
                        <Text style={{ color: '#605E5C' }}>--</Text>
                    </TableCellLayout>
                );
            }
            
            return (
                <TableCellLayout>
                    <Text>
                        {totalIssues}
                        {highSeverity > 0 && (
                            <Text style={{ color: '#A80000', fontWeight: 600, marginLeft: '4px' }}>
                                ({highSeverity} high)
                            </Text>
                        )}
                    </Text>
                </TableCellLayout>
            );
        },
    }),
];

/**
 * Parse bot configuration and check if GenerativeActionsEnabled is true
 */
const isGenerativeActionsEnabled = (bot: BotDetail): boolean => {
    try {
        if (!bot.configuration) return false;
        const config = JSON.parse(bot.configuration) as BotConfiguration;
        return config.settings?.GenerativeActionsEnabled ?? false;
    } catch {
        // If parsing fails, exclude the bot
        return false;
    }
};

export const BotGridContainer: React.FC<BotsDataGridProps> = ({ stageAModelId, stageBModelId, stageCModelId, stageDModelId, baseUrl, useTestHarness, onError }) => {
    const styles = useStyles();
    const { webAPI, userId, pcfContext } = useServiceContext();
    
    // Helper function to get contextual icons for progress title (5 icons only)
    const getTitleIcon = React.useCallback((description: string) => {
        const iconStyle = { fontSize: '24px', color: '#0078d4' };
        
        if (description.includes('Extracting') || description.includes('Analyzing bot structure')) {
            return <DataUsageRegular style={iconStyle} />;
        } else if (description.includes('AI') || description.includes('evaluating') || description.includes('models')) {
            return <BrainCircuitRegular style={iconStyle} />;
        } else if (description.includes('Generating') || description.includes('report')) {
            return <DocumentCheckmarkRegular style={iconStyle} />;
        } else if (description.includes('Saving')) {
            return <CloudSyncRegular style={iconStyle} />;
        } else if (description.includes('completed')) {
            return <CheckmarkCircleRegular style={iconStyle} />;
        } else {
            return <SparkleRegular style={iconStyle} />; // Default sparkle icon
        }
    }, []);
    
    // Custom hooks for separated concerns
    const { allBots, filteredBots, searchValue, isSearching, loadAllBots, handleSearchChange, handleRefresh } = useBotData({ useTestHarness });
    const { currentPage, pageSize, totalPages, paginatedItems: items, handlePageSizeChange, handlePreviousPage, handleNextPage, setCurrentPage } = usePagination(filteredBots);
    const { existingReviews, isLoadingReviews, reviewedCount, averageScore, totalIssues, loadExistingReviews, updateReviewInCache } = useExistingReviews({ useTestHarness });
    
    
    // Review state (kept in main component for now - complex orchestration)
    const [reviewingBotId, setReviewingBotId] = React.useState<string | null>(null);
    const [reviewProgress, setReviewProgress] = React.useState<{
        description: string;
        progress: number;
        botName?: string;
    } | null>(null);
    const [progressAnimationRef, setProgressAnimationRef] = React.useState<NodeJS.Timeout | null>(null);

    // Review dialog state
    const [reviewDialogOpen, setReviewDialogOpen] = React.useState(false);
    const [currentReviewResult, setCurrentReviewResult] = React.useState<ReviewResult | null>(null);
    const [currentBotComponentId, setCurrentBotComponentId] = React.useState<string>('');
    const [isSavingReview, setIsSavingReview] = React.useState(false);

    // First-Time Run Experience
    const { shouldShowTour, currentStep, nextStep, previousStep, completeTour } = useFirstTimeExperience();
    const quickStatsRef = React.useRef<HTMLDivElement>(null);
    const reviewButtonRef = React.useRef<HTMLButtonElement>(null);
    const viewButtonRef = React.useRef<HTMLButtonElement>(null);

    // Toolbar action handlers
    const handleExportAll = React.useCallback(() => {
        // TODO: Implement export all functionality
        // This will query all review history from Dataverse and generate CSV/JSON
        alert('Export All functionality coming soon!');
    }, []);

    const handleHelp = React.useCallback(() => {
        window.open('#', '_blank'); // Replace with actual help URL
    }, []);

    const handleSettings = React.useCallback(() => {
        // TODO: Implement settings dialog
        alert('Settings functionality coming soon!');
    }, []);

    // Mount guard to prevent triple mounting (React StrictMode in dev)
    const hasMounted = React.useRef(false);

    // Initial load - force fresh data on first load, then use cache
    React.useEffect(() => {
        if (hasMounted.current) {
            return;
        }
        hasMounted.current = true;
        
        loadAllBots(true).catch(err => console.error('[BotsDataGrid] Initial load error:', err));
        loadExistingReviews().catch(err => console.error('[BotsDataGrid] Load reviews error:', err));
        // Note: totalBotCount removed - using allBots.length instead
    }, [loadAllBots, loadExistingReviews]);

    // Helper function to smoothly animate progress with user-friendly descriptions
    const updateProgress = React.useCallback((description: string, targetProgress: number, botName?: string) => {
        // Clear any existing animation
        if (progressAnimationRef) {
            clearInterval(progressAnimationRef);
        }

        const currentProgress = reviewProgress?.progress ?? 0;
        const progressDiff = targetProgress - currentProgress;
        const duration = 800; // Animation duration in ms
        const steps = 20; // Number of animation steps
        const increment = progressDiff / steps;
        const stepDuration = duration / steps;
        
        let step = 0;
        
        // For first call (when reviewProgress is null), start directly at target to avoid reset appearance
        if (reviewProgress === null) {
            setReviewProgress({ description, progress: targetProgress, botName });
            return;
        }
        
        // Immediately update description
        setReviewProgress({ description, progress: currentProgress, botName });
        
        // Animate progress if there's a difference
        if (Math.abs(progressDiff) > 0) {
            const animation = setInterval(() => {
                step++;
                const newProgress = Math.round(currentProgress + (increment * step));
                
                setReviewProgress({ description, progress: newProgress, botName });
                
                if (step >= steps || Math.abs(newProgress - targetProgress) <= 1) {
                    clearInterval(animation);
                    setReviewProgress({ description, progress: targetProgress, botName });
                    setProgressAnimationRef(null);
                }
            }, stepDuration);
            
            setProgressAnimationRef(animation);
        }
    }, [reviewProgress?.progress, progressAnimationRef]);

    // Cleanup animation on unmount
    React.useEffect(() => {
        return () => {
            if (progressAnimationRef) {
                clearInterval(progressAnimationRef);
            }
        };
    }, [progressAnimationRef]);

    // Three-stage review: Stage A (BotId) -> Stage B & C (parallel)
    const handleReview = async (bot: BotDetail) => {
        setReviewingBotId(bot.botid);
        updateProgress("Starting comprehensive agent analysis...", 5, bot.name);

        try {
            let stageAResult: RetrievePromptResponseOutput;
            let stageCResult: RetrievePromptResponseOutput;
            let toolCount = 0; // Tool count for excess tools check
            let agentInstructions = ''; // Agent instructions extracted from Stage A

            // Stage A: Component Analysis
            updateProgress("Analyzing agent configuration and components...", 15, bot.name);
            if (useTestHarness) {
                // Use sample data for testing - now includes local parsing test
                const { sampleBotComponents } = await import('../../../__tests__/fixtures/sampleBotComponents');
                
                // Create a mock webAPI that returns sample components in proper Dataverse response structure
                const mockWebAPI = {
                    retrieveMultipleRecords: (_entityName: string, _options?: string) => {
                        return Promise.resolve({
                            entities: sampleBotComponents.value,
                            nextLink: ''
                        } as ComponentFramework.WebApi.RetrieveMultipleResponse);
                    }
                } as unknown as ComponentFramework.WebApi;
                
                // Test local parsing with sample data
                const localData = await extractStageADataLocally(mockWebAPI, bot.botid, bot.name);
                
                // Wrap in Stage A response structure
                stageAResult = {
                    responsev2: {
                        predictionOutput: {
                            text: JSON.stringify(localData),
                            structuredOutput: {
                                AgentInstructions: localData.AgentInstructions ?? ''
                            }
                        }
                    }
                };

                // Using sample Stage C response (skipping Stage B for deterministic patterns)
                
                // Extract agent instructions from Stage A result for Stage C
                const stageAText = stageAResult.responsev2?.predictionOutput?.text;
                if (stageAText) {
                    try {
                        const parsedStageA = JSON.parse(stageAText);
                        agentInstructions = parsedStageA.AgentInstructions ?? 'Sample Agent Instructions: You are a helpful AI agent for testing purposes.';
                    } catch (parseError) {
                        console.error('[TEST HARNESS] Failed to parse Stage A for AgentInstructions:', parseError);
                        agentInstructions = 'Sample Agent Instructions: You are a helpful AI agent for testing purposes.';
                    }
                } else {
                    agentInstructions = 'Sample Agent Instructions: You are a helpful AI agent for testing purposes.';
                }
            } else {
                // Always try Local Stage A first (no threshold)
                let componentCount = 0;

                // Count components for logging purposes only
                try {
                    const botService = new BotService(webAPI);
                    componentCount = await botService.getBotComponentCount(bot.botid);
                } catch (countError) {
                    console.warn('[Component Count] Failed to count components, will still attempt local parsing:', countError);
                }

                // Always try Local Stage A first (default approach)
                updateProgress("Extracting topics and conversation flows...", 25, bot.name);
                
                try {
                    const localData = await extractStageADataLocally(webAPI, bot.botid, bot.name);
                    
                    updateProgress("Evaluating agent patterns and best practices...", 35, bot.name);
                    
                    // Wrap in same structure as AI Stage A response
                    stageAResult = {
                        responsev2: {
                            predictionOutput: {
                                text: JSON.stringify(localData)
                            }
                        }
                    };
                } catch (localParseError) {
                    // Fallback to AI Stage A if local parsing fails
                    console.warn('[Stage A] ⚠️ Local parsing failed, falling back to AI Stage A:', localParseError);
                    
                    // Check if it's a field name issue
                    if (localParseError instanceof Error && localParseError.message.includes('_parentbotid_value')) {
                        console.error('[Stage A] ❌ Field name issue detected - botcomponent entity may have different parent field name');
                    }
                    
                    // Perform AI Stage A as fallback
                    updateProgress("Using advanced AI analysis for complex components...", 45, bot.name);
                    stageAResult = await retrievePromptResponse({
                        baseUrl,
                        modelId: stageAModelId,
                        requestInputs: { BotId: bot.componentidunique }
                    });
                }

                if (stageAResult.error) {
                    const errorMsg = `Stage A failed: ${stageAResult.error.message ?? 'Unknown error'}`;
                    console.error(errorMsg, stageAResult.error);
                    onError?.(errorMsg);
                    return;
                }

                // Stage B & C: Pattern and Compliance Evaluation
                updateProgress("Preparing AI-powered quality assessment...", 50, bot.name);

                // Extract both text and structuredOutput from Stage A
                const stageAText = stageAResult.responsev2?.predictionOutput?.text;
                const stageAStructured = stageAResult.responsev2?.predictionOutput?.structuredOutput as { AgentInstructions?: string } | undefined;

                if (!stageAText) {
                    const errorMsg = 'Stage A returned no text output';
                    console.error(errorMsg);
                    onError?.(errorMsg);
                    return;
                }

                // Extract AgentInstructions from the response (use outer scope variable)
                // IMPORTANT: Don't use 'let' here - it would shadow the outer scope variable!
                
                // Try to parse as local format first, then fallback to AI format
                try {
                    const parsedStageA = JSON.parse(stageAText);
                    if (parsedStageA.AgentInstructions !== undefined) {
                        // Local parsing format
                        agentInstructions = parsedStageA.AgentInstructions ?? '';
                    } else {
                        // AI parsing format - check structured output
                        agentInstructions = stageAStructured?.AgentInstructions ?? '';
                    }
                } catch (parseError) {
                    console.error('[Stage A] ⚠️ Failed to parse Stage A output for AgentInstructions:', parseError);
                    // Fallback to structured output
                    agentInstructions = stageAStructured?.AgentInstructions ?? '';
                }
                
                // Validate agent instructions were extracted
                if (!agentInstructions || agentInstructions.trim() === '') {
                    console.warn('[Stage A] ⚠️ WARNING: No agent instructions found in Stage A output!');
                    console.warn('[Stage A] Stage C evaluation may be incomplete without instructions.');
                }

                // Extract tool count for deterministic analysis (no Stage B filtering needed)
                const stageBData = JSON.parse(stageAText);
                toolCount = stageBData?.Components?.Tools?.length ?? 0;
            }

            // Stage B & C: Pattern and Compliance Analysis (Run in Parallel)
            // Note: These are independent and can execute simultaneously for better performance
            updateProgress("Analyzing design patterns and best practices...", 55, bot.name);
            
            // Prepare Stage B & C prerequisites
            let patternEvaluation: PatternEvaluation | undefined;
            let localPatterns: Pattern[] = [];
            let shouldRunStageB = false;
            
            // Analyze local patterns from Stage A to determine if Stage B is needed
            try {
                const stageAText = stageAResult.responsev2?.predictionOutput?.text;
                if (stageAText) {
                    const stageAData = JSON.parse(stageAText) as import('../../../types').LocalStageAOutput;
                    
                    // Generate local patterns (Missing patterns, tools, test cases)
                    localPatterns = analyzeLocalPatterns(stageAData);

                    // Check if Stage B is needed - run when there are topics with values to evaluate for clarity
                    const topicsCount = stageAData.Components?.Topics?.length ?? 0;
                    const topics = stageAData.Components?.Topics ?? [];

                    console.log('🔍 [STAGE B CHECK] Topic analysis:', {
                        topicsCount,
                        topicsExist: topicsCount > 0,
                        sampleTopics: topics.slice(0, 3).map(topic => ({
                            TopicName: topic.TopicName,
                            hasModelName: Boolean(topic.ModelName && topic.ModelName.trim() !== ''),
                            hasModelDescription: Boolean(topic.ModelDescription && topic.ModelDescription.trim() !== ''),
                            hasInputVariables: Boolean(topic.InputVariables && topic.InputVariables.length > 0),
                            hasOutputVariables: Boolean(topic.OutputVariables && topic.OutputVariables.length > 0),
                        }))
                    });

                    const hasTopicsToEvaluate = topicsCount > 0 && 
                        (topics.some(topic => 
                            Boolean(topic.ModelName && topic.ModelName.trim() !== '') ||
                            Boolean(topic.ModelDescription && topic.ModelDescription.trim() !== '') ||
                            Boolean(topic.InputVariables && topic.InputVariables.length > 0) ||
                            Boolean(topic.OutputVariables && topic.OutputVariables.length > 0)
                        ) ?? false);

                    console.log('🔍 [STAGE B CHECK] Final decision:', {
                        hasTopicsToEvaluate,
                        shouldRunStageB: hasTopicsToEvaluate
                    });
                    
                    if (hasTopicsToEvaluate) {
                        shouldRunStageB = true;
                    }
                } else {
                    console.warn(`🔄 [STAGE A LOCAL] ⚠️ No Stage A text response available for local analysis`);
                }
            } catch (err) {
                console.error(`🔄 [STAGE A LOCAL] ❌ Failed to analyze local patterns:`, err);
            }
            
            // Validate agent instructions before Stage C
            if (!agentInstructions || agentInstructions.trim() === '') {
                console.warn(`🎆 [STAGE C PREP] ⚠️ WARNING: No agent instructions found!`);
                agentInstructions = '[No agent instructions found - this may indicate the agent has no custom GPT component or instructions could not be extracted]';
            }
            
            // Execute Stage B & C in parallel for faster processing
            // Progress animation: 55% → 70% during parallel execution
            let parallelProgress = 57;
            const progressInterval = setInterval(() => {
                if (parallelProgress < 69) {
                    parallelProgress += 2;
                    updateProgress(
                        shouldRunStageB 
                            ? "Evaluating patterns and instructions in parallel..." 
                            : "Evaluating agent instructions...", 
                        parallelProgress, 
                        bot.name
                    );
                }
            }, 400); // Smooth progress updates every 400ms
            
            try {
                const [stageBResult, stageCResultFromParallel] = await Promise.all([
                    // Stage B: Pattern clarity analysis (conditional)
                    shouldRunStageB && stageBModelId
                        ? (async () => {
                            console.log('🔥 [STAGE B AI] 🚀 Starting pattern analysis...');
                            const stageAText = stageAResult.responsev2?.predictionOutput?.text;
                            const result = await retrievePromptResponse({
                                baseUrl,
                                modelId: stageBModelId,
                                requestInputs: {
                                    "botcomponents": stageAText ?? '{"error": "No Stage A data"}'
                                },
                                runtime: null
                            });
                            console.log('🔥 [STAGE B AI] ✅ Pattern analysis complete - Response received');
                            console.log('🔥 [STAGE B AI] 📊 Response structure:', {
                                hasText: !!result.responsev2?.predictionOutput?.text,
                                textLength: result.responsev2?.predictionOutput?.text?.length ?? 0
                            });
                            return result;
                        })()
                        : Promise.resolve(null),
                    
                    // Stage C: Instruction compliance evaluation (always runs)
                    (async () => {
                        if (useTestHarness) {
                            console.log('🎆 [STAGE C AI] Using sample instruction evaluation response');
                            const { sampleAgentInstructionEvalResponse } = await getSampleData();
                            return {
                                responsev2: {
                                    predictionOutput: {
                                        text: JSON.stringify(sampleAgentInstructionEvalResponse)
                                    }
                                }
                            };
                        }
                        
                        console.log('🎆 [STAGE C AI] 🚀 Starting instruction evaluation...');
                        const result = await retrievePromptResponse({
                            baseUrl,
                            modelId: stageCModelId,
                            requestInputs: {
                                "Instruction_20Input": agentInstructions
                            },
                            runtime: null
                        });
                        console.log('🎆 [STAGE C AI] ✅ Instruction evaluation complete - Response received');
                        console.log('🎆 [STAGE C AI] 📊 Response structure:', {
                            hasText: !!result.responsev2?.predictionOutput?.text,
                            textLength: result.responsev2?.predictionOutput?.text?.length ?? 0
                        });
                        return result;
                    })()
                ]);
                

                
                // Stop progress animation
                clearInterval(progressInterval);
                updateProgress("Pattern and instruction analysis complete", 70, bot.name);
                
                // Assign Stage C result (from parallel execution)
                stageCResult = stageCResultFromParallel;
                
                // Handle Stage C errors
                if (stageCResult.error) {
                    const errorMsg = `Stage C failed: ${stageCResult.error.message ?? 'Unknown error'}`;
                    console.error(errorMsg, stageCResult.error);
                    onError?.(errorMsg);
                    return;
                }
                


                // Process Stage B results (merge with local patterns)
                if (stageBResult && !stageBResult.error) {
                    console.log('🔥 [STAGE B AI] Adding AI patterns to local patterns...');
                    const stageBText = stageBResult.responsev2?.predictionOutput?.text;
                    if (stageBText) {
                        try {
                            const stageBData = JSON.parse(stageBText);
                            if (stageBData.Patterns) {
                                const aiPatterns = stageBData.Patterns as Pattern[];
                                console.log(`🔥 [STAGE B AI] Adding ${aiPatterns.length} AI patterns to ${localPatterns.length} local patterns`);
                                
                                // Add AI patterns to local patterns (don't replace, supplement)
                                // Local patterns detect "Missing" fields, AI patterns detect "Unclear" content
                                const allPatterns = [...localPatterns, ...aiPatterns];
                                localPatterns = allPatterns;
                                console.log(`🔥 [STAGE B AI] ✅ Combined patterns - Total: ${localPatterns.length} (${localPatterns.length - aiPatterns.length} local + ${aiPatterns.length} AI)`);
                            } else {
                                console.warn('🔥 [STAGE B AI] ⚠️ No Patterns array found in response data');
                            }
                        } catch (parseError) {
                            console.error(`🔥 [STAGE B AI] ❌ Failed to parse AI patterns:`, parseError);
                        }
                    }
                } else if (stageBResult?.error) {
                    console.error(`🔥 [STAGE B AI] ❌ Error:`, stageBResult.error);
                } else {
                    // Stage B didn't run or failed - add fallback "Unclear" patterns (all passed)
                    console.log('🔥 [STAGE B AI] Adding fallback "Unclear" patterns (Stage B skipped)');
                    const fallbackUnclearPatterns: Pattern[] = [
                        {
                            PatternName: 'Unclear Model Name',
                            PatternDescription: 'Topics with vague or unclear model names',
                            Status: true, // Passed (no issues found since Stage B didn't run)
                            Topics: [],
                            Recommendation: 'Ensure model names are specific and describe the topic purpose clearly.'
                        },
                        {
                            PatternName: 'Unclear Model Description', 
                            PatternDescription: 'Topics with vague or unclear model descriptions',
                            Status: true,
                            Topics: [],
                            Recommendation: 'Provide clear, detailed model descriptions explaining when and how the topic should be used.'
                        },
                        {
                            PatternName: 'Unclear Input Variable Names',
                            PatternDescription: 'Input variables with vague or unclear names',
                            Status: true,
                            Topics: [],
                            Recommendation: 'Use descriptive, specific variable names that clearly indicate the expected data type and purpose.'
                        },
                        {
                            PatternName: 'Unclear Input Variable Descriptions',
                            PatternDescription: 'Input variables with vague or unclear descriptions',
                            Status: true,
                            Topics: [],
                            Recommendation: 'Provide detailed descriptions explaining the variable purpose, format, and constraints.'
                        },
                        {
                            PatternName: 'Unclear Output Variable Names',
                            PatternDescription: 'Output variables with vague or unclear names',
                            Status: true,
                            Topics: [],
                            Recommendation: 'Use clear, descriptive output variable names that indicate the data being produced.'
                        },
                        {
                            PatternName: 'Unclear Output Variable Descriptions',
                            PatternDescription: 'Output variables with vague or unclear descriptions',
                            Status: true,
                            Topics: [],
                            Recommendation: 'Describe what each output variable contains and how it should be used by downstream topics.'
                        }
                    ];
                    
                    localPatterns = [...localPatterns, ...fallbackUnclearPatterns];
                    console.log(`🔥 [STAGE B AI] ✅ Added ${fallbackUnclearPatterns.length} fallback "Unclear" patterns - Total: ${localPatterns.length}`);
                }
                
            } catch (parallelError) {
                clearInterval(progressInterval);
                console.error(`❌ Parallel Stage B/C execution failed:`, parallelError);
                onError?.(`Analysis failed: ${parallelError instanceof Error ? parallelError.message : String(parallelError)}`);
                return;
            }

            // Create final pattern evaluation using local + AI fallback patterns
            if (localPatterns.length > 0) {
                patternEvaluation = { Patterns: localPatterns };
            }

            // Note: Tool count check is already included in local patterns analysis
            // No need for separate checkExcessTools call to avoid duplication

            // Parse Stage C instruction evaluation
            const stageCText = stageCResult.responsev2?.predictionOutput?.text;
            let instructionEvaluation: InstructionEvaluation | undefined;

            if (stageCText) {
                try {
                    const parsed = JSON.parse(stageCText) as InstructionEvaluation;

                    // Normalize issues array - handle legacy format with { issue, explanation }
                    if (parsed.issues) {
                        parsed.issues = parsed.issues.map((issue: ComplianceIssue | { issue?: string; explanation?: string; recommendation?: string }, index: number) => {
                            // Check if it's legacy format
                            if ('issue' in issue && !('id' in issue)) {
                                const legacyIssue = issue as { issue?: string; explanation?: string; recommendation?: string };
                                return {
                                    id: legacyIssue.issue?.toLowerCase().replace(/\s+/g, '-') ?? `issue-${index}`,
                                    severity: 'medium' as const, // Default to medium for legacy issues
                                    description: legacyIssue.explanation ?? legacyIssue.issue ?? '',
                                    guidelineReference: 'Legacy format',
                                    recommendation: legacyIssue.recommendation ?? ''
                                };
                            }
                            return issue as ComplianceIssue;
                        });
                    }

                    instructionEvaluation = parsed;
                } catch (err) {
                    console.error(`🎆 [STAGE C AI] ❌ Failed to parse response:`, err);
                    console.error('Failed to parse Stage C response:', err);
                }
            }

            // Create initial review result
            const reviewResult: ReviewResult = {
                botId: bot.botid,
                botName: bot.name,
                patternEvaluation,
                instructionEvaluation,
                overallScore: 0, // Will be calculated below
                timestamp: new Date(),
            };

            // Calculate the overall score before saving
            if (patternEvaluation && instructionEvaluation) {
                reviewResult.overallScore = calculateOverallScore({
                    patternEvaluation,
                    instructionEvaluation
                });
            } else {
                console.warn(`[SCORE CALCULATION] Missing evaluation data - Pattern: ${!!patternEvaluation}, Instruction: ${!!instructionEvaluation}`);
            }

            // Stage D: Generate PDF report
            updateProgress("Generating comprehensive quality report...", 75, bot.name);
            try {
                updateProgress("Creating detailed PDF report...", 80, bot.name);
                // Calculate individual scores for PDF
                let patternScore = 0;
                let instructionScore = 0;
                const overallScore = reviewResult.overallScore;

                if (patternEvaluation?.Patterns) {
                    const patterns = patternEvaluation.Patterns;
                    const total = patterns.length;
                    if (total > 0) {
                        const passing = patterns.filter((p) => p.Status === true).length;
                        patternScore = Math.round((passing / total) * 100);
                    }
                }

                if (instructionEvaluation?.compliancePercentage !== undefined) {
                    instructionScore = Math.round(instructionEvaluation.compliancePercentage);
                }

                // Extract agent instructions from Stage A
                let agentInstructions: string | undefined;
                try {
                    const stageAText = stageAResult.responsev2?.predictionOutput?.text ?? '{}';
                    const stageAOutput = JSON.parse(stageAText) as { AgentInstructions?: string };
                    agentInstructions = stageAOutput.AgentInstructions;
                } catch (err) {
                    console.warn('[Stage D] Failed to extract agent instructions:', err);
                }

                // Try programmatic PDF generation first
                let pdfGeneratedProgrammatically = false;
                if (!useTestHarness) {
                    try {
                        const pdfInput: PdfReportInput = {
                            botName: bot.name,
                            reviewDate: new Date(),
                            overallScore,
                            patternScore,
                            instructionScore,
                            patterns: patternEvaluation?.Patterns ?? [],
                            instructionEval: instructionEvaluation,
                            agentInstructions
                        };

                        const pdfBase64 = await generatePdfReport(pdfInput);
                        reviewResult.pdfBase64 = pdfBase64;
                        reviewResult.pdfFileName = `${bot.name.replace(/[^a-z0-9]/gi, '_')}_Review_${new Date().toISOString().split('T')[0]}.pdf`;
                        pdfGeneratedProgrammatically = true;
                    } catch (programmaticError) {
                        console.warn('[Stage D] ⚠️ Programmatic PDF generation failed, falling back to AI model:', programmaticError);
                    }
                }

                // Fallback to AI-generated PDF if programmatic failed or test harness mode
                if (!pdfGeneratedProgrammatically) {
                    let stageDResult: RetrievePromptResponseOutput;

                    if (useTestHarness) {
                        const { stageDResponse } = await import('../../../__tests__/fixtures/stageDResponse');
                        stageDResult = {
                            responsev2: {
                                predictionOutput: {
                                    files: stageDResponse.files
                                }
                            }
                        };
                    } else {
                        // Parse Stage A output
                        const stageAText = stageAResult.responsev2?.predictionOutput?.text ?? '{}';
                        let botComponent: unknown;
                        try {
                            botComponent = JSON.parse(stageAText) as unknown;
                        } catch {
                            botComponent = { error: 'Failed to parse Stage A output' };
                        }

                        // Parse Stage C output only (Stage B removed for deterministic patterns)
                        const stageCText = stageCResult.responsev2?.predictionOutput?.text ?? '{}';

                        let stageCParsed: unknown;
                        try {
                            stageCParsed = JSON.parse(stageCText) as unknown;
                        } catch {
                            stageCParsed = { error: 'Failed to parse Stage C output' };
                        }
                        try {
                            stageCParsed = JSON.parse(stageCText) as unknown;
                        } catch {
                            stageCParsed = { error: 'Failed to parse Stage C output' };
                        }

                        // Use Code Interpreter mode for PDF generation (file output)
                        stageDResult = await retrievePromptResponse({
                            baseUrl,
                            modelId: stageDModelId,
                            requestInputs: {
                                BotComponents: JSON.stringify(botComponent),
                                AgentInstructionEvaluationResult: JSON.stringify(stageCParsed),
                                PatternScore: patternScore.toString(),
                                InstructionScore: instructionScore.toString(),
                                OverallScore: overallScore.toString()
                            },
                            runtime: 'codeinterpreter' // Use Code Interpreter for file generation
                        });

                        if (stageDResult.error) {
                            const errorMsg = `Stage D AI fallback failed: ${stageDResult.error.message ?? 'Unknown error'}`;
                            console.error(errorMsg, stageDResult.error);
                            throw new Error(errorMsg);
                        }
                    }

                    // Extract PDF from AI response
                    const pdfFile = stageDResult.responsev2?.predictionOutput?.files?.[0];

                    if (pdfFile?.base64_content && pdfFile?.file_name) {
                        reviewResult.pdfBase64 = pdfFile.base64_content;
                        reviewResult.pdfFileName = pdfFile.file_name;
                    } else {
                        console.warn('[Stage D] ⚠️ AI model did not return PDF file');
                    }
                }
            } catch (pdfError) {
                console.error('[Stage D] ❌ PDF generation failed completely:', pdfError);
                // Continue without PDF - don't fail the entire review
            }

            // Auto-save to Dataverse (update existing or create new)
            updateProgress("Saving analysis results...", 85, bot.name);
            try{
                updateProgress("Storing review data...", 90, bot.name);
                // Check if review already exists for this bot
                const existingReview = existingReviews.get(bot.componentidunique);
                const existingRecordId = existingReview?.cat_agentreviewsid;
                
                const reviewService = new ReviewService(webAPI);
                let recordId: string;
                
                if (existingRecordId) {
                    await reviewService.updateReview(existingRecordId, reviewResult, bot.componentidunique, pcfContext);
                    recordId = existingRecordId;
                } else {
                    recordId = await reviewService.saveReview(reviewResult, bot.componentidunique, pcfContext);
                }
                reviewResult.dataverseRecordId = recordId;

                // TODO: PDF upload functionality commented out - needs updateReviewWithPDF implementation
                // If PDF was generated, upload it
                // if (reviewResult.pdfBase64 && reviewResult.pdfFileName) {
                //     console.log('[BotsDataGrid] Uploading PDF to Dataverse...');
                //     await updateReviewWithPDF(webAPI, recordId, reviewResult.pdfBase64, reviewResult.pdfFileName);
                //     console.log('[BotsDataGrid] PDF uploaded successfully');
                // }

                // Efficiently update cache instead of refetching all reviews
                
                // Create AgentReviewRecord from reviewResult and bot data
                const agentReviewRecord: AgentReviewRecord = {
                    cat_agentreviewsid: recordId,
                    cat_name: `${bot.name} - ${new Date().toLocaleDateString()}`,
                    cat_botid: bot.botid,
                    cat_botname: bot.name,
                    cat_componentidunique: bot.componentidunique,
                    cat_overallscore: reviewResult.overallScore,
                    cat_patternscore: reviewResult.patternEvaluation?.Patterns?.filter(p => p.Status).length ?? 0,
                    cat_instructionscore: reviewResult.instructionEvaluation?.compliancePercentage ?? 0,
                    cat_totalpatterns: reviewResult.patternEvaluation?.Patterns?.length ?? 0,
                    cat_passedpatterns: reviewResult.patternEvaluation?.Patterns?.filter(p => p.Status).length ?? 0,
                    cat_failedpatterns: reviewResult.patternEvaluation?.Patterns?.filter(p => !p.Status).length ?? 0,
                    cat_totalissues: (reviewResult.patternEvaluation?.Patterns?.filter(p => !p.Status).length ?? 0) + 
                                   (reviewResult.instructionEvaluation?.issues?.length ?? 0),
                    cat_highseverityissues: (reviewResult.patternEvaluation?.Patterns?.filter(p => !p.Status && getPatternSeverity(p) === 'High').length ?? 0) +
                                          (reviewResult.instructionEvaluation?.issues?.filter(i => i.severity === 'high').length ?? 0),
                    cat_reviewdate: reviewResult.timestamp.toISOString(),
                    cat_reviewstatus: ReviewStatus.Completed, // Completed status
                    cat_reviewpdfreport: reviewResult.pdfBase64 ?? undefined,
                    cat_reviewpdfreport_name: reviewResult.pdfFileName ?? undefined,
                    _ownerid_value: '' // Will be set by the system
                };
                
                updateReviewInCache(agentReviewRecord, bot.componentidunique);
                
               
            } catch (saveError) {
                console.error('[BotsDataGrid] Auto-save failed:', saveError);
                reviewResult.error = `Save failed: ${saveError instanceof Error ? saveError.message : String(saveError)}`;
            }

            // Store component ID and open dialog
            updateProgress("Finalizing results...", 95, bot.name);
            setCurrentBotComponentId(bot.componentidunique);
            setCurrentReviewResult(reviewResult);
            
            // Complete with celebration
            updateProgress("Analysis completed successfully!", 100, bot.name);
            
            // Close progress dialog immediately and then open review dialog
            setTimeout(() => {
                if (progressAnimationRef) {
                    clearInterval(progressAnimationRef);
                    setProgressAnimationRef(null);
                }
                setReviewProgress(null);
                
                // Open review dialog after progress dialog is closed
                setTimeout(() => {
                    setReviewDialogOpen(true);
                }, 100);
            }, 500); // Brief pause to show completion

        } catch (error) {
            let errorMsg = 'Review failed';
            
            if (error instanceof Error) {
                // Provide more specific error messages for common issues
                if (error.message.includes('404') && error.message.includes('cat_agentreviews')) {
                    errorMsg = 'Review operation failed: The Agent Review table may not be properly configured. Please check that the table exists and is accessible.';
                } else if (error.message.includes('cat_agentreviewses')) {
                    errorMsg = 'File upload failed: The Agent Review file upload endpoint may not be properly configured. Please check that the file fields exist in the table schema.';
                } else if (error.message.includes('not found') && error.message.includes('entity')) {
                    errorMsg = 'The Agent Review Tool solution is not installed in this environment. Please install the solution first.';
                } else if (error.message.includes('file upload failed')) {
                    errorMsg = `File upload error: ${error.message}. The review data was saved but file attachments could not be uploaded.`;
                } else {
                    errorMsg = `Review failed: ${error.message}`;
                }
            } else {
                errorMsg = `Review failed: ${String(error)}`;
            }
            
            console.error('[BotGridContainer] Review error:', error);
            onError?.(errorMsg);
            
            // Clean up progress animation on error
            if (progressAnimationRef) {
                clearInterval(progressAnimationRef);
                setProgressAnimationRef(null);
            }
            setReviewProgress(null);
        } finally {
            setReviewingBotId(null);
        }
    };

    const handleViewReview = async (bot: BotDetail) => {
        // Check if review exists for this bot
        const existingReview = existingReviews.get(bot.componentidunique);

        if (!existingReview) {
            console.warn('[BotsDataGrid] No existing review found for bot:', bot.componentidunique);
            alert('No review found for this bot. Please run a review first.');
            return;
        }

        try {
            // Download review data from file column (handles large JSON > 1MB)
            const reviewService = new ReviewService(webAPI);
            const reviewData = await reviewService.downloadReviewResultFile(existingReview.cat_agentreviewsid, pcfContext);

            if (!reviewData) {
                alert('Failed to load review data. The review file may be missing.');
                return;
            }

            // Detailed logging of downloaded review data structure
            console.log('[BotsDataGrid] 📊 Downloaded review data structure:', {
                hasPatternEvaluation: !!reviewData.patternEvaluation,
                hasInstructionEvaluation: !!reviewData.instructionEvaluation,
                patternCount: reviewData.patternEvaluation?.Patterns?.length ?? 0,
                issueCount: reviewData.instructionEvaluation?.issues?.length ?? 0,
                keys: Object.keys(reviewData)
            });

            console.log('[BotsDataGrid] 📊 Full Pattern Evaluation:', reviewData.patternEvaluation);
            console.log('[BotsDataGrid] 📊 Full Instruction Evaluation:', reviewData.instructionEvaluation);

            if (!reviewData.patternEvaluation?.Patterns) {
                console.warn('[BotsDataGrid] ⚠️ No patternEvaluation.Patterns in downloaded data!');
            }

            if (!reviewData.instructionEvaluation) {
                console.warn('[BotsDataGrid] ⚠️ No instructionEvaluation in downloaded data!');
            }

            // Add PDF data if available in Dataverse
            if (existingReview.cat_reviewpdfreport && existingReview.cat_reviewpdfreport_name) {
                reviewData.pdfBase64 = existingReview.cat_reviewpdfreport;
                reviewData.pdfFileName = existingReview.cat_reviewpdfreport_name;
            }

            // Open review dialog with the saved data
            setCurrentReviewResult(reviewData);
            setCurrentBotComponentId(bot.componentidunique);
            setReviewDialogOpen(true);
        } catch (error) {
            console.error('[BotsDataGrid] Failed to load review data:', error);
            alert(`Failed to load review data: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleDownloadReport = async (bot: BotDetail) => {
        // Check if review exists for this bot
        const existingReview = existingReviews.get(bot.componentidunique);

        if (!existingReview) {
            console.warn('[BotsDataGrid] No existing review found for bot:', bot.componentidunique);
            alert('No review found for this bot. Please run a review first.');
            return;
        }

        try {
            // Download review data from file
            const reviewService = new ReviewService(webAPI);
            const reviewData = await reviewService.downloadReviewResultFile(existingReview.cat_agentreviewsid, pcfContext);
            
            if (!reviewData) {
                alert('Failed to load review data for download.');
                return;
            }
            const reportData = {
                ...reviewData,
                savedReviewId: existingReview.cat_agentreviewsid,
                savedDate: existingReview.cat_reviewdate,
            };

            const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `agent-review-${bot.name.replace(/\s+/g, '-')}-${new Date(existingReview.cat_reviewdate).toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('[BotsDataGrid] Failed to download review report:', error);
            alert(`Failed to download review report: ${error instanceof Error ? error.message : String(error)}`);
        }
    };

    const handleCloseReviewDialog = () => {
        setReviewDialogOpen(false);
        setCurrentReviewResult(null);
        setCurrentBotComponentId('');
    };

    const handleDownloadReviewReport = () => {
        if (!currentReviewResult) return;

        // Check if PDF exists (from fresh review or loaded from Dataverse)
        if (currentReviewResult.pdfBase64 && currentReviewResult.pdfFileName) {
            // Convert base64 to blob and trigger download
            try {
                const byteCharacters = atob(currentReviewResult.pdfBase64);
                const byteNumbers = new Array(byteCharacters.length);
                for (let i = 0; i < byteCharacters.length; i++) {
                    byteNumbers[i] = byteCharacters.charCodeAt(i);
                }
                const byteArray = new Uint8Array(byteNumbers);
                const blob = new Blob([byteArray], { type: 'application/pdf' });

                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = currentReviewResult.pdfFileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return;
            } catch (error) {
                console.error('[BotsDataGrid] Failed to download PDF, falling back to JSON:', error);
            }
        }

        const reportData = {
            botName: currentReviewResult.botName,
            botId: currentReviewResult.botId,
            timestamp: currentReviewResult.timestamp,
            overallScore: currentReviewResult.overallScore,
            patternEvaluation: currentReviewResult.patternEvaluation,
            instructionEvaluation: currentReviewResult.instructionEvaluation,
        };

        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `agent-review-${currentReviewResult.botName.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    // Dynamic columns with handlers in scope
    const reviewColumns: TableColumnDefinition<BotDetail>[] = [
        ...getColumns(existingReviews),
        createTableColumn<BotDetail>({
            columnId: 'review',
            renderHeaderCell: () => <div style={{ fontWeight: '600' }}>Review</div>,
            renderCell: (bot) => {
                const isReviewing = reviewingBotId === bot.botid;
                const hasExistingReview = existingReviews.has(bot.componentidunique);
                const isFirstRow = items.length > 0 && bot.botid === items[0].botid;

                return (
                    <TableCellLayout>
                        <Button
                            ref={isFirstRow ? reviewButtonRef : undefined}
                            className={isFirstRow && currentStep === 2 ? 'teaching-shimmer-button' : ''}
                            appearance="secondary"
                            icon={isReviewing ? <Spinner size="tiny" /> : <BotSparkle24Regular />}
                            onClick={() => { handleReview(bot).catch(err => console.error('[BotsDataGrid] Review error:', err)); }}
                            disabled={isReviewing || reviewingBotId !== null || !stageAModelId || !stageBModelId || !stageCModelId || isLoadingReviews}
                        >
                            {isReviewing ? 'Reviewing...' : 'Review'}
                        </Button>
                    </TableCellLayout>
                );
            },
        }),
        createTableColumn<BotDetail>({
            columnId: 'actions',
            renderHeaderCell: () => <div style={{ paddingRight: '16px', fontWeight: '600' }}>Details</div>,
            renderCell: (bot) => {
                const hasExistingReview = existingReviews.has(bot.componentidunique);
                const isFirstRow = items.length > 0 && bot.botid === items[0].botid;

                return (
                    <TableCellLayout style={{ paddingRight: '16px' }}>
                        <Tooltip content="View Report" relationship="label">
                            <Button
                                ref={isFirstRow ? viewButtonRef : undefined}
                                appearance="outline"
                                icon={<Eye20Regular />}
                                onClick={() => { void handleViewReview(bot); }}
                                disabled={!hasExistingReview || reviewingBotId !== null || isLoadingReviews}
                                aria-label="View Report"
                            >
                                View
                            </Button>
                        </Tooltip>
                    </TableCellLayout>
                );
            },
        }),
    ];

    // Column sizing options for resizable columns
    const columnSizingOptions: TableColumnSizingOptions = {
        name: {
            minWidth: 200,
            defaultWidth: 300,
        },
        review: {
            minWidth: 120,
            defaultWidth: 150,
        },
        actions: {
            minWidth: 100,
            defaultWidth: 120,
        },
    };

    return (
        <>
            <style>
                {`
                    @keyframes borderTravel {
                        0% {
                            border-top-color: #C53030;
                            border-right-color: transparent;
                            border-bottom-color: transparent;
                            border-left-color: transparent;
                            box-shadow: 0 -2px 8px rgba(197, 48, 48, 0.6);
                        }
                        25% {
                            border-top-color: transparent;
                            border-right-color: #2C7A7B;
                            border-bottom-color: transparent;
                            border-left-color: transparent;
                            box-shadow: 2px 0 8px rgba(44, 122, 123, 0.6);
                        }
                        50% {
                            border-top-color: transparent;
                            border-right-color: transparent;
                            border-bottom-color: #2B6CB0;
                            border-left-color: transparent;
                            box-shadow: 0 2px 8px rgba(43, 108, 176, 0.6);
                        }
                        75% {
                            border-top-color: transparent;
                            border-right-color: transparent;
                            border-bottom-color: transparent;
                            border-left-color: #B7791F;
                            box-shadow: -2px 0 8px rgba(183, 121, 31, 0.6);
                        }
                        100% {
                            border-top-color: #C53030;
                            border-right-color: transparent;
                            border-bottom-color: transparent;
                            border-left-color: transparent;
                            box-shadow: 0 -2px 8px rgba(197, 48, 48, 0.6);
                        }
                    }
                    
                    @keyframes advancedBorderGlow {
                        0% {
                            border-image: linear-gradient(90deg, #C53030 0%, #C53030 25%, transparent 25%, transparent 100%) 1;
                        }
                        25% {
                            border-image: linear-gradient(180deg, #2C7A7B 0%, #2C7A7B 25%, transparent 25%, transparent 100%) 1;
                        }
                        50% {
                            border-image: linear-gradient(270deg, #2B6CB0 0%, #2B6CB0 25%, transparent 25%, transparent 100%) 1;
                        }
                        75% {
                            border-image: linear-gradient(0deg, #B7791F 0%, #B7791F 25%, transparent 25%, transparent 100%) 1;
                        }
                        100% {
                            border-image: linear-gradient(90deg, #C53030 0%, #C53030 25%, transparent 25%, transparent 100%) 1;
                        }
                    }
                    
                    @keyframes borderRotate {
                        0% {
                            --angle: 0deg;
                        }
                        100% {
                            --angle: 360deg;
                        }
                    }

                    @property --angle {
                        syntax: '<angle>';
                        initial-value: 0deg;
                        inherits: false;
                    }

                    .teaching-shimmer-button {
                        position: relative !important;
                        border: 3px solid transparent !important;
                        border-radius: 6px !important;
                        background-image: 
                            linear-gradient(white, white),
                            conic-gradient(
                                from var(--angle) at 50% 50%,
                                #d5dce8 0deg,
                                #d5dce8 60deg,
                                #0078d4 90deg,
                                #00bcf2 120deg,
                                #0078d4 150deg,
                                #d5dce8 180deg,
                                #d5dce8 360deg
                            ) !important;
                        background-origin: padding-box, border-box !important;
                        background-clip: padding-box, border-box !important;
                        animation: borderRotate 3s linear infinite !important;
                    }
                `}
            </style>
            <div className={styles.container}>
            {/* Quick Stats Dashboard */}
            <div ref={quickStatsRef}>
                <DashboardStatsContainer
                    botIds={allBots.map(bot => bot.botid)}
                    reviewedCount={reviewedCount}
                    averageScore={averageScore}
                    totalIssues={totalIssues}
                />
            </div>
            
            {/* My Agents Section Header */}
            <Text style={{fontSize: "18px", fontWeight: "600", marginTop: "8px"}}>My Agents</Text>
            
            {/* Toolbar and Search Row */}
            <div className={styles.toolbarRow}>
                {/* Action Toolbar - Refresh, Export, Settings, Help */}
                <ActionToolbar
                    onRefresh={handleRefresh}
                    onExportAll={handleExportAll}
                    onHelp={handleHelp}
                    onSettings={handleSettings}
                    isRefreshing={isSearching}
                />

                <SearchBox
                    className={styles.searchBox}
                    placeholder="Search Agent by name"
                    value={searchValue}
                    onChange={handleSearchChange}
                    disabled={isSearching}
                    contentAfter={isSearching ? <Spinner size="tiny" /> : undefined}
                />
            </div>

            {/* DataGrid with border */}
            <div className={styles.dataGridWrapper} data-grid-container>
                <DataGrid
                    items={items}
                    columns={reviewColumns}
                    sortable
                    resizableColumns
                    columnSizingOptions={columnSizingOptions}
                    getRowId={(item: BotDetail) => item.botid}
                    style={{
                        minWidth: '600px',
                        width: '100%'
                    }}
                >
                    <DataGridHeader>
                        <DataGridRow className={styles.dataGridHeader}>
                            {({ renderHeaderCell }) => (
                                <DataGridHeaderCell>
                                    {renderHeaderCell()}
                                </DataGridHeaderCell>
                            )}
                        </DataGridRow>
                    </DataGridHeader>
                    <DataGridBody<BotDetail>>
                        {({ item, rowId }) => (
                            <DataGridRow<BotDetail> key={rowId} className={styles.dataGridRow}>
                                {({ renderCell }) => (
                                    <DataGridCell>
                                        {renderCell(item)}
                                    </DataGridCell>
                                )}
                            </DataGridRow>
                        )}
                    </DataGridBody>
                </DataGrid>
            </div>

            {/* Welcome Tour - Points to actual UI elements */}
            <WelcomeTourContainer
                currentStep={currentStep}
                onNext={nextStep}
                onPrevious={previousStep}
                onDismiss={completeTour}
                quickStatsRef={quickStatsRef}
                reviewButtonRef={reviewButtonRef}
                viewButtonRef={viewButtonRef}
            />

            {/* Simplified Progress Dialog */}
            <Dialog open={!!reviewProgress} modalType="modal">
                <DialogSurface style={{ minWidth: '400px', maxWidth: '480px', padding: '24px' }}>
                    <DialogTitle style={{ padding: '0', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {reviewProgress?.description && getTitleIcon(reviewProgress.description)}
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: '14px', color: '#605e5c', marginTop: '4px' }}>
                                    {reviewProgress?.botName}
                                </div>
                            </div>
                        </div>
                    </DialogTitle>
                    <ProgressBar 
                        value={reviewProgress?.progress ?? 0} 
                        max={100}
                        shape="rounded"
                        thickness="large"
                        style={{ width: '100%' }}
                    />
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        marginTop: '8px',
                        marginBottom: '16px',
                        fontSize: '12px',
                        color: '#605e5c'
                    }}>
                        <span>{reviewProgress?.description ?? 'Processing...'}</span>
                        <span>{Math.round(reviewProgress?.progress ?? 0)}%</span>
                    </div>
                    <DialogBody style={{ padding: '0' }}>
                        
                        {/* Success state */}
                        {reviewProgress?.progress === 100 && (
                            <div style={{ 
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px',
                                padding: '12px',
                                backgroundColor: '#F3F9FC',
                                border: '1px solid #0078d4',
                                borderRadius: '4px',
                                color: '#107C10', 
                                fontWeight: '600',
                                fontSize: '14px'
                            }}>
                                <CheckmarkCircleRegular style={{ fontSize: '16px' }} />
                                Opening results...
                            </div>
                        )}
                    </DialogBody>
                </DialogSurface>
            </Dialog>

            {/* Review Results Dialog */}
            {currentReviewResult && (
                <ReviewDialogContainer
                    open={reviewDialogOpen}
                    onClose={handleCloseReviewDialog}
                    reviewResult={currentReviewResult}
                    onDownloadPdf={handleDownloadReviewReport}
                />
            )}
            
            {/* Pagination Controls */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 0', borderTop: '1px solid #e0e0e0' }}>
                {/* Page Size Dropdown */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Text>Show</Text>
                    <Dropdown
                        value={pageSize.toString()}
                        selectedOptions={[pageSize.toString()]}
                        onOptionSelect={handlePageSizeChange}
                        style={{ minWidth: '80px' }}
                    >
                        <Option key="5" value="5">5</Option>
                        <Option key="10" value="10">10</Option>
                        <Option key="20" value="20">20</Option>
                        <Option key="50" value="50">50</Option>
                        <Option key="100" value="100">100</Option>
                    </Dropdown>
                    <Text>records per page</Text>
                </div>
                
                {/* Page Navigation */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Button
                        appearance="subtle"
                        icon={<ChevronLeftRegular />}
                        disabled={currentPage === 1}
                        onClick={() => {
                            console.log('[Pagination] Previous clicked - currentPage:', currentPage, 'totalPages:', totalPages);
                            handlePreviousPage();
                        }}
                    >
                        Previous
                    </Button>
                    <Text style={{ padding: '0 16px' }}>
                        Page {currentPage} of {totalPages || 1} ({filteredBots.length} total records)
                    </Text>
                    <Button
                        appearance="subtle"
                        icon={<ChevronRightRegular />}
                        iconPosition="after"
                        disabled={(() => {
                            const isDisabled = currentPage >= totalPages || filteredBots.length === 0;
                            console.log('[Pagination] Next button disabled state:', {
                                currentPage,
                                totalPages,
                                filteredBotsLength: filteredBots.length,
                                condition1: currentPage >= totalPages,
                                condition2: filteredBots.length === 0,
                                isDisabled
                            });
                            return isDisabled;
                        })()}
                        onClick={() => {
                            console.log('[Pagination] Next clicked - currentPage:', currentPage, 'totalPages:', totalPages, 'disabled:', currentPage >= totalPages);
                            handleNextPage();
                        }}
                    >
                        Next
                    </Button>
                </div>
            </div>

            {/* Quick Links Section */}
            <Text style={{fontSize: "18px", fontWeight: "600", marginTop: "24px", marginBottom: "12px"}}>Quick Links</Text>

            {/* Resource Links Footer */}
            <div className={styles.footer}>
                <Card
                    className={styles.resourceCard}
                    onClick={() => window.open('https://learn.microsoft.com/en-us/microsoft-copilot-studio/advanced-generative-actions#best-practices', '_blank')}
                >
                    <CardHeader
                        header={
                            <div className={styles.resourceCardHeader}>
                                <BookRegular className={styles.resourceIcon} />
                                <div className={styles.resourceText}>
                                    <Text className={styles.resourceTitle}>Learn More</Text>
                                    <Text className={styles.resourceDescription}>Discover how to optimize your agents</Text>
                                </div>
                            </div>
                        }
                    />
                </Card>

                <Card
                    className={styles.resourceCard}
                    onClick={() => window.open('https://github.com/microsoft/Power-CAT-Copilot-Studio-Kit/blob/main/AGENTREVIEWTOOL_REFERENCE_GUIDE.md', '_blank')}
                >
                    <CardHeader
                        header={
                            <div className={styles.resourceCardHeader}>
                                <DocumentRegular className={styles.resourceIcon} />
                                <div className={styles.resourceText}>
                                    <Text className={styles.resourceTitle}>Documentation</Text>
                                    <Text className={styles.resourceDescription}>Understanding your agent review results</Text>
                                </div>
                            </div>
                        }
                    />
                </Card>

                <Card
                    className={styles.resourceCard}
                    onClick={() => window.open('https://learn.microsoft.com/en-us/microsoft-copilot-studio/authoring-instructions#writing-great-instructions', '_blank')}
                >
                    <CardHeader
                        header={
                            <div className={styles.resourceCardHeader}>
                                <Lightbulb32Regular className={styles.resourceIcon} />
                                <div className={styles.resourceText}>
                                    <Text className={styles.resourceTitle}>Best Practices</Text>
                                    <Text className={styles.resourceDescription}>Microsoft guide for effective instructions</Text>
                                </div>
                            </div>
                        }
                    />
                </Card>
            </div>
        </div>
        </>
    );
};

