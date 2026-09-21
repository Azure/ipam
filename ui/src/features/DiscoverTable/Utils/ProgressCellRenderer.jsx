import React from "react";

import {
  Box,
  LinearProgress,
} from "@mui/material";

/**
 * AG Grid cell renderer that displays a color-coded progress bar
 * based on utilization percentage.
 *
 * - 0–70%:  green  (success)
 * - 71–89%: yellow (warning)
 * - 90%+:   red    (error)
 */
export default function ProgressCellRenderer(props) {
  const raw = props.value;
  const value = Number.isFinite(raw) ? Math.max(0, Math.min(raw, 100)) : 0;
  return (
    <Box sx={{ width: "100%", height: "100%", display: "flex", alignItems: "center" }}>
      <LinearProgress
        sx={{ width: "100%" }}
        variant="determinate"
        value={value}
        color={
          value >= 0 && value <= 70
            ? "success"
            : value > 70 && value < 90
            ? "warning"
            : value >= 90
            ? "error"
            : "info"
        }
      />
    </Box>
  );
}
