import { describe, expect, it } from "bun:test";
import { ValidationError } from "../errors/domain-error.ts";
import { normalizeHexColor } from "./hex-color.ts";

describe("normalizeHexColor", () => {
  it("devolve a cor em maiúsculas", () => {
    expect(normalizeHexColor("#a1b2c3")).toBe("#A1B2C3");
  });

  it("ignora espaços nas pontas", () => {
    expect(normalizeHexColor(" #A1B2C3 ")).toBe("#A1B2C3");
  });

  it.each(["azul", "#12345", "A1B2C3", "#GGGGGG"])("recusa %p", (value) => {
    expect(() => normalizeHexColor(value)).toThrow(ValidationError);
  });
});