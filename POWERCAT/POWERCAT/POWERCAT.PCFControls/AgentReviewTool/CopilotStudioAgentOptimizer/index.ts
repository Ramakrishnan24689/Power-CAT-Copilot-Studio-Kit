import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { AppContainer, MainContainerProps, copilotStudioTheme } from "./Components/features/App";
import { ServiceProvider, ExtendedPCFContext } from "./Components/context";
import { FluentProvider } from "@fluentui/react-provider";
import { ErrorBoundary } from "./Components/utils";
import * as React from "react";
import { createRoot, Root } from "react-dom/client";

export class CopilotStudioAgentOptimizer implements ComponentFramework.StandardControl<IInputs, IOutputs> {
    private notifyOutputChanged: () => void;
    private context: ComponentFramework.Context<IInputs>;
    private container: HTMLDivElement;
    private root: Root | null = null;
    // private isExpanded = false; // Commented out - now rendering MainContainer directly

    /**
     * Empty constructor.
     */
    constructor() {
        // Empty
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
        this.notifyOutputChanged = notifyOutputChanged;
        this.context = context;
        this.container = container;
        
        // Enable container resize tracking to get proper width/height allocation
        context.mode.trackContainerResize(true);
    }

    /**
     * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
     * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
     */
    public updateView(context: ComponentFramework.Context<IInputs>): void {
        this.context = context;

        const stageAModelId = context.parameters.stageAModelId.raw ?? '';
        const stageBModelId = context.parameters.stageBModelId.raw ?? '';
        const stageCModelId = context.parameters.stageCModelId.raw ?? '';
        const stageDModelId = context.parameters.stageDModelId.raw ?? '';
        const useTestHarness = context.parameters.useTestHarness.raw ?? false;
        const userId = context.userSettings.userId;

        const contextEx = context as unknown as ExtendedPCFContext;
        let baseUrl = "";
        if (!useTestHarness) {
            baseUrl = contextEx.page?.getClientUrl?.() ?? window.location.origin;
        }

        // Get allocated dimensions from PCF framework
        const allocatedWidth = parseInt(context.mode.allocatedWidth as unknown as string);
        const allocatedHeight = parseInt(context.mode.allocatedHeight as unknown as string);

        // Initialize root if not already created
        this.root ??= createRoot(this.container);
        
        // Render MainContainer directly with allocated dimensions
        const props: MainContainerProps = {
            stageAModelId,
            stageBModelId,
            stageCModelId,
            stageDModelId,
            baseUrl,
            useTestHarness,
            width: allocatedWidth,
            height: allocatedHeight
        };

        this.root.render(
            React.createElement(
                FluentProvider,
                { theme: copilotStudioTheme },
                React.createElement(
                    ServiceProvider,
                    { dependencies: { webAPI: context.webAPI, userId, baseUrl, pcfContext: context as unknown as ExtendedPCFContext } },
                    React.createElement(
                        ErrorBoundary,
                        null,
                        React.createElement(AppContainer, props)
                    )
                )
            )
        );
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
        if (this.root) {
            this.root.unmount();
            this.root = null;
        }
    }
}
