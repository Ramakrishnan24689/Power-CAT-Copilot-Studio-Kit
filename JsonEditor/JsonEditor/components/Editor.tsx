import Monaco, { loader } from "@monaco-editor/react";
import * as React from "react";

export interface IProps {
    value: string | undefined;
    onChange: (code: string | undefined) => void;
    readOnly: boolean;
    EditorHeight: number;
}

loader.init().then((monaco) => {
    monaco.editor.defineTheme('myTheme', {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
            'editor.background': '#f5f5f5'
        },
    });
});

export const Editor: React.FunctionComponent<IProps> = (props) => {
    const editorRef = React.useRef<any>(null);

    function handleEditorChange(value: string | undefined) {
        props.onChange(value);
    }

    React.useEffect(() => {
        if (editorRef.current) {
            editorRef.current.setValue(props.value || '');
            editorRef.current.updateOptions({ readOnly: props.readOnly });
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

                editor.onMouseMove(() => {
                    setTimeout(() => {
                        editor.getAction('editor.action.formatDocument').run();
                    }, 30);

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
