/**
 * AuthorizationCardHandler.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Detects the Copilot Studio connector authorization adaptive card
 * ("Connect to continue" — Allow / Cancel) and returns the Allow submit
 * payload so the caller can authorize the connection in the same test turn.
 *
 * Exports:
 *   - detectAuthorizationAllowAction(activities) → { actionPayload } | null
 */

import type { Activity } from "@microsoft/agents-activity";

/** Adaptive card content type used by Copilot Studio. */
const ADAPTIVE_CARD_CONTENT_TYPE = "application/vnd.microsoft.card.adaptive";

/** Action element types that carry submit data in an adaptive card. */
const SUBMIT_ACTION_TYPES = new Set<string>([
  "Action.Submit",
  "Action.Execute",
]);

/** Detected Allow payload, used as the invoke activity's `value`. */
export interface AuthorizationAllowAction {
  /** Verbatim `data` object from the matched Allow submit action. */
  actionPayload: Record<string, unknown>;
}

/** Type guard: non-null object. */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Returns true if the submit-data object matches the "Allow" action. */
function isAllowSubmitData(data: unknown): data is Record<string, unknown> {
  if (!isObject(data)) return false;
  const id = typeof data.id === "string" ? data.id.toLowerCase() : "";
  const action = typeof data.action === "string" ? data.action.toLowerCase() : "";
  return id === "submit" && action === "allow";
}

/** Walks an adaptive card element tree and returns the first Allow submit data. */
function findAllowDataInCardContent(
  content: Record<string, unknown>
): Record<string, unknown> | null {
  // Top-level actions[]
  if (Array.isArray(content.actions)) {
    for (const action of content.actions) {
      if (!isObject(action)) continue;
      const type = typeof action.type === "string" ? action.type : "";
      if (SUBMIT_ACTION_TYPES.has(type) && isAllowSubmitData(action.data)) {
        return action.data;
      }
    }
  }

  // Body may contain ActionSet items whose actions[] hold submits.
  if (Array.isArray(content.body)) {
    for (const element of content.body) {
      if (!isObject(element)) continue;
      const elementType = typeof element.type === "string" ? element.type : "";
      if (elementType === "ActionSet" && Array.isArray(element.actions)) {
        for (const action of element.actions) {
          if (!isObject(action)) continue;
          const type = typeof action.type === "string" ? action.type : "";
          if (SUBMIT_ACTION_TYPES.has(type) && isAllowSubmitData(action.data)) {
            return action.data;
          }
        }
      }
      // Recurse into Container / ColumnSet / Column children.
      if (Array.isArray(element.items) || Array.isArray(element.columns)) {
        const nested = findAllowDataInCardContent(element);
        if (nested) return nested;
      }
    }
  }

  // Container.items[] / ColumnSet.columns[] may carry more body-like trees.
  if (Array.isArray(content.items)) {
    for (const item of content.items) {
      if (isObject(item)) {
        const nested = findAllowDataInCardContent(item);
        if (nested) return nested;
      }
    }
  }
  if (Array.isArray(content.columns)) {
    for (const column of content.columns) {
      if (isObject(column)) {
        const nested = findAllowDataInCardContent(column);
        if (nested) return nested;
      }
    }
  }

  return null;
}

/**
 * Scans activities for a connector authorization adaptive card and returns
 * the Allow submit payload if found, otherwise null.
 *
 * @param activities Activities returned from the agent (most recent turn).
 * @returns AuthorizationAllowAction with the verbatim Allow payload, or null.
 */
export function detectAuthorizationAllowAction(
  activities: Activity[] | undefined
): AuthorizationAllowAction | null {
  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    return null;
  }

  for (const activity of activities) {
    if (!activity.attachments || !Array.isArray(activity.attachments)) continue;

    for (const attachment of activity.attachments) {
      if (!attachment || attachment.contentType !== ADAPTIVE_CARD_CONTENT_TYPE) {
        continue;
      }
      if (!isObject(attachment.content)) continue;

      const allowData = findAllowDataInCardContent(attachment.content);
      if (allowData) {
        return { actionPayload: allowData };
      }
    }
  }

  return null;
}
