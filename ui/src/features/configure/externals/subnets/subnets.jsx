import { Fragment, use, useCallback, useEffect, useMemo, useState } from "react";
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
  DeleteOutlined,
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
  const { refreshing } = use(ExternalContext);

  const [addExtSubOpen, setAddExtSubOpen] = useState(false);
  const [editExtSubOpen, setEditExtSubOpen] = useState(false);
  const [delExtSubOpen, setDelExtSubOpen] = useState(false);
  const [manExtEndOpen, setManExtEndOpen] = useState(false);

  const isAdmin = useSelector(getAdminStatus);

  // Column definitions for AG Grid
  const columns = useMemo(() => [
    { field: "name", headerName: "Name", flex: 0.5 },
    { field: "desc", headerName: "Description", flex: 1 },
    { field: "cidr", headerName: "Address Range", flex: 0.30 },
  ], []);

  // Extra menu items for Add/Edit/Delete/Manage actions
  const extraMenuItems = useMemo(() => [
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
      icon: DeleteOutlined,
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
  const handleRowSelectionChanged = useCallback((row) => {
    setSelectedSubnet(row);
  }, [setSelectedSubnet]);

  // Derive grid data synchronously from selectedExternal to prevent
  // a flash of the no-rows overlay between selection and data display.
  const gridData = useMemo(() => {
    if (!selectedExternal) return [];

    const newSubnets = cloneDeep(selectedExternal['subnets']);

    return newSubnets.reduce((acc, curr) => {
      curr['id'] = `${selectedExternal.name}@${curr.name}}`;
      acc.push(curr);

      return acc;
    }, []);
  }, [selectedExternal]);

  // Sync enriched subnets data to parent state (for dialogs, selection tracking, etc.)
  useEffect(() => {
    setSubnets(gridData);
  }, [gridData, setSubnets]);

  // Clear selection when subnets change
  useEffect(() => {
    if (!subnets || subnets.length === 0) {
      setSelectedSubnet(null);
    }
  }, [subnets, setSelectedSubnet]);

  // No rows overlay component
  const noRowsOverlay = useMemo(() => {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography
          variant="overline"
          sx={{
            display: "block",
            mt: 1
          }}>
          {selectedExternal
            ? "No Subnets Found for Selected External Network"
            : "Please Select an External Network"
          }
        </Typography>
      </Box>
    );
  }, [selectedExternal]);

  return (
    <Fragment>
      {isAdmin &&
        <Fragment>
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
        </Fragment>
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
            noRowsOverlay={noRowsOverlay}
            noBorder={true}
          />
        </Box>
      </Box>
    </Fragment>
  );
}

export default Subnets;
