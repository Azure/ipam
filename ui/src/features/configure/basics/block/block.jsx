import * as React from "react";
import { useSelector } from "react-redux";
import { styled } from "@mui/material/styles";

import { useNavigate } from "react-router";

import { isEmpty} from "lodash";

import { ConfigureGrid } from "../../../../global/grids";

import {
  Box,
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  Divider,
  Typography
} from "@mui/material";

import {
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon,
  MoreVert as MoreVertIcon,
  GridView as GridViewIcon,
  PieChartOutline as PieChartOutlineIcon,
  SettingsEthernet as SettingsEthernetIcon,
  MapOutlined as MapOutlinedIcon
} from "@mui/icons-material";

import AddBlock from "./utils/addBlock";
import EditBlock from "./utils/editBlock";
import ConfirmDelete from "./utils/confirmDelete";

import { BasicContext } from "../basicContext";

import { getAdminStatus } from "../../../ipam/ipamSlice";

const GridHeader = styled("div")({
  height: "35px",
  width: "100%",
  display: "flex",
  borderBottom: "1px solid rgba(224, 224, 224, 1)",
});

const GridTitle = styled("div")(({ theme }) => ({
  ...theme.typography.button,
  width: "80%",
  textAlign: "center",
  alignSelf: "center",
}));

const GridBody = styled("div")({
  height: "100%",
  width: "100%",
});

const columns = [
  { name: "name", header: "Name", defaultFlex: 1 },
  { name: "parent_space", header: "Parent Space", defaultFlex: 1 },
  { name: "cidr", header: "CIDR", defaultFlex: 0.75 },
];

export default function BlockDataGrid(props) {
  const { selectedSpace, selectedBlock, setSelectedBlock } = props;
  const { blocks, refreshing, refresh } = React.useContext(BasicContext);

  const [previousSpace, setPreviousSpace] = React.useState(null);

  const [addBlockOpen, setAddBlockOpen] = React.useState(false);
  const [editBlockOpen, setEditBlockOpen] = React.useState(false);

  const [deleteBlockOpen, setDeleteBlockOpen] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  const isAdmin = useSelector(getAdminStatus);

  const navigate = useNavigate();

  const menuOpen = Boolean(anchorEl);

  // Clear selection when space changes
  const onSpaceChange = React.useCallback(() => {
    if(selectedSpace) {
      if(selectedSpace.name !== previousSpace) {
        setSelectedBlock(null);
      }
    }

    setPreviousSpace(selectedSpace ? selectedSpace.name : null);
  }, [selectedSpace, previousSpace, setSelectedBlock]);

  React.useEffect(() => {
    onSpaceChange()
  }, [selectedSpace, onSpaceChange]);

  // Sync selection when blocks data changes
  React.useEffect(() => {
    if(blocks && selectedBlock && selectedSpace) {
      const currentBlock = blocks.find(block => (block.name === selectedBlock.name) && (block.parent_space === selectedSpace.name));

      if(!currentBlock) {
        setSelectedBlock(null);
      } else {
        setSelectedBlock(currentBlock);
      }
    }
  }, [blocks, selectedSpace, selectedBlock, setSelectedBlock]);

  // Handle row click from ConfigureGrid
  const handleRowClick = React.useCallback((data) => {
    // Toggle selection: if clicking the same row, deselect; otherwise select new row
    if (selectedBlock && selectedBlock.name === data.name) {
      setSelectedBlock(null);
    } else {
      setSelectedBlock(data);
    }
  }, [selectedBlock, setSelectedBlock]);

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

  const handleEditBlock = () => {
    handleMenuClose();
    setEditBlockOpen(true);
  };

  const handleDeleteBlock = () => {
    handleMenuClose();
    setDeleteBlockOpen(true);
  };

  // Custom no rows overlay component
  const NoRowsOverlay = React.useCallback(() => {
    return (
      <React.Fragment>
        { selectedSpace
          ? <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              No Blocks Found in Selected Space
            </Typography>
          : <Typography variant="overline" display="block" sx={{ mt: 1 }}>
              Please Select a Space
            </Typography>
        }
      </React.Fragment>
    );
  }, [selectedSpace]);

  // Compute row data for the grid
  const rowData = React.useMemo(() => {
    return (selectedSpace && blocks) ? blocks.filter((block) => block.parent_space === selectedSpace.name) : [];
  }, [selectedSpace, blocks]);

  return (
    <React.Fragment>
      { isAdmin &&
        <React.Fragment>
          <EditBlock
            open={editBlockOpen}
            handleClose={() => setEditBlockOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            blocks={selectedSpace ? selectedSpace.blocks : null}
            block={selectedBlock ? selectedBlock : null}
            refresh={refresh}
          />
          <AddBlock
            open={addBlockOpen}
            handleClose={() => setAddBlockOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            blocks={selectedSpace ? selectedSpace.blocks : null}
            refresh={refresh}
          />
          <ConfirmDelete
            open={deleteBlockOpen}
            handleClose={() => setDeleteBlockOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            refresh={refresh}
          />
        </React.Fragment>
      }
      <GridHeader
        style={{
          borderBottom: "1px solid rgba(224, 224, 224, 1)",
          backgroundColor: selectedBlock ? "rgba(25, 118, 210, 0.12)" : "unset",
        }}
      >
        <Box sx={{ width: "20%" }}></Box>
        <GridTitle>{selectedBlock ? `'${selectedBlock.name}' selected` : "Blocks"}</GridTitle>
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
                disabled={!selectedSpace || !isAdmin}
              >
                <ListItemIcon>
                  <GridViewIcon fontSize="small" />
                </ListItemIcon>
                Add Block
              </MenuItem>
              <MenuItem
                onClick={handleEditBlock}
                disabled={!selectedBlock || !isAdmin}
              >
                <ListItemIcon>
                  <EditIcon fontSize="small" />
                </ListItemIcon>
                Edit Block
              </MenuItem>
              <MenuItem
                onClick={() =>navigate('/configure/associations', {state: { space: selectedSpace, block: selectedBlock }})}
                disabled={!selectedBlock}
              >
                <ListItemIcon>
                  <SettingsEthernetIcon fontSize="small" />
                </ListItemIcon>
                Block Networks
              </MenuItem>
              <MenuItem
                onClick={() =>navigate('/configure/reservations', {state: { space: selectedSpace, block: selectedBlock }})}
                disabled={!selectedBlock}
              >
                <ListItemIcon>
                  <PieChartOutlineIcon fontSize="small" />
                </ListItemIcon>
                Reservations
              </MenuItem>
              <MenuItem
                onClick={() =>navigate('/configure/externals', {state: { space: selectedSpace, block: selectedBlock }})}
                disabled={!selectedBlock}
              >
                <ListItemIcon>
                  <MapOutlinedIcon fontSize="small" />
                </ListItemIcon>
                External Networks
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={handleDeleteBlock}
                disabled={!selectedBlock || !isAdmin}
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
        <ConfigureGrid
          rowData={rowData}
          columnDefs={columns}
          onRowClick={handleRowClick}
          selectedRow={selectedBlock}
          idProperty="name"
          noRowsOverlay={NoRowsOverlay}
        />
      </GridBody>
    </React.Fragment>
  );
}
