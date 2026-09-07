const PRIVATE_RANGES: Array<[number, number]> = [
  [ipToNumber("10.0.0.0"), ipToNumber("10.255.255.255")],
  [ipToNumber("172.16.0.0"), ipToNumber("172.31.255.255")],
  [ipToNumber("192.168.0.0"), ipToNumber("192.168.255.255")],
];

export function ipToNumber(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) throw new Error("IPv4 không hợp lệ");
  return parts.reduce((value, part) => {
    if (!/^\d+$/.test(part)) throw new Error("IPv4 không hợp lệ");
    const octet = Number(part);
    if (octet < 0 || octet > 255) throw new Error("IPv4 không hợp lệ");
    return ((value << 8) | octet) >>> 0;
  }, 0);
}

export function numberToIp(value: number) {
  return [24, 16, 8, 0].map((shift) => (value >>> shift) & 255).join(".");
}

export function parseCidr(cidr: string) {
  const [ip, rawPrefix, ...rest] = cidr.trim().split("/");
  if (rest.length || rawPrefix === undefined || !/^\d+$/.test(rawPrefix)) throw new Error("CIDR không hợp lệ");
  const prefix = Number(rawPrefix);
  if (prefix < 0 || prefix > 32) throw new Error("CIDR IPv4 phải có prefix từ 0 đến 32");
  const address = ipToNumber(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  const network = (address & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { ip, prefix, address, network, broadcast, normalized: `${numberToIp(network)}/${prefix}` };
}

export function isPrivateCidr(cidr: string) {
  const parsed = parseCidr(cidr);
  return PRIVATE_RANGES.some(([start, end]) => parsed.network >= start && parsed.broadcast <= end);
}

export function cidrsOverlap(first: string, second: string) {
  const a = parseCidr(first);
  const b = parseCidr(second);
  return a.network <= b.broadcast && b.network <= a.broadcast;
}

export function isUsableHostInCidr(ipCidr: string, allocationCidr: string) {
  const host = parseCidr(ipCidr);
  const pool = parseCidr(allocationCidr);
  return host.prefix === 32 && host.address > pool.network && host.address < pool.broadcast;
}

export function nextAvailableIp(cidr: string, used: string[], start?: string | null, end?: string | null) {
  const pool = parseCidr(cidr);
  const lower = start ? ipToNumber(start) : pool.network + 1;
  const upper = end ? ipToNumber(end) : pool.broadcast - 1;
  const occupied = new Set(used.map((value) => parseCidr(value).address));
  for (let value = lower; value <= upper; value += 1) {
    if (!occupied.has(value)) return `${numberToIp(value)}/32`;
  }
  throw new Error("Dãy cấp phát không còn địa chỉ trống");
}
