/**
 * AgentTestSetOperations.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides comprehensive service for managing agent test sets and test cases within the
 * Microsoft Dataverse environment. Handles retrieval, mapping, and management of test data
 * structures with support for hierarchical multiturn test scenarios.
 *
 * Exports:
 *   - AgentTestSetOperations: Main class for test set and test case operations.
 *
 * Usage:
 *   const testSetOps = new AgentTestSetOperations(context);
 *   const testSet = await testSetOps.getTestSet(testSetId);
 *   const testCases = await testSetOps.getTestCases(testSetId);
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import type { AgentTestSet, AgentTestCase, TestCaseAttachmentData } from "../shared/models/DataModels";

/**
 * Service for managing agent test set and test case operations in Microsoft Dataverse
 *
 * Provides comprehensive functionality for retrieving and managing test data structures
 * with full support for hierarchical multiturn test scenarios.
 *
 * Business Logic:
 * - Retrieves test sets with associated metadata
 * - Loads test cases with complete attribute mapping
 * - Supports parent-child test relationships for multiturn scenarios
 * - Implements optimized data loading patterns for performance
 * - Maintains referential integrity across test hierarchies
 *
 * @extends DataverseOperationBase
 */
export class AgentTestSetOperations extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "AgentTestSetOperations");
  }

  /**
   * Retrieve Agent Test Set information by unique identifier
   *
   * @param testSetId - GUID of the test set to retrieve
   * @returns Promise resolving to AgentTestSet object with id and name
   * @throws Error if test set not found or access denied
   * @public
   */
  async getTestSet(testSetId: string): Promise<AgentTestSet> {
    return this.executeOperation(async () => {
      const response = await this.context.webAPI.retrieveRecord(
        "cat_copilottestset",
        testSetId,
        "?$select=cat_name"
      );

      return {
        id: response.cat_copilottestsetid as string,
        name: response.cat_name as string,
      };
    }, "Get test set");
  }

  /**
   * Retrieve all test cases for a specified test set
   *
   * @param testSetId - GUID of the test set containing the test cases
   * @returns Promise resolving to array of AgentTestCase objects with child tests loaded
   * @throws Error if test set not found or query execution fails
   * @public
   */
  async getTestCases(testSetId: string): Promise<AgentTestCase[]> {
    return this.executeOperation(async () => {
      const fetchXml = `
        <fetch>
          <entity name="cat_copilottest">
            <attribute name="cat_name"/>
            <attribute name="cat_testutterance"/>
            <attribute name="cat_copilottestid"/>
            <attribute name="cat_expectedresponse"/>
            <attribute name="cat_testtypecode"/>
            <attribute name="cat_generativeansweroutcomecode"/>
            <attribute name="cat_expectedpositionoftheresponseactivity"/>
            <attribute name="cat_expectedtopicname"/>
            <attribute name="cat_expectedtools"/>
            <attribute name="cat_isstartconversationeventsent"/>
            <attribute name="cat_externalvariablesjson"/>
            <attribute name="cat_expectedattachmentsjson"/>
            <attribute name="cat_secondsbeforegettinganswer"/>
            <attribute name="cat_comparisonoperator"/>
            <attribute name="cat_operationtypecode"/>
            <attribute name="cat_validationinstructions"/>
            <attribute name="cat_adaptivecardpayload"/>
            <attribute name="cat_passthreshold"/>
            <attribute name="cat_parent"/>
            <attribute name="cat_order"/>
            <attribute name="cat_critical"/>
            <attribute name="cat_includeattachment"/>
            <attribute name="cat_attachmentfile_name"/>
            <order attribute="cat_name" />
            <filter type="and">
              <condition attribute="cat_copilottestsetid" operator="eq" value="${testSetId}" />
              <condition attribute="statecode" operator="eq" value="0" />
              <condition attribute="cat_parent" operator="null"/>
            </filter>
          </entity>
        </fetch>
      `;

      const response = await this.context.webAPI.retrieveMultipleRecords(
        "cat_copilottest",
        `?fetchXml=${encodeURIComponent(fetchXml)}`
      );

      const testCases = this.mapTestCaseEntities(response.entities, testSetId);

      // Load child test cases for multiturn tests
      await this.loadChildTestCases(testCases);

      return testCases;
    }, "Get test cases");
  }

  /**
   * Retrieve child test cases for a parent test in multiturn scenarios
   *
   * @param parentTestId - GUID of the parent test case
   * @returns Promise resolving to array of child AgentTestCase objects
   * @throws Error if parent test not found or query execution fails
   * @public
   */
  async getChildTestCases(parentTestId: string): Promise<AgentTestCase[]> {
    return this.executeOperation(async () => {
      const fetchXml = `
        <fetch>
          <entity name="cat_copilottest">
            <attribute name="cat_name"/>
            <attribute name="cat_testutterance"/>
            <attribute name="cat_copilottestid"/>
            <attribute name="cat_expectedresponse"/>
            <attribute name="cat_testtypecode"/>
            <attribute name="cat_generativeansweroutcomecode"/>
            <attribute name="cat_expectedpositionoftheresponseactivity"/>
            <attribute name="cat_expectedtopicname"/>
            <attribute name="cat_expectedtools"/>
            <attribute name="cat_isstartconversationeventsent"/>
            <attribute name="cat_externalvariablesjson"/>
            <attribute name="cat_expectedattachmentsjson"/>
            <attribute name="cat_secondsbeforegettinganswer"/>
            <attribute name="cat_comparisonoperator"/>
            <attribute name="cat_operationtypecode"/>
            <attribute name="cat_validationinstructions"/>
            <attribute name="cat_adaptivecardpayload"/>
            <attribute name="cat_passthreshold"/>
            <attribute name="cat_parent"/>
            <attribute name="cat_order"/>
            <attribute name="cat_critical"/>
            <attribute name="cat_includeattachment"/>
            <attribute name="cat_attachmentfile_name"/>
            <order attribute="cat_order" />
            <filter type="and">
              <condition attribute="cat_parent" operator="eq" value="${parentTestId}" />
              <condition attribute="statecode" operator="eq" value="0" />
            </filter>
          </entity>
        </fetch>
      `;

      const response = await this.context.webAPI.retrieveMultipleRecords(
        "cat_copilottest",
        `?fetchXml=${encodeURIComponent(fetchXml)}`
      );

      return this.mapTestCaseEntities(response.entities);
    }, "Get child test cases");
  }

  // Private helper methods

  /**
   * Map Dataverse entities to strongly-typed AgentTestCase objects
   *
   * @param entities - Raw entities from Dataverse response
   * @param testSetId - GUID of the test set (optional, used when not in entity data)
   * @returns Array of mapped AgentTestCase objects with full type safety
   * @private
   */
  private mapTestCaseEntities(
    entities: Record<string, unknown>[],
    testSetId?: string
  ): AgentTestCase[] {
    return entities.map((entity) => ({
      id: entity.cat_copilottestid as string,
      name: entity.cat_name as string,
      testUtterance: entity.cat_testutterance as string,
      testSetId: testSetId || (entity.cat_copilottestsetid as string),
      expectedResponse: entity.cat_expectedresponse as string,
      testTypeCode: entity.cat_testtypecode as number,
      generativeAnswerOutcomeCode:
        entity.cat_generativeansweroutcomecode as number,
      expectedPositionOfTheResponseActivity:
        entity.cat_expectedpositionoftheresponseactivity as number,
      expectedTopicName: entity.cat_expectedtopicname as string,
      expectedTools: entity.cat_expectedtools as string,
      isStartConversationEventSent:
        entity.cat_isstartconversationeventsent as boolean,
      externalVariablesJson: entity.cat_externalvariablesjson as string,
      expectedAttachmentsJson: entity.cat_expectedattachmentsjson as string,
      secondsBeforeGettingAnswer:
        entity.cat_secondsbeforegettinganswer as number,
      comparisonOperatorCode: entity.cat_comparisonoperator as number,
      operationTypeCode: entity.cat_operationtypecode as number,
      validationInstructions: entity.cat_validationinstructions as string,
      adaptiveCardPayload: entity.cat_adaptivecardpayload as string,
      parentId: entity.cat_parent as string,
      order: entity.cat_order as number,
      critical: entity.cat_critical as boolean,
      cat_passthreshold: entity.cat_passthreshold as number,
      includeAttachment: entity.cat_includeattachment as boolean,
      attachmentFileName: entity.cat_attachmentfile_name as string,
    }));
  }

  /**
   * Load child test cases for multiturn test scenarios
   * Automatically identifies multiturn test cases (testTypeCode = 5) and loads
   * their associated child test cases to support hierarchical test execution.
   *
   * @param testCases - Array of test cases to check for multiturn tests
   * @returns Promise that resolves when all child test cases are loaded
   * @private
   */
  private async loadChildTestCases(testCases: AgentTestCase[]): Promise<void> {
    for (const testCase of testCases) {
      if (testCase.testTypeCode === 5) {
        // MULTITURN test type
        try {
          testCase.childTests = await this.getChildTestCases(testCase.id);
        } catch (error) {
          // Set empty array if loading fails
          testCase.childTests = [];
        }
      }
    }
  }

  /**
   * Download attachment file content from Dataverse File column
   *
   * @param testCaseId - GUID of the test case record
   * @param fileName - Name of the file for MIME type detection
   * @returns Promise resolving to TestCaseAttachmentData with base64 content
   * @public
   */
  async getAttachmentFileContent(
    testCaseId: string,
    fileName: string
  ): Promise<TestCaseAttachmentData> {
    return this.executeOperation(async () => {
      const orgUrl = this.getOrgUrl();
      // Dataverse Web API file column download endpoint:
      //   /api/data/v9.2/<entitySetName>(<id>)/<filecolumnname>/$value
      // IMPORTANT: must use the entity SET name (plural: cat_copilottests),
      // NOT the entity logical name (singular: cat_copilottest). Using the
      // singular form returns HTTP 400 with OData error 0x80060888
      // (Content-type negotiation failed) instead of a proper octet-stream
      // response.
      const url = `${orgUrl}/api/data/v9.2/cat_copilottests(${testCaseId})/cat_attachmentfile/$value`;

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
          "If-None-Match": "null",
          "Accept": "application/octet-stream",
        },
      });

      if (!response.ok) {
        let errBody = "";
        try {
          errBody = await response.text();
        } catch {
          /* ignore */
        }
        throw new Error(
          `Failed to download file from Dataverse: ${response.status} ${response.statusText}` +
            (errBody ? ` — ${errBody.slice(0, 200)}` : "")
        );
      }

      const blob = await response.blob();

      // Copilot Studio rejects attachments larger than 15 MB. Fail fast here
      // with a clear error instead of letting the activity send fail with a
      // less specific error from the channel.
      const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
      if (blob.size > MAX_ATTACHMENT_BYTES) {
        throw new Error(
          `Attachment "${fileName}" is ${(blob.size / 1024 / 1024).toFixed(2)} MB, ` +
            `which exceeds the Copilot Studio 15 MB upload limit.`
        );
      }

      const resolvedFileName =
        response.headers.get("x-ms-file-name") || fileName || "attachment";
      const resolvedMimeType =
        response.headers.get("mimetype") ||
        response.headers.get("content-type")?.split(";")[0] ||
        this.getMimeType(resolvedFileName);

      const base64Content = await this.blobToBase64(blob);

      return {
        fileName: resolvedFileName,
        mimeType: resolvedMimeType,
        base64Content,
      };
    }, "Get attachment file content");
  }

  /**
   * Load attachment data for all test cases that have attachments enabled
   *
   * @param testCases - Array of test cases to load attachments for
   * @public
   */
  async loadAttachmentsForTestCases(testCases: AgentTestCase[]): Promise<void> {
    const allCases = [...testCases];
    // Include child tests
    for (const tc of testCases) {
      if (tc.childTests?.length) {
        allCases.push(...tc.childTests);
      }
    }

    for (const testCase of allCases) {
      if (testCase.includeAttachment && testCase.attachmentFileName) {
        try {
          testCase.attachmentData = await this.getAttachmentFileContent(
            testCase.id,
            testCase.attachmentFileName
          );
        } catch (error) {
          console.error(
            `Failed to load attachment for test "${testCase.name}":`,
            error
          );
          testCase.attachmentData = undefined;
        }
      }
    }
  }

  /**
   * Convert Blob to base64 string
   * @private
   */
  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove the data:...;base64, prefix
        const base64 = result.split(",")[1] || result;
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Determine MIME type from file name extension
   * @private
   */
  private getMimeType(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      bmp: "image/bmp",
      svg: "image/svg+xml",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      xls: "application/vnd.ms-excel",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ppt: "application/vnd.ms-powerpoint",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      csv: "text/csv",
      json: "application/json",
      xml: "application/xml",
      zip: "application/zip",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      wav: "audio/wav",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }
}
