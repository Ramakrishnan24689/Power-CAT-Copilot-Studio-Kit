import { logger } from './logger';
import type { LogContext } from '../../types';

/**
 * Base service class providing common functionality:
 * - Structured error handling
 * - Consistent logging
 * - WebAPI access
 */
export abstract class BaseService {
    protected readonly webAPI: ComponentFramework.WebApi;
    protected serviceName = 'BaseService';

    constructor(webAPI: ComponentFramework.WebApi) {
        this.webAPI = webAPI;
    }

    /**
     * Creates a log context for this service
     */
    protected getLogContext(method?: string): LogContext {
        return {
            service: this.serviceName,
            method
        };
    }

    /**
     * Wraps async operations with error handling and logging
     */
    protected async executeWithErrorHandling<T>(
        method: string,
        operation: () => Promise<T>,
        errorMessage: string
    ): Promise<T> {
        const context = this.getLogContext(method);
        
        try {
            logger.debug(context, 'Starting operation');
            const result = await operation();
            logger.debug(context, 'Operation completed successfully');
            return result;
        } catch (error) {
            // Improved error logging with better serialization
            const errorDetails = this.serializeError(error);
            logger.error(context, errorMessage, errorDetails);
            
            const errorMsg = error instanceof Error ? error.message : 
                typeof error === 'string' ? error : 
                this.safeStringify(error);
            
            throw new Error(`${this.serviceName}.${method}: ${errorMessage} - ${errorMsg}`);
        }
    }

    /**
     * Safely serializes error objects for logging
     */
    private serializeError(error: unknown): Record<string, unknown> {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        }
        
        if (typeof error === 'object' && error !== null) {
            try {
                // Try to extract common error properties from Dataverse errors
                const errorObj = error as Record<string, unknown>;
                return {
                    message: errorObj.message,
                    code: errorObj.code,
                    status: errorObj.status,
                    statusText: errorObj.statusText,
                    raw: this.safeStringify(error)
                };
            } catch {
                return { raw: typeof error === 'object' ? '[object Object]' : String(error) };
            }
        }
        
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        return { raw: typeof error === 'object' ? '[object Object]' : String(error) };
    }

    /**
     * Safely stringify objects, avoiding circular references
     */
    private safeStringify(obj: unknown): string {
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            // Fallback for circular references or non-serializable objects
            return String(obj);
        }
    }

    /**
     * Safely retrieves a value with fallback
     */
    protected getSafe<T>(value: T | undefined | null, fallback: T): T {
        return value ?? fallback;
    }
}
