"use strict";

const API_BASE = "/api";
const MAX_MESSAGE_LENGTH = 1000;

const list = document.querySelector("#message-list");
const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const sendButton = document.querySelector("#send-button");
const historyList = document.querySelector("#conversation-list");
const suggestions = document.querySelector("#suggestion-list");
const toast = document.querySelector("#toast");

let conversations = [];
let activeConversationId = null;
let activeConversation = null;
let toastTimer;
let sending = false;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `The server returned ${response.status}.`);
  }
  return payload;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("visible");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 4000);
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function formatAnswer(text) {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

function timeLabel(timestamp) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(timestamp);
}

function renderHistory() {
  historyList.replaceChildren();
  if (conversations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "history-empty";
    empty.textContent = "Your conversations will appear here.";
    historyList.append(empty);
    return;
  }

  for (const conversation of conversations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `history-item${conversation.id === activeConversationId ? " active" : ""}`;
    button.setAttribute("aria-current", conversation.id === activeConversationId ? "page" : "false");
    const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    icon.setAttribute("viewBox", "0 0 20 20");
    icon.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", "M4 4.5h12v9H9l-4 3v-3H4z");
    icon.append(path);
    const title = document.createElement("span");
    title.textContent = conversation.title || "New conversation";
    button.append(icon, title);
    button.addEventListener("click", () => openConversation(conversation.id));
    historyList.append(button);
  }
}

function renderMessage(message) {
  const row = document.createElement("article");
  row.className = `message-row ${message.role}`;
  if (message.role === "bot") {
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = "i";
    row.append(avatar);
  }

  const content = document.createElement("div");
  content.className = "message-content";
  const bubble = document.createElement("div");
  bubble.className = "message-bubble";
  if (message.role === "bot") bubble.innerHTML = formatAnswer(message.text);
  else bubble.textContent = message.text;
  content.append(bubble);

  const meta = document.createElement("div");
  meta.className = "message-meta";
  if (message.intent) {
    const intent = document.createElement("span");
    intent.className = "intent-badge";
    intent.textContent = message.intent;
    meta.append(intent);
  }
  if (Number.isFinite(message.confidence)) {
    const confidence = document.createElement("span");
    const level = message.confidence >= 0.75 ? "high" : message.confidence >= 0.45 ? "medium" : "low";
    confidence.className = `confidence-badge${level === "high" ? "" : ` ${level}`}`;
    confidence.textContent = `${Math.round(message.confidence * 100)}% match`;
    confidence.title = `Estimated FAQ match confidence: ${Math.round(message.confidence * 100)}%`;
    meta.append(confidence);
  }
  const time = document.createElement("span");
  time.className = "message-time";
  time.textContent = timeLabel(message.timestamp);
  meta.append(time);
  content.append(meta);
  row.append(content);
  list.append(row);
}

function renderWelcome() {
  const welcome = document.createElement("div");
  welcome.className = "welcome";
  welcome.innerHTML = '<div class="welcome-icon" aria-hidden="true"><svg viewBox="0 0 36 36"><path d="M18 5.5c-6.4 0-11.5 4.5-11.5 10 0 3.1 1.8 5.9 4.6 7.7l-1 4.6 5.2-2.4c.9.2 1.8.3 2.7.3 6.4 0 11.5-4.5 11.5-10.1S24.4 5.5 18 5.5Z"/><path d="M13.8 15.8h.1m4.1 0h.1m4.1 0h.1"/></svg></div><h1>How can we <span>help</span> you?</h1><p>Ask me about your orders, shipping, returns, or anything else. I\'m here to make things easy.</p>';
  list.append(welcome);
}

function renderConversation() {
  list.replaceChildren();
  if (!activeConversation || activeConversation.messages.length === 0) {
    renderWelcome();
    return;
  }
  for (const message of activeConversation.messages) renderMessage(message);
  list.scrollTop = list.scrollHeight;
}

function updateSuggestions() {
  suggestions.replaceChildren();
  if (activeConversation?.messages.length) return;

  for (const question of [
    "Track my order",
    "How do returns work?",
    "Shipping options",
    "Talk to support"
  ]) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "suggestion-chip";
    button.textContent = question;
    button.addEventListener("click", () => sendMessage(question));
    suggestions.append(button);
  }
}

function render() {
  renderHistory();
  renderConversation();
  updateSuggestions();
}

async function refreshHistory() {
  const payload = await apiRequest("/conversations");
  conversations = payload.conversations;
  renderHistory();
}

async function openConversation(id) {
  activeConversationId = id;
  activeConversation = null;
  render();
  try {
    const payload = await apiRequest(`/conversations/${encodeURIComponent(id)}`);
    if (activeConversationId !== id) return;
    activeConversation = payload.conversation;
    render();
  } catch (error) {
    console.error("Could not load this conversation.", error);
    showToast(error.message);
  }
}

async function newConversation() {
  try {
    const payload = await apiRequest("/conversations", { method: "POST", body: "{}" });
    activeConversation = payload.conversation;
    activeConversationId = activeConversation.id;
    await refreshHistory();
    render();
    input.focus();
  } catch (error) {
    console.error("Could not start a conversation.", error);
    showToast(error.message);
  }
}

async function clearHistory() {
  if (conversations.length === 0) return;
  if (!window.confirm("Clear all saved conversations? This cannot be undone.")) return;
  try {
    await apiRequest("/conversations", { method: "DELETE" });
    conversations = [];
    activeConversationId = null;
    activeConversation = null;
    render();
    showToast("Conversation history cleared.");
  } catch (error) {
    console.error("Could not clear conversation history.", error);
    showToast(error.message);
  }
}

function showTyping() {
  const row = document.createElement("div");
  row.className = "message-row bot";
  row.id = "typing-indicator";
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = "i";
  const dots = document.createElement("div");
  dots.className = "typing-indicator";
  dots.setAttribute("aria-label", "Assistant is typing");
  for (let index = 0; index < 3; index += 1) dots.append(document.createElement("span"));
  row.append(avatar, dots);
  list.append(row);
  list.scrollTop = list.scrollHeight;
  return row;
}

async function sendMessage(rawText) {
  const text = rawText.trim();
  if (!text || sending) return;
  if (text.length > MAX_MESSAGE_LENGTH) {
    showToast(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
    return;
  }

  sending = true;
  sendButton.disabled = true;
  input.value = "";
  resizeInput();
  suggestions.replaceChildren();
  let typing;
  try {
    if (!activeConversation) {
      const created = await apiRequest("/conversations", { method: "POST", body: "{}" });
      activeConversation = created.conversation;
      activeConversationId = activeConversation.id;
    }

    const conversationId = activeConversationId;
    const userMessage = { role: "user", text, timestamp: Date.now() };
    activeConversation.messages.push(userMessage);
    if (activeConversation.messages.length === 1) {
      activeConversation.title = text.length > 34 ? `${text.slice(0, 34).trimEnd()}…` : text;
    }
    render();
    typing = showTyping();

    const payload = await apiRequest(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ message: text })
    });
    if (activeConversationId === conversationId) {
      activeConversation = payload.conversation;
      render();
      list.scrollTop = list.scrollHeight;
    }
    try {
      await refreshHistory();
    } catch (error) {
      console.error("The message was sent, but conversation history could not be refreshed.", error);
      showToast("Message sent, but the conversation list could not be refreshed.");
    }
  } catch (error) {
    console.error("Could not send the message.", error);
    if (typing) typing.remove();
    if (activeConversation && activeConversation.messages.at(-1)?.role === "user"
      && activeConversation.messages.at(-1)?.text === text) {
      activeConversation.messages.pop();
      render();
    }
    input.value = text;
    resizeInput();
    showToast(`Message was not sent. ${error.message}`);
  } finally {
    if (typing) typing.remove();
    sending = false;
    sendButton.disabled = input.value.trim().length === 0;
  }
}

function resizeInput() {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 120)}px`;
}

document.querySelector("#new-chat").addEventListener("click", newConversation);
document.querySelector("#clear-history").addEventListener("click", clearHistory);
form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});
input.addEventListener("input", () => {
  resizeInput();
  sendButton.disabled = sending || input.value.trim().length === 0;
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

async function initialize() {
  try {
    await apiRequest("/health");
    await refreshHistory();
    if (conversations.length > 0) await openConversation(conversations[0].id);
    else render();
  } catch (error) {
    console.error("Could not connect to the InterGrow backend.", error);
    render();
    showToast("Backend is unavailable. Start it with `npm start` from the project folder.");
  }
}

initialize();
