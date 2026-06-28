import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { db, onSnapshot, collection, query, orderBy, limit } from '../src/firebase';

const DEFAULT_TABLES = [
  'Mesa 1', 'Mesa 2', 'Mesa 3', 'Mesa 4', 'Mesa 5',
  'Mesa 6', 'Mesa 7', 'Mesa 8', 'Mesa 9', 'Mesa 10',
  'Mesa 11', 'Mesa 12', 'Mesa 13', 'Mesa 14', 'Mesa 15',
  'Mesa 16', 'Mesa 17', 'Mesa 18', 'Mesa 19', 'Mesa 20',
  'Terraza 1', 'Terraza 2', 'Barra',
];

const ACTIVE_STATUSES = new Set(['pendiente', 'en preparación', 'listo']);

const SalaMonitorView: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(300)),
      (snapshot) => setOrders(snapshot.docs.map(d => d.data() as Order))
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const activeOrders = orders.filter(o => ACTIVE_STATUSES.has(o.status));

  const extraTables = [...new Set(activeOrders.map(o => o.table))].filter(
    t => !DEFAULT_TABLES.includes(t)
  );
  const allTables = [...DEFAULT_TABLES, ...extraTables];

  const getOrderForTable = (table: string): Order | undefined =>
    activeOrders.find(o => o.table === table);

  const getMinutes = (order: Order): number =>
    Math.floor((now.getTime() - new Date(order.createdAt).getTime()) / 60000);

  const getTableStyle = (order: Order | undefined, minutes: number) => {
    if (!order) return { card: 'bg-green-900/40 border-green-700', text: 'text-green-400', label: 'Libre' };
    if (minutes >= 30) return { card: 'bg-red-900/60 border-red-500 animate-pulse', text: 'text-red-300', label: `${minutes}m` };
    return { card: 'bg-orange-900/50 border-orange-600', text: 'text-orange-300', label: `${minutes}m` };
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 overflow-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Monitor de Sala</h1>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-sm text-green-400">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />Libre
            </span>
            <span className="flex items-center gap-1.5 text-sm text-orange-400">
              <span className="w-3 h-3 rounded-full bg-orange-500 inline-block" />Ocupada
            </span>
            <span className="flex items-center gap-1.5 text-sm text-red-400">
              <span className="w-3 h-3 rounded-full bg-red-500 inline-block" />+30 min
            </span>
          </div>
        </div>
        {/* Clock */}
        <div className="text-right">
          <div className="text-5xl font-mono font-bold tabular-nums">
            {now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="text-sm text-gray-400 mt-1 capitalize">
            {now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-4 mb-6 text-sm">
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <span className="text-gray-400">Mesas ocupadas:</span>{' '}
          <span className="font-bold text-white">{activeOrders.length}</span>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <span className="text-gray-400">Listos para servir:</span>{' '}
          <span className="font-bold text-green-400">{activeOrders.filter(o => o.status === 'listo').length}</span>
        </div>
        <div className="bg-gray-800 rounded-lg px-4 py-2">
          <span className="text-gray-400">Esperando +30 min:</span>{' '}
          <span className="font-bold text-red-400">{activeOrders.filter(o => getMinutes(o) >= 30).length}</span>
        </div>
      </div>

      {/* Table grid */}
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 gap-3">
        {allTables.map(tableName => {
          const order = getOrderForTable(tableName);
          const minutes = order ? getMinutes(order) : 0;
          const style = getTableStyle(order, minutes);
          const itemCount = order ? order.items.reduce((s, i) => s + i.quantity, 0) : 0;

          return (
            <div
              key={tableName}
              className={`rounded-xl p-3 border-2 flex flex-col items-center gap-1 min-h-[90px] transition-all ${style.card}`}
            >
              <div className="font-bold text-white text-sm text-center leading-tight">{tableName}</div>
              {order ? (
                <>
                  <div className={`text-xl font-black font-mono ${style.text}`}>{style.label}</div>
                  <div className="text-xs text-gray-300">{itemCount} art.</div>
                  <div className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                    order.status === 'listo' ? 'bg-green-700 text-green-100' :
                    order.status === 'en preparación' ? 'bg-yellow-700 text-yellow-100' :
                    'bg-gray-700 text-gray-300'
                  }`}>
                    {order.status}
                  </div>
                </>
              ) : (
                <div className="text-green-400 text-sm font-semibold mt-auto mb-auto">Libre</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SalaMonitorView;
