import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./css/BotTranscriptStyle.css";
import Transcript, { Activity } from "../src/model/Transcript";
import AdaptiveCardRenderer from "./AdaptiveCardRenderer";

/**
 * BotTranscript Component
 *
 * This component renders only the messages exchanged between the user and the bot.
 */

// Define the props for the BotTranscript component
interface BotTranscriptProps {
  transcript: Transcript;
}

// Functional component to render the bot transcript
const BotTranscript: React.FC<BotTranscriptProps> = ({ transcript }) => {
  /**
   * Formats a Unix timestamp into a readable string.
   *
   * @param timestamp The Unix timestamp to format.
   * @returns A formatted date string.
   */
  const formatTimestamp = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString(undefined, {
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      hour12: true,
    });
  };

  /**
   * Renders the content of a message.
   * This could be either markdown text or key-value pairs (if present).
   *
   * @param activity The activity object containing the message details.
   * @returns The JSX for the message content.
   */
  const renderMessageContent = (activity: Activity) => {
    if (activity.text) {
      return (
        <ReactMarkdown
          children={activity.text}
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ node, ...props }) => (
              <p {...props} className="message-text" />
            ),
            h1: ({ node, ...props }) => (
              <h1 {...props} className="message-text" />
            ),
            h2: ({ node, ...props }) => (
              <h2 {...props} className="message-text" />
            ),
            h3: ({ node, ...props }) => (
              <h3 {...props} className="message-text" />
            ),
            code: ({ node, ...props }) => (
              <code {...props} className="message-text" />
            ),
            blockquote: ({ node, ...props }) => (
              <blockquote {...props} className="message-text" />
            ),
          }}
        />
      );
    } else if (activity.value) {
      const filteredValues = Object.entries(activity.value).filter(
        ([key, _]) => key !== "actionSubmitId"
      );

      return (
        <div className="message-text">
          {filteredValues.map(([key, value], index) => (
            <div key={index}>{value}</div>
          ))}
        </div>
      );
    } else {
      return null;
    }
  };

  /**
   * Renders OAuth card if present.
   *
   * @param content The content of the OAuth card.
   * @returns JSX for rendering OAuth card.
   */
  const renderOAuthCard = (content: any) => {
    return (
      <div className="oauth-card">
        <p>{content.text}</p>
        <a
          href="#"
          onClick={(e) => e.preventDefault()}
          style={{
            color: "blue",
            textDecoration: "underline",
            cursor: "default",
          }}
        >
          {content.buttons[0].title}
        </a>
      </div>
    );
  };

  /**
   * Renders a single activity (message).
   *
   * @param activity The activity object to render.
   * @param index The index of the activity in the transcript.
   * @returns JSX for rendering the activity or null if no meaningful content.
   */
  const renderActivity = (activity: Activity, index: number) => {
    const messageContent = renderMessageContent(activity);

    // Check if there are attachments and if they have renderable content
    const hasRenderableAttachments = (activity.attachments ?? []).some((attachment) => {
      if (attachment.contentType === "application/vnd.microsoft.card.adaptive") {
        return attachment.content;
      }
      if (attachment.contentType === "application/vnd.microsoft.card.oauth") {
        return (
          "text" in attachment.content &&
          "buttons" in attachment.content &&
          attachment.content.text &&
          Array.isArray((attachment.content as { buttons: any[] }).buttons) &&
          (attachment.content as { buttons: any[] }).buttons.length > 0
        );
      }
      return false;
    });

    if (!messageContent && !hasRenderableAttachments) {
      return null;
    }

    return (
      <div
        key={index}
        className={`message ${activity.from?.role === 1 ? "user" : "bot"}`}
      >
        {/* Render the avatar based on sender (user/bot) */}
        <img
          src={
            activity.from?.role === 0
              ? "WebResources/cat_/powercat/img/webchatbotavatar.svg"
              : "WebResources/cat_/powercat/img/webchatuseravatar.svg"
          }
          alt={`${activity.from?.role === 0 ? "Bot" : "User"} avatar`}
          className="avatar"
        />
        <div className="message-content">
          {/* Render message content */}
          {messageContent}

          {/* Render adaptive or OAuth card attachments if present */}
          {hasRenderableAttachments &&
            (activity.attachments ?? []).map((attachment, idx) => {
              if (attachment.contentType === "application/vnd.microsoft.card.adaptive") {
                return (
                  <div key={idx} className="adaptive-card-wrapper">
                    <AdaptiveCardRenderer card={attachment.content} />
                  </div>
                );
              }

              if (attachment.contentType === "application/vnd.microsoft.card.oauth") {
                return renderOAuthCard(attachment.content);
              }
              return null;
            })}

          {/* Display the message timestamp */}
          <div className="message-timestamp">
            {formatTimestamp(activity.timestamp)}
          </div>
        </div>
      </div>
    );
  };

  // Filter and map valid activities
  const validActivities = transcript.activities
    ?.filter(
      (activity) =>
        activity.type === "message" &&
        (activity.text || activity.value || (activity.attachments?.length ?? 0) > 0)
    )
    .map((activity, index) => renderActivity(activity, index))
    .filter(Boolean);

  if (!validActivities?.length) {
    return null;
  }

  return (
    <div className="transcript-container">
      <div className="transcript">{validActivities}</div>
    </div>
  );
};

export default BotTranscript;