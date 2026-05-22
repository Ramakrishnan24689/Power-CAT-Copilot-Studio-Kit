/**
 * AuthorizationCardHandler.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Detects the Copilot Studio connector authorization adaptive card ("Connect
 * to continue" — Allow / Cancel) that the platform injects on the first
 * conversation turn for any agent that uses a connector (SharePoint, Dataverse,
 * Power Automate, etc.). When detected, returns the Allow submit payload so the
 * caller can invoke `adaptiveCard/action` to authorize the connection in the
 * same test turn — eliminating the need for an extra manual "Allow" test case.
 *
 * Stable detection signature (verified across Copilot Studio connector
 * adapters): an adaptive card attachment whose `Action.Submit` `data` element
 * contains `{ id: "submit", action: "Allow", ... }`. The same `data` object is
 * sent back verbatim as the invoke `value`, so future schema additions to the
 * payload propagate automatically.
 *
 * Exports:
 *   - detectAuthorizationAllowAction(activities) → { actionPayload } | null
 */

import type { Activity } from "@microsoft/agents-activity";

/**
 * Adaptive card content type used by Copilot Studio (matches MessageProcessor).
 */
const ADAPTIVE_CARD_CONTENT_TYPE = "application/vnd.microsoft.card.adaptive";

/**
 * Action element types that carry submit data in an adaptive card.
 */
const SUBMIT_ACTION_TYPES = new Set<string>([
  "Action.Submit",
  "Action.Execute",
]);

/**
 * Detected Allow payload, ready to be sent as the `value` of an
 * `adaptiveCard/action` invoke activity.
 */
export interface AuthorizationAllowAction {
  /** Verbatim `data` object from the matched Allow submit action. */
  actionPayload: Record<string, unknown>;
}

/**
 * Type guard: non-null object.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Returns true if the given submit-data object matches the Copilot Studio
 * authorization card's "Allow" action. Case-insensitive comparison on both
 * fields because some adapter variants emit `"allow"` lowercase.
 */
function isAllowSubmitData(data: unknown): data is Record<string, unknown> {
  if (!isObject(data)) return false;
  const id = typeof data.id === "string" ? data.id.toLowerCase() : "";
  const action = typeof data.action === "string" ? data.action.toLowerCase() : "";
  return id === "submit" && action === "allow";
}

/**
 * Walks an adaptive card element tree (actions[] and nested ActionSet bodies)
 * and returns the first Allow submit `data` payload found.
 */
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

  // Body elements may contain ActionSet items whose actions[] hold submits.
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
      // Defensive recursion for containers (Container, ColumnSet, Column).
      if (Array.isArray(element.items) || Array.isArray(element.columns)) {
        const nested = findAllowDataInCardContent(element);
        if (nested) return nested;
      }
    }
  }

  // Container / Column flattening — items[] or columns[] may carry more body-like trees.
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
 * Scans the given activities for a connector authorization adaptive card.
 * Returns the Allow submit payload if found, otherwise null.
 *
 * The caller should invoke `adaptiveCard/action` with the returned
 * `actionPayload` as the activity's `value` to authorize the connection.
 *
 * Emits diagnostic console output prefixed with
 * `[AgentTestRunner v3.1.142 AuthCardDetect]` so the path can be traced in
 * browser DevTools when debugging.
 *
 * @param activities Activities just returned from the agent (most recent turn).
 * @returns AuthorizationAllowAction with the verbatim Allow payload, or null.
 */
export function detectAuthorizationAllowAction(
  activities: Activity[] | undefined
): AuthorizationAllowAction | null {
  const tag = "[AgentTestRunner v3.1.142 AuthCardDetect]";

  if (!activities || !Array.isArray(activities) || activities.length === 0) {
    console.info(`${tag} skip: no activities`);
    return null;
  }

  let cardCount = 0;

  for (const activity of activities) {
    if (!activity.attachments || !Array.isArray(activity.attachments)) continue;

    for (const attachment of activity.attachments) {
      if (!attachment || attachment.contentType !== ADAPTIVE_CARD_CONTENT_TYPE) {
        continue;
      }
      cardCount += 1;
      if (!isObject(attachment.content)) continue;

      const allowData = findAllowDataInCardContent(attachment.content);
      if (allowData) {
        console.info(
          `${tag} MATCH activities=${activities.length} cards=${cardCount} payload=${JSON.stringify(allowData)}`
        );
        return { actionPayload: allowData };
      }
    }
  }

  console.info(
    `${tag} no match — activities=${activities.length} adaptiveCards=${cardCount}`
  );
  return null;
}
