import React from "react";
import { useSelector } from 'react-redux';

import { concat } from 'lodash';

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
  selectSpaces,
  selectUpdatedVNets,
  selectUpdatedVHubs,
  selectUpdatedEndpoints
} from "../ipam/ipamSlice";

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
  legend: {
    show: false,
    top: '2%',
    left: '3%',
    orient: 'vertical',
    selectedMode: 'multiple',
    data: [],
    borderColor: '#c23531'
  },
  title: {
    show: false,
    text: 'Please Select a Space...',
    left: 'center',
    top: 'center',
    textStyle: {
      color: 'lightgrey',
      // textShadowColor: 'darkgrey',
      // textShadowBlur: 3,
      // textShadowOffsetX: 2,
      // textShadowOffsetY: 2,
      fontSize: 36
    }
  },
  toolbox: {
    show: false,
    top: 35,
    right: 25,
    feature: {
      restore: {}
    }
  },
  tooltip: {
    show: true,
    position: "bottom",
    trigger: 'item',
    triggerOn: 'mousemove',
    formatter: function (d) {
      const dataType = d.value.type;

      var body = null;
      var numUsed = (d.value.used / d.value.size) || 0;
      var percentUsed = Math.ceil(numUsed * 100);
      var usedColor = percentUsed > 90 ? '#FF0000' : percentUsed > 70 ? '#FFA500' : '#008000'
      var usedClass = percentUsed > 50 ? 'gt50' : 'lt50';
      var deg = Math.ceil(90 - (360 * (numUsed)));

      switch(dataType) {
        case 'space':
          body = `
            <div class="data">
              <span style="font-weight: bold">Name:&nbsp;</span>
              ${d.name}
            </div>
            <div class="data">
              <span style="font-weight: bold">Description:&nbsp;</span>
              ${d.value.desc}
            </div>
            <div class="data">
              <span style="font-weight: bold">Size:&nbsp;</span>
              ${d.value.size}
            </div>
            <div class="data">
              <span style="font-weight: bold">Used:&nbsp;</span>
              ${d.value.used}
            </div>
            <div class="footer">
              <pie class="${usedClass}"></pie>
              ${percentUsed}% Utilized
            </div>
          `
          break;
        case 'block':
          body = `
            <div class="data">
              <span style="font-weight: bold">Name:&nbsp;</span>
              ${d.name}
            </div>
            <div class="data">
              <span style="font-weight: bold">CIDR:&nbsp;</span>
              ${d.value.cidr}
            </div>
            <div class="data">
              <span style="font-weight: bold">Size:&nbsp;</span>
              ${d.value.size}
            </div>
            <div class="data">
              <span style="font-weight: bold">Used:&nbsp;</span>
              ${d.value.used}
            </div>
            <div class="footer">
              <pie class="${usedClass}"></pie>
              ${percentUsed}% Utilized
            </div>
          `;
          break;
        case 'vnet':
          body = `
            <div class="data">
              <span style="font-weight: bold">Name:&nbsp;</span>
              ${d.name}
            </div>
            <div class="data">
              <span style="font-weight: bold">Resource Group:&nbsp;</span>
              ${d.value.resourceGroup}
            </div>
            <div class="data">
              <span style="font-weight: bold">Subscription Name:&nbsp;</span>
              ${d.value.subscriptionName}
            </div>
            <div class="data">
              <span style="font-weight: bold">Subscription ID:&nbsp;</span>
              ${d.value.subscriptionId}
            </div>
            <div class="data">
              <span style="font-weight: bold">Prefixes:&nbsp;</span>
              ${d.value.prefixes.join(', ')}
            </div>
            <div class="data">
              <span style="font-weight: bold">Size:&nbsp;</span>
              ${d.value.size}
            </div>
            <div class="data">
              <span style="font-weight: bold">Used:&nbsp;</span>
              ${d.value.used}
            </div>
            <div class="footer">
              <pie class="${usedClass}"></pie>
              ${percentUsed}% Utilized
            </div>
          `;
          break;
          case 'vhub':
            body = `
              <div class="data">
                <span style="font-weight: bold">Name:&nbsp;</span>
                ${d.name}
              </div>
              <div class="data">
                <span style="font-weight: bold">Parent vWAN:&nbsp;</span>
                ${d.value.parentVWan}
              </div>
              <div class="data">
                <span style="font-weight: bold">Resource Group:&nbsp;</span>
                ${d.value.resourceGroup}
              </div>
              <div class="data">
                <span style="font-weight: bold">Subscription Name:&nbsp;</span>
                ${d.value.subscriptionName}
              </div>
              <div class="data">
                <span style="font-weight: bold">Subscription ID:&nbsp;</span>
                ${d.value.subscriptionId}
              </div>
              <div class="data">
                <span style="font-weight: bold">Prefix:&nbsp;</span>
                ${d.value.prefix}
              </div>
              <div class="data">
                <span style="font-weight: bold">Size:&nbsp;</span>
                ${d.value.size}
              </div>
            `;
            break;
        case 'subnet':
          body = `
            <div class="data">
              <span style="font-weight: bold">Name:&nbsp;</span>
              ${d.name}
            </div>
            <div class="data">
              <span style="font-weight: bold">Resource Group:&nbsp;</span>
              ${d.value.resourceGroup}
            </div>
            <div class="data">
              <span style="font-weight: bold">Subscription Name:&nbsp;</span>
              ${d.value.subscriptionName}
            </div>
            <div class="data">
              <span style="font-weight: bold">Subscription ID:&nbsp;</span>
              ${d.value.subscriptionId}
            </div>
            <div class="data">
              <span style="font-weight: bold">Prefix:&nbsp;</span>
              ${d.value.prefix}
            </div>
            <div class="data">
              <span style="font-weight: bold">Size:&nbsp;</span>
              ${d.value.size}
            </div>
            <div class="data">
              <span style="font-weight: bold">Used:&nbsp;</span>
              ${d.value.used - 5}
            </div>
            <div class="footer">
              <pie class="${usedClass}"></pie>
              ${percentUsed}% Utilized
            </div>
          `;
          break;
        case 'endpoint':
          body = `
            <div class="data">
              <span style="font-weight: bold">Name:&nbsp;</span>
              ${d.name}
            </div>
            <div class="data">
              <span style="font-weight: bold">Private IP:&nbsp;</span>
              ${d.value.privateIp}
            </div>
            <div class="data">
              <span style="font-weight: bold">Resource Group:&nbsp;</span>
              ${d.value.resourceGroup}
            </div>
            <div class="data">
              <span style="font-weight: bold">Subscription Name:&nbsp;</span>
              ${d.value.subscriptionName}
            </div>
            <div class="data">
              <span style="font-weight: bold">Subscription ID:&nbsp;</span>
              ${d.value.subscriptionId}
            </div>
          `;
          break;
        default:
          // code block
      }

      const x = `
        <style>
          .wrapper {
            display: flex;
            flex-direction: column;
            font-size: 10px;
            line-height: normal;
          }

          .title {
            display: flex;
            font-weight: bold;
            text-decoration: underline;
            margin: 2px 2px 8px 2px;
          }

          .data {
            display: flex;
            flex-direction: row;
            margin: 1px 2px;
          }

          .footer {
            display: flex;
            flex-direction: row;
            align-items: center;
            margin: 8px 2px 1px 2px;
            font-weight: bold;
            color: ${usedColor};
          }

          pie {
            width: 1.5em;
            height: 1.5em;
            display: block;
            border-radius: 50%;
            background-color: ${usedColor};
            border: 1px solid #696969;
            float: left;
            margin-right: 10px;
          }
          
          .gt50 {
            background-image:
              linear-gradient(90deg, ${usedColor} 50%, transparent 50%),
              linear-gradient(${deg}deg, white 50%, transparent 50%);
          }
        
          .lt50 {
            background-image:
              linear-gradient(${deg}deg, white 50%, transparent 50%),
              linear-gradient(90deg, transparent 50%, white 50%);
          }
        </style>
        <div class="wrapper">
          <div class="title">
            <span>${d.value.type.toUpperCase()}</span>
          </div>
          ${body}
        </div>
      `;

      return x;
    }
  },
  series: []
};

function parseTree(spaces, vnets, vhubs, endpoints) {
  const series = spaces.map((space) => {
    const data = {
      name: space.name,
      value: {
        type: 'space',
        name: space.name,
        desc: space.desc,
        size: space.size,
        used: space.used
      },
      children: space.blocks.map((block) => {
        let vhub_children = block.vnets.reduce((results, vnet) => {
          const target = vhubs.find((x) => x.id === vnet.id);

          if(target) {
            results.push({
              name: target.name,
              value: {
                type: 'vhub',
                name: target.name,
                parentVWan: target.vwan_name,
                resourceGroup: target.resource_group,
                subscriptionId: target.subscription_id,
                subscriptionName: target.subscription_name,
                tentantId: target.tenant_id,
                prefix: target.prefixes.toString(),
                size: target.size
              },
              children: endpoints.filter((endpoint) => {
                return endpoint.vnet_id !== null &&
                  endpoint.vnet_id.toLowerCase() === target.id.toLocaleLowerCase();
              }).map((endpoint) => {
                return {
                  name: endpoint.name,
                  value: {
                    type: 'endpoint',
                    privateIp: endpoint.private_ip,
                    resourceGroup: endpoint.resource_group,
                    subscriptionId: endpoint.subscription_id,
                    subscriptionName: target.subscription_name,
                    tentantId: endpoint.tenant_id
                  }
                };
              }),
            });
          }

          return results;
        }, []);

        let vnet_children = block.vnets.reduce((results, vnet) => {
          const target = vnets.find((x) => x.id === vnet.id);

          if(target) {
            results.push({
              name: target.name,
              value: {
                type: 'vnet',
                name: target.name,
                resourceGroup: target.resource_group,
                subscriptionId: target.subscription_id,
                subscriptionName: target.subscription_name,
                tentantId: target.tenant_id,
                prefixes: target.prefixes,
                size: target.size,
                used: target.used
              },
              children: target.subnets.map((subnet) => {
                const subnetId = `${vnet.id}/subnets/${subnet.name}`;

                return {
                  name: subnet.name,
                  value: {
                    type: 'subnet',
                    name: subnet.name,
                    resourceGroup: target.resource_group,
                    subscriptionId: target.subscription_id,
                    subscriptionName: target.subscription_name,
                    tentantId: target.tenant_id,
                    prefix: subnet.prefix,
                    size: subnet.size,
                    used: subnet.used
                  },
                  children: endpoints.filter((endpoint) => {
                    return endpoint.subnet_id !== null &&
                      endpoint.subnet_id.toLowerCase() === subnetId.toLocaleLowerCase();
                  }).map((endpoint) => {
                    return {
                      name: endpoint.name,
                      value: {
                        type: 'endpoint',
                        privateIp: endpoint.private_ip,
                        resourceGroup: endpoint.resource_group,
                        subscriptionId: endpoint.subscription_id,
                        subscriptionName: target.subscription_name,
                        tentantId: endpoint.tenant_id
                      }
                    };
                  }),
                };
              }),
            });
          }

          return results;
        }, []);

        return {
          name: block.name,
          value: {
            type: 'block',
            name: block.name,
            cidr: block.cidr,
            size: block.size,
            used: block.used
          },
          children: concat(vnet_children, vhub_children)
        };
      }),
    };

    return  {
      type: 'tree',
      name: space.name,
      data: [data],
      top: '1%',
      left: '7%',
      bottom: '1%',
      right: '20%',
      symbolSize: 7,
      initialTreeDepth: 2,
      roam: true,
      label: {
        position: 'top',
        verticalAlign: 'middle',
        align: 'middle',
        fontSize: 9,
        distance: 10
      },
      leaves: {
        label: {
          position: 'right',
          verticalAlign: 'middle',
          align: 'left',
          distance: 5
        }
      },
      emphasis: {
        focus: 'relative',
        itemStyle: {
          color: '#6495ED',
          borderColor: '#6495ED',
          borderWidth: 7
        }
      },
      expandAndCollapse: true,
      animationDuration: 550,
      animationDurationUpdate: 750
    }
  });

  return series;
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

  React.useImperativeHandle(ref, () => ({
    getValue() {
      return value;
    },
    setValue(target) {
      setValue(target);
    },
    clearValue() {
      setInputValue('');
      setValue(null);
    },
    hasValue() {
      return value ? true : false;
    }
  }));

  React.useEffect(() => {
    isEmpty(options) ? setSearchOptions([]) : setSearchOptions(options);
  }, [options]);

  React.useEffect(() => {
    value ? setDataFocus(value) : setDataFocus(null);
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
      getOptionLabel={(option) => option ? option : ''}
      renderInput={(params) => {
        return(
          <TextField
            {...params}
            label="Select Space"
            style={{
              backgroundColor: theme.palette.mode === "dark" ? "black" : "white"
            }}
          />
        );
      }}
      renderOption={(props, option) => {
        return (
          <li {...props} key={option}>
            {option}
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

const Visualize = () => {
  const [options, setOptions] = React.useState(opt);
  const [searchOptions, setSearchOptions] = React.useState([]);
  const [eChartsRef, setEChartsRef] = React.useState(null);

  const searchRef = React.useRef(null);

  const spaces = useSelector(selectSpaces);
  const vnets = useSelector(selectUpdatedVNets);
  const vhubs = useSelector(selectUpdatedVHubs);
  const endpoints = useSelector(selectUpdatedEndpoints);

  const theme = useTheme();

  const ref = React.useCallback(node => {
    if (node !== null) {
      setEChartsRef(node);
    }
  }, []);

  React.useEffect(() => {
    if(spaces && vnets && vhubs && endpoints) {
      var newOptions = cloneDeep(opt);

      delete newOptions.graphic;
      newOptions.darkMode = theme.palette.mode === 'dark' ? true : false;
      newOptions.series = parseTree(spaces, vnets, vhubs, endpoints);
      newOptions.legend.data = newOptions.series.map((option) => {
        return {
          name: option.name,
          icon: 'rectangle'
        }
      });

      setOptions(newOptions);
      setSearchOptions(
        newOptions.series.map((opt) => {
          return opt.name;
        })
      );
    }
  }, [spaces, vnets, vhubs, endpoints, theme]);

  function setDataFocus(target) {
    if(eChartsRef && !isEmpty(options.series)) {
      let newOptions = cloneDeep(options);

      newOptions.title.show = target ? false : true;
      newOptions.legend.selectedMode = target ? 'single' : 'multiple';

      eChartsRef.getEchartsInstance().setOption(newOptions);

      if(!target) {
        eChartsRef.getEchartsInstance().dispatchAction({
          type: 'legendAllSelect'
        });

        eChartsRef.getEchartsInstance().dispatchAction({
          type: 'legendInverseSelect'
        });
      } else {
        eChartsRef.getEchartsInstance().dispatchAction({
          type: 'legendSelect',
          name: target
        });
      }
    }
  }

  function resetView() {
    if(!searchRef.current.hasValue()) {
      setDataFocus(null);
    } else {
      eChartsRef.getEchartsInstance().dispatchAction({
        type: 'restore'
      });
      setDataFocus(searchRef.current.getValue());
    }
  }

  return (
    <React.Fragment>
      <Search
        options={searchOptions}
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
          ref={ref}
          style={{ height: "100%", width: "100%" }}
        />
      </div>
    </React.Fragment>
  );
};

export default Visualize;
