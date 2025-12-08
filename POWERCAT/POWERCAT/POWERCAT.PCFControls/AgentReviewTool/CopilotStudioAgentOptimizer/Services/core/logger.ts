/**
 * Service logger wrapper - delegates to centralized logger
 * Maintains backward compatibility with existing service logging pattern
 */

import { createLogger, LogLevel as CentralLogLevel } from '../../Components/utils/logger';
import { LogLevel, type LogContext } from '../../types';

// Re-export for backward compatibility
export { LogLevel, type LogContext } from '../../types';

/**
 * Service logger class that wraps the centralized logger
 * Adapts service-specific context format to the centralized logger
 */
class Logger {
    private centralLogger = createLogger({ component: 'Services' });

    private formatMessage(context: LogContext, message: string): string {
        const prefix = `[${context.service}${context.method ? `::${context.method}` : ''}]`;
        return `${prefix} ${message}`;
    }

    debug(context: LogContext, message: string, data?: unknown): void {
        this.centralLogger.debug(this.formatMessage(context, message), data);
    }

    info(context: LogContext, message: string, data?: unknown): void {
        this.centralLogger.info(this.formatMessage(context, message), data);
    }

    warn(context: LogContext, message: string, data?: unknown): void {
        this.centralLogger.warn(this.formatMessage(context, message), data);
    }

    error(context: LogContext, message: string, error?: unknown): void {
        this.centralLogger.error(this.formatMessage(context, message), error);
    }
}

export const logger = new Logger();
