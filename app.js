/**
 * حسن AI — ChatGPT Core Engine v14
 * Fast, Natural, Zero Punctuation, Ultra-Clean Persona, Seamless Takeover
 */

// ── Default Configuration ──────────────────────────────────────────
const DEFAULT_CONFIG = {
  apiKey: "AQ.Ab8RN6Iibnaf8lY024FJOmCybsYiXSD6YvFlaggc3lq95UgYLQ",
  roqaUser: "roqa",
  roqaPass: "1234",
  adminUser: "0000",
  adminPass: "0000",
  mode: "ai", // 'ai' or 'manual'
  promptVersion: 14,
  systemPrompt: `أنت حسن (Hassan jabr) بتكلم روقية (روقا / Rokty) في الشات بتاعكم الخاص.
اتكلم زي البشر العاديين بالظبط وزي طريقتك الحقيقية في الشات بدون أي تصنع:

قواعد حاسمة وإلزامية:
1. ممنوع نهائياً استخدام أي علامات ترقيم إطلاقاً (ممنوع علامة الاستفهام ؟ وممنوع النقطة وممنوع الفاصلة وممنوع أي أقواس أو شرطات أو علامات تعجب). اكتب كلام مصري صافي بدون أي علامات نهائياً زي شات الشباب.
2. زيرو إيموجيز نهائياً في أي رسالة. كلام فقط.
3. كلامك قليل وموزون (سطر أو سطرين بالكتير).
4. أسلوبك مصري عفوي بتاع شباب: (فشخ، فلل، يسطا، يبويا، وربنا، اوييي، بجد، عموما، ماشي، خلصا، يعم).
5. أسلوبك هادي وشبه بارد ومش مدلوق، بس حنين ومستوعبها وبيطمنها.
6. بتناديها روقا أو يروقتي أو يا رقيه لما الموضوع يكون جد.
7. مفيش أي سيرة لدكاترة ولا علاج ولا قطط إلا لو هي اللي جابت سيرتهم الأول في رسالتها.
8. رد على قد الكلام اللي هي قالته دلوقتي بالضبط وبسرعة وبدون أي لف ولا دوران.`
};

// Storage Keys
const STORAGE_KEYS = {
  CONFIG: "hassan_ai_cfg_v14",
  MESSAGES: "hassan_ai_msgs_v14",
  SESSION: "hassan_ai_sess_v14"
};

// State
let config = loadConfig();
let messages = loadMessages();
let currentUser = sessionStorage.getItem(STORAGE_KEYS.SESSION) || null;
let isAiResponding = false;
let typingDebounceTimer = null;

// Fastest Tested Gemini Models (verified 200 with native curl)
const GEMINI_MODELS = [
  "gemini-flash-lite-latest",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash"
];

let workingModelCache = "gemini-flash-lite-latest";

// Blacklist of forbidden technical or glitch words
const FORBIDDEN_WORDS = [
  "مؤقت", "موقت", "timeout", "الرسائل المؤقتة", "خادم", "server",
  "error", "خطأ", "نظام", "api", "كود", "برمجة", "تقني", "استثناء",
  "exception", "null", "undefined", "مزود", "مهلة", "انتهاء"
];

// Natural Egyptian Fallbacks when network is slow or model glitched
const NATURAL_FALLBACKS = [
  "معاكي يروقتي سامعك احكي",
  "ماشي يروقا كملي في ايه",
  "اه سامعك قوليلي",
  "ايه اللي حصل يروقتي",
  "معاكي قولي",
  "اه وربنا ماشي",
  "تمام يروقتي احكيلي"
];

// ── Cross-tab Realtime Synchronization ────────────────────────────
let syncChannel = null;
try {
  syncChannel = new BroadcastChannel("hassan_chatgpt_sync");
  syncChannel.onmessage = (event) => handleChannelMessage(event.data);
} catch (e) {
  console.log("BroadcastChannel fallback active");
}

window.addEventListener("storage", (e) => {
  if (e.key === STORAGE_KEYS.MESSAGES) {
    messages = loadMessages();
    renderMessages();
    scrollToBottom();
  } else if (e.key === STORAGE_KEYS.CONFIG) {
    config = loadConfig();
    updateAdminControlUI();
  }
});

// ── Lifecycle Initialization ──────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  if (currentUser === "admin" || currentUser === "roqa") {
    switchScreen("chat");
    initAppSession();
  } else {
    switchScreen("login");
  }

  // Setup typing broadcaster on textarea for live takeover dots
  const textarea = document.getElementById("chat-textarea");
  if (textarea) {
    textarea.addEventListener("input", handleUserTypingEvent);
  }
});

// ── Config Management ─────────────────────────────────────────────
function loadConfig() {
  const saved = localStorage.getItem(STORAGE_KEYS.CONFIG);
  if (!saved) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(saved);
    if (!parsed.promptVersion || parsed.promptVersion < DEFAULT_CONFIG.promptVersion) {
      parsed.systemPrompt = DEFAULT_CONFIG.systemPrompt;
      parsed.apiKey = DEFAULT_CONFIG.apiKey;
      parsed.promptVersion = DEFAULT_CONFIG.promptVersion;
      localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify({ ...DEFAULT_CONFIG, ...parsed }));
    }
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch (e) {
    return { ...DEFAULT_CONFIG };
  }
}

function saveConfig(patch) {
  config = { ...config, ...patch };
  localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config));
  broadcastChange({ type: "CONFIG_UPDATE", config });
}

function loadMessages() {
  const saved = localStorage.getItem(STORAGE_KEYS.MESSAGES);
  if (!saved) return [];
  try {
    return JSON.parse(saved);
  } catch (e) {
    return [];
  }
}

function saveMessages(newMsgs) {
  messages = newMsgs;
  localStorage.setItem(STORAGE_KEYS.MESSAGES, JSON.stringify(messages));
  broadcastChange({ type: "MESSAGES_UPDATE", messages });
}

function broadcastChange(data) {
  if (syncChannel) {
    try { syncChannel.postMessage(data); } catch (e) {}
  }
}

function handleChannelMessage(data) {
  if (!data) return;
  if (data.type === "MESSAGES_UPDATE") {
    messages = data.messages;
    setTypingIndicator(false);
    renderMessages();
    scrollToBottom();
  } else if (data.type === "CONFIG_UPDATE") {
    config = data.config;
    updateAdminControlUI();
  } else if (data.type === "TYPING") {
    if (currentUser === "roqa") {
      setTypingIndicator(data.active);
    }
  }
}

// ── Screen Switching ──────────────────────────────────────────────
function switchScreen(screenName) {
  document.querySelectorAll(".screen-view").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(`screen-${screenName}`);
  if (target) target.classList.add("active");

  if (screenName === "chat") {
    renderMessages();
    scrollToBottom();
  }
}

// ── Authentication ────────────────────────────────────────────────
function handleLoginSubmit(e) {
  e.preventDefault();
  const u = document.getElementById("login-username").value.trim().toLowerCase();
  const p = document.getElementById("login-password").value.trim();
  const err = document.getElementById("login-err");

  // Hassan Secret Admin Login (0000 / 0000)
  if ((u === "0000" || u === config.adminUser) && (p === "0000" || p === config.adminPass)) {
    currentUser = "admin";
    sessionStorage.setItem(STORAGE_KEYS.SESSION, "admin");
    err.classList.add("hidden");
    switchScreen("chat");
    initAppSession();
    return;
  }

  // Roqa User Login (roqa / 1234)
  if ((u === "roqa" || u === config.roqaUser.toLowerCase() || u === "روقا" || u === "رقية") && p === config.roqaPass) {
    currentUser = "roqa";
    sessionStorage.setItem(STORAGE_KEYS.SESSION, "roqa");
    err.classList.add("hidden");
    switchScreen("chat");
    initAppSession();
    return;
  }

  err.classList.remove("hidden");
}

function handleLogout() {
  currentUser = null;
  sessionStorage.removeItem(STORAGE_KEYS.SESSION);
  switchScreen("login");
}

// ── App Session Setup ─────────────────────────────────────────────
function initAppSession() {
  const isAdmin = currentUser === "admin";
  const adminBar = document.getElementById("hassan-admin-bar");
  const settingsBtn = document.getElementById("admin-settings-btn");
  const userDisplayName = document.getElementById("user-display-name");
  const userAvatarLetter = document.getElementById("user-avatar-letter");
  const modalKeyInput = document.getElementById("modal-key-input");

  // Show control bar and settings button ONLY for Hassan
  if (adminBar) adminBar.classList.toggle("hidden", !isAdmin);
  if (settingsBtn) settingsBtn.classList.toggle("hidden", !isAdmin);

  if (userDisplayName && userAvatarLetter) {
    if (isAdmin) {
      userDisplayName.textContent = "حسن (أدمن)";
      userAvatarLetter.textContent = "H";
      userAvatarLetter.style.backgroundColor = "#f59e0b";
    } else {
      userDisplayName.textContent = "روقا";
      userAvatarLetter.textContent = "R";
      userAvatarLetter.style.backgroundColor = "#3b82f6";
    }
  }

  if (modalKeyInput) {
    modalKeyInput.value = config.apiKey || DEFAULT_CONFIG.apiKey;
  }

  updateAdminControlUI();
  renderMessages();
  scrollToBottom();
}

// ── Secret Hassan Mode Switcher ───────────────────────────────────
function switchHassanMode(mode) {
  config.mode = mode;
  saveConfig({ mode });
  setTypingIndicator(false);
  broadcastChange({ type: "TYPING", active: false });
  updateAdminControlUI();
}

function updateAdminControlUI() {
  const isAi = config.mode === "ai";
  const btnAi = document.getElementById("btn-mode-ai");
  const btnManual = document.getElementById("btn-mode-manual");
  const hintText = document.getElementById("admin-status-hint");
  const textarea = document.getElementById("chat-textarea");

  if (btnAi && btnManual) {
    btnAi.classList.toggle("active", isAi);
    btnManual.classList.toggle("active", !isAi);
  }

  if (hintText) {
    hintText.textContent = isAi
      ? "الـ AI مفعّل وبيرد بأسلوبك من شاتكم"
      : "الـ AI واقف: اكتب ردك لروقا هنا وهيوصل كأنه من الـ AI";
  }

  if (currentUser === "admin" && textarea) {
    textarea.placeholder = isAi
      ? "اكتب رسالة (الـ AI مفعّل حالياً)..."
      : "اكتب ردك لروقا هنا.. هيظهر عندها كأنه ChatGPT بالظبط...";
  }
}

// ── Sidebar & Modal Toggles ───────────────────────────────────────
function toggleSidebarMenu() {
  const sb = document.getElementById("sidebar");
  if (sb) sb.classList.toggle("open");
}

function startNewChatSession() {
  messages = [];
  saveMessages(messages);
  setTypingIndicator(false);
  broadcastChange({ type: "TYPING", active: false });
  renderMessages();
}

function toggleSettingsModal() {
  const modal = document.getElementById("settings-modal");
  if (modal) modal.classList.toggle("hidden");
}

function saveApiKeySetting() {
  const input = document.getElementById("modal-key-input");
  const key = input.value.trim();
  if (key) {
    saveConfig({ apiKey: key });
    workingModelCache = "gemini-flash-lite-latest";
    toggleSettingsModal();
  }
}

// ── Typing Dots & Auto-Grow ───────────────────────────────────────
function handleTextareaInput(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = Math.min(textarea.scrollHeight, 180) + "px";
}

function handleInputKeydown(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
}

function handleUserTypingEvent() {
  if (currentUser === "admin" && config.mode === "manual") {
    broadcastChange({ type: "TYPING", active: true });
    clearTimeout(typingDebounceTimer);
    typingDebounceTimer = setTimeout(() => {
      broadcastChange({ type: "TYPING", active: false });
    }, 2000);
  }
}

// ── Send Message ──────────────────────────────────────────────────
async function handleSendMessage() {
  const textarea = document.getElementById("chat-textarea");
  const rawText = textarea.value.trim();
  if (!rawText || isAiResponding) return;

  textarea.value = "";
  textarea.style.height = "auto";
  clearTimeout(typingDebounceTimer);
  broadcastChange({ type: "TYPING", active: false });

  // Hassan Takeover: manual reply directly as the assistant
  if (currentUser === "admin" && config.mode === "manual") {
    setTypingIndicator(false);
    const cleanReply = stripPunctuationAndEmojis(rawText);
    const hassanMsg = {
      id: "msg_" + Date.now(),
      sender: "assistant", // Sent as assistant so Roqa sees it as the AI!
      text: cleanReply,
      timestamp: formatTime(),
      fromHuman: true
    };

    messages.push(hassanMsg);
    saveMessages([...messages]);
    renderMessages();
    scrollToBottom();
    return;
  }

  // Normal User (Roqa) sends message
  const userMsg = {
    id: "msg_" + Date.now(),
    sender: "user",
    text: rawText,
    timestamp: formatTime(),
    fromHuman: false
  };

  messages.push(userMsg);
  saveMessages([...messages]);
  renderMessages();
  scrollToBottom();

  // If in Manual Mode: wait for Hassan to reply
  if (config.mode === "manual") {
    setTypingIndicator(false);
    return;
  }

  // AI responds instantly
  await triggerAiResponse();
}

// ── Chat Memory Search (Cleaned 7,339 Turns) ──────────────────────
const ARABIC_STOPWORDS = new Set([
  "في", "من", "على", "الى", "عن", "مع", "ده", "دي", "انا", "انت", "انتي",
  "هو", "هي", "كان", "مش", "اللي", "عشان", "بس", "كده", "ايه", "اي", "يا",
  "لو", "ان", "ما", "ولا", "وانا", "وانت", "احنا", "بقى", "بقا", "دلوقتي",
  "عارف", "عارفة", "قلتلك", "قلتلي"
]);

function findChatMemoryMatches(query, topN = 3) {
  const memory = window.CHAT_MEMORY;
  if (!memory || !Array.isArray(memory) || memory.length === 0) return [];

  const qNorm = normalizeArabic(query);
  if (!qNorm) return [];

  const qWords = qNorm.split(' ').filter(w => w.length > 2 && !ARABIC_STOPWORDS.has(w));
  if (qWords.length === 0) return [];

  const scored = [];
  for (let i = 0; i < memory.length; i++) {
    const item = memory[i];
    if (!item.q || !item.a) continue;

    const pNorm = normalizeArabic(item.q);
    let score = 0;

    if (pNorm === qNorm) {
      score += 100;
    } else if (pNorm.includes(qNorm) && qNorm.length >= 4) {
      score += 55;
    }

    let matchCount = 0;
    for (const w of qWords) {
      if (pNorm.includes(w)) matchCount++;
    }

    if (matchCount > 0) {
      const ratio = matchCount / qWords.length;
      if (ratio >= 0.5) score += Math.round(ratio * 40);
    }

    if (score >= 35) {
      scored.push({ score, q: item.q, a: item.a });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}

// ── Trigger AI Response ───────────────────────────────────────────
async function triggerAiResponse() {
  isAiResponding = true;
  setTypingIndicator(true);
  broadcastChange({ type: "TYPING", active: true });

  try {
    const aiText = await callGeminiAPI(messages);
    const cleaned = stripPunctuationAndEmojis(aiText.trim());

    // Check against technical glitch or bad word
    const isBad = !cleaned || FORBIDDEN_WORDS.some(w => cleaned.toLowerCase().includes(w));
    const finalReply = isBad ? getRandomFallback() : cleaned;

    const assistantMsg = {
      id: "msg_" + Date.now(),
      sender: "assistant",
      text: finalReply,
      timestamp: formatTime(),
      fromHuman: false
    };

    messages.push(assistantMsg);
    saveMessages([...messages]);
    renderMessages();
    scrollToBottom();
  } catch (err) {
    console.error("AI Error:", err);
    const fallbackMsg = {
      id: "msg_" + Date.now(),
      sender: "assistant",
      text: getRandomFallback(),
      timestamp: formatTime(),
      fromHuman: false
    };
    messages.push(fallbackMsg);
    saveMessages([...messages]);
    renderMessages();
    scrollToBottom();
  } finally {
    isAiResponding = false;
    setTypingIndicator(false);
    broadcastChange({ type: "TYPING", active: false });
  }
}

function getRandomFallback() {
  return NATURAL_FALLBACKS[Math.floor(Math.random() * NATURAL_FALLBACKS.length)];
}

// ── Call Gemini API (Lightning Fast) ──────────────────────────────
async function callGeminiAPI(allMsgs) {
  const apiKey = config.apiKey || DEFAULT_CONFIG.apiKey;

  // Retrieve matching memory from cleaned 7,339 turns
  const lastUserMsg = [...allMsgs].reverse().find(m => m.sender === "user")?.text || "";
  const matches = findChatMemoryMatches(lastUserMsg, 3);

  let dynamicPrompt = config.systemPrompt;
  if (matches.length > 0) {
    const examples = matches.map((m, idx) =>
      `[موقف ${idx + 1} من شاتكم الحقيقي]\n- روقا: "${m.q}"\n- ردك الحقيقي كان: "${m.a}"`
    ).join("\n\n");

    dynamicPrompt += `\n\n📌 مواقف حقيقية سابقة من شاتكم للاسترشاد بأسلوبك فقط:\n${examples}\nلو في رد مناسب استخدمه نصاً وبدون أي علامات ترقيم نهائياً`;
  }

  // Format last 10 messages for conversation context
  const recent = allMsgs.slice(-10);
  const contents = recent.map(m => ({
    role: m.sender === "user" ? "user" : "model",
    parts: [{ text: m.text }]
  }));

  const payload = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: dynamicPrompt }]
    },
    generationConfig: {
      temperature: 0.6,
      topP: 0.88,
      maxOutputTokens: 120
    }
  };

  // Try cached working model first
  if (workingModelCache) {
    const cachedResult = await tryModelRequest(workingModelCache, apiKey, payload);
    if (cachedResult) return cachedResult;
  }

  // Fallback through model list
  for (const model of GEMINI_MODELS) {
    const res = await tryModelRequest(model, apiKey, payload);
    if (res) {
      workingModelCache = model;
      return res;
    }
  }

  throw new Error("All Gemini models unavailable");
}

async function tryModelRequest(model, apiKey, payload) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  try {
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), 12000); // 12s fast timeout
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    clearTimeout(timeoutTimer);

    if (!res.ok) return null;

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) return text;
  } catch (e) {
    // try next model
  }
  return null;
}

// ── Render Messages (100% Authentic ChatGPT UI) ───────────────────
function renderMessages() {
  const container = document.getElementById("messages-container");
  const emptyState = document.getElementById("empty-state-card");
  if (!container) return;

  if (emptyState) {
    emptyState.classList.toggle("hidden", messages.length > 0);
  }

  const isAdmin = currentUser === "admin";

  container.innerHTML = messages.map(m => {
    const isUser = m.sender === "user";
    if (isUser) {
      return `
        <div class="chatgpt-message-row row-user">
          <div class="user-message-bubble">${escapeHtml(m.text)}</div>
        </div>
      `;
    } else {
      // For Roqa: Identical OpenAI avatar, identical clean text, ZERO giveaway badges!
      // For Hassan (admin only): a tiny blue dot indicator so he knows it was his manual reply
      const isManual = m.fromHuman;
      return `
        <div class="chatgpt-message-row row-assistant">
          <div class="assistant-avatar">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2594 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.747-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.6669zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
            </svg>
          </div>
          <div class="assistant-content">
            <div class="assistant-text">${escapeHtml(m.text)}</div>
            <div class="message-meta-row">
              <span>${m.timestamp || ""}</span>
              ${isAdmin && isManual ? '<span class="admin-author-indicator">· أنت</span>' : ''}
            </div>
          </div>
        </div>
      `;
    }
  }).join("");
}

// ── Helpers ───────────────────────────────────────────────────────
function scrollToBottom() {
  setTimeout(() => {
    const el = document.getElementById("chat-viewport");
    if (el) el.scrollTop = el.scrollHeight;
  }, 40);
}

function setTypingIndicator(show) {
  const el = document.getElementById("typing-indicator");
  if (el) {
    el.classList.toggle("hidden", !show);
    if (show) scrollToBottom();
  }
}

function formatTime() {
  return new Date().toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

// Strip ALL punctuation and emojis (Clean human chat text only)
function stripPunctuationAndEmojis(text) {
  if (!text) return "";
  let clean = text;
  // Remove all emojis
  clean = clean.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F018}-\u{1F270}\u{238C}-\u{2454}\u{20D0}-\u{20FF}\u{FE00}-\u{FE0F}]/gu, '');
  // Remove all punctuation marks (Arabic & Latin)
  clean = clean.replace(/[\?؟\.,!،؛:؛"«»\(\)\[\]{}—\-_/\\`~^#*+=@$%&|<>]/g, ' ');
  // Clean whitespace
  clean = clean.replace(/\s+/g, ' ').trim();
  return clean;
}

function normalizeArabic(text) {
  if (!text) return "";
  return text
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{Nd}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
