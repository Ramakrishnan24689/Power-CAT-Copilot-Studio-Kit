import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Editor, IProps } from "./components/Editor";

/**
 * JsonEditor Class to construct and manage the Monaco editor within a PowerApps component framework (PCF) control.
 */
export class JsonEditor implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container: HTMLDivElement; // Container for rendering the React component
    private _notifyOutputChanged: () => void; // Callback to notify the framework when the output changes
    private _value: string | undefined; // Current value of the editor content
    private _entityName: string; // Name of the entity in context
    private _entityId: string; // ID of the current entity record
    private _clientUrl: string; // URL of the current environment
    private _fileColumnLogicalName: string; // Logical name of the file column in the entity
    private _isReadOnly: boolean = false; // Flag to indicate if the editor should be read-only

    /**
     * Initializes the control instance. This is called by the framework when the control is created.
     * @param context The entire property bag available to the control via Context Object.
     * @param notifyOutputChanged Callback to notify the framework that the control has new outputs ready to be retrieved.
     * @param state A piece of data that persists across sessions for a single user.
     * @param container The container element within which the control will render its content.
     */
    public async init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): Promise<void> {
        this._container = container;
        this._notifyOutputChanged = notifyOutputChanged;
        this._entityName = (context as any).page.entityTypeName;
        this._entityId = (context as any).page.entityId;
        this._clientUrl = (context as any).page.getClientUrl();
        this._fileColumnLogicalName = context.parameters.fileColumnLogicalName.raw || "";

        // Initial render of the component
        await this.updateView(context);
    }

    /**
     * Called when any value in the property bag changes. This is where data binding occurs.
     * @param context The entire property bag available to the control via Context Object.
     */
    public async updateView(context: ComponentFramework.Context<IInputs>): Promise<void> {
        // Check if the file column has content
        if (context.parameters.FileColumn.raw === "True") {
            try {
                this._value = await this.getFileContent(); // Fetch the file content
                this._isReadOnly = true; // Set editor to read-only mode for file content
            } catch (error) {
                console.error("Error fetching file content:", error); // Log any errors that occur during content fetching
            }
        } else {
            this._value = context.parameters.Value.raw || ""; // Use the provided value if no file content is found
            this._isReadOnly = false; // Set editor to editable mode
        }
        this.renderComponent(context); // Render the editor with the updated data
    }

    /**
     * Fetches the content of a file from the server using OData APIs.
     * @returns The file content as a string.
     */
    private async getFileContent(): Promise<string> {
        try {
            let startBytes = 0; // Start byte for range-based fetching
            const increment = 4194304; // Incremental byte range for each fetch (4MB)
            const url = `${this._clientUrl}/api/data/v9.2/${this._entityName}s(${this._entityId})/${this._fileColumnLogicalName}/$value`;
            let finalContent = ""; // Final content of the file
            let fileSize = 0; // Total file size

            // Fetch the file content in chunks until the entire file is retrieved
            while (startBytes <= fileSize) {
                const response = await fetch(url, {
                    method: "GET",
                    headers: {
                        Range: `bytes=${startBytes}-${startBytes + increment - 1}`, // Fetch a specific byte range
                        "OData-MaxVersion": "4.0",
                        "OData-Version": "4.0",
                        "If-None-Match": "null",
                        Accept: "application/json",
                    },
                });

                if (response.status === 206) { // Partial content status
                    const content = await response.text();
                    finalContent += content; // Append content to final result
                    startBytes += increment; // Move to the next byte range
                    if (fileSize === 0) {
                        fileSize = parseInt(response.headers.get("x-ms-file-size") ?? "0"); // Get the total file size
                    }
                } else {
                    break; // Exit loop if no more content is available
                }
            }

            return finalContent;
        } catch (error) {
            throw error; // Rethrow the error to be handled by the calling method
        }
    }

    /**
     * Renders the React component for the editor.
     * @param context The entire property bag available to the control via Context Object.
     */
    private renderComponent(context: ComponentFramework.Context<IInputs>): void {
        const props: IProps = {
            value: this._value, // Current content of the editor
            onChange: this.notifyChange.bind(this), // Bind the change handler to notify the framework of changes
            readOnly: this._isReadOnly || context.mode.isControlDisabled, // Determine if the editor should be read-only
            EditorHeight: context.parameters.Height.raw || 25, // Editor height based on provided parameter
        };

        // Render the Editor component into the container
        ReactDOM.render(React.createElement(Editor, props), this._container);
    }

    /**
     * Called by the framework to retrieve the control's output.
     * @returns An empty object as there are no bound outputs in this control.
     */
    public getOutputs(): IOutputs {
        return {}; // No outputs to return
    }

    /**
     * Called when the control is to be removed from the DOM tree.
     * Used to unmount and clean up the React component.
     */
    public destroy(): void {
        ReactDOM.unmountComponentAtNode(this._container); // Clean up the React component
    }

    /**
     * Notifies the framework that the value has changed, triggering an update.
     * @param value The new value from the editor.
     */
    private notifyChange(value: string | undefined) {
        this._value = value; // Update the internal value
        this._notifyOutputChanged(); // Notify the framework that the value has changed
    }
}
