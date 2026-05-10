import React, { useState, useRef } from 'react';
// FIX: The 'LiveSession' type is not exported from the '@google/genai' package.
// It has been removed from the import statement to resolve the module resolution error.
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';

interface WindowWithAudioContext extends Window {
  webkitAudioContext?: typeof AudioContext;
}
import { ChatMessage, ChatMessagePart, ExpenseEntry, PurchaseItem, FinancialData, HistoricalData, StockItem, OrderStatus } from '../types';
import useLocalStorage from '../useLocalStorage';
import { callGemini, generateSpeech, getApiKey } from '../services/geminiService';
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
                            // Handle manual stock update
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
        
        // FIX: Explicitly create a `ChatMessage` object for the model's function call message.
        // This resolves a TypeScript error where the 'role' property was being incorrectly
        // inferred as a generic 'string' instead of the required '"user" | "model"'.
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
            const finalApiResponse = await callGemini(currentChatHistory, fullSystemPrompt, { thinkingMode, useSearch }, 'gemini-3-flash-preview');
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

            // If there are files (images or PDFs), it's an analysis task.
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
                // Otherwise, it's a regular chat message.
                const response = await callGemini(currentChatHistory, fullSystemPrompt, { thinkingMode, useSearch, tools: ALL_TOOLS }, 'gemini-3-flash-preview');
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
        if (isLiveSessionActive) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            setIsLiveSessionActive(true);
            setChatHistory(prev => [...prev, {role: 'model', parts: [{ text: "Escuchando... Hable ahora."}]}]);

            const apiKey = getApiKey();
            if (!apiKey) {
                throw new Error("MISSING_API_KEY");
            }
            const ai = new GoogleGenAI({ apiKey });
            
            inputAudioContextRef.current = new (window.AudioContext || (window as WindowWithAudioContext).webkitAudioContext)({ sampleRate: 16000 });
            const outputAudioContext = getOutputAudioContext();
            let nextStartTime = 0;
            const sources = new Set<AudioBufferSourceNode>();

            sessionPromiseRef.current = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-12-2025',
                callbacks: {
                    onopen: () => {
                        const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
                        const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
                        audioProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromiseRef.current?.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current!.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall && message.toolCall.functionCalls) {
                            for (const fc of message.toolCall.functionCalls) {
                                let success = true;
                                let resultMessage = '';
                    
                                try {
                                    console.log(`Live API executing function: ${fc.name}`, fc.args);
                                    switch (fc.name) {
                                        case 'addReservation':
                                            props.onAddReservation(fc.args);
                                            resultMessage = "Reserva añadida con éxito.";
                                            break;
                                        case 'addExpense':
                                            props.onAddExpense(fc.args);
                                            resultMessage = "Gasto procesado y stock actualizado.";
                                            break;
                                        case 'addSale':
                                            props.onAddSale(fc.args);
                                            resultMessage = "Venta registrada.";
                                            break;
                                        case 'clockIn':
                                            // FIX: Cast fc.args.employeeName to string to satisfy the onClockIn prop type.
                                            props.onClockIn(fc.args.employeeName as string);
                                            resultMessage = `Fichaje de entrada para ${fc.args.employeeName} registrado.`;
                                            break;
                                        case 'clockOut':
                                            // FIX: Cast fc.args.employeeName to string to satisfy the onClockOut prop type.
                                            props.onClockOut(fc.args.employeeName as string);
                                            resultMessage = `Fichaje de salida para ${fc.args.employeeName} registrado.`;
                                            break;
                                        case 'performCashClosing':
                                            // FIX: Cast fc.args to the expected object shape { countedAmount: number } to satisfy the prop type.
                                            resultMessage = props.onPerformCashClosing(fc.args as { countedAmount: number });
                                            break;
                                        case 'addOrder':
                                            props.onAddOrder(fc.args as { table: string; items: { name: string; quantity: number; }[]; });
                                            resultMessage = "Pedido registrado correctamente.";
                                            break;
                                        case 'updateOrderStatus':
                                            props.onUpdateOrderStatus(fc.args.orderId as string, fc.args.status as OrderStatus, fc.args.assignedCookId as string);
                                            resultMessage = "Estado del pedido actualizado.";
                                            break;
                                        case 'updateStock':
                                            const stockItemsArgs = fc.args.items as { productName: string; quantity: number; stockType: 'drinkStock' | 'kitchenStock'; unitPrice?: number; family?: string; }[];
                                            props.onUpdateStock(stockItemsArgs);
                                            resultMessage = "Stock actualizado correctamente.";
                                            break;
                                        default:
                                            console.warn(`Live API: Función desconocida: ${fc.name}`);
                                            resultMessage = `Función desconocida: ${fc.name}`;
                                            success = false;
                                    }
                                } catch (e) {
                                    console.error(`Live API: Error ejecutando función ${fc.name}:`, e);
                                    resultMessage = e instanceof Error ? e.message : String(e);
                                    success = false;
                                }
                                
                                const result = { success, message: resultMessage };
                    
                                sessionPromiseRef.current?.then((session) => {
                                    session.sendToolResponse({
                                        functionResponses: {
                                            id: fc.id,
                                            name: fc.name,
                                            response: { result: result },
                                        }
                                    });
                                });
                            }
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio) {
                            nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputAudioContext, 24000, 1);
                            const source = outputAudioContext.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputAudioContext.destination);
                            source.addEventListener('ended', () => sources.delete(source));
                            source.start(nextStartTime);
                            nextStartTime += audioBuffer.duration;
                            sources.add(source);
                        }
                        if (message.serverContent?.interrupted) {
                            for (const source of sources.values()) {
                                source.stop();
                                sources.delete(source);
                            }
                            nextStartTime = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setError("Error en la sesión de voz. Inténtelo de nuevo.");
                        stopLiveSession();
                    },
                    onclose: (_e: CloseEvent) => {
                        stopLiveSession(false); // Don't try to close the session again
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    systemInstruction: GEMINI_ADVISOR_PROMPT,
                    tools: [{functionDeclarations: ALL_TOOLS}]
                },
            });

        } catch (err) {
            console.error("Error starting live session:", err);
            setError("No se pudo acceder al micrófono. Por favor, compruebe los permisos.");
            setIsLiveSessionActive(false);
        }
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