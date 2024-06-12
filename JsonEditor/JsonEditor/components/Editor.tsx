import Monaco from "@monaco-editor/react";

export interface IProps {
    value: string | undefined;
    language: string;
    onChange: (code: string | undefined) => void;
}

export const Editor: React.FunctionComponent<IProps> = (props) => {

    function handleEditorChange(value: string | undefined, event: any) {
        props.onChange(value);
    }
    return <Monaco
        height="30vh"
        defaultLanguage='json'
        defaultValue={props.value}
        onChange={handleEditorChange}
        options={{
            wordWrap: "on",
            lineHeight: 28,
            formatOnType: true,
            autoIndent: "full",
            formatOnPaste: true,
            automaticLayout: true
          }}
        onMount={async(editor)=>
            {
                editor.onMouseMove((e) => {
                    {
                        setTimeout(function(){
                          editor.getAction('editor.action.formatDocument').run();
                        },30);
                    }
                })
            }
        }
    />;
};