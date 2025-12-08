import * as React from 'react';
import {
    MessageBar,
    MessageBarBody,
    MessageBarTitle,
    Button,
    Menu,
    MenuTrigger,
    MenuPopover,
    MenuList,
    MenuItem,
    makeStyles,
    tokens
} from '@fluentui/react-components';
import { 
    DismissRegular, 
    BotSparkle24Regular, 
    QuestionCircleRegular,
    BookRegular,
    DocumentRegular,
    LightbulbRegular,
    OpenRegular,
    SparkleRegular
} from '@fluentui/react-icons';

const useStyles = makeStyles({
    messageBar: {
        marginBottom: '16px',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
    },
    description: {
        fontSize: '14px',
        lineHeight: '20px',
        color: tokens.colorNeutralForeground2,
    },
    actions: {
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        marginTop: '8px',
    },
    links: {
        display: 'flex',
        gap: '16px',
    },
    titleContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
});

export interface HeroSectionProps {
    onDismiss?: () => void;
    onStartReview?: () => void;
}

/**
 * Hero section explaining the Agent Optimizer tool
 * Dismissible info banner with links to documentation
 */
export const HeroSection: React.FC<HeroSectionProps> = ({ onDismiss, onStartReview }) => {
    const styles = useStyles();
    const [isDismissed, setIsDismissed] = React.useState(false);

    const handleDismiss = () => {
        setIsDismissed(true);
        onDismiss?.();
    };

    const handleStartReview = () => {
        // Smooth scroll to the DataGrid section
        const gridElement = document.querySelector('[data-grid-container]');
        if (gridElement) {
            gridElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
            // Trigger teaching bubble after scroll
            setTimeout(() => {
                onStartReview?.();
            }, 800);
        }
    };

    if (isDismissed) {
        return null;
    }

    return (
        <MessageBar
            className={styles.messageBar}
            intent="info"
        >
            <MessageBarBody>
                <div className={styles.content}>
                    <div className={styles.titleContainer}>
                        <BotSparkle24Regular />
                        <MessageBarTitle>Welcome to Agent Optimizer</MessageBarTitle>
                    </div>
                    <div className={styles.description}>
                        Review bot configurations, detect anti-patterns in instructions, and track 
                        optimization progress. Identify quality issues, analyze topic patterns, and 
                        get actionable recommendations to improve agent performance.
                    </div>
                    <div className={styles.actions}>
                        <Button appearance="primary" size="small" onClick={handleStartReview} icon={<SparkleRegular />}>
                            Start Review
                        </Button>
                        <Button 
                            appearance="secondary" 
                            size="small"
                            icon={<BookRegular />}
                            onClick={() => window.open('#', '_blank')}
                        >
                            Learn More
                        </Button>
                        <Button 
                            appearance="secondary" 
                            size="small"
                            icon={<DocumentRegular />}
                            onClick={() => window.open('#', '_blank')}
                        >
                            Documentation
                        </Button>
                        <Button 
                            appearance="secondary" 
                            size="small"
                            icon={<LightbulbRegular />}
                            onClick={() => window.open('#', '_blank')}
                        >
                            Best Practices
                        </Button>
                    </div>
                </div>
            </MessageBarBody>
            <Button
                onClick={handleDismiss}
                appearance="transparent"
                icon={<DismissRegular />}
                aria-label="Dismiss"
                size="small"
            />
        </MessageBar>
    );
};
