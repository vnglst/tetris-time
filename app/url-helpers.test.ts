import { describe, it, expect } from "vitest";
import { parseSpeedParam } from "./url-helpers";

describe("parseSpeedParam", () => {
  it("should return default speed when no speed param is present", () => {
    const params = new URLSearchParams("");
    expect(parseSpeedParam(params)).toBe(3);
  });

  it("should return custom default speed when provided", () => {
    const params = new URLSearchParams("");
    expect(parseSpeedParam(params, 5)).toBe(5);
  });

  it("should parse valid speed parameter", () => {
    const params = new URLSearchParams("speed=7");
    expect(parseSpeedParam(params)).toBe(7);
  });

  it("should parse decimal speed parameter", () => {
    const params = new URLSearchParams("speed=2.5");
    expect(parseSpeedParam(params)).toBe(2.5);
  });

  it("should cap speed at maximum value", () => {
    const params = new URLSearchParams("speed=15");
    expect(parseSpeedParam(params)).toBe(10);
  });

  it("should respect custom max speed", () => {
    const params = new URLSearchParams("speed=15");
    expect(parseSpeedParam(params, 3, 5)).toBe(5);
  });

  it("should return default for negative speed", () => {
    const params = new URLSearchParams("speed=-5");
    expect(parseSpeedParam(params)).toBe(3);
  });

  it("should return default for zero speed", () => {
    const params = new URLSearchParams("speed=0");
    expect(parseSpeedParam(params)).toBe(3);
  });

  it("should return default for invalid speed parameter", () => {
    const params = new URLSearchParams("speed=invalid");
    expect(parseSpeedParam(params)).toBe(3);
  });

  it("should return default for empty speed parameter", () => {
    const params = new URLSearchParams("speed=");
    expect(parseSpeedParam(params)).toBe(3);
  });

  it("should handle speed of 1", () => {
    const params = new URLSearchParams("speed=1");
    expect(parseSpeedParam(params)).toBe(1);
  });

  it("should handle speed at exactly max value", () => {
    const params = new URLSearchParams("speed=10");
    expect(parseSpeedParam(params)).toBe(10);
  });
});
