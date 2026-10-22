import "dotenv/config";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const port = Number(process.env.PORT || 3000);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(express.json({ limit: "40kb" }));
app.use("/api/", rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "طلبات كثيرة بسرعة. انتظر دقيقة وحاول مرة ثانية." }
}));

const systemPrompt = `أنت Folze AI Studio، مساعد عربي ودود ومتخصص في البرمجة والتعلّم.
ساعد في بناء المواقع والتطبيقات وشرح الأكواد وتصحيحها وتعلّم الأمن السيبراني ضمن بيئات يملكها المستخدم أو لديه تصريح مكتوب لاختبارها.
في Security Lab، ركّز على مراجعة الكود، النمذجة التهديدية، إعدادات الأمان، التحليل الدفاعي، المختبرات المحلية والتدريبية.
لا تساعد في سرقة الحسابات أو بيانات الاعتماد، البرمجيات الخبيثة، التخفي، تجاوز الحماية، استهداف أنظمة الغير، أو الغش الذي يضر لاعبين آخرين.
إذا كان الطلب خطراً، اشرح بإيجاز وقدّم بديلاً آمناً. اكتب الأكواد داخل كتل Markdown واشرح أين توضع وكيف تشغّلها. لا تدّعِ أنك نفّذت أو اختبرت كوداً لم تنفّذه فعلاً.`;

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, apiConfigured: Boolean(process.env.OPENAI_API_KEY) });
});

app.post("/api/chat", async (req, res) => {
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const history = Array.isArray(req.body?.history) ? req.body.history : [];

  if (!message) return res.status(400).json({ error: "اكتب رسالة أولاً." });
  if (message.length > 12000) return res.status(413).json({ error: "الرسالة طويلة جداً؛ اختصرها." });
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: "مفتاح API غير مضبوط. انسخ .env.example إلى .env وأضف مفتاحك على الخادم." });
  }

  const safeHistory = history.slice(-10).flatMap((item) => {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") return [];
    return [{ role: item.role, content: item.content.slice(0, 4000) }];
  });

  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...safeHistory,
        { role: "user", content: message }
      ],
      temperature: 0.5,
      max_tokens: 1800
    });
    const answer = completion.choices?.[0]?.message?.content?.trim();
    res.json({ answer: answer || "ما قدرت أجهّز إجابة. جرّب مرة ثانية." });
  } catch (error) {
    console.error("AI request failed:", error?.status || error?.message || "unknown error");
    const status = error?.status === 401 ? 502 : 502;
    res.status(status).json({
      error: error?.status === 401
        ? "مفتاح API غير صالح. راجع إعدادات الخادم."
        : "تعذّر الاتصال بخدمة الذكاء الاصطناعي. تحقّق من المفتاح والرصيد والاتصال."
    });
  }
});

app.use(express.static(path.join(__dirname, "public")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

app.listen(port, "0.0.0.0", () => {
  console.log(`Folze AI Studio running on http://localhost:${port}`);
});
