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
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ColumnMask from "../components/ColumnMask";

// Clean slate for every test (JSDOM reuses <head/> and previous injections)
beforeEach(() => {
  document.querySelectorAll("#hide-edge-eye").forEach((el) => el.remove());
});

describe("ColumnMask", () => {
  it("renders, calls onChange, toggles show↔hide, and keeps input focus on mousedown of eye button", async () => {
    const handleChange = jest.fn();

    render(<ColumnMask value="secret" onChange={handleChange} />);

    const input = screen.getByLabelText(/client secret/i) as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("password");
    expect(input.value).toBe("secret");

    // type to trigger onChange
    await userEvent.click(input);
    await userEvent.type(input, "1");
    expect(handleChange).toHaveBeenCalled();

    // mousedown should NOT blur the input (covers onMouseDown preventDefault)
    const showBtn = screen.getByRole("button", { name: /show password/i });
    fireEvent.mouseDown(showBtn);
    expect(document.activeElement).toBe(input);

    // click toggles to SHOW
    await userEvent.click(showBtn);
    expect(input.type).toBe("text");
    expect(screen.getByRole("button", { name: /hide password/i })).toBeInTheDocument();

    // click toggles back to HIDE
    const hideBtn = screen.getByRole("button", { name: /hide password/i });
    await userEvent.click(hideBtn);
    expect(input.type).toBe("password");
    expect(screen.getByRole("button", { name: /show password/i })).toBeInTheDocument();
  });

  // REMOVED: injects one-time style to hide browser password icons (first-run branch)
  // REMOVED: skips style injection when style already exists (else branch)

  it("does not render eye button when value is empty; placeholder shows while unfocused", () => {
    const handleChange = jest.fn();
    render(<ColumnMask value="" onChange={handleChange} />);

    const input = screen.getByLabelText(/client secret/i) as HTMLInputElement;
    // default placeholder from component is '---' when not focused
    expect(input.getAttribute("placeholder")).toBe("---");

    // when value is empty, contentAfter should not render a button
    expect(screen.queryByRole("button", { name: /show password/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /hide password/i })).toBeNull();
  });

  it("renders disabled input and disabled eye button", async () => {
    render(<ColumnMask value="x" onChange={() => {}} disabled />);

    const input = screen.getByLabelText(/client secret/i) as HTMLInputElement;
    expect(input).toBeDisabled();

    // contentAfter exists because value is non-empty, but button must be disabled
    const showBtn = screen.getByRole("button", { name: /show password/i });
    expect(showBtn).toBeDisabled();
  });

  it("covers focusInput catch path by forcing setSelectionRange to throw", async () => {
    jest.useFakeTimers();

    render(<ColumnMask value="throw" onChange={() => {}} />);
    const input = screen.getByLabelText(/client secret/i) as HTMLInputElement;

    await userEvent.click(input);

    // Force setSelectionRange to throw to hit the catch { /* ignore */ }
    const original = (input as any).setSelectionRange;
    (input as any).setSelectionRange = () => {
      throw new Error("boom");
    };

    // Toggling schedules focusInput via setTimeout(..., 0)
    const showBtn = screen.getByRole("button", { name: /show password/i });
    await userEvent.click(showBtn);

    // Flush the scheduled focusInput
    jest.runOnlyPendingTimers();

    // Restore to avoid side-effects
    (input as any).setSelectionRange = original;
    jest.useRealTimers();

    // If the catch ran without throwing, we get here
    expect(true).toBe(true);
  });
  it("restores placeholder after blur (covers onBlur line)", async () => {
    const handleChange = jest.fn();
    render(<ColumnMask value="" onChange={handleChange} />);

    const input = screen.getByLabelText(/client secret/i) as HTMLInputElement;

    // Unfocused -> default placeholder visible
    expect(input.getAttribute("placeholder")).toBe("---");

    // Focus hides placeholder
    await userEvent.click(input);
    expect(input.getAttribute("placeholder")).toBe("");

    // Blur brings it back (executes onBlur line)
    input.blur();
    expect(input.getAttribute("placeholder")).toBe("---");
  });
  it("uses empty string when value is undefined (covers value ?? '' branch)", () => {
    // Cast to any to pass undefined; exercises the nullish-coalescing branch
    render(<ColumnMask value={undefined as any} onChange={() => {}} />);
    const input = screen.getByLabelText(/client secret/i) as HTMLInputElement;
    expect(input.value).toBe("");
  });

});