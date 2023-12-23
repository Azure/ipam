function allowedOctets() {
  return [128, 64, 32, 16, 8, 4, 2, 1, 128, 64, 32, 16];
}

function ip2Integer(ip) {
  return ip.split('.').reduce((ipInt, octet) => (ipInt << 8) + parseInt(octet, 10), 0) >>> 0;
}

function probabalCombinations(arr, addressBytes, position) {
  var res = [];

  for (var i = 0; i < Math.pow(2, arr.length); i++) {
    var bin = (i).toString(2);
    var set = [];

    bin = new Array((arr.length - bin.length) + 1).join("0") + bin;

    for (var j = 0; j < bin.length; j++) {
      if (bin[j] === "1") {
        set.push(arr[j]);
      }
    }

    try {
      var sum = set.reduce((a, b) => a + b);
      res.push(sum);
    } catch(e) {
      continue;
    }
  }

  res = res.filter(n => n >= addressBytes[position]);

  if(arr.indexOf(0) !== -1) {
    res.push(0);
  }

  res = [...new Set(res)];

  return res;
}

function getIpRangeForSubnet(subnetCIDR) {
  var address = subnetCIDR.split('/')[0].split('.');
  var netmask = parseInt(subnetCIDR.split('/')[1], 10);
  var allowed = allowedOctets();
  var pos = Math.ceil(netmask / 8) - 1;
  var endAddress = [...address];

  endAddress[pos] = parseInt(endAddress[pos], 10) + ((!allowed[(netmask % 8) - 1]) ? 0 : allowed[(netmask % 8) - 1] - 1);

  if(pos === 0 && endAddress[1] < 255) {
    endAddress[1] = 255;
    endAddress[2] = 255;
    endAddress[3] = 255;
  }

  if(pos === 1 && endAddress[2] < 255) {
    endAddress[2] = 255;
    endAddress[3] = 255;
  }

  if(pos === 2 && endAddress[3] < 255) {
    endAddress[3] = 255;
  }

  return {
    start: address.join('.'),
    end: endAddress.join('.')
  };
}

export function isSubnetOf(childCIDR, parentCIDR) {
  const parentRange = getIpRangeForSubnet(parentCIDR);
  const childRange = getIpRangeForSubnet(childCIDR);

  const parentStart = ip2Integer(parentRange.start);
  const parentEnd = ip2Integer(parentRange.end);

  const childStart = ip2Integer(childRange.start);
  const childEnd = ip2Integer(childRange.end);

  const isSubnet = (parentStart <= childStart) && (parentEnd >= childEnd);

  return isSubnet;
}

export function isSubnetOverlap(subnetCIDR, existingSubnetCIDR) {
  var ipRangeforCurrent = getIpRangeForSubnet(subnetCIDR);

  var isOverlap = existingSubnetCIDR.map(subnet => {
    var ipRange = getIpRangeForSubnet(subnet);

    if((ip2Integer(ipRangeforCurrent.start) >= ip2Integer(ipRange.start) && ip2Integer(ipRangeforCurrent.start) <= ip2Integer(ipRange.end)) || (ip2Integer(ipRangeforCurrent.end) >= ip2Integer(ipRange.start) && ip2Integer(ipRangeforCurrent.end) <= ip2Integer(ipRange.end)) ||  (ip2Integer(ipRange.start) >= ip2Integer(ipRangeforCurrent.start) && ip2Integer(ipRange.start) <= ip2Integer(ipRangeforCurrent.end)) || (ip2Integer(ipRange.end) >= ip2Integer(ipRangeforCurrent.start) && ip2Integer(ipRange.end) <= ip2Integer(ipRangeforCurrent.end))) {
      return true;
    }

    return false;
  }).some(item => item === true);

  return isOverlap;
}

function possibleSubnets(obj, index, existingSubnetCIDR) {
  var sliceTo = ((index % 8) === 0) ? 8 : (index % 8);
  var filteredOctets = [];
  var pos = Math.ceil(index / 8) - 1;
  var subnets = [];
  var subnetsExcluded = [];
  var allowed = allowedOctets();
  var addressBytes = obj.address.split('.', 4).map(num => parseInt(num, 10));

  if((obj.netmask % 8 === 0) && (index % 8 === 0) && (index === obj.netmask)) {
    filteredOctets.push(addressBytes[pos]);
  } else if((obj.netmask % 8) <= sliceTo && index <= 24) {
    filteredOctets = allowed.slice((obj.netmask % 8), sliceTo);
    filteredOctets.push(addressBytes[2]);
  } else if(index >= 24 && addressBytes[2] === 0) {
    filteredOctets = allowed.slice((obj.netmask % 8), sliceTo);
    filteredOctets.push(addressBytes[3]);
  } else if(index >= 24 && addressBytes[3] === 0) {
    filteredOctets = allowed.slice(0, sliceTo);
    filteredOctets.push(addressBytes[3]);
  } else {
    let newArr = addressBytes[pos].toString(2).padStart(8, '0').substring(0, (obj.netmask % 8)).padEnd(8, '1').split('');

    filteredOctets = allowed.slice(0, sliceTo).filter((d, ind) => newArr[ind] === '1');
  }

  var allowedCombinations = probabalCombinations(filteredOctets, addressBytes, pos);

  allowedCombinations.forEach(function(octet) {
    let range = (index >= 25 & obj.netmask < 24) ? {
      from: addressBytes[2],
      to: addressBytes[2] + ((allowed[(obj.netmask % 8) - 1] === undefined) ? 256 : allowed[(obj.netmask % 8) - 1]) - 1
    } : {
      from: addressBytes[2],
      to: addressBytes[2]
    }

    for (let i = range.from; i <= range.to; i++) {
      var subnetBytes = [...addressBytes];

      subnetBytes[2] = i;
      subnetBytes[pos] = octet;

      var subnetObject = {
        network: subnetBytes.join('.'),
        mask: index,
        cidr: subnetBytes.join('.') + '/' + index,
        ipRange: getIpRangeForSubnet(subnetBytes.join('.') + '/' + index)
      };

      var doesOverlap = isSubnetOverlap(subnetObject.cidr, existingSubnetCIDR);

      if(!doesOverlap) {
        subnetObject.overlap = false;
        subnets.push(subnetObject);
      } else {
        subnetObject.overlap = true;
        subnets.push(subnetObject);
        subnetsExcluded.push(subnetObject.cidr);
      }
    }
  });

  return {
    subnets: subnets,
    subnetsExcluded: subnetsExcluded
  };
}

export function availableSubnets(obj, existingSubnetCIDR) {
  var subnetsObj = {
    subnets: [],
    subnetsExcluded: []
  };

  var startIndex = obj.netmaskRange.min;

  for(var i = startIndex; i <= obj.netmaskRange.max; i++) {
    var res = possibleSubnets(obj, i, existingSubnetCIDR);

    subnetsObj.subnets = [...subnetsObj.subnets, ...res.subnets];
    subnetsObj.subnetsExcluded = [...subnetsObj.subnetsExcluded, ...res.subnetsExcluded];
  }

  subnetsObj.subnets = subnetsObj.subnets.sort((a, b) => {
    let netA = ip2Integer(a.network);
    let netB = ip2Integer(b.network);

    if (a.mask < b.mask)
      return -1
    else if (a.mask > b.mask)
      return 1
    else if (a.mask === b.mask)
      if (netA > netB)
        return 1
      else
        return -1

    return 0;
  });

  return subnetsObj;
}
