
import React, { useState, useMemo } from 'react';
import { Reservation, ChatMessage } from '../types';
import { LoadingSpinner, XIcon, SparkIcon } from './icons';
import { callGemini } from '../services/geminiService';
import { GEMINI_ADVISOR_PROMPT } from '../constants';
import ChatDisplay from './ChatDisplay';

interface ReservasViewProps {
  reservations: Reservation[];
  onAdd: (res: Omit<Reservation, 'id'>) => void;
  onUpdate: (res: Reservation) => void;
  onDelete: (id: string) => void;
}

type Tab = 'hacer' | 'agenda' | 'calendario';

const ReservationModal: React.FC<{
  reservation: Reservation;
  onClose: () => void;
  onSave: (updatedReservation: Reservation) => void;
  onDelete: (id: string) => void;
}> = ({ reservation, onClose, onSave, onDelete }) => {
  const [formState, setFormState] = useState<Reservation>(reservation);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState(prev => ({
      ...prev,
      [name]: name === 'personas' ? parseInt(value, 10) : value
    }));
  };

  const handleSave = () => {
    onSave(formState);
    onClose();
  };

  const handleDelete = () => {
    if(window.confirm(`¿Seguro que desea eliminar la reserva de ${reservation.nombre}?`)) {
      onDelete(reservation.id);
      onClose();
    }
  };
  
  const formatDateForInput = (isoString: string): string => {
      const date = new Date(isoString);
      if (isNaN(date.getTime())) return '';
      // Adjust for timezone offset to display correctly in datetime-local input
      const tzoffset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
      return localISOTime;
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h4 className="text-xl font-bold text-white">Editar Reserva</h4>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
        </div>
        <div className="space-y-4">
            <div>
              <label htmlFor="nombre-modal" className="block text-sm font-medium text-gray-400">Nombre</label>
              <input type="text" id="nombre-modal" name="nombre" value={formState.nombre} onChange={handleInputChange} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="fecha-modal" className="block text-sm font-medium text-gray-400">Fecha y Hora</label>
              <input type="datetime-local" id="fecha-modal" name="fecha" value={formatDateForInput(formState.fecha)} onChange={handleInputChange} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
            <div>
              <label htmlFor="personas-modal" className="block text-sm font-medium text-gray-400">Personas</label>
              <input type="number" id="personas-modal" name="personas" value={formState.personas} onChange={handleInputChange} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" />
            </div>
             <div>
              <label htmlFor="notas-modal" className="block text-sm font-medium text-gray-400">Notas</label>
              <textarea id="notas-modal" name="notas" value={formState.notas} onChange={handleInputChange} rows={3} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500"></textarea>
            </div>
            <div>
              <label htmlFor="status-modal" className="block text-sm font-medium text-gray-400">Estado</label>
              <select id="status-modal" name="status" value={formState.status || 'confirmada'} onChange={(e) => setFormState(prev => ({...prev, status: e.target.value as Reservation['status']}))} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500">
                  <option value="pendiente">Pendiente (Web)</option>
                  <option value="confirmada">Confirmada</option>
                  <option value="rechazada">Rechazada</option>
                  <option value="completada">Completada</option>
              </select>
            </div>
        </div>
         <div className="mt-6 flex justify-between">
            <button onClick={handleDelete} className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors">Eliminar</button>
            <div>
                <button onClick={onClose} className="mr-2 px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">Cancelar</button>
                <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">Guardar Cambios</button>
            </div>
        </div>
      </div>
    </div>
  );
};

const AIAdviceModal: React.FC<{ isOpen: boolean; onClose: () => void; advice: ChatMessage[] | null; isLoading: boolean; title: string; }> = ({ isOpen, onClose, advice, isLoading, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl animate-fade-in flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-white flex items-center gap-2"><SparkIcon className="h-6 w-6 text-cyan-400" /> {title}</h4>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {isLoading && <div className="flex justify-center items-center h-32"><LoadingSpinner /></div>}
                    {advice && <ChatDisplay chatHistory={advice} />}
                </div>
            </div>
        </div>
    );
};


const ReservasView: React.FC<ReservasViewProps> = ({ reservations, onAdd, onUpdate, onDelete }) => {
    const [activeTab, setActiveTab] = useState<Tab>('calendario');
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [isAdviceModalOpen, setAdviceModalOpen] = useState(false);
    const [advice, setAdvice] = useState<ChatMessage[] | null>(null);
    const [isAdviceLoading, setAdviceLoading] = useState(false);
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [agendaFilterDate, setAgendaFilterDate] = useState<Date | null>(null);

    React.useEffect(() => {
        if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }
    }, []);

    const [nombre, setNombre] = useState('');
    const [fecha, setFecha] = useState('');
    const [personas, setPersonas] = useState(2);
    const [notas, setNotas] = useState('');
    const [error, setError] = useState<string | null>(null);

    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!nombre || !fecha || personas <= 0) {
            setError("Por favor, rellene todos los campos obligatorios.");
            return;
        }

        onAdd({ nombre, fecha, personas, notas });
        setNombre(''); setFecha(''); setPersonas(2); setNotas('');
        setAgendaFilterDate(null);
        setActiveTab('agenda');
    };
    
    const handleDelete = (id: string) => {
        onDelete(id);
        if (selectedReservation?.id === id) {
            setSelectedReservation(null);
        }
    };
    
    const handleUpdate = (updatedReservation: Reservation) => {
        onUpdate(updatedReservation);
        setSelectedReservation(null);
    };

    const groupedReservations = useMemo(() => {
        const groups: { [key: string]: Reservation[] } = {};
        const now = new Date();
        now.setHours(0,0,0,0); 

        reservations
            .filter(res => {
                if (agendaFilterDate) {
                    return new Date(res.fecha).toDateString() === agendaFilterDate.toDateString();
                }
                return new Date(res.fecha) >= now;
            }) 
            .forEach(res => {
                const dateKey = new Date(res.fecha).toLocaleDateString('es-ES', {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
                if (!groups[dateKey]) {
                    groups[dateKey] = [];
                }
                groups[dateKey].push(res);
            });
        
        for (const key in groups) {
            groups[key].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
        }

        return Object.entries(groups);
    }, [reservations]);

    const handleGetAdvice = async () => {
        setAdviceModalOpen(true);
        setAdviceLoading(true);
        setAdvice(null);
        
        const todayKey = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const todayReservations = groupedReservations.find(([date]) => date === todayKey)?.[1] || [];

        if(todayReservations.length === 0) {
            const noReservationsAdvice: ChatMessage[] = [{ role: 'model', parts: [{ text: "No hay reservas para hoy. Es un buen día para enfocarse en la preparación (mise en place), limpieza profunda o formación del personal." }] }];
            setAdvice(noReservationsAdvice);
            setAdviceLoading(false);
            return;
        }

        const formattedReservations = todayReservations.map(r => `- ${new Date(r.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}: ${r.nombre} (${r.personas} pax)`).join('\n');
        const prompt = `Contexto: Estas son las reservas para hoy:\n${formattedReservations}\n\nTarea: Dame un resumen operativo. Identifica posibles cuellos de botella y ofrece 2 consejos prácticos para que el servicio de hoy sea fluido.`;
        
        const userMessage: ChatMessage = { role: 'user', parts: [{ text: prompt }] };
        setAdvice([userMessage]);

        try {
            const response = await callGemini([userMessage], GEMINI_ADVISOR_PROMPT, {}, 'gemini-2.0-flash');
            const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response.text }] };
            setAdvice(prev => prev ? [...prev, modelMessage] : [modelMessage]);
        } catch (e) {
            const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
            const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `Error al obtener consejo: ${errorMsg}` }] };
            setAdvice(prev => prev ? [...prev, errorMessage] : [errorMessage]);
        } finally {
            setAdviceLoading(false);
        }
    };

    const getDaysInMonth = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        
        // Adjust for Monday as first day of week (0 = Monday, 6 = Sunday)
        const startingDay = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;
        
        const days = [];
        for (let i = 0; i < startingDay; i++) {
            days.push(null);
        }
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(new Date(year, month, i));
        }
        return days;
    };

    const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
    const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));

    const TabButton: React.FC<{ tab: Tab; label: string }> = ({ tab, label }) => (
        <button
          onClick={() => setActiveTab(tab)}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors w-full ${
            activeTab === tab ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {label}
        </button>
    );

    return (
        <div className="w-full max-w-4xl mx-auto">
            {selectedReservation && <ReservationModal reservation={selectedReservation} onClose={() => setSelectedReservation(null)} onSave={handleUpdate} onDelete={handleDelete}/>}
            <AIAdviceModal isOpen={isAdviceModalOpen} onClose={() => setAdviceModalOpen(false)} advice={advice} isLoading={isAdviceLoading} title="Consejo Operativo del Día" />

            <div className="flex space-x-2 p-1 bg-gray-800 rounded-lg mb-6 max-w-md mx-auto">
                <TabButton tab="calendario" label="Calendario" />
                <TabButton tab="agenda" label="Agenda" />
                <TabButton tab="hacer" label="Hacer Reserva" />
            </div>

            {activeTab === 'calendario' && (
                <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                    <div className="flex justify-between items-center mb-6">
                        <button onClick={prevMonth} className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-white">&larr;</button>
                        <h2 className="text-xl font-bold text-white capitalize">
                            {currentMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={nextMonth} className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600 text-white">&rarr;</button>
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2 mb-2 text-center">
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(day => (
                            <div key={day} className="text-gray-400 font-bold text-sm">{day}</div>
                        ))}
                    </div>
                    
                    <div className="grid grid-cols-7 gap-2">
                        {getDaysInMonth(currentMonth).map((date, i) => {
                            if (!date) return <div key={`empty-${i}`} className="h-24 bg-gray-800/50 rounded-lg border border-gray-700/50"></div>;
                            
                            const isToday = date.toDateString() === new Date().toDateString();
                            const dayReservations = reservations.filter(r => new Date(r.fecha).toDateString() === date.toDateString());
                            
                            return (
                                <div 
                                    key={date.toISOString()} 
                                    onClick={() => {
                                        setAgendaFilterDate(date);
                                        setActiveTab('agenda');
                                    }}
                                    className={`h-24 rounded-lg border p-1 flex flex-col ${isToday ? 'bg-blue-900/20 border-blue-500' : 'bg-gray-700/30 border-gray-600'} hover:bg-gray-700 transition-colors overflow-hidden cursor-pointer`}
                                >
                                    <div className={`text-right text-sm font-bold ${isToday ? 'text-blue-400' : 'text-gray-300'}`}>
                                        {date.getDate()}
                                    </div>
                                    <div className="flex-1 overflow-y-auto mt-1 space-y-1 no-scrollbar">
                                        {dayReservations.map(res => (
                                            <div 
                                                key={res.id} 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedReservation(res);
                                                }}
                                                className={`text-xs text-white px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80 ${res.status === 'pendiente' ? 'bg-orange-500 animate-pulse' : res.status === 'rechazada' ? 'bg-red-800' : res.status === 'completada' ? 'bg-gray-600' : 'bg-blue-600/80'}`}
                                            >
                                                {new Date(res.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} {res.nombre}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {activeTab === 'agenda' && (
                <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white">
                                {agendaFilterDate ? 'Reservas del Día' : 'Próximas Reservas'}
                            </h2>
                            {agendaFilterDate && (
                                <button 
                                    onClick={() => setAgendaFilterDate(null)}
                                    className="text-sm bg-gray-700 hover:bg-gray-600 text-white px-3 py-1 rounded-full transition-colors"
                                >
                                    Ver todas
                                </button>
                            )}
                        </div>
                         <button onClick={handleGetAdvice} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                            <SparkIcon className="h-5 w-5 mb-0" />
                            Obtener Consejo Operativo
                        </button>
                    </div>
                     {groupedReservations.length > 0 ? (
                        <div className="space-y-6 max-h-[calc(100vh-250px)] overflow-y-auto pr-2">
                        {groupedReservations.map(([date, reservationsForDay]) => (
                            <div key={date}>
                                <h3 className="text-lg font-semibold text-blue-300 border-b border-gray-700 pb-2 mb-3 sticky top-0 bg-gray-800">{date}</h3>
                                <ul className="space-y-2">
                                    {reservationsForDay.map(res => (
                                        <li key={res.id} onClick={() => setSelectedReservation(res)} className={`p-3 rounded-md hover:bg-gray-700/80 cursor-pointer transition-colors border-l-4 ${res.status === 'pendiente' ? 'border-orange-500 bg-gray-700/70' : res.status === 'rechazada' ? 'border-red-600 bg-gray-800' : res.status === 'completada' ? 'border-gray-500 bg-gray-800' : 'border-blue-500 bg-gray-700/50'}`}>
                                            <div className="flex justify-between items-start">
                                                <div>
                                                    <p className="font-bold text-white flex items-center gap-2">
                                                        {new Date(res.fecha).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} - {res.nombre}
                                                        {res.status === 'pendiente' && <span className="text-xs bg-orange-500 text-white px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">Nueva</span>}
                                                    </p>
                                                    {res.notas && <p className="text-sm text-gray-400 mt-1 italic">&quot;{res.notas}&quot;</p>}
                                                </div>
                                                <p className="text-gray-300 font-semibold">{res.personas} pax</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                        </div>
                     ) : (
                        <p className="text-center text-gray-500 py-10">No hay reservas próximas.</p>
                     )}
                </div>
            )}
            
            {activeTab === 'hacer' && (
                <div className="space-y-6">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                        <h2 className="text-2xl font-bold text-white mb-4">Nueva Reserva (Interna)</h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label htmlFor="nombre" className="block text-sm font-medium text-gray-400">Nombre</label>
                                <input type="text" id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500"/>
                            </div>
                            <div>
                                <label htmlFor="fecha" className="block text-sm font-medium text-gray-400">Fecha y Hora</label>
                                <input type="datetime-local" id="fecha" value={fecha} onChange={e => setFecha(e.target.value)} required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500"/>
                            </div>
                            <div>
                                <label htmlFor="personas" className="block text-sm font-medium text-gray-400">Número de Personas</label>
                                <input type="number" id="personas" value={personas} onChange={e => setPersonas(parseInt(e.target.value, 10))} min="1" required className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500"/>
                            </div>
                            <div>
                                <label htmlFor="notas" className="block text-sm font-medium text-gray-400">Notas (opcional)</label>
                                <textarea id="notas" value={notas} onChange={e => setNotas(e.target.value)} rows={3} className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" placeholder="Alergias, carricoche, etc."></textarea>
                            </div>
                            <button type="submit" className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                            Confirmar Reserva
                            </button>
                        </form>
                        {error && <p className="text-red-400 text-center text-sm mt-4">{error}</p>}
                    </div>

                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg text-center">
                        <h3 className="text-lg font-bold text-white mb-2">Portal de Reservas para Clientes</h3>
                        <p className="text-sm text-gray-400 mb-4">Comparte este enlace o tu código QR con tus clientes para que reserven ellos mismos.</p>
                        <a href={`${window.location.origin}${window.location.pathname}?view=public_reservation`} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">
                            {window.location.origin}{window.location.pathname}?view=public_reservation
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReservasView;
