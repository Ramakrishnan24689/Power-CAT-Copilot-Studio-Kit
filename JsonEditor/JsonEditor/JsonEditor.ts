import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
var reactDOM = require("react-dom");
import { Editor, IProps } from "./components/Editor";
import * as monaco from 'monaco-editor';

/**
* Json Editor Class to construct the monaco editor and it's properties.
*/
export class JsonEditor implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    private _container: HTMLDivElement;
    private _notifyOutputChanged: () => void;
    private _value: string | undefined;
    editorInstance: monaco.editor.IStandaloneCodeEditor;
    context: ComponentFramework.Context<IInputs>;
    /**
     * Empty constructor.
     */
    constructor() {

    }


    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     * Data-set values are not initialized here, use updateView.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
     * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
     */
    public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): void {
        this.context = context;
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        context.mode.trackContainerResize(true);
    }


    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */

    //JsonEditor

    //change the code to value.

    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this._value = context.parameters.Value.raw || undefined;
        this.context = context;
        context.mode.trackContainerResize(true);
        const allocatedWidth = parseInt(context.mode.allocatedWidth as unknown as string);
        const allocatedHeight = parseInt(context.mode.allocatedHeight as unknown as string);
        
        //this.editorInstance.getAction('editor.action.formatDocument').run() 
        let props: IProps = {
            value: context.parameters.Value.raw || undefined,
            onChange: this.notifyChange.bind(this),
            readOnly: context.mode.isControlDisabled,
            allocatedWidth: allocatedWidth,
            allocatedHeight: allocatedHeight
        }
        reactDOM.render(React.createElement(Editor, props), this._container)
    }

    /**
     * It is called by the framework prior to a control receiving new data.
     * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as “bound” or “output”
     */
    public getOutputs(): IOutputs {
        return {
            Value: this._value ?? ""
        };
    }

    /**
     * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
     * i.e. cancelling any pending remote calls, removing listeners, etc.
     */
    public destroy(): void {
        reactDOM.unmountComponentAtNode(this._container);
    }

    /**
     * A PCF Control notifies the changes of its outputs with the notifyOutputChanged method
     */

    private notifyChange(value: string | undefined) {
        this._value = value;
        this._notifyOutputChanged();
    }
}
