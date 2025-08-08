/**
 * Agent Test Set Operations for Dataverse
 * Handles operations related to agent test sets and test cases
 */

import { DataverseOperationBase } from "./DataverseOperationBase";
import type { AgentTestSet, AgentTestCase } from "../shared/models/DataModels";

/**
 * Service for managing agent test set and test case operations in Dataverse
 * Handles retrieval and management of test data structures
 */
export class AgentTestSetOperations extends DataverseOperationBase {
  constructor(context: ComponentFramework.Context<unknown>) {
    super(context, "AgentTestSetOperations");
  }

  /**
   * Retrieve Agent Test Set information by ID
   * @param testSetId - GUID of the test set
   * @returns Promise resolving to AgentTestSet object
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
   * Retrieve all test cases for a test set
   * @param testSetId - GUID of the test set
   * @returns Promise resolving to array of AgentTestCase objects
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
   * Retrieve child test cases for a parent test
   * @param parentTestId - GUID of the parent test case
   * @returns Promise resolving to array of child AgentTestCase objects
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
   * Map Dataverse entities to AgentTestCase objects
   * @param entities - Raw entities from Dataverse response
   * @param testSetId - GUID of the test set (optional, used when not in entity data)
   * @returns Array of mapped AgentTestCase objects
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
      expectedTools: entity.cat_expectedtools as string, // Add expectedTools mapping
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
    }));
  }

  /**
   * Load child test cases for multiturn test cases
   * @param testCases - Array of test cases to check for multiturn tests
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
}
