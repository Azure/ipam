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
	DeleteOutline as DeleteOutlineIcon,
	MoreVert as MoreVertIcon,
  GridView as GridViewIcon,
	PieChartOutline as PieChartOutlineIcon,
	SettingsEthernet as SettingsEthernetIcon,
} from "@mui/icons-material";

import AddBlock from "./Utils/addBlock";
import EditVnets from "./Utils/editVnets";
import EditReservations from "./Utils/editReservations";
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
	{ field: "name", headerName: "Name", headerAlign: "left", align: "left", flex: 1 },
	{ field: "space", headerName: "Parent Space", headerAlign: "left", align: "left", flex: 1 },
	{ field: "cidr", headerName: "CIDR", headerAlign: "right", align: "right", flex: 0.75 },
];

export default function BlockDataGrid(props) {
  const { selected } = props;
  const { refresh, refreshing } = React.useContext(ConfigureContext);

	const [blocks, setBlocks] = React.useState([]);
  const [previous, setPrevious] = React.useState(null);
	const [selectionModel, setSelectionModel] = React.useState([]);
  const [addBlockOpen, setAddBlockOpen] = React.useState(false);
	const [editVNetsOpen, setEditVNetsOpen] = React.useState(false);
	const [editResvOpen, setEditResvOpen] = React.useState(false);
	const [deleteBlockOpen, setDeleteBlockOpen] = React.useState(false);
	const [anchorEl, setAnchorEl] = React.useState(null);

	const selectedRow = selectionModel.length
		? blocks.find((obj) => {
				return obj.name === selectionModel[0];
		  })
		: null;

	const menuOpen = Boolean(anchorEl);

  React.useEffect(() => {
    if(selected) {
      if(selected.name != previous) {
        setSelectionModel([]);
      }

      setBlocks(selected.blocks)
      setPrevious(selected.name);
    } else {
      setBlocks([]);
      setPrevious(null);
    }
	}, [selected]);

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
        { selected
          ? <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              No Blocks Found in Selected Space
            </Typography>
          : <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              Please Select a Space
            </Typography>
        }
			</StyledGridOverlay>
		);
	}

	const handleMenuClick = (event) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
	};

  const handleAddBlock = () => {
		handleMenuClose();
		setAddBlockOpen(true);
	};

	const handleEditVNets = () => {
		handleMenuClose();
		setEditVNetsOpen(true);
	};

	const handleEditResv = () => {
		handleMenuClose();
		setEditResvOpen(true);
	};

	const handleDeleteBlock = () => {
		handleMenuClose();
		setDeleteBlockOpen(true);
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
      <AddBlock
        open={addBlockOpen}
        handleClose={() => setAddBlockOpen(false)}
        space={selected ? selected.name : null}
        blocks={selected ? selected.blocks : null}
        refresh={() => refresh()}
      />
			<EditVnets
        open={editVNetsOpen}
        handleClose={() => setEditVNetsOpen(false)}
        space={selected ? selected.name : null}
        block={selectedRow ? selectedRow : null}
        refresh={() => refresh()}
        refreshingState={refreshing}
      />
			<EditReservations
        open={editResvOpen}
        handleClose={() => setEditResvOpen(false)}
        space={selected ? selected.name : null}
        block={selectedRow ? selectedRow.name : null}
      />
			<ConfirmDelete
        open={deleteBlockOpen}
        handleClose={() => setDeleteBlockOpen(false)}
        space={selected ? selected.name : null}
        block={selectedRow ? selectedRow.name : null}
        refresh={() => refresh()}
      />
			<GridHeader
				style={{
					borderBottom: "1px solid rgba(224, 224, 224, 1)",
					backgroundColor: selectedRow ? "rgba(25, 118, 210, 0.12)" : "unset",
				}}
			>
				<Box sx={{ width: "20%" }}></Box>
				<GridTitle>{selectedRow ? `'${selectedRow.name}' selected` : "Blocks"}</GridTitle>
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
              <MenuItem
                onClick={handleAddBlock}
                disabled={!selected}
              >
                <ListItemIcon>
                  <GridViewIcon fontSize="small" />
                </ListItemIcon>
                Add Block
              </MenuItem>
              <MenuItem
                onClick={handleEditVNets}
                disabled={!selectedRow}
              >
                <ListItemIcon>
                  <SettingsEthernetIcon fontSize="small" />
                </ListItemIcon>
                Virtual Networks
              </MenuItem>
              <MenuItem
                onClick={handleEditResv}
                disabled={!selectedRow}
              >
                <ListItemIcon>
                  <PieChartOutlineIcon fontSize="small" />
                </ListItemIcon>
                Reservations
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={handleDeleteBlock}
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
          getRowId={(row) => row.name}
					rows={blocks}
					columns={columns}
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
