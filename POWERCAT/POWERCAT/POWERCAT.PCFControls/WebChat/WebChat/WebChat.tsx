import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import BotTranscript from "./Components/BotTranscript";
import Transcript from "./src/model/Transcript";

export class WebChat
  implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
  private _container!: HTMLDivElement;
  private _value: Transcript = {};
  private _root!: ReactDOM.Root;

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

    // Set container styles for scrolling
    this._container.style.height = "100%";
    this._container.style.overflowY = "auto";

    this._root = ReactDOM.createRoot(this._container);
    await this.updateView(context);
  }

  /**
   * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
   * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
   */
  public async updateView(
    context: ComponentFramework.Context<IInputs>
  ): Promise<void> {
    try {
      const botAvatarUrl = context.parameters.BotAvatarUrl.raw || "";
      const userAvatarUrl = context.parameters.UserAvatarUrl.raw || "";
      const searchMessage = context.parameters.SearchMessage.raw || "";

      //Check if the file column is used for transcript
      if (context.parameters.FileColumn.raw) {
        this._value = (await this.getFileContent(context)) || {};
      } else {
        const rawValue = context.parameters.Value.raw;
        this._value =
          typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue || {};
      }

      // render the BotTranscript component
      this._root.render(
        React.createElement(BotTranscript, {
          transcript: this._value,
          botAvatarUrl: botAvatarUrl,
          userAvatarUrl: userAvatarUrl,
          searchMessage: searchMessage,
        })
      );
    } catch (error) {
      throw new Error(`Error rendering the component..: ${error}`);
    }
  }

  /**
   * It is called by the framework prior to a control receiving new data.
   * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
   */
  public getOutputs(): IOutputs {
    return {};
  }

  /**
   * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
   * i.e. cancelling any pending remote calls, removing listeners, etc.
   */
  public destroy(): void {
    if (this._root) {
      this._root.unmount(); // Unmount the component
    }
  }

  public notifyOutputChanged(): void {
    // No data output changes to notify
  }

  /**
   * Fetches the file content from the specified URL.
   * @param context The context object containing the parameters.
   * @returns The file content as a Transcript object.
   */
  private async getFileContent(
    context: ComponentFramework.Context<IInputs>
  ): Promise<Transcript> {
    const fileColumnLogicalName =
      context.parameters.FileColumnLogicalName.raw || "";
    const entityName = (context as any).page.entityTypeName;
    const entityId = (context as any).page.entityId;
    const clientUrl = (context as any).page.getClientUrl();
    const url = `${clientUrl}/api/data/v9.2/${entityName}s(${entityId})/${fileColumnLogicalName}/$value`;
    let startBytes = 0;
    const increment = 4194304; // 4MB increment
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

    return JSON.parse(finalContent) as Transcript;
  }
}
