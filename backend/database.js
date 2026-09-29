"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const MAX_CONVERSATIONS = 30;
const MAX_MESSAGES = 100;

function openDatabase(databasePath) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      last_intent TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'bot')),
      text TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      intent TEXT,
      confidence REAL CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
    );

    CREATE INDEX IF NOT EXISTS messages_conversation_order
      ON messages(conversation_id, timestamp, id);
    CREATE INDEX IF NOT EXISTS conversations_updated
      ON conversations(updated_at DESC);
  `);
  return database;
}

function rowToMessage(row) {
  const message = {
    role: row.role,
    text: row.text,
    timestamp: row.timestamp
  };
  if (row.intent !== null) message.intent = row.intent;
  if (row.confidence !== null) message.confidence = row.confidence;
  return message;
}

function createRepository(database) {
  const getConversationRow = database.prepare(`
    SELECT id, title, last_intent AS lastIntent, created_at AS createdAt, updated_at AS updatedAt
    FROM conversations WHERE id = ?
  `);
  const getMessages = database.prepare(`
    SELECT role, text, timestamp, intent, confidence
    FROM messages WHERE conversation_id = ? ORDER BY timestamp, id
  `);
  const getConversationSummaries = database.prepare(`
    SELECT c.id, c.title, c.last_intent AS lastIntent,
      c.created_at AS createdAt, c.updated_at AS updatedAt,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS messageCount
    FROM conversations c ORDER BY c.updated_at DESC, c.created_at DESC LIMIT ?
  `);

  function getConversation(id) {
    const row = getConversationRow.get(id);
    if (!row) return null;
    return { ...row, messages: getMessages.all(id).map(rowToMessage) };
  }

  function createConversation(id) {
    const now = Date.now();
    database.prepare(`
      INSERT INTO conversations (id, title, last_intent, created_at, updated_at)
      VALUES (?, 'New conversation', NULL, ?, ?)
    `).run(id, now, now);
    database.prepare(`
      DELETE FROM conversations WHERE id IN (
        SELECT id FROM conversations ORDER BY updated_at DESC, created_at DESC LIMIT -1 OFFSET ?
      )
    `).run(MAX_CONVERSATIONS);
    return getConversation(id);
  }

  function addChatTurn(id, text, result) {
    const existing = getConversationRow.get(id);
    if (!existing) return null;

    const now = Date.now();
    const title = existing.title === "New conversation"
      ? (text.length > 34 ? `${text.slice(0, 34).trimEnd()}…` : text)
      : existing.title;
    const nextIntent = result.intent === "Not sure yet" ? existing.lastIntent : result.intent;

    database.exec("BEGIN IMMEDIATE");
    try {
      const insertMessage = database.prepare(`
        INSERT INTO messages (conversation_id, role, text, timestamp, intent, confidence)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      insertMessage.run(id, "user", text, now, null, null);
      insertMessage.run(id, "bot", result.text, now + 1, result.intent, result.confidence);
      database.prepare(`
        UPDATE conversations SET title = ?, last_intent = ?, updated_at = ? WHERE id = ?
      `).run(title, nextIntent, now + 1, id);
      database.prepare(`
        DELETE FROM messages WHERE conversation_id = ? AND id NOT IN (
          SELECT id FROM messages WHERE conversation_id = ? ORDER BY timestamp DESC, id DESC LIMIT ?
        )
      `).run(id, id, MAX_MESSAGES);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }

    return getConversation(id);
  }

  function listConversations() {
    return getConversationSummaries.all(MAX_CONVERSATIONS);
  }

  function deleteConversation(id) {
    return database.prepare("DELETE FROM conversations WHERE id = ?").run(id).changes > 0;
  }

  function clearConversations() {
    return database.prepare("DELETE FROM conversations").run().changes;
  }

  return { createConversation, getConversation, addChatTurn, listConversations, deleteConversation, clearConversations };
}

module.exports = { openDatabase, createRepository };
