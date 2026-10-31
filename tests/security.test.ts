import { describe, expect, it } from "vitest";
import { clientIp, sameOrigin } from "../src/lib/security";

const req = (h: Record<string, string>) => new Request("http://x.test/api/approve", { method: "POST", headers: h });

describe("clientIp", () => {
  it("prefers x-vercel-forwarded-for, then x-real-ip, then first x-forwarded-for", () => {
    expect(clientIp(req({ "x-vercel-forwarded-for": "1.1.1.1", "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }))).toBe("1.1.1.1");
    expect(clientIp(req({ "x-real-ip": "2.2.2.2", "x-forwarded-for": "3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(req({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientIp(req({}))).toBe("local");
  });
});

describe("sameOrigin", () => {
  it("allows missing or matching Origin, rejects others", () => {
    expect(sameOrigin(req({ host: "app.test" }))).toBe(true);
    expect(sameOrigin(req({ host: "app.test", origin: "https://app.test" }))).toBe(true);
    expect(sameOrigin(req({ host: "app.test", origin: "https://evil.test" }))).toBe(false);
    expect(sameOrigin(req({ host: "app.test", origin: "null" }))).toBe(false);
  });
});
