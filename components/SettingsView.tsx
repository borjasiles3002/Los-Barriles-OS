
import React, { useState, useEffect } from 'react';
import useLocalStorage from '../useLocalStorage';
import { checkAndOpenKeySelector, hasAistudio } from '../utils/aistudio';
import { testConnection } from '../services/geminiService';
import { KeyIcon, SaveIcon, TrashIcon, ExternalLinkIcon, MoonIcon, SunIcon, BackIcon, SparkIcon } from './icons';

interface SettingsViewProps {
    theme: 'dark' | 'light';
    setTheme: (theme: 'dark' | 'light') => void;
    onBack: () => void;
    onResetData?: () => void;
    userRole?: string;
}

const SettingsView: React.FC<SettingsViewProps> = ({ theme, setTheme, onBack, onResetData, userRole }) => {
    const [userApiKey, setUserApiKey] = useLocalStorage<string>('user_api_key', '');
    const [tempKey, setTempKey] = useState(userApiKey);
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [resetStatus, setResetStatus] = useState<'idle' | 'resetting' | 'done'>('idle');

    const handleReset = async () => {
        if (!onResetData) return;
        if (window.confirm('¿ESTÁS SEGURO? Esta acción borrará permanentemente todo el historial de ventas, gastos, facturas, cierres y mensajes para empezar de cero el trimestre. Los empleados y el stock base se mantendrán.')) {
            setResetStatus('resetting');
            try {
                await onResetData();
                setResetStatus('done');
                setTimeout(() => setResetStatus('idle'), 3000);
            } catch (err) {
                console.error("Error resetting data:", err);
                setResetStatus('idle');
                alert("Hubo un error al reiniciar los datos.");
            }
        }
    };

    const handleTest = async () => {
        setTestStatus('testing');
        const success = await testConnection();
        setTestStatus(success ? 'success' : 'error');
        setTimeout(() => setTestStatus('idle'), 3000);
    };

    useEffect(() => {
        setTempKey(userApiKey);
    }, [userApiKey]);

    const handleSave = () => {
        setSaveStatus('saving');
        setUserApiKey(tempKey);
        setTimeout(() => {
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
        }, 500);
    };

    const handleClear = () => {
        if (window.confirm('¿Estás seguro de que quieres borrar la clave de API guardada localmente?')) {
            setUserApiKey('');
            setTempKey('');
        }
    };

    const handleOpenSelector = async () => {
        try {
            await checkAndOpenKeySelector();
        } catch (err) {
            console.error("Error opening key selector:", err);
            alert("No se pudo abrir el selector de claves de AI Studio. Por favor, asegúrate de estar en el entorno de AI Studio.");
        }
    };

    const isDark = theme === 'dark';

    return (
        <div className="max-w-2xl mx-auto space-y-6 p-4 animate-fade-in">
            {/* Header with Back Button */}
            <div className="flex items-center justify-between mb-2">
                <button 
                    onClick={onBack}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm border border-gray-200'}`}
                >
                    <BackIcon />
                    <span className="font-medium">Volver</span>
                </button>
            </div>

            {/* Theme Settings */}
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-md'} rounded-2xl p-6 border transition-colors`}>
                <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'} rounded-lg`}>
                        {isDark ? <MoonIcon className="w-6 h-6 text-purple-400" /> : <SunIcon className="w-6 h-6 text-purple-600" />}
                    </div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Apariencia</h2>
                </div>

                <div className="flex items-center justify-between p-4 rounded-xl bg-opacity-50 bg-black/5 border border-black/5">
                    <div>
                        <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Modo de Color</p>
                        <p className="text-xs text-gray-500">Cambia entre tema oscuro y claro</p>
                    </div>
                    <div className="flex bg-gray-900/10 p-1 rounded-xl border border-black/5">
                        <button 
                            onClick={() => setTheme('light')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            <SunIcon className="w-4 h-4" />
                            <span className="text-sm font-bold">Claro</span>
                        </button>
                        <button 
                            onClick={() => setTheme('dark')}
                            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-gray-800 text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <MoonIcon className="w-4 h-4" />
                            <span className="text-sm font-bold">Oscuro</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* API Settings */}
            <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-md'} rounded-2xl p-6 border transition-colors`}>
                <div className="flex items-center gap-3 mb-6">
                    <div className={`p-2 ${isDark ? 'bg-blue-600/20' : 'bg-blue-100'} rounded-lg`}>
                        <KeyIcon className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
                    </div>
                    <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Inteligencia Artificial</h2>
                </div>

                <div className="space-y-6">
                    <section className="space-y-4">
                        <p className={`text-sm leading-relaxed ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                            Configura tu clave de API de Gemini para habilitar las funciones de IA en móviles y otros navegadores.
                        </p>

                        <div className="space-y-3">
                            <div className="relative">
                                <input
                                    type="password"
                                    value={tempKey}
                                    onChange={(e) => setTempKey(e.target.value)}
                                    placeholder="Introduce tu clave de API (AIza...)"
                                    className={`w-full border rounded-xl px-4 py-3 transition-all ${isDark ? 'bg-gray-900 border-gray-700 text-white placeholder-gray-500 focus:ring-blue-500' : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-400 focus:ring-blue-500'}`}
                                />
                            </div>
                            
                            <div className="flex flex-wrap gap-3">
                                <button
                                    onClick={handleSave}
                                    disabled={saveStatus === 'saving'}
                                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-bold rounded-xl transition-all shadow-lg"
                                >
                                    <SaveIcon className="w-4 h-4" />
                                    {saveStatus === 'saved' ? '¡Guardado!' : saveStatus === 'saving' ? 'Guardando...' : 'Guardar Clave'}
                                </button>
                                
                                {userApiKey && (
                                    <div className="flex flex-col gap-2">
                                        <button
                                            onClick={handleTest}
                                            disabled={testStatus === 'testing'}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${
                                                testStatus === 'success' ? 'bg-green-900/20 border-green-500 text-green-400' :
                                                testStatus === 'error' ? 'bg-red-900/20 border-red-500 text-red-400' :
                                                isDark ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'
                                            }`}
                                        >
                                            <SparkIcon className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
                                            {testStatus === 'testing' ? 'Probando...' : testStatus === 'success' ? '¡Conexión OK!' : testStatus === 'error' ? 'Error de Conexión' : 'Probar Conexión'}
                                        </button>
                                        <button
                                            onClick={handleClear}
                                            className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${isDark ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-red-900/40 hover:text-red-400 hover:border-red-900/50' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200'}`}
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                            Borrar Clave
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className={`pt-4 border-t mt-6 ${isDark ? 'border-gray-700' : 'border-gray-100'}`}>
                            <h4 className={`text-sm font-bold mb-3 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Otras opciones:</h4>
                            <div className="flex flex-col gap-3">
                                {hasAistudio() && (
                                    <button
                                        onClick={handleOpenSelector}
                                        className={`flex items-center justify-between w-full p-4 rounded-xl text-left transition-all group border ${isDark ? 'bg-gray-900/50 hover:bg-gray-900 border-gray-700' : 'bg-gray-50 hover:bg-white border-gray-200'}`}
                                    >
                                        <div>
                                            <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Usar Selector de AI Studio</p>
                                            <p className="text-xs text-gray-500">Intenta abrir el diálogo oficial de selección de clave.</p>
                                        </div>
                                        <ExternalLinkIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                                    </button>
                                )}
                                
                                <a 
                                    href="https://aistudio.google.com/app/apikey" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className={`flex items-center justify-between w-full p-4 rounded-xl text-left transition-all group border ${isDark ? 'bg-gray-900/50 hover:bg-gray-900 border-gray-700' : 'bg-gray-50 hover:bg-white border-gray-200'}`}
                                >
                                    <div>
                                        <p className={`text-sm font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Obtener Clave de API Gratis</p>
                                        <p className="text-xs text-gray-500">Crea una clave en Google AI Studio (requiere cuenta de Google).</p>
                                    </div>
                                    <ExternalLinkIcon className="w-5 h-5 text-gray-600 group-hover:text-blue-400 transition-colors" />
                                </a>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <div className={`rounded-2xl p-6 border transition-colors ${isDark ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-50 border-blue-100'}`}>
                <h3 className={`font-bold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Nota sobre Privacidad</h3>
                <p className={`text-sm leading-relaxed ${isDark ? 'text-blue-200/70' : 'text-blue-600/80'}`}>
                    Tu clave de API se almacena únicamente en tu dispositivo (localStorage). No se envía a ningún servidor externo excepto directamente a la API de Google Gemini para procesar tus solicitudes.
                </p>
            </div>

            {userRole === 'manager' && (
                <div className={`${isDark ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'} rounded-2xl p-6 border transition-colors`}>
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 ${isDark ? 'bg-red-600/20' : 'bg-red-100'} rounded-lg`}>
                            <TrashIcon className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
                        </div>
                        <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Zona de Peligro</h2>
                    </div>
                    
                    <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Reinicia el sistema para el nuevo trimestre. Se borrarán ventas, gastos, facturas, cierres y mensajes. Los empleados y el stock base no se verán afectados.
                    </p>

                    <button
                        onClick={handleReset}
                        disabled={resetStatus === 'resetting'}
                        className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-lg ${
                            resetStatus === 'done' ? 'bg-green-600 text-white' :
                            resetStatus === 'resetting' ? 'bg-gray-600 text-white cursor-not-allowed' :
                            'bg-red-600 hover:bg-red-700 text-white'
                        }`}
                    >
                        <TrashIcon className="w-5 h-5" />
                        {resetStatus === 'done' ? '¡DATOS REINICIADOS!' : resetStatus === 'resetting' ? 'REINICIANDO...' : 'REINICIAR DATOS PARA TRIMESTRE'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default SettingsView;
