export type RouterOsRecord = Record<string, string> & { _flags?: string };

export function parseRouterOsDetail(output: string): RouterOsRecord[] {
  const logicalLines: string[] = [];
  for (const rawLine of output.replace(/\r/g, "").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("Flags:")) continue;
    if (/^\d+\s/.test(line) || line.startsWith(".id=")) logicalLines.push(line);
    else if (logicalLines.length) logicalLines[logicalLines.length - 1] += ` ${line}`;
  }

  return logicalLines.map((line) => {
    const record: RouterOsRecord = {};
    const firstProperty = line.search(/[.]?[a-zA-Z][\w.-]*=/);
    if (firstProperty > 0) {
      record._flags = line.slice(0, firstProperty).replace(/^\d+\s*/, "").trim();
    }
    const expression = /([.]?[\w-]+)=(?:"((?:\\.|[^"\\])*)"|(\S+))/g;
    for (const match of line.matchAll(expression)) {
      record[match[1]] = match[2] !== undefined
        ? match[2].replace(/\\"/g, '"').replace(/\\\\/g, "\\")
        : match[3];
    }
    return record;
  });
}

export function parseRouterOsDuration(value?: string): Date | null {
  if (!value || value === "never") return null;
  const units: Record<string, number> = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
  let seconds = 0;
  for (const match of value.matchAll(/(\d+)(w|d|h|m|s)/g)) seconds += Number(match[1]) * units[match[2]];
  return seconds ? new Date(Date.now() - seconds * 1000) : null;
}

export function parseRouterOsBytes(value?: string) {
  if (!value) return 0;
  const match = value.match(/^([\d.]+)(KiB|MiB|GiB|TiB|kB|MB|GB|TB|B)?$/i);
  if (!match) return Number(value.replace(/\D/g, "")) || 0;
  const multipliers: Record<string, number> = {
    b: 1, kb: 1000, mb: 1e6, gb: 1e9, tb: 1e12,
    kib: 1024, mib: 1024 ** 2, gib: 1024 ** 3, tib: 1024 ** 4,
  };
  return Math.round(Number(match[1]) * (multipliers[(match[2] ?? "B").toLowerCase()] ?? 1));
}

export function parseRouterOsIntervalSeconds(value?: string, fallback = 0) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return fallback;

  if (/^\d+(?:\.\d+)?$/.test(normalized)) return Math.round(Number(normalized));

  const clock = normalized.match(/^(?:(\d+)w)?(?:(\d+)d)?(?:(\d+):)?(\d{1,2}):(\d{2})$/);
  if (clock) {
    const [, weeks = "0", days = "0", hours = "0", minutes, seconds] = clock;
    return Number(weeks) * 604800 + Number(days) * 86400 + Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
  }

  const parts = [...normalized.matchAll(/(\d+(?:\.\d+)?)(w|d|h|m|s)/g)];
  if (parts.length && parts.map((part) => part[0]).join("") === normalized) {
    const multipliers: Record<string, number> = { w: 604800, d: 86400, h: 3600, m: 60, s: 1 };
    return Math.round(parts.reduce((total, part) => total + Number(part[1]) * multipliers[part[2]], 0));
  }

  return fallback;
}
