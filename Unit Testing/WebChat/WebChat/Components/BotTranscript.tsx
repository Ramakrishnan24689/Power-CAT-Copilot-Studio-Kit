import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./css/BotTranscriptStyle.css";
import Transcript from "../src/model/Transcript";
import AdaptiveCardRenderer from "./AdaptiveCardRenderer";

/**
 * BotTranscript Component
 * 
 * This component is responsible for rendering a transcript of bot and user messages in a chat interface.
 * It supports markdown formatting for message text and renders adaptive card attachments.
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

    return (
        <div className="transcript-container">
            <div className="transcript">
                {transcript.activities && transcript.activities
                    // Filter to include only 'message' type activities
                    .filter(activity => activity.type === 'message')
                    // Map through each activity to render the message
                    .map((activity, index) => (
                        <div key={index} className={`message ${activity.from.role === 1 ? 'user' : 'bot'}`}>
                            {/* Avatar image based on the sender's role */}
                            <img
                                src={activity.from.role === 0 ? 'WebResources/cat_/powercat/img/webchatbotavatar.svg' : 'WebResources/cat_/powercat/img/webchatuseravatar.svg'}
                                alt={`${activity.from.role === 0 ? 'Bot' : 'User'} avatar`}
                                className="avatar"
                            />
                            <div className="message-content">
                                {/* Render the message text with markdown support */}
                                {activity.text && (
                                    <ReactMarkdown
                                        children={activity.text}
                                        remarkPlugins={[remarkGfm]}
                                        components={{
                                            p: ({ node, ...props }) => <p {...props} className="message-text" />,
                                            h1: ({ node, ...props }) => <h1 {...props} className="message-text" />,
                                            h2: ({ node, ...props }) => <h2 {...props} className="message-text" />,
                                            h3: ({ node, ...props }) => <h3 {...props} className="message-text" />,
                                            code: ({ node, ...props }) => <code {...props} className="message-text" />,
                                            blockquote: ({ node, ...props }) => <blockquote {...props} className="message-text" />,
                                        }}
                                    />
                                )}
                                {/* Render adaptive card attachments if available */}
                                {activity.attachments && activity.attachments.length > 0 && activity.attachments.map((attachment, idx) => (
                                    <div key={idx} className="adaptive-card-wrapper">
                                        {attachment.contentType === 'application/vnd.microsoft.card.adaptive' && (
                                            <AdaptiveCardRenderer card={attachment.content} />
                                        )}
                                    </div>
                                ))}
                                {/* Display the timestamp of the message */}
                                <div className="message-timestamp">
                                    {formatTimestamp(activity.timestamp)}
                                </div>
                            </div>
                        </div>
                    ))}
            </div>
        </div>
    );
};

export default BotTranscript;
