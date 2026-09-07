import "server-only";
import { Client, type ConnectConfig } from "ssh2";

export type RouterConnection = {
  host: string;
  port: number;
  username: string;
  authType: "private_key" | "password";
  secret: string;
  hostKeyFingerprint?: string | null;
};

export type SshResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  fingerprint: string | null;
};

export async function executeSsh(connection: RouterConnection, command: string): Promise<SshResult> {
  return new Promise((resolve, reject) => {
    const client = new Client();
    let fingerprint: string | null = null;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      client.end();
      reject(new Error(normalizeSshError(error.message)));
    };

    const config: ConnectConfig = {
      host: connection.host,
      port: connection.port,
      username: connection.username,
      readyTimeout: 10_000,
      keepaliveInterval: 5_000,
      keepaliveCountMax: 1,
      hostHash: "sha256",
      hostVerifier: (hash: string) => {
        fingerprint = `SHA256:${hash}`;
        return !connection.hostKeyFingerprint || connection.hostKeyFingerprint === fingerprint;
      },
      ...(connection.authType === "private_key"
        ? { privateKey: connection.secret }
        : { password: connection.secret }),
    };

    client.once("ready", () => {
      client.exec(command, (error, stream) => {
        if (error) return fail(error);
        let stdout = "";
        let stderr = "";
        let exitCode: number | null = null;
        stream.on("data", (data: Buffer) => { stdout += data.toString("utf8"); });
        stream.stderr.on("data", (data: Buffer) => { stderr += data.toString("utf8"); });
        stream.on("exit", (code?: number) => { exitCode = code ?? null; });
        stream.once("close", () => {
          if (settled) return;
          settled = true;
          client.end();
          resolve({ stdout, stderr, exitCode, fingerprint });
        });
      });
    });
    client.once("error", fail);
    client.connect(config);
  });
}

function normalizeSshError(message: string) {
  if (/authentication/i.test(message)) return "SSH authentication thất bại";
  if (/host verifier/i.test(message)) return "SSH host fingerprint không khớp";
  if (/timed out/i.test(message)) return "SSH connection timeout";
  if (/ECONNREFUSED/i.test(message)) return "Router từ chối kết nối SSH";
  if (/ENOTFOUND|getaddrinfo/i.test(message)) return "Không phân giải được hostname của router";
  return `Không thể kết nối SSH: ${message}`;
}
