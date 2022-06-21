import * as React from "react";

import {
  Box,
  Menu,
  MenuItem
} from "@mui/material";

import SelectFilter from "./Filters/Select";
import RangeFilter from "./Filters/Range";

const MenuProps = {
  paperprops: {
    elevation: 0,
    sx: {
      overflow: "visible",
      filter: "drop-shadow(0px 2px 8px rgba(0,0,0,0.32))",
      mt: 1.5,
      "& .MuiAvatar-root": {
        width: 32,
        height: 32,
        ml: -0.5,
        mr: 1,
      },
      "&:before": {
        content: '""',
        display: "block",
        position: "absolute",
        top: 0,
        right: 14,
        width: 10,
        height: 10,
        bgcolor: "background.paper",
        transform: "translateY(-50%) rotate(45deg)",
        zIndex: 0,
      }
    },
  },
};

export default function FilterMenu(props) {
  const {
    open,
    data,
    anchorEl,
    filterSettings,
    handleClose,
    state
  } = props;
  const [menuState, setMenuState] = React.useState({});
  const [filters, setFilters] = React.useState({});
  // const open = Boolean(anchorEl);

  const filterChange = (update) => {
    setMenuState({
      ...menuState,
      [update.name]: update.state
    });

    setFilters({
      ...filters,
      [update.name]: {
        func: update.func,
        vals: update.state
      }
    });
  }

  return (
    <React.Fragment>
      <Menu
        id="basic-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={() => handleClose(menuState, filters)}
        transformOrigin={{ horizontal: "right", vertical: "top" }}
        anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
        PaperProps={MenuProps}
        MenuListProps={{
          "aria-labelledby": "basic-button",
        }}
      >
        <Box>
          {filterSettings.map((row, index) => {
            return(
              <MenuItem
                key={index}
                sx={{
                  "&:hover": {
                    backgroundColor: "transparent"
                  },
                  "& .MuiSelect-select:focus": {
                    backgroundColor: "unset"
                  }
                }}
              >
                {row.type == "select" &&
                  <SelectFilter
                    title={row.title}
                    data={data}
                    dataField={row.dataField}
                    handleChange={(info) => filterChange(info)}
                    state={state[row.dataField]}
                  />
                }
                {row.type == "range" &&
                  <RangeFilter
                    title={row.title}
                    data={data}
                    dataField={row.dataField}
                    step={row.step}
                    handleChange={(info) => filterChange(info)}
                    state={state[row.dataField]}
                  />
                }
              </MenuItem>
            );
          })}
        </Box>
      </Menu>
    </React.Fragment>
  );
}
