import * as React from "react";
import {
  ColorPicker,
  IColor,
  getColorFromString,
  TextField,
  Callout,
} from "@fluentui/react";

// Define the props for the ColorPickerComponent
interface ColorPickerComponentProps {
  initialColor: string | null;
  onColorChange: (colorHex: string | null) => void;
}

// Define the state for the ColorPickerComponent
interface ColorState {
  color: IColor;
  hexValue: string;
}

export const ColorPickerComponent: React.FunctionComponent<
  ColorPickerComponentProps
> = ({ initialColor, onColorChange }) => {
  // Validate hex color string
  const isValidHexColor = (color: string): boolean => {
    return /^#[0-9A-F]{6}([0-9A-F]{2})?$/i.test(color);
  };

  // Initialize state with a default color or the provided initial color
  const getInitialState = (): ColorState => {
    const defaultColor = getColorFromString(initialColor || "#FFFFFF")!;
    return {
      color: defaultColor,
      hexValue: initialColor || "",
    };
  };

  const [colorState, setColorState] = React.useState<ColorState>(
    getInitialState()
  );
  const [showPicker, setShowPicker] = React.useState(false);
  const [calloutTarget, setCalloutTarget] = React.useState<HTMLElement | null>(
    null
  );

  // Handle updates to initialColor prop
  React.useEffect(() => {
    if (initialColor !== colorState.hexValue) {
      const newColor = getColorFromString(initialColor || "")!;
      setColorState({
        color: newColor,
        hexValue: initialColor || "",
      });
    }
  }, [initialColor]);

  // Convert alpha value (0-1) to two-digit hex
  const alphaToHex = (alpha: number): string => {
    // Map common percentages to their exact hex values
    const alphaMap: { [key: number]: string } = {
      1: "FF",
      0.99: "FC",
      0.98: "FA",
      0.97: "F7",
      0.96: "F5",
      0.95: "F2",
      0.94: "F0",
      0.93: "ED",
      0.92: "EB",
      0.91: "E8",
      0.9: "E6",
      0.89: "E3",
      0.88: "E0",
      0.87: "DE",
      0.86: "DB",
      0.85: "D9",
      0.84: "D6",
      0.83: "D4",
      0.82: "D1",
      0.81: "CF",
      0.8: "CC",
      0.79: "C9",
      0.78: "C7",
      0.77: "C4",
      0.76: "C2",
      0.75: "BF",
      0.74: "BD",
      0.73: "BA",
      0.72: "B8",
      0.71: "B5",
      0.7: "B3",
      0.69: "B0",
      0.68: "AD",
      0.67: "AB",
      0.66: "A8",
      0.65: "A6",
      0.64: "A3",
      0.63: "A1",
      0.62: "9E",
      0.61: "9C",
      0.6: "99",
      0.59: "96",
      0.58: "94",
      0.57: "91",
      0.56: "8F",
      0.55: "8C",
      0.54: "8A",
      0.53: "87",
      0.52: "85",
      0.51: "82",
      0.5: "80",
      0.49: "7D",
      0.48: "7A",
      0.47: "78",
      0.46: "75",
      0.45: "73",
      0.44: "70",
      0.43: "6E",
      0.42: "6B",
      0.41: "69",
      0.4: "66",
      0.39: "63",
      0.38: "61",
      0.37: "5E",
      0.36: "5C",
      0.35: "59",
      0.34: "57",
      0.33: "54",
      0.32: "52",
      0.31: "4F",
      0.3: "4D",
      0.29: "4A",
      0.28: "47",
      0.27: "45",
      0.26: "42",
      0.25: "40",
      0.24: "3D",
      0.23: "3B",
      0.22: "38",
      0.21: "36",
      0.2: "33",
      0.19: "30",
      0.18: "2E",
      0.17: "2B",
      0.16: "29",
      0.15: "26",
      0.14: "24",
      0.13: "21",
      0.12: "1F",
      0.11: "1C",
      0.1: "1A",
      0.09: "17",
      0.08: "14",
      0.07: "12",
      0.06: "0F",
      0.05: "0D",
      0.04: "0A",
      0.03: "08",
      0.02: "05",
      0.01: "03",
      0: "00",
    };

    const roundedAlpha = alpha !== 0 ? alpha / 100 : 0;
    return alphaMap[roundedAlpha] || "00";
  };

  // Convert color to 8-digit hex (including alpha)
  const getColorWithAlpha = (colorObj: IColor): string => {
    const r = colorObj.r.toString(16).padStart(2, "0");
    const g = colorObj.g.toString(16).padStart(2, "0");
    const b = colorObj.b.toString(16).padStart(2, "0");
    const a = alphaToHex(typeof colorObj.a === "number" ? colorObj.a : 1);
    return `#${r}${g}${b}${a}`.toUpperCase();
  };

  // Update when color picker changes
  const updateColor = React.useCallback(
    (_ev: any, colorObj: IColor) => {
      const updatedColor: IColor = {
        ...colorObj,
        a: typeof colorObj.a === "number" ? colorObj.a : 1,
        str: colorObj.str,
      };

      const hexWithAlpha = getColorWithAlpha(updatedColor);
      setColorState({
        color: updatedColor,
        hexValue: hexWithAlpha,
      });
      onColorChange(hexWithAlpha);
    },
    [onColorChange]
  );

  // Handle the TextField input change
  const handleTextChange = (
    _event: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>,
    newValue?: string
  ): void => {
    if (!newValue || newValue.trim() === "") {
      setColorState((prev) => ({
        ...prev,
        hexValue: "",
      }));
      onColorChange(null);
      return;
    }

    let formattedValue = newValue.toUpperCase();
    if (formattedValue.length > 9) {
      formattedValue = formattedValue.substring(0, 9);
    }

    setColorState((prev) => ({
      ...prev,
      hexValue: formattedValue,
    }));

    // Process valid hex color with optional alpha
    if (/^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(formattedValue)) {
      const colorObj = getColorFromString(formattedValue);

      if (colorObj) {
        if (formattedValue.length === 7) {
          colorObj.a = 100;
        }
        setColorState((prev) => ({
          ...prev,
          color: colorObj,
        }));
        onColorChange(formattedValue);
      }
    }
  };

  // Show the color picker when the user clicks the rectangle
  const handleRectangleClick = (
    event: React.MouseEvent<HTMLDivElement>
  ): void => {
    setCalloutTarget(event.currentTarget);
    setShowPicker(!showPicker);
  };
  return (
    <div className="wrapper">
      <div
        className="colorRectangle"
        style={{
          backgroundColor: colorState.hexValue || "transparent",
          cursor: "pointer",
        }}
        onClick={handleRectangleClick}
      />

      <TextField
        value={isValidHexColor(colorState.hexValue) ? colorState.hexValue : ""}
        onChange={handleTextChange}
        className="hexInput"
        ariaLabel="Hex Color Input"
        placeholder="Enter Hex Color"
        maxLength={9}
      />

      {showPicker && calloutTarget && (
        <Callout
          target={calloutTarget}
          onDismiss={() => setShowPicker(false)}
          className="callout"
        >
          <div className="arrow" />
          <ColorPicker
            color={colorState.color}
            onChange={updateColor}
            alphaType="alpha"
            showPreview={true}
          />
        </Callout>
      )}
    </div>
  );
};
