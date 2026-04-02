const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.sendStatus(200);

  next();
});

app.use(express.json());

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

let orders = {};

try {
  const data = fs.readFileSync("orders.json");
  orders = JSON.parse(data);
} catch {
  orders = {};
}

const ADMIN_ID = 827330746;
let lastMessages = {};


// ================= CREATE ORDER =================

app.post("/create-order", (req, res) => {
  const order = req.body;

  if (orders[String(order.orderNumber)]) {
    return res.json({ ok: true });
  }

  order.status = "new";
  order.clientChatId = null;

  orders[String(order.orderNumber)] = order;

  fs.writeFileSync("orders.json", JSON.stringify(orders, null, 2));

  let total = 0;
  order.cart.forEach(p => total += p.price);

  bot.sendMessage(ADMIN_ID, `
🆕 Нове замовлення №${order.orderNumber}

👤 ${order.name} ${order.surname}
📞 ${order.phone}

💰 ${total} грн
`);

  res.json({ ok: true });
});


// ================= CLIENT MESSAGE =================

bot.on("message", (msg) => {
  const chatId = msg.chat.id;

  // 👉 если пишет админ — игнорим тут
  if (chatId === ADMIN_ID) return;

  const match = msg.text.match(/\d{5,}/);
  const text = match ? match[0] : "";

  if (lastMessages[chatId] === text) return;
  lastMessages[chatId] = text;

  let order = orders[String(text)];

  if (!order) {
    bot.sendMessage(chatId, "❌ Замовлення не знайдено");
    return;
  }

  order.clientChatId = chatId;
  order.status = "active";

  let total = 0;
  order.cart.forEach(p => total += p.price);

  bot.sendMessage(chatId, `
✅ Замовлення №${text}

💰 Сума: ${total} грн

💳 Оплата:
4444 1111 2222 3333
`);
});


// ================= ADMIN REPLY =================

bot.on("message", (msg) => {
  if (msg.chat.id !== ADMIN_ID) return;

  const activeOrder = Object.values(orders).find(o => o.status === "active");

  if (!activeOrder) {
    bot.sendMessage(ADMIN_ID, "❌ Немає активного діалогу");
    return;
  }

  bot.sendMessage(activeOrder.clientChatId, msg.text);
});


// ================= CLOSE DIALOG =================

bot.onText(/\/done/, (msg) => {
  if (msg.chat.id !== ADMIN_ID) return;

  const activeOrder = Object.values(orders).find(o => o.status === "active");

  if (!activeOrder) {
    bot.sendMessage(ADMIN_ID, "❌ Немає активного діалогу");
    return;
  }

  activeOrder.status = "done";

  fs.writeFileSync("orders.json", JSON.stringify(orders, null, 2));

  bot.sendMessage(activeOrder.clientChatId, "✅ Ваше замовлення завершено");
  bot.sendMessage(ADMIN_ID, "✅ Діалог завершено");
});


// ================= START SERVER =================

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
