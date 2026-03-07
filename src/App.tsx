import React, { useState, useEffect } from 'react';
import { LayoutDashboard, ScrollText, Users, Send, Plus, Trash2, CheckCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Khural {
  id: number;
  name: string;
  time: string;
  date: string;
  description: string;
}

interface Order {
  id: number;
  user_id: number;
  username: string;
  khural_name: string;
  names: string;
  donation: number;
  status: string;
  created_at: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<'orders' | 'khurals' | 'broadcast'>('orders');
  const [khurals, setKhurals] = useState<Khural[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [newKhural, setNewKhural] = useState({ name: '', time: '', date: 'daily', description: '' });
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchKhurals();
    fetchOrders();
    const interval = setInterval(fetchOrders, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchKhurals = async () => {
    const res = await fetch('/api/khurals');
    const data = await res.json();
    setKhurals(data);
  };

  const fetchOrders = async () => {
    const res = await fetch('/api/orders');
    const data = await res.json();
    setOrders(data);
  };

  const handleAddKhural = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/khurals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newKhural),
    });
    setNewKhural({ name: '', time: '', date: 'daily', description: '' });
    fetchKhurals();
  };

  const handleDeleteKhural = async (id: number) => {
    await fetch(`/api/khurals/${id}`, { method: 'DELETE' });
    fetchKhurals();
  };

  const handleBroadcast = async () => {
    if (!broadcastMsg) return;
    setLoading(true);
    const res = await fetch('/api/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: broadcastMsg }),
    });
    const result = await res.json();
    alert(`Рассылка завершена. Успешно: ${result.successCount}, Ошибок: ${result.failCount}`);
    setBroadcastMsg('');
    setLoading(false);
  };

  const downloadCSV = () => {
    const headers = ['ID', 'User', 'Khural', 'Names', 'Donation', 'Status', 'Date'];
    const csvContent = [
      headers.join(';'),
      ...orders.map(o => [
        o.id,
        o.username,
        `"${o.khural_name}"`,
        `"${o.names.replace(/"/g, '""')}"`,
        o.donation,
        o.status,
        o.created_at
      ].join(';'))
    ].join('\n');

    // Add BOM for Excel UTF-8 support
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `orders_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen bg-[#FDFCF8] text-[#2D2D2D] font-sans">
      {/* Sidebar */}
      <div className="fixed left-0 top-0 h-full w-64 bg-[#1A1A1A] text-white p-6 flex flex-col gap-8 shadow-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 pb-6">
          <div className="w-10 h-10 bg-[#D4AF37] rounded-full flex items-center justify-center text-black font-bold text-xl">И</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">Хамбын Хурээ</h1>
            <p className="text-xs text-white/50 uppercase tracking-widest">Админ-панель</p>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <button 
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'orders' ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20' : 'hover:bg-white/5'}`}
          >
            <ScrollText size={20} />
            <span className="font-medium">Заказы</span>
          </button>
          <button 
            onClick={() => setActiveTab('khurals')}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'khurals' ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20' : 'hover:bg-white/5'}`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Хуралы</span>
          </button>
          <button 
            onClick={() => setActiveTab('broadcast')}
            className={`flex items-center gap-3 p-3 rounded-xl transition-all ${activeTab === 'broadcast' ? 'bg-[#D4AF37] text-black shadow-lg shadow-[#D4AF37]/20' : 'hover:bg-white/5'}`}
          >
            <Send size={20} />
            <span className="font-medium">Рассылка</span>
          </button>
        </nav>
      </div>

      {/* Main Content */}
      <main className="ml-64 p-10">
        <header className="mb-10 flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-serif italic mb-2">
              {activeTab === 'orders' && 'Все заказы'}
              {activeTab === 'khurals' && 'Управление хуралами'}
              {activeTab === 'broadcast' && 'Массовая рассылка'}
            </h2>
            <p className="text-black/40 uppercase text-xs tracking-[0.2em]">Иволгинский Дацан • 2026</p>
          </div>
          {activeTab === 'orders' && (
            <div className="flex gap-2">
              <button 
                onClick={fetchOrders}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-black/10 rounded-2xl text-sm font-bold hover:bg-black hover:text-white transition-all shadow-sm"
              >
                Обновить
              </button>
              <button 
                onClick={downloadCSV}
                className="flex items-center gap-2 px-6 py-3 bg-white border border-black/10 rounded-2xl text-sm font-bold hover:bg-black hover:text-white transition-all shadow-sm"
              >
                <ScrollText size={18} />
                Скачать CSV
              </button>
            </div>
          )}
        </header>

        <AnimatePresence mode="wait">
          {activeTab === 'orders' && (
            <motion.div 
              key="orders"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-3xl border border-black/5 shadow-sm overflow-hidden"
            >
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F8F7F2] border-bottom border-black/5">
                    <th className="p-5 text-xs uppercase tracking-widest text-black/40 font-semibold">ID</th>
                    <th className="p-5 text-xs uppercase tracking-widest text-black/40 font-semibold">Пользователь</th>
                    <th className="p-5 text-xs uppercase tracking-widest text-black/40 font-semibold">Хурал</th>
                    <th className="p-5 text-xs uppercase tracking-widest text-black/40 font-semibold">Имена</th>
                    <th className="p-5 text-xs uppercase tracking-widest text-black/40 font-semibold">Сумма</th>
                    <th className="p-5 text-xs uppercase tracking-widest text-black/40 font-semibold">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map(order => (
                    <tr key={order.id} className="border-b border-black/5 hover:bg-[#FDFCF8] transition-colors">
                      <td className="p-5 font-mono text-xs text-black/40">#{order.id}</td>
                      <td className="p-5 font-medium">@{order.username}</td>
                      <td className="p-5">{order.khural_name}</td>
                      <td className="p-5 text-sm text-black/60 italic">"{order.names}"</td>
                      <td className="p-5 font-semibold text-[#D4AF37]">{order.donation}₽</td>
                      <td className="p-5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${order.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                          {order.status === 'paid' ? <CheckCircle size={12} /> : <Clock size={12} />}
                          {order.status === 'paid' ? 'Оплачен' : 'Ожидает'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}

          {activeTab === 'khurals' && (
            <motion.div 
              key="khurals"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 lg:grid-cols-3 gap-8"
            >
              <div className="lg:col-span-2 space-y-4">
                {khurals.map(k => (
                  <div key={k.id} className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm flex justify-between items-start group">
                    <div>
                      <h3 className="text-xl font-bold mb-1">{k.name}</h3>
                      <p className="text-sm text-black/40 mb-3 flex gap-4">
                        <span>🕒 {k.time}</span>
                        <span>📅 {k.date === 'daily' ? 'Ежедневно' : k.date}</span>
                      </p>
                      <p className="text-sm text-black/60 leading-relaxed">{k.description}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteKhural(k.id)}
                      className="p-2 text-red-400 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={20} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-[#1A1A1A] text-white p-8 rounded-3xl shadow-xl h-fit sticky top-10">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Plus size={24} className="text-[#D4AF37]" />
                  Новый хурал
                </h3>
                <form onSubmit={handleAddKhural} className="space-y-4">
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Название</label>
                    <input 
                      required
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:border-[#D4AF37] outline-none transition-all"
                      value={newKhural.name}
                      onChange={e => setNewKhural({...newKhural, name: e.target.value})}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Время</label>
                      <input 
                        placeholder="09:00"
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:border-[#D4AF37] outline-none transition-all"
                        value={newKhural.time}
                        onChange={e => setNewKhural({...newKhural, time: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Дата</label>
                      <input 
                        placeholder="daily или YYYY-MM-DD"
                        className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:border-[#D4AF37] outline-none transition-all"
                        value={newKhural.date}
                        onChange={e => setNewKhural({...newKhural, date: e.target.value})}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-1">Описание</label>
                    <textarea 
                      rows={3}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 focus:border-[#D4AF37] outline-none transition-all resize-none"
                      value={newKhural.description}
                      onChange={e => setNewKhural({...newKhural, description: e.target.value})}
                    />
                  </div>
                  <button className="w-full bg-[#D4AF37] text-black font-bold py-4 rounded-xl hover:scale-[1.02] active:scale-95 transition-all shadow-lg shadow-[#D4AF37]/20 mt-4">
                    Добавить в список
                  </button>
                </form>
              </div>
            </motion.div>
          )}

          {activeTab === 'broadcast' && (
            <motion.div 
              key="broadcast"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-2xl bg-white p-10 rounded-[40px] border border-black/5 shadow-sm"
            >
              <div className="mb-8">
                <h3 className="text-2xl font-bold mb-2">Сообщение всем верующим</h3>
                <p className="text-black/40">Ваше сообщение будет отправлено всем пользователям бота.</p>
              </div>
              <textarea 
                rows={8}
                placeholder="Напишите текст рассылки..."
                className="w-full bg-[#F8F7F2] border border-black/5 rounded-3xl p-6 focus:border-[#D4AF37] outline-none transition-all resize-none mb-6 text-lg"
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value)}
              />
              <button 
                disabled={loading}
                onClick={handleBroadcast}
                className={`w-full py-5 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${loading ? 'bg-black/10 text-black/40' : 'bg-[#1A1A1A] text-white hover:bg-black shadow-xl'}`}
              >
                {loading ? 'Отправка...' : <><Send size={24} /> Отправить рассылку</>}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
