
import React, { useState } from 'react';
import { Employee } from '../types';

interface LoginViewProps {
  employees: Employee[];
  onLogin: (id: string) => void;
  onGoogleLogin: () => void;
  theme: 'dark' | 'light';
}

const LoginView: React.FC<LoginViewProps> = ({ employees, onLogin, onGoogleLogin, theme }) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleEmpClick = (id: string) => {
    setSelectedEmpId(id);
    setPin('');
    setError(false);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin === '1234' || pin === '0000') {
      if (selectedEmpId) onLogin(selectedEmpId);
    } else {
      setError(true);
      setPin('');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
      <div className={`w-full max-w-md p-8 rounded-2xl shadow-2xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200'}`}>
        <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
          {selectedEmpId ? 'Introduce tu PIN' : 'Acceso Los Barriles OS'}
        </h2>

        {!selectedEmpId ? (
          <>
            <button
              onClick={onGoogleLogin}
              className={`w-full mb-8 p-4 rounded-xl flex items-center justify-center gap-3 transition-all font-bold ${
                theme === 'dark'
                  ? 'bg-white text-gray-900 hover:bg-gray-100'
                  : 'bg-gray-900 text-white hover:bg-gray-800'
              }`}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Acceder con Google (Gerente)
            </button>

            <div className="relative mb-8">
              <div className="absolute inset-0 flex items-center">
                <div className={`w-full border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className={`px-2 ${theme === 'dark' ? 'bg-gray-800 text-gray-500' : 'bg-white text-gray-400'}`}>O selecciona tu perfil</span>
              </div>
            </div>
            
            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
              {employees.map(emp => (
                <button
                  key={emp.id}
                  onClick={() => handleEmpClick(emp.id)}
                  className={`w-full p-4 rounded-xl flex items-center justify-between transition-all group ${
                    theme === 'dark' 
                      ? 'bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-blue-500' 
                      : 'bg-gray-50 hover:bg-gray-100 border border-gray-200 hover:border-blue-400'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${
                      emp.role === 'manager' ? 'bg-blue-600 text-white' : 'bg-emerald-600 text-white'
                    }`}>
                      {emp.name.charAt(0)}
                    </div>
                    <div className="text-left">
                      <p className="font-bold">{emp.name}</p>
                      <p className={`text-xs uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
                        {emp.role === 'manager' ? 'Gerente' : 'Empleado'}
                      </p>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          <form onSubmit={handlePinSubmit} className="flex flex-col items-center animate-fade-in">
            <p className={`mb-6 text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>Por defecto: 1234 o 0000</p>
            <input 
              type="password" 
              maxLength={4}
              autoFocus
              className={`w-full text-center text-4xl p-4 tracking-[1em] rounded-xl font-mono mb-4 border ${
                error ? 'border-red-500 bg-red-500/10' : (theme === 'dark' ? 'bg-gray-900 border-gray-600 text-white' : 'bg-gray-50 border-gray-300 text-gray-900')
              }`}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/[^0-9]/g, ''));
                setError(false);
              }}
            />
            {error && <p className="text-red-500 text-sm mb-4 font-bold">PIN incorrecto</p>}
            
            <div className="grid grid-cols-2 gap-4 w-full">
              <button 
                type="button" 
                onClick={() => setSelectedEmpId(null)}
                className={`py-3 rounded-xl font-bold transition-colors ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-800'}`}
              >
                Volver
              </button>
              <button 
                type="submit" 
                className="py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors"
              >
                Entrar
              </button>
            </div>
          </form>
        )}
        
        <p className={`mt-8 text-center text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          Sistema Operativo Central v2.0
        </p>
      </div>
    </div>
  );
};

export default LoginView;
