const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const app = express();
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});
app.use(express.json());

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

bot.on("message", (msg) => {
  console.log(msg.chat.id);
});

let orders = {};

try {
  const data = fs.readFileSync("orders.json");
  orders = JSON.parse(data);
} catch (e) {
  orders = {};
}

const ADMIN_ID = 827330746; // вставишь свой id
let lastMessages = {};

app.post("/create-order", (req, res) => {
  const order = req.body;
  orders[String(order.orderNumber)] = order;
  if (orders[order.orderNumber]) return;
  order.status = "new";
  order.clientChatId = null;
  fs.writeFileSync("orders.json", JSON.stringify(orders, null, 2));

  let total = 0;
  order.cart.forEach(p => total += p.price);

  // 👉 уведомление тебе
  bot.sendMessage(ADMIN_ID, `
🆕 Нове замовлення №${order.orderNumber}

👤 ${order.name} ${order.surname}
📞 ${order.phone}

💰 ${total} грн
`);

  res.json({ ok: true });
});

bot.on("message", (msg) => {
  const match = msg.text.match(/\d{5,}/); // ищем число от 5 цифр
  const text = match ? match[0] : "";
  const chatId = msg.chat.id;

  if (lastMessages[chatId] === text) return;
  lastMessages[chatId] = text;

  let order = orders[String(text)];
  if (order) {
  order.clientChatId = chatId;
  order.status = "active";
  }

  if (!order) {
    bot.sendMessage(chatId, "❌ Замовлення не знайдено");
    return;
  }
  // ответ админа клиенту
  bot.on("message", (msg) => {
    if (msg.chat.id !== ADMIN_ID) return;

    const reply = msg.text;

  // ищем активный заказ
    const activeOrder = Object.values(orders).find(o => o.status === "active");

    if (!activeOrder) {
      bot.sendMessage(ADMIN_ID, "❌ Немає активного діалогу");
      return;
    }

    bot.sendMessage(activeOrder.clientChatId, reply);
  });

  bot.onText(/\/done/, (msg) => {
  if (msg.chat.id !== ADMIN_ID) return;

  const activeOrder = Object.values(orders).find(o => o.status === "active");

  if (!activeOrder) {
    bot.sendMessage(ADMIN_ID, "❌ Немає активного діалогу");
    return;
  }

  activeOrder.status = "done";

  bot.sendMessage(activeOrder.clientChatId, "✅ Ваше замовлення завершено");
  bot.sendMessage(ADMIN_ID, "✅ Діалог завершено");
  });
  
  let total = 0;
  order.cart.forEach(p => total += p.price);

  bot.sendMessage(chatId, `
✅ Замовлення №${text}

💰 Сума: ${total} грн

💳 Оплата:
4444 1111 2222 3333
`);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Server running");
});
