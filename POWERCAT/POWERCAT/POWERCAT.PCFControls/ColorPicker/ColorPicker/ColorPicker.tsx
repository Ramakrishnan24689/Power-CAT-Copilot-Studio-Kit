import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { ColorPickerComponent } from "./Components/ColorPickerComponent";

export class ColorPicker
  implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
  private _container: HTMLDivElement;
  private _root!: ReactDOM.Root;
  private _colorHex: string = "#ffffff"; // Default color
  private notifyOutputChanged: () => void;

  /**
   * Empty constructor.
   */
  constructor() {}

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
    this._root = ReactDOM.createRoot(this._container);
    this.notifyOutputChanged = notifyOutputChanged;

    // Render the component
    this.updateView(context);
  }

  /**
   * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
   * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
   */
  public updateView(context: ComponentFramework.Context<IInputs>): void {
    // Update the hex color value based on Power Apps property changes
    this._root.render(
      React.createElement(ColorPickerComponent, {
        initialColor: context.parameters.Value.raw || "#ffffff", // Update the color based on context
        onColorChange: this.handleColorChange, // Keep the callback intact
      })
    );
  }

  private handleColorChange = (colorHex: string) => {
    this._colorHex = colorHex; // Update the colorHex state when it changes
    this.notifyOutputChanged();
  };

  /**
   * It is called by the framework prior to a control receiving new data.
   * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
   */
  public getOutputs(): IOutputs {
    return {
      Value: this._colorHex, // Output the colorHex value
    };
  }

  /**
   * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
   * i.e. cancelling any pending remote calls, removing listeners, etc.
   */
  public destroy(): void {
    // Cleanup the component when it is destroyed
    if (this._root) {
      this._root.unmount(); // Unmount the component
    }
  }
}
