import { Telegraf, Context, Markup, session } from 'telegraf';
import db from './db.ts';

interface MyContext extends Context {
  session: {
    step?: 'choosing_khural' | 'choosing_date' | 'entering_names' | 'entering_amount';
    orderData?: {
      khuralId?: number;
      date?: string;
      names?: string;
      amount?: number;
    };
  };
}

const bot = new Telegraf<MyContext>(process.env.TELEGRAM_BOT_TOKEN || '8768988908:AAFAvtNbQGLMX1heOH2cPdRypK3maDmiPnM');

// IMPORTANT: Session must be initialized BEFORE any handlers
bot.use(session({
  defaultSession: () => ({})
}));

// Middleware to ensure user exists in DB
bot.use(async (ctx, next) => {
  if (ctx.from) {
    const user = db.prepare('SELECT * FROM users WHERE telegram_id = ?').get(ctx.from.id);
    if (!user) {
      db.prepare('INSERT INTO users (telegram_id, username) VALUES (?, ?)').run(ctx.from.id, ctx.from.username || 'unknown');
    }
  }
  return next();
});

// Admin command - persistent check
bot.command('admin', (ctx) => {
  const user = db.prepare('SELECT role FROM users WHERE telegram_id = ?').get(ctx.from.id) as any;
  
  // If already admin, just show menu
  if (user?.role === 'admin') {
    return ctx.reply('🙏 Вы авторизованы как администратор. Используйте меню ниже:', adminMenu);
  }

  const password = ctx.payload;
  if (password === 'лама2026+') {
    db.prepare("UPDATE users SET role = 'admin' WHERE telegram_id = ?").run(ctx.from.id);
    return ctx.reply('🙏 Ом Мани Падме Хум. Вам выданы права администратора.', adminMenu);
  }
  
  return ctx.reply('⚠️ Для получения прав администратора введите команду с паролем.\nЕсли вы уже администратор, просто напишите /admin');
});

// Cancel command
bot.command('cancel', (ctx) => {
  ctx.session = {};
  return ctx.reply('Действие отменено.', mainMenu);
});

// Main Menu
const mainMenu = Markup.keyboard([
  ['🙏 Заказать молебен'],
  ['📜 Мои заказы']
]).resize();

// Admin Menu
const adminMenu = Markup.keyboard([
  ['🙏 Заказать молебен'],
  ['📜 Мои заказы'],
  ['📋 Список имен на сегодня'],
  ['📥 Скачать заказы (CSV)'],
  ['📊 Статистика (Админ)']
]).resize();

bot.start((ctx) => {
  const user = db.prepare('SELECT role FROM users WHERE telegram_id = ?').get(ctx.from.id) as any;
  const keyboard = user?.role === 'admin' ? adminMenu : mainMenu;
  ctx.reply('🙏 Добро пожаловать в официальный бот Иволгинского дацана «Хамбын Хурээ».\n\nЗдесь вы можете заказать хурал (молебен) за благополучие ваших близких.', keyboard);
});

bot.hears('🙏 Заказать молебен', (ctx) => {
  ctx.session = {}; // Reset session
  const khurals = db.prepare('SELECT * FROM khurals').all() as any[];
  if (khurals.length === 0) {
    return ctx.reply('К сожалению, список хуралов временно пуст.');
  }

  // Split into Daily and Scheduled
  const daily = khurals.filter(k => k.date === 'daily');
  const scheduled = khurals.filter(k => k.date !== 'daily');

  let message = '🙏 *Расписание хуралов в Иволгинском дацане*\n\n';
  const buttons: any[] = [];
  
  message += '*Ежедневные хуралы:*\n';
  daily.forEach(k => {
    message += `• ${k.time} — «${k.name}»\n`;
    buttons.push([Markup.button.callback(`${k.time} - ${k.name}`, `khural_${k.id}`)]);
  });

  if (scheduled.length > 0) {
    message += '\n*Основной хурал дня (15:00):*\n';
    scheduled.forEach(k => {
      const dateParts = k.date.split('-');
      const day = dateParts[2];
      message += `• ${day} марта: ${k.name}\n`;
      buttons.push([Markup.button.callback(`${day} марта - ${k.name}`, `khural_${k.id}`)]);
    });
  }

  message += '\n_Выберите хурал для заказа, нажав на кнопку ниже:_';

  ctx.replyWithMarkdown(message, Markup.inlineKeyboard(buttons));
});

bot.action(/khural_(\d+)/, (ctx) => {
  const khuralId = parseInt(ctx.match[1]);
  const khural = db.prepare('SELECT * FROM khurals WHERE id = ?').get(khuralId) as any;
  
  if (!khural) return ctx.answerCbQuery('Хурал не найден.');

  // Initialize session
  ctx.session = {
    orderData: { khuralId }
  };

  if (khural.date === 'daily') {
    ctx.reply(`Вы выбрали: ${khural.name}\n${khural.description || ''}\n\nВведите имена тех, за кого совершается молебен (через запятую):`);
    ctx.session.step = 'entering_names';
  } else {
    ctx.reply(`Вы выбрали: ${khural.name}\nДата проведения: ${khural.date}\n\nВведите имена тех, за кого совершается молебен (через запятую):`);
    ctx.session.step = 'entering_names';
  }
  ctx.answerCbQuery();
});

bot.hears('📜 Мои заказы', (ctx) => {
  const orders = db.prepare(`
    SELECT o.*, k.name as khural_name 
    FROM orders o 
    JOIN khurals k ON o.khural_id = k.id 
    WHERE o.user_id = ? 
    ORDER BY o.created_at DESC LIMIT 10
  `).all(ctx.from.id) as any[];

  if (orders.length === 0) {
    return ctx.reply('У вас пока нет заказов.');
  }

  let message = '📜 Ваши последние заказы:\n\n';
  orders.forEach(o => {
    const statusEmoji = o.status === 'paid' ? '✅' : '⏳';
    message += `${statusEmoji} ${o.khural_name}\nИмена: ${o.names}\nСумма: ${o.donation}₽\nСтатус: ${o.status === 'paid' ? 'Оплачен' : 'Ожидает оплаты'}\n\n`;
  });

  ctx.reply(message);
});

// Text handler for steps
bot.on('text', async (ctx) => {
  if (!ctx.session) ctx.session = {};
  const step = ctx.session.step;
  const orderData = ctx.session.orderData;

  console.log('Current step:', step, 'Message:', ctx.message.text);

  if (step === 'entering_names') {
    if (orderData) {
      orderData.names = ctx.message.text;
      ctx.session.step = 'entering_amount';
      return ctx.reply('Введите сумму пожертвования (в рублях):', Markup.keyboard([['Отмена']]).resize());
    }
  }

  if (step === 'entering_amount') {
    if (ctx.message.text === 'Отмена') {
      ctx.session = {};
      return ctx.reply('Заказ отменен.', mainMenu);
    }

    const amount = parseInt(ctx.message.text);
    if (isNaN(amount) || amount < 1) {
      return ctx.reply('Пожалуйста, введите корректную сумму (минимум 1 рубль).');
    }

    if (orderData) {
      orderData.amount = amount;
      
      // Save order to DB
      const result = db.prepare(`
        INSERT INTO orders (user_id, khural_id, names, donation, status) 
        VALUES (?, ?, ?, ?, 'pending')
      `).run(ctx.from.id, orderData.khuralId, orderData.names, amount);
      
      const orderId = result.lastInsertRowid;
      const khural = db.prepare('SELECT name FROM khurals WHERE id = ?').get(orderData.khuralId) as any;

      // Using Telegram Payments with the provided test token
      try {
        await ctx.sendInvoice({
          title: `Хурал: ${khural.name}`,
          description: `Пожертвование за имена: ${orderData.names}`,
          payload: `order_${orderId}`,
          provider_token: process.env.YOOKASSA_TOKEN || '',
          currency: 'RUB',
          prices: [{ label: 'Пожертвовать', amount: amount * 100 }],
          start_parameter: `order_${orderId}`,
        });
        await ctx.reply('🙏 Пожалуйста, нажмите на кнопку выше для совершения пожертвования.', Markup.keyboard([['Отмена']]).resize());
      } catch (error) {
        console.error('Payment Error:', error);
        const paymentUrl = `${process.env.APP_URL}/api/pay/${orderId}`;
        await ctx.reply(`🙏 Ваш заказ принят.\n\nХурал: ${khural.name}\nИмена: ${orderData.names}\nСумма: ${amount}₽\n\nДля завершения, пожалуйста, перейдите к оплате:`, 
          Markup.inlineKeyboard([
            [Markup.button.url('💳 Пожертвовать через ЮKassa', paymentUrl)]
          ])
        );
      }
      
      await ctx.reply('Вы можете продолжить использование меню:', mainMenu);

      // Clear session
      ctx.session = {};
      return;
    }
  }

  // If not in a step, show main menu if they sent something else
  if (!['🙏 Заказать молебен', '📜 Мои заказы'].includes(ctx.message.text)) {
    // Check if they just sent "Отмена"
    if (ctx.message.text === 'Отмена') {
      ctx.session = {};
      return ctx.reply('Главное меню:', mainMenu);
    }
  }
});

bot.on('pre_checkout_query', (ctx) => ctx.answerPreCheckoutQuery(true));

bot.on('successful_payment', (ctx) => {
  const payload = ctx.message.successful_payment.invoice_payload;
  const orderId = payload.split('_')[1];
  
  db.prepare("UPDATE orders SET status = 'paid' WHERE id = ?").run(orderId);
  
  ctx.reply('✅ Ваше пожертвование получено! Благодарим вас за поддержку дацана. Хурал будет совершен.', mainMenu);
});

bot.hears('📥 Скачать заказы (CSV)', async (ctx) => {
  const user = db.prepare('SELECT role FROM users WHERE telegram_id = ?').get(ctx.from.id) as any;
  if (user?.role !== 'admin') return ctx.reply('У вас нет прав доступа.');

  const orders = db.prepare(`
    SELECT o.id, u.username, k.name as khural_name, o.names, o.donation, o.status, o.created_at
    FROM orders o
    JOIN khurals k ON o.khural_id = k.id
    JOIN users u ON o.user_id = u.telegram_id
    WHERE o.status = 'paid'
    ORDER BY o.created_at DESC
  `).all() as any[];

  if (orders.length === 0) {
    return ctx.reply('Оплаченных заказов пока нет.');
  }

  // Create CSV content with BOM for Excel
  const headers = ['ID', 'Username', 'Khural', 'Names', 'Donation', 'Status', 'Date'];
  const rows = orders.map(o => [
    o.id,
    o.username,
    `"${o.khural_name}"`,
    `"${o.names.replace(/"/g, '""')}"`,
    o.donation,
    o.status,
    o.created_at
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
  const buffer = Buffer.from(csvContent, 'utf-8');

  await ctx.replyWithDocument(
    { source: buffer, filename: `orders_report_${new Date().toISOString().split('T')[0]}.csv` },
    { caption: '📊 Полный отчет по оплаченным заказам (CSV)' }
  );
});

bot.hears('📋 Список имен на сегодня', async (ctx) => {
  const user = db.prepare('SELECT role FROM users WHERE telegram_id = ?').get(ctx.from.id) as any;
  if (user?.role !== 'admin') return ctx.reply('У вас нет прав доступа.');

  // Get paid orders for today or daily khurals
  const orders = db.prepare(`
    SELECT o.names, k.name as khural_name, o.donation
    FROM orders o
    JOIN khurals k ON o.khural_id = k.id
    WHERE o.status = 'paid' 
    AND (k.date = 'daily' OR k.date = date('now'))
    ORDER BY k.name
  `).all() as any[];

  if (orders.length === 0) {
    return ctx.reply('На сегодня оплаченных заявок пока нет.');
  }

  let report = '📋 *Список имен для прочтения на хуралах:*\n\n';
  let currentKhural = '';

  orders.forEach(o => {
    if (o.khural_name !== currentKhural) {
      currentKhural = o.khural_name;
      report += `\n📍 *${currentKhural}:*\n`;
    }
    report += `• ${o.names} (${o.donation}₽)\n`;
  });

  if (report.length > 4000) {
    // Add BOM for TXT files too
    const buffer = Buffer.from('\uFEFF' + report, 'utf-8');
    return ctx.replyWithDocument({ source: buffer, filename: `names_${new Date().toISOString().split('T')[0]}.txt` });
  }

  ctx.replyWithMarkdown(report);
});

bot.hears(['📊 Все заказы (Админ)', '📊 Статистика (Админ)'], (ctx) => {
  const user = db.prepare('SELECT role FROM users WHERE telegram_id = ?').get(ctx.from.id) as any;
  if (user?.role !== 'admin') return ctx.reply('У вас нет прав доступа.');

  const stats = db.prepare(`
    SELECT status, COUNT(*) as count, SUM(donation) as total
    FROM orders
    GROUP BY status
  `).all() as any[];

  let message = '📊 *Статистика заказов:*\n\n';
  stats.forEach(s => {
    message += `${s.status === 'paid' ? '✅ Оплачено' : '⏳ Ожидает'}: ${s.count} шт. (${s.total}₽)\n`;
  });

  ctx.replyWithMarkdown(message);
});

export default bot;
