export const sampleStageAResponse = {
  "IsGenerativeOrchestration": true,
  "BotId": "8b1b3ff7-886b-f011-b4cb-7c1e527d0405",
  "BotName": "Agent Reviewer",
  "AgentInstructions": "You are copilot studio agent reviewer. When asked to review an agent by providing a Bot ID or name, use {System.Bot.Components.Topics.'cr306_agentReviewer.topic.AgentReview'.DisplayName} to initiate conversation and review the agent and provide response back.",
  "Components": {
    "Topics": [
      {
        "Conditions": [],
        "TopicName": "Sign in ",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Goodbye",
        "InputVariables": [
          {
            "VariableDescription": "",
            "VariableName": "GoodByeInputVar"
          }
        ],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": [
          {
            "VariableDescription": "Defined OutputVar",
            "VariableName": "GoodByeOutputVar"
          }
        ]
      },
      {
        "Conditions": [],
        "TopicName": "Conversation Start",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Conversational boosting",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Agent Review",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Reset Conversation",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Stage B - Copilot Pattern Evaluation",
        "InputVariables": [],
        "ModelName": "Stage B - Copilot Pattern Evaluation",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Fallback",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Synonyms",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "This topic helps in identifying  synonyms for a given word",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "End of Conversation",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Greeting",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Stage A - Fetch Copilot Component Details",
        "InputVariables": [],
        "ModelName": "Stage A - Fetch Copilot Component Details",
        "ModelDescription": "Tool to fetch copilot component details from Dataverse table and help review and evaluation",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "On Error",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Thank you",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Stage C - Agent Review Report Generation",
        "InputVariables": [],
        "ModelName": "Stage C - Agent Review Report Generation",
        "ModelDescription": "This tool help in Agent Review Report generation as PDF File.",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Stage A GenAI - Fetch Copilot Component Details",
        "InputVariables": [],
        "ModelName": "Stage A GenAI - Fetch Copilot Component Details",
        "ModelDescription": "Stage A GenAI - Fetch Copilot Component Details",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Escalate",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Agent Reviewer",
        "InputVariables": [],
        "ModelName": "Evaluate Copilot Studio Agent",
        "ModelDescription": "A tool to review an agent aka bot whenever its id is provided",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Multiple Topics Matched",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      },
      {
        "Conditions": [],
        "TopicName": "Start Over",
        "InputVariables": [],
        "ModelName": "",
        "ModelDescription": "",
        "OutputVariables": []
      }
    ],
    "Tools": [
      {
        "item": "Agent Reviewer"
      }
    ],
    "KnowledgeSources": [
      {
        "item": "SitePages"
      }
    ],
    "TestCases": []
  }
};