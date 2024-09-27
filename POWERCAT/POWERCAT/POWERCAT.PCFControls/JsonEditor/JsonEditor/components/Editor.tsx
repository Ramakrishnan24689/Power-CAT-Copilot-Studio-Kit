import Monaco, { loader } from "@monaco-editor/react";
import * as React from "react";

/**
 * Editor Component
 * 
 * This component represents a custom Monaco editor that allows users to edit JSON or other code formats.
 * It supports read-only mode, dynamic content updates, and formatting options.
 */

// Define the properties interface for the Editor component
export interface IProps {
    value: string | undefined;
    onChange: (code: string | undefined) => void;
    readOnly: boolean;
    EditorHeight: number;
}

// Initialize and define a custom theme for the Monaco editor
loader.init().then((monaco) => {
    monaco.editor.defineTheme('myTheme', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#f5f5f5'
        }
    });
});

// Functional component representing the custom Monaco editor
export const Editor: React.FunctionComponent<IProps> = (props) => {
    const editorRef = React.useRef<any>(null);
    const valueRef = React.useRef(props.value);

    // Handle changes in the editor and pass the updated value to the parent component
    function handleEditorChange(value: string | undefined) {
        props.onChange(value);
    }

    // Update editor value and options when external props change
    React.useEffect(() => {
        if (editorRef.current && valueRef.current !== props.value) {
            const editor = editorRef.current;

            // Preserve cursor position after update
            const selection = editor.getSelection(); 
            editor.setValue(props.value || ''); 
            editor.setSelection(selection); 
            editor.updateOptions({ readOnly: props.readOnly });
            valueRef.current = props.value;
        }
    }, [props.value, props.readOnly]);

    return (
        <Monaco
            height={`${props.EditorHeight}vh`}
            defaultLanguage="json"
            value={props.value}
            theme="myTheme"
            onChange={handleEditorChange}
            onMount={async (editor) => {
                editorRef.current = editor;

                // Auto-format the document on mouse movement
                editor.onMouseMove(() => {
                    setTimeout(() => {
                        editor.getAction('editor.action.formatDocument').run();
                    }, 30);

                    // Temporarily allow formatting in read-only mode
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
                wordWrap: "on",
                lineHeight: 18,
                formatOnType: true,
                autoIndent: "full",
                formatOnPaste: true,
                scrollBeyondLastLine: false
            }}
        />
    );
};
