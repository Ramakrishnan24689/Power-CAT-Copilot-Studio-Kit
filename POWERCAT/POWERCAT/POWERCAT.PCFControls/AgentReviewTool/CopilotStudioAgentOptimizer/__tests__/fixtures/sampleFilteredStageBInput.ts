/**
 * COMPREHENSIVE SAMPLE FOR STAGE B TESTING
 * 
 * This sample represents the FILTERED output sent to Stage B after:
 * 1. System topics removed
 * 2. Empty topics removed  
 * 3. Unnecessary fields stripped (Tools, KnowledgeSources, TestCases, Conditions)
 * 
 * Stage B ONLY evaluates clarity of:
 * - ModelName, ModelDescription
 * - InputVariables (VariableName, VariableDescription)
 * - OutputVariables (VariableName, VariableDescription)
 * 
 * This sample covers ALL 6 unclear patterns:
 * 1. Unclear Model Name
 * 2. Unclear Model Description  
 * 3. Unclear Input Variable Name
 * 4. Unclear Input Variable Description
 * 5. Unclear Output Variable Name
 * 6. Unclear Output Variable Description
 * 
 * IMPORTANT: Excess Tools is now checked in code (checkExcessTools), not by Stage B
 */

export const sampleFilteredStageBInput = {
  "Components": {
    "Topics": [
      {
        "TopicName": "Order Status Check",
        "InputVariables": [
          {
            "VariableName": "input1",
            "VariableDescription": ""
          }
        ],
        "ModelName": "Process",
        "ModelDescription": "Process order",
        "OutputVariables": [
          {
            "VariableName": "var",
            "VariableDescription": "result"
          }
        ]
      },
      {
        "TopicName": "Product Information Lookup",
        "InputVariables": [
          {
            "VariableName": "ProductIDInput",
            "VariableDescription": "product"
          },
          {
            "VariableName": "categoryInput",
            "VariableDescription": "The category of the product"
          }
        ],
        "ModelName": "Get Product Info",
        "ModelDescription": "Gets product information from database when user asks about a product by providing product ID or name",
        "OutputVariables": [
          {
            "VariableName": "ProductDetailsOutput",
            "VariableDescription": "Contains product details"
          }
        ]
      },
      {
        "TopicName": "Refund Request Processing",
        "InputVariables": [
          {
            "VariableName": "orderNumber",
            "VariableDescription": "The unique order identifier provided by the customer (format: ORD-XXXXXX)"
          },
          {
            "VariableName": "refundReasonInput",
            "VariableDescription": "reason"
          }
        ],
        "ModelName": "Stage A",
        "ModelDescription": "Handles refunds",
        "OutputVariables": [
          {
            "VariableName": "RefundStatusOutput",
            "VariableDescription": "The approval status of the refund request with transaction ID (object: {approved: boolean, transactionId: string, estimatedDays: number})"
          },
          {
            "VariableName": "out",
            "VariableDescription": "data"
          }
        ]
      },
      {
        "TopicName": "Technical Support Escalation",
        "InputVariables": [
          {
            "VariableName": "issueDescriptionVar",
            "VariableDescription": ""
          }
        ],
        "ModelName": "Escalate Issue",
        "ModelDescription": "Escalate",
        "OutputVariables": [
          {
            "VariableName": "ticketNumberOutput",
            "VariableDescription": ""
          }
        ]
      },
      {
        "TopicName": "Shipping Address Update",
        "InputVariables": [
          {
            "VariableName": "temp",
            "VariableDescription": "address info"
          }
        ],
        "ModelName": "Topic 5",
        "ModelDescription": "Update address for shipping when customer provides new address details and order is not yet shipped",
        "OutputVariables": [
          {
            "VariableName": "result1",
            "VariableDescription": "Confirmation message shown to user"
          }
        ]
      },
      {
        "TopicName": "Account Deletion Request",
        "InputVariables": [],
        "ModelName": "Delete User Account",
        "ModelDescription": "Processes account deletion when user requests to permanently remove their account and all associated data from the system",
        "OutputVariables": [
          {
            "VariableName": "deletionConfirmationToken",
            "VariableDescription": "Unique token sent to user email for confirming the account deletion (format: UUID string)"
          }
        ]
      },
      {
        "TopicName": "Payment Processing",
        "InputVariables": [
          {
            "VariableName": "x",
            "VariableDescription": "amt"
          }
        ],
        "ModelName": "",
        "ModelDescription": "Handles payment transactions",
        "OutputVariables": []
      },
      {
        "TopicName": "Inventory Check",
        "InputVariables": [],
        "ModelName": "Check Inventory",
        "ModelDescription": "",
        "OutputVariables": [
          {
            "VariableName": "inventoryCountOutput",
            "VariableDescription": "count"
          }
        ]
      }
    ]
  }
};

/**
 * EDGE CASE COVERAGE:
 * 
 * 1. ✅ ModelName exists, ModelDescription missing: "Inventory Check"
 * 2. ✅ ModelDescription exists, ModelName missing: "Payment Processing"
 * 3. ✅ Both ModelName and ModelDescription exist: Most topics
 * 4. ✅ Input variables with names: All topics except "Account Deletion Request", "Inventory Check"
 * 5. ✅ Input variables with descriptions: Some topics (mix of empty/unclear/good)
 * 6. ✅ Output variables with names: Most topics
 * 7. ✅ Output variables with descriptions: Mix of empty/unclear/good
 * 
 * EXPECTED STAGE B FINDINGS:
 * 
 * Unclear Model Name (6 flagged):
 * - "Process" (Order Status Check) → filler word
 * - "Stage A" (Refund Request Processing) → filler word
 * - "Escalate Issue" (Technical Support Escalation) → too generic
 * - "Topic 5" (Shipping Address Update) → numbered topic
 * - "Check Inventory" (Inventory Check) → lacks trigger context
 * 
 * Unclear Model Description (4 flagged):
 * - "Process order" (Order Status Check) → too short, no trigger
 * - "Handles refunds" (Refund Request Processing) → too short, no trigger
 * - "Escalate" (Technical Support Escalation) → too short
 * - "Handles payment transactions" (Payment Processing) → no trigger word
 * 
 * Unclear Input Variable Name (7 flagged):
 * - "input1" (Order Status Check) → generic
 * - "ProductIDInput" (Product Information Lookup) → vague suffix
 * - "categoryInput" (Product Information Lookup) → vague suffix
 * - "refundReasonInput" (Refund Request Processing) → vague suffix
 * - "issueDescriptionVar" (Technical Support Escalation) → vague suffix
 * - "temp" (Shipping Address Update) → generic
 * - "x" (Payment Processing) → too short, no meaning
 * 
 * Unclear Input Variable Description (5 flagged):
 * - input1: "" (empty)
 * - ProductIDInput: "product" (too short, single word)
 * - refundReasonInput: "reason" (too short, single word)
 * - issueDescriptionVar: "" (empty)
 * - temp: "address info" (too short, generic)
 * - x: "amt" (too short)
 * 
 * Unclear Output Variable Name (5 flagged):
 * - "var" (Order Status Check) → generic
 * - "ProductDetailsOutput" (Product Information Lookup) → vague suffix
 * - "RefundStatusOutput" (Refund Request Processing) → vague suffix
 * - "ticketNumberOutput" (Technical Support Escalation) → vague suffix
 * - "out" (Refund Request Processing) → generic
 * - "result1" (Shipping Address Update) → generic + numbered
 * - "inventoryCountOutput" (Inventory Check) → vague suffix
 * 
 * Unclear Output Variable Description (4 flagged):
 * - var: "result" (too short, single word, generic)
 * - ProductDetailsOutput: "Contains product details" (vague, generic tokens)
 * - out: "data" (too short, generic)
 * - ticketNumberOutput: "" (empty)
 * - result1: "Confirmation message shown to user" (lacks format info but > 15 chars, borderline)
 * - inventoryCountOutput: "count" (too short, single word)
 * 
 * Good Examples (NOT flagged):
 * - "orderNumber" variable → clear, semantic
 * - "deletionConfirmationToken" → descriptive, clear purpose
 * - "Delete User Account" model name → clear action + object
 * - "Processes account deletion when..." → action verb + trigger
 */

// ==============================================================================
// VARIATION 1: ROOKIE DEVELOPER INPUT - Bad but Recoverable
// Tests: Abbreviations, generic suffixes, short descriptions
// ==============================================================================
export const rookieDeveloperInput = {
  "Components": {
    "Topics": [
      {
        "TopicName": "User Login",
        "InputVariables": [
          {
            "VariableName": "userInput",
            "VariableDescription": "user"
          },
          {
            "VariableName": "passInput",
            "VariableDescription": "pass"
          }
        ],
        "ModelName": "Login Process",
        "ModelDescription": "Login",
        "OutputVariables": [
          {
            "VariableName": "outputVar",
            "VariableDescription": "response"
          }
        ]
      },
      {
        "TopicName": "Get Product",
        "InputVariables": [
          {
            "VariableName": "prodInput",
            "VariableDescription": "prod id"
          }
        ],
        "ModelName": "Get Data",
        "ModelDescription": "Get product data",
        "OutputVariables": [
          {
            "VariableName": "productOutput",
            "VariableDescription": "product info"
          }
        ]
      },
      {
        "TopicName": "Update Customer Address",
        "InputVariables": [
          {
            "VariableName": "custIdInput",
            "VariableDescription": "cust"
          },
          {
            "VariableName": "addrInput",
            "VariableDescription": "addr"
          }
        ],
        "ModelName": "Update Address",
        "ModelDescription": "Updates address",
        "OutputVariables": [
          {
            "VariableName": "msgOutput",
            "VariableDescription": "msg"
          }
        ]
      }
    ]
  }
};

// ==============================================================================
// VARIATION 2: COPY-PASTE DEVELOPER INPUT - Very Poor Quality
// Tests: Numbered topics, self-referential names, empty descriptions
// ==============================================================================
export const copyPasteDeveloperInput = {
  "Components": {
    "Topics": [
      {
        "TopicName": "Topic 1",
        "InputVariables": [
          {
            "VariableName": "input1",
            "VariableDescription": ""
          },
          {
            "VariableName": "input2",
            "VariableDescription": ""
          }
        ],
        "ModelName": "Topic 1",
        "ModelDescription": "Topic 1",
        "OutputVariables": [
          {
            "VariableName": "output1",
            "VariableDescription": ""
          }
        ]
      },
      {
        "TopicName": "Topic 2",
        "InputVariables": [
          {
            "VariableName": "input1",
            "VariableDescription": ""
          }
        ],
        "ModelName": "Topic 2",
        "ModelDescription": "Topic 2",
        "OutputVariables": [
          {
            "VariableName": "output1",
            "VariableDescription": "output"
          }
        ]
      },
      {
        "TopicName": "Topic 3",
        "InputVariables": [],
        "ModelName": "Topic 3",
        "ModelDescription": "",
        "OutputVariables": [
          {
            "VariableName": "result",
            "VariableDescription": "result"
          }
        ]
      }
    ]
  }
};

// ==============================================================================
// VARIATION 3: MINIMAL EFFORT INPUT - Extremely Poor
// Tests: Single character names, ultra-short descriptions, all filler words
// ==============================================================================
export const minimalEffortInput = {
  "Components": {
    "Topics": [
      {
        "TopicName": "Do Something",
        "InputVariables": [
          {
            "VariableName": "x",
            "VariableDescription": "x"
          },
          {
            "VariableName": "y",
            "VariableDescription": ""
          }
        ],
        "ModelName": "Do It",
        "ModelDescription": "Do",
        "OutputVariables": [
          {
            "VariableName": "z",
            "VariableDescription": "z"
          }
        ]
      },
      {
        "TopicName": "Process",
        "InputVariables": [
          {
            "VariableName": "data",
            "VariableDescription": "data"
          }
        ],
        "ModelName": "Process",
        "ModelDescription": "Process",
        "OutputVariables": [
          {
            "VariableName": "result",
            "VariableDescription": ""
          }
        ]
      },
      {
        "TopicName": "Handle Request",
        "InputVariables": [
          {
            "VariableName": "req",
            "VariableDescription": "r"
          }
        ],
        "ModelName": "Handle",
        "ModelDescription": "h",
        "OutputVariables": [
          {
            "VariableName": "res",
            "VariableDescription": "r"
          }
        ]
      }
    ]
  }
};

// ==============================================================================
// VARIATION 4: MIXED QUALITY INPUT - Real-world Mix
// Tests: Some good, some bad - realistic production scenario
// ==============================================================================
export const mixedQualityInput = {
  "Components": {
    "Topics": [
      {
        "TopicName": "Employee Onboarding",
        "InputVariables": [
          {
            "VariableName": "empId",
            "VariableDescription": "emp"
          },
          {
            "VariableName": "startDate",
            "VariableDescription": "The date when the employee starts working (format: YYYY-MM-DD)"
          }
        ],
        "ModelName": "Onboard Employee",
        "ModelDescription": "Onboards new employee when HR initiates the process",
        "OutputVariables": [
          {
            "VariableName": "onboardingStatus",
            "VariableDescription": "status"
          }
        ]
      },
      {
        "TopicName": "Invoice Processing",
        "InputVariables": [
          {
            "VariableName": "invNum",
            "VariableDescription": "inv"
          },
          {
            "VariableName": "amt",
            "VariableDescription": ""
          }
        ],
        "ModelName": "Process",
        "ModelDescription": "Process invoices",
        "OutputVariables": [
          {
            "VariableName": "approvalResult",
            "VariableDescription": "The result of the approval workflow with approver details"
          }
        ]
      }
    ]
  }
};

// ==============================================================================
// VARIATION 5: EDGE CASE INPUT - Boundary conditions
// Tests: Empty arrays, null-like values, extreme cases
// ==============================================================================
export const edgeCaseInput = {
  "Components": {
    "Topics": [
      {
        "TopicName": "Notification Service",
        "InputVariables": [],
        "ModelName": "Notify",
        "ModelDescription": "Sends notifications",
        "OutputVariables": [
          {
            "VariableName": "notificationId",
            "VariableDescription": "id"
          }
        ]
      },
      {
        "TopicName": "Data Validation",
        "InputVariables": [
          {
            "VariableName": "inputData",
            "VariableDescription": "The data to be validated"
          }
        ],
        "ModelName": "Validate Data",
        "ModelDescription": "Validates incoming data when user submits a form",
        "OutputVariables": []
      },
      {
        "TopicName": "Report Generation",
        "InputVariables": [
          {
            "VariableName": "rptType",
            "VariableDescription": "type"
          },
          {
            "VariableName": "dateRange",
            "VariableDescription": ""
          }
        ],
        "ModelName": "",
        "ModelDescription": "Generates reports when user requests analytics",
        "OutputVariables": [
          {
            "VariableName": "reportOutput",
            "VariableDescription": ""
          }
        ]
      }
    ]
  }
};

// ==============================================================================
// VARIATION 6: COMPLEX DOMAIN INPUT - Rich context
// Tests: Ability to extract domain from complex business scenarios
// ==============================================================================
export const complexDomainInput = {
  "Components": {
    "Topics": [
      {
        "TopicName": "Multi-Factor Authentication Setup",
        "InputVariables": [
          {
            "VariableName": "usr",
            "VariableDescription": "user info"
          },
          {
            "VariableName": "method",
            "VariableDescription": "auth method"
          }
        ],
        "ModelName": "Setup",
        "ModelDescription": "Setup MFA",
        "OutputVariables": [
          {
            "VariableName": "setupResult",
            "VariableDescription": "result"
          }
        ]
      },
      {
        "TopicName": "Subscription Renewal Reminder",
        "InputVariables": [
          {
            "VariableName": "subId",
            "VariableDescription": ""
          }
        ],
        "ModelName": "Send Reminder",
        "ModelDescription": "remind",
        "OutputVariables": [
          {
            "VariableName": "reminderSent",
            "VariableDescription": "sent"
          }
        ]
      },
      {
        "TopicName": "Inventory Restock Alert",
        "InputVariables": [
          {
            "VariableName": "productSku",
            "VariableDescription": "The SKU code of the product that needs restocking"
          },
          {
            "VariableName": "thresholdQty",
            "VariableDescription": "qty"
          }
        ],
        "ModelName": "Alert System",
        "ModelDescription": "Alerts when inventory falls below threshold",
        "OutputVariables": [
          {
            "VariableName": "alertTriggered",
            "VariableDescription": "Whether alert was successfully triggered (boolean)"
          }
        ]
      }
    ]
  }
};

