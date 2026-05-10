
import React from 'react';
import { View } from '../App';
import { GastosIcon, VentasIcon, CierresIcon, SummaryIcon } from './icons';

interface GestionMenuProps {
  navigateTo: (view: View) => void;
}

const MenuButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
}> = ({ onClick, icon, title, description }) => (
  <button
    onClick={onClick}
    className="bg-gray-800 p-6 rounded-xl text-center hover:bg-gray-700 transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 flex flex-col items-center justify-center"
  >
    {icon}
    <h3 className="text-lg font-bold text-white mt-2">{title}</h3>
    <p className="text-sm text-gray-400">{description}</p>
  </button>
);

const GestionMenu: React.FC<GestionMenuProps> = ({ navigateTo }) => {
  return (
    <div className="flex flex-col items-center justify-center py-8">
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-6xl">
             <MenuButton 
                onClick={() => navigateTo('summary')} 
                icon={<SummaryIcon />}
                title="Resumen"
                description="Gráficos y análisis"
            />
            <MenuButton 
                onClick={() => navigateTo('gastos')} 
                icon={<GastosIcon />}
                title="Gastos"
                description="Registrar salidas de dinero"
            />
            <MenuButton 
                onClick={() => navigateTo('ventas')}
                icon={<VentasIcon />}
                title="Ventas"
                description="Registrar ingresos y tickets"
            />
            <MenuButton 
                onClick={() => navigateTo('cierres')}
                icon={<CierresIcon />}
                title="Cierres de Cajas"
                description="Realizar y consultar cierres"
            />
        </div>
    </div>
  );
};

export default GestionMenu;
