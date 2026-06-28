
import React, { useState, useRef } from 'react';
import { ExpenseEntry, ChatMessage, PurchaseItem } from '../types';
import { LoadingSpinner, UploadIcon, XIcon, HeaderIcon } from './icons';
import { callGemini } from '../services/geminiService';
import { compressImage } from '../utils/image';
import { GEMINI_ADVISOR_PROMPT, addExpenseTool } from '../constants';
import { storage, ref, uploadBytes, getDownloadURL } from '../src/firebase';

interface GastosViewProps {
    onAddExpense: (expense: Omit<ExpenseEntry, 'id' | 'date'>, invoiceUrl?: string) => void;
    onAddExpenseWithAI: (args: { expense: Omit<ExpenseEntry, 'id' | 'date'>; stockItems?: { bebidas?: PurchaseItem[]; cocina?: PurchaseItem[] } }, invoiceUrl?: string) => void;
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    expenseHistory: ExpenseEntry[];
    purchaseHistory: import('../types').PurchaseRecord[];
}

const GastosView: React.FC<GastosViewProps> = ({ onAddExpense, onAddExpenseWithAI, isLoading, setIsLoading, expenseHistory, purchaseHistory }) => {
    // Manual form state
    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');
    const [invoiceNumber, setInvoiceNumber] = useState('');
    const [category, setCategory] = useState<ExpenseEntry['category']>('Otros');
    const [localError, setLocalError] = useState<string | null>(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateAction, setDuplicateAction] = useState<{ type: 'ai' | 'manual'; data: any } | null>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    const [showAll, setShowAll] = useState(false);

    // AI form state
    const [file, setFile] = useState<{ file: File; preview: string; mimeType: string; data: string } | null>(null);
    const [aiError, setAiError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const uploadToStorage = async (data: string, mimeType: string, fileName: string): Promise<string | undefined> => {
        try {
            const byteCharacters = atob(data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: mimeType });

            const storageRef = ref(storage, `invoices/${Date.now()}_${fileName}`);
            const snapshot = await uploadBytes(storageRef, blob);
            const downloadURL = await getDownloadURL(snapshot.ref);
            return downloadURL;
        } catch (error) {
            console.error("Error uploading to storage:", error);
            return undefined;
        }
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile && (selectedFile.type.startsWith('image/') || selectedFile.type === 'application/pdf')) {
            const reader = new FileReader();
            reader.onloadend = async () => {
                let base64Data = (reader.result as string).split(',')[1];
                let mimeType = selectedFile.type;

                if (mimeType.startsWith('image/')) {
                    try {
                        const compressed = await compressImage(base64Data, mimeType);
                        base64Data = compressed.data;
                        mimeType = compressed.mimeType;
                    } catch (compressErr) {
                        console.warn("Compression failed, using original image", compressErr);
                    }
                }

                setFile({
                    file: selectedFile,
                    preview: selectedFile.type.startsWith('image/') ? URL.createObjectURL(selectedFile) : '',
                    mimeType: mimeType,
                    data: base64Data
                });
            };
            reader.readAsDataURL(selectedFile);
            setAiError(null);
        }
    };
    
    const removeFile = () => {
        setFile(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleAnalyzeAndSubmit = async () => {
        if (!file) {
            setAiError("Por favor, suba una imagen o PDF de una factura.");
            return;
        }
        setIsLoading(true);
        setAiError(null);

        const userMessage: ChatMessage = {
            role: 'user',
            parts: [
                { text: 'Analiza esta factura o albarán (imagen o PDF) para registrar el gasto y el stock. Extrae con precisión el proveedor, la fecha (YYYY-MM-DD), el importe total (incluyendo impuestos) y categoriza los productos por familia de forma inteligente (bebidas vs cocina). Si el documento tiene varias páginas, analiza todas.' },
                { inlineData: { mimeType: file.mimeType, data: file.data } }
            ]
        };

        try {
            const response = await callGemini([userMessage], GEMINI_ADVISOR_PROMPT, { tools: [addExpenseTool] }, 'gemini-2.0-flash');
            const functionCalls = response.functionCalls;
            
            if (functionCalls && functionCalls.length > 0 && functionCalls[0].name === 'addExpense') {
                const args = functionCalls[0].args as { expense: Omit<ExpenseEntry, 'id' | 'date'> & { supplierName?: string; invoiceDate?: string; invoiceNumber?: string | null }; stockItems?: { bebidas?: PurchaseItem[]; cocina?: PurchaseItem[] } };
                
                // Check for duplicates in both expense history and purchase history
                const isDuplicateInExpenses = expenseHistory.some(e => 
                    (args.expense.invoiceNumber && e.invoiceNumber === args.expense.invoiceNumber && e.concept.toLowerCase().includes((args.expense.supplierName || '').toLowerCase())) ||
                    (Math.abs(e.amount - args.expense.amount) < 0.01 && e.concept.toLowerCase().includes((args.expense.supplierName || '').toLowerCase()))
                );

                const isDuplicateInPurchases = purchaseHistory.some(p => 
                    (args.expense.invoiceNumber && p.invoiceNumber === args.expense.invoiceNumber && p.supplierName.toLowerCase() === (args.expense.supplierName || '').toLowerCase()) ||
                    (Math.abs(p.totalAmount - args.expense.amount) < 0.01 && p.supplierName.toLowerCase() === (args.expense.supplierName || '').toLowerCase())
                );

                if (isDuplicateInExpenses || isDuplicateInPurchases) {
                    setDuplicateAction({ type: 'ai', data: args });
                    setShowDuplicateModal(true);
                    setIsLoading(false);
                    return;
                }

                let invoiceUrl: string | undefined = undefined;
                if (file) {
                    invoiceUrl = await uploadToStorage(file.data, file.mimeType, file.file.name);
                }

                onAddExpenseWithAI(args, invoiceUrl);
                removeFile();
            } else {
                throw new Error("La IA no devolvió los datos esperados para procesar la factura. Intente con una imagen más clara o un PDF legible.");
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Error desconocido.';
            setAiError(`Error en el análisis: ${errorMessage}`);
        } finally {
            setIsLoading(false);
        }
    };


    const handleManualSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numAmount = parseFloat(amount);
        if (!numAmount || numAmount <= 0 || !concept.trim()) {
            setLocalError('Por favor, introduzca un importe válido y un concepto.');
            return;
        }

        // Check for duplicates in manual entry (both history lists)
        const isDuplicateInExpenses = expenseHistory.some(e => 
            (invoiceNumber && e.invoiceNumber === invoiceNumber) ||
            (Math.abs(e.amount - numAmount) < 0.01 && e.concept.toLowerCase() === concept.toLowerCase())
        );

        const isDuplicateInPurchases = purchaseHistory.some(p => 
            (invoiceNumber && p.invoiceNumber === invoiceNumber) ||
            (Math.abs(p.totalAmount - numAmount) < 0.01 && p.supplierName.toLowerCase() === concept.toLowerCase())
        );

        if (isDuplicateInExpenses || isDuplicateInPurchases) {
            setDuplicateAction({ 
                type: 'manual', 
                data: { amount: numAmount, concept, category, invoiceNumber: invoiceNumber || undefined } 
            });
            setShowDuplicateModal(true);
            return;
        }

        onAddExpense({ amount: numAmount, concept, category, invoiceNumber: invoiceNumber || undefined });
        setAmount('');
        setConcept('');
        setInvoiceNumber('');
        setLocalError(null);
    };
    
    const displayedExpenses = showAll ? expenseHistory : expenseHistory.filter(e => !e.isClosed);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
            {/* Input Column */}
            <div className="space-y-8">
                {/* AI-assisted entry */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-4">Analizar Factura con IA</h2>
                    <div 
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 flex justify-center items-center px-6 pt-5 pb-6 border-2 border-gray-600 border-dashed rounded-md cursor-pointer hover:border-blue-500 transition-colors min-h-[150px]"
                    >
                        {file ? (
                            <div className="relative">
                                {file.mimeType.startsWith('image/') ? (
                                    <img src={file.preview} alt="Preview" className="max-h-40 rounded-md" />
                                ) : (
                                    <div className="bg-gray-700 p-4 rounded-md flex flex-col items-center">
                                        <span className="text-red-400 font-bold text-xl mb-2">PDF</span>
                                        <span className="text-gray-300 text-sm truncate max-w-[200px]">{file.file.name}</span>
                                    </div>
                                )}
                                <button onClick={(e) => { e.stopPropagation(); removeFile(); }} className="absolute -top-2 -right-2 bg-gray-900 rounded-full p-1 text-white" aria-label="Remove file">
                                    <XIcon />
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-1 text-center">
                                <UploadIcon />
                                <div className="flex text-sm text-gray-400">
                                    <p className="pl-1">Arrastra una factura o haz clic para subir</p>
                                </div>
                                <p className="text-xs text-gray-500">PNG, JPG, PDF</p>
                            </div>
                        )}
                    </div>
                    <input type="file" accept="image/*,application/pdf" ref={fileInputRef} onChange={handleFileChange} className="hidden" />

                    <button 
                        onClick={handleAnalyzeAndSubmit} 
                        disabled={isLoading || !file} 
                        className="mt-4 w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-500"
                    >
                        {isLoading ? <LoadingSpinner /> : 'Analizar y Registrar Gasto'}
                    </button>
                    {aiError && <p className="text-red-400 text-center text-sm mt-2">{aiError}</p>}
                </div>
                
                {/* Manual Entry */}
                <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
                    <h2 className="text-xl font-bold text-white mb-4">Registrar Gasto Manualmente</h2>
                    <form onSubmit={handleManualSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="amount" className="block text-sm font-medium text-gray-400">Importe (€)</label>
                            <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)}
                                   className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" placeholder="50.00" />
                        </div>
                        <div>
                            <label htmlFor="concept" className="block text-sm font-medium text-gray-400">Concepto</label>
                            <input type="text" id="concept" value={concept} onChange={e => setConcept(e.target.value)}
                                   className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" placeholder="Compra de servilletas" />
                        </div>
                        <div>
                            <label htmlFor="invoiceNumber" className="block text-sm font-medium text-gray-400">Nº Factura (Opcional)</label>
                            <input type="text" id="invoiceNumber" value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)}
                                   className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500" placeholder="F-2024-001" />
                        </div>
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-gray-400">Categoría</label>
                            <select id="category" value={category} onChange={e => setCategory(e.target.value as ExpenseEntry['category'])}
                                    className="mt-1 block w-full bg-gray-700 border-gray-600 rounded-md shadow-sm text-white focus:ring-blue-500 focus:border-blue-500">
                                <option>COGS</option>
                                <option>Personal</option>
                                <option>Alquiler/Suministros</option>
                                <option>Otros</option>
                            </select>
                        </div>
                        <button type="submit" disabled={isLoading} className="w-full inline-flex justify-center items-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-500">
                            Añadir Gasto
                        </button>
                    </form>
                    {localError && <p className="text-red-400 text-center text-sm mt-2">{localError}</p>}
                </div>
            </div>

            {/* History Column */}
            <div className="bg-gray-800 p-4 rounded-lg flex flex-col h-[calc(100vh-170px)]">
                <div className="flex justify-between items-center mb-4 sticky top-0 bg-gray-800 py-2 z-10">
                    <h2 className="text-xl font-bold text-white">Historial de Gastos</h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => {
                                if (!displayedExpenses.length) return;
                                const headers = 'Fecha,Concepto,Categoría,Importe,Nº Factura\n';
                                const csvData = displayedExpenses.map(s => `"${s.date}","${s.concept}","${s.category}",${s.amount.toFixed(2)},"${s.invoiceNumber || ''}"`).join('\n');
                                const blob = new Blob([headers + csvData], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement('a');
                                const url = URL.createObjectURL(blob);
                                link.setAttribute('href', url);
                                link.setAttribute('download', 'gastos.csv');
                                link.style.visibility = 'hidden';
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="text-xs font-bold px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-colors"
                        >
                            Descargar CSV
                        </button>
                        <button 
                            onClick={() => setShowAll(!showAll)}
                            className="text-xs font-bold px-3 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-full transition-colors"
                        >
                            {showAll ? 'Ver Turno Actual' : 'Ver Todos'}
                        </button>
                    </div>
                </div>
                 {displayedExpenses.length > 0 ? (
                    <div className="overflow-y-auto pr-2">
                        <ul className="space-y-3">
                            {displayedExpenses.map(entry => (
                                <li key={entry.id} className="bg-gray-700/50 p-3 rounded-md">
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 pr-2">
                                            <p className="font-semibold text-white">
                                                {entry.concept}
                                            </p>
                                            {entry.invoiceNumber && <span className="block text-[10px] text-gray-500 font-normal">Factura: {entry.invoiceNumber}</span>}
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <p className="font-bold text-red-400 whitespace-nowrap">{entry.amount.toFixed(2)}€</p>
                                            {entry.invoiceUrl && (
                                                <a 
                                                    href={entry.invoiceUrl} 
                                                    target="_blank" 
                                                    rel="noopener noreferrer"
                                                    className="p-1.5 bg-blue-600/20 text-blue-400 rounded hover:bg-blue-600/30 transition-colors"
                                                    title="Ver Factura"
                                                >
                                                    <HeaderIcon className="w-3.5 h-3.5" />
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-end text-xs mt-1">
                                        <p className="text-gray-400">{new Date(entry.date).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
                                        <p className="bg-gray-600 px-2 py-0.5 rounded-full text-gray-300">{entry.category}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                 ) : (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-gray-500">No hay gastos registrados.</p>
                    </div>
                 )}
            </div>

            {/* Duplicate Confirmation Modal */}
            {showDuplicateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-gray-800 border border-yellow-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
                        <div className="flex items-center gap-3 text-yellow-400 mb-4">
                            <div className="p-2 bg-yellow-400/10 rounded-lg">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold">Gasto Duplicado Detectado</h3>
                        </div>
                        <p className="text-gray-300 mb-6 leading-relaxed">
                            Este gasto parece ya estar registrado en el sistema (en el historial de gastos o en el inventario).
                            <br /><br />
                            ¿Deseas registrarlo de todas formas?
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    setShowDuplicateModal(false);
                                    setDuplicateAction(null);
                                }}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    if (duplicateAction) {
                                        if (duplicateAction.type === 'ai') {
                                            onAddExpenseWithAI(duplicateAction.data);
                                            removeFile();
                                        } else {
                                            onAddExpense(duplicateAction.data);
                                            setAmount('');
                                            setConcept('');
                                            setInvoiceNumber('');
                                            setLocalError(null);
                                        }
                                    }
                                    setShowDuplicateModal(false);
                                    setDuplicateAction(null);
                                }}
                                className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-yellow-900/20"
                            >
                                Registrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default GastosView;
