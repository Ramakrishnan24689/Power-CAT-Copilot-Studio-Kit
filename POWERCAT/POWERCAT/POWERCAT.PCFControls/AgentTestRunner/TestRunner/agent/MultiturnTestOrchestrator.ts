/**
 * MultiturnTestOrchestrator.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Orchestrates multiturn conversation testing scenarios by managing conversation
 * context establishment, parent test result creation, and message exchange within
 * existing conversations. Provides the coordination layer between messaging services
 * and data persistence operations.
 *
 * Exports:
 *   - MultiturnTestOrchestrator: Main orchestrator for multiturn conversation testing.
 *
 * Usage:
 *   const orchestrator = new MultiturnTestOrchestrator(messagingService, dataverseService);
 *   const conversationId = await orchestrator.establishConversationContext(parentTestCase);
 *   const parentResultId = await orchestrator.createParentTestResult(parentTestCase, testRunId, conversationId);
 */

import { MessagingService } from "./MessagingService";
import { IDataverseOperations } from "./IDataverseOperations";
import type { Activity } from "@microsoft/agents-activity";
import type { AgentTestCase, AgentResponse } from "../shared/models/DataModels";

/**
 * Orchestrates multiturn conversation testing by coordinating message flow
 * and data operations across conversation sessions
 */

export class MultiturnTestOrchestrator {
  private readonly messagingService: MessagingService;
  private readonly dataverseService: IDataverseOperations;
  private startConversationActivity: Activity | null = null;

  constructor(
    messagingService: MessagingService,
    dataverseService: IDataverseOperations
  ) {
    this.messagingService = messagingService;
    this.dataverseService = dataverseService;
  }

  /**
   * Establishes conversation context with the Agent for multiturn testing.
   * Initiates a conversation and stores the start activity for potential use by child tests.
   * @param parentTestCase - Parent test case definition for context establishment
   * @returns Promise resolving to conversation ID or null if establishment failed
   */
  async establishConversationContext(
    parentTestCase: AgentTestCase
  ): Promise<string | null> {
    try {
      const response = await this.messagingService.sendMessage(
        "",
        parentTestCase
      );

      // Store start conversation activity for potential use by first child test
      if (response.startConversationActivity) {
        this.startConversationActivity =
          response.startConversationActivity as Activity;
      }

      if (!response.success || !response.conversationId) return null;
      return response.conversationId;
    } catch (error) {
      return null;
    }
  }

  /**
   * Creates a parent test result record in Dataverse with conversation context.
   * Establishes the parent-child relationship structure for multiturn testing.
   * @param parentTestCase - Parent test case definition
   * @param testRunId - Associated test run identifier
   * @param conversationId - Conversation identifier for linking
   * @returns Promise resolving to parent test result ID or null if creation failed
   */
  async createParentTestResult(
    parentTestCase: AgentTestCase,
    testRunId: string,
    conversationId: string
  ): Promise<string | null> {
    try {
      return await this.dataverseService.createPlaceholderTestResultWithConversationId(
        parentTestCase,
        testRunId,
        conversationId
      );
    } catch (error) {
      return null;
    }
  }

  /**
   * Sends a message within an existing conversation context.
   * Supports first child test scenarios with start conversation activity inclusion.
   * @param message - Message text to send to the agent
   * @param conversationId - Existing conversation identifier
   * @param testCase - Optional test case for response validation
   * @param isFirstChildTest - Whether this is the first child test in the sequence
   * @param startConversationActivity - Start conversation activity for context
   * @returns Promise resolving to agent response with processing results
   */
  async sendMessageInExistingConversation(
    message: string,
    conversationId: string,
    testCase?: AgentTestCase,
    isFirstChildTest = false,
    startConversationActivity?: Activity
  ): Promise<AgentResponse> {
    return await this.messagingService.continueConversation(
      message,
      conversationId,
      testCase,
      isFirstChildTest,
      startConversationActivity
    );
  }

  /**
   * Retrieves the stored start conversation activity.
   * Used by child tests that need access to the original conversation context.
   * @returns Start conversation activity or null if not available
   */
  getStartConversationActivity(): Activity | null {
    return this.startConversationActivity;
  }

  /**
   * Creates a standardized error response for failed operations.
   * Provides consistent error handling across multiturn conversation scenarios.
   * @param conversationId - Conversation identifier for the error context
   * @param error - Error object or message to include in the response
   * @returns Standardized AgentResponse indicating failure with error details
   */
  createErrorResponse(conversationId: string, error: unknown): AgentResponse {
    return {
      message: "",
      timestamp: new Date(),
      success: false,
      responseTime: 0,
      error: error instanceof Error ? error.message : "Unknown error occurred",
      conversationId,
    };
  }
}
