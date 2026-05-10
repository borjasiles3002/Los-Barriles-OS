import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Order, Recipe, StockItem, Employee, TipEntry } from '../types';
import { TrashIcon, PlusIcon, VentasIcon, EditIcon, SaveIcon } from './icons';
import { onAuthStateChanged } from 'firebase/auth';
import { db, doc, setDoc, onSnapshot, handleFirestoreError, OperationType, auth, runTransaction } from '../src/firebase';

interface TableInstance {
    id: string;
    name: string;
    x: number;
    y: number;
}

interface TPVViewProps {
  orders: Order[];
  recipes: Recipe[];
  drinkStock: StockItem[];
  employees: Employee[];
  onAddOrder: (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => void;
  onUpdateOrder: (order: Order) => void;
  onDeleteOrder: (orderId: string) => void;
  onAddSale: (amount: number, concept: string) => void;
  onAddTip: (tip: Omit<TipEntry, 'id' | 'date'>) => void;
}

const CATEGORIES = ['Todas', 'Cervezas', 'Vinos', 'Refrescos', 'Entrantes', 'Segundos', 'Postres', 'Cafés', 'Licores'];

const TPVView: React.FC<TPVViewProps> = ({ orders, recipes, drinkStock, employees, onAddOrder, onUpdateOrder, onAddSale, onAddTip }) => {
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [tables, setTables] = useState<TableInstance[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('Todas');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentAmountStr, setPaymentAmountStr] = useState<string>('');
  const [tipAmountStr, setTipAmountStr] = useState<string>('');
  const [tipEmployeeId, setTipEmployeeId] = useState<string>('pool');

  const [showCustomProductModal, setShowCustomProductModal] = useState(false);
  const [customProductName, setCustomProductName] = useState('');
  const [customProductPrice, setCustomProductPrice] = useState('');
  const [customProductFamily, setCustomProductFamily] = useState('Otros');

  const mapRef = useRef<HTMLDivElement>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Load layout from Firestore
  useEffect(() => {
      let unsubSnapshot: (() => void) | undefined;
      
      const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
          if (user) {
              if (unsubSnapshot) unsubSnapshot(); // Cleanup previous if any
              unsubSnapshot = onSnapshot(doc(db, 'system', 'tpvLayout'), (docSnap) => {
                  if (docSnap.exists()) {
                      try {
                          const data = docSnap.data();
                          if (data.tables && data.tables.length > 0) setTables(data.tables);
                      } catch {
                          // Fallback safely
                      }
                  } else {
                      // Default tables layout
                      setTables([
                          { id: 't1', name: 'Barra 1', x: 10, y: 10 },
                          { id: 't2', name: 'Barra 2', x: 10, y: 30 },
                          { id: 't3', name: 'Mesa 1', x: 40, y: 10 },
                          { id: 't4', name: 'Mesa 2', x: 40, y: 40 }
                      ]);
                  }
              }, (error) => {
                  console.warn("tpvLayout snapshot error:", error);
              });
          }
      });

      return () => {
          unsubscribeAuth();
          if (unsubSnapshot) unsubSnapshot();
      };
  }, []);

  const saveLayout = async (newTables: TableInstance[]) => {
      // Local optimistic update first (avoid jumping on drag start/end)
      setTables(newTables);
      try {
          await setDoc(doc(db, 'system', 'tpvLayout'), { tables: newTables });
      } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'system/tpvLayout');
      }
  };

  const handleAddTable = () => {
      const newId = `t-${Date.now()}`;
      const newTable: TableInstance = {
          id: newId,
          name: `Mesa ${tables.length + 1}`,
          x: 50,
          y: 50
      };
      saveLayout([...tables, newTable]);
  };

  const handleRemoveTable = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      saveLayout(tables.filter(t => t.id !== id));
  };

  const openOrders = orders.filter(o => o.status !== 'cerrado'); 

  const handleTableClick = (tableName: string) => {
    if (isEditMode) return;
    setSelectedTable(tableName);
  };

  const currentOrder = openOrders.find(o => o.table === selectedTable);

  const handleAddItem = (itemInfo: { name: string, price: number, family?: string }) => {
    if (!selectedTable) return;
    
    if (currentOrder) {
        // Use a true real-time transaction to append/increment items safely across multiple PDAs
        const orderRef = doc(db, 'orders', currentOrder.id);
        runTransaction(db, async (t) => {
            const docSnap = await t.get(orderRef);
            if (!docSnap.exists()) return;
            const data = docSnap.data() as Order;
            const newItems = [...(data.items || [])];
            
            const existingItemIndex = newItems.findIndex(i => i.name === itemInfo.name && i.price === itemInfo.price);
            if (existingItemIndex >= 0) {
                newItems[existingItemIndex] = {
                    ...newItems[existingItemIndex],
                    quantity: newItems[existingItemIndex].quantity + 1
                };
            } else {
                newItems.push({
                    id: `item-${Date.now()}-${Math.random()}`,
                    name: itemInfo.name,
                    price: itemInfo.price,
                    quantity: 1,
                    family: itemInfo.family || '',
                });
            }
            
            const newTotal = newItems.reduce((sum, item) => sum + ((item.price || 0) * item.quantity), 0);
            t.update(orderRef, JSON.parse(JSON.stringify({
                items: newItems,
                total: Math.max(0, newTotal),
                updatedAt: new Date().toISOString()
            })));
        }).catch(err => {
            console.error("Failed to add item via transaction:", err);
            handleFirestoreError(err, OperationType.UPDATE, `orders/${currentOrder.id}`);
        });
    } else {
        // Create new order
        onAddOrder({
            table: selectedTable,
            items: [{
                id: `item-${Date.now()}-${Math.random()}`,
                name: itemInfo.name,
                price: itemInfo.price,
                quantity: 1,
                family: itemInfo.family || '',
            }],
            total: itemInfo.price,
            waiter: auth.currentUser?.email || 'Administrador'
        });
    }
  };

  const handleAddCustomProduct = () => {
      const price = parseFloat(customProductPrice.replace(',', '.'));
      if (customProductName.trim() && !isNaN(price) && price >= 0) {
          handleAddItem({ name: customProductName.trim(), price, family: customProductFamily });
          setShowCustomProductModal(false);
          setCustomProductName('');
          setCustomProductPrice('');
          setCustomProductFamily('Otros');
      } else {
          alert('Por favor, introduce un nombre y un precio válido.');
      }
  };

  const handleUpdateItemQuantity = (itemIndex: number, delta: number) => {
    if (!currentOrder) return;
    
    // Actually we will just run the transaction
    const orderRef = doc(db, 'orders', currentOrder.id);
    runTransaction(db, async (t) => {
        const docSnap = await t.get(orderRef);
        if (!docSnap.exists()) return;
        const data = docSnap.data() as Order;
        const newItems = [...(data.items || [])];
        
        const item = newItems[itemIndex];
        if (!item) return;
        
        item.quantity += delta;
        if (item.quantity <= 0) {
            newItems.splice(itemIndex, 1);
        }
        
        const newTotal = newItems.reduce((sum, i) => sum + ((i.price || 0) * i.quantity), 0);
        t.update(orderRef, JSON.parse(JSON.stringify({
            items: newItems,
            total: Math.max(0, newTotal),
            updatedAt: new Date().toISOString()
        })));
    }).catch(err => {
        console.error("Failed to update item quantity via transaction:", err);
        handleFirestoreError(err, OperationType.UPDATE, `orders/${currentOrder.id}`);
    });
  };

  const handleRemoveItem = (itemIndex: number) => {
    if (!currentOrder) return;
    const removedItem = currentOrder.items[itemIndex];
    if (!removedItem) return;
    
    handleUpdateItemQuantity(itemIndex, -removedItem.quantity); // Removes it entirely
  };

  const handlePrintTicket = () => {
      if (!currentOrder) return;

      const ticketWindow = window.open('', '_blank');
      if (!ticketWindow) {
          alert('Por favor, permite las ventanas emergentes (pop-ups) para imprimir el ticket.');
          return;
      }

      const date = new Date().toLocaleString('es-ES');
      const itemsHtml = currentOrder.items.map(item => `
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
              <span>${item.quantity}x ${item.name}</span>
              <span>${((item.price || 0) * item.quantity).toFixed(2)}€</span>
          </div>
      `).join('');

      const html = `
          <html>
              <head>
                  <title>Ticket Mesa ${currentOrder.table}</title>
                  <style>
                      body {
                          font-family: monospace;
                          width: 80mm; /* standard thermal printer width */
                          margin: 0 auto;
                          padding: 10px;
                          color: #000;
                          background: #fff;
                      }
                      .header { text-align: center; margin-bottom: 20px; }
                      .header h2 { margin: 0; font-size: 20px; text-transform: uppercase; }
                      .header p { margin: 5px 0; font-size: 14px; }
                      .divider { border-top: 1px dashed #000; margin: 10px 0; }
                      .total { font-weight: bold; font-size: 18px; margin-top: 15px; text-align: right; }
                      .footer { text-align: center; font-size: 14px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 15px;}
                      @media print {
                          body { width: 100%; margin: 0; padding: 0;}
                      }
                  </style>
              </head>
              <body>
                  <div class="header">
                      <img src="/logo.png" alt="Los Barriles Logo" style="max-width: 150px; margin: 0 auto 10px auto; display: block;" onerror="this.onerror=null; this.src=''; this.style.display='none';" />
                      <svg id="fallback-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000000" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="width: 64px; height: 64px; margin: 0 auto 10px auto; display: none;">
                          <path d="M5 22h14c2.5 0 3-4.5 3-10S21.5 2 19 2H5C2.5 2 2 6.5 2 12S2.5 22 5 22Z"/>
                          <path d="M2 7h20"/>
                          <path d="M2 17h20"/>
                          <path d="M10 2v20"/>
                          <path d="M14 2v20"/>
                      </svg>
                      <script>
                        document.querySelector('img').addEventListener('error', function() {
                           document.getElementById('fallback-logo').style.display = 'block';
                        });
                      </script>
                      <h2>LOS BARRILES</h2>
                      <p>Mesa: ${currentOrder.table}</p>
                      <p>Fecha: ${date}</p>
                  </div>
                  <div class="divider"></div>
                  ${itemsHtml}
                  <div class="divider"></div>
                  <div class="total">
                      TOTAL: ${(currentOrder.total || 0).toFixed(2)}€
                  </div>
                  <div class="footer">
                      <p>¡Gracias por su visita!</p>
                  </div>
                  <script>
                      // Give it a tiny bit of time to render before printing
                      setTimeout(() => {
                          window.print();
                          window.close();
                      }, 500);
                  </script>
              </body>
          </html>
      `;

      ticketWindow.document.open();
      ticketWindow.document.write(html);
      ticketWindow.document.close();
  };

  const handlePayClick = () => {
      if (!currentOrder) return;
      const amount = currentOrder.total || 0;
      if (amount <= 0 && currentOrder.items.length === 0) {
          onUpdateOrder({ ...currentOrder, status: 'cerrado' });
          setSelectedTable(null);
          return;
      }
      setShowPaymentModal(true);
      setIsMobileCartOpen(false);
      const remaining = amount - (currentOrder.paidAmount || 0);
      setPaymentAmountStr(remaining.toFixed(2));
  };

  const handlePartialPay = (method: 'efectivo' | 'tarjeta') => {
      if (!currentOrder) return;
      const amountToPay = parseFloat(paymentAmountStr.replace(',', '.'));
      if (isNaN(amountToPay) || amountToPay <= 0) return;

      const currentTotal = currentOrder.total || 0;
      const currentPaid = currentOrder.paidAmount || 0;
      const remaining = currentTotal - currentPaid;

      // if payment is roughly equal to remaining or greater
      const isFullPayment = amountToPay >= (remaining - 0.01);
      
      const realAmountToPay = isFullPayment ? remaining : amountToPay;

      const methodStr = method === 'efectivo' ? 'Efectivo' : 'Tarjeta';
      const concept = `Mesa: ${currentOrder.table} - Pago ${isFullPayment && currentPaid === 0 ? methodStr : `Parcial ${methodStr}`}`;
      
      onAddSale(realAmountToPay, concept);

      // Handle Tips
      const tipAmount = parseFloat(tipAmountStr.replace(',', '.'));
      if (!isNaN(tipAmount) && tipAmount > 0) {
          onAddTip({
              amount: tipAmount,
              method,
              employeeId: tipEmployeeId,
              orderId: currentOrder.id
          });
      }

      setTipAmountStr('');
      setTipEmployeeId('pool');

      if (isFullPayment) {
          onUpdateOrder({ ...currentOrder, paidAmount: currentTotal, status: 'pagado' });
          setShowPaymentModal(false);
          setSelectedTable(null);
      } else {
          onUpdateOrder({ ...currentOrder, paidAmount: currentPaid + realAmountToPay });
          setShowPaymentModal(false);
      }
  };
  
  const handleLiberarMesa = () => {
      if (!currentOrder) return;
      onUpdateOrder({ ...currentOrder, status: 'cerrado' });
      setSelectedTable(null);
  };

  const getTableColor = (tableStr: string) => {
      const order = openOrders.find(o => o.table === tableStr);
      if (!order) return 'bg-gray-800/80 border-gray-700/50 text-gray-400'; 
      if (order.status === 'pagado') return 'bg-gradient-to-br from-emerald-500 to-emerald-700 border-emerald-400 text-white shadow-emerald-900/50';
      return 'bg-gradient-to-br from-blue-500 to-indigo-700 border-indigo-400 text-white shadow-blue-900/50';
  };

  // Drag logic
  const handlePointerDown = (id: string, e: React.PointerEvent) => {
      if (!isEditMode) return;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      setDraggingId(id);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
      if (!isEditMode || !draggingId || !mapRef.current) return;
      
      const rect = mapRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;
      
      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      setTables(prev => prev.map(t => t.id === draggingId ? { ...t, x, y } : t));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
      if (draggingId) {
          (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          setDraggingId(null);
          // Only save to firestore when the drag finishes
          saveLayout(tables);
      }
  };

  const changeTableName = (id: string, newName: string) => {
      const newTables = tables.map(t => t.id === id ? { ...t, name: newName } : t);
      saveLayout(newTables);
  };

  // Item filtering
  // Mock categorization since real items might not have strict categories
  // We'll use simple keywords matching or check 'category'/'family' if present
  const getCategoryItems = () => {
      let items: { id: string; name: string; price: number; type: string }[] = [];
      
      if (activeCategory === 'Todas') {
          const allDrinks = drinkStock.filter(d => d.showInTPV !== false).map(d => ({ id: d.id, name: d.name, price: d.lastPrice || 2.50, type: 'drink' }));
          const allFood = recipes.filter(r => r.showInTPV !== false).map(r => ({ id: r.id, name: r.name, price: r.calculatedCost ? ((r.calculatedCost / (r.yield || 1)) * 3.5) : 12.0, type: 'food' }));
          items = [...allDrinks, ...allFood];
      } else {
          const isDrinkCat = ['Refrescos', 'Cervezas', 'Vinos', 'Cafés', 'Licores'].includes(activeCategory);
          
          if (isDrinkCat) {
              items = drinkStock.filter(d => d.showInTPV !== false).filter(d => {
                  const catLower = activeCategory.toLowerCase();
                  const dCat = d.category?.toLowerCase() || d.family?.toLowerCase() || '';
                  if (dCat.includes(catLower)) return true;
                  if (activeCategory === 'Refrescos' && (d.name.toLowerCase().includes('cola') || d.name.toLowerCase().includes('agua') || d.name.toLowerCase().includes('naranja') || d.name.toLowerCase().includes('limon'))) return true;
                  if (activeCategory === 'Cervezas' && (d.name.toLowerCase().includes('cerveza') || d.name.toLowerCase().includes('caña') || d.name.toLowerCase().includes('mahou') || d.name.toLowerCase().includes('estrella'))) return true;
                  if (activeCategory === 'Vinos' && (d.name.toLowerCase().includes('vino') || d.name.toLowerCase().includes('blanco') || d.name.toLowerCase().includes('tinto'))) return true;
                  if (activeCategory === 'Cafés' && (d.name.toLowerCase().includes('cafe') || d.name.toLowerCase().includes('café') || d.name.toLowerCase().includes('descaf'))) return true;
                  if (activeCategory === 'Licores' && (d.name.toLowerCase().includes('ron') || d.name.toLowerCase().includes('ginebra') || d.name.toLowerCase().includes('whisky') || d.name.toLowerCase().includes('vodka'))) return true;
                  return false;
              }).map(d => ({ id: d.id, name: d.name, price: d.lastPrice || 2.50, type: 'drink' }));
          } else {
              items = recipes.filter(r => r.showInTPV !== false).filter(r => {
                  const catLower = activeCategory.toLowerCase();
                  const rCat = r.category?.toLowerCase() || '';
                  if (rCat.includes(catLower)) return true;
                  // Add naive fallbacks, if no matches, show all in "Otros" except some known ones
                  if (activeCategory === 'Otros' && !r.category) return true;
                  return false;
              }).map(r => ({ id: r.id, name: r.name, price: r.calculatedCost ? ((r.calculatedCost / (r.yield || 1)) * 3.5) : 12.0, type: 'food' }));
          }
      }

      if (searchTerm) {
          const term = searchTerm.toLowerCase();
          return items.filter(i => i.name.toLowerCase().includes(term));
      }
      return items;
  };

  const currentCategoryItems = getCategoryItems();

  return (
    <div className="flex-1 flex flex-col md:flex-row gap-4 max-w-7xl mx-auto w-full">
        {/* Lado izquierdo: Mapa de Mesas */}
        {(!selectedTable || isEditMode) && (
            <div className={`flex flex-col gap-4 transition-all duration-300 w-full`}>
                <div className="flex justify-between items-center bg-gray-900 p-3 md:p-4 rounded-xl border border-gray-800">
                    <h2 className="text-lg md:text-xl font-bold text-white flex items-center gap-2">
                        <VentasIcon /> {isEditMode ? 'Editar Mapa' : 'PDA / Mesas'}
                    </h2>
                    <div className="flex gap-2">
                        {isEditMode && (
                            <button onClick={handleAddTable} className="bg-green-600 hover:bg-green-500 text-white px-2 py-1 rounded-lg flex items-center gap-1 font-bold text-xs">
                                <PlusIcon className="w-3 h-3" /> Mesa
                            </button>
                        )}
                        <button onClick={() => setIsEditMode(!isEditMode)} className={`px-3 py-1 rounded-lg flex items-center gap-2 font-bold text-xs transition-colors ${isEditMode ? 'bg-blue-600 text-white hover:bg-blue-500' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                            {isEditMode ? <><SaveIcon className="w-4 h-4" /> Guardar</> : <><EditIcon className="w-4 h-4" /> Editar</>}
                        </button>
                    </div>
                </div>

                {/* Grid para móvil (mucho más fácil para PDA) */}
                {!isEditMode && (
                    <div className="md:hidden grid grid-cols-3 sm:grid-cols-4 gap-3 py-2 flex-1 overflow-y-auto content-start">
                        {(() => {
                            const allTableNames = Array.from(new Set([
                                ...tables.map(t => t.name),
                                ...openOrders.map(o => o.table)
                            ]));

                            return allTableNames.map(tableName => {
                                const tableObj = tables.find(t => t.name === tableName);
                                const isSelected = selectedTable === tableName;
                                const order = openOrders.find(o => o.table === tableName);
                                return (
                                    <button
                                        key={tableObj ? tableObj.id : `ghost-${tableName}`}
                                        onClick={() => handleTableClick(tableName)}
                                        className={`relative p-2 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 shadow-lg h-24 transition-transform active:scale-95 ${getTableColor(tableName)} ${isSelected ? 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-gray-900 border-yellow-500' : ''}`}
                                    >
                                        <span className="font-black text-xl truncate w-full text-center">{tableName}</span>
                                        {order && (
                                            <div className="flex flex-col items-center w-full">
                                                <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full font-bold">{(order.total || 0).toFixed(2)}€</span>
                                                {order.status === 'preparando' && <span className="text-[9px] mt-1 text-orange-200 animate-pulse uppercase whitespace-nowrap">En Cocina</span>}
                                                {order.status === 'listo' && <span className="text-[9px] mt-1 text-emerald-200 animate-pulse uppercase whitespace-nowrap">Listo</span>}
                                            </div>
                                        )}
                                        {!order && (
                                            <span className="text-[10px] opacity-75">Libre</span>
                                        )}
                                    </button>
                                );
                            });
                        })()}
                    </div>
                )}

                <div 
                    ref={mapRef}
                    className={`flex-1 relative bg-gray-900 border-2 rounded-2xl overflow-hidden touch-none ${isEditMode ? 'border-dashed border-blue-500' : 'border-gray-800'} min-h-[500px] md:min-h-[600px] ${!isEditMode ? 'hidden md:block' : ''}`}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                >
                    <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                    
                    {/* Ghost tables (orders for tables not in layout) */}
                    {!isEditMode && (
                        <div className="absolute top-2 left-2 flex gap-2 flex-wrap max-w-full z-10 pointer-events-none">
                            {openOrders.filter(o => !tables.some(t => t.name === o.table)).map(order => {
                                const isSelected = selectedTable === order.table;
                                return (
                                    <button
                                        key={`ghost-desktop-${order.table}`}
                                        onClick={(e) => { e.stopPropagation(); handleTableClick(order.table); }}
                                        className={`relative p-2 rounded-xl flex flex-col items-center justify-center shadow-[0_0_15px_rgba(255,0,0,0.3)] border-2 border-red-500 w-20 h-20 transition-transform hover:scale-105 active:scale-95 ${getTableColor(order.table)} ${isSelected ? 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-gray-900 border-yellow-500 shadow-yellow-500' : ''} pointer-events-auto bg-gray-900/90`}
                                    >
                                        <span className="font-black text-xs truncate w-full text-center">{order.table}</span>
                                        <div className="flex flex-col items-center w-full">
                                            <span className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded font-bold">{(order.total || 0).toFixed(2)}€</span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {tables.map(table => {
                        const isSelected = selectedTable === table.name;
                        const order = openOrders.find(o => o.table === table.name);
                        
                        return (
                            <motion.div
                                key={table.id}
                                id={table.id}
                                layout
                                whileHover={{ scale: isEditMode ? 1.05 : 1.02 }}
                                whileTap={isEditMode ? { scale: 1.1, zIndex: 50, cursor: 'grabbing' } : { scale: 0.95 }}
                                onPointerDown={(e) => handlePointerDown(table.id, e)}
                                onClick={() => handleTableClick(table.name)}
                                className={`absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-2 rounded-2xl shadow-xl backdrop-blur-md
                                    ${isEditMode ? 'cursor-grab border-2 border-dashed border-white bg-gray-800/80 z-10' : 'cursor-pointer border-2'}
                                    ${!isEditMode && getTableColor(table.name)}
                                    ${(!isEditMode && isSelected) ? 'ring-4 ring-yellow-500 ring-offset-4 ring-offset-gray-900 scale-105 z-10' : 'hover:scale-[1.02]'}
                                `}
                                style={{ 
                                    left: `${table.x}%`, 
                                    top: `${table.y}%`,
                                    width: '80px',
                                    height: '80px',
                                   // On desktop make them larger
                                   ...(window.innerWidth > 768 ? { width: '120px', height: '120px' } : {})
                                }}
                            >
                               {isEditMode ? (
                                   <>
                                       <input 
                                           type="text" 
                                           value={table.name} 
                                           onChange={(e) => changeTableName(table.id, e.target.value)}
                                           className="bg-black/50 rounded text-white text-center font-bold text-sm outline-none border border-gray-500 w-[110%] px-1 mb-1 focus:border-yellow-400 focus:bg-gray-800"
                                           onClick={e => e.stopPropagation()}
                                           onPointerDown={e => e.stopPropagation()}
                                       />
                                       <button 
                                          onClick={(e) => handleRemoveTable(table.id, e)}
                                          onPointerDown={e => e.stopPropagation()}
                                          className="absolute -top-3 -right-3 bg-red-600 hover:bg-red-500 rounded-full p-1.5 shadow-lg hover:scale-110 transition-transform"
                                       >
                                           <TrashIcon className="w-4 h-4 text-white" />
                                       </button>
                                       <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-20 pointer-events-none">
                                           <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
                                           </svg>
                                       </div>
                                   </>
                               ) : (
                                   <>
                                       <div className="absolute inset-2 border-2 border-white/20 rounded-full pointer-events-none" />
                                       <span className="font-black text-center text-sm md:text-base leading-tight break-words z-10">{table.name}</span>
                                       {order && (
                                           <motion.span 
                                               initial={{ scale: 0 }}
                                               animate={{ scale: 1 }}
                                               className={`absolute -bottom-4 text-sm font-black border-2 border-white text-white rounded-full px-3 py-0.5 whitespace-nowrap z-20 ${order.paidAmount ? 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)]' : 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]'}`}
                                           >
                                               {((order.total || 0) - (order.paidAmount || 0)).toFixed(2)}€
                                           </motion.span>
                                       )}
                                   </>
                               )}
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        )}

        {/* Lado derecho: Menú y Pedido (Sólo si hay mesa seleccionada y no es edición) */}
        {!isEditMode && selectedTable && (
            <div className="w-full flex-1 flex flex-col bg-gray-900 rounded-2xl border border-gray-800 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 fill-mode-forwards duration-300">
                {/* Cabecera Principal */}
                <div className="bg-gray-950 p-2 md:p-3 flex items-center gap-2 border-b border-gray-800 shrink-0 justify-between">
                    <button 
                         onClick={() => setSelectedTable(null)} 
                         className="flex items-center gap-1 hover:bg-gray-800 bg-gray-800/50 text-gray-300 px-3 py-2 rounded-lg font-bold border border-gray-700 shadow-sm transition-colors shrink-0 text-xs md:text-sm"
                    >
                         <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                           <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                         </svg>
                         <span className="hidden sm:inline">Mesas</span>
                    </button>
                    <div className="flex-1 relative">
                        <input 
                            type="text" 
                            placeholder={`Buscar...`} 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-gray-800 border border-gray-700 text-white rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:border-yellow-500 w-full font-semibold text-sm placeholder:text-gray-500"
                        />
                        <svg className="w-4 h-4 absolute left-2.5 top-2 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <button 
                        onClick={() => setShowCustomProductModal(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-2 sm:px-3 py-1.5 rounded-lg flex items-center justify-center gap-1 font-bold text-xs shadow shadow-emerald-900/20"
                    >
                        <PlusIcon className="w-4 h-4" /> <span className="hidden sm:inline">Prod. Libre</span>
                    </button>
                    <div className="font-black text-yellow-500 text-sm md:text-lg whitespace-nowrap bg-yellow-500/10 px-2 py-1 rounded border border-yellow-500/20">{selectedTable}</div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Category Scroll */}
                        <div className="bg-gray-950 p-2 overflow-x-auto flex items-center gap-2 border-b border-gray-800 scrollbar-hide shrink-0">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => { setActiveCategory(cat); setSearchTerm(''); }}
                                    className={`px-3 py-1.5 rounded-lg font-bold text-xs whitespace-nowrap transition-colors flex-shrink-0 shadow-sm ${activeCategory === cat ? 'bg-yellow-500 text-black' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Lista de productos por categoría */}
                        <div className="flex-1 p-2 md:p-4 overflow-y-auto bg-gray-850 pb-32 md:pb-4">
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2">
                                {currentCategoryItems.map(item => (
                                    <button 
                                        key={item.id}
                                        onClick={() => handleAddItem({ name: item.name, price: item.price })}
                                        className={`relative rounded-lg p-1.5 flex flex-col items-center justify-center text-center h-16 md:h-20 transition-all duration-300 active:scale-[0.95] border shadow-sm group overflow-hidden bg-cover bg-center
                                            ${item.type === 'drink' ? 'bg-gradient-to-br from-blue-900/60 to-blue-950/80 border-blue-500/30 hover:border-blue-500/80' : 'bg-gradient-to-br from-orange-900/60 to-red-950/80 border-orange-500/30 hover:border-orange-500/80'}
                                        `}
                                    >
                                        <div className="absolute inset-0 bg-gray-950/40 opacity-80" />
                                        <div className="relative z-10 flex flex-col h-full items-center justify-between w-full">
                                            <span className="text-[9px] md:text-[10px] font-bold text-white uppercase tracking-wider leading-tight line-clamp-2">{item.name}</span>
                                            <span className={`text-[9px] md:text-[11px] font-black px-1 py-0.5 rounded bg-black/40 border border-white/10 text-white mt-1`}>{(item.price).toFixed(2)}€</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Botón flotante para ver pedido en móvil */}
                        {currentOrder && currentOrder.items.length > 0 && (
                            <div className="md:hidden fixed bottom-20 left-4 right-4 z-40 animate-in slide-in-from-bottom-5 fade-in duration-300">
                                <button 
                                    className="w-full bg-yellow-500 hover:bg-yellow-400 active:bg-yellow-600 text-black font-black py-4 rounded-2xl flex justify-between px-6 shadow-[0_10px_40px_-10px_rgba(234,179,8,0.5)] active:scale-95 transition-all"
                                    onClick={() => setIsMobileCartOpen(true)}
                                >
                                    <span className="flex items-center gap-2">
                                        VER CUENTA 
                                        <span className="bg-black/20 px-2 py-0.5 rounded-full text-xs font-bold">{currentOrder.items.length}</span>
                                    </span>
                                    <span>{(currentOrder?.total || 0).toFixed(2)}€</span>
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Overlay para móvil */}
                    {isMobileCartOpen && (
                        <div 
                            className="md:hidden fixed inset-0 bg-black/60 z-[55] backdrop-blur-sm animate-in fade-in"
                            onClick={() => setIsMobileCartOpen(false)}
                        />
                    )}

                    {/* Ticket (Desktop Sidebar / Mobile Drawer) */}
                    <div 
                        className={`fixed md:relative bottom-0 left-0 right-0 md:w-80 lg:w-96 flex-shrink-0 flex flex-col bg-gray-900 shadow-2xl z-[60] h-[85vh] md:h-auto transform transition-transform duration-300 ease-out border-t md:border-t-0 md:border-l border-gray-800 rounded-t-3xl md:rounded-none ${isMobileCartOpen ? 'translate-y-0' : 'translate-y-full md:translate-y-0'}`}
                    >
                        <div className="md:hidden flex justify-center p-3 cursor-pointer" onClick={() => setIsMobileCartOpen(false)}>
                            <div className="w-12 h-1.5 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors" />
                        </div>

                        <div className="px-4 py-3 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700 flex justify-between items-center shrink-0">
                            <h3 className="font-extrabold text-lg text-yellow-400 uppercase">{selectedTable}</h3>
                            <button className="md:hidden text-gray-400 hover:text-white font-bold transition-colors" onClick={() => setIsMobileCartOpen(false)}>Cerrar</button>
                        </div>
                        
                        <div className="flex-1 overflow-y-auto p-3 bg-black/30">
                            {currentOrder?.items.length === 0 || !currentOrder ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                    <VentasIcon />
                                    <span className="mt-2 font-bold text-sm">Comanda Vacía</span>
                                </div>
                            ) : (
                                <ul className="space-y-1.5">
                                    {currentOrder.items.map((item, idx) => (
                                        <li key={idx} className="flex justify-between items-center bg-gray-800 p-2 rounded-lg border border-gray-700">
                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                <div className="flex items-center bg-gray-950 rounded border border-gray-600 overflow-hidden shrink-0">
                                                    <button onClick={() => handleUpdateItemQuantity(idx, -1)} className="px-3 py-2 md:px-2 md:py-0.5 text-gray-400 hover:bg-gray-800 transition-colors">-</button>
                                                    <span className="text-gray-200 text-sm md:text-xs font-black min-w-[24px] text-center">{item.quantity}</span>
                                                    <button onClick={() => handleUpdateItemQuantity(idx, 1)} className="px-3 py-2 md:px-2 md:py-0.5 text-gray-400 hover:bg-gray-800 transition-colors">+</button>
                                                </div>
                                                <span className="text-gray-200 text-sm font-medium truncate">{item.name}</span>
                                            </div>
                                            <div className="flex items-center gap-3 md:gap-2">
                                                <span className="text-emerald-400 text-sm md:text-xs font-bold">{(item.price || 0).toFixed(2)}€</span>
                                                <button onClick={() => handleRemoveItem(idx)} className="text-red-400 p-2 md:p-1 hover:bg-red-400/10 rounded-lg transition-colors">
                                                    <TrashIcon className="w-4 h-4 md:w-3.5 md:h-3.5" />
                                                </button>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="p-4 bg-gray-900 border-t border-gray-800 shrink-0">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs uppercase font-bold text-gray-500 tracking-wider text-emerald-400">Total</span>
                                <span className="text-2xl font-black text-emerald-400">{((currentOrder?.total || 0) - (currentOrder?.paidAmount || 0)).toFixed(2)}€</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <button 
                                    onClick={handlePrintTicket}
                                    disabled={!currentOrder || currentOrder.items.length === 0}
                                    className="py-2.5 bg-gray-800 text-white rounded-lg text-xs font-bold border border-gray-700 disabled:opacity-50"
                                >
                                    Imprimir
                                </button>
                                {currentOrder?.status === 'pagado' ? (
                                    <button onClick={handleLiberarMesa} className="py-2.5 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase transition-all">Liberar</button>
                                ) : (
                                    <button onClick={handlePayClick} disabled={!currentOrder || currentOrder.items.length === 0} className="py-2.5 bg-emerald-600 text-white rounded-lg text-xs font-bold uppercase disabled:opacity-50 transition-all">Cobrar</button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Producto Libre */}
        {showCustomProductModal && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
                    <h2 className="text-xl font-black text-white mb-6 text-center uppercase tracking-wider">Añadir Prod. Libre</h2>
                    
                    <div className="space-y-4 mb-6">
                        <div>
                            <label className="block text-gray-400 text-xs font-bold mb-2 uppercase">Nombre del Producto</label>
                            <input 
                                type="text"
                                value={customProductName}
                                onChange={e => setCustomProductName(e.target.value)}
                                className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-emerald-500"
                                placeholder="Ej. Menú del día"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs font-bold mb-2 uppercase">Precio (€)</label>
                            <input 
                                type="number"
                                step="0.01"
                                value={customProductPrice}
                                onChange={e => setCustomProductPrice(e.target.value)}
                                className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-emerald-500"
                                placeholder="12.00"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-400 text-xs font-bold mb-2 uppercase">Familia</label>
                            <select
                                value={customProductFamily}
                                onChange={e => setCustomProductFamily(e.target.value)}
                                className="w-full bg-gray-800 text-white border border-gray-700 rounded-xl px-4 py-3 font-semibold focus:outline-none focus:border-emerald-500"
                            >
                                <option value="Otros">Otros (Sin marchar)</option>
                                <option value="Entrantes">Cocina - Entrantes</option>
                                <option value="Segundos">Cocina - Segundos</option>
                                <option value="Postres">Cocina - Postres</option>
                                <option value="Cervezas">Barra - Cervezas</option>
                                <option value="Vinos">Barra - Vinos</option>
                                <option value="Refrescos">Barra - Refrescos</option>
                                <option value="Cafés">Barra - Cafés</option>
                                <option value="Licores">Barra - Licores</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button 
                            onClick={() => {
                                setShowCustomProductModal(false);
                                setCustomProductName('');
                                setCustomProductPrice('');
                                setCustomProductFamily('Otros');
                            }}
                            className="flex-1 py-3 bg-gray-800 text-white font-bold rounded-xl border border-gray-700 hover:bg-gray-700 transition"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleAddCustomProduct}
                            className="flex-1 py-3 bg-emerald-600 text-white font-black rounded-xl hover:bg-emerald-500 transition"
                        >
                            Añadir
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* Modal de Pago */}
        {showPaymentModal && currentOrder && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
                    <h2 className="text-2xl font-black text-white mb-6 text-center uppercase tracking-wider">Detalles de Cobro</h2>
                    
                    <div className="flex justify-between items-center mb-6 bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <span className="text-gray-400 font-bold uppercase text-sm">TOTAL RESTANTE</span>
                        <span className="text-3xl font-black text-emerald-400">{((currentOrder.total || 0) - (currentOrder.paidAmount || 0)).toFixed(2)}€</span>
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-3 uppercase tracking-wide">Cantidad a Cobrar Ahora (€)</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full text-center text-4xl font-black bg-gray-800 border-2 border-emerald-500 p-4 rounded-2xl text-white outline-none focus:ring-4 focus:ring-emerald-500/50 transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                value={paymentAmountStr}
                                onChange={(e) => setPaymentAmountStr(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">Dividir cantidad restante</label>

                            <div className="flex gap-2">
                                {[2, 3, 4, 5].map(divisor => {
                                    const rem = (currentOrder.total || 0) - (currentOrder.paidAmount || 0);
                                    return (
                                        <button 
                                            key={divisor}
                                            onClick={() => setPaymentAmountStr((rem / divisor).toFixed(2))}
                                            className="flex-1 py-3 bg-gray-800 hover:bg-gray-700 text-white font-black rounded-xl border border-gray-700 transition-colors"
                                        >
                                            /{divisor}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Tips Section */}
                        <div className="pt-2">
                            <label className="block text-gray-400 text-sm font-bold mb-2 uppercase tracking-wide">Propina Opcional (€)</label>
                            <div className="flex gap-2 mb-2">
                                <input
                                    type="number"
                                    step="0.01"
                                    className="flex-1 text-center text-xl font-bold bg-gray-900 border border-gray-700 p-3 rounded-xl text-yellow-400 outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all placeholder-gray-600"
                                    value={tipAmountStr}
                                    onChange={(e) => setTipAmountStr(e.target.value)}
                                    placeholder="0.00"
                                />
                                <select 
                                    className="flex-1 bg-gray-900 border border-gray-700 text-gray-300 font-bold p-3 rounded-xl outline-none focus:ring-2 focus:ring-yellow-500/50 transition-all"
                                    value={tipEmployeeId}
                                    onChange={(e) => setTipEmployeeId(e.target.value)}
                                >
                                    <option value="pool">🍽️ Bote Común</option>
                                    {employees.map(emp => (
                                        <option key={emp.id} value={emp.id}>👤 {emp.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-4 border-t border-gray-800">
                             <button 
                                onClick={() => handlePartialPay('efectivo')}
                                disabled={!paymentAmountStr || isNaN(parseFloat(paymentAmountStr)) || parseFloat(paymentAmountStr) <= 0}
                                className="flex-1 py-4 font-black text-lg rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 disabled:bg-gray-700 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                             >
                                💵 Efectivo
                             </button>
                             <button 
                                onClick={() => handlePartialPay('tarjeta')}
                                disabled={!paymentAmountStr || isNaN(parseFloat(paymentAmountStr)) || parseFloat(paymentAmountStr) <= 0}
                                className="flex-1 py-4 font-black text-lg rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 disabled:bg-gray-700 shadow-[0_0_15px_rgba(59,130,246,0.4)] transition-all uppercase tracking-wider flex items-center justify-center gap-2"
                             >
                                💳 Tarjeta
                             </button>
                        </div>
                        
                        <button 
                            onClick={() => setShowPaymentModal(false)}
                            className="w-full py-4 font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors uppercase tracking-wider"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default TPVView;
