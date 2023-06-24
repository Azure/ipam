import React from "react";
import { styled } from '@mui/system';
import { createTheme } from "@mui/material/styles";

import { get } from 'lodash';

import {
  CircularProgress,
  Typography,
  ThemeProvider,
  Button,
  Box,
  Divider,
  IconButton
} from "@mui/material";

import CloseIcon from '@mui/icons-material/Close';

import { AZURE_PORTAL } from "../../../global/azureClouds";

import { TableContext } from "../TableContext";

const detailsTheme = (theme) => createTheme({
  ...theme,
  overrides: {
    MuiLinearProgress: {
      root: {
        borderRadius: 4,
        height: 7,
      },
      bar1Determinate: {
        borderRadius: 4,
      },
      colorPrimary: {
        backgroundColor: "#f5f5f5",
      },
    },
    MuiCircularProgress: {
      circle: {
        strokeLinecap: "round",
        strokeWidth: 2.8,
      },
    },
  },
});

function NumberCircularProgress(props) {
  var circleColor = "inherit";

  if (props.value <= 70) {
    circleColor = "success";
  } else if (props.value <= 90) {
    circleColor = "warning";
  } else if (props.value > 90) {
    circleColor = "error";
  }

  return (
    <Box position="relative" display="inline-block">
      <Box top={0} left={0} bottom={0} right={0} position="absolute">
        <CircularProgress style={{ color: "#f5f5f5" }} size={110} variant="determinate" value={100} />
      </Box>
      <CircularProgress
        color={circleColor}
        size={110}
        variant="determinate"
        value={props.value}
      />
      <Box
        top={0}
        left={0}
        bottom={0}
        right={0}
        position="absolute"
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography
          variant="h6"
          component="div"
          color="textSecondary"
          sx={{ mb: 1 }}
        >
          {`${props.value}%`}
        </Typography>
      </Box>
    </Box>
  );
}

export default function ItemDetails(props) {
  const { rowData } = React.useContext(TableContext);
  const { title, map, setExpand } = props;

  var isTarget = Object.keys(rowData).length;
  var progress = isTarget ? (Math.round((rowData[map.progressUsed] / rowData[map.progressTotal]) * 100) || 0) : 0;

  const Wrapper = styled(Box)({
    display: "flex",
    justifyContent: "center",
    flexDirection: "column",
    paddingTop: "8px",
    paddingBottom: "8px",
  });

  const Utilization = styled(Box)({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: "8px",
    paddingBottom: "8px",
  });

  const Fields = styled(Box)({
    display: "flex",
    flexDirection: "column",
    paddingTop: "8px",
    paddingBottom: "8px",
  });

  const Link = styled(Box)({
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: "8px",
    paddingBottom: "8px",
  });

  return isTarget ? (
    <ThemeProvider theme={detailsTheme}>
      <Wrapper>
        <Box sx={{ display: "flex" }}>
          <Box sx={{ width: "40px" }} />
          <Box sx={{ width: "100%" }}>
            <Typography sx={{ fontWeight: "bold", textAlign: "center", pt: 1, pb: 1 }}>
              {title} Details
            </Typography>
          </Box>
          <Box sx={{ width: "40px", display: "flex", justifyContent: "start", alignItems: "start" }} >
            <IconButton size="small" sx={{ padding: 0 }} onClick={() => setExpand(false)}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>
        {map.showProgress &&
          <React.Fragment>
            <Utilization>
              <NumberCircularProgress value={progress} />
            </Utilization>
            <Divider />
          </React.Fragment>
        }
        <Fields>
          {map.fieldMap.map((field, index) => (
            get(rowData, field.value) != null &&
            <React.Fragment key={index}>
              <Typography variant="overline" sx={{ fontSize: 10, fontWeight: "bold", textAlign: "left", pl: 3 }}>
                {field.name}:&nbsp;
              </Typography>
              <Typography noWrap variant="overline" sx={{ fontSize: 10, textAlign: "left", pl: 5 }}>
                {get(rowData, field.value) != null ? Array.isArray(get(rowData, field.value)) ? get(rowData, field.value).join(', ') : get(rowData, field.value).toString() : "N/A"}
              </Typography>
            </React.Fragment>
          ))}
        </Fields>
        {map.showLink &&
          <React.Fragment>
            <Divider />
            <Link>
              <Button variant="text" size="small" onClick={() => window.open(`https://${AZURE_PORTAL}/#@${rowData.tenant_id}/resource/${rowData.id}`, "_blank")}>VIEW IN PORTAL</Button>
            </Link>
          </React.Fragment>
        }
      </Wrapper>
    </ThemeProvider>
  ) : null;
}
