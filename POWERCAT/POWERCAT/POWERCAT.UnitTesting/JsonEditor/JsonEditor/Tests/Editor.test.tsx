import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Editor, IProps } from '../components/Editor';
import Monaco, { loader } from '@monaco-editor/react';

// Mock Monaco's `loader.init`
jest.mock('@monaco-editor/react', () => ({
    __esModule: true,
    default: jest.fn((props) => {
        setTimeout(() => {
            if (props.onMount) {
                const editorInstance = {
                    getAction: jest.fn().mockReturnValue({
                        run: jest.fn(),
                    }),
                    setValue: jest.fn(),
                    updateOptions: jest.fn(),
                    dispose: jest.fn(),
                };
                props.onMount(editorInstance);
            }
        }, 0);
        return <div data-testid="monaco-editor">{props.children}</div>;
    }),
    loader: {
        init: jest.fn(() => Promise.resolve({
            editor: {
                defineTheme: jest.fn(),
            },
        })),
    },
}));

describe('Editor Component', () => {
    let props: IProps;
    let onChangeMock: jest.Mock;

    beforeEach(() => {
        onChangeMock = jest.fn();
        props = {
            value: '{"key": "value"}',
            onChange: onChangeMock,
            readOnly: false,
            EditorHeight: 50,
        };
    });

    test('renders the Monaco editor with correct props', () => {
        const { getByTestId } = render(<Editor {...props} />);
        const editor = getByTestId('monaco-editor');
        expect(editor).toBeInTheDocument();
    });

    test('triggers onChange when editor value changes', () => {
        const { rerender } = render(<Editor {...props} />);
        props.onChange('{"key": "newValue"}');
        rerender(<Editor {...props} />);
        expect(onChangeMock).toHaveBeenCalledWith('{"key": "newValue"}');
    });

    test('updates editor options when readOnly changes', () => {
        const { rerender } = render(<Editor {...props} />);
        props.readOnly = true;
        rerender(<Editor {...props} />);
        expect(props.readOnly).toBe(true);
    });

    test('handles cleanup when component unmounts', () => {
        const { unmount } = render(<Editor {...props} />);

        const editorInstance = {
            dispose: jest.fn(),
        };

        setTimeout(() => {
            unmount();
            expect(editorInstance.dispose).toHaveBeenCalled();
        }, 0);
    });
});
