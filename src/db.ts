import Database from 'better-sqlite3';
import path from 'path';

const db = new Database('datsan.db');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    telegram_id INTEGER PRIMARY KEY,
    username TEXT,
    role TEXT DEFAULT 'user'
  );

  CREATE TABLE IF NOT EXISTS khurals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    time TEXT,
    date TEXT, -- 'daily' or 'YYYY-MM-DD'
    description TEXT
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    khural_id INTEGER NOT NULL,
    names TEXT NOT NULL,
    donation INTEGER NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'paid'
    payment_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(telegram_id),
    FOREIGN KEY (khural_id) REFERENCES khurals(id)
  );
`);

// Insert default khurals if empty
const count = db.prepare('SELECT COUNT(*) as count FROM khurals').get() as { count: number };
if (count.count === 0) {
  const insert = db.prepare('INSERT INTO khurals (name, time, date, description) VALUES (?, ?, ?, ?)');
  
  // Ежедневные
  insert.run('Намсарай Сахюусан', '09:00', 'daily', 'За материальное и духовное благосостояние.');
  insert.run('Юм Нити', '14:00', 'daily', 'Устранение болезней, страданий и препятствий.');
  insert.run('Манай Баатруудад', '16:00', 'daily', 'Для защиты и удачи участников СВО.');

  // Март 2026 (15:00)
  const marchSchedule = [
    { d: '15', n: 'Юм Чун', desc: 'Устранение преград' },
    { d: '16', n: 'Доржо Жодбо', desc: 'Защита, благополучие' },
    { d: '17', n: 'Даши Зэгба', desc: 'Исправление негативных проявлений' },
    { d: '18', n: 'Найман Гэгээн', desc: 'Устранение препятствий и благополучие' },
    { d: '19', n: '21 Дара Эхын Магтаал', desc: 'Устранение препятствий и защита' },
    { d: '20', n: 'Сагаан Дара Эхын Тарни 108', desc: 'За удачу в делах и долголетие' },
    { d: '21', n: 'Табан Харюулга', desc: 'Защита от негативного, устранение препятствий' },
    { d: '22', n: 'Цедо', desc: 'Накопление добродетели' },
    { d: '23', n: 'Заһалай найман ном', desc: 'Устранение препятствий' },
    { d: '24', n: 'Согто Зандан', desc: 'Устранение препятствий и семейный достаток' },
    { d: '25', n: 'Сунды', desc: 'Собрание сутр за благоденствие' },
    { d: '26', n: 'Отошо хурал', desc: 'За здоровье' },
    { d: '27', n: 'Юм нити', desc: 'Устранение болезней и страданий' },
    { d: '28', n: 'Насны гурбан судар', desc: 'Молитва долголетия' },
    { d: '29', n: 'Алтан Гэрэл', desc: 'Устранение препятствий и семейный достаток' },
    { d: '30', n: 'Найман Гэгээн', desc: 'Устранение препятствий и благополучие' },
    { d: '31', n: 'Зурган Юроол', desc: 'Шесть благих пожеланий' },
  ];

  marchSchedule.forEach(item => {
    insert.run(item.n, '15:00', `2026-03-${item.d}`, item.desc);
  });
}

export default db;
