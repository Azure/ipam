import * as React from "react";
import { useSelector } from "react-redux";

import { cloneDeep } from "lodash";

import { DataGrid } from "../../../../global/grids";

import {
  Box,
  Typography,
} from "@mui/material";

import {
  AddOutlined,
  EditOutlined,
  DeleteOutline,
  EditNoteOutlined
} from "@mui/icons-material";

import {
  getAdminStatus
} from "../../../ipam/ipamSlice";

import AddExtSubnet from "./utils/addSubnet";
import EditExtSubnet from "./utils/editSubnet";
import DeleteExtSubnet from "./utils/deleteSubnet";
import ManageExtEndpoints from "./utils/manageEndpoints";

import { ExternalContext } from "../externalContext";

const Subnets = (props) => {
  const {
    selectedSpace,
    selectedBlock,
    selectedExternal,
    selectedSubnet,
    subnets,
    setSubnets,
    setSelectedSubnet
  } = props;
  const { refreshing } = React.useContext(ExternalContext);

  const [addExtSubOpen, setAddExtSubOpen] = React.useState(false);
  const [editExtSubOpen, setEditExtSubOpen] = React.useState(false);
  const [delExtSubOpen, setDelExtSubOpen] = React.useState(false);
  const [manExtEndOpen, setManExtEndOpen] = React.useState(false);

  const isAdmin = useSelector(getAdminStatus);

  // Column definitions for AG Grid
  const columns = React.useMemo(() => [
    { field: "name", headerName: "Name", flex: 0.5 },
    { field: "desc", headerName: "Description", flex: 1 },
    { field: "cidr", headerName: "Address Range", flex: 0.30 },
  ], []);

  // Extra menu items for Add/Edit/Delete/Manage actions
  const extraMenuItems = React.useMemo(() => [
    {
      icon: AddOutlined,
      label: "Add Subnet",
      onClick: () => setAddExtSubOpen(true),
      disabled: !selectedExternal || !isAdmin,
    },
    {
      icon: EditOutlined,
      label: "Edit Subnet",
      onClick: () => setEditExtSubOpen(true),
      disabled: !selectedSubnet || !isAdmin,
    },
    {
      icon: DeleteOutline,
      label: "Remove Subnet",
      onClick: () => setDelExtSubOpen(true),
      disabled: !selectedSubnet || !isAdmin,
    },
    {
      icon: EditNoteOutlined,
      label: "Manage Endpoints",
      onClick: () => setManExtEndOpen(true),
      disabled: !selectedSubnet,
    },
  ], [selectedExternal, selectedSubnet, isAdmin]);

  // Handle row selection change
  const handleRowSelectionChanged = React.useCallback((row) => {
    setSelectedSubnet(row);
  }, [setSelectedSubnet]);

  // Derive grid data synchronously from selectedExternal to prevent
  // a flash of the no-rows overlay between selection and data display.
  const gridData = React.useMemo(() => {
    if (!selectedExternal) return [];

    const newSubnets = cloneDeep(selectedExternal['subnets']);

    return newSubnets.reduce((acc, curr) => {
      curr['id'] = `${selectedExternal.name}@${curr.name}}`;
      acc.push(curr);

      return acc;
    }, []);
  }, [selectedExternal]);

  // Sync enriched subnets data to parent state (for dialogs, selection tracking, etc.)
  React.useEffect(() => {
    setSubnets(gridData);
  }, [gridData, setSubnets]);

  // Clear selection when subnets change
  React.useEffect(() => {
    if (!subnets || subnets.length === 0) {
      setSelectedSubnet(null);
    }
  }, [subnets, setSelectedSubnet]);

  // No rows overlay component
  const NoRowsOverlay = React.useCallback(() => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="overline" display="block" sx={{ mt: 1 }}>
          {selectedExternal
            ? "No Subnets Found for Selected External Network"
            : "Please Select an External Network"
          }
        </Typography>
      </Box>
    );
  }, [selectedExternal]);

  return (
    <React.Fragment>
      {isAdmin &&
        <React.Fragment>
          <AddExtSubnet
            open={addExtSubOpen}
            handleClose={() => setAddExtSubOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            external={selectedExternal ? selectedExternal : null}
            subnets={subnets}
          />
          <EditExtSubnet
            open={editExtSubOpen}
            handleClose={() => setEditExtSubOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            external={selectedExternal ? selectedExternal : null}
            subnets={subnets}
            selectedSubnet={selectedSubnet}
          />
          <DeleteExtSubnet
            open={delExtSubOpen}
            handleClose={() => setDelExtSubOpen(false)}
            space={selectedSpace ? selectedSpace.name : null}
            block={selectedBlock ? selectedBlock.name : null}
            external={selectedExternal ? selectedExternal.name : null}
            subnet={selectedSubnet ? selectedSubnet.name : null}
          />
        </React.Fragment>
      }
      <ManageExtEndpoints
        open={manExtEndOpen}
        handleClose={() => setManExtEndOpen(false)}
        space={selectedSpace ? selectedSpace.name : null}
        block={selectedBlock ? selectedBlock.name : null}
        external={selectedExternal ? selectedExternal.name : null}
        subnet={selectedSubnet ? selectedSubnet : null}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
        <Box sx={{ display: 'flex', height: '35px', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(224, 224, 224, 1)', borderBottom: 'none' }}>
          <Typography variant='button'>
            External Subnets
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', height: '100%', border: '1px solid rgba(224, 224, 224, 1)' }}>
          <DataGrid
            viewSettingKey="extsubnets"
            idProperty="id"
            rowData={gridData}
            columnDefs={columns}
            isLoading={selectedExternal && refreshing}
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

export default Subnets;
