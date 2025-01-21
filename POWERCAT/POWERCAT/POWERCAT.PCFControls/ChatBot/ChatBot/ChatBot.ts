import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import BotControl from "./Components/BotControl";

export class ChatBot
  implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
  private _container: HTMLDivElement;
  private _root!: ReactDOM.Root;
  private _error: string | null = null;
  private _notifyOutputChanged: () => void;

  /**
   * Empty constructor.
   */
  constructor() {
    this._notifyOutputChanged = () => {};
  }

  /**
   * Used to initialize the control instance. Controls can kick off remote server calls and other initialization actions here.
   * Data-set values are not initialized here, use updateView.
   * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to property names defined in the manifest, as well as utility functions.
   * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
   * @param state A piece of data that persists in one session for a single user. Can be set at any point in a controls life cycle by calling 'setControlState' in the Mode interface.
   * @param container If a control is marked control-type='standard', it will receive an empty div element within which it can render its content.
   */
  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this._container = container;
    this._notifyOutputChanged = notifyOutputChanged;
    this._root = ReactDOM.createRoot(this._container);
    this.updateView(context);
  }

  /**
   * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
   * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
   */
  public updateView(context: ComponentFramework.Context<IInputs>): void {
    this._root.render(
      React.createElement(BotControl, {
        userQuery: context.parameters.UserQuery.raw || "",
        defaultActivities: context.parameters.DefaultActivities.raw || null,
        tokenEndpoint: context.parameters.TokenEndpoint.raw || "",
        styleOptions: context.parameters.StyleOptions.raw || "{}",
        enableFluentTheme: context.parameters.FluentTheme.raw || false,
        resetConversation: context.parameters.ResetConversation.raw,
        onError: this.handleError,
      })
    );
  }

  /**
   * It is called by the framework prior to a control receiving new data.
   * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
   */
  public getOutputs(): IOutputs {
    return {
      Error: this._error || "",
    };
  }

  /**
   * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
   * i.e. cancelling any pending remote calls, removing listeners, etc.
   */
  public destroy(): void {
    this._root?.unmount();
  }

  /**
   * Callback for error handling
   * @param error Error message
   */
  private handleError = (error: string | null) => {
    this._error = error;
    this._notifyOutputChanged();
  };
}
