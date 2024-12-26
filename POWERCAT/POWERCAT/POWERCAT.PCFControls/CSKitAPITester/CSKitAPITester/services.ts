import { APIResponse } from "./APIResponse";

export class Services {
  private entityValue1 = {
    fullname: "System Administrator1",
    internalemailaddress: "admin1@CRM931440.OnMicrosoft.com",
    systemuserid: "a697caef-6776-ec12-8d21-000d3a0ca45e",
    ownerid: "a697caef-6776-ec12-8d21-000d3a0ca45e",
  } as ComponentFramework.WebApi.Entity;

  private entityValue2 = {
    fullname: "System Administrator2",
    internalemailaddress: "admin2@CRM931440.OnMicrosoft.com",
    systemuserid: "a697caef-6776-ec12-8d21-000d3a0ca45e",
    ownerid: "a697caef-6776-ec12-8d21-000d3a0ca45e",
  } as ComponentFramework.WebApi.Entity;

  private lookupValue = {
    id: "a697caef-6776-ec11-8d21-000d3a0ca45e",
    name: "Contoso1",
    entityType: "Contoso",
  } as ComponentFramework.LookupValue;

  public getRecords(
    webAPI: ComponentFramework.WebApi,
    entityName: string,
    selectQueryText: string,
    filterQueryText: string,
    maximumPagesize?: number
  ): Promise<ComponentFramework.WebApi.RetrieveMultipleResponse["entities"]> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const selectQuery = "?$select=".concat(selectQueryText);
          const filterQuery = "&$filter=".concat(filterQueryText);
          const optionQuery = selectQuery.concat(
            filterQueryText.length > 0 ? filterQuery : ""
          );
          const oResults = await webAPI.retrieveMultipleRecords(
            entityName,
            optionQuery,
            maximumPagesize
          );
          resolve(
            oResults.entities.map((value: ComponentFramework.WebApi.Entity) => {
              return value;
            })
          );
        } catch (e) {
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.log("PCFNonImplementedError");
            resolve([
              this.entityValue1,
              this.entityValue2,
            ] as ComponentFramework.WebApi.RetrieveMultipleResponse["entities"]);
          } else {
            reject(e);
          }
        }
      })();
    });
  }

  public getRecordbyID(
    webAPI: ComponentFramework.WebApi,
    entityName: string,
    recordID: string,
    selectQueryText: string,
    expandQueryText: string
  ): Promise<ComponentFramework.WebApi.Entity> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          const selectQuery = "?$select=".concat(selectQueryText);
          const expandQuery = "&$filter=".concat(expandQueryText);
          const optionQuery = selectQueryText
            ? selectQuery.concat(expandQueryText.length > 0 ? expandQuery : "")
            : undefined;

          return await webAPI.retrieveRecord(entityName, recordID, optionQuery);
        } catch (e) {
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.log("PCFNonImplementedError");
            resolve([this.entityValue1]);
          } else {
            reject(e);
          }
        }
      })();
    });
  }

  public createRecord(
    webAPI: ComponentFramework.WebApi,
    entityName: string,
    data: ComponentFramework.WebApi.Entity
  ): Promise<ComponentFramework.LookupValue> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return await webAPI.createRecord(entityName, data);
        } catch (e) {
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.log("PCFNonImplementedError");
            resolve(this.lookupValue as ComponentFramework.LookupValue);
          } else {
            reject(e);
          }
        }
      })();
    });
  }

  public deleteRecord(
    webAPI: ComponentFramework.WebApi,
    entityName: string,
    recordID: string
  ): Promise<ComponentFramework.LookupValue> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return await webAPI.deleteRecord(entityName, recordID);
        } catch (e) {
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.log("PCFNonImplementedError");
            resolve(this.lookupValue as ComponentFramework.LookupValue);
          } else {
            reject(e);
          }
        }
      })();
    });
  }

  public updateRecord(
    webAPI: ComponentFramework.WebApi,
    entityName: string,
    recordID: string,
    data: ComponentFramework.WebApi.Entity
  ): Promise<ComponentFramework.LookupValue> {
    return new Promise((resolve, reject) => {
      (async () => {
        try {
          return await webAPI.updateRecord(entityName, recordID, data);
        } catch (e) {
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.log("PCFNonImplementedError");
            resolve(this.lookupValue as ComponentFramework.LookupValue);
          } else {
            reject(e);
          }
        }
      })();
    });
  }

  public Get(endpoint: string, headersString: Headers): Promise<APIResponse> {
    return new Promise((resolve, reject) => {
      const response: APIResponse = {
        Output: "",
        StatusCode: 0,
        Headers: undefined,
        IsXML: false,
      };
      (async () => {
        try {
          const result = await fetch(endpoint, {
            method: "Get",
            headers: headersString, //{ 'Content-Type': 'application/json' },
          });
          response.StatusCode = result.status;
          response.Headers = result.headers;

          const contentType = result.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            response.Output = await result.json();
            response.IsXML = false;
          } else if (
            contentType &&
            (contentType.includes("application/xml") ||
              contentType.includes("text/xml"))
          ) {
            response.Output = await result.text();
            response.IsXML = true;
          }
          resolve(response);
        } catch (e) {
          console.error(e);
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.error("PCFNonImplementedError");
            resolve({ id: "1", value: "test1" } as any);
          } else {
            response.Output = e;
            response.StatusCode = 500;
            response.IsXML = false;
            reject(response);
          }
        }
      })();
    });
  }

  public Post(
    endpoint: string,
    data: string,
    headersString: Headers
  ): Promise<APIResponse | string> {
    return new Promise((resolve, reject) => {
      const response: APIResponse = {
        Output: "",
        StatusCode: 0,
        Headers: undefined,
        IsXML: false,
      };
      (async () => {
        try {
          const result = await fetch(endpoint, {
            method: "Post",
            headers: headersString, //{ 'Content-Type': 'application/json','Prefer':'return=representation' },
            body: data,
          });
          response.StatusCode = result.status;
          response.Headers = result.headers;

          const contentType = result.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            response.Output = await result.json();
            response.IsXML = false;
          } else if (
            contentType &&
            (contentType.includes("application/xml") ||
              contentType.includes("text/xml"))
          ) {
            response.Output = await result.text();
            response.IsXML = true;
          }
          resolve(response);
        } catch (e) {
          console.error(e);
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.error("PCFNonImplementedError");
            resolve({ id: "1", value: "test1" } as any);
          } else {
            response.Output = e;
            response.StatusCode = 500;
            response.IsXML = false;
            reject(response);
          }
        }
      })();
    });
  }

  public Put(
    endpoint: string,
    data: string,
    headersString: Headers
  ): Promise<APIResponse | string> {
    return new Promise((resolve, reject) => {
      const response: APIResponse = {
        Output: "",
        StatusCode: 0,
        Headers: undefined,
        IsXML: false,
      };
      (async () => {
        try {
          const result = await fetch(endpoint, {
            method: "Put",
            headers: headersString, //{ 'Content-Type': 'application/json','Prefer':'return=representation' },
            body: data,
          });
          response.StatusCode = result.status;
          response.Headers = result.headers;

          const contentType = result.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            response.Output = await result.json();
            response.IsXML = false;
          } else if (
            contentType &&
            (contentType.includes("application/xml") ||
              contentType.includes("text/xml"))
          ) {
            response.Output = await result.text();
            response.IsXML = true;
          }
          resolve(response);
        } catch (e) {
          console.error(e);
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.error("PCFNonImplementedError");
            resolve({ id: "1", value: "test1" } as any);
          } else {
            response.Output = e;
            response.StatusCode = 500;
            response.IsXML = false;
            reject(response);
          }
        }
      })();
    });
  }

  public Patch(
    endpoint: string,
    data: string,
    headersString: Headers
  ): Promise<APIResponse | string> {
    return new Promise((resolve, reject) => {
      const response: APIResponse = {
        Output: "",
        StatusCode: 0,
        Headers: undefined,
        IsXML: false,
      };
      (async () => {
        try {
          const result = await fetch(endpoint, {
            method: "Patch",
            headers: headersString, //{ 'Content-Type': 'application/json','Prefer':'return=representation' },
            body: data,
          });
          response.StatusCode = result.status;
          response.Headers = result.headers;

          const contentType = result.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            response.Output = await result.json();
            response.IsXML = false;
          } else if (
            contentType &&
            (contentType.includes("application/xml") ||
              contentType.includes("text/xml"))
          ) {
            response.Output = await result.text();
            response.IsXML = true;
          }
          resolve(response);
        } catch (e) {
          console.error(e);
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.error("PCFNonImplementedError");
            resolve({ id: "1", value: "test1" } as any);
          } else {
            response.Output = e;
            response.StatusCode = 500;
            response.IsXML = false;
            reject(response);
          }
        }
      })();
    });
  }

  public Delete(
    endpoint: string,
    data: string,
    headersString: Headers
  ): Promise<APIResponse | string> {
    return new Promise((resolve, reject) => {
      const response: APIResponse = {
        Output: "",
        StatusCode: 0,
        Headers: undefined,
        IsXML: false,
      };
      (async () => {
        try {
          const result = await fetch(endpoint, {
            method: "Delete",
            headers: headersString, //{ 'Content-Type': 'application/json','Prefer':'return=representation' },
            body: data,
          });
          response.StatusCode = result.status;
          response.Headers = result.headers;

          const contentType = result.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            response.Output = await result.json();
            response.IsXML = false;
          } else if (
            contentType &&
            (contentType.includes("application/xml") ||
              contentType.includes("text/xml"))
          ) {
            response.Output = await result.text();
            response.IsXML = true;
          }
          resolve(response);
        } catch (e) {
          console.error(e);
          if (e instanceof Error && e.name === "PCFNonImplementedError") {
            console.error("PCFNonImplementedError");
            resolve({ id: "1", value: "test1" } as any);
          } else {
            response.Output = e;
            response.StatusCode = 500;
            response.IsXML = false;
            reject(response);
          }
        }
      })();
    });
  }
}

/**
 *
 * @param endpoint | Url e.g.
 * @param method  POST|GET|PUT etc
 * @param data - OData
 * @returns
 */
export async function customAPICall(
  endpoint: string,
  method: string,
  data: string
): Promise<Response> {
  return await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: data,
  });
}

export async function GetCall(endpoint: string): Promise<Response> {
  return await fetch(endpoint, {
    method: "Get",
    headers: { "Content-Type": "application/json" },
  });
}
