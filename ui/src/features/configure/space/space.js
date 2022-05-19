import * as React from "react";
import { styled } from "@mui/material/styles";

import { DataGrid, GridOverlay } from "@mui/x-data-grid";

import {
	Box,
	IconButton,
	Tooltip,
	Menu,
	MenuItem,
	ListItemIcon,
	Divider,
	Typography,
	LinearProgress,
} from "@mui/material";

import {
	Edit as EditIcon,
	DeleteOutline as DeleteOutlineIcon,
	MoreVert as MoreVertIcon,
  CloudQueue as CloudQueueIcon,
} from "@mui/icons-material";

import Shrug from "../../../img/pam/Shrug";

import AddSpace from "./Utils/addSpace";
import EditSpace from "./Utils/editSpace";
import ConfirmDelete from "./Utils/confirmDelete";

import { ConfigureContext } from "../configureContext";

const GridHeader = styled("div")({
	height: "50px",
	width: "100%",
	display: "flex",
	borderBottom: "1px solid rgba(224, 224, 224, 1)",
});

const GridTitle = styled("div")(({ theme }) => ({
	...theme.typography.h6,
	width: "80%",
	textAlign: "center",
	alignSelf: "center",
}));

const GridBody = styled("div")({
	height: "100%",
	width: "100%",
});

const StyledGridOverlay = styled("div")({
	display: "flex",
	flexDirection: "column",
	alignItems: "center",
	justifyContent: "center",
	height: "100%",
});

const columns = [
	{ field: "name", headerName: "Name", headerAlign: "left", align: "left", flex: 0.5 },
	{ field: "desc", headerName: "Description", headerAlign: "left", align: "left", flex: 1 },
];

export default function SpaceDataGrid(props) {
  const { setSelected } = props;
	const { spaces, refresh } = React.useContext(ConfigureContext);

	const [loading, setLoading] = React.useState(true);
	const [selectionModel, setSelectionModel] = React.useState([]);
  const [addSpaceOpen, setAddSpaceOpen] = React.useState(false);
  const [editSpaceOpen, setEditSpaceOpen] = React.useState(false);
	const [deleteSpaceOpen, setDeleteSpaceOpen] = React.useState(false);
	const [anchorEl, setAnchorEl] = React.useState(null);

	const selectedRow = selectionModel.length
		? spaces.find((obj) => {
				return obj.name === selectionModel[0];
		  })
		: null;

	const menuOpen = Boolean(anchorEl);

	React.useEffect(() => {
    spaces && setLoading(false);
  },[spaces]);

  React.useEffect(() => {
    setSelected(selectedRow);
	}, [selectedRow]);

	function CustomLoadingOverlay() {
		return (
			<GridOverlay>
				<div style={{ position: "absolute", top: 0, width: "100%" }}>
					<LinearProgress />
				</div>
			</GridOverlay>
		);
	}

	function CustomNoRowsOverlay() {
		return (
			<StyledGridOverlay>
				<Typography variant="overline" display="block" sx={{ mt: 1 }}>
          No Spaces Found, Create a Space to Begin
        </Typography>
			</StyledGridOverlay>
		);
	}

	const handleMenuClick = (event) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
	};

  const handleAddSpace = () => {
		handleMenuClose();
		setAddSpaceOpen(true);
	};

  const handleEditSpace = () => {
		handleMenuClose();
		setEditSpaceOpen(true);
	};

	const handleDeleteSpace = () => {
		handleMenuClose();
		setDeleteSpaceOpen(true);
	};

	function onModelChange(newModel) {
		if (JSON.stringify(newModel) === JSON.stringify(selectionModel)) {
			setSelectionModel([]);
		} else {
			setSelectionModel(newModel);
		}
	}

	return (
		<React.Fragment>
			<EditSpace
        open={editSpaceOpen}
        handleClose={() => setEditSpaceOpen(false)}
        space={selectedRow ? selectedRow : null}
        spaces={spaces}
        refresh={() => refresh()}
      />
      <AddSpace
        open={addSpaceOpen}
        handleClose={() => setAddSpaceOpen(false)}
        spaces={spaces}
        refresh={() => refresh()}
      />
			<ConfirmDelete
        open={deleteSpaceOpen}
        handleClose={() => setDeleteSpaceOpen(false)}
        space={selectedRow ? selectedRow.name : null}
        refresh={() => refresh()}
      />
			<GridHeader
				style={{
					borderBottom: "1px solid rgba(224, 224, 224, 1)",
					backgroundColor: selectedRow ? "rgba(25, 118, 210, 0.12)" : "unset",
				}}
			>
				<Box sx={{ width: "20%" }}></Box>
				<GridTitle>{selectedRow ? `'${selectedRow.name}' selected` : "Spaces"}</GridTitle>
				<Box sx={{ width: "20%", display: "flex", justifyContent: "flex-end" }}>
          <React.Fragment>
            <Tooltip title="Actions">
              <IconButton
                aria-label="upload picture"
                component="span"
                onClick={handleMenuClick}
                sx={{ mr: 1.5 }}
              >
                <MoreVertIcon />
              </IconButton>
            </Tooltip>
            <Menu
              id="demo-positioned-menu"
              aria-labelledby="demo-positioned-button"
              anchorEl={anchorEl}
              open={menuOpen}
              onClose={handleMenuClose}
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "right",
              }}
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              PaperProps={{
                elevation: 0,
                style: {
                  width: 200,
                },
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
                  },
                },
              }}
            >
              <MenuItem onClick={handleAddSpace}>
                <ListItemIcon>
                  <CloudQueueIcon fontSize="small" />
                </ListItemIcon>
                Add Space
              </MenuItem>
              <MenuItem
                onClick={handleEditSpace}
                disabled={!selectedRow}
              >
                <ListItemIcon>
                  <EditIcon fontSize="small" />
                </ListItemIcon>
                Edit Space
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={handleDeleteSpace}
                disabled={!selectedRow}
              >
                <ListItemIcon>
                  <DeleteOutlineIcon fontSize="small" />
                </ListItemIcon>
                Delete
              </MenuItem>
            </Menu>
          </React.Fragment>
				</Box>
			</GridHeader>
			<GridBody>
				<DataGrid
					disableColumnMenu
					hideFooter
					hideFooterPagination
					hideFooterSelectedRowCount
					density="compact"
					rows={spaces || []}
					columns={columns}
					loading={loading}
          getRowId={(row) => row.name}
					onSelectionModelChange={(newSelectionModel) => onModelChange(newSelectionModel)}
					selectionModel={selectionModel}
					components={{
						LoadingOverlay: CustomLoadingOverlay,
						NoRowsOverlay: CustomNoRowsOverlay,
					}}
					sx={{
						"&.MuiDataGrid-root .MuiDataGrid-columnHeader:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus":
							{
								outline: "none",
							},
						border: "none",
					}}
				/>
			</GridBody>
		</React.Fragment>
	);
}
