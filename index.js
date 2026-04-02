const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

const app = express();
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
  const text = msg.text.replace(/\D/g, "");
  const chatId = msg.chat.id;

  if (lastMessages[chatId] === text) return;
  lastMessages[chatId] = text;

  const order = orders[String(text)];

  if (!order) {
    bot.sendMessage(chatId, "❌ Замовлення не знайдено");
    return;
  }

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
