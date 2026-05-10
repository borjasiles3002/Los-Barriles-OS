import React, { useState } from 'react';
import { callGemini } from '../services/geminiService';
import { SaleEntry, ExpenseEntry, InventoryTransaction, StockItem } from '../types';
import { LoadingSpinner, SparkIcon } from './icons';
import ReactMarkdown from 'react-markdown';

interface AIReportsViewProps {
    sales: SaleEntry[];
    expenses: ExpenseEntry[];
    mermas: InventoryTransaction[];
    drinkStock: StockItem[];
    kitchenStock: StockItem[];
}

const AIReportsView: React.FC<AIReportsViewProps> = ({ sales, expenses, mermas, drinkStock, kitchenStock }) => {
    const [reportContent, setReportContent] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generateReport = async () => {
        setIsLoading(true);
        setError(null);
        setReportContent(null);

        // Summarize data for the prompt
        // Calculate totals
        const totalSales = sales.reduce((sum, s) => sum + s.amount, 0);
        const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
        const wasteCount = mermas.filter(m => m.type === 'exit' && m.reason && m.reason.toLowerCase().includes('merma')).length;

        // Low stock items
        const allStock = [...drinkStock, ...kitchenStock];
        const lowStock = allStock.filter(i => i.stock <= i.threshold).map(i => `${i.name} (Queda: ${i.stock})`).join(', ');

        const dataContext = `
DATOS ACTUALES DEL NEGOCIO:
- Ingresos Totales (histórico reciente): ${totalSales.toFixed(2)}€
- Gastos Totales (histórico reciente): ${totalExpenses.toFixed(2)}€
- Beneficio Bruto Estimado: ${(totalSales - totalExpenses).toFixed(2)}€
- Número de Mermas/Desperdicios registrados: ${wasteCount}
- Productos con bajo stock crítico: ${lowStock || 'Ninguno'}

Tarea:
Asume el rol de un consultor de restaurantes experto (ej. Chicote, Gordon Ramsay pero en tono profesional y analítico). 
Basándote en estos datos (los ingresos, los gastos, las mermas y el stock), genera un informe ejecutivo que contenga:
1. Resumen de la Salud Financiera.
2. Análisis de Mermas y Control de Inventario.
3. 3 Recomendaciones clave y accionables para mejorar la rentabilidad esta misma semana.
4. (Opcional) Una sugerencia de marketing de "venta sugestiva" (upselling) basada en el momento actual.

Usa formato Markdown con encabezados limpios, listas y negritas para facilitar la lectura. No inventes números que no te he proporcionado, básate estrictamente en los montos indicados. Si los datos son nulos o cero, indícalo.`;

        try {
            const response = await callGemini([{ role: 'user', parts: [{ text: dataContext }] }], "Eres un analista de negocios y consultor de la industria gastronómica de máximo nivel.", { thinkingMode: true });
            setReportContent(response.text);
        } catch (err: unknown) {
            if (err instanceof Error) {
                setError(err.message || 'Error al generar el reporte.');
            } else {
                setError('Error desconocido al generar el reporte.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="bg-gray-800 p-6 sm:p-10 rounded-2xl shadow-xl max-w-5xl mx-auto border border-gray-700">
            <div className="text-center mb-8">
                <div className="inline-block p-4 bg-indigo-900/40 rounded-full mb-4">
                    <SparkIcon className="w-10 h-10 text-indigo-400" />
                </div>
                <h2 className="text-3xl font-bold text-white mb-2">Reporte Ejecutivo de IA</h2>
                <p className="text-gray-400 max-w-2xl mx-auto">
                    Nuestra Inteligencia Artificial analiza tus ventas, gastos, mermas y niveles de stock para ofrecerte un diagnóstico preciso y recomendaciones accionables.
                </p>
            </div>

            {!reportContent && !isLoading && (
                <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-xl">
                    <button 
                        onClick={generateReport}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-full shadow-lg transition-all transform hover:scale-105"
                    >
                        Generar Nuevo Reporte
                    </button>
                    <p className="text-xs text-gray-500 mt-4">Este proceso puede tardar unos segundos mientras la IA razona.</p>
                </div>
            )}

            {isLoading && (
                <div className="flex flex-col items-center justify-center py-20 text-indigo-400">
                    <LoadingSpinner />
                    <span className="mt-4 font-medium animate-pulse">La IA está analizando los datos y generando el informe...</span>
                </div>
            )}

            {error && (
                <div className="bg-red-900/30 border border-red-500/50 p-4 rounded-lg text-red-200 text-center mb-6">
                    Error: {error}
                </div>
            )}

            {reportContent && !isLoading && (
                <div className="bg-gray-900/50 border border-gray-700 p-6 md:p-10 rounded-xl mt-6 prose prose-invert max-w-none prose-indigo">
                    <div className="flex justify-end mb-4">
                         <button 
                            onClick={generateReport}
                            className="bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded-lg shadow-sm transition-all text-sm flex items-center gap-2"
                        >
                            <SparkIcon className="w-4 h-4"/> Actualizar Reporte
                        </button>
                    </div>
                    <div className="markdown-body">
                        <ReactMarkdown>{reportContent}</ReactMarkdown>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIReportsView;
