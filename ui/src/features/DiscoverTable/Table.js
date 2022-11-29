import * as React from "react";
import { useSelector } from 'react-redux';
import { useLocation } from "react-router-dom";

import { cloneDeep } from 'lodash';

import ReactDataGrid from '@inovua/reactdatagrid-community';
import filter from '@inovua/reactdatagrid-community/filter'
import '@inovua/reactdatagrid-community/index.css';

import {
  Box,
  Tooltip,
  IconButton,
  ClickAwayListener,
  Typography
} from "@mui/material";

import {
  ChevronRight,
} from "@mui/icons-material";

import Shrug from "../../img/pam/Shrug";

import { TableContext } from "./TableContext";
import ItemDetails from "./Utils/Details";

const openStyle = {
  right: 0,
  transition: "all 0.5s ease-in-out",
};

const closedStyle = {
  right: -300,
  transition: "all 0.5s ease-in-out",
};

const gridStyle = {
  height: '100%',
  border: "1px solid rgba(224, 224, 224, 1)",
  fontFamily: 'Roboto, Helvetica, Arial, sans-serif'
};

export default function DiscoverTable(props) {
  const { config, columns, filterSettings, detailsMap } = props.map;

  const [loading, setLoading] = React.useState(true);
  const [columnData, setColumnData] = React.useState([]);
  const [gridData, setGridData] = React.useState(null);
  const [rowData, setRowData] = React.useState({});
  const [filterData, setFilterData] = React.useState(filterSettings);
  const [menuExpand, setMenuExpand] = React.useState(false);

  const stateData = useSelector(config.apiFunc);

  const location = useLocation();

  function renderExpand(data) {  
    const onClick = (e) => {
      e.stopPropagation();
      setRowData(data);
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
    let newColumns = [...columns];

    if (!newColumns.find( x => x['field'] === 'id' )) {
      newColumns.push(
        { name: "id", header: "Details", width: 50, resizable: false, hideable: false, showColumnMenuTool: false, renderHeader: () => "", render: ({data}) => renderExpand(data) }
      );
    }

    setColumnData(newColumns);
  },[]);

  React.useEffect(() => {
    if(location.state) {
      var searchFilter = cloneDeep(filterSettings);

      const target = searchFilter.find((obj) => obj.name === location.state.name);

      Object.assign(target, location.state);

      setFilterData(searchFilter);
    }
  },[location]);

  React.useEffect(() => {
    stateData && setGridData(filter(stateData, filterData));
  },[stateData, filterData]);

  React.useEffect(() => {
    gridData && setLoading(false);
  },[gridData]);

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

  function NoRowsOverlay() {
    return (
      <React.Fragment>
        <Shrug />
        <Typography variant="overline" display="block"  sx={{ mt: 1 }}>
          Nothing yet...
        </Typography>
      </React.Fragment>
    );
  }

  return (
    <TableContext.Provider value={{ stateData, rowData, menuExpand }}>
      {renderDetails()}
      <Box sx={{ flexGrow: 1, height: "100%" }}>
        <ReactDataGrid
          idProperty={config.idProp}
          showCellBorders="horizontal"
          showZebraRows={false}
          showActiveRowIndicator={false}
          enableColumnAutosize={false}
          showColumnMenuGroupOptions={false}
          enableColumnFilterContextMenu={true}
          columns={columnData}
          loading={loading}
          dataSource={gridData || []}
          filterValue={filterData}
          onFilterValueChange={(newFilterValue) => setFilterData(newFilterValue)}
          defaultSortInfo={{ name: 'name', dir: 1, type: 'string' }}
          emptyText={NoRowsOverlay}
          style={gridStyle}
        />
      </Box>
    </TableContext.Provider>
  );
}
