import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { StockItem } from '../types';

interface StockChartProps {
  drinkStock: StockItem[];
  kitchenStock: StockItem[];
}

const StockChart: React.FC<StockChartProps> = ({ drinkStock, kitchenStock }) => {
  const allStock = [...drinkStock, ...kitchenStock];

  const data = allStock.map(item => ({
    name: item.name,
    cantidad: item.stock,
    familia: item.family,
  }));

  return (
    <div className="w-full h-96 bg-gray-800 p-4 rounded-lg">
        <h3 className="text-lg font-bold text-white mb-4">Visualización de Stock</h3>
        <ResponsiveContainer width="100%" height="100%">
            <BarChart
                data={data}
                margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                <XAxis dataKey="name" stroke="#A0AEC0" />
                <YAxis stroke="#A0AEC0" />
                <Tooltip
                    contentStyle={{ backgroundColor: '#2D3748', border: '1px solid #4A5568', color: '#E2E8F0' }}
                    labelStyle={{ color: '#E2E8F0' }}
                />
                <Legend wrapperStyle={{ color: '#E2E8F0' }} />
                <Bar dataKey="cantidad" fill="#4299E1" name="Cantidad en Stock" />
            </BarChart>
        </ResponsiveContainer>
    </div>
  );
};

export default StockChart;
