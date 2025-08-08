import type { Activity } from "@microsoft/agents-activity";
import type {
  AdaptiveCard,
  Attachment,
  SuggestedAction,
} from "../shared/models/DataModels";

type ActivityData = Record<string, unknown>;

/**
 * MessageProcessor - Extracts and processes agent responses for testing
 */
export class MessageProcessor {
  /**
   * Helper method to validate if activities array is valid
   * @param activities - Array to validate
   * @returns True if activities array is valid and not empty
   */
  private isValidActivitiesArray(activities: Activity[]): boolean {
    return activities && Array.isArray(activities) && activities.length > 0;
  }

  /**
   * Helper method to check if a value is a non-empty string
   * @param value - Value to check
   * @returns True if value is a non-empty string
   */
  private isNonEmptyString(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
  }

  /**
   * Helper method to safely cast unknown to ActivityData
   * @param value - Unknown value to cast
   * @returns ActivityData object or null if invalid
   */
  private toActivityData(value: unknown): ActivityData | null {
    if (typeof value !== "object" || value === null) {
      return null;
    }
    return value as ActivityData;
  }

  /**
   * Processes agent response activities and extracts meaningful text content
   * @param activities - Array of activities received from the agent
   * @returns Processed response text or fallback message
   */
  processResponse(activities: Activity[]): string {
    if (!this.isValidActivitiesArray(activities)) {
      return "No response received from agent";
    }

    // Strategy 1: Get all text content from activities
    const allTextContent = activities
      .filter((activity) => this.isNonEmptyString(activity.text))
      .map((activity) => activity.text!.trim())
      .join(" ");

    if (allTextContent) {
      return allTextContent;
    }

    // Strategy 2: Check channelData
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

    // Strategy 3: Check attachments
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

    return "Agent responded but no text content found";
  }

  private extractTextFromChannelData(channelData: unknown): string | null {
    const data = this.toActivityData(channelData);
    if (!data) {
      return null;
    }

    const possibleTextFields = [
      "text",
      "message",
      "content",
      "response",
      "answer",
      "data",
    ];

    // Check direct fields
    for (const field of possibleTextFields) {
      const value = data[field];
      if (this.isNonEmptyString(value)) {
        return value.trim();
      }
    }

    // Check nested objects
    for (const [key, value] of Object.entries(data)) {
      const nestedData = this.toActivityData(value);
      if (nestedData) {
        for (const field of possibleTextFields) {
          const nestedValue = nestedData[field];
          if (this.isNonEmptyString(nestedValue)) {
            return nestedValue.trim();
          }
        }
      }
    }

    return null;
  }

  private extractTextFromAttachments(attachments: unknown[]): string | null {
    for (const attachment of attachments) {
      if (typeof attachment === "object" && attachment !== null) {
        const attachmentData = attachment as { content?: ActivityData };
        if (attachmentData.content) {
          // Look for text in adaptive card content
          if (Array.isArray(attachmentData.content.body)) {
            for (const bodyItem of attachmentData.content
              .body as ActivityData[]) {
              if (typeof bodyItem.text === "string") {
                return bodyItem.text.trim();
              }
            }
          }

          // Look for any text field in content
          const textFields = ["text", "title", "subtitle", "body"];
          for (const field of textFields) {
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
   * Extracts adaptive cards from agent response activities
   * @param activities - Array of activities that may contain adaptive cards
   * @returns Array of extracted adaptive cards
   */
  extractAdaptiveCards(activities: Activity[]): AdaptiveCard[] {
    if (!this.isValidActivitiesArray(activities)) {
      return [];
    }

    const cards: AdaptiveCard[] = [];

    activities.forEach((activity, index) => {
      if (activity.attachments && Array.isArray(activity.attachments)) {
        activity.attachments.forEach((attachment, attachmentIndex) => {
          if (
            attachment.contentType === "application/vnd.microsoft.card.adaptive"
          ) {
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
   * Extracts all attachments from agent response activities
   * @param activities - Array of activities that may contain attachments
   * @returns Array of processed attachment objects
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
   * Extracts suggested actions from adaptive cards
   * @param adaptiveCards - Array of adaptive cards to extract actions from
   * @returns Array of suggested action objects
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

  private processCardActions(
    content: Record<string, unknown>,
    actions: SuggestedAction[]
  ): void {
    // Process top-level actions
    if (Array.isArray(content.actions)) {
      this.extractActionsFromArray(content.actions, actions);
    }

    // Process actions in body elements
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
