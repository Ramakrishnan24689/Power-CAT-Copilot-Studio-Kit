import { MessagingService } from "./MessagingService";
import { MultiturnDataverseBridge } from "./MultiturnDataverseBridge";
import { MultiturnTestOrchestrator } from "./MultiturnTestOrchestrator";
import { TestExecutionEngine } from "./TestExecutionEngine";
import { ResponseValidationEngine } from "../shared/utils/ResponseValidationEngine";
import type {
  AgentTestCase,
  AgentResponse,
  AgentConfiguration,
} from "../shared/models/DataModels";

/**
 * Constants for MultiturnConversationManager
 */
const MULTITURN_CONVERSATION_CONSTANTS = {
  // User-friendly error messages
  ERROR_MESSAGES: {
    SERVICES_REQUIRED:
      "Required services are not available. Please refresh and try again.",
    CONVERSATION_CONTEXT_FAILED:
      "Unable to start conversation with the agent. Please check your connection and try again.",
  },
} as const;

/**
 * Manages multiturn conversation scenarios for agent testing
 */
export class MultiturnConversationManager {
  private readonly conversationManager: MultiturnTestOrchestrator;
  private readonly executionEngine: TestExecutionEngine;

  /**
   * Initialize MultiturnConversationManager with required services
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

    // Initialize specialized service components
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
   * Executes a complete multiturn conversation test with parent-child structure
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
    // Establish conversation context
    const conversationId =
      await this.conversationManager.establishConversationContext(
        parentTestCase
      );

    if (!conversationId) {
      throw new Error(
        MULTITURN_CONVERSATION_CONSTANTS.ERROR_MESSAGES.CONVERSATION_CONTEXT_FAILED
      );
    }

    // Create parent test result placeholder
    const parentTestResultId =
      await this.conversationManager.createParentTestResult(
        parentTestCase,
        testRunId,
        conversationId
      );

    if (!parentTestResultId) {
      // Log warning but continue execution
    }

    // Execute child tests using execution engine
    const childResults = await this.executionEngine.executeChildTests(
      parentTestCase.childTests!,
      conversationId,
      testRunId,
      configuration,
      parentTestResultId || undefined
    );

    // Generate execution summary
    const summary = this.executionEngine.generateExecutionSummary(childResults);

    // Return overall success status
    return summary.overallSuccess;
  }

  /**
   * Validates response against expected outcome
   */
  async compareResponses(
    response: AgentResponse,
    testCase: AgentTestCase
  ): Promise<boolean> {
    try {
      if (!testCase.expectedResponse) {
        // No expected response means we just check for successful execution
        return response.success && !response.error;
      }

      // Use ResponseValidationEngine for response comparison
      const comparisonMethod = testCase.comparisonOperatorCode ?? 1;

      const isMatch = ResponseValidationEngine.validateResponse(
        response.message,
        testCase.expectedResponse,
        comparisonMethod
      );

      return isMatch;
    } catch (error) {
      return false;
    }
  }

  /**
   * Gets the comparison method for a test case
   */
  getComparisonMethod(testCase: AgentTestCase): number {
    return testCase.comparisonOperatorCode ?? 1;
  }

  /**
   * Checks if test execution should terminate early based on test criticality
   */
  shouldTerminateEarly(testCase: AgentTestCase, testPassed: boolean): boolean {
    return testCase.critical === true && !testPassed;
  }

  /**
   * Evaluates overall success of multiturn test based on child results
   */
  evaluateOverallSuccess(
    childResults: {
      testCase: AgentTestCase;
      response: AgentResponse;
      success: boolean;
      actualResultCode: number;
    }[]
  ): boolean {
    return this.executionEngine.evaluateOverallSuccess(childResults);
  }
}
