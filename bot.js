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

// Загружаем тапки из файла facts.json
import { readFileSync } from "node:fs";
const facts = JSON.parse(readFileSync("./facts.json", "utf-8"));

// Функция возвращает случайную тапку из массива
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
  .text("👟 Кто ты?").resized();

bot.command("start", async (ctx) => {
  await ctx.replyWithPhoto(new InputFile("./owl.jpg"), {
    caption:
      `🥿 Добро пожаловать в «Совушка в тапках»!\n\n` +
      `Привет, ${ctx.from.first_name}! Я — самый уютный бот в Telegram. ` +
      `Каждое утро в 9:00 я надеваю свои любимые тапки, завариваю чай ` +
      `и достаю для тебя из-под дивана один удивительный факт о мире. 🌍✨\n\n` +
      `Смотри, внизу появились кнопки — жми «🦉 Дай факт» и наслаждайся!`,
    reply_markup: menuKeyboard,
  });
});

// /fact — выдать случайный факт с картинкой и кнопкой «Ещё!»
async function sendFact(ctx) {
  const keyboard = new InlineKeyboard().text("🎲 Ещё!", "more");
  await ctx.replyWithChatAction("upload_photo");
  // picsum.photos отдаёт случайную красивую фотографию по ссылке
  await ctx.replyWithPhoto(`https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/500`, {
    caption: `💡 ${randomFact()}`,
    reply_markup: keyboard,
  });
}

// Справка о боте — общий текст для /info и кнопки
function infoText() {
  return (
    `👟 Меня зовут «Совушка в тапках».\n\n` +
    `Что я умею:\n` +
    `🦉 Кнопка «Дай факт» — случайный факт с картинкой\n` +
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

// Обработка нажатия на кнопку «Ещё!»
bot.callbackQuery("more", async (ctx) => {
  ctx.answerCallbackQuery(); // убираем «часики» на кнопке
  await ctx.replyWithChatAction("upload_photo");
  await ctx.replyWithPhoto(`https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/500`, {
    caption: `💡 ${randomFact()}`,
  });
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
  await ctx.reply(
    (right ? `✅ Точно! ` : `❌ Почти! Правильный ответ: «${q.options[q.correct]}».\n\n`) +
    `🧠 ${q.explanation}`
  );
  // Бонус — утешительный/праздновательный факт
  await sendFact(ctx);
});
// =====================================================
// Ежедневная рассылка в 9:00
// Раз в минуту бот проверяет время: если настало 9:00
// и рассылка сегодня ещё не была — шлёт всем подписчикам
// утреннюю викторину (а бонусный факт — после ответа).
// =====================================================
import { existsSync, writeFileSync, readFileSync as readFile } from "node:fs";

const SUBS_FILE = "./subscribers.json";
const SENT_FILE = "./last_sent.txt";

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
      await bot.api.sendMessage(chatId, `☀️ Доброе утро! Утро начинается не с кофе, а с викторины:`);
      await sendQuiz(bot.api, chatId);
    } catch (err) {
      console.error("Не удалось отправить", chatId, err.message);
    }
  }
}, 60_000); // проверка раз в минуту

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
