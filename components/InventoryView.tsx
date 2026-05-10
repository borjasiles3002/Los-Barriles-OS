
import React, { useState, useMemo } from 'react';
import { StockItem, InventoryTransaction } from '../types';
import { PackageIcon, PlusIcon, AlertTriangleIcon, TrendingUpIcon } from './icons';

interface InventoryViewProps {
  drinkStock: StockItem[];
  kitchenStock: StockItem[];
  transactions: InventoryTransaction[];
  onAddTransaction: (transaction: Omit<InventoryTransaction, 'id' | 'date'>) => void;
}

const InventoryView: React.FC<InventoryViewProps> = ({ drinkStock, kitchenStock, transactions, onAddTransaction }) => {
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [type, setType] = useState<'entry' | 'exit'>('entry');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const allItems = useMemo(() => [...drinkStock, ...kitchenStock], [drinkStock, kitchenStock]);

  const filteredItems = useMemo(() => {
    return allItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [allItems, searchTerm]);

  const lowStockItems = useMemo(() => {
    return allItems.filter(item => item.stock <= item.lowStockThreshold);
  }, [allItems]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const qty = parseFloat(quantity);
    if (!selectedItemId || isNaN(qty) || qty <= 0) return;

    onAddTransaction({
      stockItemId: selectedItemId,
      type,
      quantity: qty,
      reason: reason.trim() || undefined
    });

    setQuantity('');
    setReason('');
    setSelectedItemId('');
  };

  const getStockItemName = (id: string) => {
    return allItems.find(item => item.id === id)?.name || 'Producto desconocido';
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
      {/* Header & Alerts */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <PackageIcon className="w-8 h-8 text-blue-400" />
            Gestión de Inventario
          </h2>
          <p className="text-gray-400 mt-1">Control ejecutivo de entradas y salidas de stock.</p>
        </div>
        
        {lowStockItems.length > 0 && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-xl px-4 py-2 flex items-center gap-3 animate-pulse">
            <AlertTriangleIcon className="text-red-400" />
            <span className="text-red-200 font-bold text-sm">
              {lowStockItems.length} productos en nivel crítico
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Transaction Form */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <PlusIcon className="text-blue-400" />
              Nueva Transacción
            </h3>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Producto</label>
                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-700 border-gray-600 rounded-lg text-white text-sm p-2 mb-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <select 
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    className="w-full bg-gray-700 border-gray-600 rounded-lg text-white text-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">Seleccionar...</option>
                    {filteredItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (Stock: {item.stock})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Tipo</label>
                  <select 
                    value={type}
                    onChange={(e) => setType(e.target.value as 'entry' | 'exit')}
                    className="w-full bg-gray-700 border-gray-600 rounded-lg text-white text-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="entry">Entrada (+)</option>
                    <option value="exit">Salida (-)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Cantidad</label>
                  <input 
                    type="number"
                    step="0.01"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-gray-700 border-gray-600 rounded-lg text-white text-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Motivo (Opcional)</label>
                <input 
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej: Reposición, Rotura, Merma..."
                  className="w-full bg-gray-700 border-gray-600 rounded-lg text-white text-sm p-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button 
                type="submit"
                className={`w-full py-3 rounded-xl font-bold text-white transition-all transform hover:scale-[1.02] active:scale-95 shadow-lg ${
                  type === 'entry' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20' : 'bg-red-600 hover:bg-red-700 shadow-red-900/20'
                }`}
              >
                Registrar {type === 'entry' ? 'Entrada' : 'Salida'}
              </button>
            </form>
          </div>

          {/* Quick Stats */}
          <div className="bg-gray-800 p-6 rounded-2xl border border-gray-700 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUpIcon className="text-purple-400" />
              Resumen Ejecutivo
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-xl">
                <span className="text-gray-400 text-sm">Total Referencias</span>
                <span className="text-white font-bold">{allItems.length}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-xl">
                <span className="text-gray-400 text-sm">Nivel Crítico</span>
                <span className={`font-bold ${lowStockItems.length > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {lowStockItems.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* History & Current Stock */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 shadow-xl overflow-hidden">
            <div className="p-6 border-b border-gray-700 flex justify-between items-center">
              <h3 className="text-xl font-bold text-white">Historial de Movimientos</h3>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Últimos 20 registros</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-700">
                    <th className="px-6 py-4 font-medium">Fecha</th>
                    <th className="px-6 py-4 font-medium">Producto</th>
                    <th className="px-6 py-4 font-medium">Tipo</th>
                    <th className="px-6 py-4 font-medium text-right">Cantidad</th>
                    <th className="px-6 py-4 font-medium">Motivo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-gray-500 italic">No hay movimientos registrados.</td>
                    </tr>
                  ) : (
                    transactions.slice(0, 20).map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-700/30 transition-colors">
                        <td className="px-6 py-4 text-sm text-gray-400">
                          {new Date(tx.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-white">
                          {getStockItemName(tx.stockItemId)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                            tx.type === 'entry' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400'
                          }`}>
                            {tx.type === 'entry' ? 'Entrada' : 'Salida'}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-sm font-bold text-right ${
                          tx.type === 'entry' ? 'text-emerald-400' : 'text-red-400'
                        }`}>
                          {tx.type === 'entry' ? '+' : '-'}{tx.quantity.toFixed(2)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500 italic">
                          {tx.reason || '-'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Critical Items List */}
          {lowStockItems.length > 0 && (
            <div className="bg-gray-800 rounded-2xl border border-red-500/30 shadow-xl overflow-hidden">
              <div className="p-6 border-b border-gray-700 bg-red-500/5">
                <h3 className="text-xl font-bold text-red-400 flex items-center gap-2">
                  <AlertTriangleIcon />
                  Alertas de Reabastecimiento
                </h3>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                {lowStockItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-gray-900/50 rounded-xl border border-gray-700">
                    <div>
                      <p className="text-white font-bold">{item.name}</p>
                      <p className="text-xs text-gray-500">Mínimo requerido: {item.lowStockThreshold}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-red-400">{item.stock}</p>
                      <p className="text-[10px] text-red-500 uppercase font-bold">Stock Bajo</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InventoryView;
