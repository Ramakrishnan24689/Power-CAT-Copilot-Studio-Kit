import Monaco, {loader} from "@monaco-editor/react";

export interface IProps {
    value: string | undefined;
    language: string;
    onChange: (code: string | undefined) => void;
    readOnly: boolean
    allocatedWidth: number;
    allocatedHeight: number;
}

loader.init().then((monaco) => {
    monaco.editor.defineTheme('myTheme', {
        base: 'vs',
        inherit: true,
        rules: [
            // {
            //     background: '#00FF00',
            //     token: ""
            // }
        ],
        colors: {
            'editor.background': '#f5f5f5'
        },
    });
});
export const Editor: React.FunctionComponent<IProps> = (props) => {

    function handleEditorChange(value: string | undefined, event: any) {
        props.onChange(value);
    }
    return(<Monaco
        height="30vh"
        className="jsonEditor"
        defaultLanguage='json'
        defaultValue={props.value}
        theme="myTheme"
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
                editor.layout({width: props.allocatedWidth , height: props.allocatedHeight});
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