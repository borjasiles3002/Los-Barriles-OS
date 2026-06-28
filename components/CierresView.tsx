
import React, { useState } from 'react';
import { ClosingData, FinancialData, ChatMessage } from '../types';
import { XIcon, SparkIcon, LoadingSpinner } from './icons';
import { callGemini } from '../services/geminiService';
import { GEMINI_ADVISOR_PROMPT } from '../constants';
import ChatDisplay from './ChatDisplay';

interface CierresViewProps {
    closingHistory: ClosingData[];
    onDeleteEntry: (id: string) => void;
    onPerformCashClosing: (args: { countedAmount: number }) => Promise<string>;
    financials: FinancialData;
}

const CierresView: React.FC<CierresViewProps> = ({ closingHistory, onDeleteEntry, onPerformCashClosing, financials }) => {
    const [countedCash, setCountedCash] = useState<string>('');
    const [isClosing, setIsClosing] = useState(false);
    
    // AI Analysis states
    const [advice, setAdvice] = useState<ChatMessage[] | null>(null);
    const [isAdviceLoading, setAdviceLoading] = useState(false);
    const [analysisPeriod, setAnalysisPeriod] = useState<string>('');

    const handleCloseShift = async () => {
        if (!countedCash || isNaN(Number(countedCash))) return;
        setIsClosing(true);
        try {
            await onPerformCashClosing({ countedAmount: Number(countedCash) });
            setCountedCash('');
            alert('Jornada cerrada correctamente');
        } catch (e) {
            console.error(e);
            alert('Error al cerrar la jornada');
        } finally {
            setIsClosing(false);
        }
    };

    const handleGetAnalysis = async (period: 'Day' | 'Week' | 'Month') => {
        setAnalysisPeriod(period);
        setAdviceLoading(true);
        setAdvice(null);
        
        if (closingHistory.length === 0) {
            setAdvice([{ role: 'model', parts: [{ text: "No hay suficientes datos históricos para realizar un análisis. Registre al menos un cierre de caja para comenzar." }] }]);
            setAdviceLoading(false);
            return;
        }

        let numDays = 1;
        let periodName = 'Hoy';
        if (period === 'Week') { numDays = 7; periodName = 'esta semana'; }
        if (period === 'Month') { numDays = 30; periodName = 'este mes'; }

        // sort descending
        const sortedData = [...closingHistory].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        const recentData = sortedData.slice(0, numDays);

        const formattedData = recentData.map(d => 
            `  - ${new Date(d.date).toLocaleDateString('es-ES')}: Ventas=${d.expectedSales.toFixed(2)}€, Contado=${d.countedCash.toFixed(2)}€, Descuadre=${d.discrepancy.toFixed(2)}€`
        ).join('\n');
        
        let prompt = `Contexto: Datos de cierres financieros de ${periodName} (últimos ${recentData.length} cierres):\n${formattedData}\n`;
        prompt += `Tarea: Eres un Asesor de Gestión de Restaurantes (IA). Analiza las ventas, detecta patrones, y dame un resumen ejecutivo junto con 3 consejos prácticos y concretos para mejorar la gestión, reducir descuadres o aumentar ventas en los próximos días.`;
        
        const userMessage: ChatMessage = { role: 'user', parts: [{ text: prompt }] };
        setAdvice([userMessage]);

        try {
            const response = await callGemini([userMessage], GEMINI_ADVISOR_PROMPT, {}, 'gemini-2.0-flash');
            const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response.text }] };
            setAdvice(prev => prev ? [...prev, modelMessage] : [modelMessage]);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `Error al obtener análisis: ${errorMsg}` }] };
            setAdvice(prev => prev ? [...prev, errorMessage] : [errorMessage]);
        } finally {
            setAdviceLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-6">
            <div className="flex-1 flex flex-col gap-6">
                <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 shadow-xl">
                    <h2 className="text-2xl font-black text-white mb-4">Cierre de Jornada (Cuadre)</h2>
                    <p className="text-gray-400 mb-4 text-sm">Ingresa el dinero contado en la caja para cerrar el turno actual. Esto guardará el ticket de cierre y vaciará las ventas vivas del día.</p>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg text-center">
                            <span className="block text-gray-500 text-xs font-bold uppercase">Ventas (Esperado)</span>
                            <span className="block text-xl font-bold text-blue-400">{financials.sales.toFixed(2)}€</span>
                        </div>
                        <div className="bg-gray-900 border border-gray-700 p-3 rounded-lg text-center">
                            <span className="block text-gray-500 text-xs font-bold uppercase">Descuadre Actual</span>
                            <span className={`block text-xl font-bold ${Number(countedCash) - financials.sales >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {countedCash ? (Number(countedCash) - financials.sales).toFixed(2) : '0.00'}€
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex flex-col gap-2">
                        <label className="text-gray-300 font-bold text-sm">Dinero en Caja (Efectivo + Tarjeta Contado)</label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <input 
                                    type="number" 
                                    className="w-full bg-gray-900 border border-gray-700 rounded-lg py-3 px-4 text-white text-lg font-bold pr-8"
                                    value={countedCash}
                                    placeholder="Ej: 450.50"
                                    onChange={(e) => setCountedCash(e.target.value)}
                                />
                                <span className="absolute right-3 top-3.5 text-gray-400 font-bold">€</span>
                            </div>
                            <button 
                                onClick={handleCloseShift}
                                disabled={!countedCash || isClosing}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
                            >
                                {isClosing ? <LoadingSpinner /> : 'Cerrar Caja'}
                            </button>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 p-6 rounded-lg flex flex-col border border-gray-700 shadow-xl flex-1">
                    <h2 className="text-xl font-bold text-white mb-4">Historial de Cierres</h2>
                    {closingHistory.length > 0 ? (
                        <div className="overflow-y-auto pr-2" style={{maxHeight: '400px'}}>
                            <ul className="space-y-3">
                                {closingHistory.map(c => (
                                    <li key={c.id} className="bg-gray-700/50 p-4 rounded-md relative group">
                                        <button 
                                            onClick={() => onDeleteEntry(c.id)}
                                            className="absolute top-2 right-2 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                                            aria-label="Eliminar registro"
                                        >
                                            <XIcon />
                                        </button>
                                        <p className="font-bold text-white">{new Date(c.date).toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                                        <div className="text-sm mt-2 grid grid-cols-2 gap-2">
                                            <p className="text-gray-400">Ingresos esperados:</p><p className="text-gray-200 text-right">{c.expectedSales.toFixed(2)}€</p>
                                            <p className="text-gray-400">Caja contada:</p><p className="text-gray-200 text-right">{c.countedCash.toFixed(2)}€</p>
                                            <p className="text-gray-400 font-semibold">Descuadre:</p>
                                            <p className={`font-semibold text-right ${c.discrepancy >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {c.discrepancy.toFixed(2)}€
                                            </p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ) : (
                        <div className="flex-1 flex items-center justify-center min-h-[200px]">
                            <p className="text-gray-500">No hay cierres de caja registrados.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* AI Advisor Panel */}
            <div className="flex-1 bg-gradient-to-b from-gray-800 to-gray-900 p-6 rounded-lg border border-gray-700 shadow-xl flex flex-col h-[calc(100vh-140px)]">
                <div className="flex items-center gap-3 mb-6">
                    <SparkIcon className="h-8 w-8 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
                    <h2 className="text-xl font-bold text-white">IA Asesor Financiero</h2>
                </div>
                
                <p className="text-gray-400 text-sm mb-4">Selecciona el periodo para generar un resumen automático de ventas, analizar descuadres y obtener sugerencias de gestión.</p>
                
                <div className="flex gap-2 mb-6">
                    <button 
                        onClick={() => handleGetAnalysis('Day')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-colors ${analysisPeriod === 'Day' ? 'bg-cyan-900 border-cyan-500 text-cyan-50' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    >
                        Diario
                    </button>
                    <button 
                        onClick={() => handleGetAnalysis('Week')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-colors ${analysisPeriod === 'Week' ? 'bg-cyan-900 border-cyan-500 text-cyan-50' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    >
                        Semanal
                    </button>
                    <button 
                        onClick={() => handleGetAnalysis('Month')}
                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold border transition-colors ${analysisPeriod === 'Month' ? 'bg-cyan-900 border-cyan-500 text-cyan-50' : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'}`}
                    >
                        Mensual
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto bg-black/40 rounded-xl p-4 border border-gray-700 border-dashed">
                    {isAdviceLoading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-500">
                            <LoadingSpinner />
                            <p className="mt-4 animate-pulse">Analizando históricos de caja...</p>
                        </div>
                    ) : advice ? (
                        <ChatDisplay chatHistory={advice} />
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-600 text-center px-6">
                            <SparkIcon className="h-12 w-12 mb-4 opacity-50" />
                            <p>Toca uno de los periodos de arriba para iniciar el análisis automático.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CierresView;
