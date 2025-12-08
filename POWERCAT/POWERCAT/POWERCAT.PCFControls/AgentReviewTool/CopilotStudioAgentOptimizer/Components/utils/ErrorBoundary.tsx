/**
 * Simple Error Boundary component
 * Catches React errors and displays a fallback UI with recovery options
 */

import * as React from 'react';
import { Card, CardHeader, Text, Button } from '@fluentui/react-components';
import { ErrorCircle24Regular, ArrowSync24Regular } from '@fluentui/react-icons';
import { makeStyles } from '@fluentui/react-components';
import { createLogger } from './logger';

const logger = createLogger({ component: 'ErrorBoundary' });

const useStyles = makeStyles({
    container: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px',
        padding: '20px',
    },
    errorCard: {
        maxWidth: '600px',
        width: '100%',
    },
    errorContent: {
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
    },
    errorIcon: {
        color: '#d13438',
        fontSize: '48px',
        marginBottom: '8px',
    },
    errorTitle: {
        fontSize: '20px',
        fontWeight: 600,
        marginBottom: '8px',
    },
    errorMessage: {
        color: '#605e5c',
        marginBottom: '16px',
    },
    errorDetails: {
        backgroundColor: '#f3f2f1',
        padding: '12px',
        borderRadius: '4px',
        fontSize: '12px',
        fontFamily: 'monospace',
        overflow: 'auto',
        maxHeight: '200px',
    },
    actions: {
        display: 'flex',
        gap: '8px',
        marginTop: '8px',
    },
});

interface ErrorBoundaryProps {
    /** Child components to render */
    children: React.ReactNode;
    /** Optional custom fallback component */
    fallback?: React.ReactNode;
    /** Optional callback when error occurs */
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error?: Error;
    errorInfo?: React.ErrorInfo;
}

/**
 * Error Boundary component that catches errors in child components
 * 
 * @example
 * ```tsx
 * <ErrorBoundary>
 *   <MyComponent />
 * </ErrorBoundary>
 * ```
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        // Update state so the next render shows the fallback UI
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        // Log the error
        logger.error('Component error caught by boundary', {
            error: error.message,
            stack: error.stack,
            componentStack: errorInfo.componentStack,
        });

        // Update state with error details
        this.setState({ errorInfo });

        // Call optional error callback
        if (this.props.onError) {
            this.props.onError(error, errorInfo);
        }
    }

    handleReset = (): void => {
        logger.info('Error boundary reset requested');
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    handleReload = (): void => {
        logger.info('Page reload requested from error boundary');
        window.location.reload();
    };

    render(): React.ReactNode {
        if (this.state.hasError) {
            // Use custom fallback if provided
            if (this.props.fallback) {
                return this.props.fallback;
            }

            // Default error UI
            return <ErrorFallback 
                error={this.state.error}
                errorInfo={this.state.errorInfo}
                onReset={this.handleReset}
                onReload={this.handleReload}
            />;
        }

        return this.props.children;
    }
}

/**
 * Default error fallback UI
 */
interface ErrorFallbackProps {
    error?: Error;
    errorInfo?: React.ErrorInfo;
    onReset: () => void;
    onReload: () => void;
}

function ErrorFallback({ error, errorInfo, onReset, onReload }: ErrorFallbackProps): JSX.Element {
    const styles = useStyles();
    const [showDetails, setShowDetails] = React.useState(false);

    return (
        <div className={styles.container}>
            <Card className={styles.errorCard}>
                <CardHeader
                    header={
                        <div className={styles.errorContent}>
                            <ErrorCircle24Regular className={styles.errorIcon} />
                            <Text className={styles.errorTitle}>
                                Something went wrong
                            </Text>
                            <Text className={styles.errorMessage}>
                                An unexpected error occurred. You can try to recover or reload the page.
                            </Text>

                            {error && (
                                <div>
                                    <Text weight="semibold" size={300}>
                                        Error: {error.name}
                                    </Text>
                                    <Text block size={200} style={{ marginTop: '4px' }}>
                                        {error.message}
                                    </Text>
                                </div>
                            )}

                            <div className={styles.actions}>
                                <Button
                                    appearance="primary"
                                    icon={<ArrowSync24Regular />}
                                    onClick={onReset}
                                >
                                    Try Again
                                </Button>
                                <Button
                                    appearance="secondary"
                                    onClick={onReload}
                                >
                                    Reload Page
                                </Button>
                                <Button
                                    appearance="subtle"
                                    onClick={() => setShowDetails(!showDetails)}
                                >
                                    {showDetails ? 'Hide Details' : 'Show Details'}
                                </Button>
                            </div>

                            {showDetails && (error?.stack ?? errorInfo?.componentStack) && (
                                <div className={styles.errorDetails}>
                                    {error?.stack && (
                                        <>
                                            <div>Error Stack:</div>
                                            <pre>{error.stack}</pre>
                                        </>
                                    )}
                                    {errorInfo?.componentStack && (
                                        <>
                                            <div style={{ marginTop: '12px' }}>Component Stack:</div>
                                            <pre>{errorInfo.componentStack}</pre>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                    }
                />
            </Card>
        </div>
    );
}
