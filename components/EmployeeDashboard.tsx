
import React from 'react';
import { Employee, Message, TipEntry } from '../types';
import { CheckCircleIcon, MessageIcon, RefreshIcon, UserIcon } from './icons';

interface EmployeeDashboardProps {
  employee: Employee;
  messages: Message[];
  tipsHistory: TipEntry[];
  onClock: (id: string, type: 'in' | 'out') => void;
  onToggleTask: (employeeId: string, taskId: string) => void;
  onLogout: () => void;
  onNavigate: (view: string) => void;
  theme: 'dark' | 'light';
}

const EmployeeDashboard: React.FC<EmployeeDashboardProps> = ({ 
  employee, 
  messages, 
  tipsHistory,
  onClock, 
  onToggleTask, 
  onLogout, 
  onNavigate,
  theme 
}) => {
  const lastLog = employee.logs[employee.logs.length - 1];
  const isClockedIn = lastLog?.type === 'in';
  
  const pendingTasks = employee.tasks.filter(t => !t.completed);
  const employeeMessages = messages.filter(m => m.toId === employee.id || m.toId === 'all');

  const myTips = tipsHistory.filter(t => t.employeeId === employee.id);
  const poolTips = tipsHistory.filter(t => t.employeeId === 'pool');
  const myTotalTips = myTips.reduce((sum, t) => sum + t.amount, 0);
  const poolTotalTips = poolTips.reduce((sum, t) => sum + t.amount, 0);

  const sortedTasks = [...employee.tasks].sort((a, b) => {
    if (a.completed === b.completed) {
       return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    return a.completed ? 1 : -1;
  });

  // Calculate weekly hours
  const now = new Date();
  const dayOfWeek = now.getDay() || 7; 
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - dayOfWeek + 1);
  startOfWeek.setHours(0, 0, 0, 0);

  const thisWeekLogs = employee.logs.filter(l => new Date(l.timestamp) >= startOfWeek);
  const sortedWeekLogs = [...thisWeekLogs].sort((a,b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  let currentInTime: number | null = null;
  let totalWeekMs = 0;
  const daysData: Record<string, { totalMs: number, logStrs: string[] }> = {};

  sortedWeekLogs.forEach(log => {
      const dt = new Date(log.timestamp);
      
      if (log.type === 'in') {
          currentInTime = dt.getTime();
      } else if (log.type === 'out' && currentInTime) {
          const inDt = new Date(currentInTime);
          const dayStr = inDt.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' });
          if (!daysData[dayStr]) {
              daysData[dayStr] = { totalMs: 0, logStrs: [] };
          }

          const sessionMs = dt.getTime() - currentInTime;
          totalWeekMs += sessionMs;
          daysData[dayStr].totalMs += sessionMs;
          
          daysData[dayStr].logStrs.push(`${inDt.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})} - ${dt.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})}`);
          
          currentInTime = null;
      }
  });

  if (currentInTime && isClockedIn) {
      // Add current active session
      const sessionMs = now.getTime() - currentInTime;
      totalWeekMs += sessionMs;
      
      const inDt = new Date(currentInTime);
      const dayStr = inDt.toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' });
      if (!daysData[dayStr]) daysData[dayStr] = { totalMs: 0, logStrs: [] };
      daysData[dayStr].totalMs += sessionMs;
      daysData[dayStr].logStrs.push(`${inDt.toLocaleTimeString('es-ES', {hour: '2-digit', minute:'2-digit'})} - Actualidad`);
  }

  const formatHrs = (ms: number) => {
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      return `${h}h ${m}m`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header / Profile */}
      <div className={`p-6 rounded-2xl flex items-center justify-between ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
            {employee.name.charAt(0)}
          </div>
          <div>
            <h2 className="text-2xl font-bold">{employee.name}</h2>
            <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Panel de Empleado</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
            theme === 'dark' ? 'bg-red-900/20 text-red-400 hover:bg-red-900/30 border border-red-500/30' : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'
          }`}
        >
          Cerrar Sesión
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Clock In/Out */}
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <RefreshIcon className="w-5 h-5 text-blue-400" />
            Control de Horario
          </h3>
          <div className="flex flex-col items-center gap-4">
            <div className={`text-sm font-medium px-3 py-1 rounded-full ${isClockedIn ? 'bg-emerald-900/30 text-emerald-400 border border-emerald-500/30' : 'bg-gray-700 text-gray-400 border border-gray-600'}`}>
              {isClockedIn ? 'EN TURNO' : 'FUERA DE TURNO'}
            </div>
            <button
              onClick={() => onClock(employee.id, isClockedIn ? 'out' : 'in')}
              className={`w-full py-6 rounded-2xl text-xl font-bold transition-all shadow-xl ${
                isClockedIn 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
              }`}
            >
              {isClockedIn ? 'FICHAR SALIDA' : 'FICHAR ENTRADA'}
            </button>
            {lastLog && (
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
                Último registro: {new Date(lastLog.timestamp).toLocaleString()}
              </p>
            )}
            
            <div className={`mt-6 w-full pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
               <div className="flex justify-between items-center mb-4">
                  <h4 className="font-bold text-sm uppercase tracking-wider">Horario de esta semana</h4>
                  <span className={`text-sm font-bold px-2 py-1 rounded-md ${theme === 'dark' ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-700'}`}>
                     Total: {formatHrs(totalWeekMs)}
                  </span>
               </div>
               
               <div className="space-y-2 max-h-[150px] overflow-y-auto pr-2">
                 {Object.keys(daysData).length === 0 ? (
                    <p className={`text-xs italic ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Aún no hay registros de horas esta semana.</p>
                 ) : (
                    Object.entries(daysData).reverse().map(([day, data]) => (
                      <div key={day} className={`flex flex-col p-2 rounded-lg text-xs ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50 border border-gray-100'}`}>
                         <div className="flex justify-between items-center mb-1">
                            <span className="font-bold capitalize">{day}</span>
                            <span className="font-medium text-emerald-500">{formatHrs(data.totalMs)}</span>
                         </div>
                         <div className="flex flex-wrap gap-1">
                           {data.logStrs.map((str, idx) => (
                             <span key={idx} className={`px-2 py-0.5 rounded text-[10px] ${theme === 'dark' ? 'bg-gray-700 text-gray-300' : 'bg-white border border-gray-200 text-gray-600'}`}>{str}</span>
                           ))}
                         </div>
                      </div>
                    ))
                 )}
               </div>
            </div>

            <div className={`mt-6 w-full pt-6 border-t ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}>
               <h4 className="font-bold text-sm uppercase tracking-wider mb-4 text-purple-400">Próximos Turnos (Cuadrante)</h4>
               
               <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                 {!employee.shifts || employee.shifts.length === 0 ? (
                    <p className={`text-xs italic ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Sin turnos programados.</p>
                 ) : (
                    [...employee.shifts].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map(shift => (
                      <div key={shift.id} className={`flex justify-between items-center p-3 rounded-lg text-xs border-l-4 border-l-purple-500 ${theme === 'dark' ? 'bg-gray-900/50 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                         <span className="font-bold capitalize">{new Date(shift.date).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit' })}</span>
                         <span className={`px-2 py-1 rounded-md font-bold ${theme === 'dark' ? 'bg-purple-900/30 text-purple-400' : 'bg-purple-100 text-purple-700'}`}>
                           {shift.startTime} - {shift.endTime}
                         </span>
                      </div>
                    ))
                 )}
               </div>
            </div>
          </div>
        </div>

        {/* Tasks */}
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
            Mis Tareas ({pendingTasks.length})
          </h3>
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
            {sortedTasks.length === 0 ? (
              <p className={`text-sm italic ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>No tienes tareas asignadas.</p>
            ) : (
              sortedTasks.map(task => (
                <div 
                  key={task.id}
                  onClick={() => onToggleTask(employee.id, task.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                    task.completed 
                      ? (theme === 'dark' ? 'bg-gray-900/50 border-gray-800 opacity-50' : 'bg-gray-50 border-gray-100 opacity-50')
                      : (theme === 'dark' ? 'bg-gray-700/30 border-gray-600 hover:border-emerald-500' : 'bg-white border-gray-200 hover:border-emerald-400 shadow-sm')
                  }`}
                >
                  <div className={`w-5 h-5 rounded border flex items-center justify-center ${task.completed ? 'bg-emerald-600 border-emerald-600' : 'border-gray-400'}`}>
                    {task.completed && <CheckCircleIcon className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${task.completed ? 'line-through' : ''}`}>{task.text}</p>
                    <p className="text-[10px] text-gray-500 uppercase tracking-tighter">Asignado por: {task.assignedBy}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Messages & Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <MessageIcon className="w-5 h-5 text-purple-400" />
            Mensajes Recientes
          </h3>
          <div className="space-y-3 max-h-[200px] overflow-y-auto pr-2">
            {employeeMessages.length === 0 ? (
              <p className={`text-sm italic ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>No hay mensajes nuevos.</p>
            ) : (
              employeeMessages.slice(0, 5).map(msg => (
                <div key={msg.id} className={`p-3 rounded-xl ${theme === 'dark' ? 'bg-gray-900/50' : 'bg-gray-50 border border-gray-100'}`}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-bold text-blue-400">{msg.fromName}</span>
                    <span className="text-[10px] text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-sm">{msg.text}</p>
                </div>
              ))
            )}
          </div>
          <button 
            onClick={() => onNavigate('messages')}
            className="w-full mt-4 py-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
          >
            Ver todos los mensajes
          </button>
        </div>

        <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-white border border-gray-200 shadow-sm'}`}>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-orange-400" />
            Accesos Rápidos
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {(employee.role === 'camarero' || employee.role === 'employee' || employee.role === 'admin' || employee.role === 'manager') && (
              <>
                <button 
                  onClick={() => onNavigate('tpv')}
                  className={`p-4 rounded-xl text-center transition-all ${theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  <p className="text-xs font-bold">TPV / SALA</p>
                </button>
                <button 
                  onClick={() => onNavigate('reservas')}
                  className={`p-4 rounded-xl text-center transition-all ${theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  <p className="text-xs font-bold">RESERVAS</p>
                </button>
              </>
            )}
            
            {(employee.role === 'cocinero' || employee.role === 'employee' || employee.role === 'admin' || employee.role === 'manager') && (
              <>
                <button 
                  onClick={() => onNavigate('kitchen')}
                  className={`p-4 rounded-xl text-center transition-all ${theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  <p className="text-xs font-bold">MONITOR COCINA</p>
                </button>
                <button 
                  onClick={() => onNavigate('gastronomy')}
                  className={`p-4 rounded-xl text-center transition-all ${theme === 'dark' ? 'bg-gray-700/50 hover:bg-gray-700' : 'bg-gray-50 hover:bg-gray-100'}`}
                >
                  <p className="text-xs font-bold">ELABORACIONES</p>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Tips section */}
      <div className={`p-6 rounded-2xl ${theme === 'dark' ? 'bg-gray-800 border border-gray-700' : 'bg-green-50 border border-green-200 shadow-sm'}`}>
         <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
           <span className="text-xl">💰</span> Mi Bote / Propinas
         </h3>
         <div className="grid grid-cols-2 gap-4">
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-white border text-gray-800'}`}>
                <p className={`text-xs uppercase font-bold mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Bote Individual</p>
                <p className="text-3xl font-black text-emerald-400">{myTotalTips.toFixed(2)}€</p>
            </div>
            <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-gray-900 border border-gray-700' : 'bg-white border text-gray-800'}`}>
                <p className={`text-xs uppercase font-bold mb-1 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Bote Común (Acumulado)</p>
                <p className="text-3xl font-black text-yellow-500">{poolTotalTips.toFixed(2)}€</p>
            </div>
         </div>
      </div>

      {/* Monitor Setup for Managers */}
      {(employee.role === 'manager' || employee.role === 'admin') && (
        <div className={`p-6 rounded-2xl border ${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200'}`}>
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <RefreshIcon className="w-5 h-5 text-blue-400" /> URLs para Monitores
          </h3>
          <p className="text-sm text-gray-400 mb-4">Copia estas direcciones en los navegadores de tus tablets o monitores:</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-3 bg-black/20 rounded-lg border border-gray-700/50">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Monitor Cocina</span>
              <code className="text-xs text-blue-400 break-all">{window.location.origin}/?view=kitchen</code>
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-gray-700/50">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">PDA / Sala (TPV)</span>
              <code className="text-xs text-blue-400 break-all">{window.location.origin}/?view=tpv</code>
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-gray-700/50">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">Gestión de Pedidos</span>
              <code className="text-xs text-blue-400 break-all">{window.location.origin}/?view=orders</code>
            </div>
            <div className="p-3 bg-black/20 rounded-lg border border-gray-700/50">
              <span className="text-[10px] uppercase font-bold text-gray-500 block">CARTA DIGITAL (QR)</span>
              <code className="text-xs text-emerald-400 break-all">{window.location.origin}/?view=public_menu</code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;
