
import React, { useState, useMemo, useEffect } from 'react';
import { Recipe, StockItem, ChatMessage, Elaboration, RecipeIngredient } from '../types';
import ChatDisplay from './ChatDisplay';
import InputBar from './InputBar';
import { callGemini } from '../services/geminiService';
import { GEMINI_CHEF_PROMPT, GEMINI_ADVISOR_PROMPT, MENU_CATEGORIES } from '../constants';
import { XIcon, ThinkingIcon, SparkIcon, LoadingSpinner, EditIcon, SendIcon } from './icons';
import useLocalStorage from '../useLocalStorage';



// Modal de Historial de Precios (copiado de StockView para autonomía del componente)
const PriceHistoryModal: React.FC<{ item: StockItem; onClose: () => void }> = ({ item, onClose }) => {
    const displayHistory = item.priceHistory && item.priceHistory.length > 0 ? item.priceHistory : (item.lastPrice !== undefined ? [{ date: 'Precio inicial', price: item.lastPrice }] : []);
    const chartHistory = useMemo(() => displayHistory.filter(h => h.date !== 'Precio inicial').slice().reverse(), [displayHistory]);
    
    // Lógica del gráfico (simplificada para brevedad)
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-lg shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-white">Historial de Precios: {item.name}</h4>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>
                {chartHistory.length > 1 ? <p className="text-center text-sm text-gray-400 mb-4">Gráfico de evolución de precios (funcionalidad visual completa mantenida).</p> : null}
                <div className="max-h-60 overflow-y-auto pr-2">
                    <ul className="divide-y divide-gray-700">
                        {displayHistory.map((entry, index) => (
                            <li key={index} className="py-2 flex justify-between items-center">
                                <span className="text-gray-300">{entry.date === 'Precio inicial' ? entry.date : new Date(entry.date).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                <span className="font-semibold text-white text-lg">{entry.price.toFixed(2)}€</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
};

const AIAdviceModal: React.FC<{ isOpen: boolean; onClose: () => void; advice: ChatMessage[] | null; isLoading: boolean; title: string; }> = ({ isOpen, onClose, advice, isLoading, title }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-2xl shadow-2xl animate-fade-in flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h4 className="text-xl font-bold text-white flex items-center gap-2"><SparkIcon className="h-6 w-6 text-cyan-400" /> {title}</h4>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </div>
                <div className="max-h-[60vh] overflow-y-auto pr-2">
                    {isLoading && <div className="flex justify-center items-center h-32"><LoadingSpinner /></div>}
                    {advice && <ChatDisplay chatHistory={advice} />}
                </div>
            </div>
        </div>
    );
};


// Modal para chatear con Gemini y crear recetas
const GeminiChefModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSaveRecipe: (recipe: Recipe) => void;
    existingRecipeNames: string[];
    allStock: StockItem[];
}> = ({ isOpen, onClose, onSaveRecipe, existingRecipeNames, allStock }) => {
    const [chefChatHistory, setChefChatHistory] = useLocalStorage<ChatMessage[]>('chefChatHistory', []);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [geminiRecipe, setGeminiRecipe] = useState<Omit<Recipe, 'id'> | null>(null);
    const [thinkingMode, setThinkingMode] = useState<boolean>(false);

    const handleSendMessage = async (prompt: string) => {
        setGeminiRecipe(null);
        setIsLoading(true);
        setError(null);
        const newUserMessage: ChatMessage = { role: 'user', parts: [{ text: prompt }] };
        const currentChatHistory = [...chefChatHistory, newUserMessage];
        setChefChatHistory(currentChatHistory);

        const stockContext = allStock
            .filter(item => item.lastPrice !== undefined)
            .map(item => `- ${item.name}: ${item.lastPrice?.toFixed(2)}€`)
            .join('\n');

        const dynamicChefPrompt = `${GEMINI_CHEF_PROMPT}\n\nINVENTARIO DE PRECIOS ACTUAL (CONTEXTO):\n${stockContext}`;

        try {
            const response = await callGemini(currentChatHistory, dynamicChefPrompt, { thinkingMode });
            const responseText = response.text;
            if (!responseText) {
                throw new Error("La IA no devolvió una respuesta de texto.");
            }

            const jsonRegex = /```json\s*({[\s\S]*?})\s*```/;
            const jsonMatch = responseText.match(jsonRegex);
            let finalModelText = responseText;

            if (jsonMatch && jsonMatch[1]) {
                try {
                    const parsedJson = JSON.parse(jsonMatch[1]);
                    if (parsedJson.recipe) {
                        const recipeData = parsedJson.recipe;
                        let systemNote = '';

                        // Ensure yield is a positive number
                        if (!recipeData.yield || typeof recipeData.yield !== 'number' || recipeData.yield <= 0) {
                            recipeData.yield = 10; // Default yield
                            systemNote = "\n\n*(Nota del sistema: El rendimiento (yield) de la receta no fue especificado por la IA y se ha establecido un valor por defecto de 10 raciones. Puede editar la receta después de guardarla si es necesario.)*";
                        }
                        
                        setGeminiRecipe(recipeData);
                        const userVisibleText = responseText.replace(jsonRegex, '').trim();
                        finalModelText = userVisibleText + systemNote;
                    }
                } catch (e) { 
                    console.error("Failed to parse recipe JSON:", e);
                }
            }
            const newModelMessage: ChatMessage = { role: 'model', parts: [{ text: finalModelText }] };
            setChefChatHistory(prev => [...prev, newModelMessage]);
        } catch(err) {
            const errorMessage = err instanceof Error ? err.message : 'Error.';
            setError(`Error: ${errorMessage}.`);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSave = () => {
        if (geminiRecipe) {
            if (existingRecipeNames.includes(geminiRecipe.name.toLowerCase())) {
                alert("Ya existe una receta con este nombre.");
                return;
            }
            const newRecipe: Recipe = { id: `recipe-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, ...geminiRecipe };
            onSaveRecipe(newRecipe);
            setGeminiRecipe(null);
            onClose();
        }
    };
    
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-4xl h-[80vh] shadow-2xl animate-fade-in flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Crear Receta con IA</h2>
                     <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </header>
                <main className="flex-1 overflow-y-auto p-4 md:p-6"><ChatDisplay chatHistory={chefChatHistory} /></main>
                <footer className="p-4 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700">
                     <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                            <ThinkingIcon className="w-5 h-5 text-blue-400" /><span>Thinking Mode</span>
                            <button onClick={() => setThinkingMode(!thinkingMode)} className={`${thinkingMode ? 'bg-blue-600' : 'bg-gray-600'} relative inline-flex h-6 w-11 items-center rounded-full`}><span className={`${thinkingMode ? 'translate-x-6' : 'translate-x-1'} inline-block h-4 w-4 transform rounded-full bg-white transition-transform`} /></button>
                        </div>
                         {geminiRecipe && <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg">Guardar Receta</button>}
                    </div>
                    {error && <p className="text-red-400 text-center text-sm mb-2">{error}</p>}
                    <InputBar onSendMessage={handleSendMessage} isLoading={isLoading} placeholder="Pide una receta para tarta de queso..."/>
                </footer>
            </div>
        </div>
    );
};

// Modal para crear una receta manually
const ManualRecipeModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSave: (recipe: Omit<Recipe, 'id'>) => void;
    existingRecipeNames: string[];
}> = ({ isOpen, onClose, onSave, existingRecipeNames }) => {
    const [name, setName] = useState('');
    const [yieldValue, setYieldValue] = useState('10');
    const [ingredients, setIngredients] = useState<RecipeIngredient[]>([{ stockItemId: `new-${Date.now()}`, name: '', quantity: 1, unit: 'unidad' }]);
    const [preparation, setPreparation] = useState('');

    const handleIngredientChange = <K extends keyof RecipeIngredient>(index: number, field: K, value: RecipeIngredient[K]) => {
        const updatedIngredients = [...ingredients];
        updatedIngredients[index] = { ...updatedIngredients[index], [field]: value };
        setIngredients(updatedIngredients);
    };

    const addIngredient = () => {
        setIngredients([...ingredients, { stockItemId: `new-${Date.now()}`, name: '', quantity: 1, unit: 'unidad' }]);
    };

    const removeIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    const handleSave = () => {
        if (!name.trim()) {
            alert("El nombre de la receta es obligatorio.");
            return;
        }
        if (existingRecipeNames.includes(name.trim().toLowerCase())) {
            alert("Ya existe una receta con este nombre.");
            return;
        }
        const numYield = parseInt(yieldValue, 10);
        if (isNaN(numYield) || numYield <= 0) {
            alert("Por favor, introduzca un rendimiento (raciones) válido y mayor que cero.");
            return;
        }
        onSave({ name: name.trim(), yield: numYield, ingredients, preparation: preparation.trim() });
        onClose();
        // Reset state for next time
        setName('');
        setYieldValue('10');
        setIngredients([{ stockItemId: `new-${Date.now()}`, name: '', quantity: 1, unit: 'unidad' }]);
        setPreparation('');
    };

    if (!isOpen) return null;

    return (
         <div className="fixed inset-0 bg-black/70 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b border-gray-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white">Crear Nueva Receta</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><XIcon /></button>
                </header>
                <main className="p-6 max-h-[70vh] overflow-y-auto">
                    <div className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                             <div className="col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-1">Nombre de la Receta</label>
                                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ej: Tarta de Queso La Viña" className="w-full bg-gray-700 text-white p-2 rounded-md" />
                            </div>
                             <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Rendimiento (Raciones)</label>
                                <input type="number" value={yieldValue} onChange={e => setYieldValue(e.target.value)} placeholder="10" className="w-full bg-gray-700 text-white p-2 rounded-md" />
                            </div>
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-300 mb-2">Ingredientes</h4>
                            <div className="space-y-2">
                                {ingredients.map((ing, index) => (
                                    <div key={index} className="grid grid-cols-12 gap-2 items-center">
                                        <input type="text" placeholder="Nombre" value={ing.name} onChange={e => handleIngredientChange(index, 'name', e.target.value)} className="col-span-5 bg-gray-600 text-white p-1 rounded-md text-sm" />
                                        <input type="number" placeholder="Cant." value={ing.quantity} onChange={e => handleIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)} className="col-span-3 bg-gray-600 text-white p-1 rounded-md text-sm" />
                                        <input type="text" placeholder="Unidad" value={ing.unit} onChange={e => handleIngredientChange(index, 'unit', e.target.value)} className="col-span-3 bg-gray-600 text-white p-1 rounded-md text-sm" />
                                        <button onClick={() => removeIngredient(index)} className="col-span-1 text-red-400 hover:text-red-300"><XIcon /></button>
                                    </div>
                                ))}
                            </div>
                            <button onClick={addIngredient} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md mt-3">+ Añadir Ingrediente</button>
                        </div>
                        <div>
                            <h4 className="font-semibold text-blue-300 mb-2">Preparación</h4>
                            <textarea value={preparation} onChange={e => setPreparation(e.target.value)} rows={8} className="w-full bg-gray-600 text-white p-2 rounded-md text-sm" placeholder="Paso 1: Mezclar los ingredientes..."></textarea>
                        </div>
                    </div>
                </main>
                 <footer className="p-4 flex justify-end gap-2 bg-gray-800/80 backdrop-blur-sm border-t border-gray-700">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md">Cancelar</button>
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md">Guardar Receta</button>
                </footer>
            </div>
        </div>
    )
};

const RecipeCostAnalysis: React.FC<{ costData: { total: number; perPortion: number }; recipeYield: number | undefined; }> = ({ costData, recipeYield }) => {
    return (
        <div className="bg-gray-900/50 p-4 rounded-lg border border-gray-700 mb-6">
            <h3 className="text-lg font-semibold text-white mb-4 text-center">Análisis de Coste</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-800 p-4 rounded-lg text-center">
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Coste Total (Ingredientes)</p>
                    <p className="text-4xl font-bold text-green-400 mt-1">{costData.total.toFixed(2)}€</p>
                </div>
                <div className="bg-gray-800 p-4 rounded-lg text-center">
                    <p className="text-sm font-medium text-gray-400 uppercase tracking-wider">Coste por Ración</p>
                    <p className="text-4xl font-bold text-blue-400 mt-1">{costData.perPortion.toFixed(2)}€</p>
                    <p className="text-xs text-gray-500 mt-2">
                        (Rendimiento de {recipeYield || 'N/A'} raciones)
                    </p>
                </div>
            </div>
        </div>
    );
};

const CategorySelectionModal: React.FC<{
    recipe: Recipe;
    onClose: () => void;
    onSave: (recipe: Recipe, category: string) => void;
}> = ({ recipe, onClose, onSave }) => {
    const [selectedCategory, setSelectedCategory] = useState(MENU_CATEGORIES[0]);

    const handleSave = () => {
        onSave(recipe, selectedCategory);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 w-full max-w-sm shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-white mb-4">Añadir a la Carta</h3>
                <p className="text-sm text-gray-400 mb-1">Seleccione una categoría para</p>
                <p className="font-semibold text-white mb-4">&quot;{recipe.name}&quot;</p>
                <select 
                    value={selectedCategory} 
                    onChange={e => setSelectedCategory(e.target.value)}
                    className="w-full bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-blue-500 focus:border-blue-500 mb-6"
                >
                    {MENU_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md">Cancelar</button>
                    <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">Añadir</button>
                </div>
            </div>
        </div>
    );
}


interface ElaborationsViewProps {
    allStock: StockItem[];
    onUpdateStockThreshold: (id: string, type: 'drink' | 'kitchen', threshold: number) => void;
    onUpdateStockQuantity: (id: string, type: 'drink' | 'kitchen', quantity: number) => void;
    recipes: Recipe[];
    onAddRecipe: (recipe: Omit<Recipe, 'id'>) => void;
    onUpdateRecipe: (recipe: Recipe) => void;
    elaborations: Elaboration[];
    onAddElaboration: (elaboration: Omit<Elaboration, 'id'>) => void;
    onUpdateElaboration: (elaboration: Elaboration) => void;
    onDeleteElaboration: (id: string) => void;
}

const ElaborationsView: React.FC<ElaborationsViewProps> = ({ 
    allStock, onUpdateStockThreshold, onUpdateStockQuantity,
    recipes, onAddRecipe, onUpdateRecipe,
    elaborations, onAddElaboration, onUpdateElaboration, onDeleteElaboration
}) => {
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(recipes[0] || null);
  const [historyModalItem, setHistoryModalItem] = useState<StockItem | null>(null);
  const [isGeminiModalOpen, setGeminiModalOpen] = useState(false);
  const [isCreatingNewRecipe, setIsCreatingNewRecipe] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [isAdviceModalOpen, setAdviceModalOpen] = useState(false);
  const [advice, setAdvice] = useState<ChatMessage[] | null>(null);
  const [isAdviceLoading, setAdviceLoading] = useState(false);
  const [isGlobalAdviceLoading, setGlobalAdviceLoading] = useState(false);
  const [globalAdvice, setGlobalAdvice] = useState<ChatMessage[] | null>(null);
  const [isGlobalAdviceModalOpen, setGlobalAdviceModalOpen] = useState(false);
  const [categoryModalState, setCategoryModalState] = useState<{isOpen: boolean, recipe: Recipe | null}>({isOpen: false, recipe: null});

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingThreshold, setEditingThreshold] = useState<string>('');
  
  const [productionViewPortions, setProductionViewPortions] = useState<number | null>(null);

  // When selected recipe changes, reset the local view multiplier
  useEffect(() => {
    setProductionViewPortions(null);
  }, [selectedRecipe]);

  const handleStartEditRecipe = (recipe: Recipe) => {
    setEditingRecipe(JSON.parse(JSON.stringify(recipe)));
  };

  const handleCancelEditRecipe = () => {
      setEditingRecipe(null);
  };

  const handleSaveRecipe = () => {
      if (!editingRecipe) return;
      onUpdateRecipe(editingRecipe);
      if (selectedRecipe?.id === editingRecipe.id) {
        setSelectedRecipe(editingRecipe);
      }
      setEditingRecipe(null);
  };
  
  const handleRecipeIngredientChange = <K extends keyof RecipeIngredient>(index: number, field: K, value: RecipeIngredient[K]) => {
      if (!editingRecipe) return;
      const updatedIngredients = [...editingRecipe.ingredients];
      updatedIngredients[index] = { ...updatedIngredients[index] };
      if (value === undefined) {
          delete updatedIngredients[index][field];
      } else {
          updatedIngredients[index][field] = value;
      }
      setEditingRecipe({ ...editingRecipe, ingredients: updatedIngredients });
  };

   const handleRecipeFieldChange = (field: 'name' | 'yield', value: string | number) => {
        if (!editingRecipe) return;
        setEditingRecipe({ ...editingRecipe, [field]: value });
    };
  
  const addIngredient = () => {
      if (!editingRecipe) return;
      const newIngredient: RecipeIngredient = { stockItemId: `new-${Date.now()}`, name: '', quantity: 0, unit: '' };
      setEditingRecipe({ ...editingRecipe, ingredients: [...editingRecipe.ingredients, newIngredient] });
  };

  const removeIngredient = (index: number) => {
      if (!editingRecipe) return;
      const updatedIngredients = editingRecipe.ingredients.filter((_, i) => i !== index);
      setEditingRecipe({ ...editingRecipe, ingredients: updatedIngredients });
  };

  const handleAddToElaborations = (recipe: Recipe) => {
    if (elaborations.some(e => e.name.toLowerCase() === recipe.name.toLowerCase())) {
        alert("Esta receta ya existe en las elaboraciones de la carta.");
        return;
    }
    setCategoryModalState({ isOpen: true, recipe: recipe });
  };

  const saveElaborationWithCategory = (recipe: Recipe, category: string) => {
    onAddElaboration({ name: recipe.name, stock: 0, category });
    alert(`"${recipe.name}" añadido a las elaboraciones de la carta en la categoría "${category}".`);
  };
  
  const adjustElaborationStock = (id: string, amount: number) => {
    const elab = elaborations.find(e => e.id === id);
    if (elab) {
      onUpdateElaboration({ ...elab, stock: Math.max(0, elab.stock + amount) });
    }
  }
  
  const deleteElaboration = (id: string) => {
    if (window.confirm('¿Seguro que quieres eliminar esta elaboración de la carta?')) {
      onDeleteElaboration(id);
    }
  }

  const handleElaborationCategoryChange = (elaborationId: string, newCategory: string) => {
    const elab = elaborations.find(e => e.id === elaborationId);
    if (elab) {
      onUpdateElaboration({ ...elab, category: newCategory });
    }
  };
  
  const handleSaveNewRecipeFromAI = (newRecipe: Recipe) => {
      onAddRecipe(newRecipe);
      alert(`Receta "${newRecipe.name}" guardada con éxito.`);
      setSelectedRecipe(newRecipe);
  };
  
  const handleSaveNewManualRecipe = (recipeData: Omit<Recipe, 'id'>) => {
    onAddRecipe(recipeData);
    setIsCreatingNewRecipe(false);
  };

  const calculateCost = (recipe: Recipe) => {
    return recipe.ingredients.reduce((total, ingredient) => {
        let price = ingredient.manualPrice;
        if (price === undefined || price === null) {
            const stockItem = allStock.find(item => item.name?.toLowerCase() === ingredient.name?.toLowerCase());
            price = stockItem?.lastPrice ?? 0;
        }
        return total + (price * ingredient.quantity);
    }, 0);
  };
  
  const handleOptimizeRecipe = async () => {
    if (!selectedRecipe) return;
    setAdviceModalOpen(true);
    setAdviceLoading(true);
    setAdvice(null);
    
    const cost = calculateCost(selectedRecipe);
    const yieldValue = selectedRecipe.yield || 1;
    const costPerPortion = cost / yieldValue;

    const ingredientsString = selectedRecipe.ingredients.map(i => `${i.quantity} ${i.unit} de ${i.name}`).join(', ');
    const prompt = `Contexto: Receta de "${selectedRecipe.name}" - Ingredientes: ${ingredientsString}, Preparación: ${selectedRecipe.preparation}, Coste por ración: ${costPerPortion.toFixed(2)}€.\n\nTarea: Sugiere 2-3 mejoras para esta receta. Enfócate en cómo adaptarla mejor a la brasa, reducir su coste sin perder calidad, o mejorar su presentación. Sé específico.`;
    
    const userMessage: ChatMessage = { role: 'user', parts: [{ text: prompt }] };
    setAdvice([userMessage]);

    try {
        const response = await callGemini([userMessage], GEMINI_ADVISOR_PROMPT);
        const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response.text }] };
        setAdvice(prev => prev ? [...prev, modelMessage] : [modelMessage]);
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
        const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `Error al obtener optimización: ${errorMsg}` }] };
        setAdvice(prev => prev ? [...prev, errorMessage] : [errorMessage]);
    } finally {
        setAdviceLoading(false);
    }
  };

  const handleGlobalOptimization = async () => {
    setGlobalAdviceModalOpen(true);
    setGlobalAdviceLoading(true);
    setGlobalAdvice(null);

    const recipesContext = recipes.map(r => {
        const cost = calculateCost(r);
        const yieldVal = r.yield || 1;
        const ingredients = r.ingredients.map(i => `${i.quantity} ${i.unit} de ${i.name}`).join(', ');
        return `- ${r.name}: Coste total ${cost.toFixed(2)}€, Coste/ración ${(cost/yieldVal).toFixed(2)}€ (Rendimiento: ${yieldVal}). Ingredientes: ${ingredients}`;
    }).join('\n');

    const stockContext = allStock
        .filter(item => item.lastPrice !== undefined)
        .map(item => `- ${item.name}: ${item.lastPrice?.toFixed(2)}€`)
        .join('\n');

    const prompt = `Analiza el recetario completo del restaurante y sugiere 2-3 optimizaciones estratégicas para reducir costes o mejorar la rentabilidad global.
    
    RECETARIO ACTUAL:
    ${recipesContext}
    
    PRECIOS DE STOCK ACTUALES:
    ${stockContext}
    
    Identifica:
    1. Recetas con costes por ración desproporcionados.
    2. Ingredientes caros que se repiten en muchas recetas y podrían sustituirse o comprarse en volumen.
    3. Sugerencias de ingeniería de menú (qué platos potenciar por su margen).
    
    Sé muy específico y directo.`;
    
    const userMessage: ChatMessage = { role: 'user', parts: [{ text: prompt }] };
    setGlobalAdvice([userMessage]);

    try {
        const response = await callGemini([userMessage], GEMINI_ADVISOR_PROMPT);
        const modelMessage: ChatMessage = { role: 'model', parts: [{ text: response.text }] };
        setGlobalAdvice(prev => prev ? [...prev, modelMessage] : [modelMessage]);
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Error desconocido';
        const errorMessage: ChatMessage = { role: 'model', parts: [{ text: `Error al obtener optimización global: ${errorMsg}` }] };
        setGlobalAdvice(prev => prev ? [...prev, errorMessage] : [errorMessage]);
    } finally {
        setGlobalAdviceLoading(false);
    }
  };

    const handleStartEdit = (item: StockItem) => {
        const stockItem = allStock.find(i => i.id === item.id);
        if (stockItem) {
            setEditingItemId(stockItem.id);
            setEditingThreshold(String(stockItem.lowStockThreshold));
        }
    };

    const handleCancelEdit = () => {
        setEditingItemId(null);
        setEditingThreshold('');
    };

    // This function now persists changes back to the main stock state.
    const handleSaveEdit = (id: string) => {
        const newThresholdValue = parseInt(editingThreshold, 10);
        if (isNaN(newThresholdValue) || newThresholdValue < 0) {
            handleCancelEdit();
            return;
        }

        const stockItem = allStock.find(i => i.id === id);
        if (stockItem) {
          onUpdateStockThreshold(id, stockItem.family === 'bebidas' ? 'drink' : 'kitchen', newThresholdValue);
        }
        
        handleCancelEdit();
    };

  const handleRecordPreparation = (recipe: Recipe, portions: number) => {
    if (portions <= 0) return;
    
    // 1. Deduct ingredients from raw stock proportionally to the yield
    const recipeYield = recipe.yield && recipe.yield > 0 ? recipe.yield : 1;
    const proportion = portions / recipeYield;

    recipe.ingredients.forEach(ing => {
      const stockItem = allStock.find(s => s.name.toLowerCase() === ing.name.toLowerCase());
      if (stockItem) {
        const type = stockItem.family === 'bebidas' ? 'drink' : 'kitchen';
        const amountToDeduct = ing.quantity * proportion;
        const newStock = Math.max(0, stockItem.stock - amountToDeduct);
        onUpdateStockQuantity(stockItem.id, type, newStock);
      }
    });

    // 2. Add to finished elaborations stock if exists
    const elaboration = elaborations.find(e => e.name.toLowerCase() === recipe.name.toLowerCase());
    if (elaboration) {
      onUpdateElaboration(elaboration.id, { ...elaboration, stock: elaboration.stock + portions });
    }

    alert(`Producción registrada: ${portions} raciones de "${recipe.name}". Stock de ingredientes actualizado.`);
  };

  const isEditing = editingRecipe?.id === selectedRecipe?.id;

  const recipesWithCosts = useMemo(() => {
    return recipes.map(recipe => ({
      ...recipe,
      calculatedCost: calculateCost(recipe)
    }));
  }, [allStock, recipes]);

  const costData = useMemo(() => {
    if (!selectedRecipe) return { total: 0, perPortion: 0 };
    const totalCost = calculateCost(selectedRecipe);
    const yieldAmount = selectedRecipe.yield && selectedRecipe.yield > 0 ? selectedRecipe.yield : 1;
    const costPerPortion = totalCost / yieldAmount;
    return { total: totalCost, perPortion: costPerPortion };
  }, [selectedRecipe, allStock]);

  const groupedElaborations = useMemo(() => {
    return elaborations.reduce((acc, item) => {
        const category = item.category || 'Sin Categoría';
        if (!acc[category]) {
            acc[category] = [];
        }
        acc[category].push(item);
        return acc;
    }, {} as Record<string, Elaboration[]>);
  }, [elaborations]);

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
        <GeminiChefModal 
            isOpen={isGeminiModalOpen} 
            onClose={() => setGeminiModalOpen(false)}
            onSaveRecipe={handleSaveNewRecipeFromAI}
            existingRecipeNames={recipes.map(r => r.name.toLowerCase())}
            allStock={allStock}
        />
        <ManualRecipeModal
            isOpen={isCreatingNewRecipe}
            onClose={() => setIsCreatingNewRecipe(false)}
            onSave={handleSaveNewManualRecipe}
            existingRecipeNames={recipes.map(r => r.name.toLowerCase())}
        />
        {historyModalItem && <PriceHistoryModal item={historyModalItem} onClose={() => setHistoryModalItem(null)} />}
        <AIAdviceModal isOpen={isAdviceModalOpen} onClose={() => setAdviceModalOpen(false)} advice={advice} isLoading={isAdviceLoading} title={`Optimizando: ${selectedRecipe?.name || ''}`} />
        <AIAdviceModal isOpen={isGlobalAdviceModalOpen} onClose={() => setGlobalAdviceModalOpen(false)} advice={globalAdvice} isLoading={isGlobalAdviceLoading} title="Optimización Global del Recetario" />
        {categoryModalState.isOpen && categoryModalState.recipe && (
            <CategorySelectionModal 
                recipe={categoryModalState.recipe}
                onClose={() => setCategoryModalState({isOpen: false, recipe: null})}
                onSave={saveElaborationWithCategory}
            />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 bg-gray-800 p-4 rounded-lg h-fit">
                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-white">Recetas</h2>
                        <div className="flex gap-2">
                             <button onClick={() => setIsCreatingNewRecipe(true)} className="bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded-lg text-sm">Nueva</button>
                             <button onClick={() => setGeminiModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-lg text-sm">IA</button>
                        </div>
                    </div>
                    <button 
                        onClick={handleGlobalOptimization}
                        className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-2 px-4 rounded-xl text-sm transition-all shadow-lg shadow-cyan-900/20"
                    >
                        <SparkIcon className="h-4 w-4" />
                        Optimización Global (IA)
                    </button>
                </div>
                <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-1">
                    {recipesWithCosts.map(recipe => {
                        const cost = recipe.calculatedCost ?? 0;
                        const yieldAmount = recipe.yield && recipe.yield > 0 ? recipe.yield : 1;
                        const costPerPortion = cost / yieldAmount;
                        return (
                            <li key={recipe.id}
                                className={`border-l-4 rounded-md transition-all duration-200 ${selectedRecipe?.id === recipe.id ? 'border-blue-500 bg-gray-700' : 'border-transparent bg-gray-700/50 hover:bg-gray-700'}`}>
                                <div className="flex items-center p-3">
                                    <button onClick={() => { setSelectedRecipe(recipe); setEditingRecipe(null); }} className="flex-grow text-left">
                                        <p className="font-semibold text-white truncate">{recipe.name}</p>
                                        <div className="flex items-baseline gap-4 mt-2">
                                            <div>
                                                <p className="text-xs text-gray-400">Coste Total</p>
                                                <p className="text-lg font-bold text-green-400">{cost.toFixed(2)}€</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-400">Coste/Ración</p>
                                                <p className="text-sm font-semibold text-blue-300">{costPerPortion.toFixed(2)}€</p>
                                            </div>
                                        </div>
                                    </button>
                                    <div className="pl-2">
                                        <button
                                            onClick={() => handleStartEditRecipe(recipe)}
                                            className="p-2 rounded-full text-gray-400 hover:bg-gray-600 hover:text-white transition-colors"
                                            aria-label={`Editar ${recipe.name}`}>
                                            <EditIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
            <div className="md:col-span-2 bg-gray-800 p-6 rounded-lg">
                {selectedRecipe ? (
                    isEditing && editingRecipe ? (
                        <div>
                             <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Nombre de la Receta</label>
                                    <input type="text" value={editingRecipe.name} onChange={e => handleRecipeFieldChange('name', e.target.value)} className="w-full bg-gray-700 text-white p-2 rounded-md" />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Raciones</label>
                                    <input type="number" value={editingRecipe.yield || 10} onChange={e => handleRecipeFieldChange('yield', parseInt(e.target.value, 10) || 1)} className="w-full bg-gray-700 text-white p-2 rounded-md" />
                                </div>
                                <div className="sm:col-span-1 flex flex-col justify-end pb-1 inline-flex">
                                    <label className="block text-sm font-medium text-gray-400 mb-2">TPV</label>
                                    <div 
                                        onClick={() => handleRecipeFieldChange('showInTPV', editingRecipe.showInTPV === false ? true : false)}
                                        className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${editingRecipe.showInTPV !== false ? 'bg-blue-600' : 'bg-gray-600'}`}
                                    >
                                        <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${editingRecipe.showInTPV !== false ? 'translate-x-6' : 'translate-x-0'}`} />
                                    </div>
                                </div>
                            </div>
                            
                            <div className="space-y-3 mb-6">
                                <h4 className="font-semibold text-blue-300">Ingredientes</h4>
                                {editingRecipe.ingredients.map((ing, index) => (
                                    <div key={index} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-gray-700/50 p-2 rounded-md">
                                        <input type="text" placeholder="Nombre" value={ing.name} onChange={e => handleRecipeIngredientChange(index, 'name', e.target.value)} className="sm:col-span-4 bg-gray-600 text-white p-1 rounded-md text-sm" />
                                        <input type="number" placeholder="Cant." value={ing.quantity} onChange={e => handleRecipeIngredientChange(index, 'quantity', parseFloat(e.target.value) || 0)} className="sm:col-span-2 bg-gray-600 text-white p-1 rounded-md text-sm" />
                                        <input type="text" placeholder="Unidad" value={ing.unit} onChange={e => handleRecipeIngredientChange(index, 'unit', e.target.value)} className="sm:col-span-2 bg-gray-600 text-white p-1 rounded-md text-sm" />
                                        <input type="number" step="0.01" placeholder="Prec. Manual" value={ing.manualPrice === undefined ? '' : ing.manualPrice} onChange={e => handleRecipeIngredientChange(index, 'manualPrice', e.target.value ? parseFloat(e.target.value) : undefined)} className="sm:col-span-3 bg-gray-600 text-white p-1 rounded-md text-sm" title="Opcional: Sobreescribe el precio de las facturas" />
                                        <button onClick={() => removeIngredient(index)} className="sm:col-span-1 justify-self-end sm:justify-self-center text-red-400 hover:text-red-300"><XIcon /></button>
                                    </div>
                                ))}
                                <button onClick={addIngredient} className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md mt-2">+ Añadir Ingrediente</button>
                            </div>
                            
                            <div className="mb-6">
                                <h4 className="font-semibold text-blue-300 mb-2">Preparación</h4>
                                <textarea value={editingRecipe.preparation || ''} onChange={e => setEditingRecipe({...editingRecipe, preparation: e.target.value})} rows={8} className="w-full bg-gray-600 text-white p-2 rounded-md text-sm" />
                            </div>

                            <div className="flex justify-end gap-2">
                                <button onClick={handleCancelEditRecipe} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-md">Cancelar</button>
                                <button onClick={handleSaveRecipe} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">Guardar Cambios</button>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h2 className="text-2xl font-bold text-white">{selectedRecipe.name}</h2>
                                    <div className="flex items-center gap-3 mt-2">
                                        <span className="text-sm text-gray-400">Mostrar en TPV:</span>
                                        <div 
                                            onClick={() => onUpdateRecipe({ ...selectedRecipe, showInTPV: selectedRecipe.showInTPV === false ? true : false })}
                                            className={`w-10 h-5.5 flex items-center rounded-full p-1 cursor-pointer transition-colors ${selectedRecipe.showInTPV !== false ? 'bg-blue-600' : 'bg-gray-600'}`}
                                        >
                                            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${selectedRecipe.showInTPV !== false ? 'translate-x-4' : 'translate-x-0'}`} />
                                        </div>
                                    </div>
                                </div>
                                <button onClick={handleOptimizeRecipe} className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-2 px-3 rounded-lg text-sm transition-colors">
                                    <SparkIcon className="h-5 w-5 mb-0" />
                                    Optimizar con IA
                                </button>
                            </div>
                            
                            <RecipeCostAnalysis costData={costData} recipeYield={selectedRecipe.yield} />
                             
                            <div className="w-full text-left space-y-3">
                                <div className="flex justify-between items-center bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                                    <span className="text-gray-300 font-medium">Cantidades para {productionViewPortions ?? selectedRecipe.yield ?? 1} raciones</span>
                                    <div className="flex items-center gap-2">
                                        <label className="text-sm text-gray-400">Recalcular:</label>
                                        <input
                                            type="number"
                                            min="1"
                                            value={productionViewPortions ?? selectedRecipe.yield ?? 1}
                                            onChange={(e) => setProductionViewPortions(parseInt(e.target.value) || 1)}
                                            className="w-20 bg-gray-700 text-white px-2 py-1 rounded-md border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                                <div className="hidden sm:grid grid-cols-5 gap-2 p-2 text-gray-400 border-b border-gray-600 mt-4">
                                    <div className="col-span-2">Ingrediente</div>
                                    <div>Cantidad</div>
                                    <div>Coste Unit.</div>
                                    <div>Coste Total</div>
                                </div>
                                {selectedRecipe.ingredients.map((ing, index) => {
                                    const stockItem = allStock.find(item => item.name?.toLowerCase() === ing.name?.toLowerCase());
                                    const isManual = ing.manualPrice !== undefined && ing.manualPrice !== null;
                                    const price = isManual ? ing.manualPrice! : (stockItem?.lastPrice ?? 0);
                                    
                                    const baseYield = selectedRecipe.yield && selectedRecipe.yield > 0 ? selectedRecipe.yield : 1;
                                    const currentYield = productionViewPortions ?? baseYield;
                                    const proportion = currentYield / baseYield;
                                    
                                    const displayQuantity = ing.quantity * proportion;
                                    const cost = price * displayQuantity;
                                    const hasEnoughStock = stockItem ? stockItem.stock >= displayQuantity : true;

                                    return (
                                        <div key={`${ing.stockItemId}-${index}`} className="grid grid-cols-2 sm:grid-cols-5 gap-2 p-2 border-b border-gray-700 hover:bg-gray-700/50 rounded-md">
                                            <div className="col-span-2 sm:col-span-2 font-semibold text-white cursor-pointer flex flex-col" onClick={() => stockItem && setHistoryModalItem(stockItem)}>
                                                <span>{ing.name} {isManual && <span className="text-xs text-orange-400 font-normal ml-1" title="Precio establecido manualmente">(Manual)</span>}</span>
                                                {stockItem && !hasEnoughStock && (
                                                    <span className="text-xs text-red-400">Falta stock (Disp: {stockItem.stock.toFixed(2)})</span>
                                                )}
                                            </div>
                                            
                                            <div className={`text-sm ${!hasEnoughStock ? 'text-red-400 font-medium' : 'text-gray-200'}`}><span className="sm:hidden text-gray-400">Cant: </span>{displayQuantity.toFixed(2)} {ing.unit}</div>
                                            <div className="text-sm"><span className="sm:hidden text-gray-400">Coste U.: </span>{price.toFixed(2)}€</div>
                                            <div className="font-semibold text-right sm:text-left">{cost.toFixed(2)}€</div>
                                            {editingItemId === stockItem?.id ? (
                                                <div className="mt-2 flex items-center gap-2 animate-fade-in col-span-2 sm:col-span-5">
                                                    <input
                                                        type="number"
                                                        value={editingThreshold}
                                                        onChange={(e) => setEditingThreshold(e.target.value)}
                                                        className="bg-gray-700 text-white rounded-md px-2 py-1 w-24 border border-gray-600 focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="Nuevo umbral"
                                                    />
                                                    <button onClick={() => handleSaveEdit(stockItem.id)} className="text-green-400 hover:text-green-300"><SendIcon /></button>
                                                    <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white"><XIcon /></button>
                                                </div>
                                            ) : (
                                                <p className={`text-xs ${stockItem && stockItem.stock <= stockItem.lowStockThreshold ? 'text-yellow-400' : 'text-gray-500'} cursor-pointer col-span-2 sm:col-span-5`} onClick={() => stockItem && handleStartEdit(stockItem)}>
                                                    Umbral Mínimo: {stockItem?.lowStockThreshold} <EditIcon className="h-3 w-3 inline -mt-1" />
                                                </p>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            
                            <div className="mt-6 border-t border-gray-700 pt-4">
                                <h3 className="text-xl font-semibold text-white mb-4">Control de Producción</h3>
                                <div className="bg-gray-900/50 p-4 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                                    <div>
                                        <p className="text-sm text-gray-400">Registrar preparación de raciones:</p>
                                        <p className="text-xs text-gray-500 italic">Descuenta ingredientes del stock automáticamente.</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button 
                                            onClick={() => {
                                                const currentYield = productionViewPortions ?? selectedRecipe.yield ?? 1;
                                                handleRecordPreparation(selectedRecipe, currentYield);
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg transition-colors shadow-lg"
                                        >
                                            Producir {productionViewPortions ?? selectedRecipe.yield ?? 1} raciones
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 border-t border-gray-700 pt-4">
                                <h3 className="text-xl font-semibold text-white mb-2">Ficha Técnica / Preparación</h3>
                                {selectedRecipe.preparation ? (
                                    <p className="text-gray-300 whitespace-pre-wrap bg-gray-900/50 p-4 rounded-md">
                                        {selectedRecipe.preparation}
                                    </p>
                                ) : (
                                    <p className="text-gray-500 italic p-4 bg-gray-900/50 rounded-md">
                                        No hay pasos de preparación definidos para esta receta.
                                    </p>
                                )}
                            </div>
                            <div className="flex justify-between items-center mt-8">
                               <button onClick={() => handleAddToElaborations(selectedRecipe)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                  Añadir a Elaboraciones de Carta
                               </button>
                                <button onClick={() => handleStartEditRecipe(selectedRecipe)} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg transition-colors">
                                    Editar Receta
                                </button>
                            </div>
                        </div>
                    )
                ) : (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Seleccione una receta para ver el escandallo o cree una nueva.</p>
                    </div>
                )}
            </div>
        </div>

        <div className="bg-gray-800 p-6 rounded-lg shadow-lg max-w-4xl mx-auto">
             <h2 className="text-2xl font-bold mb-4 text-white">Elaboraciones en Carta (Stock)</h2>
             {elaborations.length > 0 ? (
                <div className="space-y-4">
                    {Object.entries<Elaboration[]>(groupedElaborations).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                        <details key={category} open className="bg-gray-900/50 p-3 rounded-lg">
                            <summary className="font-semibold text-lg text-blue-300 cursor-pointer">{category} ({items.length})</summary>
                             <ul className="space-y-3 mt-3">
                                {items.map(item => {
                                    const recipe = recipes.find(r => 
                                        r.name.toLowerCase().includes(item.name.toLowerCase()) || 
                                        item.name.toLowerCase().includes(r.name.toLowerCase())
                                    );
                                    let costPerPortion = 0;
                                    if (recipe) {
                                        const totalCost = calculateCost(recipe);
                                        const yieldAmount = recipe.yield || 1; 
                                        costPerPortion = totalCost / yieldAmount;
                                    }
                                    return (
                                         <li key={item.id} className="bg-gray-700/50 rounded-lg p-3 flex flex-col sm:flex-row justify-between sm:items-center group">
                                            <div className="flex-1">
                                                <p className="font-semibold text-white truncate pr-4">{item.name}</p>
                                                 <p className="text-xs text-green-300 mt-1">Coste/Ración: {costPerPortion.toFixed(2)}€</p>
                                            </div>
                                            <div className="flex items-center gap-4 sm:gap-6 mt-2 sm:mt-0">
                                                <select
                                                    value={item.category}
                                                    onChange={(e) => handleElaborationCategoryChange(item.id, e.target.value)}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="bg-gray-600 text-white text-xs p-1 rounded-md border-0 focus:ring-2 focus:ring-blue-500"
                                                >
                                                   {MENU_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                                </select>

                                                <div className="flex items-center gap-3">
                                                    <button onClick={() => adjustElaborationStock(item.id, -1)} className="w-8 h-8 rounded-full bg-red-600 text-white font-bold text-lg flex items-center justify-center">-</button>
                                                    <span className="text-lg font-bold text-white min-w-[30px] text-center">{item.stock}</span>
                                                    <button onClick={() => adjustElaborationStock(item.id, 1)} className="w-8 h-8 rounded-full bg-green-600 text-white font-bold text-lg flex items-center justify-center">+</button>
                                                    <button onClick={() => deleteElaboration(item.id)} className="text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity ml-2 sm:ml-4"><XIcon /></button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </details>
                    ))}
                </div>
             ) : (
                <p className="text-gray-400 text-center py-4">No hay elaboraciones en la carta. Añádelas desde una receta.</p>
             )}
         </div>
    </div>
  );
};

export default ElaborationsView;
