import "server-only";
import { createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes } from "node:crypto";

const X25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b656e04220420", "hex");

function rawPublicKey(key: ReturnType<typeof createPublicKey>) {
  const der = key.export({ type: "spki", format: "der" });
  return Buffer.from(der).subarray(-32).toString("base64");
}

export function deriveWireGuardPublicKey(privateKey: string) {
  const raw = Buffer.from(privateKey, "base64");
  if (raw.length !== 32) throw new Error("WireGuard private key phải có 32 byte");
  const key = createPrivateKey({ key: Buffer.concat([X25519_PKCS8_PREFIX, raw]), format: "der", type: "pkcs8" });
  return rawPublicKey(createPublicKey(key));
}

export function generateWireGuardKeys() {
  const pair = generateKeyPairSync("x25519");
  const privateDer = pair.privateKey.export({ type: "pkcs8", format: "der" });
  const privateKey = Buffer.from(privateDer).subarray(-32).toString("base64");
  return {
    privateKey,
    publicKey: rawPublicKey(pair.publicKey),
    presharedKey: randomBytes(32).toString("base64"),
  };
}
