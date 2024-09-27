import Monaco, { loader } from "@monaco-editor/react";
import * as React from "react";

// Define the properties interface for the Editor component
export interface IProps {
    value: string | undefined; // The current code value displayed in the editor
    onChange: (code: string | undefined) => void; // Callback function to handle changes in the editor content
    readOnly: boolean; // Flag to determine if the editor is in read-only mode
    EditorHeight: number; // Height of the editor in viewport height units (vh)
}

// Initialize and define a custom theme for the Monaco editor
loader.init().then((monaco) => {
    monaco.editor.defineTheme('myTheme', {
        base: 'vs', // Base theme (vs: Visual Studio light theme)
        inherit: true, // Inherit base theme rules
        rules: [], // Custom rules can be added here
        colors: {
            'editor.background': '#f5f5f5' // Set editor background color
        },
    });
});

// Functional component representing the custom Monaco editor
export const Editor: React.FunctionComponent<IProps> = (props) => {
    const editorRef = React.useRef<any>(null); // Reference to the editor instance

    // Handle changes in the editor and pass the updated value to the parent component
    function handleEditorChange(value: string | undefined) {
        props.onChange(value);
    }

    // Effect to update the editor value and options when props change
    React.useEffect(() => {
        if (editorRef.current) {
            editorRef.current.setValue(props.value || ''); // Set editor value to the provided prop value
            editorRef.current.updateOptions({ readOnly: props.readOnly }); // Update read-only mode based on props
        }
    }, [props.value, props.readOnly]); // Depend on value and readOnly props for re-rendering

    return (
        <Monaco
            height={`${props.EditorHeight}vh`} // Set editor height based on the provided prop
            defaultLanguage="json" // Default language mode for the editor
            value={props.value} // Initial value of the editor content
            theme="myTheme" // Apply the custom theme defined earlier
            onChange={handleEditorChange} // Handle editor content change events
            onMount={async (editor) => {
                editorRef.current = editor; // Store the editor instance in the ref

                // Handle mouse movement within the editor
                editor.onMouseMove(() => {
                    // Automatically format the document after a brief delay
                    setTimeout(() => {
                        editor.getAction('editor.action.formatDocument').run();
                    }, 30);

                    // Temporarily disable read-only mode to allow formatting, then re-enable it
                    if (props.readOnly) {
                        props.readOnly = false;
                        editor.getAction('editor.action.formatDocument').run();
                        setTimeout(() => {
                            editor.updateOptions({ readOnly: true });
                        }, 30);
                    }
                });
            }}
            options={{
                wordWrap: "on", // Enable word wrapping in the editor
                lineHeight: 18, // Set line height for better readability
                formatOnType: true, // Automatically format code while typing
                autoIndent: "full", // Automatically adjust indentation
                formatOnPaste: true, // Automatically format code when pasting
                scrollBeyondLastLine: false // Disable scrolling beyond the last line for a cleaner UI
            }}
        />
    );
};
