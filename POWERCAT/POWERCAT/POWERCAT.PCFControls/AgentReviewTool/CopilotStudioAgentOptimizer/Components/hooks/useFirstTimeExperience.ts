import * as React from 'react';
import { FREService } from '../../Services';
import { useServiceContext } from '../context';
import { StorageKeys } from '../../config';

/**
 * First Run Experience (FRE) state management using Dataverse with localStorage fallback
 * Multi-step tour with navigation controls
 */

/**
 * Hook for First Run Experience
 * Returns tour state, current step, and navigation handlers
 * Uses FREService for Dataverse integration with localStorage cache
 */
export const useFirstTimeExperience = () => {
    const { webAPI, userId } = useServiceContext();
    const [tourCompleted, setTourCompleted] = React.useState<boolean>(false);
    const [currentStep, setCurrentStep] = React.useState<number>(0);
    const [isLoading, setIsLoading] = React.useState<boolean>(true);

    // Load FRE status using service (service handles WhoAmI internally)
    React.useEffect(() => {
        const loadFREStatus = async () => {
            try {
                const freService = new FREService(webAPI);
                const completed = await freService.hasCompletedFRE();
                setTourCompleted(completed);
                console.log('[FRE] 📊 Tour completed status:', completed);
            } catch (err) {
                console.error('[FRE] ❌ Error loading FRE status, falling back to localStorage:', err);
                // Fallback to localStorage directly
                try {
                    const stored = localStorage.getItem(StorageKeys.FirstRunExperience);
                    const localState = stored ? JSON.parse(stored) : { tourCompleted: false };
                    setTourCompleted(localState.tourCompleted);
                    console.log('[FRE] 💾 Using localStorage fallback:', localState.tourCompleted);
                } catch (localError) {
                    console.error('[FRE] ❌ localStorage fallback failed, defaulting to false:', localError);
                    setTourCompleted(false);
                }
            } finally {
                setIsLoading(false);
            }
        };

        loadFREStatus().catch(err => {
            console.error('[FRE] Unhandled error in loadFREStatus:', err);
            setIsLoading(false);
        });
    }, [webAPI]);

    // Start tour after loading is complete
    React.useEffect(() => {
        if (!isLoading && !tourCompleted) {
            const timer = setTimeout(() => {
                setCurrentStep(1);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [tourCompleted, isLoading]);

    const nextStep = React.useCallback(() => {
        setCurrentStep(prev => prev + 1);
    }, []);

    const previousStep = React.useCallback(() => {
        setCurrentStep(prev => Math.max(1, prev - 1));
    }, []);

    const completeTour = React.useCallback(() => {
        setTourCompleted(true);
        setCurrentStep(0);
        
        // Save using FREService (it handles WhoAmI internally, no userId needed)
        if (webAPI) {
            const freService = new FREService(webAPI);
            freService.completeFRE().catch(err => {
                console.error('[FRE] ❌ Failed to complete FRE via service:', err);
                // Note: FREService already saves to localStorage first, so this is just logging
            });
        } else {
            // No webAPI context - save to localStorage only as fallback
            try {
                localStorage.setItem(StorageKeys.FirstRunExperience, JSON.stringify({ tourCompleted: true }));
                console.log('[FRE] 💾 Saved FRE completion to localStorage (no webAPI context)');
            } catch (localError) {
                console.error('[FRE] ❌ Failed to save FRE to localStorage:', localError);
            }
        }
    }, [webAPI]);

    const resetTour = React.useCallback(() => {
        setTourCompleted(false);
        setCurrentStep(1);
        
        // Reset using FREService (it handles WhoAmI internally, no userId needed)
        if (webAPI) {
            const freService = new FREService(webAPI);
            freService.resetFRE().catch(err =>
                console.error('[FRE] Error resetting tour:', err)
            );
        }
    }, [webAPI]);

    return {
        shouldShowTour: !isLoading && !tourCompleted && currentStep > 0,
        currentStep,
        nextStep,
        previousStep,
        completeTour,
        resetTour,
        isLoading
    };
};
