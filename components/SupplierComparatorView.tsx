
import React, { useMemo, useState } from 'react';
import { PurchaseRecord, ChatMessage } from '../types';
import { SparkIcon, LoadingSpinner, XIcon, BackIcon } from './icons';
import { callGemini } from '../services/geminiService';
import { GEMINI_ADVISOR_PROMPT } from '../constants';
import ChatDisplay from './ChatDisplay';

interface SupplierComparatorViewProps {
    purchaseHistory: PurchaseRecord[];
    onBack?: () => void;
}

interface ProductComparison {
    productName: string;
    suppliers: {
        [supplierName: string]: {
            price: number;
            date: string;
        };
    };
    bestPrice: number;
    bestSupplier: string;
}

const SupplierComparatorView: React.FC<SupplierComparatorViewProps> = ({ purchaseHistory, onBack }) => {
    const [isAdviceModalOpen, setAdviceModalOpen] = useState(false);
    const [advice, setAdvice] = useState<ChatMessage[] | null>(null);
    const [isAdviceLoading, setAdviceLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const comparisonData = useMemo(() => {
        const products: { [name: string]: ProductComparison } = {};

        // Sort by date descending to get the latest prices first
        const sortedHistory = [...purchaseHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        sortedHistory.forEach(record => {
            const supplier = record.supplierName.trim();
            record.items.forEach(item => {
                const name = item.productName.trim();
                if (!products[name]) {
                    products[name] = {
                        productName: name,
                        suppliers: {},
                        bestPrice: Infinity,
                        bestSupplier: ''
                    };
                }

                // Only take the latest price for each supplier/product combo
                if (!products[name].suppliers[supplier]) {
                    products[name].suppliers[supplier] = {
                        price: item.unitPrice || 0,
                        date: record.date
                    };

                    if (item.unitPrice && item.unitPrice < products[name].bestPrice) {
                        products[name].bestPrice = item.unitPrice;
                        products[name].bestSupplier = supplier;
                    }
                }
            });
        });

        return Object.values(products).sort((a, b) => a.productName.localeCompare(b.productName));
    }, [purchaseHistory]);

    const filteredData = useMemo(() => {
        return comparisonData.filter(p => 
            p.productName.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [comparisonData, searchTerm]);

    const allSuppliers = useMemo(() => {
        const suppliers = new Set<string>();
        purchaseHistory.forEach(p => suppliers.add(p.supplierName.trim()));
        return Array.from(suppliers).sort();
    }, [purchaseHistory]);

    const handleGetAIRecommendation = async () => {
        setAdviceModalOpen(true);
        setAdviceLoading(true);
        setAdvice(null);

        const topProducts = comparisonData.slice(0, 10).map(p => {
            const supplierPrices = (Object.entries(p.suppliers) as [string, { price: number; date: string }][])
                .map(([s, d]) => `${s}: ${d.price.toFixed(2)}€ (${new Date(d.date).toLocaleDateString()})`)
                .join(', ');
            return `- ${p.productName}: ${supplierPrices}`;
        }).join('\n');

        const prompt = `Contexto: Comparativa de precios de proveedores para los productos principales:\n${topProducts}\n\nTarea: Analiza estos precios. ¿Qué proveedor ofrece mejores condiciones generales? ¿Hay algún producto con variaciones de precio preocupantes entre proveedores? Dame una recomendación estratégica de compra para este mes.`;
        
        const userMessage: ChatMessage = { role: 'user', parts: [{ text: prompt }] };
        setAdvice([userMessage]);

        try {
            const response = await callGemini([userMessage], GEMINI_ADVISOR_PROMPT, {}, 'gemini-3-flash-preview');
            const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response.text }] };
            setAdvice(prev => prev ? [...prev, modelMessage] : [modelMessage]);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `Error: ${errorMsg}` }] };
            setAdvice(prev => prev ? [...prev, errorMessage] : [errorMessage]);
        } finally {
            setAdviceLoading(false);
        }
    };

    const handleExportCSV = () => {
        const headers = ['Producto', ...allSuppliers, 'Mejor Precio', 'Mejor Proveedor'];
        const rows = comparisonData.map(p => {
            const row = [`"${p.productName.replace(/"/g, '""')}"`];
            allSuppliers.forEach(s => {
                row.push(p.suppliers[s] ? `"${p.suppliers[s].price.toFixed(2)}€"` : '-');
            });
            row.push(`"${p.bestPrice.toFixed(2)}€"`);
            row.push(`"${p.bestSupplier.replace(/"/g, '""')}"`);
            return row.join(',');
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `comparativa_proveedores_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="w-full max-w-6xl mx-auto space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    {onBack && (
                        <button 
                            onClick={onBack}
                            className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors border border-gray-700"
                        >
                            <BackIcon />
                        </button>
                    )}
                    <div>
                        <h2 className="text-3xl font-bold text-white">Comparador de Proveedores</h2>
                        <p className="text-gray-400">Analiza los últimos precios registrados por cada proveedor.</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button 
                        onClick={handleExportCSV}
                        className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105"
                    >
                        Exportar CSV
                    </button>
                    <button 
                        onClick={handleGetAIRecommendation}
                        className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all transform hover:scale-105"
                    >
                        <SparkIcon className="h-6 w-6" />
                        Recomendación con IA
                    </button>
                </div>
            </div>

            <div className="bg-gray-800 p-4 rounded-xl shadow-lg border border-gray-700">
                <div className="mb-6">
                    <input 
                        type="text" 
                        placeholder="Buscar producto..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-700">
                                <th className="py-4 px-4 text-gray-400 font-semibold uppercase text-xs tracking-wider">Producto</th>
                                {allSuppliers.map(supplier => (
                                    <th key={supplier} className="py-4 px-4 text-gray-400 font-semibold uppercase text-xs tracking-wider text-center">{supplier}</th>
                                ))}
                                <th className="py-4 px-4 text-gray-400 font-semibold uppercase text-xs tracking-wider text-right">Mejor Opción</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredData.map((product, index) => (
                                <tr key={`${product.productName}-${index}`} className="hover:bg-gray-700/30 transition-colors group">
                                    <td className="py-4 px-4">
                                        <p className="font-bold text-white group-hover:text-blue-400 transition-colors">{product.productName}</p>
                                    </td>
                                    {allSuppliers.map(supplier => {
                                        const data = product.suppliers[supplier];
                                        const isBest = data && data.price === product.bestPrice;
                                        return (
                                            <td key={supplier} className="py-4 px-4 text-center">
                                                {data ? (
                                                    <div className="flex flex-col items-center">
                                                        <span className={`font-mono text-lg ${isBest ? 'text-green-400 font-bold' : 'text-gray-300'}`}>
                                                            {data.price.toFixed(2)}€
                                                        </span>
                                                        <span className="text-[10px] text-gray-500">{new Date(data.date).toLocaleDateString()}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-600">-</span>
                                                )}
                                            </td>
                                        );
                                    })}
                                    <td className="py-4 px-4 text-right">
                                        <div className="inline-flex flex-col items-end bg-green-900/20 border border-green-500/30 px-3 py-1 rounded-lg">
                                            <span className="text-xs text-green-500 font-bold uppercase tracking-tighter">Ahorro</span>
                                            <span className="text-white font-bold">{product.bestSupplier}</span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredData.length === 0 && (
                        <div className="py-20 text-center">
                            <p className="text-gray-500 text-lg italic">No se encontraron productos que coincidan con la búsqueda.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Advice Modal */}
            {isAdviceModalOpen && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setAdviceModalOpen(false)}>
                    <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-3xl shadow-2xl animate-scale-in flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6">
                            <h4 className="text-2xl font-bold text-white flex items-center gap-3">
                                <SparkIcon className="h-8 w-8 text-cyan-400 animate-pulse" /> 
                                Análisis Estratégico de Proveedores
                            </h4>
                            <button onClick={() => setAdviceModalOpen(false)} className="bg-gray-700 hover:bg-gray-600 p-2 rounded-full text-gray-400 hover:text-white transition-all">
                                <XIcon className="h-6 w-6" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                            {isAdviceLoading && (
                                <div className="flex flex-col justify-center items-center h-64 space-y-4">
                                    <LoadingSpinner className="h-12 w-12 text-blue-500" />
                                    <p className="text-gray-400 animate-pulse">Consultando con la IA de Hostelería...</p>
                                </div>
                            )}
                            {advice && <ChatDisplay chatHistory={advice} />}
                        </div>
                        <div className="mt-6 pt-4 border-t border-gray-700 text-center">
                            <p className="text-xs text-gray-500 italic">Este análisis se basa en los últimos precios registrados en sus facturas.</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SupplierComparatorView;
