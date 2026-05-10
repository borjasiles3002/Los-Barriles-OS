import React from 'react';
import { StockItem } from '../types';
import { EditIcon, SummaryIcon, XIcon, SendIcon, SparkIcon } from './icons';

interface StockListProps {
    items: StockItem[];
    type: 'drink' | 'kitchen';
    editingItemId: string | null;
    editingThreshold: string;
    editingPriceItemId: string | null;
    editingPriceValue: string;
    setHistoryModalItem: (item: StockItem) => void;
    handleGetAdvice: (itemName: string) => void;
    handleStartPriceEdit: (item: StockItem) => void;
    handleSavePriceEdit: (id: string, type: 'drink' | 'kitchen') => void;
    handleCancelPriceEdit: () => void;
    setEditingPriceValue: (value: string) => void;
    handleStartEdit: (item: StockItem) => void;
    handleSaveEdit: (id: string, type: 'drink' | 'kitchen') => void;
    handleCancelEdit: () => void;
    setEditingThreshold: (value: string) => void;
    onDeleteItem: (id: string, type: 'drink' | 'kitchen') => void;
    editingFamilyItemId: string | null;
    editingFamilyValue: string;
    handleStartFamilyEdit: (item: StockItem) => void;
    handleSaveFamilyEdit: (id: string, type: 'drink' | 'kitchen') => void;
    handleCancelFamilyEdit: () => void;
    setEditingFamilyValue: (value: string) => void;
    availableFamilies: string[];
    onUpdateVisibility: (id: string, type: 'drink' | 'kitchen', showInTPV: boolean) => void;
}

const StockList: React.FC<StockListProps> = (props) => {
    const {
        items, type, editingItemId, editingThreshold, editingPriceItemId, editingPriceValue,
        setHistoryModalItem, handleGetAdvice, handleStartPriceEdit, handleSavePriceEdit,
        handleCancelPriceEdit, setEditingPriceValue, handleStartEdit, handleSaveEdit,
        handleCancelEdit, setEditingThreshold, onDeleteItem,
        editingFamilyItemId, editingFamilyValue, handleStartFamilyEdit, handleSaveFamilyEdit, handleCancelFamilyEdit, setEditingFamilyValue,
        availableFamilies, onUpdateVisibility
    } = props;

    return (
        <div className="space-y-3">
            {items.map(item => (
                <div key={item.id} className={`bg-gray-900/50 p-3 rounded-lg border-l-4 ${item.stock <= item.lowStockThreshold ? 'border-yellow-500' : 'border-gray-700'}`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <h4 className="font-bold text-white">{item.name}</h4>
                            <p className="text-sm text-gray-400">Stock: <span className="font-semibold text-lg text-white">{item.stock}</span></p>
                    {editingFamilyItemId === item.id ? (
                        <div className="mt-2 flex items-center gap-2 animate-fade-in">
                            <div className="relative flex-1">
                                <input
                                    type="text"
                                    list={`families-${item.id}`}
                                    value={editingFamilyValue}
                                    onChange={(e) => setEditingFamilyValue(e.target.value)}
                                    className="bg-gray-700 text-white rounded-md px-2 py-1 w-full border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder="Nueva familia"
                                    autoFocus
                                />
                                <datalist id={`families-${item.id}`}>
                                    {availableFamilies.map(f => (
                                        <option key={f} value={f} />
                                    ))}
                                </datalist>
                            </div>
                            <button onClick={() => handleSaveFamilyEdit(item.id, type)} className="text-green-400 hover:text-green-300"><SendIcon /></button>
                            <button onClick={handleCancelFamilyEdit} className="text-gray-400 hover:text-white"><XIcon /></button>
                        </div>
                    ) : (
                        <p className={`text-xs cursor-pointer ${!item.family ? 'text-red-400 animate-pulse' : 'text-gray-500'}`} onClick={() => handleStartFamilyEdit(item)}>
                            Familia: <span className={`font-semibold ${!item.family ? 'text-red-400 underline decoration-dotted' : 'text-gray-400'}`}>{item.family || 'ASIGNAR FAMILIA'}</span> <EditIcon className="h-3 w-3 inline -mt-1" />
                        </p>
                    )}
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => handleGetAdvice(item.name)} className="text-cyan-400 hover:text-cyan-300" title="Pedir consejo a IA"><SparkIcon className="h-5 w-5"/></button>
                            <button onClick={() => setHistoryModalItem(item)} className="text-gray-400 hover:text-white" title="Ver Historial de Precios"><SummaryIcon /></button>
                            <button onClick={() => onDeleteItem(item.id, type)} className="text-red-500 hover:text-red-400" title="Eliminar Artículo"><XIcon /></button>
                        </div>
                    </div>
                    
                    {editingPriceItemId === item.id ? (
                        <div className="mt-2 flex items-center gap-2 animate-fade-in">
                            <input
                                type="number"
                                value={editingPriceValue}
                                onChange={(e) => setEditingPriceValue(e.target.value)}
                                className="bg-gray-700 text-white rounded-md px-2 py-1 w-24 border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Nuevo precio"
                            />
                            <button onClick={() => handleSavePriceEdit(item.id, type)} className="text-green-400 hover:text-green-300"><SendIcon /></button>
                            <button onClick={handleCancelPriceEdit} className="text-gray-400 hover:text-white"><XIcon /></button>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 cursor-pointer" onClick={() => handleStartPriceEdit(item)}>
                            Último Precio: <span className="font-semibold text-gray-300">{item.lastPrice?.toFixed(2) || 'N/A'}€</span> <EditIcon className="h-3 w-3 inline -mt-1" />
                        </p>
                    )}

                    {editingItemId === item.id ? (
                        <div className="mt-2 flex items-center gap-2 animate-fade-in">
                            <input
                                type="number"
                                value={editingThreshold}
                                onChange={(e) => setEditingThreshold(e.target.value)}
                                className="bg-gray-700 text-white rounded-md px-2 py-1 w-24 border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Nuevo umbral"
                            />
                            <button onClick={() => handleSaveEdit(item.id, type)} className="text-green-400 hover:text-green-300"><SendIcon /></button>
                            <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white"><XIcon /></button>
                        </div>
                    ) : (
                        <p className={`text-xs ${item.stock <= item.lowStockThreshold ? 'text-yellow-400' : 'text-gray-500'} cursor-pointer`} onClick={() => handleStartEdit(item)}>
                            Umbral Mínimo: {item.lowStockThreshold} <EditIcon className="h-3 w-3 inline -mt-1" />
                        </p>
                    )}
                    
                    <div className="mt-3 flex items-center justify-between border-t border-gray-800 pt-3">
                        <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Mostrar en TPV</span>
                        <div 
                            onClick={() => onUpdateVisibility(item.id, type, item.showInTPV === false ? true : false)}
                            className={`w-10 h-5.5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${item.showInTPV !== false ? 'bg-blue-600' : 'bg-gray-600'}`}
                        >
                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${item.showInTPV !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default StockList;