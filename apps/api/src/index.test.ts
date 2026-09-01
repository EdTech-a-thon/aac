import { describe, expect, it, vi } from "vitest";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}));

describe("Vercel entrypoint", () => {
  it("exports the Hono app as the default serverless handler", async () => {
    const entrypoint = await import("./index.ts");

    expect(entrypoint.default).toBeDefined();
    await expect(entrypoint.default.request("/")).resolves.toMatchObject({
      status: 200,
    });
  });
});
