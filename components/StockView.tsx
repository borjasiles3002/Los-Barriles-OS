
import React, { useState, useMemo } from 'react';
import { StockItem, PriceHistoryEntry, ChatMessage } from '../types';
import StockList from './StockList';

import { LoadingSpinner, XIcon, SparkIcon } from './icons';
import { callGemini } from '../services/geminiService';
import { GEMINI_ADVISOR_PROMPT } from '../constants';
import ChatDisplay from './ChatDisplay';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface StockViewProps {
  isLoading: boolean;
  drinkStock: StockItem[];
  kitchenStock: StockItem[];
  onUpdateThreshold: (id: string, type: 'drink' | 'kitchen', threshold: number) => void;
  onUpdatePrice: (id: string, type: 'drink' | 'kitchen', price: number) => void;
  onUpdateFamily: (id: string, type: 'drink' | 'kitchen', family: string) => void;
  _onUpdateVisibility?: (id: string, type: 'drink' | 'kitchen', showInTPV: boolean) => void;
  onRenameFamily: (oldFamily: string, newFamily: string, type: 'drink' | 'kitchen') => void;
  onDeleteItem: (id: string, type: 'drink' | 'kitchen') => void;
  onAddTransaction: (tx: { stockItemId: string; type: 'entry' | 'exit'; quantity: number; reason?: string }) => void;
}

const PriceHistoryModal: React.FC<{ item: StockItem; onClose: () => void }> = ({ item, onClose }) => {
    const getPriceHistory = (item: StockItem): PriceHistoryEntry[] => {
        if (item.priceHistory && item.priceHistory.length > 0) {
            return item.priceHistory;
        }
        if (item.lastPrice !== undefined) {
            return [{ date: 'Precio inicial', price: item.lastPrice }];
        }
        return [];
    };

    const displayHistory = getPriceHistory(item);
    const chartHistory = useMemo(() => {
        return displayHistory
            .filter(h => h.date !== 'Precio inicial')
            .slice()
            .reverse()
            .map(h => ({
                ...h,
                formattedDate: new Date(h.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
            }));
    }, [displayHistory]);

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-white">Historial de Precios: {item.name}</h4>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>

                {chartHistory.length > 1 ? (
                    <div className="mb-6 w-full h-48 bg-gray-900 rounded-lg p-4 border border-gray-700 relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={chartHistory} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis dataKey="formattedDate" stroke="#9CA3AF" tick={{fontSize: 10}} />
                                <YAxis stroke="#9CA3AF" tick={{fontSize: 10}} tickFormatter={(val) => `${val}€`} />
                                <RechartsTooltip 
                                    contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem', fontSize: '12px' }}
                                    formatter={(value: number) => [`${value.toFixed(2)}€`, 'Precio']}
                                    labelStyle={{ color: '#9CA3AF', marginBottom: '4px' }}
                                />
                                <Line type="stepAfter" dataKey="price" stroke="#60A5FA" strokeWidth={3} dot={{ fill: '#60A5FA', r: 4, strokeWidth: 2, stroke: '#111827' }} activeDot={{ r: 6 }} />
                            </RechartsLineChart>
                        </ResponsiveContainer>
                    </div>
                ) : <p className="text-center text-gray-500 my-4">No hay suficientes datos para mostrar un gráfico.</p>}

                <div className="max-h-60 overflow-y-auto pr-2">
                    <ul className="divide-y divide-gray-700">
                        {displayHistory.map((entry, index) => (
                            <li key={index} className="py-2 flex justify-between items-center">
                                <span className="text-gray-300">
                                    {entry.date === 'Precio inicial' 
                                        ? entry.date 
                                        : new Date(entry.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute:'2-digit' })}
                                </span>
                                <span className="font-semibold text-white text-lg">{entry.price.toFixed(2)}€</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const AIAdviceModal: React.FC<{ isOpen: boolean; onClose: () => void; advice: ChatMessage[] | null; isLoading: boolean; title: string; }> = ({ isOpen, onClose, advice, isLoading, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl animate-fade-in flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-white flex items-center gap-2"><SparkIcon className="h-6 w-6 text-cyan-400" /> {title}</h4>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {isLoading && <div className="flex justify-center items-center h-32"><LoadingSpinner /></div>}
                    {advice && <ChatDisplay chatHistory={advice} />}
                </div>
            </div>
        </div>
    );
};




const ManualTransactionModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    drinkStock: StockItem[];
    kitchenStock: StockItem[];
    onAddTransaction: (tx: { stockItemId: string; type: 'entry' | 'exit'; quantity: number; reason?: string }) => void;
}> = ({ isOpen, onClose, drinkStock, kitchenStock, onAddTransaction }) => {
    const [selectedItemId, setSelectedItemId] = useState('');
    const [type, setType] = useState<'entry' | 'exit'>('entry');
    const [quantity, setQuantity] = useState('');
    const [reason, setReason] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const allItems = useMemo(() => [...drinkStock, ...kitchenStock], [drinkStock, kitchenStock]);
    const filteredItems = useMemo(() => allItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())), [allItems, searchTerm]);

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
        onClose();
        setQuantity('');
        setSelectedItemId('');
        setReason('');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4 min-h-screen" onClick={onClose} style={{ zIndex: 9999 }}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-xl font-bold text-white flex items-center gap-2">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/></svg>
                        Registro Manual de Inventario
                    </h4>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Producto</label>
                        <input 
                            type="text"
                            placeholder="Buscar producto..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-700 border-gray-600 rounded-t-lg text-white text-sm p-3 focus:ring-blue-500 focus:border-blue-500"
                        />
                        <select 
                            value={selectedItemId}
                            onChange={(e) => setSelectedItemId(e.target.value)}
                            className="w-full bg-gray-700 border-t-0 border-gray-600 rounded-b-lg text-white text-sm p-3 focus:ring-blue-500 focus:border-blue-500"
                            required
                        >
                            <option value="">Seleccionar producto...</option>
                            {filteredItems.map(item => (
                                <option key={item.id} value={item.id}>
                                    {item.name} (Stock: {item.stock})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Tipo de Movimiento</label>
                            <select 
                                value={type}
                                onChange={(e) => setType(e.target.value as 'entry' | 'exit')}
                                className="w-full bg-gray-700 border-gray-600 rounded-lg text-white text-sm p-3 focus:ring-blue-500 focus:border-blue-500"
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
                                className="w-full bg-gray-700 border-gray-600 rounded-lg text-white text-sm p-3 focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Motivo / Justificación</label>
                        <input 
                            type="text"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="Ej: Reposición manual, Merma, Rotura..."
                            className="w-full bg-gray-700 border-gray-600 rounded-lg text-white text-sm p-3 focus:ring-blue-500 focus:border-blue-500"
                            required
                        />
                    </div>

                    <button 
                        type="submit"
                        className={`w-full py-4 mt-2 rounded-xl font-bold text-white transition-all shadow-lg ${
                            type === 'entry' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20' : 'bg-red-600 hover:bg-red-700 shadow-red-900/20'
                        }`}
                    >
                        Confirmar {type === 'entry' ? 'Entrada' : 'Salida'} Manual
                    </button>
                </form>
            </div>
        </div>
    );
};

const StockView: React.FC<StockViewProps> = ({ 
    isLoading, drinkStock,
    kitchenStock,
    onUpdateThreshold,
    onUpdatePrice,
    onUpdateFamily,
    _onUpdateVisibility,
    onRenameFamily,
    onDeleteItem,
    onAddTransaction
 }) => {
    const [historyModalItem, setHistoryModalItem] = useState<StockItem | null>(null);
    const [activeSection, setActiveSection] = useState<'sala' | 'cocina' | null>(null);
    const [activeFamily, setActiveFamily] = useState<string | null>(null);
    const [isTransactionModalOpen, setTransactionModalOpen] = useState(false);
    
    const [drinkSearch, setDrinkSearch] = useState('');
    const [kitchenSearch, setKitchenSearch] = useState('');
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingThreshold, setEditingThreshold] = useState<string>('');
    const [editingPriceItemId, setEditingPriceItemId] = useState<string | null>(null);
    const [editingPriceValue, setEditingPriceValue] = useState<string>('');
    const [editingFamilyItemId, setEditingFamilyItemId] = useState<string | null>(null);
    const [editingFamilyValue, setEditingFamilyValue] = useState<string>('');
    const [isAdviceModalOpen, setAdviceModalOpen] = useState(false);
    const [advice, setAdvice] = useState<ChatMessage[] | null>(null);
    const [isAdviceLoading, setAdviceLoading] = useState(false);
    const [adviceTitle, setAdviceTitle] = useState('');
    const [isRenamingFamily, setIsRenamingFamily] = useState(false);
    const [newFamilyName, setNewFamilyName] = useState('');

    const stockSummary = useMemo(() => {
        const lowStockDrinks = drinkStock.filter(item => item.stock <= item.lowStockThreshold).length;
        const lowStockKitchen = kitchenStock.filter(item => item.stock <= item.lowStockThreshold).length;
        return {
            totalDrinks: drinkStock.length,
            lowStockDrinks,
            totalKitchen: kitchenStock.length,
            lowStockKitchen
        };
    }, [drinkStock, kitchenStock]);

    const groupedKitchenStock = useMemo(() => {
        const filtered = kitchenStock.filter(item => item.name.toLowerCase().includes(kitchenSearch.toLowerCase()));
        return filtered.reduce((acc, item) => {
            const family = item.family || 'SIN CATEGORÍA';
            if (!acc[family]) {
                acc[family] = [];
            }
            acc[family].push(item);
            return acc;
        }, {} as Record<string, StockItem[]>);
    }, [kitchenStock, kitchenSearch]);

    const groupedDrinkStock = useMemo(() => {
        const filtered = drinkStock.filter(item => item.name.toLowerCase().includes(drinkSearch.toLowerCase()));
        return filtered.reduce((acc, item) => {
            const family = item.family || 'SIN CATEGORÍA';
            if (!acc[family]) {
                acc[family] = [];
            }
            acc[family].push(item);
            return acc;
        }, {} as Record<string, StockItem[]>);
    }, [drinkStock, drinkSearch]);

    const availableSalaFamilies = useMemo(() => {
        const existing = Object.keys(groupedDrinkStock).filter(f => f !== 'SIN CATEGORÍA');
        return existing.sort();
    }, [groupedDrinkStock]);

    const availableCocinaFamilies = useMemo(() => {
        const existing = Object.keys(groupedKitchenStock).filter(f => f !== 'SIN CATEGORÍA');
        return existing.sort();
    }, [groupedKitchenStock]);
    
    const handleStartEdit = (item: StockItem) => {
        setEditingItemId(item.id);
        setEditingThreshold(String(item.lowStockThreshold));
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditingThreshold('');
    };

    const handleSaveEdit = (id: string, type: 'drink' | 'kitchen') => {
        const newThresholdValue = parseInt(editingThreshold, 10);
        if (isNaN(newThresholdValue) || newThresholdValue < 0) {
            handleCancelEdit();
            return;
        }

        onUpdateThreshold(id, type, newThresholdValue);
        handleCancelEdit();
    };

    const handleStartPriceEdit = (item: StockItem) => {
        setEditingPriceItemId(item.id);
        setEditingPriceValue(String(item.lastPrice || ''));
    };

    const handleCancelPriceEdit = () => {
        setEditingPriceItemId(null);
        setEditingPriceValue('');
    };

    const handleSavePriceEdit = (id: string, type: 'drink' | 'kitchen') => {
        const newPrice = parseFloat(editingPriceValue);
        if (isNaN(newPrice) || newPrice < 0) {
            handleCancelPriceEdit();
            return;
        }

        onUpdatePrice(id, type, newPrice);
        handleCancelPriceEdit();
    };

    const handleStartFamilyEdit = (item: StockItem) => {
        setEditingFamilyItemId(item.id);
        setEditingFamilyValue(item.family || '');
    };

    const handleCancelFamilyEdit = () => {
        setEditingFamilyItemId(null);
        setEditingFamilyValue('');
    };

    const handleSaveFamilyEdit = (id: string, type: 'drink' | 'kitchen') => {
        if (!editingFamilyValue.trim()) {
            handleCancelFamilyEdit();
            return;
        }

        onUpdateFamily(id, type, editingFamilyValue.trim());
        handleCancelFamilyEdit();
    };

    const handleRenameFamilySubmit = () => {
        if (activeFamily && newFamilyName.trim() && newFamilyName.trim() !== activeFamily && activeSection) {
            onRenameFamily(activeFamily, newFamilyName.trim(), activeSection === 'sala' ? 'drink' : 'kitchen');
            setActiveFamily(newFamilyName.trim());
        }
        setIsRenamingFamily(false);
        setNewFamilyName('');
    };
    
    const handleGetAdvice = async (itemName: string) => {
        setAdviceTitle(`Consejo de Compra: ${itemName}`);
        setAdviceModalOpen(true);
        setAdviceLoading(true);
        setAdvice(null);

        const prompt = `Contexto: Tengo bajo stock del producto "${itemName}".\n\nTarea: Dame consejos de compra. ¿Hay alguna alternativa de temporada que funcione bien a la brasa? ¿Alguna sugerencia para negociar con proveedores para este tipo de producto en una zona rural como Siles?`;
        const userMessage: ChatMessage = { role: 'user', parts: [{ text: prompt }] };
        setAdvice([userMessage]);

        try {
            const response = await callGemini([userMessage], GEMINI_ADVISOR_PROMPT, {}, 'gemini-2.0-flash');
            const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response.text }] };
            setAdvice(prev => prev ? [...prev, modelMessage] : [modelMessage]);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `Error al obtener consejo: ${errorMsg}` }] };
            setAdvice(prev => prev ? [...prev, errorMessage] : [errorMessage]);
        } finally {
            setAdviceLoading(false);
        }
    };


    
    
    const criticalItems = useMemo(() => {
        const drinks = drinkStock.filter(item => item.stock <= item.lowStockThreshold).map(i => ({ ...i, type: 'drink' as const }));
        const kitchen = kitchenStock.filter(item => item.stock <= item.lowStockThreshold).map(i => ({ ...i, type: 'kitchen' as const }));
        return [...drinks, ...kitchen].sort((a, b) => (a.stock / a.lowStockThreshold) - (b.stock / b.lowStockThreshold));
    }, [drinkStock, kitchenStock]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-64">
                <LoadingSpinner />
                <p className="text-gray-400 mt-4">Cargando inventario...</p>
            </div>
        );
    }
    
    return(
        <div className="w-full max-w-6xl mx-auto space-y-6">
            {historyModalItem && <PriceHistoryModal item={historyModalItem} onClose={() => setHistoryModalItem(null)} />}
            <AIAdviceModal isOpen={isAdviceModalOpen} onClose={() => setAdviceModalOpen(false)} advice={advice} isLoading={isAdviceLoading} title={adviceTitle} />
            <ManualTransactionModal isOpen={isTransactionModalOpen} onClose={() => setTransactionModalOpen(false)} drinkStock={drinkStock} kitchenStock={kitchenStock} onAddTransaction={onAddTransaction} />
            
            <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Gestión de Inventario</h2>
                    <button 
                        onClick={() => setTransactionModalOpen(true)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold shadow transition-colors flex items-center gap-2"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4"/></svg>
                        Registro Manual
                    </button>
                </div>
                
                {criticalItems.length > 0 && !activeSection && (
                    <div className="mb-6 bg-red-900/20 border border-red-500/50 rounded-xl p-4">
                        <h3 className="text-red-400 font-bold flex items-center gap-2 mb-3">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.257 3.099c.433-.798 1.57-.798 2.003 0l6.305 11.226c.433.798-.145 1.774-1.002 1.774H4.44c-.857 0-1.435-.976-1.002-1.774l6.305-11.226zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Alertas de Stock Bajo ({criticalItems.length})
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                            {criticalItems.slice(0, 6).map(item => (
                                <div key={`${item.type}-${item.id}`} className="bg-gray-800/50 p-2 rounded-lg flex justify-between items-center border border-gray-700">
                                    <span className="text-sm text-white truncate pr-2">{item.name}</span>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-red-400">{item.stock}</span>
                                        <span className="text-[10px] text-gray-500">/ {item.lowStockThreshold}</span>
                                    </div>
                                </div>
                            ))}
                            {criticalItems.length > 6 && (
                                <div className="text-xs text-gray-500 flex items-center justify-center italic">
                                    + {criticalItems.length - 6} artículos más...
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {!activeSection ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <button 
                            onClick={() => setActiveSection('sala')}
                            className="group bg-gray-700 hover:bg-blue-600/20 border border-gray-600 hover:border-blue-500 p-8 rounded-2xl transition-all flex flex-col items-center gap-4"
                        >
                            <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <span className="text-2xl font-bold text-white block">SALA</span>
                                <span className="text-gray-400 text-sm">{stockSummary.totalDrinks} artículos • {stockSummary.lowStockDrinks} bajo stock</span>
                                <span className="text-gray-500 text-[10px] block mt-1">{stockSummary.totalElaborations} elaboraciones</span>
                            </div>
                        </button>

                        <button 
                            onClick={() => setActiveSection('cocina')}
                            className="group bg-gray-700 hover:bg-green-600/20 border border-gray-600 hover:border-green-500 p-8 rounded-2xl transition-all flex flex-col items-center gap-4"
                        >
                            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <div className="text-center">
                                <span className="text-2xl font-bold text-white block">COCINA</span>
                                <span className="text-gray-400 text-sm">{stockSummary.totalKitchen} artículos • {stockSummary.lowStockKitchen} bajo stock</span>
                            </div>
                        </button>
                    </div>
                ) : (
                    <div className="space-y-6">
                        <div className="flex items-center gap-4 border-b border-gray-700 pb-4">
                            <button 
                                onClick={() => { setActiveSection(null); setActiveFamily(null); }}
                                className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                                </svg>
                            </button>
                            <div className="flex-1 flex items-center gap-2">
                                <h3 className="text-2xl font-bold text-white uppercase flex items-center gap-2">
                                    {activeSection === 'sala' ? (
                                        <><span className="text-blue-400">Sala</span> {activeFamily && <span className="text-gray-500 text-lg">/</span>}</>
                                    ) : (
                                        <><span className="text-green-400">Cocina</span> {activeFamily && <span className="text-gray-500 text-lg">/</span>}</>
                                    )}
                                </h3>
                                {activeFamily && (
                                    isRenamingFamily ? (
                                        <div className="flex items-center gap-2">
                                            <input 
                                                type="text" 
                                                value={newFamilyName} 
                                                onChange={e => setNewFamilyName(e.target.value)}
                                                className="bg-gray-700 text-white rounded-md px-2 py-1 border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                                                autoFocus
                                            />
                                            <button onClick={handleRenameFamilySubmit} className="text-green-400 hover:text-green-300">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                            </button>
                                            <button onClick={() => { setIsRenamingFamily(false); setNewFamilyName(''); }} className="text-gray-400 hover:text-white">
                                                <XIcon />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group">
                                            <span className="text-gray-300 text-xl uppercase font-bold">{activeFamily}</span>
                                            {activeFamily !== 'SIN CATEGORÍA' && (
                                                <button 
                                                    onClick={() => { setIsRenamingFamily(true); setNewFamilyName(activeFamily); }}
                                                    className="text-gray-500 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                                                    title="Renombrar familia"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>

                        {!activeFamily ? (
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                                {groupedDrinkStock['SIN CATEGORÍA'] && activeSection === 'sala' && (
                                    <button 
                                        onClick={() => setActiveFamily('SIN CATEGORÍA')}
                                        className="bg-red-900/20 hover:bg-red-900/30 border border-red-500/50 p-4 rounded-xl transition-all text-center relative group animate-pulse"
                                    >
                                        <span className="block font-bold text-red-400">SIN CATEGORÍA</span>
                                        <span className="text-xs text-gray-400">{groupedDrinkStock['SIN CATEGORÍA'].length} artículos</span>
                                    </button>
                                )}
                                {groupedKitchenStock['SIN CATEGORÍA'] && activeSection === 'cocina' && (
                                    <button 
                                        onClick={() => setActiveFamily('SIN CATEGORÍA')}
                                        className="bg-red-900/20 hover:bg-red-900/30 border border-red-500/50 p-4 rounded-xl transition-all text-center relative group animate-pulse"
                                    >
                                        <span className="block font-bold text-red-400">SIN CATEGORÍA</span>
                                        <span className="text-xs text-gray-400">{groupedKitchenStock['SIN CATEGORÍA'].length} artículos</span>
                                    </button>
                                )}
                                {(activeSection === 'sala' ? availableSalaFamilies : availableCocinaFamilies).map(family => {
                                    const items = activeSection === 'sala' ? groupedDrinkStock[family] || [] : groupedKitchenStock[family] || [];
                                    const lowStockCount = items.filter(i => i.stock <= i.lowStockThreshold).length;
                                    
                                    if (items.length === 0) return null;

                                    return (
                                        <button 
                                            key={family}
                                            onClick={() => setActiveFamily(family)}
                                            className="bg-gray-700 hover:bg-gray-600 border border-gray-600 p-4 rounded-xl transition-all text-center relative group"
                                        >
                                            <span className="block font-bold text-white group-hover:text-blue-400 transition-colors">{family}</span>
                                            <span className="text-xs text-gray-400">{items.length} artículos</span>
                                            {lowStockCount > 0 && (
                                                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg">
                                                    {lowStockCount}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <button 
                                        onClick={() => setActiveFamily(null)}
                                        className="text-sm text-blue-400 hover:underline flex items-center gap-1"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Volver a familias
                                    </button>
                                    <input
                                        type="text"
                                        placeholder={`Buscar en ${activeFamily}...`}
                                        value={activeSection === 'sala' ? drinkSearch : kitchenSearch}
                                        onChange={(e) => activeSection === 'sala' ? setDrinkSearch(e.target.value) : setKitchenSearch(e.target.value)}
                                        className="bg-gray-700 text-white text-sm p-2 rounded-lg border border-gray-600 focus:ring-blue-500 focus:border-blue-500 w-64"
                                    />
                                </div>
                                
                                <div className="bg-gray-900/30 rounded-xl p-4 border border-gray-700">
                                    <StockList 
                                        items={activeSection === 'sala' ? (groupedDrinkStock[activeFamily] || []) : (groupedKitchenStock[activeFamily] || [])} 
                                        type={activeSection === 'sala' ? "drink" : "kitchen"} 
                                        editingItemId={editingItemId}
                                        editingThreshold={editingThreshold}
                                        editingPriceItemId={editingPriceItemId}
                                        editingPriceValue={editingPriceValue}
                                        setHistoryModalItem={setHistoryModalItem}
                                        handleGetAdvice={handleGetAdvice}
                                        handleStartPriceEdit={handleStartPriceEdit}
                                        handleSavePriceEdit={handleSavePriceEdit}
                                        handleCancelPriceEdit={handleCancelPriceEdit}
                                        setEditingPriceValue={setEditingPriceValue}
                                        handleStartEdit={handleStartEdit}
                                        handleSaveEdit={handleSaveEdit}
                                        handleCancelEdit={handleCancelEdit}
                                        setEditingThreshold={setEditingThreshold}
                                        onDeleteItem={onDeleteItem}
                                        editingFamilyItemId={editingFamilyItemId}
                                        editingFamilyValue={editingFamilyValue}
                                        handleStartFamilyEdit={handleStartFamilyEdit}
                                        handleSaveFamilyEdit={handleSaveFamilyEdit}
                                        handleCancelFamilyEdit={handleCancelFamilyEdit}
                                        setEditingFamilyValue={setEditingFamilyValue}
                                        availableFamilies={activeSection === 'sala' ? availableSalaFamilies : availableCocinaFamilies}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default StockView;
