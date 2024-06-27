import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
var reactDOM = require("react-dom");
import { Editor, IProps } from "./components/Editor";

/**
* Json Editor Class to construct the monaco editor and it's properties.
*/
export class JsonEditor implements ComponentFramework.StandardControl<IInputs, IOutputs> {

    private _container: HTMLDivElement;
    private _notifyOutputChanged: () => void;
    private _value: string | undefined
    private _entityName: string;
    private _entityId: string;
    private _clientUrl: string;
    private _fileColumnLogicalName: string;


    /**
     * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
     * Data-set values are not initialized here, use updateView.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
     * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
     */

    public async init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary, container: HTMLDivElement): Promise<void> {
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        this._entityName = (<any>context).page.entityTypeName;
        this._entityId = (<any>context).page.entityId;
        this._clientUrl = (<any>context).page.getClientUrl();
        this._fileColumnLogicalName = context.parameters.fileColumnLogicalName.raw || "";

    }


    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */

    public async updateView(context: ComponentFramework.Context<IInputs>): Promise<void> {

    /**
     * Added the logic to provide the file column logical name which will call the API to fetch the data and show details in the value field if the file column is selected true and have read only field else it will take the custom data provided by the user.
     */
      let isReadOnly = false;
      if(context.parameters.FileColumn.raw === "True")
        {       
          this._value = await this.getFileContent() || "";
          isReadOnly = true;
        }
      else
        {
          this._value = context.parameters.Value.raw || "";
        }
        
        let props: IProps = {
            value: this._value,
            onChange: this.notifyChange.bind(this),
            readOnly: isReadOnly || context.mode.isControlDisabled,
            EditorHeight: context.parameters.Height.raw || 25,
        }
        reactDOM.render(React.createElement(Editor, props), this._container);
    }


    /**
     * The logic is added to get the data from the API and store the value in the control field based on the file column logical name.
     */

    private async getFileContent(): Promise<string> {
        try {
          let startBytes = 0;
          const increment = 4194304;

          const url = `${this._clientUrl}/api/data/v9.2/${this._entityName}s(${this._entityId})/${this._fileColumnLogicalName}/$value`;
          let finalContent = "";
          let fileSize = 0;
          let fileName = "";
    
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
                fileName = response.headers.get("x-ms-file-name") ?? "0";
              }
            }
            else
            {
              break;
            }
          }
    
          return finalContent;
        } catch (error) {
          throw error; // Rethrow the error to be handled in the updateView method
        }
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
