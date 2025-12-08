import * as React from 'react';
import {
    Card,
    CardPreview,
    Text,
    makeStyles,
    tokens,
    Tooltip,
} from '@fluentui/react-components';
import type { FluentIcon } from '@fluentui/react-icons';

const useStyles = makeStyles({
    card: {
        width: '100%',
        minWidth: '200px',
        height: '80px',
        padding: '0',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
    },
    iconPreview: {
        width: '80px',
        minWidth: '80px',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        background: 'linear-gradient(135deg, rgba(7, 127, 171, 0.1) 0%, rgba(7, 127, 171, 0.05) 100%)',
        borderTopLeftRadius: '4px',
        borderBottomLeftRadius: '4px',
    },
    icon: {
        width: '40px',
        height: '40px',
        fontSize: '40px',
        color: '#077FAB',
    },
    content: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '16px',
        flex: 1,
        gap: '4px',
    },
    value: {
        fontSize: '24px',
        fontWeight: '600',
        lineHeight: '1.2',
        color: tokens.colorNeutralForeground1,
        wordBreak: 'break-word',
        overflowWrap: 'break-word',
    },
    label: {
        fontSize: '12px',
        color: tokens.colorNeutralForeground3,
        lineHeight: '16px',
        flexShrink: 0,
    },
    // Color variants for different metric types
    successValue: {
        color: tokens.colorPaletteGreenForeground1,
    },
    warningValue: {
        color: tokens.colorPaletteYellowForeground1,
    },
    errorValue: {
        color: tokens.colorPaletteRedForeground1,
    },
    // Colored bar on the left side - Fluent UI Data Visualization Palette
    barSlot1: {
        borderLeftColor: '#637CEF',
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid',
    },
    barSlot2: {
        borderLeftColor: '#E3008C',
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid',
    },
    barSlot3: {
        borderLeftColor: '#2AA0A4',
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid',
    },
    barSlot4: {
        borderLeftColor: '#9373C0',
        borderLeftWidth: '4px',
        borderLeftStyle: 'solid',
    },
});

export interface StatCardProps {
	label: string;
	value: string | number;
	variant?: 'default' | 'success' | 'warning' | 'error';
	icon?: FluentIcon;
	barColor?: 'slot1' | 'slot2' | 'slot3' | 'slot4' | 'slot5' | 'slot6' | 'slot7' | 'slot8' | 'slot9' | 'slot10';
	tooltip?: string;
}/**
 * Reusable stat card component for displaying key metrics
 * Uses Fluent UI v9 Card component with horizontal orientation
 */
export const StatCard: React.FC<StatCardProps> = ({ 
    label, 
    value, 
    variant = 'default',
    icon: Icon,
    barColor,
    tooltip
}) => {
    const styles = useStyles();

    const getValueStyle = () => {
        switch (variant) {
            case 'success':
                return `${styles.value} ${styles.successValue}`;
            case 'warning':
                return `${styles.value} ${styles.warningValue}`;
            case 'error':
                return `${styles.value} ${styles.errorValue}`;
            default:
                return styles.value;
        }
    };

    const getBarColor = () => {
        switch (barColor) {
            case 'slot1': return '#637CEF';
            case 'slot2': return '#E3008C';
            case 'slot3': return '#2AA0A4';
            case 'slot4': return '#9373C0';
            case 'slot5': return '#13A10E';
            case 'slot6': return '#3A96DD';
            case 'slot7': return '#CA5010';
            case 'slot8': return '#57811B';
            case 'slot9': return '#B146C2';
            case 'slot10': return '#AE8C00';
            default: return undefined;
        }
    };

    const cardContent = (
        <div style={{ display: 'flex', position: 'relative', width: '100%', height: '100%' }}>
            {barColor && (
                <div style={{
                    width: '4px',
                    backgroundColor: getBarColor(),
                    position: 'absolute',
                    left: '8px',
                    top: '8px',
                    bottom: '8px',
                    borderRadius: '2px',
                    zIndex: 10
                }} />
            )}
            <Card 
                className={styles.card} 
                orientation="horizontal"
                style={{ width: '100%', paddingLeft: barColor ? '12px' : '0' }}
            >
                {Icon && (
                    <CardPreview className={styles.iconPreview}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                            <Icon className={styles.icon} style={{ width: '40px', height: '40px' }} />
                        </div>
                    </CardPreview>
                )}
                
                <div className={styles.content}>
                    <Text className={getValueStyle()}>{value}</Text>
                    <Text className={styles.label}>{label}</Text>
                </div>
            </Card>
        </div>
    );

    if (tooltip) {
        return (
            <Tooltip content={tooltip} relationship="description">
                {cardContent}
            </Tooltip>
        );
    }

    return cardContent;
};
