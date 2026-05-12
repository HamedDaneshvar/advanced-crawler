import { describe, expect, it } from "vitest";
import { normalizeUrl } from "../src/utils/url.js";
describe("normalizeUrl", () => {
    it("removes fragments and tracking", () => {
        expect(normalizeUrl("https://example.com/page/?utm_source=x#section", "https://example.com"))
            .toBe("https://example.com/page");
    });
    it("preserves non-tracking parameters", () => {
        expect(normalizeUrl("/page?foo=1&utm_medium=x", "https://example.com"))
            .toBe("https://example.com/page?foo=1");
    });
});
