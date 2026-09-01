import { describe, expect, it, vi } from "vitest";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}));

describe("Vercel entrypoint", () => {
  it.each(["./app.js", "./index.js"])(
    "%s exports the Hono app as the default serverless handler",
    async (modulePath) => {
      const entrypoint = await import(modulePath);

      expect(entrypoint.default).toBeDefined();
      await expect(entrypoint.default.request("/")).resolves.toMatchObject({
        status: 200,
      });
    },
  );
});
