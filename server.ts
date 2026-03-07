import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import bot from "./src/bot.ts";
import db from "./src/db.ts";
import { session } from "telegraf";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Telegram Webhook or Polling
  if (process.env.NODE_ENV === "production") {
    // In production we would use webhooks, but for this environment polling is easier to manage
    bot.launch();
  } else {
    bot.launch();
  }

  // API Routes for Admin Panel
  app.get("/api/khurals", (req, res) => {
    const khurals = db.prepare("SELECT * FROM khurals").all();
    res.json(khurals);
  });

  app.post("/api/khurals", (req, res) => {
    const { name, time, date, description } = req.body;
    const result = db.prepare("INSERT INTO khurals (name, time, date, description) VALUES (?, ?, ?, ?)").run(name, time, date, description);
    res.json({ id: result.lastInsertRowid });
  });

  app.delete("/api/khurals/:id", (req, res) => {
    db.prepare("DELETE FROM khurals WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/orders", (req, res) => {
    const orders = db.prepare(`
      SELECT o.*, k.name as khural_name, u.username 
      FROM orders o 
      LEFT JOIN khurals k ON o.khural_id = k.id 
      LEFT JOIN users u ON o.user_id = u.telegram_id
      ORDER BY o.created_at DESC
    `).all();
    res.json(orders);
  });

  // Mock Payment Success Route
  app.get("/api/pay/:orderId", (req, res) => {
    const orderId = req.params.orderId;
    db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(orderId);
    
    const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as any;
    if (order) {
      bot.telegram.sendMessage(order.user_id, `✅ Ваше пожертвование на сумму ${order.donation}₽ получено. Хурал будет совершен. Благодарим вас!`);
    }

    res.send(`
      <html>
        <head><meta charset="UTF-8"><title>Оплата успешна</title></head>
        <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; background: #f0fdf4;">
          <h1 style="color: #166534;">✅ Оплата прошла успешно!</h1>
          <p>Вы можете вернуться в Telegram-бот.</p>
          <button onclick="window.close()" style="padding: 10px 20px; background: #22c55e; color: white; border: none; border-radius: 8px; cursor: pointer;">Закрыть окно</button>
        </body>
      </html>
    `);
  });

  // Broadcast API
  app.post("/api/broadcast", async (req, res) => {
    const { message } = req.body;
    const users = db.prepare("SELECT telegram_id FROM users").all() as any[];
    
    let successCount = 0;
    let failCount = 0;

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.telegram_id, message);
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    res.json({ successCount, failCount });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    // SPA fallback for production
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
