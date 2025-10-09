import * as React from "react";
import { Input, Button } from "@fluentui/react-components";
import { EyeRegular, EyeOffRegular } from "@fluentui/react-icons";
import "./css/ColumnMask.css";

export interface IColumnMaskProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  disabled?: boolean;
  containerWidth?: number;
  containerHeight?: number;
}
/**
 * Functional implementation of the ColumnMask input with mask/show functionality.
 */
export const ColumnMaskFunctional: React.FC<IColumnMaskProps> = ({
  value,
  onChange,
  placeholder = "---",
  disabled = false,
}) => {
  const [localValue, setLocalValue] = React.useState<string>(value ?? "");
  const [focused, setFocused] = React.useState<boolean>(false);
  const [showPlain, setShowPlain] = React.useState<boolean>(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  // Removed useEffect for style injection, since all styles are now in CSS
  React.useEffect(() => {
    setLocalValue(value ?? "");
  }, [value]);

  const focusInput = () => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* ignore */
      }
    }
  };

  /**
   * Handles toggling between masked and plain text input.
   * Keeps the input focused.
   * @param e Mouse event from the toggle button
   */
  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPlain((prev) => !prev);
    setTimeout(focusInput, 0);
  };

  /**
   * Handles changes to the input value.
   * @param _ev Change event
   * @param data Data containing the new value
   */
  const handleChange = (
    _ev: React.ChangeEvent<HTMLInputElement>,
    data: { value: string }
  ) => {
    setLocalValue(data.value);
    onChange(data.value);
  };

  return (
    <div className="masked-input-container">
      <Input
        input={{ ref: inputRef }}
        className="masked-input"
        type={showPlain ? "text" : "password"}
        value={localValue}
        placeholder={focused ? "" : placeholder}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={handleChange}
        autoComplete="new-password"
        contentAfter={
          localValue ? (
            <span className="masked-eye-after">
              <Button
                appearance="subtle"
                size="small"
                icon={showPlain ? <EyeRegular /> : <EyeOffRegular />}
                onMouseDown={(e) => e.preventDefault()} // keep focus
                onClick={handleToggle}
                className="masked-eye-toggle"
                aria-label={showPlain ? "Hide password" : "Show password"}
                disabled={disabled}
              />
            </span>
          ) : null
        }
        aria-label="Client Secret"
      />
    </div>
  );
};

/** Class wrapper to preserve original API */
export class ColumnMask extends React.Component<IColumnMaskProps> {
  /**
   * Renders the ColumnMaskFunctional component with passed props.
   */
  render() {
    return <ColumnMaskFunctional {...this.props} />;
  }
}

export default ColumnMask;
