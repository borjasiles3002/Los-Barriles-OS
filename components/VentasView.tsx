
import React, { useState } from 'react';
import { SaleEntry } from '../types';
import { LoadingSpinner } from './icons';

interface VentasViewProps {
    onAddSale: (sale: Omit<SaleEntry, 'id' | 'date'>) => void;
    isLoading: boolean;
    salesHistory: SaleEntry[];
}

const VentasView: React.FC<VentasViewProps> = ({ onAddSale, isLoading, salesHistory }) => {
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');
    const [localError, setLocalError] = useState<string | null>(null);
    const [showAll, setShowAll] = useState(false);

    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0 || !concept.trim()) {
            setLocalError('Por favor, introduzca un importe válido y un concepto.');
            return;
        }
        onAddSale({ amount: numAmount, concept });
        setAmount('');
        setConcept('');
        setLocalError(null);
    };
    
    const displayedSales = showAll ? salesHistory : salesHistory.filter(s => !s.isClosed);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
            {/* Input Column */}
            <div className="space-y-8">
                {/* Manual Entry */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-4">Registrar Venta Manualmente</h2>
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-400">Importe (€)</label>
                            <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)}
                                   className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" placeholder="25.50" />
                        </div>
                        <div>
                            <label htmlFor="concept" className="block text-sm font-medium text-gray-400">Concepto</label>
                            <input type="text" id="concept" value={concept} onChange={e => setConcept(e.target.value)}
                                   className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" placeholder="Menú del día" />
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-500">
                            {isLoading ? <LoadingSpinner /> : 'Añadir Venta'}
                        </button>
                         {localError && <p className="text-red-400 text-center text-sm mt-2">{localError}</p>}
                    </form>
                </div>
            </div>

            {/* History Column */}
            <div className="bg-gray-800 p-4 rounded-lg flex flex-col h-[calc(100vh-170px)]">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-800 py-2 z-10">
                    <h2 className="text-xl font-bold text-white">Historial de Ventas</h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                if (!displayedSales.length) return;
                                const headers = 'Fecha,Concepto,Importe\n';
                                const csvData = displayedSales.map(s => `"${s.date}","${s.concept}",${s.amount.toFixed(2)}`).join('\n');
                                const blob = new Blob([headers + csvData], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', 'ventas.csv');
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="text-xs font-bold px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors"
                        >
                            Descargar CSV
                        </button>
                        <button 
                            onClick={() => setShowAll(!showAll)}
                            className="text-xs font-bold px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
                        >
                            {showAll ? 'Ver Turno Actual' : 'Ver Todas'}
                        </button>
                    </div>
                </div>
                 {displayedSales.length > 0 ? (
                    <div className="overflow-y-auto pr-2">
                        <ul className="space-y-3">
                            {displayedSales.map(entry => (
                                <li key={entry.id} className="bg-gray-700/50 p-3 rounded-md">
                                    <div className="flex justify-between items-start">
                                        <p className="font-semibold text-white flex-1 pr-2">{entry.concept}</p>
                                        <div className="flex flex-col items-end gap-2">
                                            <p className="font-bold text-green-400 whitespace-nowrap">{entry.amount.toFixed(2)}€</p>
                                            {entry.invoiceUrl && (
                                                <a 
                                                    href={entry.invoiceUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="p-1 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
                                                    title="Ver Ticket"
                                                >
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                    </svg>
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-xs mt-1 text-gray-400">
                                       {new Date(entry.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                 ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-gray-500">No hay ventas registradas.</p>
                    </div>
                 )}
            </div>
        </div>
    );
};

export default VentasView;
