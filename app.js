const $ = (selector) => document.querySelector(selector);
const welcome = $("#welcome");
const log = $("#chat-log");
const form = $("#chat-form");
const input = $("#message");
const send = $("#send");
const statusText = $("#api-status-text");
const status = $(".api-status");
const modeTitle = $("#mode-title");
const sidebar = $(".sidebar");
let mode = "chat";
let history = [];

const modePrompts = {
  chat: "أنتقل إلى المحادثة العامة. ساعدني في طلبي التالي:",
  code: "أنتقل إلى Code Studio. ساعدني بكتابة أو مراجعة كود، مع شرح الملفات وخطوات التشغيل:",
  security: "أنتقل إلى Security Lab. ركّز على الأمن الدفاعي والأنظمة التي أملكها أو لدي تصريح بفحصها:"
};

async function checkHealth() {
  try {
    const response = await fetch("/api/health");
    const data = await response.json();
    status.classList.toggle("ok", data.apiConfigured);
    statusText.textContent = data.apiConfigured ? "API متصل بالإعدادات" : "أضف مفتاح API";
  } catch {
    statusText.textContent = "الخادم غير متاح";
  }
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[ch]));
}

// Lightweight safe formatter: escapes HTML first, then formats fenced code and inline code.
function formatText(value) {
  const escaped = escapeHTML(value);
  const blocks = [];
  const withPlaceholders = escaped.replace(/```([\w+-]*)\n?([\s\S]*?)```/g, (_match, lang, code) => {
    const token = `%%CODEBLOCK${blocks.length}%%`;
    blocks.push(`<pre><code>${code.trim()}</code></pre>`);
    return token;
  });
  const inline = withPlaceholders.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  return inline.replace(/%%CODEBLOCK(\d+)%%/g, (_match, index) => blocks[Number(index)] || "");
}

function addMessage(role, content, isError = false) {
  const row = document.createElement("div");
  row.className = `message-row ${role}`;
  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "أنت" : "F";
  const bubble = document.createElement("div");
  bubble.className = `bubble${isError ? " error" : ""}`;
  bubble.innerHTML = formatText(content);
  row.append(avatar, bubble);
  log.append(row);
  row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return row;
}

async function sendMessage(rawMessage) {
  const message = rawMessage.trim();
  if (!message || send.disabled) return;
  welcome.classList.add("hidden");
  addMessage("user", message);
  input.value = "";
  input.style.height = "auto";
  send.disabled = true;
  send.querySelector("span").textContent = "يفكر...";
  const pending = addMessage("assistant", "جاري تجهيز الإجابة…");
  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `${modePrompts[mode]}\n\n${message}`,
        history: history.slice(-10)
      })
    });
    const data = await response.json();
    pending.remove();
    if (!response.ok) {
      addMessage("assistant", data.error || "حدث خطأ غير متوقع.", true);
      return;
    }
    addMessage("assistant", data.answer);
    history.push({ role: "user", content: message }, { role: "assistant", content: data.answer });
    history = history.slice(-10);
  } catch {
    pending.remove();
    addMessage("assistant", "ما قدرت أتصل بالخادم. تأكد أن الموقع يعمل وأن الإنترنت متصل.", true);
  } finally {
    send.disabled = false;
    send.querySelector("span").textContent = "إرسال";
    input.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(input.value);
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 200)}px`;
});
input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

document.querySelectorAll(".nav-item").forEach((button) => {
  button.addEventListener("click", () => {
    mode = button.dataset.mode;
    document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item === button));
    modeTitle.textContent = button.textContent.trim();
    sidebar.classList.remove("open");
    if (log.children.length === 0) welcome.classList.remove("hidden");
    input.placeholder = mode === "security"
      ? "اكتب سؤالاً عن مراجعة أمان مشروع تملكه..."
      : mode === "code"
        ? "اكتب الكود أو صف المشروع الذي تريد بناءه..."
        : "اكتب طلبك هنا... اسأل، اكتب كود، أو اشرح مشكلة";
    input.focus();
  });
});

document.querySelectorAll(".suggestion").forEach((button) => {
  button.addEventListener("click", () => {
    input.value = button.dataset.prompt;
    sendMessage(input.value);
  });
});

$("#new-chat").addEventListener("click", () => {
  log.replaceChildren();
  history = [];
  welcome.classList.remove("hidden");
  input.value = "";
  sidebar.classList.remove("open");
});
$("#menu-toggle").addEventListener("click", () => sidebar.classList.toggle("open"));
document.addEventListener("click", (event) => {
  if (window.innerWidth <= 760 && sidebar.classList.contains("open")
      && !sidebar.contains(event.target) && !$("#menu-toggle").contains(event.target)) {
    sidebar.classList.remove("open");
  }
});

checkHealth();
