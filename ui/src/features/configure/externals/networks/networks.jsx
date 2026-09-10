import * as React from "react";
import { useSelector } from "react-redux";

import { cloneDeep } from "lodash-es";

import { DataGrid } from "../../../../global/grids";

import {
  Box,
  Typography,
} from "@mui/material";

import {
  AddOutlined,
  EditOutlined,
  DeleteOutlined
} from "@mui/icons-material";

import {
  getAdminStatus
} from "../../../ipam/ipamSlice";

import AddExtNetwork from "./utils/addNetwork";
import EditExtNetwork from "./utils/editNetwork";
import DeleteExtNetwork from "./utils/deleteNetwork";

import { ExternalContext } from "../externalContext";

const Networks = (props) => {
  const {
    selectedSpace,
    selectedBlock,
    selectedExternal,
    externals,
    setExternals,
    setSelectedExternal
  } = props;
  const { refreshing } = React.use(ExternalContext);

  const [addExtOpen, setAddExtOpen] = React.useState(false);
  const [editExtOpen, setEditExtOpen] = React.useState(false);
  const [delExtOpen, setDelExtOpen] = React.useState(false);

  const isAdmin = useSelector(getAdminStatus);

  // Column definitions for AG Grid
  const columns = React.useMemo(() => [
    { field: "name", headerName: "Name", flex: 0.5 },
    { field: "desc", headerName: "Description", flex: 1 },
    { field: "cidr", headerName: "CIDR", flex: 0.30 },
  ], []);

  // Extra menu items for Add/Edit/Delete actions
  const extraMenuItems = React.useMemo(() => [
    {
      icon: AddOutlined,
      label: "Add Network",
      onClick: () => setAddExtOpen(true),
      disabled: !selectedSpace || !selectedBlock || !isAdmin,
    },
    {
      icon: EditOutlined,
      label: "Edit Network",
      onClick: () => setEditExtOpen(true),
      disabled: !selectedExternal || !isAdmin,
    },
    {
      icon: DeleteOutlined,
      label: "Delete Network",
      onClick: () => setDelExtOpen(true),
      disabled: !selectedExternal || !isAdmin,
    },
  ], [selectedSpace, selectedBlock, selectedExternal, isAdmin]);

  // Handle row selection change
  const handleRowSelectionChanged = React.useCallback((row) => {
    setSelectedExternal(row);
  }, [setSelectedExternal]);

  // Derive grid data synchronously from selectedBlock to prevent
  // a flash of the no-rows overlay between selection and data display.
  const gridData = React.useMemo(() => {
    if (!selectedBlock) return [];

    const newExternals = cloneDeep(selectedBlock['externals']);

    return newExternals.reduce((acc, curr) => {
      curr['id'] = `${selectedSpace}@${selectedBlock.name}@${curr.name}}`;
      acc.push(curr);

      return acc;
    }, []);
  }, [selectedSpace, selectedBlock]);

  // Sync enriched externals data to parent state (for dialogs, selection tracking, etc.)
  React.useEffect(() => {
    setExternals(gridData);
  }, [gridData, setExternals]);

  // Clear selection when externals change
  React.useEffect(() => {
    if (!externals || externals.length === 0) {
      setSelectedExternal(null);
    }
  }, [externals, setSelectedExternal]);

  // No rows overlay component
  const NoRowsOverlay = React.useCallback(() => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography
          variant="overline"
          sx={{
            display: "block",
            mt: 1
          }}>
          {selectedBlock
            ? "No External Networks Found for Selected Block"
            : "Please Select a Space & Block"
          }
        </Typography>
      </Box>
    );
  }, [selectedBlock]);

  return (
    <React.Fragment>
      {isAdmin &&
        <React.Fragment>
          <AddExtNetwork
            open={addExtOpen}
            handleClose={() => setAddExtOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock : null}
            externals={externals}
          />
          <EditExtNetwork
            open={editExtOpen}
            handleClose={() => setEditExtOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock : null}
            externals={externals}
            selectedExternal={selectedExternal}
          />
          <DeleteExtNetwork
            open={delExtOpen}
            handleClose={() => setDelExtOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            external={selectedExternal ? selectedExternal.name : null}
          />
        </React.Fragment>
      }
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <Box sx={{ display: 'flex', height: '35px', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(224, 224, 224, 1)', borderBottom: 'none' }}>
          <Typography variant='button'>
            External Networks
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', height: '100%', border: '1px solid rgba(224, 224, 224, 1)' }}>
          <DataGrid
            viewSettingKey="extnetworks"
            idProperty="id"
            rowData={gridData}
            columnDefs={columns}
            isLoading={refreshing}
            onRowSelectionChanged={handleRowSelectionChanged}
            extraMenuItems={extraMenuItems}
            noRowsOverlay={NoRowsOverlay}
            noBorder={true}
          />
        </Box>
      </Box>
    </React.Fragment>
  );
}

export default Networks;
