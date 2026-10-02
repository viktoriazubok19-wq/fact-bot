// ============================================
// Telegram-бот «Тапки дня»
// Первый проект: Node.js + grammY
// ============================================

// dotenv подгружает файл .env в переменные окружения (process.env).
import "dotenv/config";

// grammY — библиотека для ботов. Импортируем из папки node_modules.
import { Bot, InlineKeyboard } from "grammy";

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
bot.command("start", (ctx) => {
  ctx.reply(
    `Привет, ${ctx.from.first_name}! 👋\n\n` +
    `Я бот «Тапки дня». Каждое утро буду присылать тебе интересную тапку.\n\n` +
    `Команды:\n` +
    `/fact — получить тапку прямо сейчас\n` +
    `/info — что я умею`
  );
});

// /fact — выдать случайную тапку с картинкой и кнопкой «Ещё!»
bot.command("fact", async (ctx) => {
  const keyboard = new InlineKeyboard().text("🎲 Ещё!", "more");
  await ctx.replyWithChatAction("upload_photo");
  // picsum.photos отдаёт случайную красивую фотографию по ссылке
  await ctx.replyWithPhoto(`https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/500`, {
    caption: `💡 ${randomFact()}`,
    reply_markup: keyboard,
  });
});

// /info — справка
bot.command("info", (ctx) => {
  ctx.reply("Я умею присылать интересные тапки. Нажми /fact и узнаешь что-то новое! 🧠");
});

// Обработка нажатия на кнопку «Ещё!»
bot.callbackQuery("more", async (ctx) => {
  ctx.answerCallbackQuery(); // убираем «часики» на кнопке
  await ctx.replyWithChatAction("upload_photo");
  await ctx.replyWithPhoto(`https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/500`, {
    caption: `💡 ${randomFact()}`,
  });
});

// =====================================================
// Ежедневная рассылка в 9:00
// Пока у бота один подписчик (ты). Когда кто-то жмёт /start,
// его chat_id сохраняется в файл subscribers.json.
// Раз в минуту бот проверяет время: если настало 9:00
// и рассылка сегодня ещё не была — шлёт тапку всем подписчикам.
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
      await bot.api.sendPhoto(chatId, `https://picsum.photos/seed/${Math.floor(Math.random() * 1000)}/800/500`, {
        caption: `☀️ Доброе утро! Тапки дня:\n\n💡 ${randomFact()}`,
      });
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
