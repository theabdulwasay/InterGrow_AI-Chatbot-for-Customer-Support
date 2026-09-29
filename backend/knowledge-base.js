"use strict";

const FAQS = [
  {
    intent: "Order tracking",
    question: "How can I track my order?",
    answer: "You can track an order from the shipping confirmation email using its tracking link. If you have an account, sign in and open **My Orders** to see the latest status. Tracking can take up to 24 hours to update after dispatch.",
    terms: ["track", "tracking", "order", "shipment", "shipped", "delivery", "status", "package", "parcel", "arrive"]
  },
  {
    intent: "Shipping & delivery",
    question: "What are the shipping options?",
    answer: "Standard delivery usually takes **3–5 business days**. Express delivery typically takes **1–2 business days**. Available options and estimated dates are shown at checkout; delivery times may vary by location.",
    terms: ["shipping", "delivery", "deliver", "arrive", "how long", "express", "standard", "cost", "ship", "days", "late"]
  },
  {
    intent: "Returns & refunds",
    question: "How do I return an item?",
    answer: "You can request a return within **30 days of delivery** if the item is unused and in its original packaging. Sign in, open **My Orders**, and choose **Start a return**. After we receive and inspect it, refunds are usually issued to your original payment method within 5–10 business days.",
    terms: ["return", "refund", "exchange", "send back", "money back", "wrong item", "damaged", "broken", "replace"]
  },
  {
    intent: "Pricing & discounts",
    question: "Do you offer discounts or promotions?",
    answer: "Current promotions appear on our website and are applied at checkout when eligible. Enter a promo code in the **Discount code** box before placing your order. Most codes cannot be combined with another offer.",
    terms: ["price", "pricing", "discount", "coupon", "promo", "promotion", "code", "sale", "offer", "cost", "cheaper"]
  },
  {
    intent: "Payment methods",
    question: "Which payment methods do you accept?",
    answer: "We accept major credit and debit cards, along with the digital payment options shown at checkout. Your payment details are processed securely and are not stored in your chat.",
    terms: ["payment", "pay", "card", "credit", "debit", "paypal", "wallet", "checkout", "billing", "charge"]
  },
  {
    intent: "Cancel or change an order",
    question: "Can I change or cancel my order?",
    answer: "If your order has not been prepared for dispatch yet, our support team may be able to change or cancel it. Please contact us as soon as possible with your order number. Once an order has shipped, you can request a return after delivery.",
    terms: ["cancel", "change", "edit", "modify", "update", "address", "order", "stop", "wrong"]
  },
  {
    intent: "Contact support",
    question: "How can I contact a person?",
    answer: "You can reach our support team by email at **support@intergrow.example**. Include your order number if your question is about an order, and the team will get back to you as soon as possible.",
    terms: ["contact", "human", "person", "agent", "email", "phone", "call", "support", "representative", "talk", "someone"]
  },
  {
    intent: "Account & password",
    question: "I need help with my account",
    answer: "For a forgotten password, choose **Forgot password** on the sign-in page and follow the reset link in your email. If you still cannot access your account, contact **support@intergrow.example** and our team can help.",
    terms: ["account", "password", "sign in", "login", "log in", "access", "forgot", "reset", "register", "profile"]
  },
  {
    intent: "Product information",
    question: "Where can I find product details?",
    answer: "Each product page includes its description, specifications, available options, and care information. If a detail you need is missing, send us the product name and your question and our support team will help.",
    terms: ["product", "detail", "specification", "size", "material", "color", "colour", "available", "stock", "information"]
  },
  {
    intent: "Business hours",
    question: "When is customer support available?",
    answer: "You can message me any time. Our human support team responds by email during **Monday to Friday, 9:00 AM–5:00 PM**. Messages sent outside those hours will be answered on the next business day.",
    terms: ["hours", "open", "available", "working", "business", "weekend", "time", "when", "support", "schedule"]
  }
];

const SYNONYMS = [
  ["purchase", "buy", "order"],
  ["package", "parcel", "shipment"],
  ["arrive", "delivery", "deliver"],
  ["refund", "reimbursement"],
  ["payment", "pay", "billing"],
  ["broken", "damaged", "faulty"],
  ["help", "support", "assistance"],
  ["login", "signin", "access"],
  ["price", "cost", "pricing"],
  ["cancel", "stop", "cancellation"]
];

const STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "can", "do", "does", "for", "get", "give", "how", "i",
  "in", "is", "it", "me", "my", "of", "on", "please", "the", "to", "want", "what", "when",
  "where", "which", "with", "you", "your", "tell", "would", "could", "should", "there", "this",
  "that", "something", "some", "much", "many"
]);

const FALLBACK_ANSWER = "I’m not quite sure I understood that. I can help with orders, shipping, returns, payments, products, or account questions. Could you rephrase your question or choose one of the topics above?";
const AMBIGUOUS_ANSWER = "I can help with that. Are you asking about tracking an order, changing or canceling it, or something else?";

function normalize(text) {
  return text.toLowerCase()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordForms(word) {
  if (word.length < 4) return [word];
  if (word.endsWith("ies") && word.length > 4) return [word.slice(0, -3) + "y"];
  if (word.endsWith("ing") && word.length > 5) {
    let stem = word.slice(0, -3);
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) stem = stem.slice(0, -1);
    return [stem, `${stem}e`];
  }
  if (word.endsWith("ed") && word.length > 4) {
    let stem = word.slice(0, -2);
    if (/([b-df-hj-np-tv-z])\1$/.test(stem)) stem = stem.slice(0, -1);
    return [stem, `${stem}e`];
  }
  if (word.endsWith("es") && word.length > 4 && !word.endsWith("ses")) return [word.slice(0, -2)];
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 4) return [word.slice(0, -1)];
  return [word];
}

function queryWords(text) {
  return normalize(text).split(" ")
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word))
    .flatMap(wordForms);
}

function expandSynonyms(words) {
  const expanded = new Set(words);
  for (const group of SYNONYMS) {
    if (group.some((word) => words.includes(word))) {
      for (const word of group) expanded.add(word);
    }
  }
  return expanded;
}

function matchFaq(text, lastIntent = null) {
  const normalized = normalize(text);
  const words = queryWords(text);
  const tokens = expandSynonyms(words);
  const shortFollowUp = words.length <= 4
    && /\b(it|that|this|they|them|there|how long|how soon|what about|and|also|more|why)\b/.test(normalized);
  const followUp = shortFollowUp && lastIntent
    ? FAQS.find((faq) => faq.intent === lastIntent) ?? null
    : null;
  const genericFollowUp = /^(how long|how soon|why|more|what about|what about (it|that|this|they|them|there))$/.test(normalized);
  if (followUp && (tokens.size === 0 || genericFollowUp)) {
    return { intent: followUp.intent, confidence: 0.62, text: followUp.answer };
  }
  const candidates = followUp ? [followUp, ...FAQS.filter((faq) => faq !== followUp)] : FAQS;

  const scores = candidates.map((faq) => {
    const terms = new Set(faq.terms.flatMap((term) => [...expandSynonyms(queryWords(term))]));
    const matches = [...tokens].filter((token) => terms.has(token)).length;
    const coverage = tokens.size === 0 ? 0 : matches / tokens.size;
    const phraseMatch = faq.terms.some((term) => term.includes(" ") && normalized.includes(term));
    const directMatch = faq.terms.some((term) => term.length > 3 && normalized.includes(term));
    const contextBoost = faq === followUp ? 0.27 : 0;
    const score = Math.min(1, coverage * 0.7 + (phraseMatch ? 0.24 : 0) + (directMatch ? 0.12 : 0) + contextBoost);
    return { faq, score };
  }).sort((left, right) => right.score - left.score);

  const [best, runnerUp] = scores;
  const followUpScore = scores.find((entry) => entry.faq === followUp)?.score ?? 0;
  if (followUp && best.faq !== followUp && best.score - followUpScore < 0.24) {
    return { intent: followUp.intent, confidence: 0.62, text: followUp.answer };
  }
  if (!best || best.score < 0.18) {
    return { intent: "Not sure yet", confidence: 0, text: FALLBACK_ANSWER };
  }
  if (!followUp && words.length === 1 && runnerUp && best.score - runnerUp.score < 0.12) {
    return { intent: "Not sure yet", confidence: 0.42, text: AMBIGUOUS_ANSWER };
  }
  return {
    intent: best.faq.intent,
    confidence: Math.min(0.98, 0.32 + best.score * 0.66),
    text: best.faq.answer
  };
}

module.exports = { FAQS, matchFaq };
