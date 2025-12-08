import * as React from 'react';
import { makeStyles, shorthands } from '@fluentui/react-components';
import { 
    webLightTheme,
    type BrandVariants,
    createLightTheme 
} from '@fluentui/react-theme';
import { BotGridContainer } from '../BotGrid/BotGridContainer';

export interface MainContainerProps {
    stageAModelId: string;
    stageBModelId: string;
    stageCModelId: string;
    stageDModelId: string;
    baseUrl: string;
    useTestHarness: boolean;
    width: number;
    height: number;
}

// Copilot Studio brand color with proper accessibility-compliant ramp
// Generated to ensure WCAG 2.1 AA compliance for contrast ratios
const copilotStudioBrand: BrandVariants = {
    10: "#03151F",
    20: "#041F2D",
    30: "#052A3C",
    40: "#06344A",
    50: "#073E59",
    60: "#074868",
    70: "#075279",
    80: "#077FAB", // Primary Copilot Studio color
    90: "#0D8FBF", // Hover state
    100: "#2B9FCC",
    110: "#4FAFD7",
    120: "#6FBFE2",
    130: "#8DCEEC",
    140: "#AADDF5",
    150: "#C5EBFC",
    160: "#E0F6FF"
};

export const copilotStudioTheme = createLightTheme(copilotStudioBrand);

const useStyles = makeStyles({
    root: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        overflowY: 'auto', // Enable vertical scroll when content overflows
        overflowX: 'hidden', // Prevent horizontal scroll
        ...shorthands.padding('20px'),
        boxSizing: 'border-box',
        overflow: 'auto', // Enable vertical scroll when content exceeds height
        // Subtle gradient background (Copilot Studio style)
        background: 'radial-gradient(circle at 20% 50%, rgba(24, 90, 189, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(71, 207, 250, 0.03) 0%, transparent 50%)',
    },
    contentWrapper: {
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        maxWidth: '1000px',
        ...shorthands.padding('0', '24px'),
    },
    header: {
        marginTop: '16px',
        marginBottom: '20px',
    },
    title: {
        fontSize: '24px',
        fontWeight: '600',
        marginBottom: '8px',
    },
    subtitle: {
        fontSize: '14px',
        color: '#605E5C',
    },
    content: {
        flex: 1,
        overflow: 'auto',
    },
});

export const MainContainer: React.FC<MainContainerProps> = ({ 
    stageAModelId, 
    stageBModelId, 
    stageCModelId, 
    stageDModelId, 
    baseUrl, 
    useTestHarness, 
    width,
    height 
}) => {
    const styles = useStyles();

    return (
        <div 
            className={styles.root}
            style={{
                width: width || '100%',
                height: height || '100%',
                maxWidth: width || 'none',
                maxHeight: height || 'none'
            }}
        >
            <div className={styles.contentWrapper}>
                <div className={styles.header}>
                    <div className={styles.title}>
                        Agent Review Tool
                        <span style={{ 
                            marginLeft: '12px', 
                            padding: '4px 8px', 
                            backgroundColor: '#E0F6FF', 
                            color: '#077FAB', 
                            fontSize: '12px', 
                            fontWeight: '600', 
                            borderRadius: '4px',
                            verticalAlign: 'super',
                            position: 'relative',
                            top: '-8px'
                        }}>PREVIEW</span>
                    </div>
                    <div className={styles.subtitle}>Assess agent quality, identify configuration improvements, and ensure best practices in this environment</div>
                </div>
                <div className={styles.content}>
                    <BotGridContainer 
                        stageAModelId={stageAModelId}
                        stageBModelId={stageBModelId}
                        stageCModelId={stageCModelId}
                        stageDModelId={stageDModelId}
                        baseUrl={baseUrl}
                        useTestHarness={useTestHarness}
                    />
                </div>
            </div>
        </div>
    );
};
