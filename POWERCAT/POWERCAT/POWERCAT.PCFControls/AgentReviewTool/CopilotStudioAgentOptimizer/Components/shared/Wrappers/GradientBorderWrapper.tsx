import * as React from 'react';
import { tokens } from '@fluentui/react-components';

interface GradientBorderWrapperProps {
    children: React.ReactNode;
    /** Enable the shimmer animation. Default is true */
    enableAnimation?: boolean;
    /** Custom border radius. Defaults to Fluent's borderRadiusMedium */
    borderRadius?: string;
}

/**
 * GradientBorderWrapper component to encapsulate the animated border and styles
 * Provides a Copilot-style shimmer effect around dialogs and cards
 */
export const GradientBorderWrapper: React.FC<GradientBorderWrapperProps> = ({ 
    children, 
    enableAnimation = true,
    borderRadius = tokens.borderRadiusMedium 
}) => (
    <>
        <style>
            {`
                @keyframes shimmerBorder {
                    0% { 
                        background-position: 0% 0%;
                        transform: rotate(0deg) scale(2);
                    }
                    75% {
                        background-position: 150% 0%;
                        transform: rotate(180deg) scale(2);
                    }
                    100% { 
                        background-position: 300% 0%;
                        transform: rotate(360deg) scale(2);
                    }
                } 
                
                .gradient-border {
                    position: absolute;
                    top: -4px;
                    left: -4px;
                    right: -4px;
                    bottom: -4px;
                    border-radius: inherit;
                    background-image: linear-gradient(
                        to right, 
                        #FFFFFF, 
                        #077FAB, 
                        #B25ABF, 
                        #F59F57, 
                        #DD598F, 
                        #C647B9, 
                        #077FAB, 
                        #FFFFFF,  
                        #B25ABF, 
                        #F59F57, 
                        #DD598F, 
                        #C647B9, 
                        #FFFFFF
                    );
                    background-size: 100% 100%;
                    z-index: 0;
                    ${enableAnimation ? 'animation: shimmerBorder 8s linear infinite;' : ''}
                }
                
                .border-wrapper {
                    position: relative;
                    border-radius: ${borderRadius};
                    overflow: hidden;
                    width: 100%;
                    height: 100%;
                }
                
                .card-inner {
                    position: relative;
                    z-index: 1;
                    background-color: ${tokens.colorNeutralBackground1};
                    border-radius: ${borderRadius};
                    margin: 4px;
                    overflow: hidden;
                    width: calc(100% - 8px);
                    height: calc(100% - 8px);
                }
            `}
        </style>
        <div className="border-wrapper" id="borderWrapper">
            <div className="gradient-border" id="borderGradient"></div>
            <div className="card-inner" id="cardinner">
                {children}
            </div>
        </div>
    </>
);