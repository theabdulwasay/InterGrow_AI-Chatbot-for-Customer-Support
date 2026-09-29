# 🌱 InterGrow Support Backend

A lightweight, dependency-free backend for the **InterGrow Support System**, built with **Node.js** and **SQLite**.

The backend provides a REST API for health checks, conversation management, message history, and local FAQ/intent-based support. It also serves the frontend from the same origin, making the application easy to run locally without additional services or third-party npm packages.

> **No external generative AI is required.**
> FAQ matching, intent recognition, and conversation context are handled entirely by local application logic.

---

## ✨ Features

* 🚀 Built with Node.js built-in HTTP server
* 🗄️ Lightweight SQLite database
* 📦 **Zero third-party npm dependencies**
* 💬 Conversation and message history
* 🧠 Local FAQ and intent matching
* 🎯 Heuristic confidence scoring
* 🔄 Conversation context handling
* 🌐 Frontend and API served from the same origin
* 🩺 Built-in health-check endpoint
* 🗑️ Delete individual conversations
* 🧹 Clear complete conversation history
* 🔒 Localhost-first configuration
* 🧪 Automated backend and intent-matching tests
* ⚡ Simple setup and fast startup

---

## 🏗️ Technology Stack

| Technology              | Purpose                          |
| ----------------------- | -------------------------------- |
| **Node.js 22.13+**      | Backend runtime                  |
| **HTTP Server**         | REST API and static file serving |
| **SQLite**              | Persistent conversation storage  |
| **JavaScript**          | Backend application logic        |
| **HTML/CSS/JS**         | Frontend interface               |
| **npm**                 | Project scripts                  |
| **Node.js Test Runner** | Automated testing                |

---

## 📁 Project Structure

```text
InterGrow/
│
├── frontend/
│   └── index.html
│
├── sql lite/
│   └── intergrow.sqlite
│
├── server.js
├── package.json
├── package-lock.json
├── README.md
└── ...
```

> The SQLite database is created automatically when the application starts.

---

# 🚀 Getting Started

## 1. Prerequisites

Make sure you have:

* **Node.js 22.13 or newer**
* npm
* A modern web browser

Check your Node.js version:

```bash
node --version
```

Example:

```text
v22.13.0
```

---

## 2. Start the Application

Open a terminal in the project root:

```bash
npm start
```

After the server starts, open:

```text
http://127.0.0.1:3000
```

The application will serve both the **frontend** and **backend API** from the same origin.

---

## ⚠️ Important

Do **not** open:

```text
frontend/index.html
```

directly using a `file://` URL.

For example, avoid:

```text
file:///.../frontend/index.html
```

The chat system and saved conversation history communicate with the backend, so the application should always be accessed through:

```text
http://127.0.0.1:3000
```

---

# 🗄️ Database

InterGrow uses **SQLite** for storing conversations and messages.

The database is automatically created at:

```text
sql lite/intergrow.sqlite
```

No separate database server is required.

### Custom Database Location

You can change the database location using:

```bash
DATABASE_PATH=/path/to/database.sqlite npm start
```

For example:

```bash
DATABASE_PATH=./data/intergrow.sqlite npm start
```

---

# ⚙️ Configuration

The application supports the following environment variables:

| Variable        | Description              | Default                     |
| --------------- | ------------------------ | --------------------------- |
| `PORT`          | Server port              | `3000`                      |
| `HOST`          | Server bind address      | `127.0.0.1`                 |
| `DATABASE_PATH` | SQLite database location | `sql lite/intergrow.sqlite` |

### Example

```bash
PORT=4000 npm start
```

Then open:

```text
http://127.0.0.1:4000
```

You can also change the host:

```bash
HOST=0.0.0.0 PORT=3000 npm start
```

> **Security warning:** Do not bind the development server to a public interface or expose it to the internet without implementing authentication, rate limiting, and appropriate access controls.

---

# 🔌 API Documentation

The backend exposes a simple REST API.

## 🩺 Health Check

### `GET /api/health`

Returns the current service health status.

Example:

```http
GET /api/health
```

Typical response:

```json
{
  "status": "ok"
}
```

---

## 💬 Get Conversations

### `GET /api/conversations`

Returns up to **30 recent conversation summaries**.

Example:

```http
GET /api/conversations
```

---

## ➕ Create Conversation

### `POST /api/conversations`

Creates a new conversation.

Example:

```http
POST /api/conversations
```

---

## 📖 Get Conversation

### `GET /api/conversations/:id`

Returns a conversation together with its messages.

Example:

```http
GET /api/conversations/1
```

---

## 🗑️ Delete Conversation

### `DELETE /api/conversations/:id`

Deletes a specific conversation.

Example:

```http
DELETE /api/conversations/1
```

---

## 🧹 Clear Conversation History

### `DELETE /api/conversations`

Deletes the complete conversation history.

Example:

```http
DELETE /api/conversations
```

---

# 🤖 Send a Message

### `POST /api/conversations/:id/messages`

Sends a message to the InterGrow support system.

### Request

```json
{
  "message": "How can I reset my password?"
}
```

Example:

```http
POST /api/conversations/1/messages
Content-Type: application/json
```

### Response

The API returns information including:

* Assistant response
* Recognized intent
* Confidence score
* Updated conversation
* Message history/context

Example structure:

```json
{
  "reply": "You can reset your password from the account settings.",
  "intent": "password_reset",
  "confidence": 0.92,
  "conversation": {}
}
```

---

# 🧠 Intent Matching

InterGrow does not rely on an external generative-AI service.

Instead, the support system uses local application logic to:

1. Receive the user's message
2. Analyze the message
3. Match it against available FAQ/intent patterns
4. Calculate a heuristic confidence score
5. Select an appropriate support response
6. Store the conversation
7. Return the response to the frontend

### Example

```text
User
 │
 ▼
User Message
 │
 ▼
Intent Matcher
 │
 ├── FAQ Match
 │
 ├── Intent Detection
 │
 └── Confidence Score
 │
 ▼
Support Response
 │
 ▼
SQLite
 │
 ▼
Frontend
```

---

# 📊 Confidence Score

The API provides a confidence value for the recognized intent.

**Important:** this value is a **heuristic FAQ matching score**.

It should **not** be interpreted as a calibrated probability.

For example:

```text
confidence: 0.92
```

means that the local matching logic found a strong FAQ match. It does not mean there is exactly a 92% statistical probability that the intent is correct.

---

# 💾 Conversation Management

InterGrow maintains persistent conversation history using SQLite.

### Limits

| Resource                      |                Limit |
| ----------------------------- | -------------------: |
| Maximum message length        | **1,000 characters** |
| Messages per conversation     |              **100** |
| Recent conversation summaries |               **30** |

These limits help keep the local application lightweight and predictable.

---

# 🧪 Testing

Run the backend and intent-matching tests using:

```bash
npm test
```

The test suite verifies important application behavior, including backend functionality and intent matching.

A successful test run should complete without failures.

---

# 🔐 Security

This project is designed primarily for **local development**.

It currently does **not** provide:

* ❌ User authentication
* ❌ Rate limiting
* ❌ Multi-user access controls
* ❌ Production-grade authorization
* ❌ Public API protection

Therefore, the application should **not be exposed directly to the public internet**.

Before deploying to production, consider adding:

* Authentication and authorization
* HTTPS/TLS
* Rate limiting
* Input validation
* Request-size limits
* Secure headers
* CORS policy where appropriate
* Database backup strategy
* Logging and monitoring
* Multi-user data isolation

---

# 🌐 Application Architecture

```text
                 ┌─────────────────────┐
                 │      Web Browser    │
                 │                     │
                 │  InterGrow Frontend │
                 └──────────┬──────────┘
                            │
                            │ HTTP
                            ▼
                 ┌─────────────────────┐
                 │    Node.js Server   │
                 │                     │
                 │  ┌───────────────┐  │
                 │  │ REST API      │  │
                 │  └───────────────┘  │
                 │                     │
                 │  ┌───────────────┐  │
                 │  │ Intent Matcher│  │
                 │  └───────────────┘  │
                 │                     │
                 │  ┌───────────────┐  │
                 │  │ FAQ Logic     │  │
                 │  └───────────────┘  │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │       SQLite        │
                 │                     │
                 │ Conversations       │
                 │ Messages            │
                 └─────────────────────┘
```

---

# 🔄 Message Flow

```text
1. User opens InterGrow
          │
          ▼
2. User sends a support message
          │
          ▼
3. Frontend sends POST request
          │
          ▼
4. Node.js API receives message
          │
          ▼
5. Intent/FAQ matching is performed
          │
          ▼
6. Appropriate response is generated
          │
          ▼
7. Conversation is saved to SQLite
          │
          ▼
8. API returns response + intent + confidence
          │
          ▼
9. Frontend displays the response
```

---

# 🛠️ Development

Start the application:

```bash
npm start
```

Run tests:

```bash
npm test
```

The project intentionally avoids third-party npm dependencies and uses Node.js built-in functionality wherever possible.

---

# 📌 Design Goals

InterGrow Support Backend is designed around a few simple principles:

### Lightweight

No external database server or AI service is required.

### Simple

The application can be started with a single command.

### Local-first

Conversation data and support logic remain within the local application.

### Testable

Core backend and intent-matching functionality can be verified using automated tests.

### Extensible

The API structure allows future features such as authentication, additional intents, external AI integration, analytics, and multi-user support to be added later.

---

# 🚧 Future Improvements

Possible future enhancements include:

* 🔐 User authentication
* 👥 Multi-user support
* 🛡️ Role-based access control
* 🚦 API rate limiting
* 🤖 Optional generative-AI integration
* 📈 Support analytics dashboard
* 🔍 Advanced semantic search
* 🌍 Multi-language support
* 📧 Email support integration
* 📱 Mobile-friendly improvements
* ☁️ Production deployment configuration
* 📝 Admin management for FAQs and intents

---

# 📝 Important Notes

* Node.js **22.13 or newer** is required.
* SQLite is created automatically.
* The application should be accessed through the Node.js server.
* Do not open the frontend HTML file directly.
* Message size is limited to **1,000 characters**.
* Each conversation retains up to **100 messages**.
* Up to **30 recent conversation summaries** are returned.
* Confidence scores are heuristic matching scores, not probabilities.
* The current implementation is intended for local development.

---

# 📄 License

Add your project's license information here.

For example:

```text
MIT License
```

---

## 🌱 InterGrow

**A lightweight local support platform designed for fast, simple, and maintainable customer-support interactions.**

> Built with **Node.js + SQLite** — simple, local, and dependency-free.
