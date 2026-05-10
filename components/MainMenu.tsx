
import React from 'react';
import { View } from '../App';
import { GestionIcon, StockIcon, HRIcon, ReservasIcon, ElaborationsIcon, LogoIcon, SparkIcon, OrdersIcon, VentasIcon } from './icons';
import { UserRole } from '../types';

interface MainMenuProps {
  navigateTo: (view: View) => void;
  userRole: UserRole;
}

const MenuButton: React.FC<{
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}> = ({ onClick, icon, title, description, className }) => (
  <button
    onClick={onClick}
    className={`bg-gray-800 p-6 rounded-xl text-center hover:bg-gray-700 transition-all duration-300 transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${className}`}
  >
    <div className="flex justify-center items-center">{icon}</div>
    <h3 className="text-lg font-bold text-white mt-2">{title}</h3>
    <p className="text-sm text-gray-400">{description}</p>
  </button>
);

const MainMenu: React.FC<MainMenuProps> = ({ navigateTo, userRole }) => {
  const isAdmin = userRole === 'admin' || userRole === 'manager'; // Only admin/manager can see these modules

  return (
    <div className="flex flex-col items-center justify-center h-full">
        <div className="text-center mb-12 flex flex-col items-center">
            <LogoIcon size={120} className="text-gray-300 mb-6" />
            <h2 className="text-3xl font-bold text-white">Bienvenido a Los Barriles OS</h2>
            <p className="text-gray-400 mt-2">Seleccione un módulo para comenzar a gestionar.</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 w-full max-w-7xl">
            {isAdmin && (
                <>
                    <MenuButton 
                        onClick={() => navigateTo('finance')} 
                        icon={<GestionIcon />}
                        title="Finanzas y Caja"
                        description="Ventas, gastos y cierres"
                    />
                    <MenuButton 
                        onClick={() => navigateTo('inventory_purchases')}
                        icon={<StockIcon />}
                        title="Inventario y Compras"
                        description="Stock, facturas y proveedores"
                    />
                     <MenuButton 
                        onClick={() => navigateTo('hr')}
                        icon={<HRIcon />}
                        title="Personal"
                        description="Equipo y fichajes"
                    />
                     <MenuButton 
                        onClick={() => navigateTo('ai_tools')}
                        icon={<SparkIcon />}
                        title="Herramientas IA"
                        description="Marketing y Visión Artificial"
                    />
                </>
            )}
            
            <MenuButton 
                onClick={() => navigateTo('gastronomy')}
                icon={<ElaborationsIcon />}
                title="Gastronomía"
                description="Escandallos y análisis de carta"
            />
            <MenuButton 
                onClick={() => navigateTo('tpv')}
                icon={<VentasIcon />}
                title="TPV y Pedidos"
                description="Atención en sala"
            />
            <MenuButton 
                onClick={() => navigateTo('kitchen')}
                icon={<OrdersIcon />}
                title="Monitor Cocina"
                description="Comandas en curso"
            />
            <MenuButton 
                onClick={() => navigateTo('reservas')}
                icon={<ReservasIcon />}
                title="Reservas"
                description="Gestión de mesas"
            />
        </div>
    </div>
  );
};

export default MainMenu;