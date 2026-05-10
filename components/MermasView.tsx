import React, { useState } from 'react';
import { InventoryTransaction, StockItem } from '../types';
import { TrashIcon } from './icons';

interface MermasViewProps {
  drinkStock: StockItem[];
  kitchenStock: StockItem[];
  transactions: InventoryTransaction[];
  onAddTransaction: (tx: Omit<InventoryTransaction, 'id' | 'date'>) => void;
}

const MermasView: React.FC<MermasViewProps> = ({ drinkStock, kitchenStock, transactions, onAddTransaction }) => {
  const allStock = [...drinkStock, ...kitchenStock].sort((a, b) => a.name.localeCompare(b.name));
  
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState('Caducado');

  const mermas = transactions.filter(tx => tx.type === 'exit' && tx.reason && tx.reason.toLowerCase().includes('merma'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemId || quantity <= 0) return;

    onAddTransaction({
      stockItemId: selectedItemId,
      type: 'exit',
      quantity,
      reason: `Merma: ${reason}`
    });

    setSelectedItemId('');
    setQuantity(1);
    setReason('Caducado');
  };

  const getStockItemName = (id: string) => {
      return allStock.find(i => i.id === id)?.name || 'Producto Desconocido';
  };

  const reasons = ['Caducado', 'Roto/Dañado', 'Mala Elaboración', 'Pérdida', 'Degustación', 'Otro'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <TrashIcon /> Registrar Merma
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Producto</label>
            <select 
              value={selectedItemId} 
              onChange={e => setSelectedItemId(e.target.value)}
              className="w-full bg-gray-700 border-gray-600 rounded-md text-white px-3 py-2"
              required
            >
              <option value="">Seleccione un producto...</option>
              {allStock.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Cantidad Perdida</label>
            <input 
              type="number" 
              min="0.1" 
              step="any"
              value={quantity} 
              onChange={e => setQuantity(parseFloat(e.target.value))}
              className="w-full bg-gray-700 border-gray-600 rounded-md text-white px-3 py-2"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Motivo / Tipo de Merma</label>
            <select
                value={reasons.includes(reason) ? reason : 'Otro'}
                onChange={e => setReason(e.target.value)}
                className="w-full bg-gray-700 border-gray-600 rounded-md text-white px-3 py-2 mb-2"
            >
                {reasons.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            {!reasons.includes(reason) && (
                 <input 
                 type="text" 
                 value={reason} 
                 onChange={e => setReason(e.target.value)}
                 className="w-full bg-gray-700 border-gray-600 rounded-md text-white px-3 py-2"
                 placeholder="Especificar otro motivo..."
                 required
               />
            )}
           
          </div>

          <button 
            type="submit" 
            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Registrar Baja
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-gray-800 p-6 rounded-lg shadow-lg flex flex-col h-[600px]">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-white">Historial de Mermas</h2>
            <button 
                onClick={() => {
                    const headers = 'Fecha,Producto,Cantidad,Motivo\n';
                    const csvData = mermas.map(tx => `"${new Date(tx.date).toLocaleDateString()}","${getStockItemName(tx.stockItemId)}",${tx.quantity},"${tx.reason}"`).join('\n');
                    const blob = new Blob([headers + csvData], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement('a');
                    link.href = URL.createObjectURL(blob);
                    link.download = 'mermas_desperdicios.csv';
                    link.click();
                }}
                className="text-xs font-bold px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors"
                disabled={mermas.length === 0}
            >
                Exportar CSV
            </button>
        </div>
        
        <div className="flex-1 overflow-y-auto pr-2">
            {mermas.length > 0 ? (
                <div className="space-y-2">
                    {mermas.map(tx => (
                        <div key={tx.id} className="bg-gray-700/50 p-4 rounded-lg flex justify-between items-center border border-gray-600/30">
                            <div>
                                <h3 className="font-bold text-red-400">{getStockItemName(tx.stockItemId)}</h3>
                                <p className="text-sm text-gray-400">{tx.reason}</p>
                            </div>
                            <div className="text-right">
                                <span className="font-mono text-white text-lg block">-{tx.quantity}</span>
                                <span className="text-xs text-gray-500">{new Date(tx.date).toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                    No se han registrado mermas.
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default MermasView;
