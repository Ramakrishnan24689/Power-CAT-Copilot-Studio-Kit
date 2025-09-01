
import * as React from "react";
import { Badge } from "@fluentui/react-components";


interface ToggleBadgeProps {
  value: boolean;
  onText?: string;
  offText?: string;
  size?: "small" | "large" | "tiny" | "extra-small" | "medium" | "extra-large";
}

export const ToggleBadgeControl: React.FC<ToggleBadgeProps> = ({ value, onText, offText, size }) => {
  const isOn = !!value;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      <Badge
        shape="rounded"
        size={size ?? "large"}
        color={isOn ? "brand" : "informative"}
      >
        {isOn ? (typeof onText === 'string' && onText.length > 0 ? onText : "On") : (typeof offText === 'string' && offText.length > 0 ? offText : "Off")}
      </Badge>
    </div>
  );
};
