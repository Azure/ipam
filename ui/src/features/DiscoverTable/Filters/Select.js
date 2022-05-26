import * as React from "react";

import {
  IconButton,
  MenuItem,
  InputLabel,
  FormControl,
  ListItemText,
  Select,
  Checkbox
} from "@mui/material";

import {
  FilterAltOff
} from "@mui/icons-material";

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 235,
    },
    sx: {
      "&& .Mui-selected": {
        backgroundColor: "unset"
      },
      "&& .Mui-selected:hover": {
        backgroundColor: "rgba(0, 0, 0, 0.04)"
      }
    }
  },
};

export default function SelectFilter(props) {
  const { title, data, dataField, handleChange, state } = props;
  const didMount = React.useRef(false);

  const [value, setValue] = React.useState([]);

  React.useEffect(() => {
    state && setValue(state);
  },[]);

  React.useEffect(() => {
    var filterFunc = (arr, vals, field) => (vals.length ? vals.includes(arr[field]) : true);

    var changeData = {
      name: dataField,
      state: value,
      func: filterFunc
    };

    didMount.current ? handleChange(changeData) : didMount.current = true;
  }, [value]);

  return (
    <FormControl
      variant="standard"
      size="small"
      sx={{ margin: "0px 8px 0px 8px", width: 200, flexDirection: "row" }}
    >
      <InputLabel id="demo-multiple-checkbox-label">{title}</InputLabel>
      <Select
        labelId="demo-multiple-checkbox-label"
        id="demo-multiple-checkbox"
        multiple
        value={value}
        onChange={(event) => setValue(event.target.value)}
        // input={<OutlinedInput label="Tag" />}
        renderValue={(selected) => selected.join(", ")}
        style={{ width: "180px", minWidth: "180px" }}
        MenuProps={MenuProps}
      >
        {[...new Set(data.map((a) => a[dataField]))].map((name) => (
          <MenuItem key={name} value={name}>
            <Checkbox checked={value.indexOf(name) > -1} />
            <ListItemText primary={name} />
          </MenuItem>
        ))}
      </Select>
      <IconButton
        onClick={() => setValue([])}
        disableRipple
        size="small"
        style={{ padding: "20px 5px 0px 5px", backgroundColor: "transparent" }}
      >
        <FilterAltOff fontSize="inherit" />
      </IconButton>
    </FormControl>
  );
}
