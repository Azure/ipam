import React from "react";

import {
  Box,
  Tooltip,
} from "@mui/material";

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

/**
 * AG Grid cell renderer that displays a value with an optional info icon tooltip.
 *
 * cellRendererParams:
 *   condition: function(data) - returns true if the info icon should show
 *   message:   string         - tooltip text to display
 *   color:     string         - text color when condition is true
 */
export default function InfoCellRenderer(props) {
  const { value, data, colDef } = props;
  const { condition, message, color } = colDef.cellRendererParams || {};

  // Check if condition is met (defaults to false if no condition provided)
  const showInfo = condition ? condition(data) : false;

  if (!showInfo) {
    return value;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        fontStyle: 'italic',
        color: color || 'inherit'
      }}
    >
      {value}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          paddingLeft: '3px',
          height: '30px'
        }}>
        <Tooltip
          arrow
          title={message || ''}
          placement="top"
          slotProps={{
            popper: {
              popperOptions: {
                modifiers: [
                  {
                    name: 'offset',
                    options: {
                      offset: [0, -10]
                    }
                  }
                ]
              }
            }
          }}
        >
          <InfoOutlinedIcon
            fontSize="small"
            style={{
              width: '12px'
            }}
          />
        </Tooltip>
      </Box>
    </Box>
  );
}
