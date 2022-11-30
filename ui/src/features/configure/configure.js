import * as React from "react";
import { useSelector, useDispatch } from 'react-redux';
import { styled } from "@mui/material/styles";

import { useSnackbar } from "notistack";

import { useMsal } from "@azure/msal-react";
import { InteractionRequiredAuthError } from "@azure/msal-browser";

import SpaceDataGrid from "./space/space";
import BlockDataGrid from "./block/block";

import { ConfigureContext } from "./configureContext";

import { selectSpaces, fetchSpacesAsync } from "../ipam/ipamSlice";

import { apiRequest } from "../../msal/authConfig";

const Wrapper = styled("div")(({ theme }) => ({
  height: "calc(100vh - 112px)",
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
  const { instance, accounts } = useMsal();
  const { enqueueSnackbar } = useSnackbar();

  const [refreshing, setRefreshing] = React.useState(false);
  const [selectedSpace, setSelectedSpace] = React.useState(null);

  const configLoadedRef = React.useRef(false);

  const spaces = useSelector(selectSpaces);

  const dispatch = useDispatch();

  React.useEffect(() => {
    if(!configLoadedRef.current) {
      refresh();
      configLoadedRef.current = true;
    }
  }, []);

  function refresh() {
    console.log("REFRESH SPACES");
    const request = {
      scopes: apiRequest.scopes,
      account: accounts[0],
    };

    (async() => {
      try {
        const response = await instance.acquireTokenSilent(request);
        setRefreshing(true);
        await dispatch(fetchSpacesAsync(response.accessToken));
        setRefreshing(false);
      } catch (e) {
        if (e instanceof InteractionRequiredAuthError) {
          instance.acquireTokenRedirect(request);
        } else {
          console.log("ERROR");
          console.log("------------------");
          console.log(e);
          console.log("------------------");
          enqueueSnackbar(e.response.data.error, { variant: "error" });
        }
      }
    })();
  }

  return (
    <ConfigureContext.Provider value={{ refreshing, spaces, refresh }}>
      <Wrapper>
        <Header>
          Configure Azure IPAM
        </Header>
        <MainBody>
          <TopSection>
            <SpaceDataGrid
              selected={selectedSpace}
              setSelected={setSelectedSpace}
            />
          </TopSection>
          <BottomSection>
            <BlockDataGrid
              selected={selectedSpace}
            />
          </BottomSection>
        </MainBody>
      </Wrapper>
    </ConfigureContext.Provider>
  );
}
