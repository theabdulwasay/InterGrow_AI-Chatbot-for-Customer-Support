"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { after, before, test } = require("node:test");
const { createServer } = require("./server");
const { matchFaq } = require("./knowledge-base");

let temporaryDirectory;
let databasePath;

before(() => {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "intergrow-support-"));
  databasePath = path.join(temporaryDirectory, "test.sqlite");
});

after(() => {
  fs.rmSync(temporaryDirectory, { recursive: true, force: true });
});

test("FAQ matching recognizes intent, context, ambiguity, and unknown messages", () => {
  assert.equal(matchFaq("Where is my parcel?").intent, "Order tracking");
  assert.equal(matchFaq("How long does delivery take?").intent, "Shipping & delivery");
  assert.equal(matchFaq("How do returns work?").intent, "Returns & refunds");
  assert.equal(matchFaq("What about it?", "Order tracking").intent, "Order tracking");
  assert.equal(matchFaq("How long?", "Returns & refunds").intent, "Returns & refunds");
  assert.equal(matchFaq("How long does shipping take?", "Returns & refunds").intent, "Shipping & delivery");
  assert.equal(matchFaq("order").intent, "Not sure yet");
  assert.equal(matchFaq("Tell me a joke").confidence, 0);
});

test("HTTP API persists chat, validates input, and serves the frontend", async () => {
  const server = createServer({ databasePath });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let conversationId;

  try {
    const health = await fetch(`${baseUrl}/api/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).database, "sqlite");

    const home = await fetch(baseUrl);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /InterGrow Support/);

    const createdResponse = await fetch(`${baseUrl}/api/conversations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    assert.equal(createdResponse.status, 201);
    const { conversation } = await createdResponse.json();
    conversationId = conversation.id;
    assert.equal(conversation.messages.length, 0);

    const messageResponse = await fetch(`${baseUrl}/api/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Where is my parcel?" })
    });
    assert.equal(messageResponse.status, 200);
    const chat = await messageResponse.json();
    assert.equal(chat.reply.intent, "Order tracking");
    assert.equal(chat.conversation.messages.length, 2);

    const followUpResponse = await fetch(`${baseUrl}/api/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What about it?" })
    });
    assert.equal((await followUpResponse.json()).reply.intent, "Order tracking");

    const tooLongResponse = await fetch(`${baseUrl}/api/conversations/${conversation.id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "x".repeat(1001) })
    });
    assert.equal(tooLongResponse.status, 413);

    const listResponse = await fetch(`${baseUrl}/api/conversations`);
    const list = await listResponse.json();
    assert.equal(list.conversations.length, 1);
    assert.equal(list.conversations[0].messageCount, 4);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    server.database.close();
  }

  const reopenedServer = createServer({ databasePath });
  await new Promise((resolve) => reopenedServer.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${reopenedServer.address().port}/api/conversations/${conversationId}`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).conversation.messages.length, 4);
  } finally {
    await new Promise((resolve, reject) => reopenedServer.close((error) => error ? reject(error) : resolve()));
    reopenedServer.database.close();
  }
});
