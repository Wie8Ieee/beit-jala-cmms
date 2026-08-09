import express, { type Express, type Request, type Response, type NextFunction } from "express";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import ConnectPgSimple from "connect-pg-simple";
import { pool } from "@workspace/db";
import router from "./routes/index.js";
import { logger } from "./lib/logger.js";

const app: Express = express();
const isProduction = process.env.NODE_ENV === "production";
const useSecureCookies = process.env.COOKIE_SECURE === "true";

if (process.env.TRUST_PROXY === "true") app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

const PgSession = ConnectPgSimple(session);
app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "sessions",
    }),
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: useSecureCookies,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      sameSite: "lax",
    },
  }),
);

app.use("/api", router);

// In production the API also serves the compiled React application. Keeping
// both behind one internal port avoids a development server and makes session
// cookies and concurrent access considerably more reliable.
if (isProduction) {
  const apiDirectory = path.dirname(fileURLToPath(import.meta.url));
  const webDirectory = path.resolve(apiDirectory, "../../cmms/dist/public");
  const indexFile = path.join(webDirectory, "index.html");

  if (!existsSync(indexFile)) {
    logger.warn({ webDirectory }, "Compiled web application was not found");
  } else {
    app.use(express.static(webDirectory, { index: false, maxAge: "1h" }));
    app.use((req, res, next) => {
      if (req.method !== "GET" || req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(indexFile);
    });
  }
}

// ── Centralized error handler ─────────────────────────────────────────────────
// Must have 4 arguments so Express recognises it as an error handler.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const log = (req as unknown as { log?: typeof logger }).log ?? logger;

  if (err instanceof SyntaxError && "body" in err) {
    res.status(400).json({ error: "Malformed JSON body" });
    return;
  }

  log.error({ err }, "Unhandled error");
  const message =
    err instanceof Error ? err.message : "Internal server error";
  const status =
    typeof err === "object" && err !== null && "status" in err &&
    typeof (err as { status: unknown }).status === "number"
      ? (err as { status: number }).status
      : 500;
  res.status(status).json({ error: message });
});

export default app;
