import { describe, expect, it } from "vitest";

import { Route as CompareRoute } from "@/routes/confronto";
import { Route as EroticCompareRoute } from "@/routes/confronto_.erotismo";

type Validator = { parse: (input: unknown) => unknown };

describe("comparison pages opened without a contact", () => {
  for (const [name, route] of [
    ["/confronto", CompareRoute],
    ["/confronto/erotismo", EroticCompareRoute],
  ] as const) {
    it(`${name} accepts an address without ?b= instead of failing`, () => {
      const schema = route.options.validateSearch as unknown as Validator;
      expect(() => schema.parse({})).not.toThrow();
      expect(schema.parse({ b: "luna🦊🌊⭐" })).toEqual({ b: "luna🦊🌊⭐" });
    });
  }
});
