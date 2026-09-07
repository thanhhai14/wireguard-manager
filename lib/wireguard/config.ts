export type ClientConfigInput = {
  privateKey: string;
  address: string;
  dns?: string | null;
  serverPublicKey: string;
  presharedKey?: string | null;
  endpointHost: string;
  endpointPort: number;
  allowedIps: string[];
  persistentKeepalive: number;
};

export function buildClientConfig(input: ClientConfigInput) {
  const lines = [
    "[Interface]",
    `PrivateKey = ${input.privateKey}`,
    `Address = ${input.address}`,
  ];
  if (input.dns) lines.push(`DNS = ${input.dns}`);
  lines.push("", "[Peer]", `PublicKey = ${input.serverPublicKey}`);
  if (input.presharedKey) lines.push(`PresharedKey = ${input.presharedKey}`);
  lines.push(
    `Endpoint = ${input.endpointHost}:${input.endpointPort}`,
    `AllowedIPs = ${input.allowedIps.join(", ")}`,
    `PersistentKeepalive = ${input.persistentKeepalive}`,
  );
  return `${lines.join("\n")}\n`;
}
