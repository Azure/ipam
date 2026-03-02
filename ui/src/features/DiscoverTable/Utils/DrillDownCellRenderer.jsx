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

/**
 * AG Grid cell renderer that displays the cell value with an optional
 * drill-down icon. The icon navigates to a child Discover tab with a
 * pre-applied filter.
 *
 * cellRendererParams:
 *   targets: Array<{
 *     label: string,          - Menu item label (e.g. "Blocks")
 *     path: string,           - Route path (e.g. "/discover/block")
 *     filterField: string,    - Field name to filter on (e.g. "parent_space")
 *     hasChildrenSelector: Function - Redux selector returning a Set of parent names
 *   }>
 */
/**
 * Internal hook that resolves which targets have children for a given value.
 * Accepts up to two targets (the maximum in our config). Each selector is
 * called unconditionally to satisfy the rules-of-hooks constraint.
 */
function useActiveTargets(targets, value) {
  const set0 = useSelector(targets[0]?.hasChildrenSelector ?? selectNone);
  const set1 = useSelector(targets[1]?.hasChildrenSelector ?? selectNone);
  const sets = [set0, set1];

  return targets.filter((_, i) => sets[i]?.has(value));
}

// Fallback selector that returns an empty Set (never matches)
const emptySet = new Set();
const selectNone = () => emptySet;

export default function DrillDownCellRenderer(props) {
  const { value, colDef } = props;
  const { targets = [] } = colDef.cellRendererParams || {};

  const navigate = useNavigate();
  const [menuAnchor, setMenuAnchor] = React.useState(null);

  const activeTargets = useActiveTargets(targets, value);

  const handleNavigate = (target) => {
    navigate(target.path, {
      state: {
        name: target.filterField,
        operator: "contains",
        type: "string",
        value: value,
      },
    });
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
