/**
 * MessageProcessor.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides comprehensive message processing capabilities for Agent response analysis.
 * Handles extraction of text content, adaptive cards, attachments, and suggested actions
 * from Agent activities for testing and validation purposes.
 *
 * Exports:
 *   - MessageProcessor: Main class for processing and extracting Agent response components.
 *
 * Usage:
 *   const processor = new MessageProcessor();
 *   const text = processor.processResponse(activities);
 *   const cards = processor.extractAdaptiveCards(activities);
 *   const attachments = processor.extractAttachments(activities);
 *   const actions = processor.extractSuggestedActions(cards);
 */

import type { Activity } from "@microsoft/agents-activity";
import type {
  AdaptiveCard,
  Attachment,
  SuggestedAction,
} from "../shared/models/DataModels";

/**
 * Type alias for generic activity data structures
 */
type ActivityData = Record<string, unknown>;

/**
 * Fallback messages for response processing
 */
const FALLBACK_MESSAGES = {
  NO_RESPONSE: "No response received from agent",
  NO_TEXT_CONTENT: "Agent responded but no text content found",
} as const;

/**
 * Content types for attachment processing
 */
const CONTENT_TYPES = {
  ADAPTIVE_CARD: "application/vnd.microsoft.card.adaptive",
} as const;

/**
 * MessageProcessor
 *
 * Comprehensive processor for extracting and analyzing agent response components.
 * Provides robust text extraction, adaptive card processing, attachment handling,
 * and suggested action extraction from agent activities.
 *
 * This class implements multiple extraction strategies to handle various response
 * formats and ensures consistent data extraction across different agent configurations.
 */
export class MessageProcessor {
  /**
   * Validates if an activities array contains valid data for processing.
   * @param activities - Array of activities to validate.
   * @returns True if activities array is valid and contains at least one element.
   */
  private isValidActivitiesArray(activities: Activity[]): boolean {
    return activities && Array.isArray(activities) && activities.length > 0;
  }

  /**
   * Type guard to check if a value is a non-empty string.
   * @param value - Value to check for string type and content.
   * @returns True if value is a non-empty string, with type narrowing.
   */
  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  /**
   * Safely casts unknown data to ActivityData type with validation.
   * @param value - Unknown value to cast to ActivityData.
   * @returns ActivityData object if valid, null if invalid or null input.
   */
  private toActivityData(value: unknown): ActivityData | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }
    return value as ActivityData;
  }

  /**
   * Processes agent response activities using multiple extraction strategies.
   * Implements fallback logic to extract meaningful text content from various activity formats.
   * @param activities - Array of activities received from the agent.
   * @param includeAdaptiveCardText - Whether to extract text from adaptive cards (default: true)
   * @returns Extracted text content or appropriate fallback message.
   */
  processResponse(
    activities: Activity[],
    includeAdaptiveCardText = true
  ): string {
    if (!this.isValidActivitiesArray(activities)) {
      return FALLBACK_MESSAGES.NO_RESPONSE;
    }

    // Strategy 1: Extract and concatenate all direct text content from activities
    const allTextContent = activities
      .filter((activity) => this.isNonEmptyString(activity.text))
      .map((activity) => activity.text!.trim())
      .join(" ");

    if (allTextContent) {
      return allTextContent;
    }

    // Strategy 2: Search for text content in activity channelData
    for (const activity of activities) {
      if (activity.channelData) {
        const textFromChannelData = this.extractTextFromChannelData(
          activity.channelData
        );
        if (textFromChannelData) {
          return textFromChannelData;
        }
      }
    }

    // Strategy 3: Extract text content from activity attachments (only if enabled)
    if (includeAdaptiveCardText) {
      for (const activity of activities) {
        if (activity.attachments) {
          const textFromAttachments = this.extractTextFromAttachments(
            activity.attachments
          );
          if (textFromAttachments) {
            return textFromAttachments;
          }
        }
      }
    }

    return FALLBACK_MESSAGES.NO_TEXT_CONTENT;
  }

  /**
   * Processes agent response activities for direct text only (no adaptive card text extraction).
   * Used specifically for RESPONSE_MATCH tests where only direct agent text should be validated.
   * @param activities - Array of activities received from the agent.
   * @returns Direct text content only or empty string if no direct text found.
   */
  processDirectTextResponse(activities: Activity[]): string {
    if (!this.isValidActivitiesArray(activities)) {
      return "";
    }

    // Only extract direct text content from activities, no fallback strategies
    const allTextContent = activities
      .filter((activity) => this.isNonEmptyString(activity.text))
      .map((activity) => activity.text!.trim())
      .join(" ");

    return allTextContent;
  }

  /**
   * Extracts text content from activity channelData using multiple field searches.
   * Performs both direct field lookup and nested object traversal for comprehensive extraction.
   * @param channelData - Unknown channelData object from activity.
   * @returns Extracted text content or null if no text found.
   * @private
   */
  private extractTextFromChannelData(channelData: unknown): string | null {
    const data = this.toActivityData(channelData);
    if (!data) {
      return null;
    }

    // Search direct fields using predefined text field names
    for (const field of [
      "text",
      "message",
      "content",
      "response",
      "answer",
      "data",
    ]) {
      const value = data[field];
      if (this.isNonEmptyString(value)) {
        return value.trim();
      }
    }

    // Search nested objects for text content
    for (const [key, value] of Object.entries(data)) {
      const nestedData = this.toActivityData(value);
      if (nestedData) {
        for (const field of [
          "text",
          "message",
          "content",
          "response",
          "answer",
          "data",
        ]) {
          const nestedValue = nestedData[field];
          if (this.isNonEmptyString(nestedValue)) {
            return nestedValue.trim();
          }
        }
      }
    }

    return null;
  }

  /**
   * Extracts text content from activity attachments including adaptive card content.
   * Searches through attachment content structure for any available text fields.
   * @param attachments - Array of attachment objects from activity.
   * @returns Extracted text content or null if no text found.
   * @private
   */
  private extractTextFromAttachments(attachments: unknown[]): string | null {
    for (const attachment of attachments) {
      if (typeof attachment === "object" && attachment !== null) {
        const attachmentData = attachment as { content?: ActivityData };
        if (attachmentData.content) {
          // Search for text in adaptive card body elements
          if (Array.isArray(attachmentData.content.body)) {
            for (const bodyItem of attachmentData.content
              .body as ActivityData[]) {
              if (typeof bodyItem.text === "string") {
                return bodyItem.text.trim();
              }
            }
          }

          // Search for text in standard attachment content fields
          for (const field of ["text", "title", "subtitle", "body"]) {
            const value = attachmentData.content[field];
            if (typeof value === "string") {
              return value.trim();
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Extracts all adaptive cards from agent response activities.
   * Filters activities for adaptive card attachments and structures them for processing.
   * @param activities - Array of activities that may contain adaptive card attachments.
   * @returns Array of structured adaptive card objects.
   */
  extractAdaptiveCards(activities: Activity[]): AdaptiveCard[] {
    if (!this.isValidActivitiesArray(activities)) {
      return [];
    }

    const cards: AdaptiveCard[] = [];

    activities.forEach((activity, index) => {
      if (activity.attachments && Array.isArray(activity.attachments)) {
        activity.attachments.forEach((attachment, attachmentIndex) => {
          if (attachment.contentType === CONTENT_TYPES.ADAPTIVE_CARD) {
            cards.push({
              contentType: attachment.contentType,
              content: (attachment.content as Record<string, unknown>) || {},
            });
          }
        });
      }
    });

    return cards;
  }

  /**
   * Extracts all attachments from agent response activities.
   * Processes all attachment types and creates structured attachment objects.
   * @param activities - Array of activities that may contain various attachment types.
   * @returns Array of processed attachment objects with metadata.
   */
  extractAttachments(activities: Activity[]): Attachment[] {
    if (!this.isValidActivitiesArray(activities)) {
      return [];
    }

    const attachments: Attachment[] = [];

    activities.forEach((activity) => {
      if (activity.attachments && Array.isArray(activity.attachments)) {
        activity.attachments.forEach((attachment) => {
          attachments.push({
            contentType: attachment.contentType,
            content: attachment.content as Record<string, unknown> | undefined,
            contentUrl: attachment.contentUrl,
            name: attachment.name,
          });
        });
      }
    });

    return attachments;
  }

  /**
   * Extracts suggested actions from adaptive cards.
   * Processes adaptive card content to find action elements and buttons.
   * @param adaptiveCards - Array of adaptive cards to extract actions from.
   * @returns Array of structured suggested action objects.
   */
  extractSuggestedActions(adaptiveCards: AdaptiveCard[]): SuggestedAction[] {
    const actions: SuggestedAction[] = [];

    adaptiveCards.forEach((card) => {
      if (card.content && typeof card.content === "object") {
        this.processCardActions(card.content, actions);
      }
    });

    return actions;
  }

  /**
   * Processes adaptive card content to extract action elements.
   * Searches both top-level actions and ActionSet elements within card body.
   * @param content - Adaptive card content object to process.
   * @param actions - Array to accumulate extracted actions into.
   * @private
   */
  private processCardActions(
    content: Record<string, unknown>,
    actions: SuggestedAction[]
  ): void {
    // Process top-level actions array
    if (Array.isArray(content.actions)) {
      this.extractActionsFromArray(content.actions, actions);
    }

    // Process ActionSet elements within card body
    if (Array.isArray(content.body)) {
      content.body.forEach((element: unknown) => {
        if (typeof element === "object" && element !== null) {
          const elementData = element as Record<string, unknown>;
          if (
            elementData.type === "ActionSet" &&
            Array.isArray(elementData.actions)
          ) {
            this.extractActionsFromArray(elementData.actions, actions);
          }
        }
      });
    }
  }

  /**
   * Extracts and structures individual action objects from an action array.
   * Converts adaptive card action format to standardized SuggestedAction format.
   * @param actionArray - Array of action objects to process.
   * @param actions - Array to accumulate structured actions into.
   * @private
   */
  private extractActionsFromArray(
    actionArray: unknown[],
    actions: SuggestedAction[]
  ): void {
    actionArray.forEach((action) => {
      if (typeof action === "object" && action !== null) {
        const actionData = action as Record<string, unknown>;
        if (actionData.type && actionData.title) {
          actions.push({
            type: "imBack",
            title: String(actionData.title),
            text: String(actionData.text || actionData.title),
            value: actionData.data
              ? String(actionData.data)
              : String(actionData.title),
          });
        }
      }
    });
  }
}
