import * as React from "react";
import { useSelector, useDispatch } from "react-redux";
import { useLocation } from "react-router-dom";
import { styled } from "@mui/material/styles";

import { isEqual, sortBy, pick } from "lodash";

import { useSnackbar } from "notistack";

import {
  Box,
  IconButton,
  TextField,
  Autocomplete,
  Tooltip,
  CircularProgress
} from "@mui/material";

import {
  Refresh
} from "@mui/icons-material";

import { ExternalContext } from "./externalContext";

import {
  selectSpaces,
  selectBlocks,
  fetchSpacesAsync
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

  const location = useLocation();

  const [spaceInput, setSpaceInput] = React.useState('');
  const [blockInput, setBlockInput] = React.useState('');

  const [externals, setExternals] = React.useState(null);
  const [subnets, setSubnets] = React.useState(null);

  const [selectedSpace, setSelectedSpace] = React.useState(location.state?.space || null);
  const [selectedBlock, setSelectedBlock] = React.useState(location.state?.block || null);
  const [selectedExternal, setSelectedExternal] = React.useState(null);
  const [selectedSubnet, setSelectedSubnet] = React.useState(null);

  const [refreshing, setRefreshing] = React.useState(false);

  const spaces = useSelector(selectSpaces);
  const blocks = useSelector(selectBlocks);

  // const externalLoadedRef = React.useRef(false);

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

  React.useEffect(() => {
    if (spaces) {
      if (selectedSpace) {
        const spaceIndex = spaces.findIndex((x) => x.name === selectedSpace.name);

        if (spaceIndex > -1) {
          if (!isEqual(spaces[spaceIndex], selectedSpace)) {
            setSelectedSpace(spaces[spaceIndex]);
          }
        } else {
          setSelectedSpace(null);
          setSelectedBlock(null);
        }
      } else {
        setSelectedBlock(null);
      }
    } else {
      setSelectedSpace(null);
    }
  }, [spaces, selectedSpace]);

  React.useEffect(() => {
    if (blocks) {
      if (selectedBlock) {
        const blockIndex = blocks.findIndex((x) => x.id === selectedBlock.id);

        if (blockIndex > -1) {
          if (!isEqual(blocks[blockIndex], selectedBlock)) {
            setSelectedBlock(blocks[blockIndex]);
            setExternals(blocks[blockIndex].externals);
          }
        } else {
          setSelectedBlock(null);
          setExternals(null);
        }
      } else {
        setExternals(null);
      }
    } else {
      setSelectedBlock(null);
      setExternals(null);
    }
  }, [blocks, selectedBlock]);

  React.useEffect(() => {
    if (selectedSpace && selectedBlock) {
      if (selectedBlock.parent_space !== selectedSpace.name) {
        setSelectedBlock(null);
      }
    }
  }, [selectedSpace, selectedBlock]);

  React.useEffect(() => {
    if (externals) {
      if (selectedExternal) {
        const externalIndex = externals.findIndex((x) => x.name === selectedExternal.name);

        if (externalIndex > -1) {
          if (!isEqual(externals[externalIndex], selectedExternal)) {
            setSelectedExternal(externals[externalIndex]);
          }
        } else {
          setSelectedExternal(null);
        }
      }
    } else {
      setSelectedExternal(null);
      setSubnets(null);
    }
  }, [externals, selectedExternal]);

  React.useEffect(() => {
    if (subnets) {
      if (selectedSubnet) {
        const subnetIndex = subnets.findIndex((x) => x.name === selectedSubnet.name);

        if (subnetIndex > -1) {
          if (!isEqual(subnets[subnetIndex], selectedSubnet)) {
            setSelectedSubnet(subnets[subnetIndex]);
          }
        } else {
          setSelectedSubnet(null);
        }
      }
    } else {
      setSelectedSubnet(null);
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
                options={spaces ? sortBy(spaces, 'name') : []}
                getOptionLabel={(option) => option.name}
                inputValue={spaceInput}
                onInputChange={(event, newInputValue) => setSpaceInput(newInputValue)}
                value={selectedSpace}
                onChange={(event, newValue) => setSelectedSpace(newValue)}
                isOptionEqualToValue={
                  (option, value) => {
                    const newOption = pick(option, ['name']);
                    const newValue = pick(value, ['name']);
  
                    return isEqual(newOption, newValue);
                  }
                }
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
                options={(blocks && selectedSpace) ? sortBy(blocks.filter((block) => block.parent_space === selectedSpace.name), 'name') : []}
                getOptionLabel={(option) => option.name}
                inputValue={blockInput}
                onInputChange={(event, newInputValue) => setBlockInput(newInputValue)}
                value={(selectedBlock?.parent_space === selectedSpace?.name) ? selectedBlock : null}
                onChange={(event, newValue) => setSelectedBlock(newValue)}
                isOptionEqualToValue={
                  (option, value) => {
                    const newOption = pick(option, ['id', 'name']);
                    const newValue = pick(value, ['id', 'name']);
  
                    return isEqual(newOption, newValue);
                  }
                }
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
              <TextField
                disabled
                id="block-cidr-read-only"
                label="Network"
                size="small"
                value={ selectedBlock ? selectedBlock.cidr : "" }
                sx={{
                  width: '11ch'
                }}
              />
            </Box>
            <Box sx={{ display: 'flex', ml: 'auto' }}>
              <Tooltip title="Refresh" placement="top" >
                <span>
                  <IconButton
                    color="primary"
                    size="small"
                    onClick={refresh}
                    disabled={ refreshing || !selectedSpace || !selectedBlock }
                  >
                    <Refresh />
                  </IconButton>
                </span>
              </Tooltip>
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
