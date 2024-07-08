import * as React from "react";
import { useSelector } from "react-redux";
import { styled } from "@mui/material/styles";

import { isEmpty } from "lodash";

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
  Typography,
  SvgIcon
} from "@mui/material";

import {
  Edit as EditIcon,
  DeleteOutline as DeleteOutlineIcon,
  MoreVert as MoreVertIcon
} from "@mui/icons-material";

import Space from "../../../../img/Space";

import AddSpace from "./utils/addSpace";
import EditSpace from "./utils/editSpace";
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
  { name: "name", header: "Name", defaultFlex: 0.5 },
  { name: "desc", header: "Description", defaultFlex: 1 },
];

export default function SpaceDataGrid(props) {
  const { selectedSpace, setSelectedSpace, setSelectedBlock } = props;
  const { spaces, refresh } = React.useContext(BasicContext);

  const [selectionModel, setSelectionModel] = React.useState({});

  const [addSpaceOpen, setAddSpaceOpen] = React.useState(false);
  const [editSpaceOpen, setEditSpaceOpen] = React.useState(false);
  const [deleteSpaceOpen, setDeleteSpaceOpen] = React.useState(false);

  const [anchorEl, setAnchorEl] = React.useState(null);

  const isAdmin = useSelector(getAdminStatus);

  const theme = useTheme();

  const menuOpen = Boolean(anchorEl);

  React.useEffect(() => {
    setSelectedBlock(null);
    setSelectedSpace(!isEmpty(selectionModel) ? Object.values(selectionModel)[0] : null);
  }, [selectionModel, setSelectedSpace, setSelectedBlock]);

  React.useEffect(() => {
    if(spaces && selectedSpace) {
      const currentSpace = spaces.find(space => space.name === selectedSpace.name);
      
      if(!currentSpace) {
        setSelectedBlock(null)
        setSelectionModel({});
      } else {
        setSelectedSpace(currentSpace);
      }
    }
  }, [spaces, selectedSpace, setSelectedSpace, setSelectedBlock, setSelectionModel]);

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

  function onClick(data) {
    var id = data.name;
    var newSelectionModel = {};

    setSelectionModel(prevState => {
      if(!prevState.hasOwnProperty(id)) {
        newSelectionModel[id] = data;
      } else {
        setSelectedBlock(null);
      }
      
      return newSelectionModel;
    });
  }

  function NoRowsOverlay() {
    return (
      <React.Fragment>
        <Typography variant="overline" display="block" sx={{ mt: 1 }}>
          No Spaces Found, Create a Space to Begin
        </Typography>
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      { isAdmin &&
        <React.Fragment>
          <EditSpace
            open={editSpaceOpen}
            handleClose={() => setEditSpaceOpen(false)}
            space={selectedSpace ? selectedSpace : null}
            spaces={spaces}
            refresh={refresh}
          />
          <AddSpace
            open={addSpaceOpen}
            handleClose={() => setAddSpaceOpen(false)}
            spaces={spaces}
            refresh={refresh}
          />
          <ConfirmDelete
            open={deleteSpaceOpen}
            handleClose={() => setDeleteSpaceOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            refresh={refresh}
          />
        </React.Fragment>
      }
      <GridHeader
        style={{
          borderBottom: "1px solid rgba(224, 224, 224, 1)",
          backgroundColor: selectedSpace ? "rgba(25, 118, 210, 0.12)" : "unset",
        }}
      >
        <Box sx={{ width: "20%" }}></Box>
        <GridTitle>{selectedSpace ? `'${selectedSpace.name}' selected` : "Spaces"}</GridTitle>
        <Box sx={{ width: "20%", display: "flex", justifyContent: "flex-end" }}>
          <React.Fragment>
            <Tooltip title="Actions">
              <IconButton
                aria-label="spaces menu"
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
                onClick={handleAddSpace}
                disabled={!isAdmin || !spaces}
              >
                <ListItemIcon>
                  {/* <CloudQueueIcon fontSize="small" /> */}
                  <SvgIcon fontSize="small">
                    <Space />
                  </SvgIcon>
                </ListItemIcon>
                Add Space
              </MenuItem>
              <MenuItem
                onClick={handleEditSpace}
                disabled={!selectedSpace || !isAdmin}
              >
                <ListItemIcon>
                  <EditIcon fontSize="small" />
                </ListItemIcon>
                Edit Space
              </MenuItem>
              <Divider />
              <MenuItem
                onClick={handleDeleteSpace}
                disabled={!selectedSpace || !isAdmin}
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
          loading={spaces ? false : true}
          dataSource={spaces || []}
          onRowClick={(rowData) => onClick(rowData.data)}
          selected={selectionModel}
          emptyText={NoRowsOverlay}
          style={gridStyle}
        />
      </GridBody>
    </React.Fragment>
  );
}
