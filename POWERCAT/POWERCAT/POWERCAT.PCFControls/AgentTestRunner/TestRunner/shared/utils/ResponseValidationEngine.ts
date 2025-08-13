/**
 * ResponseValidationEngine.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides comprehensive response validation and comparison utilities for agent testing.
 * Handles agent response validation, adaptive card comparison logic, and error detection
 * with support for multiple comparison operators and operation types.
 *
 * Exports:
 *   - ResponseValidationEngine: Main validation engine with static methods for response analysis.
 *
 * Usage:
 *   const isValid = ResponseValidationEngine.validateResponse(agentText, expected, operator);
 *   const result = ResponseValidationEngine.validateAdaptiveCards(opType, operator, expected, instructions, cards);
 *   const hasErrors = ResponseValidationEngine.hasErrorStrings(response);
 */

import type { AdaptiveCard } from "../models/DataModels";

/**
 * Constants for response validation engine
 */
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
 * Centralizes comparison logic with support for multiple operators and validation types
 */
export class ResponseValidationEngine {
  /**
   * Validate agent response based on test case requirements and comparison operator
   *
   * Performs text comparison using specified operator with comprehensive validation logic.
   * Supports equals, not equals, contains, starts with, ends with, and data presence checks.
   *
   * @param agentResponseText - The text response from the agent to validate
   * @param expectedResponse - Expected response text from test case definition
   * @param comparisonOperator - Comparison operator code (1=Equals, 2=Not Equals, 3=Contains, etc.)
   * @returns Boolean indicating if response is valid according to the comparison criteria
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

      // Convert to JSON strings for comparison using consistent normalization
      const expectedJson = JSON.stringify(
        this.normalizeForComparison(expectedAttachments)
      );
      const actualJson = JSON.stringify(
        this.normalizeForComparison(actualAttachments)
      );

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
   * Check if agent response contains error strings indicating system failures
   * Scans agent response text for known error strings that indicate system-level
   * failures, content errors, or flow execution problems.
   *
   * @param response - Agent response text to check for error indicators
   * @returns Boolean indicating if response contains any known error strings
   */
  static hasErrorStrings(response: string): boolean {
    return RESPONSE_VALIDATION_ENGINE_CONSTANTS.ERROR_STRINGS.some(
      (errorString) => this.contains(response, errorString)
    );
  }

  // Private helper methods for string comparisons

  /**
   * Normalize objects for consistent comparison by sorting keys recursively
   * @param obj - Object to normalize
   * @returns Normalized object with sorted keys
   * @private
   */
  private static normalizeForComparison(obj: unknown): unknown {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.normalizeForComparison(item));
    }

    // For objects, sort keys and normalize values
    const objectToNormalize = obj as Record<string, unknown>;
    const sortedKeys = Object.keys(objectToNormalize).sort();
    const normalizedObj: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      normalizedObj[key] = this.normalizeForComparison(objectToNormalize[key]);
    }
    return normalizedObj;
  }

  /**
   * Check if value is empty or null
   * @param value - Value to check for emptiness
   * @returns Boolean indicating if value is empty, null, or whitespace only
   * @private
   */
  private static isEmpty(value: string | undefined | null): boolean {
    return !value || value.trim() === "";
  }

  /**
   * Perform strict equality comparison between two values
   * @param a - First value for comparison
   * @param b - Second value for comparison
   * @returns Boolean indicating if values are strictly equal
   * @private
   */
  private static equals(a: unknown, b: unknown): boolean {
    return a === b;
  }

  /**
   * Check if text contains search value using case-sensitive string matching
   * @param text - Text to search within
   * @param searchValue - Value to search for
   * @returns Boolean indicating if text contains the search value
   * @private
   */
  private static contains(text: string, searchValue: string): boolean {
    return text.includes(searchValue);
  }

  /**
   * Check if text starts with specified prefix
   * @param text - Text to check
   * @param prefix - Prefix to look for
   * @returns Boolean indicating if text starts with prefix
   * @private
   */
  private static startsWith(text: string, prefix: string): boolean {
    return text.startsWith(prefix);
  }

  /**
   * Check if text ends with specified suffix
   * @param text - Text to check
   * @param suffix - Suffix to look for
   * @returns Boolean indicating if text ends with suffix
   * @private
   */
  private static endsWith(text: string, suffix: string): boolean {
    return text.endsWith(suffix);
  }

  /**
   * Validate adaptive cards based on operation type code and comparison settings
   *
   * Handles different operation types with appropriate validation logic:
   * - Operation Type 1 (Comparison): Performs comparison operations using specified operator
   *   - Equals/Not Equals: Exact string match of adaptive card JSON
   *   - Contains/Not Contains: Substring match to check if text is present within adaptive card JSON
   * - Operation Type 2 (AI Validation): Returns pending status for AI Builder analysis
   * - Operation Type 3 (Invoke Actions): Returns error status for unsupported operation
   *
   * @param operationTypeCode - Operation type (1=Comparison Operator, 2=AI Validation, 3=Invoke Actions)
   * @param comparisonOperator - Comparison operator code (1=Equals, 2=Does not equal, 3=Contains, 4=Does not contain)
   * @param expectedAttachmentsJson - Expected attachments JSON for Equals/Does not equal operations
   * @param validationInstructions - Validation instructions for Contains/Does not contain operations
   * @param actualAdaptiveCards - Actual adaptive cards received from agent
   * @param returnBooleanOnly - If true, returns only boolean result for MessagingService compatibility
   * @returns Object with success flag and detailed result reason, or boolean if returnBooleanOnly is true
   */
  static validateAdaptiveCards(
    operationTypeCode: number,
    comparisonOperator: number,
    expectedAttachmentsJson: string,
    validationInstructions: string,
    actualAdaptiveCards?: AdaptiveCard[],
    returnBooleanOnly?: boolean
  ): { success: boolean; reason: string } | boolean {
    // Handle different operation types - operation type check takes precedence
    switch (operationTypeCode) {
      case 1: // Comparison Operator - ONLY case where we perform comparison operations
        return this.validateAdaptiveCardsWithComparison(
          comparisonOperator,
          expectedAttachmentsJson,
          validationInstructions,
          actualAdaptiveCards,
          returnBooleanOnly
        );

      case 2: // AI Validation - Return directly without any comparison
        if (returnBooleanOnly) {
          return false; // Will be handled as PENDING in calling code
        }
        return {
          success: false, // Will be set to PENDING in calling code
          reason: "Pending analysis with AI Builder",
        };

      case 3: // Invoke Actions - Return directly without any comparison
        if (returnBooleanOnly) {
          return false; // Will be handled as ERROR in calling code
        }
        return {
          success: false, // Will be set to ERROR in calling code
          reason:
            "Invoke Actions is not currently supported with Microsoft Authentication",
        };

      default:
        // For unknown operation types, return an error instead of falling back to comparison
        if (returnBooleanOnly) {
          return false;
        }
        return {
          success: false,
          reason: `Unknown operation type: ${operationTypeCode}`,
        };
    }
  }

  /**
   * Validate adaptive cards using comparison operators (operation type 1)
   *
   * Performs comparison-based validation of adaptive cards using specified operator.
   * - Equals/Not Equals: Exact string match of adaptive card JSON
   * - Contains/Not Contains: Substring match to check if text is present within adaptive card JSON
   *
   * @param comparisonOperator - Comparison operator code for validation logic
   * @param expectedAttachmentsJson - Expected attachments JSON for comparison
   * @param validationInstructions - Validation instructions for substring operations
   * @param actualAdaptiveCards - Actual adaptive cards received from agent
   * @param returnBooleanOnly - If true, returns only boolean result for MessagingService compatibility
   * @returns Object with success flag and detailed result reason, or boolean if returnBooleanOnly is true
   * @private
   */
  private static validateAdaptiveCardsWithComparison(
    comparisonOperator: number,
    expectedAttachmentsJson: string,
    validationInstructions: string,
    actualAdaptiveCards?: AdaptiveCard[],
    returnBooleanOnly?: boolean
  ): { success: boolean; reason: string } | boolean {
    // Convert actual adaptive cards to JSON string for string comparison
    const actualAdaptiveCardJson =
      actualAdaptiveCards && actualAdaptiveCards.length > 0
        ? JSON.stringify(actualAdaptiveCards)
        : "[]";

    let result: boolean;

    switch (comparisonOperator) {
      case 1: // Equals - Use simple compareAttachments for direct comparison
        result = this.compareAttachments(
          expectedAttachmentsJson,
          actualAdaptiveCards,
          1 // Equals operator
        );
        break;

      case 2: // Does not equal - Use simple compareAttachments with NOT_EQUALS
        result = this.compareAttachments(
          expectedAttachmentsJson,
          actualAdaptiveCards,
          2 // Not equals operator
        );
        break;

      case 3: // Contains - Substring match
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

      case 4: // Does not contain - Substring match (negated)
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

    // Return boolean only for MessagingService compatibility
    if (returnBooleanOnly) {
      return result;
    }

    // Use simplified result reasons for all comparison operators
    const reason = result
      ? "Exact match between the expected attachment(s) JSON and the received attachment(s) JSON as per comparison operator"
      : "Not an exact match between the expected attachment(s) JSON and the received attachment(s) JSON as per comparison operator";

    return { success: result, reason };
  }

  /**
   * Compare adaptive cards for equality using normalized JSON comparison
   * This handles the issue where JSON.stringify order can vary and formatting differences
   *
   * @param expectedJson - Expected JSON string for comparison
   * @param actualJson - Actual JSON string from agent response
   * @returns Boolean indicating if JSON objects are semantically equal
   * @private
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
