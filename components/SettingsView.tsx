import React, { useState } from 'react';
import { testConnection } from '../services/geminiService';
import { KeyIcon, TrashIcon, MoonIcon, SunIcon, BackIcon, SparkIcon } from './icons';

interface SettingsViewProps {
  theme: 'dark' | 'light';
  setTheme: (theme: 'dark' | 'light') => void;
  onBack: () => void;
  onResetData?: () => void;
  userRole?: string;
}

const SettingsView: React.FC<SettingsViewProps> = ({ theme, setTheme, onBack, onResetData, userRole }) => {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [resetStatus, setResetStatus] = useState<'idle' | 'resetting' | 'done'>('idle');
  const isDark = theme === 'dark';

  const handleTest = async () => {
    setTestStatus('testing');
    const success = await testConnection();
    setTestStatus(success ? 'success' : 'error');
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  const handleReset = async () => {
    if (!onResetData) return;
    if (window.confirm('Esta accion borrara permanentemente ventas, gastos, facturas, cierres y mensajes.')) {
      setResetStatus('resetting');
      try {
        await onResetData();
        setResetStatus('done');
        setTimeout(() => setResetStatus('idle'), 3000);
      } catch (err) {
        console.error('Error resetting data:', err);
        setResetStatus('idle');
        alert('Hubo un error al reiniciar los datos.');
      }
    }
  };

  const panel = isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200 shadow-md';
  const muted = isDark ? 'text-gray-400' : 'text-gray-600';

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4 animate-fade-in">
      <button
        onClick={onBack}
        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all ${isDark ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm border border-gray-200'}`}
      >
        <BackIcon />
        <span className="font-medium">Volver</span>
      </button>

      <section className={`${panel} rounded-2xl p-6 border transition-colors`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 ${isDark ? 'bg-purple-600/20' : 'bg-purple-100'} rounded-lg`}>
            {isDark ? <MoonIcon className="w-6 h-6 text-purple-400" /> : <SunIcon className="w-6 h-6 text-purple-600" />}
          </div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Apariencia</h2>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-black/5 border border-black/5">
          <div>
            <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>Modo de color</p>
            <p className="text-xs text-gray-500">Cambia entre tema oscuro y claro</p>
          </div>
          <div className="flex bg-gray-900/10 p-1 rounded-xl border border-black/5">
            <button onClick={() => setTheme('light')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${theme === 'light' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              <SunIcon className="w-4 h-4" />
              <span className="text-sm font-bold">Claro</span>
            </button>
            <button onClick={() => setTheme('dark')} className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${theme === 'dark' ? 'bg-gray-800 text-purple-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
              <MoonIcon className="w-4 h-4" />
              <span className="text-sm font-bold">Oscuro</span>
            </button>
          </div>
        </div>
      </section>

      <section className={`${panel} rounded-2xl p-6 border transition-colors`}>
        <div className="flex items-center gap-3 mb-6">
          <div className={`p-2 ${isDark ? 'bg-blue-600/20' : 'bg-blue-100'} rounded-lg`}>
            <KeyIcon className={`w-6 h-6 ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          </div>
          <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Inteligencia Artificial</h2>
        </div>

        <div className={`rounded-xl p-4 border ${isDark ? 'bg-gray-900/50 border-gray-700' : 'bg-gray-50 border-gray-200'}`}>
          <p className={`font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Clave gestionada en servidor</p>
          <p className={`mt-2 text-sm leading-relaxed ${muted}`}>
            Las funciones de IA usan la variable GEMINI_API_KEY configurada en Vercel. La clave ya no se guarda en el navegador ni se envia desde el cliente.
          </p>
          <button
            onClick={handleTest}
            disabled={testStatus === 'testing'}
            className={`mt-4 flex items-center gap-2 px-4 py-2 rounded-xl transition-all border ${
              testStatus === 'success' ? 'bg-green-900/20 border-green-500 text-green-400' :
              testStatus === 'error' ? 'bg-red-900/20 border-red-500 text-red-400' :
              isDark ? 'bg-gray-700 text-gray-300 border-gray-600 hover:bg-gray-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            <SparkIcon className={`w-4 h-4 ${testStatus === 'testing' ? 'animate-spin' : ''}`} />
            {testStatus === 'testing' ? 'Probando...' : testStatus === 'success' ? 'Conexion OK' : testStatus === 'error' ? 'Revisa GEMINI_API_KEY en Vercel' : 'Probar conexion'}
          </button>
        </div>
      </section>

      <section className={`rounded-2xl p-6 border transition-colors ${isDark ? 'bg-blue-900/20 border-blue-800/50' : 'bg-blue-50 border-blue-100'}`}>
        <h3 className={`font-bold mb-2 ${isDark ? 'text-blue-300' : 'text-blue-700'}`}>Nota sobre privacidad</h3>
        <p className={`text-sm leading-relaxed ${isDark ? 'text-blue-200/70' : 'text-blue-600/80'}`}>
          Las solicitudes de IA pasan por la funcion segura de Vercel para proteger la clave de Gemini, aplicar limites basicos y evitar que otros sitios usen tu endpoint desde el navegador.
        </p>
      </section>

      {userRole === 'manager' && (
        <section className={`${isDark ? 'bg-red-900/10 border-red-900/30' : 'bg-red-50 border-red-100'} rounded-2xl p-6 border transition-colors`}>
          <div className="flex items-center gap-3 mb-4">
            <div className={`p-2 ${isDark ? 'bg-red-600/20' : 'bg-red-100'} rounded-lg`}>
              <TrashIcon className={`w-6 h-6 ${isDark ? 'text-red-400' : 'text-red-600'}`} />
            </div>
            <h2 className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>Zona de peligro</h2>
          </div>
          <p className={`text-sm mb-6 ${muted}`}>Reinicia el sistema para el nuevo trimestre. Se borraran ventas, gastos, facturas, cierres y mensajes.</p>
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
            {resetStatus === 'done' ? 'DATOS REINICIADOS' : resetStatus === 'resetting' ? 'REINICIANDO...' : 'REINICIAR DATOS PARA TRIMESTRE'}
          </button>
        </section>
      )}
    </div>
  );
};

export default SettingsView;
