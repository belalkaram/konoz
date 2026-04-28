import { randomBytes } from "crypto";
import express, { type Express, type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME, getCsrfToken } from "./lib/sessions.js";

const COOKIE_SECRET = process.env.COOKIE_SECRET ?? randomBytes(32).toString("hex");

const app: Express = express();

app.set("trust proxy", 1);

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
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    hsts: process.env.NODE_ENV === "production"
      ? { maxAge: 31536000, includeSubDomains: true }
      : false,
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { keyGeneratorIpFallback: false, xForwardedForHeader: false },
  keyGenerator: (req) => {
    const username = (req.body as Record<string, unknown>)?.username;
    const ip = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ?? req.ip ?? "unknown";
    return `${ip}:${typeof username === "string" ? username.toLowerCase().trim() : ""}`;
  },
  handler: (req, res) => {
    logger.warn({ event: "security:rate_limit", ip: req.ip, route: req.path }, "Login rate limit exceeded");
    res.status(429).json({ error: "too_many_requests", message: "Too many login attempts. Please try again later." });
  },
});

const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ event: "security:rate_limit", ip: req.ip, route: req.path }, "API rate limit exceeded");
    res.status(429).json({ error: "too_many_requests", message: "Too many requests. Please slow down." });
  },
});

const writeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn({ event: "security:rate_limit", ip: req.ip, route: req.path }, "Write rate limit exceeded");
    res.status(429).json({ error: "too_many_requests", message: "Too many write requests. Please slow down." });
  },
});

app.use(cors({ credentials: true, origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser(COOKIE_SECRET));

const BLOCKED_PATHS = /\.(env|json|lock|map|ts|mjs|cjs|toml|yaml|yml|log)$/i;

app.use("/api", (req, res, next) => {
  if (BLOCKED_PATHS.test(req.path) && req.path !== "/api/health") {
    res.status(404).json({ error: "not_found", message: "Not found" });
    return;
  }
  next();
});

app.use("/api/auth", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.post("/api/auth/login", loginLimiter);

app.use("/api", generalLimiter);

const CSRF_EXEMPT = new Set(["/api/auth/login"]);

app.use((req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    return next();
  }
  if (CSRF_EXEMPT.has(req.path)) {
    return next();
  }
  const sessionToken = req.signedCookies?.[SESSION_COOKIE_NAME] as string | undefined | false;
  if (!sessionToken) {
    return next();
  }
  const expectedCsrf = getCsrfToken(sessionToken);
  if (!expectedCsrf) {
    return next();
  }
  const headerToken = req.headers["x-csrf-token"];
  if (typeof headerToken !== "string" || headerToken !== expectedCsrf) {
    req.log?.warn({ event: "security:csrf_mismatch", ip: req.ip, route: req.path }, "CSRF token mismatch");
    res.status(403).json({ error: "csrf_error", message: "Invalid or missing CSRF token" });
    return;
  }
  next();
});

app.use((req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method) && req.path !== "/api/auth/login") {
    writeLimiter(req, res, next);
  } else {
    next();
  }
});

app.use("/api", router);

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const log = (req as Request & { log?: typeof logger }).log ?? logger;
  log.error({ err, route: req.path, method: req.method }, "Unhandled error");

  if (res.headersSent) return;

  const isProduction = process.env.NODE_ENV === "production";

  if (err && typeof err === "object" && "status" in err && typeof (err as { status: unknown }).status === "number") {
    const typed = err as { status: number; message?: string; error?: string };
    res.status(typed.status).json({
      error: typed.error ?? "request_error",
      message: isProduction ? typed.message ?? "Request error" : typed.message ?? "Request error",
    });
    return;
  }

  res.status(500).json({
    error: "internal_error",
    message: "An unexpected error occurred",
  });
});

export default app;
