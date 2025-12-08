import { DataverseService } from '../core/DataverseService';
import type { BotDetail, SampleBotDetails, BotComponent } from '../../types';
import { DataverseEntities, BotFields, BotComponentFields } from '../../config';

/**
 * Service for managing Bot entities in Dataverse
 * Consolidates all bot-related operations
 */
export class BotService extends DataverseService {
    protected serviceName = 'BotService';

    /**
     * Retrieve all bots with optional filtering
     */
    async getAllBots(queryString?: string): Promise<SampleBotDetails> {
        const clientUrl = typeof window !== 'undefined' && window.location
            ? `${window.location.protocol}//${window.location.host}`
            : '';

        const entities = await this.retrieveMultiple<BotDetail>(
            DataverseEntities.Bot,
            queryString
        );

        return {
            '@odata.context': `${clientUrl}/api/data/v9.2/$metadata#bots`,
            value: entities.map(entity => ({
                ...entity,
                // Ensure all required fields have fallback values
                name: this.getSafe(entity.name, ''),
                botid: this.getSafe(entity.botid, ''),
                componentidunique: this.getSafe(entity.componentidunique, ''),
                statecode: this.getSafe(entity.statecode, 0),
                iconbase64: this.getSafe(entity.iconbase64, ''),
                configuration: this.getSafe(entity.configuration, ''),
            } as BotDetail))
        };
    }

    /**
     * Retrieve a specific bot by ID
     */
    async getBotById(botId: string): Promise<BotDetail> {
        return this.retrieveRecord<BotDetail>(DataverseEntities.Bot, botId);
    }

    /**
     * Get total count of bots efficiently
     */
    async getTotalBotCount(): Promise<number> {
        return this.getRecordCount(DataverseEntities.Bot);
    }

    /**
     * Retrieve all components for a specific bot
     */
    async getBotComponents(botId: string): Promise<BotComponent[]> {
        try {
            // Primary attempt with current field name
            const fetchXml = `
                <fetch>
                    <entity name="${DataverseEntities.BotComponent}">
                        <attribute name="${BotComponentFields.Id}" />
                        <attribute name="${BotComponentFields.Name}" />
                        <attribute name="${BotComponentFields.ComponentType}" />
                        <attribute name="${BotComponentFields.Data}" />
                        <attribute name="${BotComponentFields.Description}" />
                        <attribute name="${BotComponentFields.Category}" />
                        <attribute name="${BotComponentFields.Language}" />
                        <attribute name="${BotComponentFields.CreatedOn}" />
                        <attribute name="${BotComponentFields.ModifiedOn}" />
                        <filter>
                            <condition attribute="${BotComponentFields.ParentBotId}" operator="eq" value="${botId}" />
                        </filter>
                    </entity>
                </fetch>
            `.trim();

            console.log(`[BotService] 📞 Fetching bot components for ${botId} using field: ${BotComponentFields.ParentBotId}`);
            return await this.fetchXml<BotComponent>(DataverseEntities.BotComponent, fetchXml);
        } catch (primaryError) {
            console.warn(`[BotService] ⚠️ Primary fetch failed with field ${BotComponentFields.ParentBotId}, trying alternative:`, primaryError);
            
            // Alternative attempt with lookup field name
            try {
                const fallbackFetchXml = `
                    <fetch>
                        <entity name="${DataverseEntities.BotComponent}">
                            <attribute name="${BotComponentFields.Id}" />
                            <attribute name="${BotComponentFields.Name}" />
                            <attribute name="${BotComponentFields.ComponentType}" />
                            <attribute name="${BotComponentFields.Data}" />
                            <attribute name="${BotComponentFields.Description}" />
                            <attribute name="${BotComponentFields.Category}" />
                            <attribute name="${BotComponentFields.Language}" />
                            <attribute name="${BotComponentFields.CreatedOn}" />
                            <attribute name="${BotComponentFields.ModifiedOn}" />
                            <filter>
                                <condition attribute="_parentbotid_value" operator="eq" value="${botId}" />
                            </filter>
                        </entity>
                    </fetch>
                `.trim();

                console.log(`[BotService] 🔄 Trying fallback with _parentbotid_value`);
                return await this.fetchXml<BotComponent>(DataverseEntities.BotComponent, fallbackFetchXml);
            } catch (fallbackError) {
                console.error(`[BotService] ❌ Both field attempts failed:`, { primaryError, fallbackError });
                throw new Error(`Failed to fetch bot components: ${primaryError instanceof Error ? primaryError.message : String(primaryError)}`);
            }
        }
    }

    /**
     * Get count of components for a bot (quick check for parsing strategy)
     */
    async getBotComponentCount(botId: string): Promise<number> {
        try {
            // Primary attempt with current field name
            const fetchXml = `
                <fetch top="1" aggregate="true">
                    <entity name="${DataverseEntities.BotComponent}">
                        <attribute name="${BotComponentFields.Id}" alias="count" aggregate="count" />
                        <filter>
                            <condition attribute="${BotComponentFields.ParentBotId}" operator="eq" value="${botId}" />
                        </filter>
                    </entity>
                </fetch>
            `.trim();

            console.log(`[BotService] 📊 Counting bot components for ${botId} using field: ${BotComponentFields.ParentBotId}`);
            const result = await this.fetchXml<{ count: number }>(DataverseEntities.BotComponent, fetchXml);
            return result[0]?.count ?? 0;
        } catch (primaryError) {
            console.warn(`[BotService] ⚠️ Primary count failed with field ${BotComponentFields.ParentBotId}, trying alternative:`, primaryError);
            
            // Alternative attempt with lookup field name
            try {
                const fallbackFetchXml = `
                    <fetch top="1" aggregate="true">
                        <entity name="${DataverseEntities.BotComponent}">
                            <attribute name="${BotComponentFields.Id}" alias="count" aggregate="count" />
                            <filter>
                                <condition attribute="_parentbotid_value" operator="eq" value="${botId}" />
                            </filter>
                        </entity>
                    </fetch>
                `.trim();

                console.log(`[BotService] 🔄 Trying fallback count with _parentbotid_value`);
                const result = await this.fetchXml<{ count: number }>(DataverseEntities.BotComponent, fallbackFetchXml);
                return result[0]?.count ?? 0;
            } catch (fallbackError) {
                console.error(`[BotService] ❌ Both count attempts failed:`, { primaryError, fallbackError });
                // Return 0 to fallback to AI parsing
                return 0;
            }
        }
    }
}
