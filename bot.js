// ============================================
// Telegram-бот «Совушка в тапках»
// Первый проект: Node.js + grammY
// ============================================

// dotenv подгружает файл .env в переменные окружения (process.env).
import "dotenv/config";

// grammY — библиотека для ботов. Импортируем из папки node_modules.
import { Bot, InlineKeyboard, Keyboard } from "grammy";

// Токен — секретный ключ бота. Мы храним его в файле .env,
// чтобы он не попал в код, который загрузим на GitHub.
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error("Ошибка: не задан BOT_TOKEN. Создай файл .env со строкой BOT_TOKEN=твой_токен");
  process.exit(1);
}

// Создаём бота
const bot = new Bot(token);

// Загружаем факты из файла facts.json
// У каждого факта два поля: text (что присылаем) и art (что рисуем)
import { readFileSync } from "node:fs";
const facts = JSON.parse(readFileSync("./facts.json", "utf-8"));

// Функция возвращает случайный факт (объект {text, art}) из массива
function randomFact() {
  const index = Math.floor(Math.random() * facts.length);
  return facts[index];
}

// /start — приветствие, когда человек первый раз пишет боту
// Отправляем сову-талисман (картинка лежит в папке проекта), текст — подписью к ней
import { InputFile } from "grammy";

// Красивые кнопки внизу экрана (ReplyKeyboard) — видны всегда
const menuKeyboard = new Keyboard()
  .text("🦉 Дай факт").row()
  .text("🎯 Хочу тапку-загадку!").row()
  .text("👟 Кто ты?").row()
  .text("📰 Сашины новости").resized();

// ============================================
// УЮТНЫЕ ФРАЗЫ: сова общается с читателем
// ============================================
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Приветствие зависит от времени суток
function dayGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Доброе утро! Чайник уже закипел ☕️";
  if (h >= 12 && h < 18) return "Добрый день! Тапки на месте, я на посту 🥿";
  if (h >= 18 && h < 23) return "Добрый вечер! Самое уютное время для фактов 🌙";
  return "Ой, кто-то не спит! Ночные факты — самые загадочные ✨";
}

// Случайные фразы-подписи к фактам
const factCaptions = [
  "Устраивайся поудобнее, сейчас будет интересно...",
  "Из глубин совиных знаний:",
  "Сова нашла это под диваном:",
  "Держи, только из печки, ещё тёплый!",
  "Один удивительный факт, как по заказу:",
  "Совушка выглянула в окно и рассказала:",
  "Сегодня в рубрике «Оказывается»:",
  "Наливай чай, история длинной в одну тапку:",
];

// Похвалы за правильный ответ
const quizPraise = [
  "Тапки тебе по размеру! 🥿",
  "Сова аплодирует крыльями!",
  "Мозг в идеальной форме — сова одобряет!",
  "Вот это попадание! Даже чайник вскипел от гордости ☕️",
  "Блестяще! Совушка записывает тебя в почётные совята 🦉",
];

// Подбадривания за неправильный ответ
const quizSupport = [
  "Ничего страшного, сова тоже иногда засыпает на уроках 😊",
  "Бывает! Зато теперь знаешь — и это главное.",
  "Не расстраивайся, этот факт знает только сова. И теперь ты!",
  "Мимо тапки! Но за старание — бонусный факт:",
  "Ошибиться — просто узнать новое. Обнимашки совушки 🤗",
];

bot.command("start", async (ctx) => {
  await ctx.replyWithPhoto(new InputFile("./owl.jpg"), {
    caption:
      `🥿 Добро пожаловать в «Совушку в тапках»!\n\n` +
      `Привет, ${ctx.from.first_name}! ${dayGreeting()}\n\n` +
      `Я — самый уютный бот в Telegram. Каждое утро в 9:00 я надеваю свои ` +
      `любимые тапки, завариваю чай и достаю для тебя из-под дивана ` +
      `один удивительный факт о мире. 🌍✨\n\n` +
      `Смотри, внизу появились кнопки — жми «🦉 Дай факт» и наслаждайся!`,
    reply_markup: menuKeyboard,
  });
});

// ============================================
// Карточки фактов: рисуем красивую картинку
// с текстом факта через SVG + resvg.
// ============================================
import { Resvg } from "@resvg/resvg-js";

// Перенос текста по словам, ~22 символа на строку
function wrapText(text, maxLen) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > maxLen) { lines.push(line.trim()); line = w; }
    else line += " " + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

// Рисуем PNG-карточку с фактом (1080×1350 — крупно на экране)
function renderFactCard(fact) {
  const W = 1080, H = 1350;
  const lines = wrapText(fact, 22);
  const lineHeight = 62;
  let tspans = "";
  lines.forEach((l, i) => {
    // XML-экранирование: кавычки и угловые скобки в тексте сломали бы SVG
    const safe = l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    tspans += `<tspan x="120" dy="${i === 0 ? 0 : lineHeight}">${safe}</tspan>`;
  });
  const textTop = Math.round(H / 2 - (lines.length * lineHeight) / 2 + 60);

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff8ef"/>
      <stop offset="1" stop-color="#fde8d0"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#e8a87c"/>
      <stop offset="1" stop-color="#d97b66"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W - 120}" cy="140" r="180" fill="#ffffff" opacity="0.35"/>
  <circle cx="100" cy="${H - 120}" r="200" fill="#ffffff" opacity="0.3"/>
  <circle cx="${W - 60}" cy="${H - 300}" r="90" fill="#ffffff" opacity="0.25"/>
  <rect x="60" y="60" width="${W - 120}" height="${H - 120}" rx="48" fill="#ffffff" opacity="0.92"/>
  <rect x="60" y="60" width="${W - 120}" height="14" rx="7" fill="url(#accent)"/>
  <text x="120" y="200" font-family="Noto Sans" font-weight="700" font-size="40" fill="#b0603f" letter-spacing="9">СОВУШКА В ТАПКАХ</text>
  <path d="M 124 262 l 5 10 10.5 1.5 -7.5 7.5 1.8 10.5 -10 -5.2 -10 5.2 1.8 -10.5 -7.5 -7.5 10.5 -1.5 z" fill="#d97b66"/>
  <text x="152" y="276" font-family="Noto Sans" font-size="33" fill="#c9a27e">факт дня</text>
  <path d="M 320 262 l 5 10 10.5 1.5 -7.5 7.5 1.8 10.5 -10 -5.2 -10 5.2 1.8 -10.5 -7.5 -7.5 10.5 -1.5 z" fill="#d97b66"/>
  <text x="120" y="${textTop}" font-family="Noto Sans" font-size="58" fill="#4a3b2f">${tspans}</text>
  <text x="120" y="${H - 110}" font-family="Noto Sans" font-size="30" fill="#c9a27e">t.me/fact_gn_bot</text>
  <g transform="translate(${W - 280}, ${H - 360}) scale(0.92)">
    <ellipse cx="95" cy="120" rx="95" ry="105" fill="#b0603f"/>
    <path d="M 20 50 L 45 5 L 65 45 Z" fill="#b0603f"/>
    <path d="M 170 50 L 145 5 L 125 45 Z" fill="#b0603f"/>
    <ellipse cx="95" cy="140" rx="62" ry="70" fill="#f5ddc1"/>
    <circle cx="60" cy="90" r="30" fill="#ffffff"/>
    <circle cx="130" cy="90" r="30" fill="#ffffff"/>
    <circle cx="63" cy="93" r="13" fill="#3d2c1e"/>
    <circle cx="127" cy="93" r="13" fill="#3d2c1e"/>
    <circle cx="67" cy="89" r="4.5" fill="#ffffff"/>
    <circle cx="131" cy="89" r="4.5" fill="#ffffff"/>
    <path d="M 95 112 L 82 128 L 95 142 L 108 128 Z" fill="#e8a35c"/>
    <path d="M 55 165 q 40 22 80 0" stroke="#d9964f" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M 60 182 q 35 20 70 0" stroke="#d9964f" stroke-width="5" fill="none" stroke-linecap="round"/>
    <ellipse cx="30" cy="235" rx="26" ry="12" fill="#b0603f"/>
    <ellipse cx="160" cy="235" rx="26" ry="12" fill="#b0603f"/>
  </g>
</svg>`;

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: W },
    font: { fontFiles: ["fonts/NotoSans-Regular.ttf", "fonts/NotoSans-Bold.ttf"], loadSystemFonts: false },
  });
  return Buffer.from(resvg.render().asPng());
}

// Кэш: карточка каждого факта рисуется только один раз
const cardCache = new Map();
function factCard(fact) {
  if (!cardCache.has(fact)) cardCache.set(fact, renderFactCard(fact));
  return cardCache.get(fact);
}

// /fact — выдать случайный факт карточкой
async function sendFact(ctx) {
  const keyboard = new InlineKeyboard().text("🎲 Ещё!", "more");
  const fact = randomFact();
  await ctx.replyWithPhoto(new InputFile(factCard(fact)), {
    caption: pick(factCaptions),
    reply_markup: keyboard,
  });
}

// Справка о боте — общий текст для /info и кнопки
function infoText() {
  return (
    `👟 Меня зовут «Совушка в тапках».\n\n` +
    `Что я умею:\n` +
    `🦉 Кнопка «Дай факт» — случайный факт\n` +
    `🎯 Кнопка «Хочу тапку-загадку!» — викторина в любой момент\n` +
    `🎲 Кнопка «Ещё!» — тапок за тапком\n` +
    `☕️ В 9:00 утра — викторина дня, как кофе, только для мозга\n\n` +
    `Уютного познания! 🧠✨`
  );
}

bot.command("fact", sendFact);
bot.command("info", (ctx) => ctx.reply(infoText()));

// Реакция на красивые кнопки внизу — то же самое, что команды
bot.hears("🦉 Дай факт", sendFact);
bot.hears("🎯 Хочу тапку-загадку!", (ctx) => sendQuiz(ctx.api, ctx.chat.id));
bot.hears("👟 Кто ты?", (ctx) => ctx.reply(infoText(), { reply_markup: menuKeyboard }));

// Простые разговорные фразы — сова поддерживает беседу
bot.hears(/(как дела|как ты|что делаешь|привет|здравствуй|хай|доброе утро|добрый вечер|добрый день)/i, (ctx) => {
  ctx.reply(pick([
    `Всё уютно: тапки греты, чай налит, факты разложены по полочкам! ${dayGreeting()} А у тебя как? 😊`,
    "Я тут подметаю знания по углам и жду тебя! Спроси что-нибудь — например, жми «🦉 Дай факт» 🥿",
    `${dayGreeting()} Сова к твоим услугам! Хочешь факт или викторину? 🦉`,
    "Отлично! Сегодня сова особенно мудрая — надо использовать! 🧠✨",
  ]));
});

// Вопрос про друзей — история про Сашу 🦉
bot.hears(/(друг|подруг|друзей|друзья|одинок)/i, (ctx) => {
  ctx.reply(pick([
    "Конечно есть! Это Саша — он приходит по вечерам с термосом, и мы вместе сидим в тапках и отбираю лучшие факты. Ну, точнее: я отбираю, а он читает вслух и подкладывает мне семечки. Говорит, это «контроль качества» 🦉🌰",
    "Есть у меня один друг — Саша! Каждым вечером заходит: сядет в моё любимое кресло, наденет мои запасные тапки (наглость!) и мы вместе перекладываем факты: я каркаю на скучные, он смеётся на смешные. Идеальная команда! 🥿",
    "Друзья — это святое! Мой лучший друг Саша навещает меня по вечерам. Мы пьём чай и сортирую факты на «мудрые» и «ну очень мудрые». Он единственный, кому я разрешаю трогать мою газету. Даже ты не можешь, а он может! 📰",
    "Ага! Саша — мой друг и помощник. Приходит по вечерам, мы устраиваем «фактоднюшку»: он выкрикивает факт, я решаю — достоин твоих тапок или нет. Бракованные идут в совиную копилку на чёрный день 🦉📚",
  ]));
});

// Обработка нажатия на кнопку «Ещё!»
bot.callbackQuery("more", async (ctx) => {
  ctx.answerCallbackQuery(); // убираем «часики» на кнопке
  await sendFact(ctx); // та же логика, что и у команды /fact
});

// =====================================================
// ВИКТОРИНА 🎯
// Вопросы лежат в quiz.json. В inline-кнопки зашиваем
// номер вопроса и номер ответа (callback data), поэтому
// состояние хранить не нужно — правильный ответ берём
// из quiz.json по номеру вопроса.
// =====================================================
import { readFileSync as readQuizFile } from "node:fs";
const quiz = JSON.parse(readQuizFile("./quiz.json", "utf-8"));

// Выслать случайный вопрос с тремя вариантами ответа
function sendQuiz(api, chatId) {
  const qid = Math.floor(Math.random() * quiz.length);
  const q = quiz[qid];
  const keyboard = new InlineKeyboard()
    .text(q.options[0], `quiz:${qid}:0`).row()
    .text(q.options[1], `quiz:${qid}:1`).row()
    .text(q.options[2], `quiz:${qid}:2`);
  return api.sendMessage(chatId,
    `🎯 Викторина!\n\n${q.question}\n\n⏱ Думай, тапки не спешат...`,
    { reply_markup: keyboard }
  );
}

bot.command("quiz", (ctx) => sendQuiz(ctx.api, ctx.chat.id));

// Нажатие на вариант ответа
bot.callbackQuery(/^quiz:(\d+):(\d+)$/, async (ctx) => {
  const qid = Number(ctx.match[1]);
  const chosen = Number(ctx.match[2]);
  const q = quiz[qid];
  const right = chosen === q.correct;

  ctx.answerCallbackQuery(); // убираем «часики»
  await ctx.editMessageReplyMarkup({ reply_markup: undefined }); // гасим кнопки
  if (right) react(ctx.chat.id, ctx.update.callback_query.message.message_id, "🤩"); // аплодисменты
  await ctx.reply(
    (right
      ? `✅ Точно! ${pick(quizPraise)}\n\n`
      : `❌ Почти! Правильный ответ: «${q.options[q.correct]}».\n\n${pick(quizSupport)}\n\n`) +
    `🧠 ${q.explanation}`
  );
  // Бонус — утешительный/праздновательный факт
  await sendFact(ctx);
});

// =====================================================
// РЕАКЦИИ-ЭМОДЗИ ❤️🔥
// Если человек хвалит бота (или просто пишет доброе слово),
// бот ставит эмодзи-реакцию на это сообщение, как живой.
// Только определённые эмодзи разрешены Telegram для реакций —
// берём из разрешённого списка.
// =====================================================
const reactions = ["👍", "❤", "🔥", "🥰", "🤩"];

// Ставим реакцию на сообщение (если Telegram откажет — молча пропускаем)
function react(chatId, messageId, emoji) {
  return bot.api
    .setMessageReaction(chatId, messageId, [{ type: "emoji", emoji }])
    .catch(() => {});
}

bot.hears(
  /(спасибо|благодарю|молодец|молодчин[ау]|класс|супер|круто|люблю|умница|обожаю)/i,
  async (ctx) => {
    // случайная реакция из «тёплого» набора
    const emoji = reactions[Math.floor(Math.random() * reactions.length)];
    await react(ctx.chat.id, ctx.message.message_id, emoji);
  }
);
// ============================================
// САШИНЫ НОВОСТИ 📰
// Вечерние сводки из совиного мира.
// По кнопке — в любой момент, а в 20:00
// Саша сам присылает свежий выпуск подписчикам.
// ============================================
import { readFileSync as readNews } from "node:fs";
const news = JSON.parse(readNews("./news.json", "utf-8"));

function sendNews(api, chatId) {
  return api.sendMessage(chatId, pick(news));
}

bot.command("news", (ctx) => sendNews(ctx.api, ctx.chat.id));
bot.hears("📰 Сашины новости", (ctx) => sendNews(ctx.api, ctx.chat.id));

// =====================================================
// Ежедневная рассылка в 9:00
// Раз в минуту бот проверяет время: если настало 9:00
// и рассылка сегодня ещё не была — шлёт всем подписчикам
// утреннюю викторину (а бонусный факт — после ответа).
// =====================================================
import { existsSync, writeFileSync, readFileSync as readFile } from "node:fs";

const SUBS_FILE = "./subscribers.json";
const SENT_FILE = "./last_sent.txt";
const NEWS_SENT_FILE = "./news_sent.txt";

function loadSubscribers() {
  if (!existsSync(SUBS_FILE)) return [];
  try {
    return JSON.parse(readFile(SUBS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

// Каждому новому пользователю сохраняем его chat_id
function saveSubscriber(chatId) {
  const subs = loadSubscribers();
  if (!subs.includes(chatId)) {
    subs.push(chatId);
    writeFileSync(SUBS_FILE, JSON.stringify(subs, null, 2));
    console.log("Новый подписчик:", chatId);
  }
}

bot.use((ctx, next) => {
  if (ctx.chat) saveSubscriber(ctx.chat.id);
  return next();
});

setInterval(async () => {
  const now = new Date();
  // Часовой пояс пользователя — 9:00 утра. Проверяем и час, и минуту.
  if (now.getHours() !== 9 || now.getMinutes() !== 0) return;

  const today = now.toDateString();
  if (existsSync(SENT_FILE) && readFile(SENT_FILE, "utf-8") === today) return;

  writeFileSync(SENT_FILE, today);
  for (const chatId of loadSubscribers()) {
    try {
      await bot.api.sendMessage(chatId, `☀️ ${dayGreeting()} Доброе утро начинается не с кофе, а с викторины:`);
      await sendQuiz(bot.api, chatId);
    } catch (err) {
      console.error("Не удалось отправить", chatId, err.message);
    }
  }
}, 60_000); // проверка раз в минуту

// Вечерний выпуск Сашиных новостей — каждый день в 20:00
setInterval(async () => {
  const now = new Date();
  if (now.getHours() !== 20 || now.getMinutes() !== 0) return;

  const today = now.toDateString();
  if (existsSync(NEWS_SENT_FILE) && readFile(NEWS_SENT_FILE, "utf-8") === today) return;
  writeFileSync(NEWS_SENT_FILE, today);

  for (const chatId of loadSubscribers()) {
    try {
      await bot.api.sendMessage(chatId, "🗞 «Саша принёс свежую газету!»");
      await sendNews(bot.api, chatId);
    } catch (err) {
      console.error("Не удалось отправить новости", chatId, err.message);
    }
  }
}, 60_000);

// ----------------------------------------------------
// Мини HTTP-сервер: Render проверяет «жив ли бот» запросами
// на адрес порта. Без него бесплатный тариф отключит бота.
// ----------------------------------------------------
import { createServer } from "node:http";
const PORT = process.env.PORT || 3000;
createServer((req, res) => {
  res.writeHead(200);
  res.end("Bot is alive!");
}).listen(PORT);

// Запускаем бота
console.log("Бот запущен! Жду сообщений... 🚀");
bot.start();
