/* eslint-disable no-useless-escape */
/* eslint-disable sonarjs/no-duplicate-string */
import * as React from 'react';
import * as monaco from 'monaco-editor';

export interface IEditorProps {
    callback: (newvalue: string) => void;
    defaultValue: string;
    theme?: string;
    readOnly?: boolean;
    showLineNumbers?: boolean;
    showMiniMap?: boolean;
    width: number;
    height: number;
    line?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    options: any;
}

monaco.languages.register({ id: 'PowerFX' });

monaco.languages.setMonarchTokensProvider('PowerFX', {
    defaultToken: 'invalid',
    booleans: ['true', 'false'],
    operators: ['+', '-', '*', '/', '^', '%', '=', '>', '>=', '<', '<=', '<>', '&', '&&', '||', '!', '.', '@', ';;'],
    symbols: /[=><!~?:&|+\-*\/\^%@;]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    digits: /\d+(_+\d+)*/,
    tokenizer: {
        root: [[/[{}]/, 'delimiter.bracket'], { include: 'common' }],
        common: [
            [/[a-z_$][\w$]*/, { cases: { '@booleans': 'boolean', '@default': 'identifier' } }],
            [/[A-Z][\w\$]*/, 'type.identifier'],
            { include: '@whitespace' },
            [/[()\[\]]/, '@brackets'],
            [/[<>](?!@symbols)/, '@brackets'],
            [/@symbols/, { cases: { '@operators': 'delimiter', '@default': '' } }],
            [/(@digits)[eE]([\-+]?(@digits))?/, 'number.float'],
            [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, 'number.float'],
            [/(@digits)/, 'number'],
            [/[;,.]/, 'delimiter'],
            [/"([^"\\]|\\.)*$/, 'string.invalid'],
            [/'([^'\\]|\\.)*$/, 'string.invalid'],
            [/"/, 'string', '@string_double'],
            [/'/, 'string', '@string_single'],
        ],
        whitespace: [
            [/[ \t\r\n]+/, ''],
            [/\/\*\*(?!\/)/, 'comment.doc', '@jsdoc'],
            [/\/\*/, 'comment', '@comment'],
            [/\/\/.*$/, 'comment'],
        ],
        comment: [
            [/[^\/*]+/, 'comment'],
            [/\*\//, 'comment', '@pop'],
            [/[\/*]/, 'comment'],
        ],
        jsdoc: [
            [/[^\/*]+/, 'comment.doc'],
            [/\*\//, 'comment.doc', '@pop'],
            [/[\/*]/, 'comment.doc'],
        ],
        string_double: [
            [/[^\\"]+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/"/, 'string', '@pop'],
        ],
        string_single: [
            [/[^\\']+/, 'string'],
            [/@escapes/, 'string.escape'],
            [/\\./, 'string.escape.invalid'],
            [/'/, 'string', '@pop'],
        ],
        bracketCounting: [
            [/\{/, 'delimiter.bracket', '@bracketCounting'],
            [/\}/, 'delimiter.bracket', '@pop'],
            { include: 'common' },
        ],
    },
});

monaco.languages.setLanguageConfiguration('PowerFX', {
    surroundingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '(', close: ')' },
    ],
    brackets: [
        ['{', '}'],
        ['[', ']'],
        ['(', ')'],
    ],
});

export const Editor: React.FC<IEditorProps> = (props: IEditorProps) => {
    // Destructure the props to avoid the need to include entire props in useEffect
    const { defaultValue, theme, readOnly, showLineNumbers, showMiniMap, line, options, callback, width, height } =
        props;

    const editorDiv = React.useRef<HTMLDivElement>(null);
    const editorRef = React.useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    // Effect for initializing Monaco editor
    React.useEffect(() => {
        if (editorDiv.current && !editorRef.current) {
            editorRef.current = monaco.editor.create(editorDiv.current, {
                value: defaultValue,
                language: 'PowerFX',
                theme: theme || 'vs-light',
                readOnly: readOnly || false,
                lineNumbers: showLineNumbers ? 'on' : 'off',
                minimap: { enabled: showMiniMap || false },
                ...options,
            });

            // Handle the cursor positioning if a specific line is provided
            if (line) {
                editorRef.current.revealLineInCenter(line);
                editorRef.current.setPosition({ lineNumber: line, column: 1 });
            }

            editorRef.current.onDidChangeModelContent(() => {
                callback(editorRef.current?.getValue() || '');
            });
        }

        // Cleanup the editor on component unmount
        return () => {
            editorRef.current?.dispose();
            editorRef.current = null;
        };
    }, [defaultValue, theme, readOnly, showLineNumbers, showMiniMap, line, options, callback]);

    // Effect for updating the editor content when defaultValue changes
    React.useEffect(() => {
        if (editorRef.current && editorRef.current.getValue() !== defaultValue) {
            editorRef.current.setValue(defaultValue);
        }
    }, [defaultValue]);

    // Set the dimensions dynamically based on width and height
    return <div className="Editor" ref={editorDiv} style={{ width, height }}></div>;
};
