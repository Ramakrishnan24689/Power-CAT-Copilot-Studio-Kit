/**
 * Sample bot components for testing local YAML parsing
 * Includes various component types to test the processing logic
 */

import type { BotComponent } from '../../types';

export const sampleBotComponents: { value: BotComponent[] } = {
    value: [
        // Type 0: Topic
        {
            botcomponentid: '11111111-1111-1111-1111-111111111111',
            name: 'Greeting Topic',
            componenttype: 0,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: AdaptiveDialog
modelDisplayName: Greeting Topic
modelDescription: Handles user greetings and welcomes them
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    displayName: Greeting Intent
  actions:
    - kind: SendActivity
      id: sendResponse
      activity: Welcome! How can I help you today?
inputType:
  properties:
    userName:
      displayName: User Name
      description: Name of the user
outputType:
  properties:
    responseMessage:
      displayName: Response Message
      description: The greeting message sent to user`,
            description: 'Main greeting topic',
        },
        
        // Type 8: TopicV2 (missing model name to test edge case)
        {
            botcomponentid: '22222222-2222-2222-2222-222222222222',
            name: 'Energy Feedback Topic',
            componenttype: 8,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: AdaptiveDialog
modelDescription: Collects energy usage feedback from users
beginDialog:
  kind: OnRecognizedIntent
  id: main
  intent:
    displayName: Energy Feedback
  actions:
    - kind: SendActivity
      id: sendResponse
      activity: Please provide your energy usage feedback
inputType:
  properties:
    feedbackType:
      displayName: Feedback Type
outputType:
  properties:
    feedbackResult:
      displayName: Feedback Result
      description: Result of feedback processing`,
        },
        
        // Type 9: CustomGPT (with instructions field per real structure)
        {
            botcomponentid: '33333333-3333-3333-3333-333333333333',
            name: 'Energy Feedback Collector GPT',
            componenttype: 9,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: GptComponentMetadata
instructions: You are copilot studio agent reviewer. When asked to review an agent by providing a Bot ID or name, use the Agent Review topic to initiate conversation and review the agent and provide response back.
responseInstructions:
gptCapabilities:
  webBrowsing: false
  codeInterpreter: false
conversationStarters:
  - title: Review Agent
    text: I want to review an Agent
aISettings:
  model:
    kind: PreviewModels
    modelNameHint: GPT5Auto
  extensionData:
    lastUsedCustomModel: {}
displayName: Agent Reviewer
tools:`,
        },
        
        // Type 4: Dialog
        {
            botcomponentid: '44444444-4444-4444-4444-444444444444',
            name: 'Validate Feedback Dialog',
            componenttype: 4,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: Dialog
description: Validates energy feedback before storage`,
        },
        
        // Type 10: Action
        {
            botcomponentid: '55555555-5555-5555-5555-555555555555',
            name: 'Store Feedback Action',
            componenttype: 10,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: Action
description: Stores validated feedback in database`,
        },
        
        // Type 15: Tool (with agent instructions and model metadata)
        {
            botcomponentid: '66666666-6666-6666-6666-666666666666',
            name: 'Calculate Energy Score Tool',
            componenttype: 15,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: TaskDialog
modelDisplayName: Evaluate Copilot Studio Agent
modelDescription: A tool to review an agent aka bot whenever its id is provided
inputs:
  - kind: ManualTaskInput
    propertyName: text
    value: =Global.varBotID
outputs:
  - propertyName: review_result
action:
  kind: InvokeFlowTaskAction
  flowId: 3b131928-8094-f011-b41c-6045bdef4136
agentInstructions: |
  This tool calculates the energy efficiency score based on user feedback.
  Use this when users provide energy consumption data.
outputMode: All
triggerCondition: false`,
        },
        
        // Type 16: KnowledgeSource
        {
            botcomponentid: '77777777-7777-7777-7777-777777777777',
            name: 'Energy Guidelines Knowledge Base',
            componenttype: 16,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: KnowledgeSource
source: Energy efficiency guidelines and best practices
indexStatus: Indexed`,
        },
        
        // Type 16: Another knowledge source (document)
        {
            botcomponentid: '88888888-8888-8888-8888-888888888888',
            name: 'Technical Design Document draft v0.1.docx',
            componenttype: 16,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: KnowledgeSource
source: Technical design documentation for the system
indexStatus: Pending`,
        },
        
        // Type 19: TestCase
        {
            botcomponentid: '99999999-9999-9999-9999-999999999999',
            name: 'Test Greeting Flow',
            componenttype: 19,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: TestCase
scenario: Test basic greeting conversation
expectedOutput: Welcome message displayed`,
        },
        
        // Topic with missing variable names
        {
            botcomponentid: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
            name: 'Incomplete Variable Topic',
            componenttype: 0,
            parentbotid: 'bb1b386f-072e-47a5-9c92-0a27b30e90bc',
            data: `kind: AdaptiveDialog
modelName: Test Model
modelDescription: Testing missing variable metadata
inputType:
  properties:
    input1:
      description: Input without name
outputType:
  properties:
    output1:
      displayName: Output Name Only`,
        },
    ],
};
