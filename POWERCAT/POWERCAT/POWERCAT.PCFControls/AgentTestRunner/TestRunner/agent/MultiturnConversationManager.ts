/**
 * MultiturnConversationManager.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Manages multiturn conversation scenarios for Agent testing. Orchestrates
 * the execution of parent-child test structures, handles conversation context,
 * and coordinates between messaging services and test execution engines.
 *
 * Exports:
 *   - MultiturnConversationManager: Main manager for multiturn test execution.
 *
 * Usage:
 *   const manager = new MultiturnConversationManager(messagingService, context);
 *   const success = await manager.executeMultiturnTest(parentTestCase, testRunId, configuration);
 */

import { MessagingService } from "./MessagingService";
import { MultiturnDataverseBridge } from "./MultiturnDataverseBridge";
import { MultiturnTestOrchestrator } from "./MultiturnTestOrchestrator";
import { TestExecutionEngine } from "./TestExecutionEngine";
import type {
  AgentTestCase,
  AgentResponse,
  AgentConfiguration,
} from "../shared/models/DataModels";

/**
 * Constants for MultiturnConversationManager
 */
const MULTITURN_CONVERSATION_CONSTANTS = {
  ERROR_MESSAGES: {
    SERVICES_REQUIRED:
      "Required services are not available. Please refresh and try again.",
    CONVERSATION_CONTEXT_FAILED:
      "Unable to start conversation with the agent. Please check your connection and try again.",
  },
} as const;

/**
 * MultiturnConversationManager orchestrates multiturn test execution.
 * Manages conversation context, parent-child test relationships, and coordinates
 * execution through specialized service components.
 */
export class MultiturnConversationManager {
  private readonly conversationManager: MultiturnTestOrchestrator;
  private readonly executionEngine: TestExecutionEngine;

  /**
   * Initializes MultiturnConversationManager with required services.
   * @param messagingService - Service for agent communication
   * @param context - Component framework context for Dataverse operations
   */
  constructor(
    messagingService: MessagingService,
    context: ComponentFramework.Context<unknown>
  ) {
    if (!messagingService || !context) {
      throw new Error(
        MULTITURN_CONVERSATION_CONSTANTS.ERROR_MESSAGES.SERVICES_REQUIRED
      );
    }

    const bridge = new MultiturnDataverseBridge(context);

    this.conversationManager = new MultiturnTestOrchestrator(
      messagingService,
      bridge
    );
    this.executionEngine = new TestExecutionEngine(
      this.conversationManager,
      bridge
    );
  }

  /**
   * Executes a complete multiturn conversation test with parent-child structure.
   * @param parentTestCase - Parent test case containing child tests
   * @param testRunId - ID of the test run
   * @param configuration - Agent configuration
   * @param onProgressUpdate - Optional progress callback
   * @returns Promise resolving to overall success status
   */
  async executeMultiturnTest(
    parentTestCase: AgentTestCase,
    testRunId: string,
    configuration: AgentConfiguration,
    onProgressUpdate?: (
      completed: number,
      total: number,
      message: string
    ) => void
  ): Promise<boolean> {
    const conversationId =
      await this.conversationManager.establishConversationContext(
        parentTestCase
      );

    if (!conversationId) {
      throw new Error(
        MULTITURN_CONVERSATION_CONSTANTS.ERROR_MESSAGES.CONVERSATION_CONTEXT_FAILED
      );
    }

    const parentTestResultId =
      await this.conversationManager.createParentTestResult(
        parentTestCase,
        testRunId,
        conversationId
      );

    const childResults = await this.executionEngine.executeChildTests(
      parentTestCase.childTests!,
      conversationId,
      testRunId,
      configuration,
      parentTestResultId || undefined
    );

    return this.executionEngine.allTestsPassed(childResults);
  }
}
