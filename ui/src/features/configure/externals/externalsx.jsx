import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { styled } from "@mui/material/styles";

import { isEqual, sortBy } from 'lodash';

import { useSnackbar } from "notistack";

import {
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  TextField,
  Autocomplete,
  Typography,
  Tooltip,
  OutlinedInput,
  CircularProgress
} from '@mui/material';

import {
  Refresh,
  ExpandCircleDownOutlined,
  FileDownloadOutlined,
  FileUploadOutlined,
  ReplayOutlined,
  TaskAltOutlined,
  CancelOutlined,
  PlaylistAddOutlined,
  HighlightOff,
  InfoOutlined,
  SaveAlt,
  Check,
  Close
} from "@mui/icons-material";

import { ExternalContext } from "./externalContext";

import {
  replaceBlockExternals
} from "../../ipam/ipamAPI";

import {
  selectSpaces,
  fetchSpacesAsync,
  fetchNetworksAsync,
  selectNetworks,
  selectViewSetting,
  updateMeAsync
} from "../../ipam/ipamSlice";

import Networks from "./networks/networks";
import Subnets from "./subnets/subnets";

const Wrapper = styled("div")(({ theme }) => ({
  height: "100%",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start"
}));

const Header = styled("div")(({ theme }) => ({
  ...theme.typography.h5,
  width: "100%",
  padding: theme.spacing(1),
  paddingBottom: theme.spacing(3),
  textAlign: "center",
}));

const MainBody = styled("div")(({ theme }) => ({
  height: "100%",
  width: "100%",
  display: "flex",
  flexDirection: "column",
  padding: theme.spacing(3)
}));

const TopSection = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "50%",
  width: "100%",
  marginBottom: theme.spacing(1.5)
}));

const BottomSection = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "50%",
  width: "100%",
  marginTop: theme.spacing(1.5)
}));

export default function Externals() {
  const { enqueueSnackbar } = useSnackbar();

  const [spaceInput, setSpaceInput] = React.useState('');
  const [blockInput, setBlockInput] = React.useState('');

  const [blocks, setBlocks] = React.useState(null);
  const [externals, setExternals] = React.useState(null);
  const [subnets, setSubnets] = React.useState(null);

  const [selectedSpace, setSelectedSpace] = React.useState(null);
  const [selectedBlock, setSelectedBlock] = React.useState(null);
  const [selectedExternal, setSelectedExternal] = React.useState(null);
  const [selectedSubnet, setSelectedSubnet] = React.useState(null);

  const [refreshing, setRefreshing] = React.useState(false);

  const [unchanged, setUnchanged] = React.useState(true);

  const spaces = useSelector(selectSpaces);

  const externalLoadedRef = React.useRef(false);

  const dispatch = useDispatch();

  var externalRef = React.useRef(null);

  const refresh = React.useCallback(() => {
    (async() => {
      try {
        setRefreshing(true);
        await dispatch(fetchSpacesAsync());
      } catch (e) {
        console.log("ERROR");
        console.log("------------------");
        console.log(e);
        console.log("------------------");
        enqueueSnackbar(e.message, { variant: "error" });
      } finally {
        setRefreshing(false);
      }
    })();
  }, [dispatch, enqueueSnackbar]);

  // React.useEffect(() => {
  //   if(!externalLoadedRef.current) {
  //     refresh();
  //     externalLoadedRef.current = true;
  //   }
  // }, [refresh]);

  // React.useEffect(() => {
  //   if(selectedSpace) {
  //     setBlocks(selectedSpace.blocks);
  //   }
  // }, [selectedSpace]);

  // React.useEffect(() => {
  //   setSelectedBlock(null);
  // }, [selectedSpace]);

  React.useEffect(() => {
    if (!spaces) {
      console.log("CLEARING SPACES!");
      setSelectedSpace(null);
    }
  }, [spaces]);

  React.useEffect(() => {
    if (!selectedSpace) {
      console.log("CLEARING BLOCKS!");
      setBlocks(null);
    }
  }, [selectedSpace]);

  React.useEffect(() => {
    if (!blocks) {
      console.log("CLEARING SELECTED BLOCK!");
      setSelectedBlock(null);
    }
  }, [blocks]);

  React.useEffect(() => {
    if (spaces && selectedSpace) {
      const spaceIndex = spaces.findIndex((x) => x.name === selectedSpace.name);

      if (spaceIndex >= -1) {
        if (!isEqual(spaces[spaceIndex], selectedSpace)) {
          console.log("SPACE UPDATED!");
          setSelectedSpace(spaces[spaceIndex]);
          setBlocks(spaces[spaceIndex].blocks);
        } else if (!blocks) {
          setBlocks(spaces[spaceIndex].blocks);
        }
      } else {
        console.log("SPACE NOT FOUND!");
        setSelectedSpace(null);
      }
    }
  }, [spaces, selectedSpace, blocks]);

  React.useEffect(() => {
    if (blocks && selectedBlock) {
      const blockIndex = blocks.findIndex((x) => x.name === selectedBlock.name);

      if (blockIndex >= -1) {
        if (!isEqual(blocks[blockIndex], selectedBlock)) {
          console.log("BLOCK UPDATED!");
          setSelectedBlock(blocks[blockIndex]);
        }
      } else {
        console.log("BLOCK NOT FOUND!");
        setSelectedBlock(null);
      }
    }
  }, [blocks, selectedBlock]);

  React.useEffect(() => {
    if (externals && selectedExternal) {
      const externalIndex = externals.findIndex((x) => x.id === selectedExternal.id);

      if (externalIndex >= -1) {
        if (!isEqual(externals[externalIndex], selectedExternal)) {
          console.log("EXTERNAL UPDATED!");
          setSelectedExternal(externals[externalIndex]);
        }
      } else {
        console.log("EXTERNAL NOT FOUND!");
        setSelectedExternal(null);
      }
    }
  }, [externals, selectedExternal]);

  React.useEffect(() => {
    if (subnets && selectedSubnet) {
      const subnetIndex = subnets.findIndex((x) => x.id === selectedSubnet.id);

      if (subnetIndex >= -1) {
        if (!isEqual(subnets[subnetIndex], selectedSubnet)) {
          console.log("SUBNET UPDATED!");
          setSelectedSubnet(subnets[subnetIndex]);
        }
      } else {
        console.log("SUBNET NOT FOUND!");
        setSelectedSubnet(null);
      }
    }
  }, [subnets, selectedSubnet]);

  return (
    <ExternalContext.Provider value={{ externalRef, refreshing, refresh }}>
      <Wrapper ref={externalRef}>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px', pt: 2, pb: 2, pr: 3, pl: 3, alignItems: 'center', borderBottom: 'solid 1px rgba(0, 0, 0, 0.12)' }}>
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
              <Autocomplete
                forcePopupIcon={false}
                id="grouped-demo"
                size="small"
                options={sortBy(spaces, 'name')}
                getOptionLabel={(option) => option.name}
                inputValue={spaceInput}
                onInputChange={(event, newInputValue) => setSpaceInput(newInputValue)}
                value={selectedSpace}
                onChange={(event, newValue) => setSelectedSpace(newValue)}
                isOptionEqualToValue={(option, value) => isEqual(option.name, value.name)}
                noOptionsText={ !spaces ? "Loading..." : "No Spaces" }
                sx={{ width: 300 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Space"
                    placeholder="Please Select Space..."
                    InputProps={{
                      ...params.InputProps,
                      endAdornment: (
                        <React.Fragment>
                          {!spaces ? <CircularProgress color="inherit" size={20} /> : null}
                          {params.InputProps.endAdornment}
                        </React.Fragment>
                      ),
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  return (
                    <li {...props} key={option.name}>
                      {option.name}
                    </li>
                  );
                }}
                componentsProps={{
                  paper: {
                    sx: {
                      width: 'fit-content'
                    }
                  }
                }}
              />
              <Autocomplete
                disabled={selectedSpace === null}
                forcePopupIcon={false}
                id="grouped-demo"
                size="small"
                options={(blocks && selectedSpace) ? sortBy(blocks.filter((x) => x.parent_space === selectedSpace.name), 'name') : []}
                getOptionLabel={(option) => option.name}
                inputValue={blockInput}
                onInputChange={(event, newInputValue) => setBlockInput(newInputValue)}
                value={selectedBlock}
                onChange={(event, newValue) => setSelectedBlock(newValue)}
                isOptionEqualToValue={(option, value) => isEqual(option.name, value.name)}
                sx={{ width: 300 }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Block"
                    placeholder="Please Select Block..."
                    InputProps={{
                      ...params.InputProps
                    }}
                  />
                )}
                renderOption={(props, option) => {
                  return (
                    <li {...props} key={option.id}>
                      {option.name}
                    </li>
                  );
                }}
                componentsProps={{
                  paper: {
                    sx: {
                      width: 'fit-content'
                    }
                  }
                }}
              />
            </Box>
          </Box>
        <MainBody>
          <TopSection>
            <Networks
              selectedSpace={selectedSpace}
              selectedBlock={selectedBlock}
              selectedExternal={selectedExternal}
              externals={externals}
              setExternals={setExternals}
              setSelectedExternal={setSelectedExternal}
            />
          </TopSection>
          <BottomSection>
            <Subnets
              selectedSpace={selectedSpace}
              selectedBlock={selectedBlock}
              selectedExternal={selectedExternal}
              selectedSubnet={selectedSubnet}
              subnets={subnets}
              setSubnets={setSubnets}
              setSelectedSubnet={setSelectedSubnet}
            />
          </BottomSection>
        </MainBody>
      </Wrapper>
    </ExternalContext.Provider>
  );
}
