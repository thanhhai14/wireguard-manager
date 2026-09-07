import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { getAdminSession } from "@/lib/auth/session";
import { decryptSecret } from "@/lib/security";
import { getPeerContext } from "@/lib/routeros/peer-service";
import { buildClientConfig } from "@/lib/wireguard/config";

export const runtime = "nodejs";

export async function GET(request: NextRequest, { params }: { params: Promise<{ peerId: string }> }) {
  if (!await getAdminSession()) return NextResponse.json({ error: "Chưa đăng nhập" }, { status: 401 });
  try {
    const context = await getPeerContext((await params).peerId);
    if (!context.peer.privateKey) return NextResponse.json({ error: "Peer import chưa có client private key" }, { status: 409 });
    const endpointHost = context.wg.clientEndpointHost ?? context.router.host;
    const endpointPort = context.wg.clientEndpointPort ?? context.wg.listenPort;
    const serverAddress = context.interfaceCidrs[0]?.split("/")[0];
    const allowedIps = context.peer.mode === "internet"
      ? ["0.0.0.0/0"]
      : context.peer.mode === "internal"
        ? [...(serverAddress ? [`${serverAddress}/32`] : []), ...context.internalCidrs]
        : context.allInternalCidrs;
    if (!allowedIps.length) throw new Error("Chưa có subnet để tạo AllowedIPs");
    const config = buildClientConfig({
      privateKey: decryptSecret(context.peer.privateKey),
      address: context.peer.assignedAddress,
      dns: context.wg.clientDns,
      serverPublicKey: context.wg.publicKey,
      presharedKey: context.peer.presharedKey ? decryptSecret(context.peer.presharedKey) : null,
      endpointHost,
      endpointPort,
      allowedIps,
      persistentKeepalive: context.peer.persistentKeepalive,
    });
    const format = request.nextUrl.searchParams.get("format") ?? "text";
    const headers = { "Cache-Control": "no-store, private" };
    if (format === "qr") {
      const png = await QRCode.toBuffer(config, { errorCorrectionLevel: "M", margin: 2, width: 420 });
      return new NextResponse(new Uint8Array(png), { headers: { ...headers, "Content-Type": "image/png" } });
    }
    const filename = context.peer.name.replace(/[^a-zA-Z0-9_-]+/g, "-") || "wireguard-client";
    return new NextResponse(config, { headers: {
      ...headers,
      "Content-Type": "text/plain; charset=utf-8",
      ...(format === "download" ? { "Content-Disposition": `attachment; filename="${filename}.conf"` } : {}),
    } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Không thể tạo cấu hình" }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
}
