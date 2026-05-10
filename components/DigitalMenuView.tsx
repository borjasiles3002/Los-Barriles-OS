import React from 'react';
import { Elaboration } from '../types';
import { QRCodeSVG } from 'qrcode.react';

export const PublicMenu: React.FC<{ elaborations: Elaboration[] }> = ({ elaborations }) => {
    // Group active elaborations by category
    const grouped = elaborations.reduce((acc, el) => {
        if (!acc[el.category]) acc[el.category] = [];
        acc[el.category].push(el);
        return acc;
    }, {} as Record<string, Elaboration[]>);

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900 font-sans p-6 sm:p-12 mb-10">
            <div className="max-w-3xl mx-auto space-y-12">
                <header className="text-center space-y-4">
                    <h1 className="text-4xl md:text-6xl font-black uppercase tracking-widest text-gray-900">Los Barriles</h1>
                    <p className="text-gray-500 uppercase tracking-widest text-sm">Menú Digital</p>
                    <div className="w-24 h-1 bg-yellow-500 mx-auto mt-6"></div>
                </header>

                <main className="space-y-16">
                    {Object.entries(grouped).map(([category, items]) => (
                        <section key={category}>
                            <h2 className="text-2xl font-bold uppercase tracking-widest border-b-2 border-gray-200 pb-2 mb-6 text-gray-800">{category}</h2>
                            <div className="space-y-6">
                                {items.map(item => (
                                    <div key={item.id} className="flex justify-between items-baseline group">
                                        <div className="flex-1 border-b border-dotted border-gray-300 mr-4 relative">
                                            <span className="bg-gray-50 pr-2 text-lg font-medium text-gray-900">{item.name}</span>
                                        </div>
                                        <span className="font-bold text-lg text-gray-900">{item.retailPrice > 0 ? `${item.retailPrice.toFixed(2)}€` : 'S/M'}</span>
                                    </div>
                                ))}
                            </div>
                        </section>
                    ))}
                    
                    {elaborations.length === 0 && (
                        <div className="text-center text-gray-500 italic py-12">
                            El menú se está actualizando. Por favor, vuelva más tarde.
                        </div>
                    )}
                </main>
                
                <footer className="text-center pt-12 text-sm text-gray-400">
                    Precios con IVA incluido. Si tiene alguna alergia, consulte al personal.
                </footer>
            </div>
        </div>
    );
};

export const QRGeneratorView: React.FC<{ url: string }> = ({ url }) => {
    return (
        <div className="max-w-2xl mx-auto p-8 bg-gray-800 rounded-xl shadow-xl text-center space-y-8 animate-fade-in">
            <div>
                <h2 className="text-3xl font-bold text-white mb-2">Código QR del Menú</h2>
                <p className="text-gray-400">Imprime este código y colócalo en las mesas. Tus clientes siempre verán la carta actualizada.</p>
            </div>
            
            <div className="bg-white p-8 rounded-2xl inline-block shadow-2xl">
                <QRCodeSVG value={url} size={256} fgColor="#111827" />
            </div>
            
            <div>
                <p className="text-gray-400 text-sm mb-2">Enlace Directo:</p>
                <a href={url} target="_blank" rel="noreferrer" className="text-blue-400 font-medium hover:underline break-all">
                    {url}
                </a>
            </div>
            
            <div className="text-sm text-gray-500">
                La carta se actualiza automáticamente cada vez que editas o añades elaboraciones en el sistema.
            </div>
        </div>
    );
};
