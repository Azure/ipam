import * as React from "react";

import {
  Typography,
  FormControl,
  Slider
} from "@mui/material";

export default function RangeFilter(props) {
  const { title, data, dataField, step, handleChange, state } = props;
  const didMount = React.useRef(false);

  const [value, setValue] = React.useState([Math.min(...data.map((x) => x[dataField])), Math.max(...data.map((x) => x[dataField]))]);

  React.useEffect(() => {
    state && setValue(state);
  },[]);

  React.useEffect(() => {
    var filterFunc = (arr, vals, field) => (vals.length ? arr[field] >= vals[0] && arr[field]<= vals[1] : true);

    var changeData = {
      name: dataField,
      state: value,
      func: filterFunc
    };

    didMount.current ? handleChange(changeData): didMount.current = true;
  }, [value]);

	return (
		<FormControl variant="standard" size="small" sx={{ margin: "0px 8px 0px 8px", width: 200 }}>
			<Typography id="track-false-range-slider" gutterBottom>
				{title}
			</Typography>
			<Slider
				size="small"
				min={Math.min(...data.map((x) => x[dataField]))}
				max={Math.max(...data.map((x) => x[dataField]))}
        step={step}
				// step={null}
        // marks={data.map(item => ({ value: item[dataField] }))}
				// getAriaLabel={() => label}
				value={
					value.length == 0
						? [Math.min(...data.map((x) => x[dataField])), Math.max(...data.map((x) => x[dataField]))]
						: value
				}
				onChange={(event) => setValue(event.target.value)}
				valueLabelDisplay="auto"
				// getAriaValueText={valuetext}
			/>
		</FormControl>
	);
}
