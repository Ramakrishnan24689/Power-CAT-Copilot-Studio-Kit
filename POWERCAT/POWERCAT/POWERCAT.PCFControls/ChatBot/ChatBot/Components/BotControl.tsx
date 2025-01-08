import React from "react";
import ReactWebChat, { createDirectLine } from "botframework-webchat";
import { FluentThemeProvider } from "botframework-webchat-fluent-theme";
import { Spinner } from "@fluentui/react-components";

interface BotProps {
  userQuery: string;
  tokenEndpoint: string;
  styleOptions: any;
  enableFluentTheme: boolean;
  onError: (error: string | null) => void; // callback for error handling
}

const BotControl: React.FC<BotProps> = ({
  userQuery,
  tokenEndpoint,
  styleOptions,
  enableFluentTheme,
  onError,
}) => {
  const [directLine, setDirectLine] = React.useState<any>(null);

  React.useEffect(() => {
    async function createDirectline() {
      try {
        // Extract environment endpoint and API version from the token endpoint
        const environmentEndPoint = tokenEndpoint.slice(
          0,
          tokenEndpoint.indexOf("/powervirtualagents")
        );
        const apiVersion = tokenEndpoint
          .slice(tokenEndpoint.indexOf("api-version"))
          .split("=")[1];
        const regionalChannelSettingsURL = `${environmentEndPoint}/powervirtualagents/regionalchannelsettings?api-version=${apiVersion}`;

        // Fetch regional channel settings
        const regionalResponse = await fetch(regionalChannelSettingsURL);
        if (!regionalResponse.ok) {
          throw new Error(
            `Failed to fetch regional channel settings. HTTP status: ${regionalResponse.status}`
          );
        }
        const data = await regionalResponse.json();
        const regionalChannelURL = data.channelUrlsById.directline;

        // Fetch token for DirectLine
        const response = await fetch(tokenEndpoint);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch token. HTTP status: ${response.status}`
          );
        }
        const conversationInfo = await response.json();
        const directline = createDirectLine({
          token: conversationInfo.token,
          domain: `${regionalChannelURL}v3/directline`,
        });
        setDirectLine(directline);

        // Clear any existing error
        onError(null);
      } catch (err: any) {
        // Set error state if any error occurs
        onError(err.message);
      }
    }

    onError(null);
    createDirectline();
  }, [tokenEndpoint, onError]);

  // Post user query to bot
  React.useEffect(() => {
    if (directLine && userQuery) {
      directLine
        .postActivity({
          type: "message",
          text: userQuery,
          textFormat: "plain",
        })
        .subscribe({
          error: (err: any) => {
            onError(`Failed to send message: ${err.message}`);
          },
        });

      // Listen for incoming messages and convert them to plain text
      directLine.activity$.subscribe((activity: any) => {
        if (activity.type === "message" && activity.textFormat === "markdown") {
          activity.text = activity.text.replace(/[*_~`#>[\]()!-]/g, ""); // Remove Markdown syntax
          activity.textFormat = "plain"; // Update the text format
        }
      });
    }
  }, [directLine, userQuery]);

  return (
    <div className="webChatContainer">
      {directLine ? (
        enableFluentTheme ? (
          <FluentThemeProvider>
            <ReactWebChat
              directLine={directLine}
              styleOptions={JSON.parse(styleOptions)}
            />
          </FluentThemeProvider>
        ) : (
          <ReactWebChat
            directLine={directLine}
            styleOptions={JSON.parse(styleOptions)}
          />
        )
      ) : (
        <Spinner label="Loading..." className="loadingSpinner" />
      )}
    </div>
  );
};

export default BotControl;
