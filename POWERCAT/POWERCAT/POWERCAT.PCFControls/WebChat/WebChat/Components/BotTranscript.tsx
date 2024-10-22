import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./css/BotTranscriptStyle.css";
import Transcript, { Activity } from "../src/model/Transcript";
import AdaptiveCardRenderer from "./AdaptiveCardRenderer";

/**
 * BotTranscript Component
 * 
 * This component is responsible for rendering a transcript of bot and user messages in a chat interface.
 * It supports markdown formatting for message text and renders adaptive card and OAuth card attachments.
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
                        p: ({ node, ...props }) => <p {...props} className="message-text" />,
                        h1: ({ node, ...props }) => <h1 {...props} className="message-text" />,
                        h2: ({ node, ...props }) => <h2 {...props} className="message-text" />,
                        h3: ({ node, ...props }) => <h3 {...props} className="message-text" />,
                        code: ({ node, ...props }) => <code {...props} className="message-text" />,
                        blockquote: ({ node, ...props }) => <blockquote {...props} className="message-text" />,
                    }}
                />
            );
        } else if (activity.value) {
            const filteredValues = Object.entries(activity.value).filter(
                ([key, _]) => key !== 'actionSubmitId'
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
                    style={{ color: 'blue', textDecoration: 'underline', cursor: 'default' }}
                >
                    {content.buttons[0].title}
                </a>
            </div>
        );
    };
    

    return (
        <div className="transcript-container">
            <div className="transcript">
                {transcript.activities && transcript.activities
                    .filter(activity => activity.type === 'message') // Filter to show only message activities
                    .map((activity: Activity, index: number) => (
                        <div key={index} className={`message ${activity.from.role === 1 ? 'user' : 'bot'}`}>
                            {/* Render the avatar based on sender (user/bot) */}
                            <img
                                src={activity.from.role === 0 ? 'WebResources/cat_/powercat/img/webchatbotavatar.svg' : 'WebResources/cat_/powercat/img/webchatuseravatar.svg'}
                                alt={`${activity.from.role === 0 ? 'Bot' : 'User'} avatar`}
                                className="avatar"
                            />
                            <div className="message-content">
                                {/* Render message content (Markdown or key-value pairs) */}
                                {renderMessageContent(activity)}

                                {/* Render adaptive or OAuth card attachments if present */}
                                {activity.attachments && activity.attachments.length > 0 && activity.attachments.map((attachment, idx) => (
                                    <div key={idx} className="adaptive-card-wrapper">
                                        {attachment.contentType === 'application/vnd.microsoft.card.adaptive' && (
                                            <AdaptiveCardRenderer card={attachment.content} />
                                        )}

                                        {attachment.contentType === 'application/vnd.microsoft.card.oauth' && (
                                            renderOAuthCard(attachment.content)
                                        )}
                                    </div>
                                ))}

                                {/* Display the message timestamp */}
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
