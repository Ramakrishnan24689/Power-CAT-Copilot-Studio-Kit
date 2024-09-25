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
 * It supports markdown formatting for message text and renders adaptive card attachments.
 */

// Define the props for the BotTranscript component
interface BotTranscriptProps {
    transcript: Transcript; // Transcript data, containing bot and user activities
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
            hour12: true, // Display in 12-hour format
        });
    };

    /**
     * Renders the content of a message.
     * 
     * Depending on the type of message, this function will either render markdown text or key-value pairs (if present).
     * 
     * @param activity The activity object containing the message details.
     * @returns The JSX for the message content.
     */
    const renderMessageContent = (activity: Activity) => {
        if (activity.text) {
            // If the message contains text, render it using ReactMarkdown with support for GFM (GitHub Flavored Markdown)
            return (
                <ReactMarkdown
                    children={activity.text}
                    remarkPlugins={[remarkGfm]} // Enable support for GitHub Flavored Markdown
                    components={{
                        p: ({ node, ...props }) => <p {...props} className="message-text" />, // Paragraphs
                        h1: ({ node, ...props }) => <h1 {...props} className="message-text" />, // Headers
                        h2: ({ node, ...props }) => <h2 {...props} className="message-text" />,
                        h3: ({ node, ...props }) => <h3 {...props} className="message-text" />,
                        code: ({ node, ...props }) => <code {...props} className="message-text" />, // Code blocks
                        blockquote: ({ node, ...props }) => <blockquote {...props} className="message-text" />, // Blockquotes
                    }}
                />
            );
        } else if (activity.value) {
            // If the message contains key-value pairs (e.g., data from a form submission), render the values excluding unwanted keys
            const filteredValues = Object.entries(activity.value).filter(
                ([key, _]) => key !== 'actionSubmitId' // Exclude 'actionSubmitId' from the display
            );

            return (
                <div className="message-text">
                    {/* Display all key-value pairs except 'actionSubmitId' */}
                    {filteredValues.map(([key, value], index) => (
                        <div key={index}>{value}</div>
                    ))}
                </div>
            );
        } else {
            return null; // If no text or value is present, return null
        }
    };

    return (
        <div className="transcript-container">
            <div className="transcript">
                {/* Iterate over transcript activities and filter out only 'message' type activities */}
                {transcript.activities && transcript.activities
                    .filter(activity => activity.type === 'message') // Filter to show only message activities
                    .map((activity: Activity, index: number) => (
                        <div key={index} className={`message ${activity.from.role === 1 ? 'user' : 'bot'}`}>
                            {/* Render the avatar image based on whether the sender is the bot or the user */}
                            <img
                                src={activity.from.role === 0 ? 'WebResources/cat_/powercat/img/webchatbotavatar.svg' : 'WebResources/cat_/powercat/img/webchatuseravatar.svg'}
                                alt={`${activity.from.role === 0 ? 'Bot' : 'User'} avatar`}
                                className="avatar"
                            />
                            <div className="message-content">
                                {/* Render the message content, either text or value */}
                                {renderMessageContent(activity)}

                                {/* If there are any attachments, such as adaptive cards, render them */}
                                {activity.attachments && activity.attachments.length > 0 && activity.attachments.map((attachment, idx) => (
                                    <div key={idx} className="adaptive-card-wrapper">
                                        {attachment.contentType === 'application/vnd.microsoft.card.adaptive' && (
                                            <AdaptiveCardRenderer card={attachment.content} /> // Render the adaptive card
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
