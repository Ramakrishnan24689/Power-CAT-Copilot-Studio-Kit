import Monaco from "@monaco-editor/react";

export interface IProps {
    value: string | undefined;
    language: string;
    onChange: (code: string | undefined) => void;
    readOnly: boolean
    allocatedWidth: number;
    allocatedHeight: number;
}

export function formatJSON(val: string) {
    try {
      const res = JSON.parse(val);
      return JSON.stringify(res, null, 2)
    } catch {
      const errorJson = {
        "error": `${val}`
      }
      return JSON.stringify(errorJson, null, 2)
    }
  }

export const Editor: React.FunctionComponent<IProps> = (props) => {

    function handleEditorChange(value: string | undefined, event: any) {
        props.onChange(value);
    }
    return(<Monaco
        height="30vh"
        className="jsonEditor"
        defaultLanguage='json'
        defaultValue={props.value}
        onChange={handleEditorChange}
        options={{
            wordWrap: "on",
            lineHeight: 28,
            formatOnType: true,
            autoIndent: "full",
            formatOnPaste: true,
            automaticLayout: true,
            readOnly: props.readOnly
          }}
        onMount={async(editor)=>
            {
                // const updateHeight = () =>
                //     {
                //         const contentHeight = Math.min(1000, editor.getContentHeight());
                editor.layout({width: props.allocatedWidth , height: props.allocatedHeight});
                //     }
                // editor.onDidContentSizeChange((e) =>
                // {
                //     updateHeight();
                // });
                //updateHeight();

                editor.onMouseMove((e) => {
                    {
                        setTimeout(function(){
                          editor.getAction('editor.action.formatDocument').run();
                        },30);
                    }
                })
            }
        }
    />);
};