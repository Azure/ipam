function int2ip (ipInt) {
  return ((ipInt >>> 24) + '.' + ((ipInt >> 16) & 255) + '.' + ((ipInt >> 8) & 255) + '.' + (ipInt & 255));
}

function ip2int(ip) {
  return ip.split('.').reduce((ipInt, octet) => (ipInt << 8) + parseInt(octet, 10), 0) >>> 0;
}

function getIpRangeForSubnet(cidr) {
  // Split CIDR into Network & Mask
  var cidrParts = cidr.split('/');
  // Get Address as a 32-bit Unsigned Integer
  var addr32 = ip2int(cidrParts[0]);
  // Create Bitmask Representing Subnet
  var mask = ((~0 << (32 - +cidrParts[1])) >>> 0);

  // Apply Bitmask to 32-bit Addresses
  var results = {
    start: int2ip((addr32 & mask) >>> 0),
    end: int2ip((addr32 | ~mask) >>> 0)
  };

  return results;
}

export function isSubnetOverlap(subnetCIDR, existingSubnetCIDR) {
  var ipRangeforCurrent = getIpRangeForSubnet(subnetCIDR);

  var isOverlap = existingSubnetCIDR.map(subnet => {
    var ipRange = getIpRangeForSubnet(subnet);

    if((ip2int(ipRangeforCurrent.start) >= ip2int(ipRange.start) && ip2int(ipRangeforCurrent.start) <= ip2int(ipRange.end)) || (ip2int(ipRangeforCurrent.end) >= ip2int(ipRange.start) && ip2int(ipRangeforCurrent.end) <= ip2int(ipRange.end)) ||  (ip2int(ipRange.start) >= ip2int(ipRangeforCurrent.start) && ip2int(ipRange.start) <= ip2int(ipRangeforCurrent.end)) || (ip2int(ipRange.end) >= ip2int(ipRangeforCurrent.start) && ip2int(ipRange.end) <= ip2int(ipRangeforCurrent.end))) {
      return true;
    }

    return false;
  }).some(item => item === true);

  return isOverlap;
}

export function isSubnetOf(childCIDR, parentCIDR) {
  const parentRange = getIpRangeForSubnet(parentCIDR);
  const childRange = getIpRangeForSubnet(childCIDR);

  const parentStart = ip2int(parentRange.start);
  const parentEnd = ip2int(parentRange.end);

  const childStart = ip2int(childRange.start);
  const childEnd = ip2int(childRange.end);

  const isSubnet = (parentStart <= childStart) && (parentEnd >= childEnd);

  return isSubnet;
}

function findSubnets(targetCidr, targetMask, existingSubnets) {
  var address = targetCidr.split('/')[0];
  var currentMask = parseInt(targetCidr.split('/')[1], 10);
  var addressBytes = address.split('.');
  var pos = Math.floor(currentMask / 8)
  var posInt = parseInt(addressBytes[pos], 10);
  var max = Math.pow(2, 8 - (currentMask % 8));
  var step = max / 2;

  var results = [];

  for (var i = posInt; i < (max + posInt); i += step) {
    addressBytes[pos] = i;

    var newNetwork = addressBytes.join('.');
    var newMask = (currentMask + 1);
    var newCidr = newNetwork + '/' + newMask;

    var newAddress = {
      cidr: newCidr,
      network: newNetwork,
      mask: newMask,
      overlap: isSubnetOverlap(newCidr, existingSubnets)
    };

    results.push(newAddress);

    if((currentMask + 1) < targetMask) {
      results = results.concat(findSubnets(newAddress.cidr, targetMask, existingSubnets));
    }
  }

  return results;
}

export function availableSubnets(targetCidr, targetMask, existingSubnets) {
  var cidrNetwork = targetCidr.split('/')[0];
  var cidrMask = parseInt(targetCidr.split('/')[1], 10);

  var subnets = [];

  if (targetMask >= cidrMask) {
    subnets.push(
      {
        cidr: targetCidr,
        network: cidrNetwork,
        mask: cidrMask,
        overlap: isSubnetOverlap(targetCidr, existingSubnets)
      }
    );
  }

  if (targetMask > cidrMask) {
    subnets = subnets.concat(findSubnets(targetCidr, targetMask, existingSubnets));
  }

  return subnets.sort((a, b) => {
    let netA = ip2int(a.network);
    let netB = ip2int(b.network);

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
}
