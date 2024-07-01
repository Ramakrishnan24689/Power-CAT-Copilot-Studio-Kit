import Monaco, {loader} from "@monaco-editor/react";

export interface IProps {
    value: string | undefined;
    onChange: (code: string | undefined) => void;
    readOnly: boolean;
    EditorHeight: number
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

    function handleEditorChange(value: string | undefined, event: any) {
        props.onChange(value);
    }
    return<Monaco
        height={(props.EditorHeight).toString() + "vh"}
        defaultLanguage='json'
        defaultValue={props.value}
        theme="myTheme"
        onChange={handleEditorChange}
        onMount={async(editor)=>
            {
                editor.onMouseMove(()=>{
                    {
                        setTimeout(()=>{
                          editor.getAction('editor.action.formatDocument').run();
                        },30);
                    }

                    if(props.readOnly)
                        {
                            props.readOnly = false;
                            editor.getAction('editor.action.formatDocument').run();
                            setTimeout(()=>{
                                editor.updateOptions({ readOnly: true});
                              },30);
                              
                        }
                })
                
            }
        }
        options={{
            wordWrap: "on",
            lineHeight: 18,
            formatOnType: true,
            autoIndent: "full",
            formatOnPaste: true,
            //readOnly: props.readOnly,
            scrollBeyondLastLine: false
          }}
        
    />;
};