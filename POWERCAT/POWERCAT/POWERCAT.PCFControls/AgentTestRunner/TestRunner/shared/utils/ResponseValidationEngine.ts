/**
 * Response validation and comparison utilities
 * Handles agent response validation and adaptive card comparison logic
 */

import type { AdaptiveCard } from "../models/DataModels";

// Constants for response validation engine
const RESPONSE_VALIDATION_ENGINE_CONSTANTS = {
  ERROR_STRINGS: [
    "ContentError",
    "DataLossPreventionViolation",
    "FlowActionException",
    "FlowActionBadRequest",
    "FlowActionTimedOut",
    "InvalidContent",
    "InfiniteLoopInBotContent",
    "LatestPublishedVersionNotFound",
    "RedirectToDisabledDialog",
    "RedirectToNonExistentDialog",
    "SystemError",
  ] as const,
} as const;

/**
 * Engine for validating and comparing agent responses
 * Centralizes comparison logic that was duplicated across services
 */
export class ResponseValidationEngine {
  /**
   * Validate agent response based on test case requirements
   * @param agentResponseText - The text response from the agent
   * @param expectedResponse - Expected response text from test case
   * @param comparisonOperator - Comparison operator code
   * @returns Boolean indicating if response is valid
   */
  static validateResponse(
    agentResponseText: string,
    expectedResponse: string,
    comparisonOperator?: number | null
  ): boolean {
    const operator = comparisonOperator ?? 1; // Default to EQUALS

    let result: boolean;
    switch (operator) {
      case 1: // EQUALS
        result = this.equals(expectedResponse, agentResponseText);
        break;
      case 2: // NOT_EQUALS
        result = !this.equals(expectedResponse, agentResponseText);
        break;
      case 3: // CONTAINS
        result = this.contains(agentResponseText, expectedResponse);
        break;
      case 4: // DOES_NOT_CONTAIN
        result = !this.contains(agentResponseText, expectedResponse);
        break;
      case 5: // STARTS_WITH
        result = this.startsWith(agentResponseText, expectedResponse);
        break;
      case 6: // DOES_NOT_START_WITH
        result = !this.startsWith(agentResponseText, expectedResponse);
        break;
      case 7: // ENDS_WITH
        result = this.endsWith(agentResponseText, expectedResponse);
        break;
      case 8: // DOES_NOT_END_WITH
        result = !this.endsWith(agentResponseText, expectedResponse);
        break;
      case 9: // CONTAINS_DATA
        result = !this.isEmpty(agentResponseText);
        break;
      default:
        result = this.equals(expectedResponse, agentResponseText);
        break;
    }

    return result;
  }

  /**
   * Compare adaptive cards/attachments JSON with comparison operators
   * @param expectedAttachmentsJson - Expected attachments from test case
   * @param actualAdaptiveCards - Actual adaptive cards received
   * @param comparisonOperator - Comparison operator code
   * @returns Boolean indicating if attachments match based on operator
   */
  static compareAttachments(
    expectedAttachmentsJson: string,
    actualAdaptiveCards?: AdaptiveCard[],
    comparisonOperator?: number | null
  ): boolean {
    try {
      const operator = comparisonOperator ?? 1; // Default to EQUALS

      // Parse expected attachments
      const expectedAttachments = expectedAttachmentsJson
        ? JSON.parse(expectedAttachmentsJson)
        : [];

      // Convert actual cards to comparable format
      const actualAttachments =
        actualAdaptiveCards && actualAdaptiveCards.length > 0
          ? actualAdaptiveCards
          : [];

      // Convert to JSON strings for comparison
      const expectedJson = JSON.stringify(expectedAttachments);
      const actualJson = JSON.stringify(actualAttachments);

      // Apply comparison operator
      let result: boolean;
      switch (operator) {
        case 1: // EQUALS
          result = this.equals(expectedJson, actualJson);
          break;
        case 2: // NOT_EQUALS
          result = !this.equals(expectedJson, actualJson);
          break;
        case 3: // CONTAINS
          result = this.contains(actualJson, expectedJson);
          break;
        case 4: // DOES_NOT_CONTAIN
          result = !this.contains(actualJson, expectedJson);
          break;
        default:
          // For invalid operators, default to equals comparison
          result = this.equals(expectedJson, actualJson);
          break;
      }

      return result;
    } catch (parseError) {
      return false;
    }
  }

  /**
   * Check if agent response contains error strings
   * @param response - Agent response text to check
   * @returns Boolean indicating if response contains error strings
   */
  static hasErrorStrings(response: string): boolean {
    return RESPONSE_VALIDATION_ENGINE_CONSTANTS.ERROR_STRINGS.some(
      (errorString) => this.contains(response, errorString)
    );
  }

  // Private helper methods for string comparisons
  private static isEmpty(value: string | undefined | null): boolean {
    return !value || value.trim() === "";
  }

  private static equals(a: unknown, b: unknown): boolean {
    return a === b;
  }

  private static contains(text: string, searchValue: string): boolean {
    return text.includes(searchValue);
  }

  private static startsWith(text: string, prefix: string): boolean {
    return text.startsWith(prefix);
  }

  private static endsWith(text: string, suffix: string): boolean {
    return text.endsWith(suffix);
  }

  /**
   * Validate adaptive cards based on operation type code
   * @param operationTypeCode - Operation type (1=Comparison Operator, 2=AI Validation, 3=Invoke Actions)
   * @param comparisonOperator - Comparison operator code (1=Equals, 2=Does not equal, 3=Contains, 4=Does not contain)
   * @param expectedAttachmentsJson - Expected attachments JSON for Equals/Does not equal operations
   * @param validationInstructions - Validation instructions for Contains/Does not contain operations
   * @param actualAdaptiveCards - Actual adaptive cards received from agent
   * @returns Object with success flag and result reason
   */
  static validateAdaptiveCards(
    operationTypeCode: number,
    comparisonOperator: number,
    expectedAttachmentsJson: string,
    validationInstructions: string,
    actualAdaptiveCards?: AdaptiveCard[]
  ): { success: boolean; reason: string } {
    // Handle different operation types - operation type check takes precedence
    switch (operationTypeCode) {
      case 1: // Comparison Operator - ONLY case where we perform comparison operations
        return this.validateAdaptiveCardsWithComparison(
          comparisonOperator,
          expectedAttachmentsJson,
          validationInstructions,
          actualAdaptiveCards
        );

      case 2: // AI Validation - Return directly without any comparison
        return {
          success: false, // Will be set to PENDING in calling code
          reason: "Pending analysis with AI Builder",
        };

      case 3: // Invoke Actions - Return directly without any comparison
        return {
          success: false, // Will be set to ERROR in calling code
          reason:
            "Invoke Actions is not currently supported with Microsoft Authentication",
        };

      default:
        // For unknown operation types, return an error instead of falling back to comparison
        return {
          success: false,
          reason: `Unknown operation type: ${operationTypeCode}`,
        };
    }
  }

  /**
   * Validate adaptive cards using comparison operators (operation type 1)
   * @param comparisonOperator - Comparison operator code
   * @param expectedAttachmentsJson - Expected attachments JSON
   * @param validationInstructions - Validation instructions
   * @param actualAdaptiveCards - Actual adaptive cards received
   * @returns Object with success flag and result reason
   */
  private static validateAdaptiveCardsWithComparison(
    comparisonOperator: number,
    expectedAttachmentsJson: string,
    validationInstructions: string,
    actualAdaptiveCards?: AdaptiveCard[]
  ): { success: boolean; reason: string } {
    // Convert actual adaptive cards to JSON string for string comparison
    const actualAdaptiveCardJson =
      actualAdaptiveCards && actualAdaptiveCards.length > 0
        ? JSON.stringify(actualAdaptiveCards)
        : "[]";

    let result: boolean;

    switch (comparisonOperator) {
      case 1: // Equals
        result = this.compareAdaptiveCardsForEquality(
          expectedAttachmentsJson,
          actualAdaptiveCardJson
        );
        break;

      case 2: // Does not equal
        result = !this.compareAdaptiveCardsForEquality(
          expectedAttachmentsJson,
          actualAdaptiveCardJson
        );
        break;

      case 3: // Contains
        // Handle empty validation instructions
        if (!validationInstructions || validationInstructions.trim() === "") {
          result = false;
        } else {
          result = this.contains(
            actualAdaptiveCardJson,
            validationInstructions
          );
        }
        break;

      case 4: // Does not contain
        // Handle empty validation instructions
        if (!validationInstructions || validationInstructions.trim() === "") {
          result = true; // If no validation instructions, then JSON correctly "does not contain" anything specific
        } else {
          result = !this.contains(
            actualAdaptiveCardJson,
            validationInstructions
          );
        }
        break;

      default:
        // Default to equals for unknown operators
        result = this.compareAdaptiveCardsForEquality(
          expectedAttachmentsJson,
          actualAdaptiveCardJson
        );
        break;
    }

    // Use simplified result reasons for all comparison operators
    const reason = result
      ? "Exact match between the expected attachment(s) JSON and the received attachment(s) JSON as per comparison operator"
      : "Not an exact match between the expected attachment(s) JSON and the received attachment(s) JSON as per comparison operator";

    return { success: result, reason };
  }

  /**
   * Compare adaptive cards for equality using normalized JSON comparison
   * This handles the issue where JSON.stringify order can vary
   */
  private static compareAdaptiveCardsForEquality(
    expectedJson: string,
    actualJson: string
  ): boolean {
    try {
      // If both are empty, they're equal
      if (
        (!expectedJson || expectedJson.trim() === "") &&
        (!actualJson || actualJson.trim() === "")
      ) {
        return true;
      }

      // If one is empty and the other isn't, they're not equal
      if (
        !expectedJson ||
        expectedJson.trim() === "" ||
        !actualJson ||
        actualJson.trim() === ""
      ) {
        return false;
      }

      // Parse both JSON strings
      const expectedParsed = JSON.parse(expectedJson);
      const actualParsed = JSON.parse(actualJson);

      // Use a recursive function to normalize objects for consistent comparison
      const normalizeObject = (obj: unknown): unknown => {
        if (obj === null || typeof obj !== "object") {
          return obj;
        }

        if (Array.isArray(obj)) {
          return obj.map(normalizeObject);
        }

        // For objects, sort keys and normalize values
        const objectToNormalize = obj as Record<string, unknown>;
        const sortedKeys = Object.keys(objectToNormalize).sort();
        const normalizedObj: Record<string, unknown> = {};
        for (const key of sortedKeys) {
          normalizedObj[key] = normalizeObject(objectToNormalize[key]);
        }
        return normalizedObj;
      };

      // Normalize both objects and then stringify for comparison
      const expectedNormalized = JSON.stringify(
        normalizeObject(expectedParsed)
      );
      const actualNormalized = JSON.stringify(normalizeObject(actualParsed));

      return expectedNormalized === actualNormalized;
    } catch (error) {
      // Fallback to simple string comparison if JSON parsing fails
      return expectedJson === actualJson;
    }
  }
}
