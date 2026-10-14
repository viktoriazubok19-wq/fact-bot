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
  .text("🔮 Предсказание из тапка").row()
  .text("📰 Санькины новости").row()
  .text("👟 Кто ты?").resized();

// ============================================
// УЮТНЫЕ ФРАЗЫ: сова общается с читателем
// ============================================
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Сервер Render живёт по всемирному времени (UTC), а мы — по московскому.
// Поэтому все часы и даты бот сверяет по нашему поясу.
const BOT_TIMEZONE = "Europe/Moscow";
const localHour = (d) => Number(d.toLocaleTimeString("ru-RU", { timeZone: BOT_TIMEZONE, hour: "numeric", hour12: false }));
const localDate = (d) => d.toLocaleDateString("ru-RU", { timeZone: BOT_TIMEZONE });

// Приветствие зависит от времени суток
function dayGreeting() {
  const h = localHour(new Date());
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

// Цветовые темы карточек: тёплая — для фактов, магическая — для предсказаний
const THEMES = {
  warm: {
    bg1: "#fff8ef", bg2: "#fde8d0",      // фон-градиент
    accent1: "#e8a87c", accent2: "#d97b66", // полоска и звёзды
    header: "#b0603f",                    // шапка
    subtitle: "#c9a27e",                  // подзаголовок
    text: "#4a3b2f",                      // основной текст
  },
  mystic: {
    bg1: "#f7f3ff", bg2: "#e9ddff",
    accent1: "#9b7ede", accent2: "#7a5cc0",
    header: "#6b4fa8",
    subtitle: "#9b85c9",
    text: "#3f3560",
  },
};

// Рисуем PNG-карточку (1080×1350 — крупно на экране)
function renderCard(text, themeName, subtitle) {
  const t = THEMES[themeName];
  const W = 1080, H = 1350;
  const lines = wrapText(text, 22);
  const lineHeight = 62;
  let tspans = "";
  lines.forEach((l, i) => {
    // XML-экранирование: кавычки и угловые скобки в тексте сломали бы SVG
    const safe = l.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    tspans += `<tspan x="120" dy="${i === 0 ? 0 : lineHeight}">${safe}</tspan>`;
  });
  const textTop = Math.round(H / 2 - (lines.length * lineHeight) / 2 + 60);
  // Вторая звёздочка — сразу после подзаголовка
  const star2X = 152 + subtitle.length * 17 + 16;

  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${t.bg1}"/>
      <stop offset="1" stop-color="${t.bg2}"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${t.accent1}"/>
      <stop offset="1" stop-color="${t.accent2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W - 120}" cy="140" r="180" fill="#ffffff" opacity="0.35"/>
  <circle cx="100" cy="${H - 120}" r="200" fill="#ffffff" opacity="0.3"/>
  <circle cx="${W - 60}" cy="${H - 300}" r="90" fill="#ffffff" opacity="0.25"/>
  <rect x="60" y="60" width="${W - 120}" height="${H - 120}" rx="48" fill="#ffffff" opacity="0.92"/>
  <rect x="60" y="60" width="${W - 120}" height="14" rx="7" fill="url(#accent)"/>
  <text x="120" y="200" font-family="Noto Sans" font-weight="700" font-size="40" fill="${t.header}" letter-spacing="9">СОВУШКА В ТАПКАХ</text>
  <path d="M 124 262 l 5 10 10.5 1.5 -7.5 7.5 1.8 10.5 -10 -5.2 -10 5.2 1.8 -10.5 -7.5 -7.5 10.5 -1.5 z" fill="${t.accent2}"/>
  <text x="152" y="276" font-family="Noto Sans" font-size="33" fill="${t.subtitle}">${subtitle}</text>
  <path d="M ${star2X} 262 l 5 10 10.5 1.5 -7.5 7.5 1.8 10.5 -10 -5.2 -10 5.2 1.8 -10.5 -7.5 -7.5 10.5 -1.5 z" fill="${t.accent2}"/>
  <text x="120" y="${textTop}" font-family="Noto Sans" font-size="58" fill="${t.text}">${tspans}</text>
  <text x="120" y="${H - 110}" font-family="Noto Sans" font-size="30" fill="${t.subtitle}">t.me/fact_gn_bot</text>
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

// Кэш: карточка каждого текста рисуется только один раз
const cardCache = new Map();
function factCard(fact) {
  if (!cardCache.has(fact)) cardCache.set(fact, renderCard(fact, "warm", "факт дня"));
  return cardCache.get(fact);
}

function fortuneCard(fortune) {
  const key = "F:" + fortune;
  if (!cardCache.has(key)) cardCache.set(key, renderCard("«" + fortune + "»", "mystic", "предсказание дня"));
  return cardCache.get(key);
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

// ============================================
// ПРЕДСКАЗАНИЯ ИЗ ТАПКА 🔮
// Сова достаёт из тапка бумажку с предсказанием.
// ============================================
import { readFileSync as readFortunes } from "node:fs";
const fortunes = JSON.parse(readFortunes("./fortunes.json", "utf-8"));

const fortuneCaptions = [
  "Сова запустила лапу глубоко в тапок и достала...",
  "В тапке нашлась мятая бумажка. Разворачиваем...",
  "Предсказание из тапка, только что вынутое:",
  "Тапок пошептался с судьбой и выдал:",
  "Санёк клянётся, что не подкладывал. Читаем:",
];

async function sendFortune(ctx) {
  const keyboard = new InlineKeyboard().text("🔮 Ещё!", "fortune");
  const fortune = pick(fortunes);
  await ctx.replyWithPhoto(new InputFile(fortuneCard(fortune)), {
    caption: pick(fortuneCaptions),
    reply_markup: keyboard,
  });
}

bot.command("fortune", sendFortune);
bot.hears("🔮 Предсказание из тапка", sendFortune);
bot.callbackQuery("fortune", async (ctx) => {
  ctx.answerCallbackQuery();
  await sendFortune(ctx);
});

// Справка о боте — общий текст для /info и кнопки
function infoText() {
  return (
    `👟 Меня зовут «Совушка в тапках».\n\n` +
    `Что я умею:\n` +
    `🦉 Кнопка «Дай факт» — случайный факт\n` +
    `🎯 Кнопка «Хочу тапку-загадку!» — викторина в любой момент\n` +
    `🔮 Кнопка «Предсказание из тапка» — что день грядущий нам готовит\n` +
    `📰 Кнопка «Санькины новости» — вечерний выпуск\n` +
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
    "Конечно есть! Это Санёк — он приходит по вечерам с термосом, и мы вместе сидим в тапках и отбираю лучшие факты. Ну, точнее: я отбираю, а он читает вслух и подкладывает мне семечки. Говорит, это «контроль качества» 🦉🌰",
    "Есть у меня один друг — Санёк! Каждым вечером заходит: сядет в моё любимое кресло, наденет мои запасные тапки (наглость!) и мы вместе перекладываем факты: я каркаю на скучные, он смеётся на смешные. Идеальная команда! 🥿",
    "Друзья — это святое! Мой лучший друг Санёк навещает меня по вечерам. Мы пьём чай и сортирую факты на «мудрые» и «ну очень мудрые». Он единственный, кому я разрешаю трогать мою газету. Даже ты не можешь, а он может! 📰",
    "Ага! Санёк — мой друг и помощник. Приходит по вечерам, мы устраиваем «фактоднюшку»: он выкрикивает факт, я решаю — достоин твоих тапок или нет. Бракованные идут в совиную копилку на чёрный день 🦉📚",
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
// Санёк сам присылает свежий выпуск подписчикам.
// ============================================
import { readFileSync as readNews } from "node:fs";
const news = JSON.parse(readNews("./news.json", "utf-8"));

function sendNews(api, chatId) {
  return api.sendMessage(chatId, pick(news));
}

bot.command("news", (ctx) => sendNews(ctx.api, ctx.chat.id));
bot.hears("📰 Санькины новости", (ctx) => sendNews(ctx.api, ctx.chat.id));

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

// Постоянные подписчики: вшиты в код, чтобы Render не потерял их
// при обновлениях (файлы на сервере стираются при каждом деплое).
// Сюда можно добавить ещё chat_id друзей.
const BASE_SUBSCRIBERS = [962718072];

// Все подписчики: постоянные + те, что накопились в файле
function allSubscribers() {
  return [...new Set([...BASE_SUBSCRIBERS, ...loadSubscribers()])];
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
  // 9:00 утра по московскому времени (Render живёт по UTC!)
  if (localHour(now) !== 9 || now.getMinutes() !== 0) return;

  const today = localDate(now);
  if (existsSync(SENT_FILE) && readFile(SENT_FILE, "utf-8") === today) return;

  writeFileSync(SENT_FILE, today);
  for (const chatId of allSubscribers()) {
    try {
      await bot.api.sendMessage(chatId, `☀️ ${dayGreeting()} Доброе утро начинается не с кофе, а с викторины:`);
      await sendQuiz(bot.api, chatId);
    } catch (err) {
      console.error("Не удалось отправить", chatId, err.message);
    }
  }
}, 60_000); // проверка раз в минуту

// Вечерний выпуск Сашиных новостей — каждый день в 20:00 (по Москве)
setInterval(async () => {
  const now = new Date();
  if (localHour(now) !== 20 || now.getMinutes() !== 0) return;

  const today = localDate(now);
  if (existsSync(NEWS_SENT_FILE) && readFile(NEWS_SENT_FILE, "utf-8") === today) return;
  writeFileSync(NEWS_SENT_FILE, today);

  for (const chatId of allSubscribers()) {
    try {
      await bot.api.sendMessage(chatId, "🗞 «Санёк принёс свежую газету!»");
      await sendNews(bot.api, chatId);
    } catch (err) {
      console.error("Не удалось отправить новости", chatId, err.message);
    }
  }
}, 60_000);

// ----------------------------------------------------
// МИНИ-ПРИЛОЖЕНИЕ 🦉
// Тот же сервер отдаёт веб-страницу (public/index.html)
// и данные для неё: факты, викторину, предсказания, новости.
// Страница открывается прямо в Telegram через кнопку меню.
// ----------------------------------------------------
import { createServer } from "node:http";

function json(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*", // разрешаем запросы со страницы приложения
  });
  res.end(JSON.stringify(data));
}

const PORT = process.env.PORT || 3000;
createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");

  // API для мини-приложения
  if (url.pathname === "/api/fact") return json(res, { text: randomFact() });
  if (url.pathname === "/api/fortune") return json(res, { text: pick(fortunes) });
  if (url.pathname === "/api/news") return json(res, { text: pick(news) });

  // Викторина: выдаём вопрос БЕЗ правильного ответа,
  // чтобы нельзя было подсмотреть через инструменты разработчика
  if (url.pathname === "/api/quiz") {
    const qid = Math.floor(Math.random() * quiz.length);
    return json(res, { qid, question: quiz[qid].question, options: quiz[qid].options });
  }
  if (url.pathname === "/api/quiz/answer") {
    const qid = Number(url.searchParams.get("qid"));
    const choice = Number(url.searchParams.get("choice"));
    const q = quiz[qid];
    if (!q) return json(res, { error: "нет такого вопроса" });
    return json(res, {
      right: choice === q.correct,
      correct: q.correct,
      explanation: q.explanation,
    });
  }

  // Всё остальное — отдаём страницу приложения (или проверку живости)
  const page = existsSync("./public/index.html")
    ? readFile("./public/index.html", "utf-8")
    : "Bot is alive!";
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(page);
}).listen(PORT);

// Адрес мини-приложения: на Render он приходит в переменной RENDER_EXTERNAL_URL,
// локально — подставь свой адрес вручную
const WEB_APP_URL = process.env.RENDER_EXTERNAL_URL || "https://fact-bot-hzx8.onrender.com";

// Делаем «Открыть Совушку» кнопкой меню в чате
bot.api.setChatMenuButton({
  menu_button: { type: "web_app", text: "🦉 Открыть Совушку", web_app: { url: WEB_APP_URL } },
}).catch((err) => console.error("Кнопка меню не установилась:", err.message));

// Запускаем бота
console.log("Бот запущен! Жду сообщений... 🚀");
bot.start();
