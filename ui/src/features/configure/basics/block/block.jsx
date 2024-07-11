import * as React from "react";
import { useSelector } from "react-redux";
import { styled } from "@mui/material/styles";

import { useNavigate } from "react-router-dom";

import { isEmpty} from "lodash";

import ReactDataGrid from "@inovua/reactdatagrid-community";
import "@inovua/reactdatagrid-community/index.css";
import "@inovua/reactdatagrid-community/theme/default-dark.css";

import { useTheme } from "@mui/material/styles";

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

const gridStyle = {
  height: '100%',
  border: 'none',
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

const columns = [
  { name: "name", header: "Name", defaultFlex: 1 },
  { name: "parent_space", header: "Parent Space", defaultFlex: 1 },
  { name: "cidr", header: "CIDR", defaultFlex: 0.75 },
];

export default function BlockDataGrid(props) {
  const { selectedSpace, selectedBlock, setSelectedBlock } = props;
  const { blocks, refreshing, refresh } = React.useContext(BasicContext);

  const [previousSpace, setPreviousSpace] = React.useState(null);
  const [selectionModel, setSelectionModel] = React.useState({});

  const [addBlockOpen, setAddBlockOpen] = React.useState(false);
  const [editBlockOpen, setEditBlockOpen] = React.useState(false);

  const [deleteBlockOpen, setDeleteBlockOpen] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  const isAdmin = useSelector(getAdminStatus);

  const navigate = useNavigate();

  const theme = useTheme();

  const menuOpen = Boolean(anchorEl);

  const onSpaceChange = React.useCallback(() => {
    if(selectedSpace) {
      if(selectedSpace.name !== previousSpace) {
        setSelectionModel({});
      }
    }

    setPreviousSpace(selectedSpace ? selectedSpace.name : null);
  }, [selectedSpace, previousSpace]);

  React.useEffect(() => {
    onSpaceChange()
  }, [selectedSpace, onSpaceChange]);

  React.useEffect(() => {
    if(!isEmpty(selectionModel)) {
      setSelectedBlock(Object.values(selectionModel)[0])
    } else {
      setSelectedBlock(null);
    }
  }, [selectionModel, setSelectedBlock]);

  React.useEffect(() => {
    if(blocks && selectedBlock && selectedSpace) {
      const currentBlock = blocks.find(block => (block.name === selectedBlock.name) && (block.parent_space === selectedSpace.name));
      
      if(!currentBlock) {
        setSelectionModel({});
      } else {
        setSelectedBlock(currentBlock);
      }
    }
  }, [blocks, selectedSpace, selectedBlock, setSelectedBlock, setSelectionModel]);

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

  function onClick(data) {
    var id = data.name;
    var newSelectionModel = {};

    setSelectionModel(prevState => {
      if(!prevState.hasOwnProperty(id)) {
        newSelectionModel[id] = data;
      }

      return newSelectionModel;
    });
  }

  function NoRowsOverlay() {
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
  }

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
        <ReactDataGrid
          theme={theme.palette.mode === 'dark' ? "default-dark" : "default-light"}
          idProperty="name"
          showCellBorders="horizontal"
          showZebraRows={false}
          multiSelect={true}
          showActiveRowIndicator={false}
          enableColumnAutosize={false}
          showColumnMenuGroupOptions={false}
          showColumnMenuLockOptions={false}
          columns={columns}
          dataSource={selectedSpace ? blocks.filter((block) => block.parent_space === selectedSpace.name) : []}
          onRowClick={(rowData) => onClick(rowData.data)}
          selected={selectionModel}
          emptyText={NoRowsOverlay}
          style={gridStyle}
        />
      </GridBody>
    </React.Fragment>
  );
}
