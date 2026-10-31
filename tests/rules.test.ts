import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { iso6346Ok, normName, run, score } from "../src/lib/rules";

const load = (n: string) => JSON.parse(readFileSync(`data/samples/${n}.json`, "utf8"));

describe("sample sets", () => {
  for (const n of ["set1_clean", "set2_container", "set3_errors", "set4_injection"]) {
    it(`${n} yields exactly the expected findings`, () => {
      const s = load(n);
      expect(new Set(run(s.docs).map((f) => f.id))).toEqual(new Set(s.expected));
    });
  }
});
describe("helpers", () => {
  it("validates ISO 6346", () => {
    expect(iso6346Ok("CSQU3054383")).toBe(true);
    expect(iso6346Ok("CSQU3054384")).toBe(false);
    expect(iso6346Ok("nonsense")).toBe(false);
  });
  it("ignores company suffixes", () => {
    expect(normName("Kilindini Trading Co. Ltd")).toBe(normName("KILINDINI TRADING COMPANY LIMITED"));
  });
  it("verdicts", () => {
    expect(score([]).verdict).toBe("GO");
    expect(score(run(load("set3_errors").docs)).verdict).toBe("NO_GO");
  });
});
