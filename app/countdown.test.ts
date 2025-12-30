import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getModeFromUrl, getTargetDateFromUrl, getCountdownTime } from "./countdown";

describe("getModeFromUrl", () => {
  let originalLocation: Location;

  beforeEach(() => {
    originalLocation = window.location;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 'clock' when no mode parameter is present", () => {
    vi.stubGlobal("location", { search: "" });
    expect(getModeFromUrl()).toBe("clock");
  });

  it("returns 'clock' when mode=clock", () => {
    vi.stubGlobal("location", { search: "?mode=clock" });
    expect(getModeFromUrl()).toBe("clock");
  });

  it("returns 'countdown' when mode=countdown", () => {
    vi.stubGlobal("location", { search: "?mode=countdown" });
    expect(getModeFromUrl()).toBe("countdown");
  });

  it("returns 'clock' for invalid mode values", () => {
    vi.stubGlobal("location", { search: "?mode=invalid" });
    expect(getModeFromUrl()).toBe("clock");
  });

  it("is case-insensitive", () => {
    vi.stubGlobal("location", { search: "?mode=COUNTDOWN" });
    expect(getModeFromUrl()).toBe("countdown");
  });
});

describe("getTargetDateFromUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when no 'to' parameter is present", () => {
    vi.stubGlobal("location", { search: "" });
    expect(getTargetDateFromUrl()).toBeNull();
  });

  it("parses ISO 8601 date correctly", () => {
    vi.stubGlobal("location", { search: "?to=2025-01-01T00:00:00" });
    const result = getTargetDateFromUrl();
    expect(result).not.toBeNull();
    expect(result?.getFullYear()).toBe(2025);
    expect(result?.getMonth()).toBe(0); // January is 0
    expect(result?.getDate()).toBe(1);
    expect(result?.getHours()).toBe(0);
    expect(result?.getMinutes()).toBe(0);
  });

  it("parses ISO 8601 date with timezone", () => {
    vi.stubGlobal("location", { search: "?to=2025-12-31T23:59:00Z" });
    const result = getTargetDateFromUrl();
    expect(result).not.toBeNull();
    // The date object will be in local time, but represents the same moment
    expect(result instanceof Date).toBe(true);
  });

  it("returns null for invalid date strings", () => {
    vi.stubGlobal("location", { search: "?to=not-a-date" });
    expect(getTargetDateFromUrl()).toBeNull();
  });

  it("returns null for empty 'to' parameter", () => {
    vi.stubGlobal("location", { search: "?to=" });
    expect(getTargetDateFromUrl()).toBeNull();
  });
});

describe("getCountdownTime", () => {
  it("returns hours and minutes remaining", () => {
    const now = new Date("2025-01-01T10:00:00");
    const target = new Date("2025-01-01T12:30:00");

    const result = getCountdownTime(target, now);

    expect(result).not.toBeNull();
    expect(result?.hours).toBe(2);
    expect(result?.minutes).toBe(30);
  });

  it("returns 0:0 when countdown has finished (target in past)", () => {
    const now = new Date("2025-01-01T12:00:00");
    const target = new Date("2025-01-01T10:00:00");

    const result = getCountdownTime(target, now);

    expect(result).toEqual({ hours: 0, minutes: 0, finished: true });
  });

  it("returns 0:0 when exactly at target time", () => {
    const now = new Date("2025-01-01T12:00:00");
    const target = new Date("2025-01-01T12:00:00");

    const result = getCountdownTime(target, now);

    expect(result).toEqual({ hours: 0, minutes: 0, finished: true });
  });

  it("caps at 99:59 for countdowns longer than 100 hours", () => {
    const now = new Date("2025-01-01T00:00:00");
    // 200 hours in the future
    const target = new Date(now.getTime() + 200 * 60 * 60 * 1000);

    const result = getCountdownTime(target, now);

    expect(result?.hours).toBe(99);
    expect(result?.minutes).toBe(59);
    expect(result?.finished).toBe(false);
  });

  it("displays hours beyond 24 correctly", () => {
    const now = new Date("2025-01-01T00:00:00");
    // 38 hours in the future
    const target = new Date(now.getTime() + 38 * 60 * 60 * 1000);

    const result = getCountdownTime(target, now);

    expect(result?.hours).toBe(38);
    expect(result?.minutes).toBe(0);
    expect(result?.finished).toBe(false);
  });

  it("rounds down minutes (floors to current minute)", () => {
    const now = new Date("2025-01-01T10:00:00");
    // 2 hours 30 minutes and 45 seconds
    const target = new Date("2025-01-01T12:30:45");

    const result = getCountdownTime(target, now);

    // Should show 2:30, not 2:31
    expect(result?.hours).toBe(2);
    expect(result?.minutes).toBe(30);
  });

  it("handles countdown of less than 1 hour", () => {
    const now = new Date("2025-01-01T10:00:00");
    const target = new Date("2025-01-01T10:45:00");

    const result = getCountdownTime(target, now);

    expect(result?.hours).toBe(0);
    expect(result?.minutes).toBe(45);
  });

  it("handles countdown of less than 1 minute", () => {
    const now = new Date("2025-01-01T10:00:00");
    const target = new Date("2025-01-01T10:00:30");

    const result = getCountdownTime(target, now);

    // Less than a minute shows 0:00
    expect(result?.hours).toBe(0);
    expect(result?.minutes).toBe(0);
    expect(result?.finished).toBe(false); // Not finished yet, just < 1 minute
  });
});
