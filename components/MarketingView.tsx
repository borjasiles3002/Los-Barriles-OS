
import React, { useState, useEffect } from 'react';
import { generateImage, getApiKey } from '../services/geminiService';
import { ImageSize, AspectRatio } from '../types';
import { LoadingSpinner, SparkIcon } from './icons';
import useLocalStorage from '../useLocalStorage';
import { hasAistudio } from '../utils/aistudio';

declare global {
    interface AIStudio {
        hasSelectedApiKey: () => Promise<boolean>;
        openSelectKey: () => Promise<void>;
    }
    interface Window {
        aistudio?: AIStudio;
    }
}

interface MarketingViewProps {
    onNavigate: (view: string) => void;
}

const MarketingView: React.FC<MarketingViewProps> = ({ onNavigate }) => {
    const [prompt, setPrompt] = useState('');
    const [imageSize, setImageSize] = useState<ImageSize>('1K');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
    const [generatedImage, setGeneratedImage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiKeyReady, setApiKeyReady] = useLocalStorage('marketingApiKeyReady', false);

    useEffect(() => {
        const checkApiKey = async () => {
            // Check if a key is already in localStorage (manual entry)
            if (getApiKey()) {
                setApiKeyReady(true);
                return;
            }
            
            // If in AI Studio, check if a key is selected
            if (window.aistudio && await window.aistudio.hasSelectedApiKey()) {
                setApiKeyReady(true);
            }
        };
        checkApiKey();
    }, [setApiKeyReady]);

    const aspectRatios: AspectRatio[] = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    
    const handleSelectKey = async () => {
        if (!window.aistudio) {
            setError("La funcionalidad de AI Studio no está disponible.");
            return;
        }
        try {
            await window.aistudio.openSelectKey();
            // Optimistically set the key as ready. The API call will validate it.
            setApiKeyReady(true);
        } catch (e) {
            console.error("Could not open select key dialog:", e);
            setError("No se pudo abrir el diálogo para seleccionar la clave de API.");
        }
    };
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!prompt.trim()) {
            setError('Por favor, introduzca una descripción para la imagen.');
            return;
        }
        setIsLoading(true);
        setError(null);
        setGeneratedImage(null);
        
        try {
            const base64Data = await generateImage(prompt, imageSize, aspectRatio);
            setGeneratedImage(`data:image/png;base64,${base64Data}`);
        } catch (err) {
            const error = err as Error;
            const isMissingKey = error.message.includes("ERROR_CLAVE_API") || error.message.includes("403") || error.message.includes("PERMISSION_DENIED") || error.message.includes("API key") || error.message.includes('Requested entity was not found');
            const errorMessage = error.message.includes("ERROR_CLAVE_API") 
                ? error.message 
                : (isMissingKey 
                    ? "ERROR_CLAVE_API: La clave de API no es válida o no tiene acceso a este modelo. Por favor, seleccione una nueva clave."
                    : (`Error al generar la imagen: ${error.message}`));
            
            setError(errorMessage);
            if (isMissingKey) {
                setApiKeyReady(false); // Reset state to re-trigger key selection
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    if (!apiKeyReady) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-2xl mx-auto p-4">
                <SparkIcon />
                <h2 className="text-2xl font-bold text-white mt-4">Acceso a Modelos Avanzados</h2>
                <p className="text-gray-400 mt-2">
                    Para utilizar la generación de imágenes de alta calidad, necesita seleccionar una clave de API de un proyecto de Google Cloud con la facturación habilitada.
                </p>
                <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline mt-2 text-sm">
                    Más información sobre la facturación.
                </a>
                
                {hasAistudio() ? (
                    <button 
                        onClick={handleSelectKey}
                        className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg"
                    >
                        Seleccionar Clave de API
                    </button>
                ) : (
                    <div className="mt-6 p-4 bg-gray-800 border border-gray-700 rounded-xl">
                        <p className="text-sm text-gray-300 mb-4">
                            Parece que estás en un dispositivo móvil o fuera del entorno de AI Studio.
                        </p>
                        <p className="text-xs text-gray-400 mb-4">
                            Por favor, configura tu clave de API manualmente en la sección de <strong>Ajustes (⚙️)</strong> para habilitar esta función.
                        </p>
                        <button 
                            onClick={() => onNavigate('settings')}
                            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg border border-gray-600 transition-colors"
                        >
                            Ir a Ajustes
                        </button>
                    </div>
                )}
                
                 {error && <p className="text-red-400 text-sm mt-4">{error}</p>}
            </div>
        );
    }

    return (
        <div className="w-full max-w-4xl mx-auto space-y-6">
            <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                     <div>
                        <label htmlFor="prompt" className="block text-sm font-medium text-gray-400 mb-2">Descripción de la Imagen</label>
                        <textarea
                            id="prompt"
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Ej: Un plato de paella de marisco al vapor sobre una mesa de madera rústica, con el mar de fondo."
                            className="w-full bg-gray-700 text-gray-200 placeholder-gray-500 resize-y border border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 p-2 min-h-[100px]"
                            rows={4}
                            disabled={isLoading}
                        />
                    </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">Resolución</label>
                            <div className="flex gap-4">
                                {(['1K', '2K', '4K'] as ImageSize[]).map(size => (
                                    <label key={size} className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="radio" 
                                            name="imageSize" 
                                            value={size} 
                                            checked={imageSize === size}
                                            onChange={() => setImageSize(size)}
                                            className="form-radio h-4 w-4 text-blue-600 bg-gray-700 border-gray-600 focus:ring-blue-500"
                                            disabled={isLoading}
                                        />
                                        <span className="text-gray-300">{size}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                        <div>
                           <label htmlFor="aspectRatio" className="block text-sm font-medium text-gray-400 mb-2">Relación de Aspecto</label>
                            <select
                                id="aspectRatio"
                                value={aspectRatio}
                                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                                className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                                disabled={isLoading}
                            >
                                {aspectRatios.map(ratio => (
                                    <option key={ratio} value={ratio}>{ratio}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <button type="submit" disabled={isLoading} className="w-full inline-flex justify-center items-center py-3 px-6 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-500">
                        {isLoading ? <LoadingSpinner /> : 'Generar Imagen'}
                    </button>
                </form>
            </div>
            {error && (
                <div className="text-center mt-4">
                    <p className="text-red-400 text-sm mb-2">{error}</p>
                    {error.includes("ERROR_CLAVE_API") && (
                        <div className="flex flex-col items-center gap-2">
                            <button 
                                onClick={handleSelectKey}
                                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1 px-3 rounded transition-colors"
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

            {isLoading && (
                 <div className="flex flex-col items-center justify-center h-64 text-center bg-gray-800 rounded-lg">
                    <LoadingSpinner />
                    <p className="mt-4 text-gray-400">Generando imagen... Esto puede tardar unos segundos.</p>
                </div>
            )}

            {generatedImage && (
                 <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                     <h3 className="text-xl font-bold text-white mb-4 text-center">Resultado</h3>
                     <img src={generatedImage} alt="Generated content" className="rounded-lg mx-auto max-w-full h-auto" />
                 </div>
            )}
        </div>
    );
};

export default MarketingView;
