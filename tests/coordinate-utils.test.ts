import { test, expect } from "bun:test";
import { coerceCoordinates } from "../src/tools/coordinate-utils.js";

test("coerceCoordinates returns numeric values for numeric strings", () => {
  const result = coerceCoordinates(
    "10" as unknown as number,
    "64.5" as unknown as number,
    "-3" as unknown as number,
  );

  expect(result).toStrictEqual({ x: 10, y: 64.5, z: -3 });
});

test("coerceCoordinates throws when any coordinate is not a finite number", () => {
  expect(() => coerceCoordinates(Number.NaN, 1, 2)).toThrow(
    new Error("x, y, and z must be valid numbers"),
  );
  expect(() => coerceCoordinates(1, Number.POSITIVE_INFINITY, 2)).toThrow(
    new Error("x, y, and z must be valid numbers"),
  );
  expect(() => coerceCoordinates(1, 2, Number.NEGATIVE_INFINITY)).toThrow(
    new Error("x, y, and z must be valid numbers"),
  );
});
