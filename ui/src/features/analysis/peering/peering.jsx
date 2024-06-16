import React from "react";
import { useSelector } from 'react-redux';

import ReactECharts from "echarts-for-react";

import { useTheme } from '@mui/material/styles';

import {
  TextField,
  Autocomplete,
  IconButton
} from '@mui/material';

import RestoreIcon from '@mui/icons-material/Restore';

import { cloneDeep, isEmpty } from "lodash";

import {
  selectSubscriptions,
  selectNetworks
} from "../../ipam/ipamSlice";

const opt = {
  graphic: {
    elements: [
      {
        type: 'group',
        left: 'center',
        top: 'center',
        children: new Array(7).fill(0).map((val, i) => ({
          type: 'rect',
          x: i * 20,
          shape: {
            x: 0,
            y: -40,
            width: 10,
            height: 80
          },
          style: {
            fill: '#5470c6'
          },
          keyframeAnimation: {
            duration: 1000,
            delay: i * 200,
            loop: true,
            keyframes: [
              {
                percent: 0.5,
                scaleY: 0.3,
                easing: 'cubicIn'
              },
              {
                percent: 1,
                scaleY: 1,
                easing: 'cubicOut'
              }
            ]
          }
        }))
      }
    ]
  },
  title: {
    text: "vNET Peering",
    subtext: "Circular layout",
    top: "bottom",
    left: "right",
    show: false,
  },
  toolbox: {
    show: false,
    top: 25,
    right: 25,
    feature: {
      restore: {}
    }
  },
  tooltip: {
    show: true,
    position:  function (point, params, dom, rect, size) {
      const x = point[0] - (size.contentSize[0] / 2) - 6;
      const y = point[1] + 10;

      return [x, y];
    },
    formatter: function (d) {
      if(d.dataType === "edge") {
        const x = `
          <style>
            .wrapper {
              display: flex;
              flex-direction: column;
              font-size: 10px;
              line-height: normal;
            }

            .outer {
              display: flex;
              flex-direction: row;
            }

            .section {
              display: flex;
              flex-direction: column;
            }

            .center {
              display: flex;
              font-size: 20px;
              font-weight: bold;
              width: 40px;
              margin: 2px;
              justify-content: center;
              align-items: center;
            }

            .title {
              display: flex;
              font-weight: bold;
              text-decoration: underline;
              margin: 4px 2px 8px 2px;
            }

            .data {
              display: flex;
              flex-direction: row;
              margin: 1px 2px;
            }

            .footer {
              display: flex;
              flex-direction: row;
              margin: 8px 2px 1px 2px;
            }

            .dot {
              height: 10px;
              width: 10px;
              border-radius: 50%;
              margin-right: 4px;
            }

            .wrapper::before {
              content: "";
              position: absolute;
              top: -12px;
              left: calc(50% - 6px);
              border-width: 0px 12px 12px;
              border-style: solid;
              border-color: ${d.data.lineStyle.color} transparent;
            }

            .wrapper::after {
              content: "";
              position: absolute;
              top: -10px;
              left: calc(50% - 4px);
              border-width: 0px 10px 10px;
              border-style: solid;
              border-color: #fff transparent;
              z-index: 1;
            }
          </style>
          <div class="wrapper">
            <div class="outer">
              <div class="section">
                <div class="title">
                  <span>SOURCE</span>
                </div>
                <div class="data">
                  <span style="font-weight: bold">Network Name:&nbsp;</span>
                  ${d.data.detail.sourceVnetName}
                </div>
                <div class="data">
                  <span style="font-weight: bold">Resource Group:&nbsp;</span>
                  ${d.data.detail.sourceResourceGroup}
                </div>
                <div class="data">
                <span style="font-weight: bold">Subscription Name:&nbsp;</span>
                  ${d.data.detail.sourceSubscriptionName}
                </div>
                <div class="data">
                  <span style="font-weight: bold">Subscription ID:&nbsp;</span>
                  ${d.data.detail.sourceSubscriptionId}
                </div>
              </div>
              <div class="center">
                <span>&#8646;</span>
              </div>
              <div class="section">
                <div class="title">
                  <span>TARGET</span>
                </div>
                <div class="data">
                  <span style="font-weight: bold">Network Name:&nbsp;</span>
                  ${d.data.detail.targetVnetName}
                </div>
                <div class="data">
                  <span style="font-weight: bold">Resource Group:&nbsp;</span>
                  ${d.data.detail.targetResourceGroup}
                </div>
                <div class="data">
                <span style="font-weight: bold">Subscription Name:&nbsp;</span>
                  ${d.data.detail.targetSubscriptionName}
                </div>
                <div class="data">
                  <span style="font-weight: bold">Subscription ID:&nbsp;</span>
                  ${d.data.detail.targetSubscriptionId}
                </div>
              </div>
            </div>
            <div class="footer">
              <div class="dot" style="background-color: ${d.data.lineStyle.color}"></div>
              <span style="font-weight: bold">
                ${d.data.detail.state}
              </span>
            </div>
          </div>
        `;

        return x;
      } else {
        // const name = d.name;
        // const peers = d.value;
        // const color = d.color;

        const display = d.data.category !== 'error' && 'none';

        // const vNetPattern = "/Microsoft.Network/virtualNetworks/";
        // const vHubPattern = "/Microsoft.Network/virtualHubs/";

        // const resourceGroupPattern = "(?<=/resourceGroups/).+?(?=/)";
        // const subscriptionPattern = "(?<=/subscriptions/).+?(?=/)";

        // var vNetName = '';

        // if(name.includes(vNetPattern)) {
        //   vNetName = name.substr(name.indexOf(vNetPattern) + vNetPattern.length, name.length);
        // }

        // if(name.includes(vHubPattern)) {
        //   vNetName = name.substr(name.indexOf(vHubPattern) + vHubPattern.length, name.length);
        // }

        // const resourceGroup = name.match(resourceGroupPattern)[0];
        // const subscription = name.match(subscriptionPattern)[0];

        const y = `
          <style>
            .outer {
              display: flex;
              flex-direction: row;
              font-size: 10px;
              line-height: normal;
            }

            .section {
              display: flex;
              flex-direction: column;
            }

            .title {
              display: flex;
              font-weight: bold;
              text-decoration: underline;
              margin: 4px 2px 8px 2px;
            }

            .data {
              display: flex;
              flex-direction: row;
              margin: 1px 2px;
            }

            .footer {
              display: flex;
              flex-direction: row;
              margin: 8px 2px 1px 2px;
            }

            .dot {
              height: 10px;
              width: 10px;
              border-radius: 50%;
              margin-right: 4px;
            }

            .outer::before {
              content: "";
              position: absolute;
              top: -12px;
              left: calc(50% - 6px);
              border-width: 0px 12px 12px;
              border-style: solid;
              border-color: ${d.color} transparent;
            }

            .outer::after {
              content: "";
              position: absolute;
              top: -10px;
              left: calc(50% - 4px);
              border-width: 0px 10px 10px;
              border-style: solid;
              border-color: #fff transparent;
              z-index: 1;
            }
          </style>
          <div class="outer">
            <div class="section">
              <div class="title">
                <span>NETWORK DETAILS</span>
                <img style="margin-left: auto; display: ${display}" src="/warning.png" width="12px" height="12px"/>
              </div>
              <div class="data">
                <span style="font-weight: bold">Network Name:&nbsp;</span>
                ${d.data.detail.vNetName}
              </div>
              <div class="data">
                <span style="font-weight: bold">Resource Group:&nbsp;</span>
                ${d.data.detail.resourceGroup}
              </div>
              <div class="data">
                <span style="font-weight: bold">Subscription Name:&nbsp;</span>
                ${d.data.detail.subscriptionName}
              </div>
              <div class="data">
                <span style="font-weight: bold">Subscription ID:&nbsp;</span>
                ${d.data.detail.subscriptionId}
              </div>
              <div class="footer">
                <div class="dot" style="background-color: ${d.color}"></div>
                <span style="font-weight: bold">Peerings:&nbsp;</span>
                ${d.value}
                <span style="margin-left: auto; color: crimson; font-weight: bold; display: ${display}">vNET Missing</span>
              </div>
            </div>
          </div>
        `;
        
        return y;
      }
    }
  },
  legend: [],
  series: []
};

function parseNets(data, subscriptions) {
  const factor = 3;

  const stateMap = {
    'Connected': {
      color: '#00FF00',
      lineStyle: 'solid'
    },
    'Disconnected': {
      color: '#FF0000',
      lineStyle: 'dotted'
    },
    'Updating': {
      color: '#FFA500',
      lineStyle: 'solid'
    },
    'Initiated': {
      color: '#3385FF',
      lineStyle: 'solid'
    }
  };

  var visibleNets = [];

  const nodes = data.map(vnet => {
    const vNetPattern = "/Microsoft.Network/virtualNetworks/";
    const vHubPattern = "/Microsoft.Network/virtualHubs/";

    const resourceGroupPattern = "(?<=/resourceGroups/).+?(?=/)";
    const subscriptionPattern = "(?<=/subscriptions/).+?(?=/)";

    var vNetName = '';

    if(vnet.id.includes(vNetPattern)) {
      vNetName = vnet.id.substr(vnet.id.indexOf(vNetPattern) + vNetPattern.length, vnet.id.length);
    }

    if(vnet.id.includes(vHubPattern)) {
      vNetName = vnet.id.substr(vnet.id.indexOf(vHubPattern) + vHubPattern.length, vnet.id.length);
    }

    const resourceGroup = vnet.id.match(resourceGroupPattern)[0];
    const subscriptionId = vnet.id.match(subscriptionPattern)[0];

    const subscriptionName = subscriptions.find(sub => sub.subscription_id === subscriptionId)?.name || 'Unknown';

    visibleNets.push(vnet.id);

    let node = {
      name: vnet.id,
      value: vnet.peerings.length, //vnet.id
      detail: {
        vNetName: vNetName,
        resourceGroup: resourceGroup,
        subscriptionId: subscriptionId,
        subscriptionName: subscriptionName
      },
      symbolSize: (vnet.peerings.length * factor) + factor,
      category: vnet.id,
      label: {
        show: true,
      }
    };

    if(vnet.id.includes(vHubPattern)) {
      node.symbol = 'image:///vhub.png';
      node.symbolSize += 4;
    }

    return node;
  });

  const missing = [...new Set(data.map((vnet) => vnet.peerings).flat())];
  const uniqueMissing = [...new Map(missing.map((item) => [item["remote_network"], item])).values()];

  uniqueMissing.forEach((peer) => {
    if(!visibleNets.includes(peer.remote_network)) {
      const vNetPattern = "/Microsoft.Network/virtualNetworks/";
      const vHubPattern = "/Microsoft.Network/virtualHubs/";
  
      const resourceGroupPattern = "(?<=/resourceGroups/).+?(?=/)";
      const subscriptionPattern = "(?<=/subscriptions/).+?(?=/)";
  
      var vNetName = '';
  
      if(peer.remote_network.includes(vNetPattern)) {
        vNetName = peer.remote_network.substr(peer.remote_network.indexOf(vNetPattern) + vNetPattern.length, peer.remote_network.length);
      }
  
      if(peer.remote_network.includes(vHubPattern)) {
        vNetName = peer.remote_network.substr(peer.remote_network.indexOf(vHubPattern) + vHubPattern.length, peer.remote_network.length);
      }
  
      const resourceGroup = peer.remote_network.match(resourceGroupPattern)[0];
      const subscriptionId = peer.remote_network.match(subscriptionPattern)[0];
  
      const subscriptionName = subscriptions.find(sub => sub.subscription_id === subscriptionId)?.name || 'Unknown';

      let node = {
        name: peer.remote_network,
        value: 1,
        detail: {
          vNetName: vNetName,
          resourceGroup: resourceGroup,
          subscriptionId: subscriptionId,
          subscriptionName: subscriptionName
        },
        symbol: 'image:///warning.png',
        symbolSize: (1 * factor) + factor,
        category: 'error',
        label: {
          show: true,
        }
      };

      nodes.push(node);
    }
  });

  const totalLinks = data.reduce((accumulator, object) => {
    return accumulator + object.peerings.length;
  }, 0);

  const linkArr = data.map((item) => {
    let peerArr = [];

    item.peerings.forEach((peer) => {
      const vNetPattern = "/Microsoft.Network/virtualNetworks/";
      const vHubPattern = "/Microsoft.Network/virtualHubs/";

      const resourceGroupPattern = "(?<=/resourceGroups/).+?(?=/)";
      const subscriptionPattern = "(?<=/subscriptions/).+?(?=/)";

      var sourceVnetName = '';
      var targetVnetName = '';

      if(item.id.includes(vNetPattern)) {
        sourceVnetName = item.id.substr(item.id.indexOf(vNetPattern) + vNetPattern.length, item.id.length);
      }

      if(item.id.includes(vHubPattern)) {
        sourceVnetName = item.id.substr(item.id.indexOf(vHubPattern) + vHubPattern.length, item.id.length);
      }

      if(peer.remote_network.includes(vNetPattern)) {
        targetVnetName = peer.remote_network.substr(peer.remote_network.indexOf(vNetPattern) + vNetPattern.length, peer.remote_network.length);
      }

      if(peer.remote_network.includes(vHubPattern)) {
        targetVnetName = peer.remote_network.substr(peer.remote_network.indexOf(vHubPattern) + vHubPattern.length, peer.remote_network.length);
      }

      const sourceResourceGroup = item.id.match(resourceGroupPattern)[0];
      const targetResourceGroup = peer.remote_network.match(resourceGroupPattern)[0];

      const sourceSubscriptionId = item.id.match(subscriptionPattern)[0];
      const targetSubscriptionId = peer.remote_network.match(subscriptionPattern)[0];

      const sourceSubscriptionName = subscriptions.find(sub => sub.subscription_id === sourceSubscriptionId)?.name || 'Unknown';
      const targetSubscriptionName = subscriptions.find(sub => sub.subscription_id === targetSubscriptionId)?.name || 'Unknown';

      const data = {
        source: item.id,
        target: peer.remote_network,
        detail: {
          sourceVnetName: sourceVnetName,
          targetVnetName: targetVnetName,
          sourceResourceGroup: sourceResourceGroup,
          targetResourceGroup: targetResourceGroup,
          sourceSubscriptionId: sourceSubscriptionId,
          targetSubscriptionId: targetSubscriptionId,
          sourceSubscriptionName: sourceSubscriptionName,
          targetSubscriptionName: targetSubscriptionName,
          state: peer.state
        },
        lineStyle: {
          color: stateMap[peer.state].color,
          type: stateMap[peer.state].lineStyle,
          width: totalLinks > 75 ? 2 : 3,
          opacity: 0.3,
        },
        // emphasis: {
        //   disabled: true
        // }
      };

      peerArr.push(data);
    });

    return peerArr;
  }).flat();

  const links = linkArr.reduce(
    (acc, curr) => 
      acc.find((v) => (v.source === curr.target && v.target === curr.source)) ? acc : [...acc, curr],
    []
  );

  let categories = data.map(vnet => {
    return { name: vnet.id };
  });

  categories.push({
    name: 'error'
  });

  var newOptions = cloneDeep(opt);

  const legend = [
    {
      data: categories.map(function (a) {
        return a.name;
      }),
      show: false,
    },
  ];

  const series = [
    {
      name: "vNET Peering",
      type: "graph",
      layout: "force",
      // zoom: 0.75,
      // circular: {
      //   rotateLabel: true,
      // },
      selectedMode: "single",
      data: nodes,
      links: links,
      categories: categories,
      roam: true,
      label: {
        show: true,
        position: "top",
        formatter: function(d) {
          const vNetPattern = "/Microsoft.Network/virtualNetworks/";
          const vHubPattern = "/Microsoft.Network/virtualHubs/";

          var vnetName = '';

          if(d.name.includes(vNetPattern)) {
            vnetName = d.name.substr(d.name.indexOf(vNetPattern) + vNetPattern.length, d.name.length);
          }

          if(d.name.includes(vHubPattern)) {
            vnetName = d.name.substr(d.name.indexOf(vHubPattern) + vHubPattern.length, d.name.length);
          }

          return vnetName;
        }
      },
      // lineStyle: {
      //   color: "source",
      //   curveness: 0.3,
      // },
      force: {
        gravity: 0.1,
        friction: 0.75,
        edgeLength: 50,
        repulsion: 100
      },
      // emphasis: {
      //   focus: "adjacency",
      //   blurScope: "coordinateSystem"
      // }
    },
  ];

  delete newOptions.graphic;
  newOptions.legend = legend;
  newOptions.series = series;

  return newOptions;
}

const Reset = (props) => {
  const { resetView } = props;

  return(
    <IconButton
      onClick={resetView}
      sx={{
        position: "absolute",
        top: 137,
        right: 25,
        zIndex: 1
      }}
    >
      <RestoreIcon />
    </IconButton>
  );
};

const Search = React.forwardRef((props, ref) => {
  const { options, setDataFocus } = props;

  const [value, setValue] = React.useState(null);
  const [inputValue, setInputValue] = React.useState('');
  const [searchOptions, setSearchOptions] = React.useState([]);

  const theme = useTheme();

  const vNetPattern = "/Microsoft.Network/virtualNetworks/";
  const vHubPattern = "/Microsoft.Network/virtualHubs/";

  React.useImperativeHandle(ref, () => ({
    setValue(target) {
      setValue(target);
    },
    clearSearch() {
      setInputValue('');
      setValue(null);
    },
    hasValue() {
      return value ? true : false;
    }
  }));

  React.useEffect(() => {
    if(isEmpty(options.series)) {
      setSearchOptions([])
    } else {
      const optionData = options.series[0].data.map((option) => {
        var targetName = '';

        if(option.name.includes(vNetPattern)) {
          targetName = option.name.substr(option.name.indexOf(vNetPattern) + vNetPattern.length, option.length)
        }

        if(option.name.includes(vHubPattern)) {
          targetName = option.name.substr(option.name.indexOf(vHubPattern) + vHubPattern.length, option.length)
        }

        const newOption = {
          id: option.name,
          name: targetName
        }

        return newOption;
      });

      setSearchOptions(optionData);
    }
  }, [options]);

  React.useEffect(() => {
    value ? setDataFocus(value.id) : setDataFocus(null);
  }, [value, setDataFocus])

  return(
    <Autocomplete
      freeSolo
      id="echart-vnet-search"
      size="small"
      value={value}
      onChange={(event, newValue) => {
        setValue(newValue);
      }}
      inputValue={inputValue}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
      options={searchOptions}
      getOptionLabel={(option) => option ? option.name : ''}
      renderInput={(params) => {
        return(
          <TextField
            {...params}
            label="Network Search"
            style={{
              backgroundColor: theme.palette.mode === "dark" ? "black" : "white"
            }}
          />
        );
      }}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option.id}>
            {option.name}
          </li>
        );
      }}
      sx={{ background: "white" }}
      style={{
        position: "absolute",
        backgroundColor: "transparent",
        borderRadius: "4px",
        width: "300px",
        top: 137,
        left: 25,
        zIndex: 1
      }}
    />
  );
});

const Peering = () => {
  const [options, setOptions] = React.useState(opt);
  const [eChartsRef, setEChartsRef] = React.useState(null);

  const searchRef = React.useRef(null);

  const subscriptions = useSelector(selectSubscriptions);
  const networks = useSelector(selectNetworks);

  const theme = useTheme();

  const vNetPattern = "/Microsoft.Network/virtualNetworks/";
  const vHubPattern = "/Microsoft.Network/virtualHubs/";

  const ref = React.useCallback(node => {
    if (node !== null) {
      setEChartsRef(node);
    }
  }, []);

  React.useEffect(() => {
    if(subscriptions && networks) {
      let vnetOptions = parseNets(networks, subscriptions);

      vnetOptions.darkMode = theme.palette.mode === "dark" ? true : false;

      setOptions(vnetOptions);
    }
  }, [subscriptions, networks, theme]);

  function filterByVnet(options, target, previousTarget, currentMembers) {
    const members = [];

    let filteredLinks = options.series[0].links.filter((item) => {
      if(item.source === target) {
        members.push(item.target);
        return item;
      } else if(item.target === target) {
        members.push(item.source);
        return item;
      }

      return false;
    });

    let uniqueMembers = [...new Set(members)];

    var indexOfPrevious = uniqueMembers.indexOf(previousTarget);

    if (indexOfPrevious !== -1) {
      uniqueMembers.splice(indexOfPrevious, 1);
    }

    let filteredData = options.series[0].data.filter((item) => {
      if (uniqueMembers.includes(item.name) || item.name === target) {
        return item;
      }

      return false;
    });

    if(uniqueMembers.length > 0) {
      uniqueMembers.forEach((member) => {
        if(!currentMembers.includes(member)) {
          const results = filterByVnet(options, member, target, [...new Set(currentMembers.concat(uniqueMembers))]);

          filteredData = filteredData.concat(results.data);
          filteredLinks = filteredLinks.concat(results.links);
        }
      });
    }

    return {
      data: [...new Set(filteredData)],
      links: [...new Set(filteredLinks)]
    };
  }

  const onEvents = {
    click: onClick
    // restore: onRestore
  };

  function setDataFocus(target) {
    if(target) {
      let newOptions = cloneDeep(options);

      const zoomedData = filterByVnet(newOptions, target, '', []);

      zoomedData.data = zoomedData.data.map((item) => {
        if(item.name !== target) {
          return {
            ...item,
            label: {
              show: false,
            },
            itemStyle: {
              opacity: 0.5
            },
            emphasis: {
              itemStyle: {
                opacity: 1
              },
              label: {
                show: true
              }
            }
          }
        } else {
          return item;
        }
      });

      newOptions.series[0].data = zoomedData.data;
      newOptions.series[0].links = zoomedData.links;

      eChartsRef.getEchartsInstance().setOption(newOptions);
    } else {
      eChartsRef?.getEchartsInstance().setOption(options);
    }
  }

  function onClick(param, echarts) {
    if (param.data.value > 0) {
      var targetName = '';

      if(param.data.name.includes(vNetPattern)) {
        targetName = param.data.name.substr(param.data.name.indexOf(vNetPattern) + vNetPattern.length, param.data.name.length)
      }

      if(param.data.name.includes(vHubPattern)) {
        targetName = param.data.name.substr(param.data.name.indexOf(vHubPattern) + vHubPattern.length, param.data.name.length)
      }

      const target = {
        id: param.data.name,
        name: targetName
      }

      searchRef.current.setValue(target);
    }
  }

  // function onRestore() {
  //   searchRef.current.clearSearch();
  // }

  function resetView() {
    eChartsRef.getEchartsInstance().dispatchAction({
      type: 'restore'
    });
    searchRef.current.clearSearch();
  }

  return (
    <React.Fragment>
      <Search
        options={options}
        setDataFocus={setDataFocus}
        ref={searchRef}
      />
      <Reset
        resetView={resetView}
      />
      <div
        style={{
          display: "flex",
          height: "100%",
          width: "100%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ReactECharts
          option={options}
          notMerge={true}
          onEvents={onEvents}
          ref={ref}
          style={{ height: "100%", width: "100%" }}
        />
      </div>
    </React.Fragment>
  );
};

export default Peering;
