
import React, { useEffect, useRef } from 'react';
import { Order, OrderStatus, Employee, OrderItem } from '../types';
import { PlusIcon, TrashIcon, ClockIcon, CheckCircleIcon, PlayIcon, UserIcon } from './icons';

interface OrdersViewProps {
  orders: Order[];
  employees: Employee[];
  onAddOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus, assignedCookId?: string) => void;
  onDeleteOrder: (orderId: string) => void;
}

const OrdersView: React.FC<OrdersViewProps> = ({ orders, employees, onAddOrder, onUpdateStatus, onDeleteOrder }) => {
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [newOrder, setNewOrder] = React.useState({ table: '', items: [{ name: '', quantity: 1 }] });
  const prevOrdersRef = useRef<Order[]>([]);

  useEffect(() => {
    // Check if there's a new 'pendiente' order
    const prevOrders = prevOrdersRef.current;
    if (prevOrders.length > 0) {
      const isNewPendiente = orders.some(o => o.status === 'pendiente' && !prevOrders.some(po => po.id === o.id));
      if (isNewPendiente) {
        // Play notification sound
        try {
            // A simple short high-pitched synth beep using Web Audio API
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const ctx = new AudioContextClass();
            const osc = ctx.createOscillator();
            const gainNode = ctx.createGain();
            osc.connect(gainNode);
            gainNode.connect(ctx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
            gainNode.gain.setValueAtTime(0, ctx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.02);
            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) {
            console.error("Audio playback error", e);
        }
      }
    }
    prevOrdersRef.current = orders;
  }, [orders]);

  const handleAddItem = () => {
    setNewOrder(prev => ({ ...prev, items: [...prev.items, { name: '', quantity: 1 }] }));
  };

  const handleRemoveItem = (index: number) => {
    setNewOrder(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }));
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: string | number) => {
    setNewOrder(prev => ({
      ...prev,
      items: prev.items.map((item, i) => i === index ? { ...item, [field]: value } : item)
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrder.table || newOrder.items.some(i => !i.name)) return;
    onAddOrder(newOrder);
    setNewOrder({ table: '', items: [{ name: '', quantity: 1 }] });
    setShowAddModal(false);
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pendiente': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      case 'en preparación': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
      case 'listo': return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'entregado': return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
      case 'pagado': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50';
      case 'cerrado': return 'bg-red-500/20 text-red-500 border-red-500/50';
      default: return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pendiente': return <ClockIcon className="w-4 h-4" />;
      case 'en preparación': return <PlayIcon className="w-4 h-4" />;
      case 'listo': return <CheckCircleIcon className="w-4 h-4" />;
      case 'entregado': return <CheckCircleIcon className="w-4 h-4" />;
      case 'pagado': return <CheckCircleIcon className="w-4 h-4" />;
      case 'cerrado': return <TrashIcon className="w-4 h-4" />;
      default: return <ClockIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Pedidos Activos</h2>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-bold"
        >
          <PlusIcon className="w-5 h-5" />
          Nuevo Pedido
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {orders.map(order => (
          <div key={order.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex flex-col gap-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-white">Mesa {order.table}</h3>
                <p className="text-xs text-gray-400">{new Date(order.createdAt).toLocaleTimeString()}</p>
              </div>
              <div className={`px-2 py-1 rounded border text-[10px] font-bold uppercase flex items-center gap-1 ${getStatusColor(order.status)}`}>
                {getStatusIcon(order.status)}
                {order.status}
              </div>
            </div>

            <div className="flex-1 space-y-2">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-300">{item.name}</span>
                  <span className="font-bold text-blue-400">x{item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="pt-4 border-t border-gray-700 space-y-3">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <UserIcon className="w-3 h-3" />
                <span>Cocinero: {employees.find(e => e.id === order.assignedCookId)?.name || 'Sin asignar'}</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {order.status === 'pendiente' && (
                  <button
                    onClick={() => onUpdateStatus(order.id, 'en preparación')}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-2 rounded font-bold transition-colors"
                  >
                    Preparar
                  </button>
                )}
                {order.status === 'en preparación' && (
                  <button
                    onClick={() => onUpdateStatus(order.id, 'listo')}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs py-2 rounded font-bold transition-colors"
                  >
                    Listo
                  </button>
                )}
                {order.status === 'listo' && (
                  <button
                    onClick={() => onUpdateStatus(order.id, 'entregado')}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white text-xs py-2 rounded font-bold transition-colors"
                  >
                    Entregar
                  </button>
                )}
                <button
                  onClick={() => onDeleteOrder(order.id)}
                  className="p-2 text-red-400 hover:bg-red-400/10 rounded transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
              
              {order.status === 'pendiente' && (
                <select
                  className="w-full bg-gray-700 border border-gray-600 text-white text-xs rounded p-1"
                  onChange={(e) => onUpdateStatus(order.id, order.status, e.target.value)}
                  value={order.assignedCookId || ''}
                >
                  <option value="">Asignar Cocinero</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Nuevo Pedido</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Mesa</label>
                <input
                  type="text"
                  required
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white"
                  value={newOrder.table}
                  onChange={e => setNewOrder(prev => ({ ...prev, table: e.target.value }))}
                  placeholder="Ej: 5 o Terraza 2"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Elementos</label>
                {newOrder.items.map((item, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      required
                      className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-2 text-white text-sm"
                      value={item.name}
                      onChange={e => handleItemChange(index, 'name', e.target.value)}
                      placeholder="Plato o bebida"
                    />
                    <input
                      type="number"
                      required
                      min="1"
                      className="w-16 bg-gray-700 border border-gray-600 rounded-lg p-2 text-white text-sm"
                      value={item.quantity}
                      onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value))}
                    />
                    {newOrder.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-blue-400 hover:text-blue-300 font-bold flex items-center gap-1"
                >
                  <PlusIcon className="w-3 h-3" /> Añadir elemento
                </button>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-bold transition-colors"
                >
                  Crear Pedido
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrdersView;
