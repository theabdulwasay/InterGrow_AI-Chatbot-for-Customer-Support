"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { createRepository, openDatabase } = require("./database");
const { matchFaq } = require("./knowledge-base");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const FRONTEND_ROOT = path.join(PROJECT_ROOT, "frontend");
const DEFAULT_DATABASE = path.join(PROJECT_ROOT, "sql  lite", "intergrow.sqlite");
const MAX_BODY_BYTES = 16 * 1024;
const MAX_MESSAGE_LENGTH = 1000;
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml"
};

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function readJson(request) {
  const contentType = request.headers["content-type"] || "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "Content-Type must be application/json.");
  }

  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
      throw new HttpError(413, "Request body is too large.");
    }
  }
  try {
    return JSON.parse(body);
  } catch {
    throw new HttpError(400, "Request body must contain valid JSON.");
  }
}

function sendJson(response, statusCode, value) {
  const body = JSON.stringify(value);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(body);
}

function serveFrontend(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    throw new HttpError(405, "Method not allowed.");
  }
  const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
  const filePath = path.resolve(FRONTEND_ROOT, relativePath);
  if (!filePath.startsWith(`${FRONTEND_ROOT}${path.sep}`)) {
    throw new HttpError(404, "File not found.");
  }
  let content;
  try {
    content = fs.readFileSync(filePath);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") throw new HttpError(404, "File not found.");
    throw error;
  }
  const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()];
  if (!contentType) throw new HttpError(404, "File not found.");
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": content.length,
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "same-origin"
  });
  response.end(request.method === "HEAD" ? undefined : content);
}

function createServer(options = {}) {
  const database = options.database
    || openDatabase(options.databasePath || process.env.DATABASE_PATH || DEFAULT_DATABASE);
  const repository = options.repository || createRepository(database);

  const server = http.createServer(async (request, response) => {
    try {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      } catch {
        throw new HttpError(400, "Request path is invalid.");
      }
      if (!pathname.startsWith("/api/") && pathname !== "/api") {
        serveFrontend(request, response, pathname);
        return;
      }

      if (request.method === "GET" && pathname === "/api/health") {
        sendJson(response, 200, { status: "ok", service: "intergrow-support", database: "sqlite" });
        return;
      }
      if (request.method === "GET" && pathname === "/api/conversations") {
        sendJson(response, 200, { conversations: repository.listConversations() });
        return;
      }
      if (request.method === "POST" && pathname === "/api/conversations") {
        const conversation = repository.createConversation(crypto.randomUUID());
        sendJson(response, 201, { conversation });
        return;
      }
      if (request.method === "DELETE" && pathname === "/api/conversations") {
        const deleted = repository.clearConversations();
        sendJson(response, 200, { deleted });
        return;
      }

      const conversationMatch = pathname.match(/^\/api\/conversations\/([0-9a-f-]{36})(?:\/messages)?$/i);
      if (conversationMatch) {
        const id = conversationMatch[1];
        const isMessagesRoute = pathname.endsWith("/messages");
        if (request.method === "GET" && !isMessagesRoute) {
          const conversation = repository.getConversation(id);
          if (!conversation) throw new HttpError(404, "Conversation not found.");
          sendJson(response, 200, { conversation });
          return;
        }
        if (request.method === "DELETE" && !isMessagesRoute) {
          if (!repository.deleteConversation(id)) throw new HttpError(404, "Conversation not found.");
          sendJson(response, 200, { deleted: true });
          return;
        }
        if (request.method === "POST" && isMessagesRoute) {
          const body = await readJson(request);
          if (!body || typeof body.message !== "string" || !body.message.trim()) {
            throw new HttpError(400, "A non-empty message is required.");
          }
          const message = body.message.trim();
          if (message.length > MAX_MESSAGE_LENGTH) {
            throw new HttpError(413, `Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
          }
          const conversation = repository.getConversation(id);
          if (!conversation) throw new HttpError(404, "Conversation not found.");
          const reply = matchFaq(message, conversation.lastIntent);
          const updatedConversation = repository.addChatTurn(id, message, reply);
          sendJson(response, 200, { conversation: updatedConversation, reply });
          return;
        }
      }

      throw new HttpError(404, "API route not found.");
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      if (statusCode >= 500) console.error("Request failed:", error);
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      sendJson(response, statusCode, {
        error: statusCode >= 500 ? "An internal server error occurred." : error.message
      });
    }
  });

  server.database = database;
  return server;
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "127.0.0.1";
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("PORT must be an integer between 1 and 65535.");
    process.exitCode = 1;
  } else {
    const server = createServer();
    server.listen(port, host, () => {
      console.log(`InterGrow Support listening at http://${host}:${port}`);
      console.log(`SQLite database: ${process.env.DATABASE_PATH || DEFAULT_DATABASE}`);
    });
    const shutdown = () => server.close(() => {
      server.database.close();
      process.exit(0);
    });
    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  }
}

module.exports = { createServer, HttpError, MAX_BODY_BYTES, MAX_MESSAGE_LENGTH };
