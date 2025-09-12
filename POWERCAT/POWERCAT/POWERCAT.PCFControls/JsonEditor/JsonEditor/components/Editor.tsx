import Monaco, { loader } from "@monaco-editor/react";
import * as React from "react";

export interface IProps {
  value: string | undefined;
  onChange: (code: string | undefined) => void;
  readOnly: boolean;
  EditorHeight: number;
}
// Functional component representing the custom Monaco editor
export const Editor: React.FunctionComponent<IProps> = (props) => {
  const editorRef = React.useRef<any>(null);
  const valueRef = React.useRef(props.value);

  // Initialize and define a custom theme for the Monaco editor
  loader.init().then((monaco) => {
    monaco.editor.defineTheme("myTheme", {
      base: "vs",
      inherit: true,
      rules: [],
      colors: {
        "editor.background": "#f5f5f5",
      },
    });
  });

  function handleEditorChange(value: string | undefined) {
    props.onChange(value);
  }

  React.useEffect(() => {
    if (editorRef.current && valueRef.current !== props.value) {
      const editor = editorRef.current;

      // Preserve cursor position after update
      const selection = editor.getSelection();
      editor.setValue(props.value || "");
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
            const formatAction = editor.getAction(
              "editor.action.formatDocument"
            );
            if (formatAction) {
              formatAction.run();
            }
          }, 30);
        });
      }}
      options={{
        wordWrap: "on",
        lineHeight: 18,
        formatOnType: true,
        autoIndent: "full",
        formatOnPaste: true,
        scrollBeyondLastLine: false,
      }}
    />
  );
};
