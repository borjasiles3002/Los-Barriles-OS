import React, { useMemo } from 'react';
import { Order, OrderStatus } from '../types';
import { CheckCircleIcon, ClockIcon } from './icons';

interface KitchenViewProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, status: OrderStatus, assignedCookId?: string) => void;
  onUpdateOrder: (order: Order) => void;
}

const KitchenView: React.FC<KitchenViewProps> = ({ orders, onUpdateOrderStatus, onUpdateOrder }) => {
  // Only show open orders that are not delivered/closed
  const activeOrders = useMemo(() => orders.filter(o => o.status !== 'entregado' && o.status !== 'pagado' && o.status !== 'cerrado').sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()), [orders]);

  const handleOrderReady = (orderId: string) => {
      onUpdateOrderStatus(orderId, 'listo');
  };

  const toggleItemStatus = (order: Order, itemIdx: number) => {
      const updatedOrder = { ...order, items: [...order.items] };
      const currentStatus = updatedOrder.items[itemIdx].status || 'pendiente';
      let nextStatus: 'pendiente' | 'marchado' | 'salido' = 'pendiente';
      if (currentStatus === 'pendiente') nextStatus = 'marchado';
      else if (currentStatus === 'marchado') nextStatus = 'salido';
      
      updatedOrder.items[itemIdx] = { ...updatedOrder.items[itemIdx], status: nextStatus };
      onUpdateOrder(updatedOrder);
  };

  return (
    <div className="h-full flex flex-col p-4 max-w-full mx-auto overflow-hidden">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <ClockIcon /> Pantalla de Cocina (KDS)
        </h2>

        <div className="flex-1 overflow-x-auto flex gap-4 pb-4 snap-x">
            {activeOrders.length === 0 ? (
                <div className="w-full flex items-center justify-center text-gray-500 text-xl font-bold">
                    No hay comandas activas
                </div>
            ) : (
                activeOrders.map(order => {
                    const isReady = order.status === 'listo';
                    const timeElapsed = Math.floor((new Date().getTime() - new Date(order.createdAt).getTime()) / 60000);
                    
                    return (
                        <div key={order.id} className={`snap-center shrink-0 w-80 rounded-xl overflow-hidden shadow-2xl border-2 flex flex-col 
                            ${isReady ? 'bg-green-900/30 border-green-600' : (timeElapsed > 15 ? 'bg-red-900/40 border-red-600 animate-pulse-slow' : 'bg-gray-800 border-gray-700')}
                        `}>
                            {/* Cabecera Comanda */}
                            <div className={`p-4 flex justify-between items-center border-b ${isReady ? 'bg-green-800/80 border-green-700' : 'bg-gray-900/80 border-gray-700'}`}>
                                <h3 className="text-xl font-black text-white">{order.table}</h3>
                                <div className="flex items-center gap-2">
                                    <ClockIcon className={`w-4 h-4 ${timeElapsed > 15 ? 'text-red-400' : 'text-gray-400'}`} />
                                    <span className={`font-mono font-bold ${timeElapsed > 15 ? 'text-red-400' : 'text-gray-300'}`}>{timeElapsed}m</span>
                                </div>
                            </div>

                            {/* Items */}
                            <div className="flex-1 overflow-y-auto p-2 bg-black/20">
                                <ul className="space-y-2">
                                    {order.items.map((item, idx) => {
                                        const status = item.status || 'pendiente';
                                        let statusClasses = 'border-gray-700/50';
                                        let textClasses = 'text-gray-200';
                                        let qtyClasses = 'text-white bg-gray-700';

                                        if (status === 'marchado') {
                                            statusClasses = 'bg-yellow-900/30 border-yellow-700/50 relative';
                                            textClasses = 'text-yellow-200';
                                            qtyClasses = 'text-yellow-900 bg-yellow-400';
                                        } else if (status === 'salido') {
                                            statusClasses = 'bg-green-900/20 border-green-800/50 relative opacity-60';
                                            textClasses = 'text-green-400 line-through';
                                            qtyClasses = 'text-green-900 bg-green-500';
                                        } else {
                                            qtyClasses = 'text-red-100 bg-red-900';
                                        }

                                        return (
                                            <li 
                                                key={idx} 
                                                onClick={() => !isReady && toggleItemStatus(order, idx)}
                                                className={`flex gap-3 text-lg p-3 rounded-lg border cursor-pointer select-none transition-colors items-center ${statusClasses} hover:brightness-110`}
                                            >
                                                <span className={`font-black px-2.5 py-0.5 rounded shadow-sm text-sm ${qtyClasses}`}>{item.quantity}</span>
                                                <span className={`font-semibold flex-1 leading-tight flex flex-col ${textClasses}`}>
                                                    <span>{item.name}</span>
                                                    {item.family && item.family !== 'Otros' && (
                                                        <span className="text-[10px] text-gray-400 mt-1 uppercase tracking-wide">
                                                            {item.family}
                                                        </span>
                                                    )}
                                                </span>
                                                {status === 'marchado' && <span className="text-xs uppercase font-bold text-yellow-500 tracking-wider">M</span>}
                                                {status === 'salido' && <span className="text-xs uppercase font-bold text-green-500 tracking-wider">Ok</span>}
                                            </li>
                                        );
                                    })}
                                </ul>
                            </div>

                            {/* Acciones */}
                            <div className="p-3 bg-gray-900/50">
                                {!isReady ? (
                                    <button 
                                        onClick={() => handleOrderReady(order.id)}
                                        className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-lg shadow uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                                    >
                                        <CheckCircleIcon className="w-6 h-6" /> Terminado
                                    </button>
                                ) : (
                                    <button 
                                        onClick={() => onUpdateOrderStatus(order.id, 'entregado')}
                                        className="w-full py-3 bg-green-600 hover:bg-green-500 text-white font-bold text-lg rounded-lg shadow uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                                    >
                                        Avisar Sala
                                    </button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    </div>
  );
};

export default KitchenView;
