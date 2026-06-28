
import React, { useState, useMemo } from 'react';
import { FinancialData, HistoricalData, ClosingData, ChatMessage } from '../types';
import { XIcon, SparkIcon, LoadingSpinner } from './icons';
import { callGemini } from '../services/geminiService';
import { GEMINI_ADVISOR_PROMPT } from '../constants';
import ChatDisplay from './ChatDisplay';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface BarChartProps {
    data: { label: string; value: number; color: string; originalDate?: string }[];
    title: string;
    onBarClick: (identifier: string) => void;
    selectedIdentifier: string | null;
    valueSuffix?: string;
    children?: React.ReactNode;
}

const BarChart: React.FC<BarChartProps> = ({ data, title, onBarClick, selectedIdentifier, valueSuffix = '€', children }) => {
    return (
        <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
            <h3 className="text-xl font-bold text-white mb-4 text-center">{title}</h3>
            {children}
            <div className="w-full h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <RechartsBarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="label" stroke="#9CA3AF" />
                        <YAxis stroke="#9CA3AF" tickFormatter={(val) => `${val}${valueSuffix}`} />
                        <RechartsTooltip 
                            cursor={{ fill: 'transparent' }}
                            contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                            itemStyle={{ color: '#F3F4F6' }}
                            formatter={(value: number) => [
                                valueSuffix === '€' 
                                    ? value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) 
                                    : `${value.toFixed(2)}${valueSuffix}`, 
                                'Valor'
                            ]}
                        />
                        <Bar 
                            dataKey="value" 
                            onClick={(data) => {
                                if (data && data.payload) {
                                    onBarClick(data.payload.originalDate || data.payload.label);
                                }
                            }}
                        >
                            {data.map((entry, index) => {
                                const identifier = entry.originalDate || entry.label;
                                const isSelected = selectedIdentifier === identifier;
                                const opacity = selectedIdentifier && !isSelected ? 0.4 : 1;
                                return (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={entry.color} 
                                        opacity={opacity} 
                                        stroke={isSelected ? '#60A5FA' : 'none'} 
                                        strokeWidth={isSelected ? 2 : 0} 
                                        className="cursor-pointer hover:opacity-80 transition-opacity"
                                    />
                                );
                            })}
                        </Bar>
                    </RechartsBarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

interface GroupedBarChartProps {
    data: { label: string; originalDate: string; values: { value: number; color: string }[], Ventas?: number, Gastos?: number }[];
    onBarClick: (date: string) => void;
    selectedDate: string | null;
    title?: string;
}

const GroupedBarChart: React.FC<GroupedBarChartProps> = ({ data, onBarClick, selectedDate, title }) => {
    if (!data.length) {
        return (
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                {title && <h3 className="text-xl font-bold text-white mb-2 text-center">{title}</h3>}
                <p className="text-center text-gray-500 py-10">No hay datos históricos para mostrar.</p>
            </div>
        )
    }

    return (
        <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
                <RechartsBarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }} onClick={(e) => {
                    if (e && e.activePayload && e.activePayload.length > 0) {
                        onBarClick(e.activePayload[0].payload.originalDate);
                    }
                }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="label" stroke="#9CA3AF" />
                    <YAxis stroke="#9CA3AF" tickFormatter={(val) => `${val}€`} />
                    <RechartsTooltip 
                        cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
                        contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '0.5rem' }}
                        formatter={(value: number) => [`${value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}`]}
                    />
                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="Ventas" fill="#34D399" radius={[4, 4, 0, 0]} className="cursor-pointer">
                        {data.map((entry, index) => (
                            <Cell key={`cell-ventas-${index}`} fillOpacity={selectedDate && selectedDate !== entry.originalDate ? 0.4 : 1} />
                        ))}
                    </Bar>
                    <Bar dataKey="Gastos" fill="#F87171" radius={[4, 4, 0, 0]} className="cursor-pointer">
                        {data.map((entry, index) => (
                            <Cell key={`cell-gastos-${index}`} fillOpacity={selectedDate && selectedDate !== entry.originalDate ? 0.4 : 1} />
                        ))}
                    </Bar>
                </RechartsBarChart>
            </ResponsiveContainer>
        </div>
    );
};

const QuickSaleModal: React.FC<{ isOpen: boolean; onClose: () => void; onAddSale: (amount: number, concept: string) => void; isLoading: boolean }> = ({ isOpen, onClose, onAddSale, isLoading }) => {
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (numAmount > 0 && concept.trim()) {
            onAddSale(numAmount, concept);
            setAmount('');
            setConcept('');
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-white">Venta Rápida</h4>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Importe (€)</label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={amount} 
                            onChange={e => setAmount(e.target.value)}
                            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" 
                            placeholder="0.00"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400">Concepto</label>
                        <input 
                            type="text" 
                            value={concept} 
                            onChange={e => setConcept(e.target.value)}
                            className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" 
                            placeholder="Ej: Consumición barra"
                            required
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex justify-center items-center"
                    >
                        {isLoading ? <LoadingSpinner /> : 'Registrar Venta'}
                    </button>
                </form>
            </div>
        </div>
    );
};

interface DetailModalProps {
    detail: { type: 'current'; data: { label: string } & FinancialData } | { type: 'historical'; data: { closing: ClosingData, historical?: HistoricalData } };
    onClose: () => void;
}

const DetailModal: React.FC<DetailModalProps> = ({ detail, onClose }) => {
    const modalContent = useMemo(() => {
        if (detail.type === 'current') {
            const totalExpenses = detail.data.cogs + detail.data.staff + detail.data.rent + detail.data.other;
            switch (detail.data.label) {
                case 'Gastos':
                    return (
                        <dl className="divide-y divide-gray-700">
                            <div className="py-2 flex justify-between"><dt className="text-gray-400">COGS</dt><dd>{detail.data.cogs.toFixed(2)}€</dd></div>
                            <div className="py-2 flex justify-between"><dt className="text-gray-400">Personal</dt><dd>{detail.data.staff.toFixed(2)}€</dd></div>
                            <div className="py-2 flex justify-between"><dt className="text-gray-400">Alquiler/Suministros</dt><dd>{detail.data.rent.toFixed(2)}€</dd></div>
                            <div className="py-2 flex justify-between"><dt className="text-gray-400">Otros</dt><dd>{detail.data.other.toFixed(2)}€</dd></div>
                            <div className="py-2 flex justify-between font-bold border-t-2 border-gray-600 mt-2"><dt>Total</dt><dd>{totalExpenses.toFixed(2)}€</dd></div>
                        </dl>
                    );
                case 'Ventas':
                    return <p>Total de ventas de la jornada: <strong>{detail.data.sales.toFixed(2)}€</strong></p>;
                case 'Beneficio':
                    return <p>Cálculo: Ventas ({detail.data.sales.toFixed(2)}€) - Gastos ({totalExpenses.toFixed(2)}€) = <strong>{(detail.data.sales - totalExpenses).toFixed(2)}€</strong></p>;
                default:
                    return null;
            }
        }
        if (detail.type === 'historical') {
            const { closing, historical } = detail.data;
            return (
                <dl className="divide-y divide-gray-700">
                    <div className="py-2 flex justify-between"><dt className="text-gray-400">Ingresos (Ventas)</dt><dd className="text-green-400">{closing.expectedSales.toFixed(2)}€</dd></div>
                    {historical && (
                        <div className="py-2 flex justify-between"><dt className="text-gray-400">Gastos Totales</dt><dd className="text-red-400">{historical.expenses.toFixed(2)}€</dd></div>
                    )}
                    {historical && (
                            <div className="py-2 flex justify-between"><dt className="text-gray-400">Food Cost %</dt><dd className={historical.foodCostPercentage > 35 ? 'text-yellow-400' : 'text-gray-300'}>{historical.foodCostPercentage.toFixed(2)}%</dd></div>
                    )}
                    {historical && (
                            <div className="py-2 flex justify-between font-bold border-b border-gray-600 mb-2 pb-2"><dt>Beneficio Bruto</dt><dd>{(historical.sales - historical.expenses).toFixed(2)}€</dd></div>
                    )}
                    <div className="py-2 flex justify-between pt-2"><dt className="text-gray-400">Caja Contada</dt><dd>{closing.countedCash.toFixed(2)}€</dd></div>
                    <div className="py-2 flex justify-between font-bold"><dt>Descuadre</dt><dd className={closing.discrepancy >= 0 ? 'text-green-400' : 'text-red-400'}>{closing.discrepancy.toFixed(2)}€</dd></div>
                </dl>
            );
        }
        return null;
    }, [detail]);

    const title = detail.type === 'current' 
        ? `Detalles: ${detail.data.label}` 
        : `Cierre del ${new Date(detail.data.closing.date).toLocaleDateString('es-ES')}`;

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-md shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-white">{title}</h4>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>
                <div className="space-y-2 text-gray-300">
                    {modalContent}
                </div>
            </div>
        </div>
    )
}

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

interface SummaryViewProps {
    financials: FinancialData;
    historicalData: HistoricalData[];
    closingHistory: ClosingData[];
    onAddSale: (sale: { amount: number; concept: string }) => void;
}

const SummaryView: React.FC<SummaryViewProps> = ({ financials, historicalData, closingHistory, onAddSale }) => {
    const [selectedDetail, setSelectedDetail] = useState<DetailModalProps['detail'] | null>(null);
    const [dateRange, setDateRange] = useState({ start: '', end: '' });
    const [isAdviceModalOpen, setAdviceModalOpen] = useState(false);
    const [isQuickSaleOpen, setQuickSaleOpen] = useState(false);
    const [advice, setAdvice] = useState<ChatMessage[] | null>(null);
    const [isAdviceLoading, setAdviceLoading] = useState(false);

    const filteredHistoricalData = useMemo(() => {
        if (!dateRange.start || !dateRange.end) {
            return historicalData;
        }
        const start = new Date(dateRange.start);
        start.setHours(0, 0, 0, 0);
        const end = new Date(dateRange.end);
        end.setHours(23, 59, 59, 999);
        
        return historicalData.filter(d => {
            const itemDate = new Date(d.date);
            return itemDate >= start && itemDate <= end;
        });
    }, [historicalData, dateRange]);
    
    const handleBarClick = (type: 'current' | 'historical', identifier: string) => {
        if (type === 'current') {
            setSelectedDetail({ type: 'current', data: { label: identifier, ...financials } });
        } else {
            const closingDetail = closingHistory.find(c => new Date(c.date).toDateString() === new Date(identifier).toDateString());
            const historicalDetail = historicalData.find(h => new Date(h.date).toDateString() === new Date(identifier).toDateString());
            if (closingDetail) {
                setSelectedDetail({ type: 'historical', data: { closing: closingDetail, historical: historicalDetail } });
            }
        }
    };
    
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setDateRange(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const resetFilter = () => setDateRange({ start: '', end: '' });

     const last7DaysData = useMemo(() => {
        const sortedData = [...historicalData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        return sortedData.slice(0, 7).reverse();
    }, [historicalData]);

    const handleGetAnalysis = async () => {
        setAdviceModalOpen(true);
        setAdviceLoading(true);
        setAdvice(null);
        
        if (last7DaysData.length === 0) {
            const noDataAdvice: ChatMessage[] = [{ role: 'model', parts: [{ text: "No hay suficientes datos históricos para realizar un análisis. Registre al menos un cierre de caja para comenzar." }] }];
            setAdvice(noDataAdvice);
            setAdviceLoading(false);
            return;
        }

        const formattedData = last7DaysData.map(d => 
            `  - ${new Date(d.date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit' })}: Ventas=${d.sales.toFixed(2)}€, Gastos=${d.expenses.toFixed(2)}€, FoodCost=${d.foodCostPercentage.toFixed(2)}%`
        ).join('\n');
        
        const prompt = `Contexto: Datos financieros de los últimos ${last7DaysData.length} días:\n${formattedData}\n\nTarea: Analiza estos datos financieros. Proporciona un resumen ejecutivo (máximo 3 puntos clave) y sugiere una acción inmediata para mejorar la rentabilidad esta semana.`;
        
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

    const totalExpenses = financials.cogs + financials.staff + financials.rent + financials.other;
    const profit = financials.sales - totalExpenses;
    const foodCostPercentage = financials.sales > 0 ? (financials.cogs / financials.sales) * 100 : 0;

    const currentDayData = [
        { label: 'Ventas', value: financials.sales, color: '#34D399', originalDate: 'Ventas' },
        { label: 'Gastos', value: totalExpenses, color: '#F87171', originalDate: 'Gastos' },
        { label: 'Beneficio', value: profit, color: '#60A5FA', originalDate: 'Beneficio' },
    ];
    
     const last7DaysChartData = last7DaysData.map(d => ({
        label: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        originalDate: d.date,
        Ventas: d.sales,
        Gastos: d.expenses,
        values: [
            { value: d.sales, color: '#34D399' },
            { value: d.expenses, color: '#F87171' }
        ]
    }));

    const historicalChartData = filteredHistoricalData.map(d => ({
        label: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        originalDate: d.date,
        Ventas: d.sales,
        Gastos: d.expenses,
        values: [
            { value: d.sales, color: '#34D399' },
            { value: d.expenses, color: '#F87171' }
        ]
    })).slice(0, 30).reverse();

    const historicalFoodCostData = filteredHistoricalData.map(d => ({
        label: new Date(d.date).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
        value: d.foodCostPercentage,
        color: '#A78BFA',
        originalDate: d.date,
    })).slice(0, 30).reverse();

    return (
        <div className="w-full max-w-6xl mx-auto space-y-8">
            {selectedDetail && <DetailModal detail={selectedDetail} onClose={() => setSelectedDetail(null)} />}
            <AIAdviceModal isOpen={isAdviceModalOpen} onClose={() => setAdviceModalOpen(false)} advice={advice} isLoading={isAdviceLoading} title="Análisis Financiero con IA" />
            <QuickSaleModal isOpen={isQuickSaleOpen} onClose={() => setQuickSaleOpen(false)} onAddSale={(amount, concept) => onAddSale({ amount, concept })} isLoading={false} />

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                 <div className="flex justify-between items-start">
                    <div className="text-left">
                        <p className="text-gray-400 text-sm uppercase tracking-wider">Food Cost % (COGS / Ventas) de la Jornada</p>
                        <p className={`text-5xl font-bold mt-2 ${foodCostPercentage > 35 ? 'text-yellow-400' : 'text-gray-200'}`}>
                            {foodCostPercentage.toFixed(2)}%
                        </p>
                    </div>
                    <div className="flex flex-col gap-2">
                        <button onClick={handleGetAnalysis} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                            <SparkIcon className="h-5 w-5 mb-0" />
                            Analizar con IA
                        </button>
                        <button onClick={() => setQuickSaleOpen(true)} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                            <span className="text-xl leading-none">+</span>
                            Venta Rápida
                        </button>
                    </div>
                </div>
                <p className="text-xs text-gray-500 mt-2 text-left">Este es el porcentaje de los ingresos por ventas que se gasta en ingredientes y productos vendidos.</p>
            </div>

            <BarChart 
                title="Resultados de la Jornada Actual" 
                data={currentDayData}
                onBarClick={(identifier) => handleBarClick('current', identifier)}
                selectedIdentifier={selectedDetail?.type === 'current' ? selectedDetail.data.label : null}
            />

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <h3 className="text-xl font-bold text-white mb-2 text-center">Resumen de los Últimos 7 Días</h3>
                 <div className="flex justify-center text-xs mb-4 gap-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#34D399]"></div><span>Ventas</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#F87171]"></div><span>Gastos</span></div>
                </div>
                <GroupedBarChart
                    data={last7DaysChartData}
                    onBarClick={(date) => handleBarClick('historical', date)}
                    selectedDate={selectedDetail?.type === 'historical' ? selectedDetail.data.closing.date : null}
                />
            </div>

            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                 <div className="flex flex-col sm:flex-row justify-between items-center mb-4">
                     <h3 className="text-xl font-bold text-white text-center sm:text-left">Historial Completo de Cierres</h3>
                     <button 
                         onClick={() => {
                             if (!filteredHistoricalData.length) return;
                             const headers = 'Fecha,Ingresos(Ventas),Gastos Totales,Food Cost %,Beneficio Bruto\n';
                             const csvData = filteredHistoricalData.map(d => {
                                 const profit = d.sales - d.expenses;
                                 return `${d.date},${d.sales.toFixed(2)},${d.expenses.toFixed(2)},${d.foodCostPercentage.toFixed(2)},${profit.toFixed(2)}`;
                             }).join('\n');
                             const blob = new Blob([headers + csvData], { type: 'text/csv;charset=utf-8;' });
                             const link = document.createElement('a');
                             const url = URL.createObjectURL(blob);
                             link.setAttribute('href', url);
                             link.setAttribute('download', 'historial_cierres.csv');
                             link.style.visibility = 'hidden';
                             document.body.appendChild(link);
                             link.click();
                             document.body.removeChild(link);
                         }} 
                         className="mt-4 sm:mt-0 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition-colors"
                     >
                         Descargar CSV
                     </button>
                 </div>
                 <div className="flex flex-col sm:flex-row justify-center items-center gap-2 sm:gap-4 mb-4 text-sm">
                    <label htmlFor="start-date" className="text-gray-400">Desde:</label>
                    <input type="date" name="start" id="start-date" value={dateRange.start} onChange={handleDateChange} className="bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500 p-1"/>
                    <label htmlFor="end-date" className="text-gray-400">Hasta:</label>
                    <input type="date" name="end" id="end-date" value={dateRange.end} onChange={handleDateChange} className="bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500 p-1"/>
                    <button onClick={resetFilter} className="px-3 py-1 bg-gray-600 hover:bg-gray-500 rounded-md transition-colors">Limpiar</button>
                 </div>
                 <div className="flex justify-center text-xs mb-4 gap-4">
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#34D399]"></div><span>Ventas</span></div>
                    <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-sm bg-[#F87171]"></div><span>Gastos</span></div>
                </div>
                <GroupedBarChart 
                    data={historicalChartData}
                    onBarClick={(date) => handleBarClick('historical', date)}
                    selectedDate={selectedDetail?.type === 'historical' ? selectedDetail.data.closing.date : null}
                    title="Ventas vs Gastos"
                />
            </div>

            <BarChart 
                title="Historial de Food Cost %" 
                data={historicalFoodCostData}
                onBarClick={(date) => handleBarClick('historical', date)}
                selectedIdentifier={selectedDetail?.type === 'historical' ? selectedDetail.data.closing.date : null}
                valueSuffix="%"
            />
        </div>
    );
};

export default SummaryView;
