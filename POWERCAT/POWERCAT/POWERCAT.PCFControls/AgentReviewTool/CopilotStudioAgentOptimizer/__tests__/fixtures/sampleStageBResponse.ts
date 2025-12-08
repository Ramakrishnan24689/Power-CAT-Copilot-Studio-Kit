export const sampleStageBResponse = {
  "Patterns": [
    {
      "PatternName": "Unclear Model Name",
      "PatternDescription": "Model Name needs improvement",
      "Status": false,
      "Topics": [
        {
          "item": "User Login",
          "current": "Login Process",
          "suggested": "AuthenticateUserWithCredentials"
        },
        {
          "item": "Get Product",
          "current": "Get Data",
          "suggested": "RetrieveProductDetailsById"
        },
        {
          "item": "Update Customer Address",
          "current": "Update Address",
          "suggested": "UpdateCustomerAddressById"
        }
      ],
      "Recommendation": "Rename to be more descriptive. Example: Instead of 'Login Process', use 'AuthenticateUserWithCredentials'"
    },
    {
      "PatternName": "Unclear Model Description",
      "PatternDescription": "Model Description needs improvement",
      "Status": false,
      "Topics": [
        {
          "item": "User Login",
          "current": "Login",
          "suggested": "Authenticates a user when username and password are provided"
        },
        {
          "item": "Get Product",
          "current": "Get product data",
          "suggested": "Retrieves product details when a user supplies a product ID"
        },
        {
          "item": "Update Customer Address",
          "current": "Updates address",
          "suggested": "Updates the customer's address when given customer ID and new address"
        }
      ],
      "Recommendation": "Add action-oriented description with trigger context. Example: Instead of 'Login', use 'Authenticates a user when username and password are provided'"
    },
    {
      "PatternName": "Unclear Input Variable Name",
      "PatternDescription": "Model Input Variable Name unclear",
      "Status": false,
      "Topics": [
        {
          "item": "User Login",
          "variable": "userInput",
          "suggested": "username"
        },
        {
          "item": "User Login",
          "variable": "passInput",
          "suggested": "password"
        },
        {
          "item": "Get Product",
          "variable": "prodInput",
          "suggested": "productId"
        },
        {
          "item": "Update Customer Address",
          "variable": "custIdInput",
          "suggested": "customerId"
        },
        {
          "item": "Update Customer Address",
          "variable": "addrInput",
          "suggested": "address"
        }
      ],
      "Recommendation": "Use descriptive camelCase names that indicate data type and purpose. Example: Instead of 'userInput', use 'username'"
    },
    {
      "PatternName": "Unclear Input Variable Description",
      "PatternDescription": "Model Input Variable Description unclear",
      "Status": false,
      "Topics": [
        {
          "item": "User Login",
          "variable": "userInput",
          "current": "user",
          "suggested": "The username or email used to authenticate the user (string)"
        },
        {
          "item": "User Login",
          "variable": "passInput",
          "current": "pass",
          "suggested": "The user's password for authentication (string)"
        },
        {
          "item": "Get Product",
          "variable": "prodInput",
          "current": "prod id",
          "suggested": "The unique product identifier or SKU (string or number)"
        },
        {
          "item": "Update Customer Address",
          "variable": "custIdInput",
          "current": "cust",
          "suggested": "The unique customer identifier (string or GUID)"
        },
        {
          "item": "Update Customer Address",
          "variable": "addrInput",
          "current": "addr",
          "suggested": "The full new address to set for the customer (string or structured object)"
        }
      ],
      "Recommendation": "Add descriptive explanation including purpose and expected format/type. Example: Instead of 'user', use 'The username or email used to authenticate the user (string)'"
    },
    {
      "PatternName": "Unclear Output Variable Name",
      "PatternDescription": "Model Output Variable Name unclear",
      "Status": false,
      "Topics": [
        {
          "item": "User Login",
          "variable": "outputVar",
          "suggested": "authenticationResult"
        },
        {
          "item": "Get Product",
          "variable": "productOutput",
          "suggested": "productDetails"
        },
        {
          "item": "Update Customer Address",
          "variable": "msgOutput",
          "suggested": "updateStatusMessage"
        }
      ],
      "Recommendation": "Use descriptive camelCase names that indicate data type and purpose. Example: Instead of 'outputVar', use 'authenticationResult'"
    },
    {
      "PatternName": "Unclear Output Variable Description",
      "PatternDescription": "Model Output Variable Description unclear",
      "Status": false,
      "Topics": [
        {
          "item": "User Login",
          "variable": "outputVar",
          "current": "response",
          "suggested": "Result indicating success or failure and any session token or error details (JSON)"
        },
        {
          "item": "Get Product",
          "variable": "productOutput",
          "current": "product info",
          "suggested": "Complete product details including name, price, and availability (JSON)"
        },
        {
          "item": "Update Customer Address",
          "variable": "msgOutput",
          "current": "msg",
          "suggested": "A human-readable message describing the outcome of the address update (string)"
        }
      ],
      "Recommendation": "Add descriptive explanation including purpose and expected format/type. Example: Instead of 'response', use 'Result indicating success or failure and any session token or error details (JSON)'"
    }
  ]
};