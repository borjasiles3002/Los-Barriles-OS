
import React, { useState } from 'react';
import { ChatMessage, StockItem } from '../types';
import useLocalStorage from '../useLocalStorage';
import StockChart from './StockChart';
import ChatDisplay from './ChatDisplay';
import InputBar from './InputBar';
import { callGemini } from '../services/geminiService';
import { GEMINI_ANALYSIS_PROMPT } from '../constants';
import { DocumentScannerIcon } from './icons';
import { checkAndOpenKeySelector, hasAistudio } from '../utils/aistudio';
import { compressImage } from '../utils/image';
import ProfitabilityAlerts from './ProfitabilityAlerts';

interface AnalysisViewProps {
  drinkStock: StockItem[];
  kitchenStock: StockItem[];
}

const AnalysisView: React.FC<AnalysisViewProps> = ({ drinkStock, kitchenStock }) => {
    const [chatHistory, setChatHistory] = useLocalStorage<ChatMessage[]>('analysisChatHistory', []);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const handleSendMessage = async (prompt: string, image: { mimeType: string; data: string } | null = null) => {
        if (!image) {
            setError("Por favor, suba una imagen para analizar.");
            return;
        }

        setIsLoading(true);
        setError(null);

        let finalImage = image;
        if (image && image.mimeType.startsWith('image/')) {
            try {
                const compressed = await compressImage(image.data, image.mimeType);
                finalImage = compressed;
            } catch (compressErr) {
                console.warn("Compression failed", compressErr);
            }
        }

        const userMessage: ChatMessage = {
            role: 'user',
            parts: [{ text: prompt }, { inlineData: finalImage }]
        };

        const currentChatHistory = [...chatHistory, userMessage];
        setChatHistory(currentChatHistory);

        try {
            const modelResponse = await callGemini(currentChatHistory, GEMINI_ANALYSIS_PROMPT, { thinkingMode: true });
            const modelMessage: ChatMessage = { role: 'model', parts: [{ text: modelResponse.text }] };
            setChatHistory(prev => [...prev, modelMessage]);
        } catch (err) {
            const error = err as Error;
            const isMissingKey = error.message.includes("ERROR_CLAVE_API") || error.message.includes("403") || error.message.includes("PERMISSION_DENIED") || error.message.includes("API key");
            const errorMessage = error.message.includes("ERROR_CLAVE_API") 
                ? error.message 
                : (isMissingKey 
                    ? "ERROR_CLAVE_API: Falta la clave de API o no es válida. Por favor, selecciónala."
                    : (error.message || 'An unknown error occurred.'));
            setError(`Error: ${errorMessage}`);
            setChatHistory(prev => prev.slice(0, -1)); 
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <StockChart drinkStock={drinkStock} kitchenStock={kitchenStock} />
            
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto px-4">
                <div className="lg:col-span-1">
                    <ProfitabilityAlerts drinkStock={drinkStock} kitchenStock={kitchenStock} />
                </div>
                
                <div className="lg:col-span-2 flex flex-col h-[600px] bg-gray-800/50 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                    <main className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar">
                        {chatHistory.length === 0 && (
                            <div className="text-center text-gray-500 flex flex-col items-center justify-center h-full">
                                <DocumentScannerIcon />
                                <h2 className="text-xl font-bold text-gray-300 mt-4">Asistente de Análisis Visual</h2>
                                <p className="mt-2">Suba una imagen o PDF y haga una pregunta para comenzar el análisis.</p>
                                <p className="text-sm mt-2 font-mono opacity-60">Ej: ¿Qué plato se podría preparar con estos ingredientes?</p>
                            </div>
                        )}
                        <ChatDisplay chatHistory={chatHistory} />
                    </main>
                    <footer className="p-4 bg-gray-900/80 backdrop-blur-sm border-t border-gray-700">
                        {error && (
                            <div className="text-center mb-2">
                                <p className="text-red-400 text-sm">{error}</p>
                                {error.includes("ERROR_CLAVE_API") && (
                                    <div className="flex flex-col items-center gap-1 mt-1">
                                        <button 
                                            onClick={async () => {
                                                const opened = await checkAndOpenKeySelector();
                                                if (opened) {
                                                    setError(null);
                                                } else {
                                                    alert("No se pudo abrir el selector. Usa el menú de configuración de AI Studio.");
                                                }
                                            }}
                                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors shadow"
                                        >
                                            Seleccionar Clave
                                        </button>
                                        {!hasAistudio() && (
                                            <p className="text-[9px] text-red-300 italic">
                                                Usa el icono de engranaje (⚙️) en la parte superior de la app para configurar tu clave manualmente.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                        <InputBar 
                            onSendMessage={handleSendMessage} 
                            isLoading={isLoading}
                            placeholder="Describe la imagen o haz una pregunta..."
                        />
                    </footer>
                </div>
            </div>
        </div>
    );
};

export default AnalysisView;
