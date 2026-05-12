import { describe, expect, it } from "vitest";
import { RewriteEngine } from "../src/rewrite/rewriteEngine.js";
class FakeDb {
    getAssetLocalPath(url) {
        if (url === "https://cdn.example.com/app.js")
            return "assets/cdn.example.com/app.js";
        return undefined;
    }
}
describe("rewriteHtml", () => {
    it("rewrites known asset URLs", () => {
        const engine = new RewriteEngine(new FakeDb());
        const html = "<html><body><script src=\"https://cdn.example.com/app.js\"></script></body></html>";
        const output = engine.rewriteHtml(html, "https://example.com", "output/index/index.html");
        expect(output).toContain("assets/cdn.example.com/app.js");
    });
});
