import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { styled } from "@mui/material/styles";

// import { isEqual } from 'lodash';

import { useSnackbar } from "notistack";

import SpaceDataGrid from "./space/space";
import BlockDataGrid from "./block/block";

import { ConfigureContext } from "./configureContext";

import {
  selectSpaces,
  selectBlocks,
  fetchSpacesAsync
} from "../ipam/ipamSlice";

const Wrapper = styled("div")(({ theme }) => ({
  height: "calc(100vh - 64px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-start",
  padding: theme.spacing(3),
}));

const Header = styled("div")(({ theme }) => ({
  ...theme.typography.h5,
  width: "100%",
  padding: theme.spacing(1),
  paddingBottom: theme.spacing(3),
  textAlign: "center",
}));

const MainBody = styled("div")({
  height: "100%",
  width: "100%",
  display: "flex",
  flexDirection: "column",
});

const TopSection = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "50%",
  width: "100%",
  border: "1px solid rgba(224, 224, 224, 1)",
  borderRadius: "4px",
  marginBottom: theme.spacing(1.5)
}));

const BottomSection = styled("div")(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  height: "50%",
  width: "100%",
  border: "1px solid rgba(224, 224, 224, 1)",
  borderRadius: "4px",
  marginTop: theme.spacing(1.5)
}));

export default function ConfigureIPAM() {
  const { enqueueSnackbar } = useSnackbar();

  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedSpace, setSelectedSpace] = React.useState(null);
  const [selectedBlock, setSelectedBlock] = React.useState(null);

  const configLoadedRef = React.useRef(false);

  const spaces = useSelector(selectSpaces);
  const blocks = useSelector(selectBlocks);

  const dispatch = useDispatch();

  var configureRef = React.useRef(null);

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
    if(!configLoadedRef.current) {
      refresh();
      configLoadedRef.current = true;
    }
  }, [refresh]);

  // React.useEffect(() => {
  //   if(blocks && selectedBlock) {
  //     let targetBlock = blocks.find(x => x.name === selectedBlock.name);

  //     if(targetBlock) {
  //       if(!isEqual(targetBlock, selectedBlock)) {
  //         setSelectedBlock(targetBlock)
  //       }
  //     }
  //   }
  // }, [blocks, selectedBlock]);

  return (
    <ConfigureContext.Provider value={{ configureRef, spaces, blocks, refreshing, refresh }}>
      <Wrapper ref={configureRef}>
        <Header>
          Configure Azure IPAM
        </Header>
        <MainBody>
          <TopSection>
            <SpaceDataGrid
              selectedSpace={selectedSpace}
              setSelectedSpace={setSelectedSpace}
              setSelectedBlock={setSelectedBlock}
            />
          </TopSection>
          <BottomSection>
            <BlockDataGrid
              selectedSpace={selectedSpace}
              selectedBlock={selectedBlock}
              setSelectedBlock={setSelectedBlock}
            />
          </BottomSection>
        </MainBody>
      </Wrapper>
    </ConfigureContext.Provider>
  );
}
