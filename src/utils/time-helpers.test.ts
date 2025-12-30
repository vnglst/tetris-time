import { describe, it, expect } from "vitest";
import { formatHHMM, floorToMinute } from "./time-helpers";

describe("formatHHMM", () => {
  it("should format single digit hours and minutes with leading zeros", () => {
    expect(formatHHMM(9, 5)).toBe("09:05");
  });

  it("should format double digit hours and minutes", () => {
    expect(formatHHMM(12, 45)).toBe("12:45");
  });

  it("should format midnight correctly", () => {
    expect(formatHHMM(0, 0)).toBe("00:00");
  });

  it("should format noon correctly", () => {
    expect(formatHHMM(12, 0)).toBe("12:00");
  });

  it("should format end of day correctly", () => {
    expect(formatHHMM(23, 59)).toBe("23:59");
  });

  it("should handle hours greater than 23 for countdown mode", () => {
    expect(formatHHMM(99, 30)).toBe("99:30");
  });

  it("should handle three-digit hours for extended countdown", () => {
    expect(formatHHMM(123, 45)).toBe("123:45");
  });
});

describe("floorToMinute", () => {
  it("should floor date to minute by removing seconds and milliseconds", () => {
    const date = new Date("2025-12-30T14:35:47.123Z");
    const floored = floorToMinute(date);

    expect(floored.getSeconds()).toBe(0);
    expect(floored.getMilliseconds()).toBe(0);
    expect(floored.getMinutes()).toBe(date.getMinutes());
    expect(floored.getHours()).toBe(date.getHours());
  });

  it("should not modify date that is already at minute boundary", () => {
    const date = new Date("2025-12-30T14:35:00.000Z");
    const floored = floorToMinute(date);

    expect(floored.getTime()).toBe(date.getTime());
  });

  it("should create a new Date object without modifying original", () => {
    const date = new Date("2025-12-30T14:35:47.123Z");
    const originalTime = date.getTime();
    const floored = floorToMinute(date);

    expect(date.getTime()).toBe(originalTime);
    expect(floored).not.toBe(date);
  });

  it("should handle date at start of minute (1 second)", () => {
    const date = new Date("2025-12-30T14:35:01.000Z");
    const floored = floorToMinute(date);

    expect(floored.getSeconds()).toBe(0);
    expect(floored.getMinutes()).toBe(35);
  });

  it("should handle date at end of minute (59 seconds)", () => {
    const date = new Date("2025-12-30T14:35:59.999Z");
    const floored = floorToMinute(date);

    expect(floored.getSeconds()).toBe(0);
    expect(floored.getMilliseconds()).toBe(0);
    expect(floored.getMinutes()).toBe(35);
  });
});
