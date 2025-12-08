import { DataverseService } from '../core/DataverseService';
import type { ReviewResult, AgentReviewRecord } from '../../types';
import type { ExtendedPCFContext } from '../../Components/context';
import { DataverseEntities, AgentReviewFields, ReviewStatus, buildQuery, OrderDirection } from '../../config';

/**
 * Service for managing Agent Review records in Dataverse
 * Handles CRUD operations for cat_agentreviews table and file uploads to cat_agentreviewses
 */
export class ReviewService extends DataverseService {
    protected serviceName = 'ReviewService';

    /**
     * Validate that the agent reviews entity exists in the current environment
     * and has the required file fields
     */
    async validateEntityExists(context?: ExtendedPCFContext): Promise<{ exists: boolean; error?: string }> {
        try {
            // Get client URL from PCF context if available, otherwise fallback to window.location
            const clientUrl = context?.page?.getClientUrl?.() ??
                (typeof window !== 'undefined' && window.location
                    ? `${window.location.protocol}//${window.location.host}`
                    : '');

            if (!clientUrl) {
                const error = 'Unable to determine client URL for validation';
                console.warn(`[ReviewService] ⚠️ ${error}`);
                return { exists: false, error };
            }

            // Check if entity exists by trying to query it directly (metadata endpoint not supported in this environment)
            const testUrl = `${clientUrl}/api/data/v9.2/${DataverseEntities.AgentReviewsFileUpload}?$top=1`;
            console.log(`[ReviewService] 🔍 Testing entity existence: ${testUrl}`);

            const response = await fetch(testUrl, {
                method: 'GET',
                headers: {
                    'OData-Version': '4.0',
                    'OData-MaxVersion': '4.0',
                    'Accept': 'application/json',
                },
            });

            if (response.status === 404) {
                const error = `Entity '${DataverseEntities.AgentReviews}' not found in this environment. Please ensure the Agent Review Tool solution is properly installed.`;
                console.error(`[ReviewService] ❌ ${error}`);
                return { exists: false, error };
            }

            if (!response.ok) {
                const error = `Unable to validate entity existence: HTTP ${response.status} - ${response.statusText}`;
                console.warn(`[ReviewService] ⚠️ ${error}`);
                return { exists: false, error };
            }

            // Entity exists - skip field validation since metadata endpoint is not supported
            console.log(`[ReviewService] ✅ Entity '${DataverseEntities.AgentReviews}' exists in environment`);
            return { exists: true };
        } catch (error) {
            const errorMsg = `Entity validation failed: ${error instanceof Error ? error.message : String(error)}`;
            console.error('[ReviewService] ❌', errorMsg);
            return { exists: false, error: errorMsg };
        }
    }

    /**
     * Retrieve all completed reviews
     * Note: Review result JSON is stored as a file. Use downloadReviewResultFile() to load full data.
     */
    async getAllReviews(reviewStatus?: number): Promise<AgentReviewRecord[]> {
        console.log(`[ReviewService] 🔍 getAllReviews called with status: ${reviewStatus}`);
        console.log(`[ReviewService] 📋 Using entity: ${DataverseEntities.AgentReviews}`);

        const selectFields = [
            AgentReviewFields.Id,
            AgentReviewFields.Name,
            AgentReviewFields.BotId,
            AgentReviewFields.BotName,
            AgentReviewFields.ComponentIdUnique,
            AgentReviewFields.OverallScore,
            AgentReviewFields.PatternScore,
            AgentReviewFields.InstructionScore,
            AgentReviewFields.TotalPatterns,
            AgentReviewFields.PassedPatterns,
            AgentReviewFields.FailedPatterns,
            AgentReviewFields.TotalIssues,
            AgentReviewFields.HighSeverityIssues,
            // Note: Intentionally NOT selecting ReviewResultFile to avoid large payload
            // Use downloadReviewResultFile() separately when full review data needed
            AgentReviewFields.ReviewDate,
            AgentReviewFields.ReviewStatus,
        ];

        const query = buildQuery({
            select: selectFields,
            filter: reviewStatus !== undefined ? `${AgentReviewFields.ReviewStatus} eq ${reviewStatus}` : undefined,
            orderBy: { field: AgentReviewFields.ReviewDate, direction: OrderDirection.Descending },
        });

        console.log(`[ReviewService] 🌐 Generated query: ${query}`);
        console.log(`[ReviewService] 📑 Selected fields:`, selectFields);

        try {
            const result = await this.retrieveMultiple<AgentReviewRecord>(DataverseEntities.AgentReviews, query);
            console.log(`[ReviewService] ✅ Retrieved ${result.length} reviews`);
            return result;
        } catch (error) {
            console.error(`[ReviewService] ❌ getAllReviews failed:`, error);
            throw error;
        }
    }

    /**
     * Create a review map indexed by componentIdUnique for quick lookup
     */
    createReviewMap(reviews: AgentReviewRecord[]): Map<string, AgentReviewRecord> {
        return new Map(reviews.map(review => [review.cat_componentidunique, review]));
    }

    /**
     * Save a new review record to Dataverse
     */
    async saveReview(
        reviewResult: ReviewResult,
        componentIdUnique: string,
        context?: ExtendedPCFContext
    ): Promise<string> {
        // Validate entity exists before attempting save
        const validation = await this.validateEntityExists(context);
        if (!validation.exists) {
            throw new Error(validation.error ?? `The '${DataverseEntities.AgentReviews}' entity does not exist in this environment. Please ensure the solution is properly installed.`);
        }
        const patternScore = this.calculatePatternScore(reviewResult);
        const instructionScore = this.calculateInstructionScore(reviewResult);
        const totalPatterns = reviewResult.patternEvaluation?.Patterns?.length ?? 0;
        const passedPatterns = reviewResult.patternEvaluation?.Patterns?.filter(p => p.Status === true).length ?? 0;
        const failedPatterns = totalPatterns - passedPatterns;
        const totalIssues = failedPatterns + (reviewResult.instructionEvaluation?.issues?.length ?? 0);
        const highSeverityIssues = this.countHighSeverityIssues(reviewResult);

        const reviewName = `${reviewResult.botName} - ${new Date(reviewResult.timestamp).toLocaleDateString()}`;

        const recordData = {
            [AgentReviewFields.Name]: reviewName,
            [AgentReviewFields.BotId]: reviewResult.botId,
            [AgentReviewFields.BotName]: reviewResult.botName,
            [AgentReviewFields.ComponentIdUnique]: componentIdUnique,
            [AgentReviewFields.OverallScore]: Math.round(reviewResult.overallScore),
            [AgentReviewFields.PatternScore]: patternScore,
            [AgentReviewFields.InstructionScore]: instructionScore,
            [AgentReviewFields.TotalPatterns]: totalPatterns,
            [AgentReviewFields.PassedPatterns]: passedPatterns,
            [AgentReviewFields.FailedPatterns]: failedPatterns,
            [AgentReviewFields.TotalIssues]: totalIssues,
            [AgentReviewFields.HighSeverityIssues]: highSeverityIssues,
            [AgentReviewFields.ReviewDate]: new Date(reviewResult.timestamp).toISOString(),
        };

        console.log('[ReviewService] 📥 Creating new review record');
        const recordId = await this.createRecord(DataverseEntities.AgentReviews, recordData);
        console.log(`[ReviewService] ✅ Record created: ${recordId}`);

        // Upload review JSON as file
        try {
            console.log('[ReviewService] 📤 Uploading review result file...');
            await this.uploadReviewResultFile(recordId, reviewResult, context);
            console.log('[ReviewService] ✅ Review result file uploaded');
        } catch (fileError) {
            console.error('[ReviewService] ❌ Review result file upload failed:', fileError);
            throw new Error(`Failed to save review: ${fileError instanceof Error ? fileError.message : String(fileError)}`);
        }

        // Upload PDF file if available
        if (reviewResult.pdfBase64 && reviewResult.pdfFileName) {
            try {
                console.log('[ReviewService] 📤 Uploading PDF file...');
                await this.uploadPdfFile(recordId, reviewResult.pdfBase64, reviewResult.pdfFileName, context);
                console.log('[ReviewService] ✅ PDF file uploaded');
            } catch (pdfError) {
                console.error('[ReviewService] ⚠️ PDF file upload failed:', pdfError);
                // Continue - PDF upload failure shouldn't fail the entire save
            }
        }

        return recordId;
    }

    /**
     * Update an existing review record
     */
    async updateReview(
        reviewId: string,
        reviewResult: ReviewResult,
        componentIdUnique: string,
        context?: ExtendedPCFContext
    ): Promise<void> {
        const patternScore = this.calculatePatternScore(reviewResult);
        const instructionScore = this.calculateInstructionScore(reviewResult);
        const totalPatterns = reviewResult.patternEvaluation?.Patterns?.length ?? 0;
        const passedPatterns = reviewResult.patternEvaluation?.Patterns?.filter(p => p.Status === true).length ?? 0;
        const failedPatterns = totalPatterns - passedPatterns;
        const totalIssues = failedPatterns + (reviewResult.instructionEvaluation?.issues?.length ?? 0);
        const highSeverityIssues = this.countHighSeverityIssues(reviewResult);

        const reviewName = `${reviewResult.botName} - ${new Date(reviewResult.timestamp).toLocaleDateString()}`;

        const recordData = {
            [AgentReviewFields.Name]: reviewName,
            [AgentReviewFields.OverallScore]: Math.round(reviewResult.overallScore),
            [AgentReviewFields.PatternScore]: patternScore,
            [AgentReviewFields.InstructionScore]: instructionScore,
            [AgentReviewFields.TotalPatterns]: totalPatterns,
            [AgentReviewFields.PassedPatterns]: passedPatterns,
            [AgentReviewFields.FailedPatterns]: failedPatterns,
            [AgentReviewFields.TotalIssues]: totalIssues,
            [AgentReviewFields.HighSeverityIssues]: highSeverityIssues,
            [AgentReviewFields.ReviewDate]: new Date(reviewResult.timestamp).toISOString(),
        };

        console.log(`[ReviewService] 📝 Updating review record: ${reviewId}`);
        await this.updateRecord(DataverseEntities.AgentReviews, reviewId, recordData);
        console.log('[ReviewService] ✅ Record updated');

        // Upload updated review JSON as file (bypasses 1MB text limit)
        try {
            console.log('[ReviewService] 📤 Uploading updated review result file...');
            await this.uploadReviewResultFile(reviewId, reviewResult, context);
            console.log('[ReviewService] ✅ Review result file updated');
        } catch (fileError) { console.error('[ReviewService] ❌ Review result file update failed:', fileError); throw new Error(`Failed to update review file: ${fileError instanceof Error ? fileError.message : String(fileError)}`); }

        // Upload PDF file if available
        if (reviewResult.pdfBase64 && reviewResult.pdfFileName) {
            try {
                console.log('[ReviewService] 📤 Uploading updated PDF file...');
                await this.uploadPdfFile(reviewId, reviewResult.pdfBase64, reviewResult.pdfFileName, context);
                console.log('[ReviewService] ✅ PDF file updated');
            } catch (pdfError) {
                console.error('[ReviewService] ⚠️ PDF file update failed:', pdfError);
                // Continue - PDF upload failure shouldn't fail the entire update
            }
        }
    }

    // Private helper methods

    private calculatePatternScore(reviewResult: ReviewResult): number {
        if (!reviewResult.patternEvaluation?.Patterns || reviewResult.patternEvaluation.Patterns.length === 0) {
            return 0;
        }

        const totalPatterns = reviewResult.patternEvaluation.Patterns.length;
        const passedPatterns = reviewResult.patternEvaluation.Patterns.filter(p => p.Status === true).length;

        return Math.round((passedPatterns / totalPatterns) * 100);
    }

    private calculateInstructionScore(reviewResult: ReviewResult): number {
        if (!reviewResult.instructionEvaluation) {
            return 0;
        }

        return Math.round(reviewResult.instructionEvaluation.compliancePercentage);
    }

    private countHighSeverityIssues(reviewResult: ReviewResult): number {
        if (!reviewResult.instructionEvaluation?.issues && !reviewResult.patternEvaluation?.Patterns) {
            return 0;
        }

        // Count instruction evaluation issues with high severity
        const instructionHighSeverityFailures = reviewResult.instructionEvaluation?.issues
            ?.filter(issue => issue.severity?.toLowerCase() === 'high').length ?? 0;

        // Count failed patterns with high severity
        const patternHighSeverityFailures = reviewResult.patternEvaluation?.Patterns
            ?.filter(p => {
                if (p.Status) return false; // Skip passed patterns
                const topicCount = p.Topics.length;
                const patternName = p.PatternName.toLowerCase();
                // High severity: test patterns or missing patterns affecting many topics
                return patternName.includes('test') || (patternName.includes('missing') && topicCount > 5);
            }).length ?? 0;

        return instructionHighSeverityFailures + patternHighSeverityFailures;
    }

    /**
     * Upload PDF file to Dataverse review record using proper file upload API
     */
    private async uploadPdfFile(reviewId: string, pdfBase64: string, pdfFileName: string, context?: ExtendedPCFContext): Promise<void> {
        try {
            console.log(`[ReviewService] 📤 Uploading PDF: ${pdfFileName}`);
            console.log(`[ReviewService] 🔍 Using record ID for PDF: ${reviewId}`);

            // Convert base64 to blob with proper UTF-8 handling
            const binaryString = this.decodeBase64ToBinary(pdfBase64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            const pdfBlob = new Blob([bytes], { type: 'application/pdf' });

            // Check PDF size
            const sizeKB = pdfBlob.size / 1024;
            console.log(`[ReviewService] PDF size: ${sizeKB.toFixed(2)} KB`);

            if (sizeKB > 10240) { // 10MB limit
                console.warn(`[ReviewService] ⚠️ PDF too large (${sizeKB.toFixed(2)} KB), skipping upload`);
                return;
            }

            // Get client URL from PCF context if available, otherwise fallback to window.location
            const clientUrl = context?.page?.getClientUrl?.() ??
                (typeof window !== 'undefined' && window.location
                    ? `${window.location.protocol}//${window.location.host}`
                    : '');

            if (!clientUrl) {
                throw new Error('Unable to determine client URL for PDF upload');
            }

            const uploadUrl = `${clientUrl}/api/data/v9.2/${DataverseEntities.AgentReviewsFileUpload}(${reviewId})/${AgentReviewFields.ReviewPdf}`;
            console.log(`[ReviewService] 🌐 PDF Upload URL: ${uploadUrl}`);

            const response = await fetch(uploadUrl, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'OData-Version': '4.0',
                    'OData-MaxVersion': '4.0',
                    'x-ms-file-name': pdfFileName,
                },
                body: pdfBlob,
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorDetails;
                try {
                    errorDetails = JSON.parse(errorText);
                } catch {
                    errorDetails = { error: { message: errorText || 'Unknown error' } };
                }

                const errorMsg = `HTTP ${response.status}: ${errorDetails.error?.message ?? 'Upload failed'}. URL: ${uploadUrl}`;
                console.error(`[ReviewService] ❌ PDF upload failed:`, {
                    status: response.status,
                    statusText: response.statusText,
                    url: uploadUrl,
                    error: errorDetails
                });
                throw new Error(errorMsg);
            }

            console.log(`[ReviewService] ✅ PDF uploaded: ${pdfFileName} (${sizeKB.toFixed(2)} KB)`);
        } catch (error) {
            console.error(`[ReviewService] ❌ PDF upload failed:`, error);
            // Don't throw - PDF upload failure shouldn't fail the entire save
        }
    }

    /**
     * Upload review result JSON as file to Dataverse using proper file upload API
     */
    private async uploadReviewResultFile(reviewId: string, reviewResult: ReviewResult, context?: ExtendedPCFContext): Promise<void> {
        const reviewResultJson = JSON.stringify(reviewResult, null, 2);
        const blob = new Blob([reviewResultJson], { type: 'application/json; charset=utf-8' });
        const fileName = `review_${reviewId.replace(/[{}()-]/g, '')}_${Date.now()}.json`;

        console.log(`[ReviewService] 📤 Uploading review JSON: ${fileName} (${(blob.size / 1024).toFixed(2)} KB)`);
        console.log(`[ReviewService] 🔍 Using record ID: ${reviewId}`);

        // Verify the record exists before attempting file upload
        try {
            const verifyRecord = await this.retrieveRecord<Record<string, string>>(
                DataverseEntities.AgentReviews,
                reviewId,
                [AgentReviewFields.Id, AgentReviewFields.Name]
            );
            console.log(`[ReviewService] ✅ Record verified for file upload: ${verifyRecord[AgentReviewFields.Name] || 'Unnamed'}`);
        } catch (verifyError) {
            console.error(`[ReviewService] ❌ Record verification failed for ID ${reviewId}:`, verifyError);
            throw new Error(`Cannot upload file - record not found or inaccessible: ${reviewId}`);
        }

        // Get client URL from PCF context if available, otherwise fallback to window.location
        const clientUrl = context?.page?.getClientUrl?.() ??
            (typeof window !== 'undefined' && window.location
                ? `${window.location.protocol}//${window.location.host}`
                : '');

        if (!clientUrl) {
            throw new Error('Unable to determine client URL for file upload');
        }

        // Use the standard Dataverse Web API pattern
        const uploadUrl = `${clientUrl}/api/data/v9.2/${DataverseEntities.AgentReviewsFileUpload}(${reviewId})/${AgentReviewFields.ReviewResultFile}`;
        console.log(`[ReviewService] 🌐 JSON Upload URL: ${uploadUrl}`);

        const response = await fetch(uploadUrl, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/octet-stream',
                'OData-Version': '4.0',
                'OData-MaxVersion': '4.0',
                'x-ms-file-name': fileName,
            },
            body: blob,
        });

        if (!response.ok) {
            const errorText = await response.text();
            let errorDetails;
            try {
                errorDetails = JSON.parse(errorText);
            } catch {
                errorDetails = { error: { message: errorText || 'Unknown error' } };
            }

            console.error(`[ReviewService] ❌ File upload failed:`, {
                recordId: reviewId,
                status: response.status,
                statusText: response.statusText,
                url: uploadUrl,
                error: errorDetails,
                fileName: fileName,
                fileSize: blob.size
            });

            throw new Error(`Failed to upload review result file: ${errorDetails.error?.message ?? 'Upload failed'}`);
        }

        console.log(`[ReviewService] ✅ Review result file uploaded: ${fileName} (${(blob.size / 1024).toFixed(2)} KB)`);
    }

    /**
     * Download and parse review result JSON from file column
     */
    async downloadReviewResultFile(reviewId: string, context?: ExtendedPCFContext): Promise<ReviewResult | null> {
        try {
            // Get client URL from PCF context if available, otherwise fallback to window.location
            const clientUrl = context?.page?.getClientUrl?.() ??
                (typeof window !== 'undefined' && window.location
                    ? `${window.location.protocol}//${window.location.host}`
                    : '');

            if (!clientUrl) {
                throw new Error('Unable to determine client URL for file download');
            }

            // Try downloading the file directly first
            const downloadUrl = `${clientUrl}/api/data/v9.2/${DataverseEntities.AgentReviewsFileUpload}(${reviewId})/${AgentReviewFields.ReviewResultFile}`;
            console.log(`[ReviewService] 📥 Download URL: ${downloadUrl}`);

            const response = await fetch(downloadUrl, {
                method: 'GET',
                headers: {
                    'OData-Version': '4.0',
                    'OData-MaxVersion': '4.0',
                    'Accept': 'application/json',
                },
            });

            if (!response.ok) {
                if (response.status === 404) {
                    console.log(`[ReviewService] No file found for review ${reviewId}`);
                    return null;
                }
                throw new Error(`Failed to download review file: HTTP ${response.status}`);
            }

            // Parse the OData response first to get the structure
            const odataResponse = await response.json();
            console.log(`[ReviewService] 📋 OData response keys:`, Object.keys(odataResponse));

            // Extract the base64-encoded value from OData response
            const base64Content = odataResponse.value;

            if (!base64Content) {
                console.error(`[ReviewService] ❌ No 'value' field in OData response:`, odataResponse);
                throw new Error('No file content found in OData response');
            }

            // Decode from base64 and parse as ReviewResult JSON with proper UTF-8 handling
            const decodedContent = this.decodeBase64ToUTF8(base64Content);
            const reviewResult: ReviewResult = JSON.parse(decodedContent);
            console.log(`[ReviewService] 📄 Successfully decoded base64 content for ${reviewId}`);

            console.log(`[ReviewService] ✅ Downloaded review JSON file for ${reviewId}`);
            return reviewResult;
        } catch (error) {
            console.error('[ReviewService] ❌ Failed to download review file:', error);
            return null;
        }
    }

    /**
     * Convert Blob to base64 string
     */
    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                if (typeof reader.result === 'string') {
                    // Remove data URL prefix (e.g., "data:application/json;base64,")
                    const base64 = reader.result.split(',')[1];
                    resolve(base64);
                } else {
                    reject(new Error('FileReader result is not a string'));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    /**
     * Properly decode base64 to UTF-8 string
     * Handles non-ASCII characters correctly unlike plain atob()
     */
    private decodeBase64ToUTF8(base64: string): string {
        try {
            // First decode base64 to binary string
            const binaryString = atob(base64);
            
            // Convert binary string to Uint8Array
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Decode UTF-8 bytes to string using TextDecoder
            const decoder = new TextDecoder('utf-8');
            return decoder.decode(bytes);
        } catch (error) {
            console.error('[ReviewService] ⚠️ UTF-8 decode failed, falling back to atob:', error);
            // Fallback to simple atob if TextDecoder fails
            return atob(base64);
        }
    }

    /**
     * Decode base64 to binary string (for non-text content like PDFs)
     */
    private decodeBase64ToBinary(base64: string): string {
        return atob(base64);
    }

    /**
     * Properly encode UTF-8 string to base64
     * Handles non-ASCII characters correctly unlike plain btoa()
     */
    private encodeUTF8ToBase64(text: string): string {
        try {
            // Encode string to UTF-8 bytes using TextEncoder
            const encoder = new TextEncoder();
            const utf8Bytes = encoder.encode(text);
            
            // Convert bytes to binary string
            let binaryString = '';
            for (let i = 0; i < utf8Bytes.length; i++) {
                binaryString += String.fromCharCode(utf8Bytes[i]);
            }
            
            // Encode binary string to base64
            return btoa(binaryString);
        } catch (error) {
            console.error('[ReviewService] ⚠️ UTF-8 encode failed, falling back to btoa:', error);
            // Fallback to simple btoa if TextEncoder fails
            return btoa(text);
        }
    }
}
