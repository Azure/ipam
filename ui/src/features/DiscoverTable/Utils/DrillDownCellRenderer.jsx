import React from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router";

import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";

import { SubdirectoryArrowRight } from "@mui/icons-material";

import { selectDrillIndex, drillKey } from "../../ipam/ipamSlice";

/**
 * AG Grid cell renderer that displays the cell value with an optional
 * drill-down icon. The icon navigates to a child Discover tab with a
 * pre-applied filter.
 *
 * cellRendererParams:
 *   targets: Array<{
 *     label: string,   - Menu item label (e.g. "Blocks")
 *     path: string,    - Route path (e.g. "/discover/block")
 *     index: string,   - Key into the drill-down index, naming the Set of
 *                        parent identities that actually have children
 *     keyFrom: string, - Field on this row holding its identity, matched
 *                        against the index (e.g. "id")
 *     filter: Array<{ field: string, valueFrom: string }>
 *                      - Filter applied on the child tab; each entry maps a
 *                        target column (field) to a source row field
 *                        (valueFrom) resolved from props.data
 *   }>
 */
export default function DrillDownCellRenderer(props) {
  const { value, data, colDef } = props;
  const { targets = [] } = colDef.cellRendererParams || {};

  const navigate = useNavigate();
  const drillIndex = useSelector(selectDrillIndex);
  const [menuAnchor, setMenuAnchor] = React.useState(null);

  const activeTargets = targets.filter((target) => {
    const key = drillKey(data?.[target.keyFrom]);

    return key !== null && Boolean(drillIndex[target.index]?.has(key));
  });

  const handleNavigate = (target) => {
    // A drill-down asks for the children of one named parent, so every match is exact.
    const filters = target.filter.map((entry) => ({
      name: entry.field,
      operator: "equals",
      type: "string",
      value: data?.[entry.valueFrom] ?? ""
    }));

    navigate(target.path, { state: filters });
  };

  const handleIconClick = (e) => {
    e.stopPropagation();

    if (activeTargets.length === 1) {
      handleNavigate(activeTargets[0]);
    } else if (activeTargets.length > 1) {
      setMenuAnchor(e.currentTarget);
    }
  };

  const handleMenuClose = (e) => {
    e?.stopPropagation?.();
    setMenuAnchor(null);
  };

  const handleMenuItemClick = (e, target) => {
    e.stopPropagation();
    setMenuAnchor(null);
    handleNavigate(target);
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
      <span>{value}</span>
      {activeTargets.length > 0 && (
        <>
          <Tooltip
            title={
              activeTargets.length === 1
                ? `Show ${activeTargets[0].label}`
                : "Show Child Resources"
            }
          >
            <IconButton
              size="small"
              color="primary"
              sx={{ ml: 0.5, padding: "2px" }}
              onClick={handleIconClick}
              disableFocusRipple
              disableTouchRipple
              disableRipple
            >
              <SubdirectoryArrowRight sx={{ fontSize: "1rem" }} />
            </IconButton>
          </Tooltip>
          {activeTargets.length > 1 && (
            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={handleMenuClose}
              onClick={(e) => e.stopPropagation()}
              anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
              transformOrigin={{ vertical: "top", horizontal: "left" }}
            >
              {activeTargets.map((target) => (
                <MenuItem
                  dense
                  key={target.path}
                  onClick={(e) => handleMenuItemClick(e, target)}
                  sx={{ fontSize: "0.875rem" }}
                >
                  {target.label}
                </MenuItem>
              ))}
            </Menu>
          )}
        </>
      )}
    </Box>
  );
}
