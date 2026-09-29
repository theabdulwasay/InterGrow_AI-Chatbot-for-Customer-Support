# InterGrow support backend

This project uses Node.js' built-in HTTP server and SQLite support. It has no
third-party npm dependencies. Use Node.js 22.13 or newer.

## Start the app

From the project root:

```sh
npm start
```

Open <http://127.0.0.1:3000>. The server serves the frontend and its API from
the same origin. Do not open `frontend/index.html` directly as a `file://` URL:
chat and saved history now use the backend.

The SQLite database is created automatically at `sql  lite/intergrow.sqlite`.
Set `DATABASE_PATH` to store it elsewhere, `PORT` to choose a port, or `HOST` to
change the bind address. The default bind address is localhost.

Run the backend and intent-matching tests with:

```sh
npm test
```

## API

- `GET /api/health` — health status.
- `GET /api/conversations` — up to 30 recent conversation summaries.
- `POST /api/conversations` — create a conversation.
- `GET /api/conversations/:id` — read a conversation and its messages.
- `DELETE /api/conversations/:id` — delete one conversation.
- `DELETE /api/conversations` — clear conversation history.
- `POST /api/conversations/:id/messages` — send `{ "message": "..." }`; returns
  the assistant reply, recognized intent, confidence, and updated conversation.

Messages are limited to 1,000 characters; each conversation retains up to 100
messages. The FAQ answers, intent matcher, and conversation context are local
application logic, not an external generative-AI integration. The confidence
value is a heuristic FAQ match score, not a calibrated probability.

The service is intended for local development and does not include user
authentication, rate limiting, or multi-user access controls. Do not expose it
to the public internet without adding those controls.
