import * as React from "react";
import { useSelector } from 'react-redux';
import { useLocation } from "react-router-dom";
import { styled } from "@mui/material/styles";

import {
  DataGrid,
  GridOverlay,
  GridToolbarContainer,
  GridToolbarColumnsButton,
  GridToolbarFilterButton
} from "@mui/x-data-grid";

import {
  Box,
  Typography,
  LinearProgress,
  Tooltip,
  IconButton,
  ClickAwayListener
} from "@mui/material";

import {
  FilterList,
  ChevronRight,
} from "@mui/icons-material";

import Shrug from "../../img/pam/Shrug";

import { TableContext } from "./TableContext";
import FilterMenu from "./FilterMenu";
import ItemDetails from "./Utils/Details";

const openStyle = {
  right: 0,
  transition: "all 0.5s ease-in-out",
};

const closedStyle = {
  right: -300,
  transition: "all 0.5s ease-in-out",
};

const StyledGridOverlay = styled('div')({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100%',
});

export default function DiscoverTable(props) {
  const { config, columns, filterSettings, detailsMap } = props.map;

  const [loading, setLoading] = React.useState(true);
  const [filterMenuState, setFilterMenuState] = React.useState({});
  const [dataFilters, setDataFilters] = React.useState([]);
  const [selectionModel, setSelectionModel] = React.useState([]);
  const [rowData, setRowData] = React.useState({});
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [menuExpand, setMenuExpand] = React.useState(false);
  const [sortModel, setSortModel] = React.useState([{field: 'name', sort: 'asc'}]);

  const stateData = useSelector(config.apiFunc);
  const filteredData = filterArray(stateData, dataFilters);
  const selectedRow = selectionModel.length ? filteredData.find((obj) => { return config.idFunc(obj) === selectionModel[0] }) : null;

  const anchorEl = React.useRef();

  if (!columns.find( x => x['field'] === 'id' )) {
    columns.push(
      { field: "id", headerName: "", headerAlign: "right", align: "right", width: 25, filterable: false, sortable: false, renderCell: renderExpand }
    );
  } else {
    columns.pop();
    columns.push(
      { field: "id", headerName: "", headerAlign: "right", align: "right", width: 25, filterable: false, sortable: false, renderCell: renderExpand }
    );
  }

  function renderExpand(params) {  
    const onClick = (e) => {
      e.stopPropagation();
      console.log("CLICK!");
      // setSelectionModel([params.value]);
      setRowData(params.row);
      setMenuExpand(true);
    };
  
    const flexCenter = {
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }

    return (
      <Tooltip title="Details">
        <span style={{...flexCenter}}>
          <IconButton
            color="primary"
            sx={{
              padding: 0
            }}
            onClick={onClick}
            disableFocusRipple
            disableTouchRipple
            disableRipple
          >
            <ChevronRight />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  React.useEffect(() => {
    stateData && setLoading(false);
  },[stateData, dataFilters]);

  function filterArray(array, filters) {
    if(array) {
      return array.filter(item => {
        return Object.entries(filters)
                    .map(([key, val]) => val.func(item, val.vals, key))
                    .reduce((sum, next) => sum && next, true);
      });
    } else {
      return [];
    }
  }

  const handleMenuClose = (state, filters) => {
    var newFilterMenuState = {
      ...filterMenuState,
      ...state
    };

    var filterMenuStateChanged = (JSON.stringify(filterMenuState) == JSON.stringify(newFilterMenuState));

    !filterMenuStateChanged && setFilterMenuState(newFilterMenuState);

    var newDataFilters = {
      ...dataFilters,
      ...filters,
    }

    var filtersChanged = (JSON.stringify(dataFilters) == JSON.stringify(newDataFilters));

    !filtersChanged && setDataFilters(newDataFilters);

    setMenuOpen(false);
  };

  function CustomLoadingOverlay() {
    return (
      <GridOverlay>
        <div style={{ position: 'absolute', top: 0, width: '100%' }}>
          <LinearProgress />
        </div>
      </GridOverlay>
    );
  }

  function CustomNoRowsOverlay() {
    return (
      <StyledGridOverlay>
        <Shrug />
        <Typography variant="overline" display="block"  sx={{ mt: 1 }}>
          Nothing yet...
        </Typography>
      </StyledGridOverlay>
    );
  }

  function renderDetails() {
    return (
      <ClickAwayListener onClickAway={() => setMenuExpand(false)}>
        <Box
          style={{
            zIndex: 1000,
            position: "fixed",
            display: "flex",
            flexDirection: "row",
            top: 64,
            right: -300,
            height: "calc(100vh - 64px)",
            backgroundColor: "transparent",
            ...menuExpand ? openStyle : closedStyle
          }}
        >
          <Box
            sx={{
              height: "100%",
              width: "300px",
              backgroundColor: "white",
              borderLeft: "1px solid lightgrey"
            }}
          >
            <ItemDetails title={config.title} map={detailsMap} setExpand={setMenuExpand}/>
          </Box>
        </Box>
      </ClickAwayListener>
    );
  }

  function CustomToolbar() {
    return (
      <GridToolbarContainer>
        <Box
          height="65px"
          width="100%"
          display="flex"
          flexDirection="row"
          justifyContent="center"
          style={{ borderBottom: "1px solid rgba(224, 224, 224, 1)", backgroundColor: selectedRow ? "rgba(25, 118, 210, 0.12)" : "unset" }}
        >
          <Box width="400px" display="flex" justifyContent="flex-start" alignItems="center">
            <GridToolbarColumnsButton
              sx={{ ml: 2 }}
            />
            <GridToolbarFilterButton
              sx={{ ml: 2 }}
            />
          </Box>
          <Box width="100%" alignSelf="center" textAlign="center">
            <Typography sx={{ flex: "1 1 100%" }} variant="h6" component="div">
              {selectedRow ? `'${selectedRow.name}' selected` : `${config.title}s`}
            </Typography>
          </Box>
          <Box width="400px" display="flex" justifyContent="flex-end" alignItems="center">
            {/* <Tooltip title="Filter">
              <IconButton
                ref={anchorEl}
                color="primary"
                aria-label="upload picture"
                component="span"
                disabled={loading}
                sx={{ mr: 2 }}
                onClick={() => setMenuOpen((menuOpen) => !menuOpen)}
              >
                <FilterList />
              </IconButton>
            </Tooltip>
            <FilterMenu
              open={menuOpen}
              data={stateData || []}
              anchorEl={anchorEl.current}
              filterSettings={filterSettings}
              handleClose={handleMenuClose}
              state={filterMenuState}
            /> */}
          </Box>
        </Box>
      </GridToolbarContainer>
    );
  }

  return (
    <TableContext.Provider value={{ stateData, rowData, menuExpand }}>
      {renderDetails()}
      <Box sx={{ flexGrow: 1, height: "100%" }}>
        <DataGrid
          disableSelectionOnClick
          disableColumnMenu
          // hideFooter
          // hideFooterPagination
          pagination
          autoPageSize
          hideFooterSelectedRowCount
          density="compact"
          rows={filteredData}
          columns={columns}
          loading={loading}
          getRowId={config.idFunc || null}
          sortModel={sortModel}
          onSortModelChange={(model) => setSortModel(model)}
          components={{
            Toolbar: CustomToolbar,
            LoadingOverlay: CustomLoadingOverlay,
            NoRowsOverlay: CustomNoRowsOverlay,
          }}
          componentsProps={{
            columnsPanel: {
              sx: {
                "& .MuiDataGrid-panelContent .MuiDataGrid-columnsPanel div:last-child": {
                  display: "none"
                },
                "& .MuiDataGrid-panelFooter button:first-child": {
                    display: "none"
                }
              }
            }
          }}
          sx={{
            "&.MuiDataGrid-root .MuiDataGrid-columnHeader:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus, &.MuiDataGrid-root .MuiDataGrid-cell:focus-within":
              {
                outline: "none",
              },
            // "&.MuiDataGrid-root .MuiDataGrid-footerContainer":
            //   {
            //     minHeight: "59.5px",
            //   }
          }}
        />
      </Box>
    </TableContext.Provider>
  );
}
