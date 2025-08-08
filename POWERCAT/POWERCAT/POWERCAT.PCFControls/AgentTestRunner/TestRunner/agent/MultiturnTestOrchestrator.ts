import { MessagingService } from "./MessagingService";
import { IDataverseOperations } from "./IDataverseOperations";
import type { Activity } from "@microsoft/agents-activity";
import type { AgentTestCase, AgentResponse } from "../shared/models/DataModels";

export class MultiturnTestOrchestrator {
  private messagingService: MessagingService;
  private dataverseService: IDataverseOperations;
  private startConversationActivity: Activity | null = null;

  constructor(
    messagingService: MessagingService,
    dataverseService: IDataverseOperations
  ) {
    this.messagingService = messagingService;
    this.dataverseService = dataverseService;
  }

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

  getStartConversationActivity(): Activity | null {
    return this.startConversationActivity;
  }

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
