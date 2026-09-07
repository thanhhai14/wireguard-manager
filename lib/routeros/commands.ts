export type PeerCommandInput = {
  interfaceName: string;
  publicKey: string;
  presharedKey?: string | null;
  assignedAddress: string;
  remoteSubnets?: string[];
  persistentKeepalive: number;
  disabled: boolean;
  comment: string;
  remoteEndpointHost?: string | null;
  remoteEndpointPort?: number | null;
};

export function routerOsQuote(value: string) {
  if (/[\r\n\0]/.test(value)) throw new Error("Giá trị RouterOS không được chứa ký tự điều khiển");
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function peerProperties(input: PeerCommandInput) {
  const allowed = [input.assignedAddress, ...(input.remoteSubnets ?? [])].join(",");
  const properties = [
    `interface=${routerOsQuote(input.interfaceName)}`,
    `public-key=${routerOsQuote(input.publicKey)}`,
    `allowed-address=${allowed}`,
    `persistent-keepalive=${input.persistentKeepalive}s`,
    `disabled=${input.disabled ? "yes" : "no"}`,
    `comment=${routerOsQuote(input.comment)}`,
  ];
  if (input.presharedKey) properties.push(`preshared-key=${routerOsQuote(input.presharedKey)}`);
  if (input.remoteEndpointHost) properties.push(`endpoint-address=${routerOsQuote(input.remoteEndpointHost)}`);
  if (input.remoteEndpointPort) properties.push(`endpoint-port=${input.remoteEndpointPort}`);
  return properties.join(" ");
}

export function buildAddPeerCommand(input: PeerCommandInput) {
  return `/interface/wireguard/peers/add ${peerProperties(input)}`;
}

export function buildSetPeerCommand(currentPublicKey: string, input: PeerCommandInput) {
  return `/interface/wireguard/peers/set [find where public-key=${routerOsQuote(currentPublicKey)}] ${peerProperties(input)}`;
}

export function buildRemovePeerCommand(publicKey: string) {
  return `/interface/wireguard/peers/remove [find where public-key=${routerOsQuote(publicKey)}]`;
}

export const ROUTER_INFO_COMMAND = "/system/resource/print without-paging";
export const INTERFACES_COMMAND = "/interface/wireguard/print detail without-paging";
export const PEERS_COMMAND = "/interface/wireguard/peers/print detail without-paging";
export const ADDRESSES_COMMAND = "/ip/address/print detail without-paging";
