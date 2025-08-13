/**
 * index.ts
 *
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License.
 *
 * Provides main PCF control implementation for Agent Test Runner.
 *
 * Exports:
 *   - TestRunner: Main PCF control class implementing StandardControl interface.
 *
 * Usage:
 *   // Automatically instantiated by PowerApps framework
 *   // Control configured through ControlManifest.Input.xml
 */

import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { TestRunner as TestRunnerService } from "./testing/TestExecutor";
import { FluentTestRunnerManager } from "./ui/FluentTestRunnerUI";
import { TestRunnerController } from "./testing/ExecutionController";

/**
 * TestRunner
 *
 * Main PCF control for executing and monitoring Agent tests.
 * Provides user interface integration with test execution services and comprehensive
 * business logic separation through controller pattern implementation.
 */
export class TestRunner
  implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
  // DOM and context properties
  private container: HTMLDivElement;
  private context: ComponentFramework.Context<IInputs>;
  private notifyOutputChanged: () => void;

  // Service instances
  private testRunnerService: TestRunnerService | null = null;
  private fluentUIManager: FluentTestRunnerManager | null = null;
  private controller: TestRunnerController | null = null;

  // Entity ID for the current test run
  private entityId: string | null = null;

  /**
   * Initializes the PCF control with required services and UI components.
   * @param context - PCF context containing parameters and platform capabilities.
   * @param notifyOutputChanged - Callback to notify framework of output changes.
   * @param state - State dictionary for control persistence.
   * @param container - HTML container element for the control.
   */
  public init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
    container: HTMLDivElement
  ): void {
    this.context = context;
    this.container = container;
    this.notifyOutputChanged = notifyOutputChanged;

    // Extract entity ID from Test Run ID input parameter or page context
    const testRunIdInput = context.parameters.TestRunId?.raw;

    if (testRunIdInput && testRunIdInput.trim() !== "") {
      this.entityId = testRunIdInput.trim();
    } else {
      this.entityId =
        (
          context as ComponentFramework.Context<IInputs> & {
            page: { entityId: string };
          }
        ).page?.entityId || null;
    }

    // Initialize services
    this.testRunnerService = new TestRunnerService(context);
    this.fluentUIManager = new FluentTestRunnerManager(this.container);

    // Initialize controller with business logic
    this.controller = new TestRunnerController(
      this.testRunnerService,
      this.fluentUIManager,
      this.entityId
    );

    // Set up error logging bridge from TestRunnerService to Controller
    this.testRunnerService.setErrorLogger((error: string) => {
      // Route errors to controller's logging system
      if (this.controller) {
        this.controller.logError(error);
      }
    });

    // Initialize the controller which will handle all business logic
    this.controller.initialize();
  }

  /**
   * Updates the view when parameters change.
   * @param context - Updated PCF context.
   */
  public updateView(context: ComponentFramework.Context<IInputs>): void {
    // Update context reference
    this.context = context;
    // Controller handles all business logic, no additional updates needed here
  }

  /**
   * Gets the outputs for the PCF control.
   * @returns Output values for the control.
   */
  public getOutputs(): IOutputs {
    return {};
  }

  /**
   * Cleans up resources when the control is destroyed.
   */
  public destroy(): void {
    // Clean up controller
    if (this.controller) {
      this.controller.destroy();
      this.controller = null;
    }

    // Clean up Fluent UI Manager
    if (this.fluentUIManager) {
      this.fluentUIManager.destroy();
      this.fluentUIManager = null;
    }

    // Clean up service
    this.testRunnerService = null;
  }
}
