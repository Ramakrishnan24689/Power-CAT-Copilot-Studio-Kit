import * as React from 'react';
import {
    Text,
    makeStyles,
    tokens
} from '@fluentui/react-components';
import { StatCard } from '../../shared/Cards';
import { calculateAggregateStats } from '../../utils/statsCalculator';
import type { AggregateStats } from '../../../types';

const useStyles = makeStyles({
    container: {
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        paddingTop: '16px',
        paddingBottom: '16px',
        paddingLeft: '2px',
        paddingRight: '2px',
        marginBottom: '16px',
    },
    statsGrid: {
        width: '100%',
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        gap: '16px',
    },
});

export interface QuickStatsPanelProps {
    /** List of all bot IDs currently visible (filtered) */
    botIds: string[];
    /** Total reviewed count from paged agent reviews */
    reviewedCount?: number;
    /** Average score from all reviews */
    averageScore?: number;
    /** Total issues from all reviews */
    totalIssues?: number;
}

/**
 * Quick Stats Dashboard Panel
 * Displays aggregate metrics for agents accessible to the current user
 */
const DashboardStatsContainerComponent: React.FC<QuickStatsPanelProps> = (props) => {
    const { botIds, reviewedCount, averageScore, totalIssues } = props;
    const styles = useStyles();

    // Calculate stats based on current bot list or use provided counts
    const stats: AggregateStats = React.useMemo(() => {
        console.log('[QuickStatsPanel] Calculating stats with props:', {
            botIdsLength: botIds.length,
            reviewedCount,
            averageScore,
            totalIssues
        });
        
        // Use botIds.length (filtered bots count) as the primary total
        const totalBots = botIds.length;
        const baseStats = calculateAggregateStats(totalBots, []);
        
        // Override with actual counts if provided
        const calculatedStats = {
            ...baseStats,
            totalBots: totalBots, // Always use filtered bots count (generative-enabled)
            reviewedBots: reviewedCount ?? baseStats.reviewedBots,
            reviewedPercentage: (totalBots > 0 && reviewedCount !== null && reviewedCount !== undefined)
                ? Math.round((reviewedCount / totalBots) * 100)
                : baseStats.reviewedPercentage,
            averageScore: averageScore ?? baseStats.averageScore,
            totalIssues: totalIssues ?? baseStats.totalIssues
        };
        
        console.log('[QuickStatsPanel] Calculated stats:', calculatedStats);
        return calculatedStats;
    }, [botIds.length, reviewedCount, averageScore, totalIssues]);

    // Determine color variants based on values
    const getScoreVariant = (score: number): 'success' | 'warning' | 'error' | 'default' => {
        if (score >= 80) return 'success';
        if (score >= 60) return 'warning';
        if (score > 0) return 'error';
        return 'default';
    };

    return (
        <div className={styles.container}>
            {/* Quick Stats Section */}
            <Text style={{fontSize: "18px", fontWeight: "600"}}>Quick Stats</Text>
            <div className={styles.statsGrid}>
                <StatCard
                    label="Total Bots"
                    value={stats.totalBots}
                    barColor="slot1"
                    tooltip="All generative AI orchestration enabled agents accessible to you"
                />
                
                <StatCard
                    label="Reviewed"
                    value={`${stats.reviewedBots} (${stats.reviewedPercentage}%)`}
                    variant={stats.reviewedPercentage >= 80 ? 'success' : 'default'}
                    barColor="slot2"
                    tooltip="Agents that have gone through quality assessment"
                />
                
                <StatCard
                    label="Avg Score"
                    value={stats.averageScore > 0 ? `${stats.averageScore}%` : '--'}
                    variant={getScoreVariant(stats.averageScore)}
                    barColor="slot3"
                    tooltip="Average overall quality score across all reviewed agents, calculated from pattern compliance and instruction clarity"
                />
                
                <StatCard
                    label="Total Issues"
                    value={(stats.totalIssues !== undefined && stats.totalIssues !== null && stats.reviewedBots > 0) 
                        ? stats.totalIssues.toString() 
                        : '--'}
                    barColor="slot4"
                    tooltip="Total number of identified patterns and issues across all reviewed agents"
                />
            </div>
        </div>
    );
};

DashboardStatsContainerComponent.displayName = 'DashboardStatsContainer';

export const DashboardStatsContainer = React.memo(DashboardStatsContainerComponent);
