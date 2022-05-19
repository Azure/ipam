import * as React from "react";
import { useSelector } from 'react-redux';

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";

import {
	Box,
	Button,
	Slider,
	Dialog,
	DialogActions,
	DialogContent,
	DialogContentText,
	DialogTitle,
} from "@mui/material";

import { getRefreshInterval } from "../ipam/ipamSlice";

import { updateMe } from "../ipam/ipamAPI";

const marks = [
	{
		value: 5,
		label: "5",
	},
	{
		value: 10,
		label: "10",
	},
	{
		value: 15,
		label: "15",
	},
	{
		value: 30,
		label: "30",
	},
];

export default function UserSettings(props) {
	const { open, handleClose } = props;

  const { instance, accounts } = useMsal();
	const { enqueueSnackbar } = useSnackbar();

  const [refreshValue, setRefreshValue] = React.useState();
  const [sending, setSending] = React.useState(false);
  const refreshInterval = useSelector(getRefreshInterval);

  const unchanged = refreshInterval == refreshValue;

  React.useEffect(()=>{
    setRefreshValue(refreshInterval);
  }, []);

  function onSubmit() {
    var body = [
      { "op": "replace", "path": "/apiRefresh", "value": refreshValue }
    ];

    (async () => {
			const request = {
				scopes: ["https://management.azure.com/user_impersonation"],
				account: accounts[0],
			};

			try {
        setSending(true);
				const response = await instance.acquireTokenSilent(request);
				const data = await updateMe(response.accessToken, body);
        handleClose();
			} catch (e) {
				console.log("ERROR");
				console.log("------------------");
				console.log(e);
				console.log("------------------");
				enqueueSnackbar("Error updating refresh timeout", { variant: "error" });
			} finally {
        setSending(false);
      }
		})();
  }

	return (
		<div>
			<Dialog open={open} onClose={handleClose} fullWidth>
				<DialogTitle>
          Settings
        </DialogTitle>
				<DialogContent>
					<DialogContentText>
						Data refresh interval (minutes):
					</DialogContentText>
					<Box sx={{ p: 1 }}>
						<Slider
							aria-label="Restricted values"
              min={5}
              max={30}
              value={refreshValue}
							step={null}
							valueLabelDisplay="auto"
							marks={marks}
              onChange={(event, newValue) => setRefreshValue(newValue)}
						/>
					</Box>
				</DialogContent>
				<DialogActions>
					<Button onClick={handleClose}>Cancel</Button>
					<Button onClick={onSubmit} disabled={unchanged || sending}>
            Apply
          </Button>
				</DialogActions>
			</Dialog>
		</div>
	);
}
