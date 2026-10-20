import { describe, expect, it } from "bun:test";
import { BusinessRuleError, ValidationError } from "../errors/domain-error.ts";
import { addId, normalizeIds, removeId } from "./ids.ts";

describe("normalizeIds", () => {
  it("tira os repetidos e mantém a ordem", () => {
    expect(normalizeIds([3, 1, 3, 2], "Artist")).toEqual([3, 1, 2]);
  });

  it.each([0, -1, 1.5, Number.NaN])("recusa o id %p", (id) => {
    expect(() => normalizeIds([id], "Artist")).toThrow(ValidationError);
  });
});

describe("addId / removeId", () => {
  it("acrescenta e remove sem mexer na lista original", () => {
    const ids = [1, 2];
    expect(addId(ids, 3, "Genre")).toEqual([1, 2, 3]);
    expect(removeId(ids, 1, "Genre")).toEqual([2]);
    expect(ids).toEqual([1, 2]);
  });

  it("recusa id repetido e id ausente", () => {
    expect(() => addId([1], 1, "Genre")).toThrow(BusinessRuleError);
    expect(() => removeId([1], 2, "Genre")).toThrow(BusinessRuleError);
  });
});
