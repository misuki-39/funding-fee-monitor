import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createApiApp } from "../../server/app.js";

const app = new Hono();
app.route("/api", createApiApp());

export default handle(app);
