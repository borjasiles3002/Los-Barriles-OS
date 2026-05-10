
import React from 'react';
import { StockItem } from '../types';
import { AlertTriangleIcon, TrendingUpIcon, PackageIcon } from './icons';

interface ProfitabilityAlertsProps {
    drinkStock: StockItem[];
    kitchenStock: StockItem[];
}

interface Alert {
    type: 'low_stock' | 'price_spike' | 'excess_stock';
    title: string;
    description: string;
    severity: 'critical' | 'warning' | 'info';
    item: string;
}

const ProfitabilityAlerts: React.FC<ProfitabilityAlertsProps> = ({ drinkStock, kitchenStock }) => {
    const allItems = [...drinkStock, ...kitchenStock];
    const alerts: Alert[] = [];

    allItems.forEach(item => {
        // 1. Low Stock Alert
        if (item.stock <= item.lowStockThreshold) {
            alerts.push({
                type: 'low_stock',
                title: 'Ruptura de Stock',
                description: `Quedan solo ${item.stock} unidades. Riesgo de pérdida de ventas.`,
                severity: 'critical',
                item: item.name
            });
        }

        // 2. Price Spike Alert
        if (item.lastPrice && item.priceHistory && item.priceHistory.length > 1) {
            const history = item.priceHistory;
            // Compare last price with the previous one or average
            const previousPrice = history[1]?.price;
            if (previousPrice && item.lastPrice > previousPrice * 1.05) {
                const increase = ((item.lastPrice - previousPrice) / previousPrice * 100).toFixed(1);
                alerts.push({
                    type: 'price_spike',
                    title: 'Subida de Coste',
                    description: `El precio ha subido un ${increase}% desde la última compra.`,
                    severity: 'warning',
                    item: item.name
                });
            }
        }

        // 3. Excess Stock (Inmovilizado)
        if (item.stock > item.lowStockThreshold * 4 && item.lastPrice && item.lastPrice > 2) {
            const value = (item.stock * item.lastPrice).toFixed(2);
            alerts.push({
                type: 'excess_stock',
                title: 'Capital Inmovilizado',
                description: `Stock muy alto (${item.stock} uds). Tienes ${value}€ parados en este producto.`,
                severity: 'info',
                item: item.name
            });
        }
    });

    if (alerts.length === 0) return null;

    return (
        <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
            <div className="p-4 border-b border-gray-700 bg-gray-800/50 flex items-center gap-2">
                <AlertTriangleIcon className="text-amber-400 w-5 h-5" />
                <h3 className="text-lg font-bold text-white">Alertas de Rentabilidad</h3>
            </div>
            <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {alerts.sort((a, b) => {
                    const order = { critical: 0, warning: 1, info: 2 };
                    return order[a.severity] - order[b.severity];
                }).map((alert, idx) => (
                    <div 
                        key={idx} 
                        className={`p-3 rounded-xl border flex gap-3 transition-all hover:scale-[1.01] ${
                            alert.severity === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                            alert.severity === 'warning' ? 'bg-amber-500/10 border-amber-500/30' :
                            'bg-blue-500/10 border-blue-500/30'
                        }`}
                    >
                        <div className={`mt-1 ${
                            alert.severity === 'critical' ? 'text-red-400' :
                            alert.severity === 'warning' ? 'text-amber-400' :
                            'text-blue-400'
                        }`}>
                            {alert.type === 'low_stock' && <PackageIcon className="w-5 h-5" />}
                            {alert.type === 'price_spike' && <TrendingUpIcon className="w-5 h-5" />}
                            {alert.type === 'excess_stock' && <AlertTriangleIcon className="w-5 h-5" />}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-bold text-white text-sm">{alert.item}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                                    alert.severity === 'critical' ? 'bg-red-500 text-white' :
                                    alert.severity === 'warning' ? 'bg-amber-500 text-black' :
                                    'bg-blue-500 text-white'
                                }`}>
                                    {alert.title}
                                </span>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{alert.description}</p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProfitabilityAlerts;
