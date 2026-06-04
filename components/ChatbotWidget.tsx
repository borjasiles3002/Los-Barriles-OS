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
