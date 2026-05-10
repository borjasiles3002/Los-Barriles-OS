import React, { useState } from 'react';
import { Reservation } from '../types';

export const PublicReservationView: React.FC<{ onAddReservation: (res: Omit<Reservation, 'id'>) => void }> = ({ onAddReservation }) => {
    const [nombre, setNombre] = useState('');
    const [fecha, setFecha] = useState('');
    const [personas, setPersonas] = useState(2);
    const [notas, setNotas] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onAddReservation({
            nombre,
            fecha,
            personas,
            notas: `[WEB] ${notas}`,
            status: 'pendiente'
        });
        setSubmitted(true);
    };

    if (submitted) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full animate-fade-in text-gray-800">
                    <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                    </div>
                    <h2 className="text-2xl font-bold mb-2">¡Reserva Solicitada!</h2>
                    <p className="text-gray-600 mb-6">Tu solicitud de reserva ha sido enviada con éxito. Nos pondremos en contacto contigo si hay algún inconveniente.</p>
                    <button onClick={() => window.location.reload()} className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition">Hacer otra reserva</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 sm:p-12 mb-10 flex flex-col items-center">
            <header className="text-center space-y-4 mb-10 w-full max-w-xl">
                <h1 className="text-4xl font-black uppercase tracking-widest text-gray-900">Los Barriles</h1>
                <p className="text-gray-500 uppercase tracking-widest text-sm">Reserva tu mesa</p>
                <div className="w-16 h-1 bg-blue-600 mx-auto mt-4"></div>
            </header>

            <main className="w-full max-w-xl bg-white p-8 rounded-2xl shadow-lg border border-gray-100">
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nombre y Apellidos</label>
                        <input type="text" required value={nombre} onChange={e => setNombre(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white text-gray-900" placeholder="Ej: María López" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha y Hora</label>
                            <input type="datetime-local" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white text-gray-900" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Personas</label>
                            <input type="number" min="1" max="20" required value={personas} onChange={e => setPersonas(parseInt(e.target.value))} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow bg-white text-gray-900" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Peticiones o notas especiales</label>
                        <textarea rows={3} value={notas} onChange={e => setNotas(e.target.value)} className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow resize-none bg-white text-gray-900" placeholder="Ej: Trona para bebé, alergia al gluten..."></textarea>
                    </div>
                    
                    <button type="submit" className="w-full py-4 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl shadow-md transition-all transform hover:scale-[1.02]">
                        Solicitar Reserva
                    </button>
                    <p className="text-xs text-center text-gray-400 mt-4">Al solicitar tu reserva aceptas nuestra política de privacidad. Te confirmaremos por teléfono o email.</p>
                </form>
            </main>
        </div>
    );
};
