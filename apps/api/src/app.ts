import { Hono } from "hono";
import { cors } from "hono/cors";
import { getCorsOrigins } from "./corsOrigins.js";
import { authRoutes } from "./routes/auth.js";
import { galleryRoutes } from "./routes/gallery.js";
import { sharedRoutes } from "./routes/shared.js";
import { symbolRoutes } from "./routes/symbols.js";
import { vocabularyRoutes } from "./routes/vocabularies.js";

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
  app.route("/symbols", symbolRoutes);
  app.route("/shared", sharedRoutes);
  app.route("/gallery", galleryRoutes);

  app.get("/", (c) => c.text(String(Math.floor(Math.random() * 1_000_000))));

  return app;
}

export default createApp();
