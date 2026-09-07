import "server-only";
import { executeSsh, type RouterConnection } from "./ssh";
import { ADDRESSES_COMMAND, INTERFACES_COMMAND, PEERS_COMMAND, ROUTER_INFO_COMMAND } from "./commands";
import { parseRouterOsDetail } from "./parser";

async function run(connection: RouterConnection, command: string) {
  const result = await executeSsh(connection, command);
  if (result.exitCode && result.exitCode !== 0) throw new Error(result.stderr.trim() || "RouterOS command thất bại");
  if (result.stderr.trim()) throw new Error(result.stderr.trim());
  return result;
}

export async function inspectRouter(connection: RouterConnection) {
  const result = await run(connection, ROUTER_INFO_COMMAND);
  const values = Object.fromEntries(result.stdout.split(/\r?\n/).flatMap((line) => {
    const index = line.indexOf(":");
    return index > -1 ? [[line.slice(0, index).trim(), line.slice(index + 1).trim()]] : [];
  }));
  return { version: values.version ?? "Không xác định", fingerprint: result.fingerprint };
}

export async function readRouterConfiguration(connection: RouterConnection) {
  const [interfaces, addresses, peers] = await Promise.all([
    run(connection, INTERFACES_COMMAND),
    run(connection, ADDRESSES_COMMAND),
    run(connection, PEERS_COMMAND),
  ]);
  return {
    interfaces: parseRouterOsDetail(interfaces.stdout),
    addresses: parseRouterOsDetail(addresses.stdout),
    peers: parseRouterOsDetail(peers.stdout),
    fingerprint: interfaces.fingerprint,
  };
}

export async function runRouterCommand(connection: RouterConnection, command: string) {
  return run(connection, command);
}
