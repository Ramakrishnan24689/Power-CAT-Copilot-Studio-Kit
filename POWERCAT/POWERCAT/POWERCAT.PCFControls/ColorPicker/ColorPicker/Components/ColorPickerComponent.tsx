import * as React from "react";
import {
  ColorPicker,
  IColor,
  getColorFromString,
  TextField,
  Callout,
} from "@fluentui/react";

interface ColorPickerComponentProps {
  initialColor: string; // The initial color passed from control (in hex format)
  onColorChange: (colorHex: string) => void; // Callback to notify the parent control of color change
}

export const ColorPickerComponent: React.FunctionComponent<
  ColorPickerComponentProps
> = ({ initialColor, onColorChange }) => {
  const defaultColor = "#ffffff"; // Fallback color

  // Get the valid color on initialization
  const initialValidColor =
    getColorFromString(initialColor) || getColorFromString(defaultColor)!;

  const [color, setColor] = React.useState<IColor>(initialValidColor);
  const [showPicker, setShowPicker] = React.useState(false);
  const [calloutTarget, setCalloutTarget] = React.useState<HTMLElement | null>(
    null
  );

  // Ensure the initial color is applied correctly on mount
  React.useEffect(() => {
    const newColor = getColorFromString(initialColor);
    if (newColor) {
      setColor(newColor);
    } else {
      setColor(getColorFromString(defaultColor)!); // In case initialColor is invalid
    }
  }, [initialColor]);

  // Update the color when the user selects a new color from ColorPicker
  const updateColor = React.useCallback(
    (ev: any, colorObj: IColor) => {
      setColor(colorObj);
      onColorChange(colorObj.str); // Notify parent with the new color in hex
    },
    [onColorChange]
  );

  // Handle the TextField input change
  const handleTextChange = (
    event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ) => {
    if (newValue) {
      // If the input is valid color (partial or complete)
      if (newValue.startsWith("#")) {
        const colorObj = getColorFromString(newValue);
        if (colorObj) {
          setColor(colorObj); // Update state with valid color
          onColorChange(newValue); // Notify parent with valid color
        } else {
          // If it's not a valid color but still a partial input
          setColor({
            str: newValue,
            r: 0,
            g: 0,
            b: 0,
            a: 1,
            hex: newValue,
            h: 0,
            s: 0,
            v: 0,
          } as IColor); // Keep the current input, avoid fallback, and include missing properties
        }
      }
    }
  };

  // Show the color picker when the user clicks the rectangle
  const handleRectangleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    setCalloutTarget(event.currentTarget);
    setShowPicker(!showPicker);
  };

  return (
    <div className="wrapper">
      {/* Color rectangle */}
      <div
        className="colorRectangle"
        style={{ backgroundColor: color?.str || initialColor }}
        onClick={handleRectangleClick}
      />

      {/* Hex color TextField */}
      <TextField
        value={color?.str || initialColor}
        onChange={handleTextChange}
        className="hexInput"
        ariaLabel="Hex Color Input"
        placeholder="Enter Hex Color"
        maxLength={7}
      />

      {/* Color picker with Callout */}
      {showPicker && calloutTarget && (
        <Callout
          target={calloutTarget}
          onDismiss={() => setShowPicker(false)}
          className="callout"
        >
          <div className="arrow" />
          <ColorPicker color={color} onChange={updateColor} alphaType="none" />
        </Callout>
      )}
    </div>
  );
};
