/* eslint-env jest */
/* eslint-disable
  @typescript-eslint/no-explicit-any,
  @typescript-eslint/no-unsafe-assignment,
  @typescript-eslint/no-unsafe-member-access,
  @typescript-eslint/no-unsafe-call,
  @typescript-eslint/no-require-imports,
  @typescript-eslint/await-thenable,
  @typescript-eslint/require-await,
  @typescript-eslint/no-empty-function,
  @typescript-eslint/no-unnecessary-type-assertion,
  @typescript-eslint/non-nullable-type-assertion-style
*/

import * as React from "react";
import { render } from "@testing-library/react";
import type { IOutputs } from "../generated/ManifestTypes";

// Silence console.log from updateView
const origLog = console.log;
beforeAll(() => (console.log = jest.fn()));
afterAll(() => (console.log = origLog));

// Mock Fluent UI inputs so tests don't need full library
jest.mock("@fluentui/react-components", () => {
  const React = require("react");
  const Input = ({ value, type, placeholder, onChange, ...rest }: any) =>
    React.createElement("input", {
      value,
      type,
      placeholder,
      onChange: (e: any) => onChange?.(e, { value: e.target.value }),
      ...rest,
    });
  const Button = ({ children, onClick, ...rest }: any) =>
    React.createElement("button", { onClick, ...rest }, children);
  return {
    __esModule: true,
    FluentProvider: ({ children }: any) =>
      React.createElement("div", null, children),
    webLightTheme: {},
    Input,
    Button,
  };
});

jest.mock("@fluentui/react-icons", () => ({
  __esModule: true,
  EyeRegular: () => null,
  EyeOffRegular: () => null,
}));

// Mock ColumnMask to capture props without running hooks here
jest.mock("../components/ColumnMask", () => {
  const React = require("react");
  const Mock = (props: any) => {
    (global as any).__lastColumnMaskProps = props;
    return React.createElement("input", {
      "data-testid": "column-mask-mock",
      value: props.value,
      type: "password",
      "aria-label": "Client Secret",
      readOnly: true,
    });
  };
  return { __esModule: true, ColumnMask: Mock, default: Mock };
});

// Minimal PCF context helpers
interface Inputs {
  Value: ComponentFramework.PropertyTypes.StringProperty;
}
function createContext(value: string): ComponentFramework.Context<Inputs> {
  return {
    parameters: { Value: { raw: value } as any },
    mode: {
      allocatedWidth: 300,
      allocatedHeight: 40,
      isVisible: true,
      isControlDisabled: false,
      trackContainerResize: jest.fn(), // success path
    } as any,
  } as any;
}

describe("ColumnMask", () => {
  beforeEach(() => {
    (global as any).__lastColumnMaskProps = undefined;
  });

  it("updateView renders ColumnMask with context value", () => {
    const { ColumnMask } = require("../ColumnMask");
    const control = new ColumnMask();
    const notify = jest.fn();
    const context = createContext("init");

    control.init(context as any, notify, {} as any);
    const element = control.updateView(context as any);

    const { container } = render(element as React.ReactElement);
    const input = container.querySelector(
      'input[data-testid="column-mask-mock"]'
    ) as HTMLInputElement;

    expect(input).not.toBeNull();
    expect(input.value).toBe("init");
    expect(input.type).toBe("password");
  });

  it("getOutputs returns value after onChange", () => {
    const { ColumnMask } = require("../ColumnMask");
    const control = new ColumnMask();
    const notify = jest.fn();
    const context = createContext("");

    control.init(context as any, notify, {} as any);
    const element = control.updateView(context as any);
    render(element as React.ReactElement);

    const props = (global as any).__lastColumnMaskProps;
    expect(typeof props.onChange).toBe("function");

    props.onChange("new");
    expect(notify).toHaveBeenCalled();

    const outputs = control.getOutputs() as IOutputs;
    expect(outputs.Value).toBe("new");
  });

  it("handles hosts without trackContainerResize gracefully (catch path)", () => {
    const { ColumnMask } = require("../ColumnMask");
    const control = new ColumnMask();
    const notify = jest.fn();
    const context = createContext("x");

    (context.mode.trackContainerResize as jest.Mock).mockImplementation(() => {
      throw new Error("not supported");
    });

    expect(() => control.init(context as any, notify, {} as any)).not.toThrow();
  });

  it("uses empty string when Value.raw is undefined (covers ?? branch)", () => {
    const { ColumnMask } = require("../ColumnMask");
    const control = new ColumnMask();
    const notify = jest.fn();

    // context with raw: undefined to exercise right side of ??
    const context = {
      parameters: { Value: { raw: undefined } as any },
      mode: {
        allocatedWidth: 300,
        allocatedHeight: 40,
        isVisible: true,
        isControlDisabled: false,
        trackContainerResize: jest.fn(),
      } as any,
    } as ComponentFramework.Context<any>;

    control.init(context as any, notify, {} as any);

    // IMPORTANT: render the element so the ColumnMask mock runs and captures props
    const element = control.updateView(context as any);
    render(element as React.ReactElement);

    const props = (global as any).__lastColumnMaskProps;
    expect(props).toBeDefined();
    expect(props.value).toBe(""); // right-hand side of ?? ""
  });
});
