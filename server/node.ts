import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { createApiApp } from "./app.js";

const port = Number(process.env.PORT ?? 8001);
const app = new Hono();

app.route("/api", createApiApp());
app.use("/static/*", serveStatic({ root: "./dist/client" }));
app.get("/", serveStatic({ root: "./dist/client", path: "./index.html" }));
app.get("/assets/:base", serveStatic({ root: "./dist/client", path: "./index.html" }));

serve(
  {
    fetch: app.fetch,
    port
  },
  (info) => {
    console.log(`Serving app at http://localhost:${info.port}`);
  }
);
