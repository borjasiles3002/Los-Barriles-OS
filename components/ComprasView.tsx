
import React, { useState, useMemo } from 'react';
import { PurchaseRecord } from '../types';
import { XIcon, SparkIcon } from './icons';
import { View } from '../App';

interface ComprasViewProps {
    purchaseHistory: PurchaseRecord[];
    onDeletePurchase: (id: string) => void;
    navigateTo: (view: View) => void;
}

const PurchaseDetailModal: React.FC<{ purchase: PurchaseRecord; onClose: () => void }> = ({ purchase, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl animate-fade-in flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h4 className="text-xl font-bold text-white">Detalle de Factura</h4>
                        <p className="text-sm text-gray-400">{purchase.supplierName} - {new Date(purchase.date).toLocaleDateString('es-ES')}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    <div className="grid grid-cols-5 gap-x-4 text-sm font-semibold text-gray-400 mb-2 px-2 border-b border-gray-700 pb-2">
                        <div className="col-span-2">Producto</div>
                        <div className="text-center">Cant.</div>
                        <div className="text-right">Precio U.</div>
                        <div className="text-right">Total</div>
                    </div>
                    <ul className="divide-y divide-gray-700">
                        {purchase.items.map((item, index) => (
                            <li key={index} className="py-2 px-2 grid grid-cols-5 gap-x-4 items-center">
                                <div className="col-span-2">
                                    <p className="font-medium text-white">{item.productName}</p>
                                    <p className="text-xs text-blue-400">{item.family}</p>
                                </div>
                                <p className="text-center text-gray-300">{item.quantity}</p>
                                <p className="text-right text-gray-300">{item.unitPrice?.toFixed(2) ?? 'N/A'}€</p>
                                <p className="text-right font-semibold text-white">{(item.quantity * (item.unitPrice ?? 0)).toFixed(2)}€</p>
                            </li>
                        ))}
                    </ul>
                </div>
                <div className="mt-4 pt-4 border-t border-gray-700 flex justify-end items-center">
                    <span className="text-gray-400 mr-2">Total Factura:</span>
                    <span className="text-2xl font-bold text-white">{purchase.totalAmount.toFixed(2)}€</span>
                </div>
            </div>
        </div>
    );
};


const FamilyBreakdown: React.FC<{ purchases: PurchaseRecord[] }> = ({ purchases }) => {
    const familyData = useMemo(() => {
        const familyMap = new Map<string, number>();
        purchases.forEach(p => {
            p.items.forEach(item => {
                const total = item.quantity * (item.unitPrice || 0);
                familyMap.set(item.family, (familyMap.get(item.family) || 0) + total);
            });
        });
        const totalSpend = Array.from(familyMap.values()).reduce((sum, val) => sum + val, 0);
        
        return Array.from(familyMap.entries())
            .map(([family, amount]) => ({
                family,
                amount,
                percentage: totalSpend > 0 ? (amount / totalSpend) * 100 : 0,
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [purchases]);

    if (familyData.length === 0) {
        return <p className="text-gray-500 text-center py-4">No hay datos de productos para analizar.</p>;
    }

    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500'];

    return (
        <div className="space-y-3">
            {familyData.map((data, index) => (
                <div key={data.family}>
                    <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-300">{data.family}</span>
                        <span className="text-gray-400">{data.amount.toFixed(2)}€ ({data.percentage.toFixed(1)}%)</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                        <div 
                            className={`${colors[index % colors.length]} h-2.5 rounded-full`} 
                            style={{ width: `${data.percentage}%` }}
                        ></div>
                    </div>
                </div>
            ))}
        </div>
    );
};


const ComprasView: React.FC<ComprasViewProps> = ({ purchaseHistory, onDeletePurchase, navigateTo }) => {
    const [selectedSupplier, setSelectedSupplier] = useState<string | null>(null);
    const [selectedPurchase, setSelectedPurchase] = useState<PurchaseRecord | null>(null);
    const [purchaseToDelete, setPurchaseToDelete] = useState<PurchaseRecord | null>(null);
    
    const uniqueSuppliers = useMemo(() => {
        const suppliers = new Map<string, number>();
        purchaseHistory.forEach(p => {
             const name = p.supplierName.trim();
             suppliers.set(name, (suppliers.get(name) || 0) + p.totalAmount);
        });
        return Array.from(suppliers.entries()).sort((a,b) => b[1] - a[1]).map(s => s[0]);
    }, [purchaseHistory]);

    const filteredPurchases = useMemo(() => {
        if (!selectedSupplier) return purchaseHistory;
        return purchaseHistory.filter(p => p.supplierName.trim() === selectedSupplier);
    }, [purchaseHistory, selectedSupplier]);

    const summaryData = useMemo(() => {
        const totalSpend = filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
        const invoiceCount = filteredPurchases.length;
        const averageTicket = invoiceCount > 0 ? totalSpend / invoiceCount : 0;
        return { totalSpend, invoiceCount, averageTicket };
    }, [filteredPurchases]);

    if (purchaseHistory.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center text-gray-500">
                <h2 className="text-2xl font-bold text-gray-300">Módulo de Compras y Proveedores</h2>
                <p className="mt-2 max-w-md">No hay facturas registradas. Para empezar, vaya al Asistente AI (chatbot) y suba una imagen de una factura o albarán.</p>
            </div>
        );
    }
    
    return (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
            {selectedPurchase && <PurchaseDetailModal purchase={selectedPurchase} onClose={() => setSelectedPurchase(null)} />}
            
            {/* Delete Confirmation Modal */}
            {purchaseToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-gray-800 border border-red-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
                        <div className="flex items-center gap-3 text-red-500 mb-4">
                            <XIcon />
                            <h3 className="text-xl font-bold text-white">¿Eliminar Factura?</h3>
                        </div>
                        <p className="text-gray-300 mb-6">
                            ¿Seguro que quiere eliminar la factura de <span className="font-bold text-white">{purchaseToDelete.supplierName}</span> por <span className="font-bold text-white">{purchaseToDelete.totalAmount.toFixed(2)}€</span>?
                            <br /><br />
                            <span className="text-sm text-gray-400">Esta acción restará los productos del inventario y eliminará el registro de gastos asociado si existe. Es irreversible.</span>
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setPurchaseToDelete(null)}
                                className="px-5 py-2 text-gray-300 hover:bg-gray-700 rounded-lg transition-colors font-medium border border-gray-600"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    onDeletePurchase(purchaseToDelete.id);
                                    setPurchaseToDelete(null);
                                }}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors shadow-lg shadow-red-900/20"
                            >
                                Sí, eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Supplier List */}
            <div className="lg:col-span-1 bg-gray-800 p-4 rounded-lg flex flex-col">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold text-white">Proveedores</h2>
                </div>
                
                <button 
                    onClick={() => navigateTo('supplier_comparator')}
                    className="w-full mb-4 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all transform hover:scale-[1.02] shadow-lg"
                >
                    <SparkIcon className="h-5 w-5" />
                    Comparador de Precios
                </button>

                <div className="overflow-y-auto pr-2 flex-1">
                    <ul className="space-y-2">
                        <li>
                            <button 
                                onClick={() => setSelectedSupplier(null)}
                                className={`w-full text-left p-3 rounded-md transition-colors ${!selectedSupplier ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                            >Todos los Proveedores</button>
                        </li>
                        {uniqueSuppliers.map(supplier => (
                            <li key={supplier}>
                                <button 
                                    onClick={() => setSelectedSupplier(supplier)}
                                    className={`w-full text-left p-3 rounded-md transition-colors ${selectedSupplier === supplier ? 'bg-blue-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                                >{supplier}</button>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            {/* Details View */}
            <div className="lg:col-span-3 bg-gray-800 p-6 rounded-lg flex flex-col">
                <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-white mb-2 sm:mb-0">{selectedSupplier || 'Resumen General de Compras'}</h2>
                    <button 
                        onClick={() => {
                            if (!filteredPurchases.length) return;
                            const headers = 'Fecha,Proveedor,Total Factura,Items\n';
                            const csvData = filteredPurchases.map(p => {
                                const itemsStr = p.items.map(i => `${i.quantity}x ${i.productName}`).join('; ');
                                return `${p.date},"${p.supplierName}",${p.totalAmount.toFixed(2)},"${itemsStr}"`;
                            }).join('\n');
                            const blob = new Blob([headers + csvData], { type: 'text/csv;charset=utf-8;' });
                            const link = document.createElement('a');
                            const url = URL.createObjectURL(blob);
                            link.setAttribute('href', url);
                            link.setAttribute('download', `compras_${selectedSupplier || 'general'}.csv`);
                            link.style.visibility = 'hidden';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }} 
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors"
                    >
                        Descargar CSV
                    </button>
                </div>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-gray-900/50 p-4 rounded-lg text-center"><p className="text-sm text-gray-400">Gasto Total</p><p className="text-2xl font-bold text-white">{summaryData.totalSpend.toFixed(2)}€</p></div>
                    <div className="bg-gray-900/50 p-4 rounded-lg text-center"><p className="text-sm text-gray-400">Nº de Facturas</p><p className="text-2xl font-bold text-white">{summaryData.invoiceCount}</p></div>
                    <div className="bg-gray-900/50 p-4 rounded-lg text-center"><p className="text-sm text-gray-400">Ticket Medio</p><p className="text-2xl font-bold text-white">{summaryData.averageTicket.toFixed(2)}€</p></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
                    {/* Family Breakdown */}
                    <div className="bg-gray-800 p-4 rounded-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-3">Gasto por Familia</h3>
                        <div className="overflow-y-auto pr-2">
                           <FamilyBreakdown purchases={filteredPurchases} />
                        </div>
                    </div>

                    {/* Recent Purchases */}
                    <div className="bg-gray-800 p-4 rounded-lg flex flex-col">
                        <h3 className="text-lg font-semibold text-white mb-3">Facturas Recientes</h3>
                        <div className="overflow-y-auto pr-2 flex-1">
                            <ul className="space-y-3">
                                {filteredPurchases.map(p => (
                                    <li key={p.id} className="bg-gray-700/50 rounded-md hover:bg-gray-700 transition-colors relative group">
                                        <div onClick={() => setSelectedPurchase(p)} className="p-3 cursor-pointer">
                                            <div className="flex justify-between">
                                                <div>
                                                    {!selectedSupplier && <p className="text-xs text-gray-400">{p.supplierName}</p>}
                                                    <p className="font-semibold text-white">{new Date(p.date).toLocaleDateString('es-ES')}</p>
                                                </div>
                                                <p className="font-bold text-green-400">{p.totalAmount.toFixed(2)}€</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setPurchaseToDelete(p); }}
                                            className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            aria-label="Eliminar factura"
                                        >
                                            <XIcon />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ComprasView;
