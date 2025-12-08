import * as React from 'react';
import {
    Toolbar,
    ToolbarButton,
    makeStyles,
    Tooltip
} from '@fluentui/react-components';
import { 
    ArrowClockwiseRegular, 
    DocumentArrowDownRegular,
    QuestionCircleRegular,
    SettingsRegular
} from '@fluentui/react-icons';

const useStyles = makeStyles({
    toolbar: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        width: '100%',
    },
    leftActions: {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
    },
    rightActions: {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
    },
});

export interface ActionToolbarProps {
    onRefresh: () => void;
    onExportAll: () => void;
    onHelp?: () => void;
    onSettings?: () => void;
    isRefreshing?: boolean;
}

/**
 * Action toolbar with Refresh, Export on left; Settings, Help on right
 */
export const ActionToolbar: React.FC<ActionToolbarProps> = ({
    onRefresh,
    onExportAll,
    onHelp,
    onSettings,
    isRefreshing = false
}) => {
    const styles = useStyles();

    return (
        <Toolbar size="small" className={styles.toolbar}>
            {/* Left side: Primary actions */}
            <div className={styles.leftActions}>
                <Tooltip content="Refresh bot list" relationship="label">
                    <ToolbarButton
                        icon={<ArrowClockwiseRegular />}
                        onClick={onRefresh}
                        disabled={isRefreshing}
                    >
                        Refresh
                    </ToolbarButton>
                </Tooltip>

                <Tooltip content="Export all review data" relationship="label">
                    <ToolbarButton
                        icon={<DocumentArrowDownRegular />}
                        onClick={onExportAll}
                    >
                        Export All
                    </ToolbarButton>
                </Tooltip>
            </div>

            {/* Right side: Utility actions */}
            <div className={styles.rightActions}>
                {onSettings && (
                    <Tooltip content="Settings" relationship="label">
                        <ToolbarButton
                            icon={<SettingsRegular />}
                            onClick={onSettings}
                            appearance="subtle"
                        />
                    </Tooltip>
                )}

                {onHelp && (
                    <Tooltip content="Help & Documentation" relationship="label">
                        <ToolbarButton
                            icon={<QuestionCircleRegular />}
                            onClick={onHelp}
                            appearance="subtle"
                        />
                    </Tooltip>
                )}
            </div>
        </Toolbar>
    );
};
