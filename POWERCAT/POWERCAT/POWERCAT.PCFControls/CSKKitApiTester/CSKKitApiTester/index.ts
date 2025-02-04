import { IInputs, IOutputs } from "./generated/ManifestTypes";
import { InputProperties, TriggerTypes } from "./ManifestConstant";
import { Services } from "./services";
import toJsonSchema from "to-json-schema";
import { ContextEx } from "./Component.types";
import { APIResponse } from "./APIResponse";

export class CSKKitApiTester
  implements ComponentFramework.StandardControl<IInputs, IOutputs>
{
  notifyOutputChanged: () => void;
  context: ComponentFramework.Context<IInputs>;
  response: string;
  requestID?: string;
  isSuccessful: boolean;
  isError: boolean;
  requestSize: number;
  responseTime: string;
  statusCode: number;
  isXML: boolean;
  // Note: Outputschema is not used yet.
  // Dependency on toJsonSchema to be removed if not used going forward
  outputSchema?: toJsonSchema.JSONSchema3or4 | string;

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
    this.context = context;
    this.notifyOutputChanged = notifyOutputChanged;
  }

  /**
   * Called when any value in the property bag has changed. This includes field values, data-sets, global values such as container height and width, offline status, control metadata values such as label, visible, etc.
   * @param context The entire property bag available to control via Context Object; It contains values as set up by the customizer mapped to names defined in the manifest, as well as utility functions
   */
  public updateView(context: ComponentFramework.Context<IInputs>): void {
    const contextEx = context as unknown as ContextEx;
    const apiMethod = context.parameters.RequestURL.raw ?? "";
    const method = context.parameters.Method.raw;
    const services = new Services();
    const data = context.parameters.Data.raw ?? "";
    const headers = new Headers();
    const inputHeaders = context.parameters.Headers.raw ?? "";
    try {
      if (
        inputHeaders != "" &&
        inputHeaders != null &&
        inputHeaders != undefined
      ) {
        const JsonObj = JSON.parse(inputHeaders);
        JsonObj.forEach((item: any) => {
          headers.append(item.key, item.value);
        });
      } else {
        headers.append("Content-Type", "application/json");
      }
    } catch {
      console.warn("Invalid JSON format for Headers");
      headers.append("Content-Type", "application/json");
    }

    if (context.updatedProperties.indexOf(InputProperties.Trigger) > -1) {
      if (apiMethod) {
        const environmentUrl = contextEx.page.getClientUrl();
        const endPoint = environmentUrl.concat(apiMethod);
        const cdate = Date.now();
        let responseTime = 0;
        switch (method) {
          case TriggerTypes.Get:
            services
              .Get(endPoint, headers)
              .then((response: APIResponse) => {
                responseTime = Date.now() - cdate;
                this.response = response.Output;
                this.isSuccessful = true;
                this.isError = false;
                this.requestSize = new Blob([response.Output]).size;
                this.responseTime = responseTime.toString() ?? "";
                this.statusCode = response.StatusCode ?? 0;
                this.isXML = response.IsXML ?? false;
                this.notifyOutputChanged();
              })
              .catch((result: any) => {
                this.response = result.Output;
                this.isSuccessful = false;
                this.isError = true;
                this.responseTime = responseTime.toString() ?? "";
                this.statusCode = result.StatusCode ?? 500;
                this.isXML = result.IsXML ?? false;
                this.notifyOutputChanged();
              });
            break;
          case TriggerTypes.Post:
            responseTime = Date.now() - cdate;
            services
              .Post(endPoint, data, headers)
              .then((response: any) => {
                this.response = response.Output;
                this.isSuccessful = true;
                this.isError = false;
                this.requestSize =
                  response.Headers != undefined
                    ? parseInt(response.Headers.get("Content-Length")) ??
                      new Blob([response.Output]).size
                    : new Blob([response.Output]).size;
                this.responseTime = responseTime.toString() ?? "";
                this.statusCode = response.StatusCode ?? 500;
                this.isXML = response.IsXML ?? false;
                this.notifyOutputChanged();
              })
              .catch((result: any) => {
                (async () => {
                  this.response = result.Output;
                  this.isSuccessful = false;
                  this.isError = true;
                  this.responseTime = responseTime.toString();
                  this.statusCode = result.StatusCode ?? 500;
                  this.isXML = result.IsXML ?? false;
                  this.notifyOutputChanged();
                })();
              });
            break;
          case TriggerTypes.Patch:
            responseTime = Date.now() - cdate;
            services
              .Patch(endPoint, data, headers)
              .then((response: any) => {
                this.response = response.Output;
                this.isSuccessful = true;
                this.isError = false;
                this.requestSize =
                  response.Headers != undefined
                    ? parseInt(response.Headers.get("Content-Length")) ??
                      new Blob([response.Output]).size
                    : new Blob([response.Output]).size;
                this.responseTime = responseTime.toString() ?? "";
                this.statusCode = response.StatusCode ?? 500;
                this.isXML = response.IsXML ?? false;
                this.notifyOutputChanged();
              })
              .catch((result: any) => {
                (async () => {
                  this.response = result.Output;
                  this.isSuccessful = false;
                  this.isError = true;
                  this.responseTime = responseTime.toString();
                  this.statusCode = result.StatusCode ?? 500;
                  this.isXML = result.IsXML ?? false;
                  this.notifyOutputChanged();
                })();
              });
            break;
          case TriggerTypes.Put:
            responseTime = Date.now() - cdate;
            services
              .Put(endPoint, data, headers)
              .then((response: any) => {
                this.response = response.Output;
                this.isSuccessful = true;
                this.isError = false;
                this.requestSize =
                  response.Headers != undefined
                    ? parseInt(response.Headers.get("Content-Length")) ??
                      new Blob([response.Output]).size
                    : new Blob([response.Output]).size;
                this.responseTime = responseTime.toString() ?? "";
                this.statusCode = response.StatusCode ?? 500;
                this.isXML = response.IsXML ?? false;
                this.notifyOutputChanged();
              })
              .catch((result: any) => {
                (async () => {
                  this.response = result.Output;
                  this.isSuccessful = false;
                  this.isError = true;
                  this.responseTime = responseTime.toString();
                  this.statusCode = result.StatusCode ?? 500;
                  this.isXML = result.IsXML ?? false;
                  this.notifyOutputChanged();
                })();
              });
            break;
          case TriggerTypes.Delete:
            responseTime = Date.now() - cdate;
            services
              .Delete(endPoint, data, headers)
              .then((response: any) => {
                this.response = response.Output;
                this.isSuccessful = true;
                this.isError = false;
                this.requestSize =
                  response.Headers != undefined
                    ? parseInt(response.Headers.get("Content-Length")) ??
                      new Blob([response.Output]).size
                    : new Blob([response.Output]).size;
                this.responseTime = responseTime.toString() ?? "";
                this.statusCode = response.StatusCode ?? 500;
                this.isXML = response.IsXML ?? false;
                this.notifyOutputChanged();
              })
              .catch((result: any) => {
                (async () => {
                  this.response = result.Output;
                  this.isSuccessful = false;
                  this.isError = true;
                  this.responseTime = responseTime.toString();
                  this.statusCode = result.StatusCode ?? 500;
                  this.isXML = result.IsXML ?? false;
                  this.notifyOutputChanged();
                })();
              });
            break;
        }
        this.requestID = context.parameters.RequestID.raw ?? "";
      } else {
        console.warn("EndPoint/RequestURL missing !");
      }
    }
  }

  /**
   * It is called by the framework prior to a control receiving new data.
   * @returns an object based on nomenclature defined in manifest, expecting object[s] for property marked as "bound" or "output"
   */
  public getOutputs(): IOutputs {
    return {
      ResponseID: this.requestID,
      IsSuccessful: this.isSuccessful,
      IsError: this.isError,
      OutputString: this.isXML
        ? new XMLSerializer().serializeToString(
            new DOMParser().parseFromString(this.response, "text/xml")
          )
        : JSON.stringify(this.response),
      StatusCode: this.statusCode.toString(),
      StatusContent: this.GetStatusText(this.statusCode),
      RequestSize: this.formatBytes(this.requestSize),
      ResponseTime: this.responseTime,
      IsXML: this.isXML,
    };
  }

  /**
   * Called when the control is to be removed from the DOM tree. Controls should use this call for cleanup.
   * i.e. cancelling any pending remote calls, removing listeners, etc.
   */
  public destroy(): void {
    // Add code to cleanup control if necessary
  }

  public GetStatusText(statusCode: number): string {
    let statusContent = "";
    switch (statusCode) {
      case 200:
        statusContent = "OK";
        break;
      case 201:
        statusContent = "Created";
        break;
      case 202:
        statusContent = "Accepted";
        break;
      case 204:
        statusContent = "No Content";
        break;
      case 400:
        statusContent = "Bad Request";
        break;
      case 401:
        statusContent = "Unauthorized";
        break;
      case 403:
        statusContent = "Forbidden";
        break;
      case 404:
        statusContent = "Not Found";
        break;
      case 500:
        statusContent = "Internal Server Error";
        break;
      default:
        statusContent = "Unknown";
    }
    return statusContent;
  }

  public formatBytes(bytes: number, decimals = 2): string {
    if (!+bytes) return "0 bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
  }
}
