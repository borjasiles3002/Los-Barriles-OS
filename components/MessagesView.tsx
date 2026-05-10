
import React, { useState } from 'react';
import { Message, Employee } from '../types';
import { MessageIcon, UserIcon } from './icons';

interface MessagesViewProps {
  messages: Message[];
  employees: Employee[];
  currentUser: Employee | null;
  onSendMessage: (toId: string, text: string) => void;
  theme: 'dark' | 'light';
}

const MessagesView: React.FC<MessagesViewProps> = ({ 
  messages, 
  employees, 
  currentUser, 
  onSendMessage, 
  theme 
}) => {
  const [selectedRecipient, setSelectedRecipient] = useState<string>('all');
  const [messageText, setMessageText] = useState<string>('');

  const filteredMessages = messages.filter(m => 
    m.toId === 'all' || 
    m.toId === currentUser?.id || 
    m.fromId === currentUser?.id
  );

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;
    onSendMessage(selectedRecipient, messageText);
    setMessageText('');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MessageIcon className="w-5 h-5 text-blue-400" />
          Enviar Mensaje
        </h3>
        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label className={`block text-xs font-bold mb-2 uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Destinatario</label>
            <select
              value={selectedRecipient}
              onChange={(e) => setSelectedRecipient(e.target.value)}
              className={`w-full p-3 rounded-xl border outline-none transition-all ${
                theme === 'dark' ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-gray-50 border-gray-200 focus:border-blue-400 shadow-inner'
              }`}
            >
              <option value="all">Todos los empleados</option>
              {employees.filter(e => e.id !== currentUser?.id).map(emp => (
                <option key={emp.id} value={emp.id}>{emp.name} ({emp.role === 'manager' ? 'Gerente' : 'Empleado'})</option>
              ))}
            </select>
          </div>
          <div>
            <label className={`block text-xs font-bold mb-2 uppercase tracking-wider ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Mensaje</label>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Escribe tu mensaje aquí..."
              className={`w-full p-3 rounded-xl border outline-none transition-all min-h-[100px] ${
                theme === 'dark' ? 'bg-gray-900 border-gray-700 focus:border-blue-500' : 'bg-gray-50 border-gray-200 focus:border-blue-400 shadow-inner'
              }`}
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-lg"
          >
            ENVIAR MENSAJE
          </button>
        </form>
      </div>

      <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-emerald-400" />
          Bandeja de Entrada
        </h3>
        <div className="space-y-4">
          {filteredMessages.length === 0 ? (
            <p className={`text-center py-8 italic ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>No hay mensajes en tu bandeja.</p>
          ) : (
            filteredMessages.map(msg => (
              <div 
                key={msg.id} 
                className={`p-4 rounded-xl border transition-all ${
                  msg.fromId === currentUser?.id 
                    ? (theme === 'dark' ? 'bg-blue-900/10 border-blue-900/30 ml-8' : 'bg-blue-50 border-blue-100 ml-8')
                    : (theme === 'dark' ? 'bg-gray-900 border-gray-700 mr-8' : 'bg-gray-50 border-gray-200 mr-8')
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${msg.fromId === currentUser?.id ? 'text-blue-400' : 'text-emerald-400'}`}>
                      {msg.fromId === currentUser?.id ? 'Tú' : msg.fromName}
                    </span>
                    {msg.toId === 'all' && (
                      <span className="text-[10px] bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded uppercase font-bold">A TODOS</span>
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleString()}</span>
                </div>
                <p className="text-sm leading-relaxed">{msg.text}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MessagesView;
