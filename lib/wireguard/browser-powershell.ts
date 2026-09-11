export async function buildCompressedPowerShellCommand(script: string) {
  const compressedStream = new Blob([script])
    .stream()
    .pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(compressedStream).arrayBuffer());
  let binary = "";

  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }

  const encoded = btoa(binary);
  return `$b='${encoded}';$m=[IO.MemoryStream]::new([Convert]::FromBase64String($b));$g=[IO.Compression.GzipStream]::new($m,[IO.Compression.CompressionMode]::Decompress);$r=[IO.StreamReader]::new($g,[Text.Encoding]::UTF8);& ([ScriptBlock]::Create($r.ReadToEnd()))`;
}
