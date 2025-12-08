import { BaseService } from './BaseService';
import { logger } from './logger';

/**
 * Unified wrapper around PCF WebAPI for Dataverse operations
 * Provides:
 * - Consistent error handling
 * - Logging for all operations  
 * - Pagination support
 * - Type-safe CRUD operations
 */
export class DataverseService extends BaseService {
    protected serviceName = 'DataverseService';

    /**
     * Retrieve multiple records with automatic pagination
     */
    async retrieveMultiple<T = ComponentFramework.WebApi.Entity>(
        entityName: string,
        queryString?: string,
        maxPages = 100
    ): Promise<T[]> {
        return this.executeWithErrorHandling(
            'retrieveMultiple',
            async () => {
                const allEntities: ComponentFramework.WebApi.Entity[] = [];
                let currentQuery = queryString ?? '';
                let pageCount = 0;

                const context = this.getLogContext('retrieveMultiple');
                logger.info(context, `Fetching ${entityName} records`, { query: queryString });

                do {
                    pageCount++;
                    
                    const response = await this.webAPI.retrieveMultipleRecords(
                        entityName,
                        currentQuery
                    );

                    logger.debug(context, `Page ${pageCount}`, {
                        count: response.entities.length,
                        hasNext: !!response.nextLink
                    });

                    allEntities.push(...response.entities);

                    if (response.nextLink) {
                        const nextUrl = new URL(response.nextLink);
                        currentQuery = nextUrl.search;
                    } else {
                        break;
                    }

                    if (pageCount >= maxPages) {
                        logger.warn(context, `Reached max pages limit: ${maxPages}`);
                        break;
                    }
                } while (currentQuery);

                logger.info(context, `Retrieved ${allEntities.length} ${entityName} records`);
                return allEntities as T[];
            },
            `Failed to retrieve ${entityName} records`
        );
    }

    /**
     * Retrieve a single record by ID
     */
    async retrieveRecord<T = ComponentFramework.WebApi.Entity>(
        entityName: string,
        id: string,
        columns?: string[]
    ): Promise<T> {
        return this.executeWithErrorHandling(
            'retrieveRecord',
            async () => {
                const options = columns ? `?$select=${columns.join(',')}` : '';
                const result = await this.webAPI.retrieveRecord(entityName, id, options);
                return result as T;
            },
            `Failed to retrieve ${entityName} record with ID: ${id}`
        );
    }

    /**
     * Create a new record
     */
    async createRecord(
        entityName: string,
        data: ComponentFramework.WebApi.Entity
    ): Promise<string> {
        return this.executeWithErrorHandling(
            'createRecord',
            async () => {
                const context = this.getLogContext('createRecord');
                logger.debug(context, `Creating ${entityName} record`, data);
                
                const result = await this.webAPI.createRecord(entityName, data);
                
                logger.info(context, `Created ${entityName} record`, { id: result.id });
                return result.id;
            },
            `Failed to create ${entityName} record`
        );
    }

    /**
     * Update an existing record
     */
    async updateRecord(
        entityName: string,
        id: string,
        data: ComponentFramework.WebApi.Entity
    ): Promise<void> {
        return this.executeWithErrorHandling(
            'updateRecord',
            async () => {
                const context = this.getLogContext('updateRecord');
                logger.debug(context, `Updating ${entityName} record`, { id, data });
                
                await this.webAPI.updateRecord(entityName, id, data);
                
                logger.info(context, `Updated ${entityName} record`, { id });
            },
            `Failed to update ${entityName} record with ID: ${id}`
        );
    }

    /**
     * Delete a record
     */
    async deleteRecord(
        entityName: string,
        id: string
    ): Promise<void> {
        return this.executeWithErrorHandling(
            'deleteRecord',
            async () => {
                const context = this.getLogContext('deleteRecord');
                logger.info(context, `Deleting ${entityName} record`, { id });
                
                await this.webAPI.deleteRecord(entityName, id);
                
                logger.info(context, `Deleted ${entityName} record`, { id });
            },
            `Failed to delete ${entityName} record with ID: ${id}`
        );
    }

    /**
     * Execute FetchXML query
     */
    async fetchXml<T = ComponentFramework.WebApi.Entity>(
        entityName: string,
        fetchXml: string
    ): Promise<T[]> {
        return this.executeWithErrorHandling(
            'fetchXml',
            async () => {
                const query = `?fetchXml=${encodeURIComponent(fetchXml)}`;
                return this.retrieveMultiple<T>(entityName, query);
            },
            `Failed to execute FetchXML query on ${entityName}`
        );
    }

    /**
     * Get record count efficiently using $count
     */
    async getRecordCount(entityName: string, filter?: string): Promise<number> {
        return this.executeWithErrorHandling(
            'getRecordCount',
            async () => {
                const query = `?$select=${entityName}id&$top=1&$count=true${filter ? `&${filter}` : ''}`;
                
                const result = await this.webAPI.retrieveMultipleRecords(entityName, query);
                
                type CountResponse = ComponentFramework.WebApi.RetrieveMultipleResponse & {
                    '@odata.count'?: number;
                };
                
                const count = (result as unknown as CountResponse)['@odata.count'] ?? 0;
                
                logger.info(this.getLogContext('getRecordCount'), `Count for ${entityName}`, { count });
                return count;
            },
            `Failed to get record count for ${entityName}`
        );
    }
}
