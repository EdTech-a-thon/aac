import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCorsOrigins } from "./corsOrigins.ts";
import { authRoutes } from "./routes/auth.ts";
import { vocabularyRoutes } from "./routes/vocabularies.ts";

export function createApp() {
  const app = new Hono();
  const corsOrigins = getCorsOrigins();

  app.use(
    "*",
    cors({
      origin: corsOrigins.length > 0 ? corsOrigins : [],
    }),
  );

  app.route("/auth", authRoutes);
  app.route("/vocabularies", vocabularyRoutes);

  app.get("/", (c) => c.text(String(Math.floor(Math.random() * 1_000_000))));

  return app;
}
