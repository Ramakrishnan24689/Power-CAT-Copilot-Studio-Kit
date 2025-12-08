/**
 * Common/Shared Type Definitions
 * Types used across multiple domains
 */

/**
 * Log severity levels
 */
export enum LogLevel {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

/**
 * Logging context metadata
 */
export interface LogContext {
    service: string;
    method?: string;
    [key: string]: unknown;
}
