import React, { useEffect, useState, useCallback, useMemo } from "react";
import ReactWebChat, { createDirectLine } from "botframework-webchat";
import { FluentThemeProvider } from "botframework-webchat-fluent-theme";
import { Spinner } from "@fluentui/react-components";
import { MockDirectLine } from "../mock-directline";

/**
 * Props interface for the BotControl component
 */
interface BotProps {
  userQuery: string; // Current user's query
  defaultActivities: string | null; // Predefined chat activities for emulation mode
  tokenEndpoint: string; // Endpoint for getting DirectLine token
  styleOptions: string; // Custom style options for the chat UI
  enableFluentTheme: boolean; // Toggle for Fluent UI theme
  resetConversation: boolean; // Flag to reset the conversation
  onError: (error: string | null) => void; // Error callback
}

/**
 * BotControl Component
 * Handles both real-time chat and emulated chat experiences using Bot Framework's DirectLine
 */
const BotControl: React.FC<BotProps> = ({
  userQuery,
  defaultActivities,
  tokenEndpoint,
  styleOptions,
  enableFluentTheme,
  resetConversation,
  onError,
}) => {
  const [directLine, setDirectLine] = useState<any>(null);
  const [key, setKey] = useState(0);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDefaultActivitiesRendered, setIsDefaultActivitiesRendered] =
    useState(false);

  // Determines if we should use emulated mode based on defaultActivities
  const isEmulatedMode = useMemo(() => {
    return (
      defaultActivities !== null &&
      defaultActivities !== "{}" &&
      defaultActivities !== ""
    );
  }, [defaultActivities]);

  // Validates the emulated mode configuration and returns parsed activities
  const validateEmulatedMode = useCallback(() => {
    try {
      if (!defaultActivities) {
        throw new Error("Default activities are required");
      }

      const activities = JSON.parse(defaultActivities);
      if (!Array.isArray(activities) || activities.length === 0) {
        throw new Error("Default activities must be a non-empty array");
      }

      return activities;
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new Error("Default activities must be a valid JSON string");
      }
      throw err;
    }
  }, [defaultActivities]);

  // Validates and parses style options
  const validateStyleOptions = useCallback(() => {
    if (!styleOptions) return {};
    try {
      return JSON.parse(styleOptions);
    } catch (err) {
      throw new Error("Style Options must be a valid JSON string");
    }
  }, [styleOptions]);

  // Initializes DirectLine client based on mode (emulated or real-time)
  const initializeDirectLine = useCallback(async () => {
    try {
      setDirectLine(null);
      setIsInitialized(false);
      setIsDefaultActivitiesRendered(false);
      onError(null);

      if (!defaultActivities && !tokenEndpoint && !userQuery) {
        throw new Error(
          "Default activities, Token endpoint, and User query are all missing"
        );
      }

      let mockDirectLine = null;

      // Handle Default Activities
      if (isEmulatedMode) {
        const activities = validateEmulatedMode();
        mockDirectLine = new MockDirectLine(activities);
        setDirectLine(mockDirectLine);
        setIsInitialized(true);
      }

      // Handle Token Endpoint
      if (tokenEndpoint) {
        if (!userQuery) {
          throw new Error(
            "User query is required when Token endpoint is provided"
          );
        }

        if (
          !tokenEndpoint.includes("/powervirtualagents") ||
          !tokenEndpoint.includes("api-version")
        ) {
          throw new Error("Invalid token endpoint format");
        }

        // Extract endpoint information
        const environmentEndPoint = tokenEndpoint.slice(
          0,
          tokenEndpoint.indexOf("/powervirtualagents")
        );
        const apiVersion = tokenEndpoint
          .slice(tokenEndpoint.indexOf("api-version"))
          .split("=")[1];
        const regionalChannelSettingsURL = `${environmentEndPoint}/powervirtualagents/regionalchannelsettings?api-version=${apiVersion}`;

        const [regionalResponse, tokenResponse] = await Promise.all([
          fetch(regionalChannelSettingsURL),
          fetch(tokenEndpoint),
        ]);

        if (!regionalResponse.ok || !tokenResponse.ok) {
          throw new Error("Failed to initialize chat connection");
        }

        const [regionalData, conversationInfo] = await Promise.all([
          regionalResponse.json(),
          tokenResponse.json(),
        ]);

        if (
          !regionalData.channelUrlsById?.directline ||
          !conversationInfo.token
        ) {
          throw new Error("Invalid chat configuration");
        }

        // Create real DirectLine client
        const realDirectLine = createDirectLine({
          token: conversationInfo.token,
          domain: `${regionalData.channelUrlsById.directline}v3/directline`,
        });

        // If we have both mock and real DirectLine, use real one after mock
        if (mockDirectLine) {
          setTimeout(() => {
            setDirectLine(realDirectLine);
            setIsDefaultActivitiesRendered(true);
          }, 1000); // Give time for mock activities to render
        } else {
          setDirectLine(realDirectLine);
          setIsInitialized(true);
        }
      }
    } catch (err: any) {
      onError(err.message);
      setDirectLine(null);
      setIsInitialized(false);
    }
  }, [tokenEndpoint, isEmulatedMode, validateEmulatedMode, userQuery, onError]);

  // Initialize DirectLine when component mounts or dependencies change
  useEffect(() => {
    initializeDirectLine();
  }, [initializeDirectLine]);

  // Handle user messages in real-time mode
  useEffect(() => {
    let subscription: any;

    // Only post activity if we have token endpoint and user query, and default activities are rendered
    if (
      directLine &&
      userQuery &&
      tokenEndpoint &&
      isInitialized &&
      (!isEmulatedMode || isDefaultActivitiesRendered)
    ) {
      directLine
        .postActivity({
          type: "message",
          text: userQuery,
          textFormat: "plain",
        })
        .subscribe({
          error: (err: any) =>
            onError(`Failed to send message: ${err.message}`),
        });

      // Process incoming messages
      subscription = directLine.activity$.subscribe((activity: any) => {
        if (activity.type === "message" && activity.textFormat === "markdown") {
          activity.text = activity.text.replace(/[*_~`#>[\]()!-]/g, "");
          activity.textFormat = "plain";
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [
    directLine,
    userQuery,
    tokenEndpoint,
    isInitialized,
    isEmulatedMode,
    isDefaultActivitiesRendered,
    onError,
  ]);

  // Reset conversation when needed
  useEffect(() => {
    initializeDirectLine();
    setKey((prev) => prev + 1);
  }, [resetConversation, enableFluentTheme, initializeDirectLine]);

  // Parse style options
  const parsedStyleOptions = useMemo(() => {
    try {
      return validateStyleOptions();
    } catch (err: any) {
      onError(err.message);
      return {};
    }
  }, [validateStyleOptions, onError]);

  // Create WebChat component with current configuration
  const webChatComponent = useMemo(
    () => (
      <ReactWebChat
        key={key}
        directLine={directLine}
        styleOptions={{
          ...parsedStyleOptions,
        }}
      />
    ),
    [directLine, key, parsedStyleOptions]
  );

  // Render component based on current state
  const renderContent = useMemo(() => {
    if (!directLine || !isInitialized) {
      return <Spinner label="Loading..." className="loadingSpinner" />;
    }

    if (enableFluentTheme) {
      return (
        <div className="webchat-container">
          <FluentThemeProvider>{webChatComponent}</FluentThemeProvider>
        </div>
      );
    }

    return <div className="webchat-container">{webChatComponent}</div>;
  }, [directLine, isInitialized, enableFluentTheme, webChatComponent]);

  return <div className="webchat-container">{renderContent}</div>;
};

export default BotControl;
