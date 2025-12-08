/**
 * Simple structured logger with log levels
 * Provides consistent logging across the application with context support
 */

export enum LogLevel {
    Debug = 0,
    Info = 1,
    Warn = 2,
    Error = 3,
}

interface LogContext {
    component?: string;
    action?: string;
    [key: string]: unknown;
}

/**
 * Logger configuration
 */
class LoggerConfig {
    private static minLevel: LogLevel = LogLevel.Info;
    private static enableConsole = true;

    static setMinLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    static getMinLevel(): LogLevel {
        return this.minLevel;
    }

    static setConsoleEnabled(enabled: boolean): void {
        this.enableConsole = enabled;
    }

    static isConsoleEnabled(): boolean {
        return this.enableConsole;
    }
}

/**
 * Simple logger utility
 */
class Logger {
    private context: LogContext;

    constructor(context: LogContext = {}) {
        this.context = context;
    }

    /**
     * Create a new logger with additional context
     */
    withContext(additionalContext: LogContext): Logger {
        return new Logger({ ...this.context, ...additionalContext });
    }

    /**
     * Log debug message (verbose information for development)
     */
    debug(message: string, data?: unknown): void {
        this.log(LogLevel.Debug, message, data);
    }

    /**
     * Log info message (general information)
     */
    info(message: string, data?: unknown): void {
        this.log(LogLevel.Info, message, data);
    }

    /**
     * Log warning message (something unexpected but not critical)
     */
    warn(message: string, data?: unknown): void {
        this.log(LogLevel.Warn, message, data);
    }

    /**
     * Log error message (something went wrong)
     */
    error(message: string, error?: unknown): void {
        const errorData = error instanceof Error 
            ? { message: error.message, stack: error.stack, name: error.name }
            : error;
        
        this.log(LogLevel.Error, message, errorData);
    }

    private log(level: LogLevel, message: string, data?: unknown): void {
        // Check if we should log this level
        if (level < LoggerConfig.getMinLevel()) {
            return;
        }

        if (!LoggerConfig.isConsoleEnabled()) {
            return;
        }

        // Build log entry
        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level];
        const contextStr = Object.keys(this.context).length > 0 
            ? `[${JSON.stringify(this.context)}]` 
            : '';

        // Format message
        const fullMessage = `${timestamp} ${levelName} ${contextStr} ${message}`;

        // Output to console with appropriate method
        switch (level) {
            case LogLevel.Debug:
                console.debug(fullMessage, data ?? '');
                break;
            case LogLevel.Info:
                console.info(fullMessage, data ?? '');
                break;
            case LogLevel.Warn:
                console.warn(fullMessage, data ?? '');
                break;
            case LogLevel.Error:
                console.error(fullMessage, data ?? '');
                break;
        }
    }
}

/**
 * Create a logger instance with optional context
 */
export function createLogger(context?: LogContext): Logger {
    return new Logger(context);
}

/**
 * Configure logger settings
 */
export const loggerConfig = {
    /**
     * Set minimum log level (default: Info)
     * Debug = 0, Info = 1, Warn = 2, Error = 3
     */
    setMinLevel: (level: LogLevel) => LoggerConfig.setMinLevel(level),
    
    /**
     * Enable or disable console output (default: enabled)
     */
    setConsoleEnabled: (enabled: boolean) => LoggerConfig.setConsoleEnabled(enabled),
};

/**
 * Default logger instance
 */
export const logger = createLogger({ component: 'CopilotStudioAgentOptimizer' });
