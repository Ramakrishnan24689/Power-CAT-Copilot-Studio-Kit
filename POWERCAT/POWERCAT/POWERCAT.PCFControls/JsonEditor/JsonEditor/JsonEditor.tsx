import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Editor, IProps } from "./components/Editor";

declare global {
  interface Window {
    PowerAppsHostingSdk: any;
  }
}

export class JsonEditor
  implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
  private _container: HTMLDivElement;
  private _notifyOutputChanged: () => void;
  private _value: string | undefined;
  private _entityName: string;
  private _entityId: string;
  private _clientUrl: string;
  private _fileColumnLogicalName: string;
  private _isReadOnly: boolean = false;
  private _isEditorLoaded: boolean = false;

  /**
   * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
   * Data-set values are not initialized here, use updateView.
   * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
   * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
   * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
   * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
   */

  public async init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): Promise<void> {
    this._container = container;
    this._notifyOutputChanged = notifyOutputChanged;

    //Read entity & client details from context
    this._entityName = (context as any).page.entityTypeName;
    this._entityId = (context as any).page.entityId;
    this._clientUrl = (context as any).page.getClientUrl();
    this._fileColumnLogicalName =
      context.parameters.FileColumnLogicalName.raw || "";

    const checkSdkInterval = setInterval(() => {
      if (window.PowerAppsHostingSdk) {
        clearInterval(checkSdkInterval);
        clearTimeout(timeout);
        this._isEditorLoaded = true;
        this.updateView(context);
      }
    }, 300);

    const timeout = setTimeout(() => {
      clearInterval(checkSdkInterval);
      throw new Error("PowerAppsHostingSdk is not available.");
    }, 5000);
  }

  /**
   * Called when any value in the property bag changes. This is where data binding occurs.
   * @param context The entire property bag available to the control via Context Object.
   */

  public async updateView(
    context: ComponentFramework.Context<IInputs>
  ): Promise<void> {
    if (!this._isEditorLoaded) return;

    if (context.parameters.FileColumn.raw === "True") {
      this._value = await this.getFileContent();
      this._isReadOnly = true;
    } else {
      this._value = context.parameters.Value.raw || "";
      this._isReadOnly = false;
    }
    this.renderComponent(context);
  }

  /**
   * Fetches the content of a file from the server using OData APIs.
   * @returns The file content as a string.
   */

  private async getFileContent(): Promise<string> {
    let startBytes = 0;
    const increment = 4194304; // 4MB
    const url = `${this._clientUrl}/api/data/v9.2/${this._entityName}s(${this._entityId})/${this._fileColumnLogicalName}/$value`;
    let finalContent = "";
    let fileSize = 0;

    while (startBytes <= fileSize) {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Range: `bytes=${startBytes}-${startBytes + increment - 1}`,
          "OData-MaxVersion": "4.0",
          "OData-Version": "4.0",
          "If-None-Match": "null",
          Accept: "application/json",
        },
      });

      if (response.status === 206) {
        const content = await response.text();
        finalContent += content;
        startBytes += increment;

        if (fileSize === 0) {
          fileSize = parseInt(response.headers.get("x-ms-file-size") ?? "0");
        }
      } else {
        break;
      }
    }
    return finalContent;
  }

  /**
   * Renders the React component for the editor.
   * @param context The entire property bag available to the control via Context Object.
   */

  private renderComponent(context: ComponentFramework.Context<IInputs>): void {
    const props: IProps = {
      value: this._value,
      onChange: this.notifyChange.bind(this),
      readOnly: this._isReadOnly || context.mode.isControlDisabled,
      EditorHeight: context.parameters.Height.raw || 25,
    };
    ReactDOM.render(React.createElement(Editor, props), this._container);
  }

  /**
   * Called by the framework to retrieve the control's output.
   * @returns An empty object as there are no bound outputs in this control.
   */

  public getOutputs(): IOutputs {
    return { Value: this._value ?? "" };
  }

  /**
   * Called when the control is to be removed from the DOM tree.
   * Used to unmount and clean up the React component.
   */

  public destroy(): void {
    ReactDOM.unmountComponentAtNode(this._container);
  }

  /**
   * Notifies the framework that the value has changed, triggering an update.
   * @param value The new value from the editor.
   */

  private notifyChange(value: string | undefined) {
    this._value = value;
    this._notifyOutputChanged();
  }
}
