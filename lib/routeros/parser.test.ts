import { describe, expect, it } from "vitest";
import { parseRouterOsBytes, parseRouterOsDetail, parseRouterOsDuration, parseRouterOsIntervalSeconds } from "./parser";

describe("RouterOS output parser", () => {
  it("joins wrapped detail records and preserves flags", () => {
    const records = parseRouterOsDetail(`
Flags: X - disabled; R - running
 0  R name="wg-office" mtu=1420 listen-port=13231
      public-key="server-public-key="
 1  X name="wg-backup" mtu=1380 listen-port=13232 public-key="backup="
`);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({ name: "wg-office", mtu: "1420", "public-key": "server-public-key=", _flags: "R" });
    expect(records[1]._flags).toBe("X");
  });

  it("parses duration and traffic values", () => {
    const before = Date.now();
    const parsed = parseRouterOsDuration("1m30s");
    expect(parsed?.getTime()).toBeLessThanOrEqual(before - 89_000);
    expect(parseRouterOsBytes("1.5MiB")).toBe(1_572_864);
  });

  it("parses RouterOS interval formats without producing NaN", () => {
    expect(parseRouterOsIntervalSeconds("25s", 25)).toBe(25);
    expect(parseRouterOsIntervalSeconds("00:00:25", 25)).toBe(25);
    expect(parseRouterOsIntervalSeconds("1d02:03:04", 25)).toBe(93_784);
    expect(parseRouterOsIntervalSeconds("1m30s", 25)).toBe(90);
    expect(parseRouterOsIntervalSeconds("unexpected", 25)).toBe(25);
  });
});
