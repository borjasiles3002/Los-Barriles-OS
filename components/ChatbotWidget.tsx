import React, { useState, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface WindowWithAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}
import { ChatMessage, ChatMessagePart, ExpenseEntry, PurchaseItem, FinancialData, HistoricalData, StockItem, OrderStatus } from '../types';
import useLocalStorage from '../useLocalStorage';
import { callGemini, generateSpeech } from '../services/geminiService';
import { GEMINI_ADVISOR_PROMPT, ALL_TOOLS } from '../constants';
import { checkAndOpenKeySelector, hasAistudio } from '../utils/aistudio';
import { compressImage } from '../utils/image';
import ChatDisplay from './ChatDisplay';
import InputBar from './InputBar';
import { VoiceChatIcon, XIcon, ThinkingIcon, GoogleIcon, MicrophoneIcon, StopIcon, LoadingSpinner } from './icons';
import { decode, decodeAudioData, createBlob } from '../utils/audio';

interface ChatbotWidgetProps {
    onAddReservation: (args: { nombre: string; fecha: string; personas: number; notas?: string; }) => void;
    onAddExpense: (args: { expense: Omit<ExpenseEntry, 'id' | 'date'>; stockItems?: { bebidas?: PurchaseItem[]; cocina?: PurchaseItem[]; }; }) => void;
    onAddSale: (args: { sale: { amount: number; }; soldItems?: { producto: string; cantidad: number; }[]; }) => void;
    onClockIn: (employeeName: string) => void;
    onClockOut: (employeeName: string) => void;
    onAddOrder: (order: { table: string; items: { name: string; quantity: number; }[]; }) => void;
    onUpdateOrderStatus: (orderId: string, status: OrderStatus, assignedCookId?: string) => void;
    onUpdateStock: (items: { productName: string; quantity: number; stockType: 'drinkStock' | 'kitchenStock'; unitPrice?: number; family?: string; }[]) => void;
    onPerformCashClosing: (args: { countedAmount: number }) => string;
    onAnalyzeInvoices: (fileParts: ChatMessagePart[], prompt: string) => Promise<string>;
    onAnalyzeSalesTicket: (fileParts: ChatMessagePart[], prompt: string) => Promise<string>;
    drinkStock: StockItem[];
    kitchenStock: StockItem[];
    financials: FinancialData;
    historicalData: HistoricalData[];
    theme?: 'dark' | 'light';
}

const ChatbotWidget: React.FC<ChatbotWidgetProps> = (props) => {
    const theme = props.theme || 'dark';
    const isDark = theme === 'dark';
    const [isOpen, setIsOpen] = useState(false);
    const [chatHistory, setChatHistory] = useLocalStorage<ChatMessage[]>('chatbotHistory', []);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [thinkingMode, setThinkingMode] = useState(false);
    const [useSearch, setUseSearch] = useState(false);

    // Live API State
    const [isLiveSessionActive, setIsLiveSessionActive] = useState(false);
    // FIX: Changed type from 'Promise<LiveSession>' to 'Promise<any>' because 'LiveSession' is not an exported member of '@google/genai'.
    const sessionPromiseRef = useRef<Promise<unknown> | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);

    // TTS State
    const [activeTTSIndex, setActiveTTSIndex] = useState<number | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);

    const getOutputAudioContext = (): AudioContext => {
        if (!outputAudioContextRef.current) {
            outputAudioContextRef.current = new (window.AudioContext || (window as WindowWithAudioContext).webkitAudioContext)({ sampleRate: 24000 });
        }
        return outputAudioContextRef.current;
    };

    const handleFunctionCalls = async (functionCalls: { name: string; args: Record<string, unknown>; id: string }[], existingHistory: ChatMessage[]) => {
        const functionResponses = [];

        for (const fc of functionCalls) {
            const result = (() => {
                try {
                    console.log(`Executing function: ${fc.name}`, fc.args);
                    switch (fc.name) {
                        case 'addReservation':
                            props.onAddReservation(fc.args as { nombre: string; fecha: string; personas: number; notas?: string; });
                            return { success: true, message: "Reserva añadida." };
                        case 'addExpense':
                            props.onAddExpense(fc.args as { expense: Omit<ExpenseEntry, 'id' | 'date'>; stockItems?: { bebidas?: PurchaseItem[]; cocina?: PurchaseItem[]; }; });
                            return { success: true, message: "Gasto y stock actualizados." };
                        case 'addSale':
                            props.onAddSale(fc.args as { sale: { amount: number; }; soldItems?: { producto: string; cantidad: number; }[]; });
                            return { success: true, message: "Venta registrada." };
                        case 'clockIn':
                            props.onClockIn(fc.args.employeeName as string);
                            return { success: true, message: `Fichaje de entrada para ${fc.args.employeeName} registrado.` };
                        case 'clockOut':
                            props.onClockOut(fc.args.employeeName as string);
                            return { success: true, message: `Fichaje de salida para ${fc.args.employeeName} registrado.` };
                        case 'performCashClosing':
                            const closingResult = props.onPerformCashClosing(fc.args as { countedAmount: number });
                            return { success: true, message: closingResult };
                        case 'addOrder':
                            props.onAddOrder(fc.args as { table: string; items: { name: string; quantity: number; }[]; });
                            return { success: true, message: "Pedido registrado correctamente." };
                        case 'updateOrderStatus':
                            props.onUpdateOrderStatus(fc.args.orderId as string, fc.args.status as OrderStatus, fc.args.assignedCookId as string);
                            return { success: true, message: "Estado del pedido actualizado." };
                        case 'updateStock':
                            const items = fc.args.items as { productName: string; quantity: number; stockType: 'drinkStock' | 'kitchenStock'; unitPrice?: number; family?: string; }[];
                            props.onUpdateStock(items);
                            return { success: true, message: "Stock actualizado correctamente." };
                        default:
                            console.warn(`Función desconocida: ${fc.name}`);
                            return { success: false, message: `Función desconocida: ${fc.name}` };
                    }
                } catch (e: unknown) {
                    console.error(`Error executing function ${fc.name}:`, e);
                    return { success: false, message: `Error ejecutando ${fc.name}: ${e instanceof Error ? e.message : String(e)}` };
                }
            })();

            functionResponses.push({
                functionResponse: {
                    name: fc.name,
                    response: { result },
                }
            });
        }

        const functionCallMessage: ChatMessage = {
            role: 'model',
            parts: functionCalls.map(fc => ({ functionCall: fc as unknown as Record<string, unknown> })),
        };
        const toolResponseMessage: ChatMessage = { role: 'user', parts: functionResponses };
        const currentChatHistory = [...existingHistory, functionCallMessage, toolResponseMessage];
        setChatHistory(currentChatHistory);

        try {
            const stockContext = `
DATOS ACTUALES DEL RESTAURANTE (Contexto para tus respuestas):
- Inventario de Bebidas: ${JSON.stringify(props.drinkStock.map(s => ({ name: s.name, stock: s.stock, lastPrice: s.lastPrice, family: s.family })))}
- Inventario de Cocina: ${JSON.stringify(props.kitchenStock.map(s => ({ name: s.name, stock: s.stock, lastPrice: s.lastPrice, family: s.family })))}
- Datos Financieros Hoy: ${JSON.stringify(props.financials)}
- Histórico (Últimos días): ${JSON.stringify(props.historicalData.slice(0, 7))}
`;
            const fullSystemPrompt = `${GEMINI_ADVISOR_PROMPT}\n\n${stockContext}`;
            const finalApiResponse = await callGemini(currentChatHistory, fullSystemPrompt, { thinkingMode, useSearch }, 'gemini-2.0-flash');
            const finalText = finalApiResponse.text;
            if (finalText) {
                const finalModelMessage: ChatMessage = { role: 'model', parts: [{ text: finalText }] };
                setChatHistory(prev => [...prev, finalModelMessage]);
            }
        } catch (err) {
             const error = err as Error;
             const isMissingKey = error.message.includes("ERROR_CLAVE_API") || error.message.includes("403") || error.message.includes("use api key") || error.message.includes("PERMISSION_DENIED");
             const errorMessage = error.message.includes("ERROR_CLAVE_API")
                ? error.message
                : (isMissingKey
                    ? "ERROR_CLAVE_API: Falta la clave de API o no es válida. Por favor, selecciónala."
                    : 'Error al obtener la respuesta final de la IA.');
             setError(errorMessage);
        }
    };

    const handleSendMessage = async (prompt: string, images: { mimeType: string; data: string }[] | null = null) => {
        setIsLoading(true);
        setError(null);

        let finalImages = images;
        if (images && images.length > 0) {
            try {
                const compressedImages = await Promise.all(images.map(async (img) => {
                    if (img.mimeType.startsWith('image/')) {
                        return await compressImage(img.data, img.mimeType);
                    }
                    return img;
                }));
                finalImages = compressedImages;
            } catch (compressErr) {
                console.warn("Compression failed", compressErr);
            }
        }

        const userMessageParts: ChatMessagePart[] = [{ text: prompt }];
        if (finalImages && finalImages.length > 0) {
            finalImages.forEach(image => {
                userMessageParts.push({ inlineData: image });
            });
        }

        const newUserMessage: ChatMessage = { role: 'user', parts: userMessageParts };
        const currentChatHistory = [...chatHistory, newUserMessage];
        setChatHistory(currentChatHistory);

        try {
            const stockContext = `
DATOS ACTUALES DEL RESTAURANTE (Contexto para tus respuestas):
- Inventario de Bebidas: ${JSON.stringify(props.drinkStock.map(s => ({ name: s.name, stock: s.stock, lastPrice: s.lastPrice, family: s.family })))}
- Inventario de Cocina: ${JSON.stringify(props.kitchenStock.map(s => ({ name: s.name, stock: s.stock, lastPrice: s.lastPrice, family: s.family })))}
- Datos Financieros Hoy: ${JSON.stringify(props.financials)}
- Histórico (Últimos días): ${JSON.stringify(props.historicalData.slice(0, 7))}
`;
            const fullSystemPrompt = `${GEMINI_ADVISOR_PROMPT}\n\n${stockContext}`;

            if (images && images.length > 0) {
                const fileParts = images.map(img => ({ inlineData: img }));
                const lowerPrompt = prompt.toLowerCase();
                const isSale = lowerPrompt.includes('venta') || lowerPrompt.includes('ticket') || lowerPrompt.includes('vender');

                let analysisText = '';
                if (isSale) {
                    analysisText = await props.onAnalyzeSalesTicket(fileParts, prompt);
                } else {
                    analysisText = await props.onAnalyzeInvoices(fileParts, prompt);
                }

                const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: analysisText }] };
                setChatHistory(prev => [...prev, newModelMessage]);
            } else {
                const response = await callGemini(currentChatHistory, fullSystemPrompt, { thinkingMode, useSearch, tools: ALL_TOOLS }, 'gemini-2.0-flash');
                const functionCalls = response.functionCalls;
                const text = response.text;

                if (functionCalls && functionCalls.length > 0) {
                    await handleFunctionCalls(functionCalls, currentChatHistory);
                } else if (text) {
                    const newModelMessage: ChatMessage = { role: 'model', parts: [{ text }] };
                    setChatHistory(prev => [...prev, newModelMessage]);
                }
            }
        } catch(err) {
            const error = err as Error;
            const isMissingKey = error.message.includes("ERROR_CLAVE_API") || error.message.includes("403") || error.message.includes("use api key") || error.message.includes("PERMISSION_DENIED");
            const errorMessage = error.message.includes("ERROR_CLAVE_API")
                ? error.message
                : (isMissingKey
                    ? "ERROR_CLAVE_API: Falta la clave de API o no es válida. Por favor, selecciónala."
                    : (error.message || 'Error.'));
            setError(`Error: ${errorMessage}.`);
        } finally {
            setIsLoading(false);
        }
    };

    const handlePlaySpeech = async (text: string, messageIndex: number) => {
        setActiveTTSIndex(messageIndex);
        try {
            const audioCtx = getOutputAudioContext();
            const base64Audio = await generateSpeech(text);
            const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
            const source = audioCtx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(audioCtx.destination);
            source.start();
        } catch(err) {
            console.error("Error playing speech:", err);
            setError("Error al generar el audio.");
        } finally {
            setActiveTTSIndex(null);
        }
    };

    const startLiveSession = async () => {
        setError('La voz en directo se ha desactivado para proteger la clave de Gemini. Usa el chat escrito o la lectura de respuestas mientras se implementa streaming desde el servidor.');
    };

    const stopLiveSession = (shouldCloseSession = true) => {
        if (!isLiveSessionActive && !shouldCloseSession) return;

        if (shouldCloseSession && sessionPromiseRef.current) {
            sessionPromiseRef.current.then(session => session.close());
        }

        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        audioProcessorRef.current?.disconnect();
        inputAudioContextRef.current?.close();

        mediaStreamRef.current = null;
        audioProcessorRef.current = null;
        inputAudioContextRef.current = null;
        sessionPromiseRef.current = null;

        setIsLiveSessionActive(false);
    };


    return (
        <div className="fixed bottom-5 right-5 z-50">
            {isOpen && (
                <div className={`flex flex-col border rounded-xl shadow-2xl w-[90vw] max-w-md h-[70vh] animate-fade-in ${
                    isDark ? 'bg-gray-900/80 backdrop-blur-md border-gray-700' : 'bg-white border-gray-200'
                }`}>
                    <header className={`p-4 border-b flex justify-between items-center ${
                        isDark ? 'border-gray-700 text-white' : 'border-gray-200 text-gray-900'
                    }`}>
                        <h3 className="text-lg font-bold">Asistente Chef AI</h3>
                        <button onClick={() => { setIsOpen(false); stopLiveSession(); }} className={`${isDark ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'}`}><XIcon /></button>
                    </header>
                    <main className={`flex-1 overflow-y-auto p-4 ${isDark ? 'bg-transparent' : 'bg-gray-50'}`}>
                        <ChatDisplay chatHistory={chatHistory} onPlaySpeech={handlePlaySpeech} activeTTSIndex={activeTTSIndex} theme={theme} />
                         {isLiveSessionActive && !isLoading && (
                            <div className="flex justify-center items-center p-4">
                               <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                                   <MicrophoneIcon className="h-8 w-8 text-white" />
                               </div>
                            </div>
                        )}
                    </main>
                    <footer className={`p-3 border-t ${isDark ? 'bg-gray-800/80 border-gray-700' : 'bg-white border-gray-200'}`}>
                        <div className="flex items-center justify-between gap-2 text-xs mb-2 px-1">
                            <div className="flex items-center gap-2" title="Thinking Mode (Usa gemini-3-pro para máxima capacidad)">
                                <ThinkingIcon className={`w-4 h-4 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                                <button onClick={() => setThinkingMode(!thinkingMode)} className={`${thinkingMode ? 'bg-blue-600' : 'bg-gray-400'} relative inline-flex h-5 w-9 items-center rounded-full transition-colors`}><span className={`${thinkingMode ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} /></button>
                            </div>
                            <div className="flex items-center gap-2" title="Google Search (Usa gemini-flash con búsqueda web)">
                                <GoogleIcon className={`w-4 h-4 ${isDark ? 'text-white' : 'text-gray-600'}`} />
                                <button onClick={() => setUseSearch(!useSearch)} className={`${useSearch ? 'bg-blue-600' : 'bg-gray-400'} relative inline-flex h-5 w-9 items-center rounded-full transition-colors`}><span className={`${useSearch ? 'translate-x-5' : 'translate-x-1'} inline-block h-3 w-3 transform rounded-full bg-white transition-transform`} /></button>
                            </div>
                        </div>
                        {error && (
                            <div className="text-center mb-2">
                                <p className="text-red-500 text-sm font-medium">{error}</p>
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
                                            className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors shadow font-bold"
                                        >
                                            Seleccionar Clave
                                        </button>
                                        {!hasAistudio() && (
                                            <p className={`text-[9px] italic ${isDark ? 'text-red-300' : 'text-red-600'}`}>
                                                Usa el icono de engranaje (⚙️) en la parte superior de la app para configurar tu clave manualmente.
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {isLiveSessionActive ? (
                            <button onClick={() => stopLiveSession()} className="w-full flex justify-center items-center gap-2 py-2 px-4 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors">
                                <StopIcon />
                                Detener Conversación
                            </button>
                        ) : (
                            <InputBar onSendMessage={handleSendMessage} isLoading={isLoading || isLiveSessionActive} placeholder="Pregúntale al Chef AI..." theme={theme} />
                        )}

                    </footer>
                </div>
            )}
            <button onClick={() => {
                if (isOpen) {
                    stopLiveSession();
                }
                setIsOpen(!isOpen);
            }}
            className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-lg hover:bg-blue-700 transition-transform hover:scale-110">
                {isOpen ? <XIcon /> : <VoiceChatIcon className="w-8 h-8 text-white" />}
            </button>
             {!isOpen &&
             <button onClick={startLiveSession} className="absolute -top-4 -left-4 w-10 h-10 bg-green-500 rounded-full flex items-center justify-center shadow-lg hover:bg-green-600 transition-transform hover:scale-110" aria-label="Iniciar conversación de voz">
                {isLiveSessionActive ? <LoadingSpinner /> : <MicrophoneIcon className="w-6 h-6 text-white" />}
             </button>
            }
        </div>
    );
};

export default ChatbotWidget;
