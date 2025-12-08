import { DataverseService } from '../core/DataverseService';
import { DataverseEntities, FREFields, StorageKeys } from '../../config';

/**
 * Service for managing First Run Experience tracking in Dataverse
 * Handles cat_agentreviewfre table operations
 */
export class FREService extends DataverseService {
    protected serviceName = 'FREService';

    /**
     * Get current user's GUID using WhoAmI Web API
     * This is more reliable than using PCF context userId which might be null or in unexpected format
     */
    private async getCurrentUserGuid(): Promise<string | null> {
        try {
            console.log('[FREService] 🔍 Calling WhoAmI to get current user GUID');
            
            // Get client URL for API call
            const clientUrl = typeof window !== 'undefined' && window.location
                ? `${window.location.protocol}//${window.location.host}`
                : '';
            
            if (!clientUrl) {
                console.warn('[FREService] ⚠️ Unable to determine client URL for WhoAmI');
                return null;
            }
            
            // Call WhoAmI function
            const response = await fetch(`${clientUrl}/api/data/v9.2/WhoAmI`, {
                method: 'GET',
                headers: {
                    'OData-Version': '4.0',
                    'OData-MaxVersion': '4.0',
                    'Accept': 'application/json',
                },
            });
            
            if (!response.ok) {
                console.error('[FREService] ❌ WhoAmI request failed:', response.status, response.statusText);
                return null;
            }
            
            const data = await response.json();
            const userId = data?.UserId;
            
            if (userId) {
                console.log('[FREService] ✅ Got user GUID from WhoAmI:', userId);
                return this.normalizeUserId(userId);
            }
            
            console.warn('[FREService] ⚠️ WhoAmI did not return UserId');
            return null;
        } catch (error) {
            console.error('[FREService] ❌ Failed to get user GUID from WhoAmI:', error);
            return null;
        }
    }

    /**
     * Normalize userId to ensure it's a valid GUID format for Dataverse queries
     * Removes curly braces and converts to lowercase
     * Returns empty string if userId is null/undefined
     */
    private normalizeUserId(userId: string | null | undefined): string {
        if (!userId) {
            return '';
        }
        return userId.replace(/[{}]/g, '').toLowerCase();
    }

    /**
     * Check if user has completed FRE (checks localStorage first, then Dataverse)
     * Gracefully falls back to localStorage if Dataverse fails
     * Note: userId parameter is deprecated, method now uses WhoAmI to get current user
     */
    async hasCompletedFRE(userId?: string): Promise<boolean> {
        // Check localStorage first (fast path)
        const localState = this.getLocalState();
        if (localState.tourCompleted) {
            console.log('[FREService] ✅ FRE completed (from localStorage)');
            return true;
        }

        // Get current user GUID from WhoAmI
        const normalizedUserId = await this.getCurrentUserGuid();
        if (!normalizedUserId) {
            console.warn('[FREService] ⚠️ Could not get user GUID, using localStorage only');
            return localState.tourCompleted;
        }

        // Check Dataverse (best effort) - use createdby field for user tracking
        try {
            console.log('[FREService] 🔍 Checking FRE status in Dataverse using createdby for user:', normalizedUserId);
            
            const fetchXml = `
                <fetch top="1">
                    <entity name="${DataverseEntities.AgentReviewFRE}">
                        <attribute name="${FREFields.Completed}" />
                        <filter>
                            <condition attribute="createdby" operator="eq" value="${normalizedUserId}" />
                            <condition attribute="${FREFields.Completed}" operator="eq" value="true" />
                        </filter>
                    </entity>
                </fetch>
            `.trim();

            const records = await this.fetchXml<{ [FREFields.Completed]: boolean }>(
                DataverseEntities.AgentReviewFRE,
                fetchXml
            );

            const completed = records.length > 0;

            // Sync to localStorage for future checks
            if (completed) {
                this.saveLocalState({ tourCompleted: true });
                console.log('[FREService] ✅ FRE completed (from Dataverse createdby, synced to localStorage)');
            } else {
                console.log('[FREService] 📝 No FRE completion found for current user (by createdby)');
            }

            return completed;
        } catch (error) {
            console.error('[FREService] ⚠️ Failed to check FRE status in Dataverse, falling back to localStorage:', error);
            // Return localStorage state as fallback
            return localState.tourCompleted;
        }
    }

    /**
     * Mark FRE as completed for user
     * localStorage is saved FIRST to guarantee it happens even if Dataverse fails
     * Note: userId parameter is deprecated, method now uses WhoAmI to get current user
     */
    async completeFRE(userId?: string): Promise<void> {
        // Save to localStorage FIRST - this must succeed regardless of Dataverse availability
        this.saveLocalState({ tourCompleted: true });
        console.log('[FREService] ✅ Saved FRE completion to localStorage');

        // Get current user GUID from WhoAmI
        const normalizedUserId = await this.getCurrentUserGuid();
        if (!normalizedUserId) {
            console.warn('[FREService] ⚠️ Could not get user GUID, localStorage-only mode');
            return;
        }

        // Then attempt Dataverse sync (best effort)
        try {
            console.log('[FREService] 🔄 Attempting to sync FRE completion to Dataverse for user:', normalizedUserId);
            
            // Check if record exists
            const fetchXml = `
                <fetch top="1">
                    <entity name="${DataverseEntities.AgentReviewFRE}">
                        <attribute name="${FREFields.Id}" />
                        <filter>
                            <condition attribute="${FREFields.User}" operator="eq" value="${normalizedUserId}" />
                        </filter>
                    </entity>
                </fetch>
            `.trim();

            const records = await this.fetchXml<{ [FREFields.Id]: string }>(
                DataverseEntities.AgentReviewFRE,
                fetchXml
            );

            if (records.length > 0) {
                // Update existing record
                await this.updateRecord(DataverseEntities.AgentReviewFRE, records[0][FREFields.Id], {
                    [FREFields.Completed]: true,
                    [FREFields.CompletedOn]: new Date().toISOString()
                });
                console.log('[FREService] ✅ Updated FRE completion in Dataverse');
            } else {
                // Create new record - user tracking automatic via createdby field
                try {
                    await this.createRecord(DataverseEntities.AgentReviewFRE, {
                        [FREFields.Completed]: true,
                        [FREFields.CompletedOn]: new Date().toISOString()
                    });
                    console.log('[FREService] ✅ Created FRE completion record (user tracked via createdby)');
                } catch (createError) {
                    console.error('[FREService] ❌ Failed to create FRE record:', createError);
                    // Don't throw - localStorage already saved, this is best-effort
                }
            }
        } catch (error) {
            // Log error but don't fail - localStorage already saved
            console.error('[FREService] ⚠️ Failed to sync FRE to Dataverse (localStorage already saved):', error);
        }
    }

    /**
     * Reset FRE for user (for testing purposes)
     * localStorage is cleared FIRST to guarantee it happens even if Dataverse fails
     * Note: userId parameter is deprecated, method now uses WhoAmI to get current user
     */
    async resetFRE(userId?: string): Promise<void> {
        // Clear localStorage FIRST - this must succeed regardless of Dataverse availability
        this.saveLocalState({ tourCompleted: false });
        console.log('[FREService] ✅ Cleared FRE state from localStorage');

        // Get current user GUID from WhoAmI
        const normalizedUserId = await this.getCurrentUserGuid();
        if (!normalizedUserId) {
            console.warn('[FREService] ⚠️ Could not get user GUID, localStorage-only mode');
            return;
        }

        // Then attempt Dataverse deletion (best effort) - user-specific cleanup via createdby
        try {
            console.log('[FREService] 🔄 Attempting to delete FRE records created by current user:', normalizedUserId);
            
            const fetchXml = `
                <fetch>
                    <entity name="${DataverseEntities.AgentReviewFRE}">
                        <attribute name="${FREFields.Id}" />
                        <filter>
                            <condition attribute="createdby" operator="eq" value="${normalizedUserId}" />
                        </filter>
                    </entity>
                </fetch>
            `.trim();

            const records = await this.fetchXml<{ [FREFields.Id]: string }>(
                DataverseEntities.AgentReviewFRE,
                fetchXml
            );

            for (const record of records) {
                await this.deleteRecord(DataverseEntities.AgentReviewFRE, record[FREFields.Id]);
            }
            
            if (records.length > 0) {
                console.log(`[FREService] ✅ Deleted ${records.length} FRE record(s) created by current user`);
            } else {
                console.log('[FREService] ℹ️ No FRE records found for current user (by createdby)');
            }
        } catch (error) {
            // Log error but don't fail - localStorage already cleared
            console.error('[FREService] ⚠️ Failed to delete FRE from Dataverse (localStorage already cleared):', error);
        }
    }

    // LocalStorage helper methods

    private getLocalState(): { tourCompleted: boolean } {
        try {
            const stored = localStorage.getItem(StorageKeys.FirstRunExperience);
            return stored ? JSON.parse(stored) as { tourCompleted: boolean } : { tourCompleted: false };
        } catch {
            return { tourCompleted: false };
        }
    }

    private saveLocalState(state: { tourCompleted: boolean }): void {
        try {
            localStorage.setItem(StorageKeys.FirstRunExperience, JSON.stringify(state));
        } catch (error) {
            // Silently fail if localStorage is unavailable
        }
    }
}
