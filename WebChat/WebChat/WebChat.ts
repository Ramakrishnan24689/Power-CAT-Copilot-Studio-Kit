import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from "react";
import * as ReactDOM from "react-dom/client"; // Using ReactDOM from React 18
import BotTranscript from "./Components/BotTranscript";
import Transcript from "./src/model/Transcript";

export class WebChat implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private _container!: HTMLDivElement;
    private _entityName!: string;
    private _entityId!: string;
    private _clientUrl!: string;
    private _fileColumnLogicalName!: string;
    private _transcript: Transcript = {};
    private _root!: ReactDOM.Root;

    /**
     * Initializes the control instance.
     * 
     * @param context The entire property bag available to the control via Context Object.
     * @param notifyOutputChanged A callback method to alert the framework that the control has new outputs ready to be retrieved asynchronously.
     * @param state A piece of data that persists in one session for a single user.
     * @param container An empty div element within which the control can render its content.
     */
    public async init(
        context: ComponentFramework.Context<IInputs>,
        notifyOutputChanged: () => void,
        state: ComponentFramework.Dictionary,
        container: HTMLDivElement
    ): Promise<void> {
        this._container = container;
        this._entityName = (<any>context).page.entityTypeName;
        this._entityId = (<any>context).page.entityId;
        this._clientUrl = (<any>context).page.getClientUrl();
        this._fileColumnLogicalName = context.parameters.fileColumnLogicalName.raw || "";

        // Set container styles for scrolling
        this._container.style.height = "600px";
        this._container.style.overflowY = "auto";
        this._container.style.backgroundColor = "#f7f7f7";

        // Initialize the React root for React 18
        this._root = ReactDOM.createRoot(this._container);

        // Initial render with activities (if available)
        await this.updateView(context);
    }

    /**
     * Called when the view needs to be updated.
     * 
     * @param context The entire property bag available to the control via Context Object.
     */
    public async updateView(context: ComponentFramework.Context<IInputs>): Promise<void> {
        this._transcript = (await this.getFileContent()) || {};
        this.renderComponent(); // Only rendering the component, no data saving
    }

    /**
     * Returns the outputs of the control.
     */
    public getOutputs(): IOutputs {
        return {}; // No data to save
    }

    /**
     * Cleans up the control by unmounting the React component.
     */
    public notifyOutputChanged(): void {
        // No data output changes to notify
    }

    public destroy(): void {
        if (this._root) {
            this._root.unmount(); // Unmount the component
        }
    }

    /**
     * Fetches the file content from the specified URL.
     * 
     * @returns The transcript content.
     */
    private async getFileContent(): Promise<Transcript> {
        let startBytes = 0;
        const increment = 4194304; // 4MB increment
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

        return JSON.parse(finalContent) as Transcript;
    }

    /**
     * Renders the BotTranscript component using React.
     */
    private renderComponent(): void {
        this._root.render(
            React.createElement(BotTranscript, { transcript: this._transcript })
        );
    }
}
