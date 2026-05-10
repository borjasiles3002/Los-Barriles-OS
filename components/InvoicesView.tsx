
import React, { useState } from 'react';
import { PurchaseRecord, StockItem, ExpenseEntry } from '../types';
import { callGemini } from '../services/geminiService';
import { UploadIcon, LoadingSpinner, ReceiptIcon, XIcon, RefreshIcon, HeaderIcon } from './icons';
import { compressImage } from '../utils/image';
import { storage, ref, uploadBytes, getDownloadURL } from '../src/firebase';
import useLocalStorage from '../useLocalStorage';

import { checkAndOpenKeySelector, hasAistudio } from '../utils/aistudio';

interface InvoicesViewProps {
    drinkStock: StockItem[];
    kitchenStock: StockItem[];
    onAddPurchase: (purchase: Omit<PurchaseRecord, 'id'>, invoiceUrl?: string) => void;
    purchaseHistory: PurchaseRecord[];
    expenseHistory: ExpenseEntry[];
    onRefresh: () => void;
    isRefreshing: boolean;
}

const InvoicesView: React.FC<InvoicesViewProps> = ({ drinkStock, kitchenStock, onAddPurchase, purchaseHistory, expenseHistory, onRefresh, isRefreshing }) => {
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [previewData, setPreviewData] = useLocalStorage<Omit<PurchaseRecord, 'id'> | null>('invoice_preview_data', null);
    const [previewFile, setPreviewFile] = useLocalStorage<{data: string, mimeType: string, name: string} | null>('invoice_preview_file', null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [pendingData, setPendingData] = useLocalStorage<Omit<PurchaseRecord, 'id'> | null>('invoice_pending_data', null);

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

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsAnalyzing(true);
        setError(null);
        setPreviewData(null);
        setPreviewFile(null);

        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                try {
                    let base64Data = (reader.result as string).split(',')[1];
                    let mimeType = file.type;

                    // Compress images to avoid mobile memory/timeout issues
                    if (mimeType.startsWith('image/')) {
                        try {
                            const compressed = await compressImage(base64Data, mimeType);
                            base64Data = compressed.data;
                            mimeType = compressed.mimeType;
                        } catch (compressErr) {
                            console.warn("Compression failed, using original image", compressErr);
                        }
                    }

                    setPreviewFile({ data: base64Data, mimeType, name: file.name });

                    const stockContext = [...drinkStock, ...kitchenStock]
                    .map(item => `- ${item.name} (Familia: ${item.family || 'N/A'})`)
                    .join('\n');

                const prompt = `
                    Analiza esta factura o albarán de compra para un restaurante con ALTA PRECISIÓN y RIGUROSIDAD EXTREMA.
                    Tu objetivo es extraer ABSOLUTAMENTE TODA la información de compra, sin omitir ni un solo artículo.

                    Extrae los siguientes datos:
                    1. Nombre del proveedor (supplierName).
                    2. Fecha de la factura (date) en formato YYYY-MM-DD.
                    3. Importe total (totalAmount) incluyendo impuestos.
                    4. Número de factura o albarán (invoiceNumber). Si no lo encuentras, usa null.
                    5. Lista detallada de productos (items):
                       - productName: Nombre del producto.
                       - quantity: Cantidad comprada.
                       - unitPrice: Precio unitario (sin impuestos si es posible). 
                         IMPORTANTE: Si el precio unitario no es legible, no aparece o no se puede calcular con seguridad, DEBES usar null.
                       - family: Clasificación del producto.

                    Contexto de stock actual (usa estos nombres si coinciden para mantener la sincronización):
                    ${stockContext}

                    Reglas de Oro para la extracción (SÍGUELAS A RAJATABLA):
                    - **Extracción Exhaustiva:** Debes extraer CADA LÍNEA de producto que aparezca en el documento. Si hay 20 artículos, debes devolver 20 artículos en el array 'items'. No resumas ni agrupes productos.
                    - **Clasificación Inteligente:** Clasifica CADA producto en una de estas categorías:
                      * BEBIDAS: Cervezas, Vinos, Refrescos, Licores, Cafés e Infusiones, Aguas, Destilados.
                      * COCINA: Carnes, Pescados, Pastas, Lácteos, Verduras, Frutas, Frutos Secos, Conservas, Especias, Aceites, Panadería.
                      * OTROS: Limpieza, Menaje, Suministros.
                    - Sé muy específico con la 'family'. Si es un vino, pon 'Vinos'. Si es carne de ternera, pon 'Carnes'.
                    - Si el producto ya existe en el stock proporcionado (mira la lista de arriba), usa EXACTAMENTE el mismo nombre y familia.

                    Devuelve SOLO un objeto JSON válido.
                `;

                try {
                    const response = await callGemini([{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType, data: base64Data } },
                            { text: prompt }
                        ]
                    }], '', {
                        responseMimeType: 'application/json',
                        responseSchema: {
                            type: 'OBJECT',
                            properties: {
                                supplierName: { type: 'STRING' },
                                date: { type: 'STRING' },
                                totalAmount: { type: 'NUMBER' },
                                invoiceNumber: { type: 'STRING', nullable: true },
                                items: {
                                    type: 'ARRAY',
                                    items: {
                                        type: 'OBJECT',
                                        properties: {
                                            productName: { type: 'STRING' },
                                            quantity: { type: 'NUMBER' },
                                            unitPrice: { type: 'NUMBER', nullable: true },
                                            family: { type: 'STRING' }
                                        },
                                        required: ['productName', 'quantity', 'family']
                                    }
                                }
                            },
                            required: ['supplierName', 'date', 'totalAmount', 'items']
                        }
                    }, 'gemini-3-flash-preview');

                    const text = response.text;
                    if (!text) throw new Error("No se recibió respuesta de la IA");
                    
                    const data = JSON.parse(text);
                    
                    // Check for duplicates in both purchase history and expense history
                    const isDuplicateInPurchases = purchaseHistory.some(p => 
                        (data.invoiceNumber && p.invoiceNumber === data.invoiceNumber && p.supplierName === data.supplierName) ||
                        (p.supplierName === data.supplierName && p.date === data.date && Math.abs(p.totalAmount - data.totalAmount) < 0.01)
                    );

                    const isDuplicateInExpenses = expenseHistory.some(e => 
                        (data.invoiceNumber && e.invoiceNumber === data.invoiceNumber) ||
                        (e.concept.toLowerCase().includes(data.supplierName.toLowerCase()) && Math.abs(e.amount - data.totalAmount) < 0.01)
                    );

                    if (isDuplicateInPurchases || isDuplicateInExpenses) {
                        setPendingData(data);
                        setShowDuplicateModal(true);
                        setIsAnalyzing(false);
                        return;
                    }

                    setPreviewData(data);
                } catch (err) {
                    const error = err as Error;
                    console.error("Detailed error analyzing invoice:", error);
                    
                    if (error.message === "MISSING_API_KEY") {
                        if (hasAistudio()) {
                            setError("Falta la clave de API. Por favor, selecciónala usando el botón de abajo.");
                        } else {
                            setError("Error de configuración: Clave de API no encontrada. Contacta con el administrador.");
                        }
                    } else if (error.message.includes("fetch") || error.message.includes("Network")) {
                        setError("Error de red. Comprueba tu conexión a internet (especialmente en el móvil).");
                    } else if (error.message.includes("429") || error.message.includes("quota")) {
                        setError("Se ha superado el límite de la IA. Por favor, espera un minuto e inténtalo de nuevo.");
                    } else {
                        setError(`Error al analizar: ${error.message || "Asegúrate de que la imagen sea clara"}.`);
                    }
                }
            } finally {
                setIsAnalyzing(false);
            }
        };
            reader.readAsDataURL(file);
        } catch {
            setError("Error al leer el archivo.");
            setIsAnalyzing(false);
        }
    };

    const handleUpdateUnitPrice = (index: number, newPrice: string) => {
        if (!previewData) return;
        const newItems = [...previewData.items];
        const val = parseFloat(newPrice);
        newItems[index] = { ...newItems[index], unitPrice: isNaN(val) ? null : val };
        setPreviewData({ ...previewData, items: newItems });
    };

    const confirmPurchase = async () => {
        if (previewData) {
            let invoiceUrl: string | undefined = undefined;
            if (previewFile) {
                setIsAnalyzing(true);
                invoiceUrl = await uploadToStorage(previewFile.data, previewFile.mimeType, previewFile.name);
                setIsAnalyzing(false);
            }
            onAddPurchase(previewData, invoiceUrl);
            setPreviewData(null);
            setPreviewFile(null);
            setSuccessMessage(`Factura de ${previewData.supplierName} guardada y stock actualizado correctamente.`);
            setTimeout(() => setSuccessMessage(null), 5000);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4">
            <div className="bg-gray-800 rounded-2xl p-8 border border-gray-700 shadow-xl mb-8 text-center">
                <ReceiptIcon />
                <h2 className="text-2xl font-bold text-white mt-4">Analizador de Facturas y Albaranes</h2>
                <p className="text-gray-400 mt-2 mb-6">Sube una foto o PDF de tu factura para actualizar el inventario automáticamente con IA de alta precisión.</p>
                
                <label className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl cursor-pointer transition-all transform hover:scale-105">
                    <UploadIcon />
                    <span>{isAnalyzing ? 'Analizando...' : 'Subir Factura / Albarán'}</span>
                    <input type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileUpload} disabled={isAnalyzing} />
                </label>

                <div className="mt-4 flex justify-center">
                    <button 
                        onClick={onRefresh}
                        disabled={isRefreshing}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all text-sm font-bold ${isRefreshing ? 'bg-gray-700 text-gray-500' : 'text-emerald-400 hover:bg-emerald-400/10 border border-emerald-500/30'}`}
                    >
                        {isRefreshing ? <LoadingSpinner /> : <RefreshIcon />}
                        <span>Actualizar datos (Escandallos, Stock, Gastos)</span>
                    </button>
                </div>

                {isAnalyzing && (
                    <div className="mt-6 flex flex-col items-center gap-2">
                        <LoadingSpinner />
                        <p className="text-blue-400 animate-pulse">Procesando imagen con Gemini 3.1 Pro...</p>
                    </div>
                )}

                {successMessage && <p className="mt-4 text-emerald-400 bg-emerald-400/10 p-3 rounded-lg border border-emerald-400/20 animate-fade-in">{successMessage}</p>}
                {error && (
                    <div className="mt-4 p-3 rounded-lg bg-red-400/10 border border-red-400/20">
                        <p className="text-red-400">{error}</p>
                        {error.includes("Falta la clave de API") && hasAistudio() && (
                            <button 
                                onClick={async () => {
                                    await checkAndOpenKeySelector();
                                    setError(null);
                                }}
                                className="mt-2 px-4 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
                            >
                                Seleccionar Clave de API
                            </button>
                        )}
                    </div>
                )}
            </div>

            {previewData && (
                <div className="bg-gray-800 rounded-2xl border border-blue-500/50 shadow-2xl overflow-hidden animate-fade-in">
                    <div className="p-6 border-b border-gray-700 bg-blue-500/10 flex justify-between items-center">
                        <div>
                            <h3 className="text-xl font-bold text-white">Revisión de Factura: {previewData.supplierName}</h3>
                            <p className="text-sm text-gray-400">
                                Fecha: {previewData.date} | Total: {previewData.totalAmount.toFixed(2)}€
                                {previewData.invoiceNumber && ` | Nº Factura: ${previewData.invoiceNumber}`}
                            </p>
                        </div>
                        <button onClick={() => setPreviewData(null)} className="text-gray-400 hover:text-white"><XIcon /></button>
                    </div>
                    
                    <div className="p-6">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="text-gray-400 text-sm border-b border-gray-700">
                                        <th className="pb-3 font-medium">Producto</th>
                                        <th className="pb-3 font-medium">Cantidad</th>
                                        <th className="pb-3 font-medium">Precio Un.</th>
                                        <th className="pb-3 font-medium">Familia</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {previewData.items.map((item, idx) => (
                                        <tr key={idx} className="text-gray-200 hover:bg-gray-700/30 transition-colors">
                                            <td className="py-3 px-2">{item.productName}</td>
                                            <td className="py-3 px-2">{item.quantity}</td>
                                            <td className="py-3 px-2">
                                                <div className="flex items-center gap-1">
                                                    <input 
                                                        type="number" 
                                                        step="0.01"
                                                        value={item.unitPrice === null || item.unitPrice === undefined ? '' : item.unitPrice}
                                                        onChange={(e) => handleUpdateUnitPrice(idx, e.target.value)}
                                                        className="w-24 px-2 py-1 bg-gray-900 border border-gray-600 rounded text-right text-sm text-gray-200 focus:outline-none focus:border-blue-500 transition-colors"
                                                        placeholder="0.00"
                                                    />
                                                    <span className="text-gray-400">€</span>
                                                </div>
                                            </td>
                                            <td className="py-3 px-2">
                                                <span className="px-2 py-1 bg-gray-700 rounded text-xs text-gray-300">{item.family}</span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        
                        <div className="mt-8 flex justify-end gap-4">
                            <button onClick={() => setPreviewData(null)} className="px-6 py-2 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700">Cancelar</button>
                            <button onClick={confirmPurchase} disabled={isAnalyzing} className={`px-8 py-2 font-bold rounded-lg shadow-lg ${isAnalyzing ? 'bg-gray-600 text-gray-400 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 shadow-green-900/20'}`}>{isAnalyzing ? 'Guardando...' : 'Confirmar y Guardar en Stock'}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Duplicate Confirmation Modal */}
            {showDuplicateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-gray-800 border border-yellow-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
                        <div className="flex items-center gap-3 text-yellow-400 mb-4">
                            <ReceiptIcon className="w-8 h-8" />
                            <h3 className="text-xl font-bold">Factura Duplicada Detectada</h3>
                        </div>
                        <p className="text-gray-300 mb-6 leading-relaxed">
                            Esta factura de <span className="text-white font-bold">{pendingData?.supplierName}</span> por <span className="text-white font-bold">{pendingData?.totalAmount.toFixed(2)}€</span> parece ya estar registrada en el sistema (inventario o gastos).
                            <br /><br />
                            ¿Deseas continuar con la revisión de todas formas?
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => {
                                    setShowDuplicateModal(false);
                                    setPendingData(null);
                                }}
                                className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white font-bold rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => {
                                    if (pendingData) setPreviewData(pendingData);
                                    setShowDuplicateModal(false);
                                    setPendingData(null);
                                }}
                                className="flex-1 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white font-bold rounded-xl transition-colors shadow-lg shadow-yellow-900/20"
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-12">
                <h3 className="text-xl font-bold text-white mb-4">Historial Reciente de Compras</h3>
                <div className="grid gap-4">
                    {purchaseHistory.slice(0, 10).map(purchase => (
                        <div key={purchase.id} className="bg-gray-800/50 p-4 rounded-xl border border-gray-700 flex justify-between items-center">
                            <div className="flex items-center gap-4">
                                <div className="p-2 bg-gray-700 rounded-lg">
                                    <ReceiptIcon className="w-5 h-5 text-blue-400" />
                                </div>
                                <div>
                                    <p className="font-bold text-white">{purchase.supplierName}</p>
                                    <p className="text-xs text-gray-400">{purchase.date} • {purchase.items.length} productos</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                {purchase.invoiceUrl && (
                                    <a 
                                        href={purchase.invoiceUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="p-2 bg-blue-600/20 text-blue-400 rounded-lg hover:bg-blue-600/30 transition-colors"
                                        title="Ver Factura"
                                    >
                                        <HeaderIcon className="w-4 h-4" />
                                    </a>
                                )}
                                <p className="font-bold text-emerald-400">{purchase.totalAmount.toFixed(2)}€</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default InvoicesView;
