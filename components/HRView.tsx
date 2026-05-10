
import React, { useState } from 'react';
import { Employee, WorkLogEntry, Message, UserRole } from '../types';
import { BackIcon, LogInIcon, LogOutIcon, MessageIcon, CheckCircleIcon, RefreshIcon, PlusIcon, EditIcon, TrashIcon, XIcon, SaveIcon } from './icons';

interface HRViewProps {
    employees: Employee[];
    onClock: (employeeId: string, type: 'in' | 'out') => void;
    onAddTask: (employeeId: string, text: string) => void;
    onToggleTask: (employeeId: string, taskId: string) => void;
    onSendMessage: (toId: string, text: string) => void;
    onAddEmployee: (name: string, role: UserRole) => void;
    onUpdateEmployee: (id: string, updates: Partial<Employee>) => void;
    onDeleteEmployee: (id: string) => void;
    messages: Message[];
}

const HRView: React.FC<HRViewProps> = ({ employees, onClock, onAddTask, onToggleTask, onSendMessage, onAddEmployee, onUpdateEmployee, onDeleteEmployee, messages }) => {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [newTaskText, setNewTaskText] = useState('');
  const [newMessageText, setNewMessageText] = useState('');
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [isEditingEmployee, setIsEditingEmployee] = useState(false);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<UserRole>('camarero');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const selectedEmployee = employees.find(e => e.id === selectedEmployeeId) || null;

  const calculateTotalHours = (logs: WorkLogEntry[]): string => {
    let totalMillis = 0;
    let inTime: number | null = null;

    logs.forEach(log => {
      if (log.type === 'in' && inTime === null) {
        inTime = new Date(log.timestamp).getTime();
      } else if (log.type === 'out' && inTime !== null) {
        const outTime = new Date(log.timestamp).getTime();
        totalMillis += outTime - inTime;
        inTime = null; // Reset for the next pair
      }
    });

    if (totalMillis === 0) return '00:00:00';

    const hours = Math.floor(totalMillis / (1000 * 60 * 60));
    const minutes = Math.floor((totalMillis % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((totalMillis % (1000 * 60)) / 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };
  
  const lastLog = selectedEmployee?.logs[selectedEmployee.logs.length - 1];
  const canClockIn = !lastLog || lastLog.type === 'out';
  const canClockOut = lastLog && lastLog.type === 'in';

  const handleAddTaskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee && newTaskText.trim()) {
      onAddTask(selectedEmployee.id, newTaskText.trim());
      setNewTaskText('');
    }
  };

  const handleSendMessageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee && newMessageText.trim()) {
      onSendMessage(selectedEmployee.id, newMessageText.trim());
      setNewMessageText('');
    }
  };

  const handleAddEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editName.trim()) {
      onAddEmployee(editName.trim(), editRole);
      setIsAddingEmployee(false);
      setEditName('');
      setEditRole('camarero');
    }
  };

  const handleUpdateEmployeeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmployee && editName.trim()) {
      onUpdateEmployee(selectedEmployee.id, { name: editName.trim(), role: editRole });
      setIsEditingEmployee(false);
    }
  };

  const startEdit = () => {
    if (selectedEmployee) {
      setEditName(selectedEmployee.name);
      setEditRole(selectedEmployee.role);
      setIsEditingEmployee(true);
    }
  };

  const employeeMessages = messages.filter(m => m.toId === selectedEmployeeId || m.fromId === selectedEmployeeId);

  if (selectedEmployee) {
    return (
      <div className="w-full max-w-5xl mx-auto space-y-6">
        <button onClick={() => setSelectedEmployeeId(null)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4">
          <BackIcon />
          <span>Volver a la lista</span>
        </button>
        
        <div className="bg-gray-800 p-8 rounded-2xl shadow-2xl border border-gray-700">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                {selectedEmployee.name.charAt(0)}
              </div>
              <div className="flex-1">
                {isEditingEmployee ? (
                  <form onSubmit={handleUpdateEmployeeSubmit} className="flex flex-col gap-2">
                    <input 
                      type="text" 
                      value={editName} 
                      onChange={e => setEditName(e.target.value)}
                      className="bg-gray-900 border border-gray-700 text-white px-3 py-1 rounded-lg text-xl font-bold"
                    />
                    <div className="flex gap-2">
                      <select 
                        value={editRole} 
                        onChange={e => setEditRole(e.target.value as UserRole)}
                        className="bg-gray-900 border border-gray-700 text-gray-300 text-xs px-2 py-1 rounded"
                      >
                        <option value="admin">Admin</option>
                        <option value="cocinero">Cocinero</option>
                        <option value="camarero">Camarero</option>
                      </select>
                      <button type="submit" className="text-green-400 hover:text-green-300"><SaveIcon className="w-5 h-5" /></button>
                      <button type="button" onClick={() => setIsEditingEmployee(false)} className="text-gray-400 hover:text-white"><XIcon className="w-5 h-5" /></button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <h2 className="text-3xl font-bold text-white">{selectedEmployee.name}</h2>
                      <button onClick={startEdit} className="text-gray-500 hover:text-blue-400 transition-colors">
                        <EditIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowDeleteConfirm(true)} className="text-gray-500 hover:text-red-400 transition-colors">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {lastLog ? (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${lastLog.type === 'in' ? 'bg-green-500/20 text-green-400 border border-green-500/50' : 'bg-gray-500/20 text-gray-400 border border-gray-500/50'}`}>
                          {lastLog.type === 'in' ? '● En Turno' : '○ Fuera de Turno'}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-500/20 text-gray-400 border border-gray-500/50">
                          Sin registros
                        </span>
                      )}
                      <span className="text-xs text-gray-500 uppercase font-bold tracking-widest">{selectedEmployee.role}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div className="flex gap-2">
               <button
                onClick={() => onClock(selectedEmployee.id, 'in')}
                disabled={!canClockIn}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                <LogInIcon />
                ENTRADA
              </button>
              <button
                onClick={() => onClock(selectedEmployee.id, 'out')}
                disabled={!canClockOut}
                className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
              >
                <LogOutIcon />
                SALIDA
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
            {/* Cuadrante Semanal */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-700 pb-2">
                <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                Cuadrante Semanal
              </h3>
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  const target = e.target as HTMLFormElement;
                  const date = (target.elements.namedItem('date') as HTMLInputElement).value;
                  const startTime = (target.elements.namedItem('startTime') as HTMLInputElement).value;
                  const endTime = (target.elements.namedItem('endTime') as HTMLInputElement).value;
                  if (date && startTime && endTime) {
                    const newShift = { id: `shift-${Date.now()}`, date, startTime, endTime };
                    onUpdateEmployee(selectedEmployee.id, { shifts: [...(selectedEmployee.shifts || []), newShift] });
                    target.reset();
                  }
                }} 
                className="flex flex-col gap-2 bg-gray-900/50 p-3 rounded-xl border border-gray-700"
              >
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-gray-500 uppercase font-bold">Fecha</label>
                  <input name="date" type="date" required className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
                </div>
                <div className="flex gap-2">
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Entrada</label>
                    <input name="startTime" type="time" required className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="flex flex-col gap-1 flex-1">
                    <label className="text-[10px] text-gray-500 uppercase font-bold">Salida</label>
                    <input name="endTime" type="time" required className="bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
                  </div>
                </div>
                <button type="submit" className="bg-blue-600 text-white px-4 py-1.5 rounded-lg hover:bg-blue-700 transition-colors font-bold text-xs mt-1">AÑADIR TURNO</button>
              </form>
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedEmployee.shifts && selectedEmployee.shifts.length > 0 ? (
                  [...selectedEmployee.shifts].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((shift) => (
                    <div key={shift.id} className="flex flex-col p-2 rounded-xl bg-gray-800 border border-gray-700">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-blue-400">{new Date(shift.date).toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit' })}</span>
                        <button 
                          onClick={() => {
                            const newShifts = selectedEmployee.shifts!.filter(s => s.id !== shift.id);
                            onUpdateEmployee(selectedEmployee.id, { shifts: newShifts });
                          }}
                          className="text-gray-500 hover:text-red-400"
                        >
                          <XIcon className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-xs text-gray-300 bg-gray-900 rounded px-2 py-1 w-fit">{shift.startTime} - {shift.endTime}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm italic">Sin turnos asignados.</p>
                )}
              </div>
            </div>

            {/* Historial y Horas */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-700 pb-2">
                <RefreshIcon className="w-5 h-5 text-blue-400" />
                Control Horario
              </h3>
              <div className="bg-gray-900/50 p-4 rounded-xl border border-gray-700">
                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Horas</p>
                <p className="text-3xl font-mono text-white">{calculateTotalHours(selectedEmployee.logs)}</p>
              </div>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedEmployee.logs.length > 0 ? (
                  [...selectedEmployee.logs].reverse().map((log, index) => (
                    <div 
                      key={`${log.timestamp}-${index}`} 
                      className={`flex justify-between items-center p-3 rounded-xl border ${
                        log.type === 'in' ? 'bg-green-900/10 border-green-900/30' : 'bg-red-900/10 border-red-900/30'
                      }`}
                    >
                      <span className={`text-[10px] font-bold ${log.type === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                        {log.type === 'in' ? 'ENTRADA' : 'SALIDA'}
                      </span>
                      <span className="text-gray-400 font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm italic">No hay registros.</p>
                )}
              </div>
            </div>

            {/* Tareas */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-700 pb-2">
                <CheckCircleIcon className="w-5 h-5 text-emerald-400" />
                Tareas Asignadas
              </h3>
              <form onSubmit={handleAddTaskSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={newTaskText}
                  onChange={(e) => setNewTaskText(e.target.value)}
                  placeholder="Asignar nueva tarea..."
                  className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors font-bold text-xs"
                >
                  AÑADIR
                </button>
              </form>
              <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {selectedEmployee.tasks.length > 0 ? (
                  selectedEmployee.tasks.map((task) => (
                    <div 
                      key={task.id} 
                      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                        task.completed ? 'bg-gray-900/30 border-transparent opacity-50' : 'bg-gray-700/30 border-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={task.completed}
                        onChange={() => onToggleTask(selectedEmployee.id, task.id)}
                        className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm text-white truncate ${task.completed ? 'line-through text-gray-500' : ''}`}>
                          {task.text}
                        </p>
                        <p className="text-[9px] text-gray-500 uppercase tracking-tighter">
                          {new Date(task.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm italic">No hay tareas.</p>
                )}
              </div>
            </div>

            {/* Mensajes Directos */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2 border-b border-gray-700 pb-2">
                <MessageIcon className="w-5 h-5 text-purple-400" />
                Mensajes
              </h3>
              <form onSubmit={handleSendMessageSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={newMessageText}
                  onChange={(e) => setNewMessageText(e.target.value)}
                  placeholder="Enviar mensaje..."
                  className="flex-1 bg-gray-900 border border-gray-700 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-purple-500"
                />
                <button
                  type="submit"
                  className="bg-purple-600 text-white px-4 py-2 rounded-xl hover:bg-purple-700 transition-colors font-bold text-xs"
                >
                  ENVIAR
                </button>
              </form>
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {employeeMessages.length > 0 ? (
                  [...employeeMessages].reverse().map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`p-3 rounded-xl border ${
                        msg.fromId === 'admin' ? 'bg-purple-900/10 border-purple-900/30' : 'bg-gray-900 border-gray-700'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-[10px] font-bold ${msg.fromId === 'admin' ? 'text-purple-400' : 'text-blue-400'}`}>
                          {msg.fromId === 'admin' ? 'TÚ' : msg.fromName}
                        </span>
                        <span className="text-[9px] text-gray-500">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-xs text-gray-300">{msg.text}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-4 text-sm italic">No hay mensajes.</p>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-gray-800 border border-red-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
              <h3 className="text-xl font-bold text-white mb-4">¿Eliminar a {selectedEmployee.name}?</h3>
              <p className="text-gray-400 mb-6">Esta acción es irreversible y eliminará todos sus registros de horas y tareas.</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={() => {
                    onDeleteEmployee(selectedEmployee.id);
                    setSelectedEmployeeId(null);
                    setShowDeleteConfirm(false);
                  }}
                  className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-red-900/20"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Gestión de Personal</h2>
        <button 
          onClick={() => setIsAddingEmployee(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-blue-900/20"
        >
          <PlusIcon className="w-4 h-4" />
          <span>NUEVO EMPLEADO</span>
        </button>
      </div>

      {isAddingEmployee && (
        <div className="mb-8 bg-gray-800 p-6 rounded-2xl border border-blue-500/30 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-white">Añadir Nuevo Trabajador</h3>
            <button onClick={() => setIsAddingEmployee(false)} className="text-gray-400 hover:text-white"><XIcon /></button>
          </div>
          <form onSubmit={handleAddEmployeeSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Nombre Completo</label>
              <input 
                type="text" 
                required
                value={editName}
                onChange={e => setEditName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol / Puesto</label>
              <select 
                value={editRole}
                onChange={e => setEditRole(e.target.value as UserRole)}
                className="w-full bg-gray-900 border border-gray-700 text-white px-4 py-2 rounded-xl focus:outline-none focus:border-blue-500"
              >
                <option value="camarero">Camarero</option>
                <option value="cocinero">Cocinero</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <button type="submit" className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors">
              GUARDAR EMPLEADO
            </button>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {employees.map(employee => (
          <button
            key={employee.id}
            onClick={() => setSelectedEmployeeId(employee.id)}
            className="p-6 bg-gray-800 border border-gray-700 rounded-2xl text-left hover:bg-gray-700 transition-all group flex items-center justify-between"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-gray-700 flex items-center justify-center text-xl font-bold text-white group-hover:bg-blue-600 transition-colors">
                {employee.name.charAt(0)}
              </div>
              <div>
                <p className="font-bold text-white">{employee.name}</p>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{employee.role}</p>
              </div>
            </div>
            <div className="w-2 h-2 rounded-full bg-gray-600 group-hover:bg-blue-500 transition-all" />
          </button>
        ))}
      </div>
    </div>
  );
};

export default HRView;
