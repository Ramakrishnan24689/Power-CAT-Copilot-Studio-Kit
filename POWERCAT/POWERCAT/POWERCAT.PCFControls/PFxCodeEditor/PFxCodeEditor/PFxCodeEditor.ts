import { IInputs, IOutputs } from './generated/ManifestTypes';
import { Editor, IEditorProps } from './components/editor';
import * as React from 'react';
import { ContextEx } from './ContextExtended';
import { Themes } from './ManifestConstants';

export class PFxCodeEditor implements ComponentFramework.ReactControl<IInputs, IOutputs> {
    notifyOutputChanged: () => void;
    currentValue: string;
    _isLoaded: boolean = false;
    _defaultString: string = '';
    context: ComponentFramework.Context<IInputs>;

    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void): void {
        this.context = context;
        this.context.mode.trackContainerResize(true);
        this.callback = this.callback.bind(this);
        this.notifyOutputChanged = notifyOutputChanged;
    }

    public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
        const allocatedWidth = parseInt(context.mode.allocatedWidth as unknown as string);
        const allocatedHeight = parseInt(context.mode.allocatedHeight as unknown as string);
        const linetoJump = context.parameters.LinetoJump.raw;
        this._defaultString = context.parameters.PowerFx.raw ?? '';
        const props: IEditorProps = {
            callback: this.callback,
            defaultValue: this._defaultString,
            width: allocatedWidth,
            height: allocatedHeight,
            theme: Themes[context.parameters.Theme.raw ?? 'vs'],
            line: linetoJump ?? undefined,
            options: {
                readOnly: this.isComponentDisabled(),
                lineNumbers: context.parameters.ShowLineNumber.raw ? 'on' : 'off',
                minimap: { enabled: context.parameters.ShowminiMap.raw },
            },
        };
        return React.createElement(Editor, props);
    }

    private isComponentDisabled(): boolean {
        const contextEx = this.context as unknown as ContextEx;
        return this.context.mode.isControlDisabled || contextEx.mode.isRead;
    }

    public callback(newString: string): void {
        this.currentValue = newString;
        this.notifyOutputChanged();
    }

    public getOutputs(): IOutputs {
        return { PowerFx: this.currentValue };
    }

    public destroy(): void {
        // Add code to cleanup control if necessary
    }
}
