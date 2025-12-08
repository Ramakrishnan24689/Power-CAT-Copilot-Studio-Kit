import * as React from 'react';
import {
    TeachingPopover,
    TeachingPopoverSurface,
    TeachingPopoverBody,
    TeachingPopoverTitle,
    TeachingPopoverFooter,
} from '@fluentui/react-teaching-popover';

export interface WelcomeTourProps {
    currentStep: number;
    onNext: () => void;
    onPrevious: () => void;
    onDismiss: () => void;
    quickStatsRef: React.RefObject<HTMLElement>;
    reviewButtonRef: React.RefObject<HTMLElement>;
    viewButtonRef: React.RefObject<HTMLElement>;
}

/**
 * Multi-step teaching popover tour that points to actual UI elements
 */
export const WelcomeTourContainer: React.FC<WelcomeTourProps> = ({
    currentStep,
    onNext,
    onPrevious,
    onDismiss,
    quickStatsRef,
    reviewButtonRef,
    viewButtonRef,
}) => {
    // Step 1: Quick Stats Dashboard
    if (currentStep === 1 && quickStatsRef.current) {
        return (
            <TeachingPopover
                open={true}
                positioning={{ target: quickStatsRef.current, position: 'below' }}
            >
                <TeachingPopoverSurface style={{ maxWidth: '360px' }}>
                    <TeachingPopoverBody>
                        <TeachingPopoverTitle>Quick Stats Dashboard</TeachingPopoverTitle>
                        Monitor agent quality at a glance. Track total agents you own, reviewed agents, 
                        average quality scores, and total issues found across reviewed agents.
                    </TeachingPopoverBody>
                    <TeachingPopoverFooter
                        primary={{
                            children: "Next (1/3)",
                            onClick: onNext
                        }}
                        secondary={{
                            children: "Skip Tour",
                            onClick: onDismiss
                        }}
                    />
                </TeachingPopoverSurface>
            </TeachingPopover>
        );
    }

    // Step 2: Review Button
    if (currentStep === 2 && reviewButtonRef.current) {
        return (
            <TeachingPopover
                open={true}
                positioning={{ target: reviewButtonRef.current, position: 'after' }}
            >
                <TeachingPopoverSurface style={{ maxWidth: '360px' }}>
                    <TeachingPopoverBody>
                        <TeachingPopoverTitle>Start a Review</TeachingPopoverTitle>
                        Click the Review button to analyze an agent&apos;s configuration, detect 
                        anti-patterns, and get AI-powered recommendations. Reviews are saved automatically.
                    </TeachingPopoverBody>
                    <TeachingPopoverFooter
                        primary={{
                            children: "Next (2/3)",
                            onClick: onNext
                        }}
                        secondary={{
                            children: "Previous",
                            onClick: onPrevious
                        }}
                    />
                </TeachingPopoverSurface>
            </TeachingPopover>
        );
    }

    // Step 3: View Button
    if (currentStep === 3 && viewButtonRef.current) {
        return (
            <TeachingPopover
                open={true}
                positioning={{ target: viewButtonRef.current, position: 'above' }}
            >
                <TeachingPopoverSurface style={{ maxWidth: '360px' }}>
                    <TeachingPopoverBody>
                        <TeachingPopoverTitle>View Results & Export</TeachingPopoverTitle>
                        After reviewing an agent, click View to see the detailed report. You can 
                        download PDF reports for stakeholders or SARIF files for DevOps integration 
                        using the split button in the dialog.
                    </TeachingPopoverBody>
                    <TeachingPopoverFooter
                        primary={{
                            children: "Finish Tour",
                            onClick: onDismiss
                        }}
                        secondary={{
                            children: "Previous",
                            onClick: onPrevious
                        }}
                    />
                </TeachingPopoverSurface>
            </TeachingPopover>
        );
    }

    return null;
};
