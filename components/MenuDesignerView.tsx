import React, { useState } from 'react';
import { Recipe, Elaboration, ChatMessage, ChatMessagePart } from '../types';
import ChatDisplay from './ChatDisplay';
import InputBar from './InputBar';
import { callGemini } from '../services/geminiService';
import { SparkIcon, PlusIcon, DocumentScannerIcon } from './icons';
import { MENU_CATEGORIES } from '../constants';

interface MenuDesignerViewProps {
  recipes: Recipe[];
  elaborations: Elaboration[];
  onSaveElaborations: (elaborations: Omit<Elaboration, 'id'>[]) => void;
  onSaveRecipe: (recipe: Omit<Recipe, 'id'>) => void;
}

const MENU_DESIGNER_PROMPT = `
Eres un chef ejecutivo y especialista en "Menu Engineering" (Ingeniería de Menús) de primer nivel.
El usuario está diseñando su carta (menú) y necesita tu ayuda para crear una oferta gastronómica atractiva, rentable y equilibrada.

Reglas:
1. Analiza el contexto de los platos que el usuario ya tiene en su carta.
2. Sugiere nuevas ideas, maridajes o cambios de precios basados en rentabilidad percibida.
3. Si el usuario te pide que idees una RECETA NUEVA, descríbela y al final de tu mensaje incluye EXACTAMENTE la siguiente estructura JSON (con "recipe" como clave principal):

\`\`\`json
{
  "recipe": {
    "name": "Nombre de la Elaboración",
    "yield": 10,
    "category": "Entrantes",
    "preparation": "Paso 1... Paso 2...",
    "ingredients": [
      { "name": "Ingrediente X", "quantity": 500, "unit": "g" }
    ]
  }
}
\`\`\`
El sistema leerá este JSON y ofrecerá un botón al usuario para añadirlo directamente a su carta y escandallos.
`;

const MenuDesignerView: React.FC<MenuDesignerViewProps> = ({ recipes, elaborations, onSaveElaborations, onSaveRecipe }) => {
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [proposedRecipe, setProposedRecipe] = useState<Omit<Recipe, 'id'> | null>(null);
  
  // Create grouped elaborations for current menu display
  const groupedMenu = MENU_CATEGORIES.reduce((acc, cat) => {
      acc[cat] = elaborations.filter(e => e.category === cat);
      return acc;
  }, {} as Record<string, Elaboration[]>);

  const handleSendMessage = async (text: string, files: ChatMessagePart[]) => {
      if (!text.trim() && files.length === 0) return;
      
      const newMsg: ChatMessage = { role: 'user', parts: [{ text }] };
      if (files.length > 0) {
        newMsg.parts = [...files, { text }];
      }

      const currentHistory = [...chatHistory, newMsg];
      setChatHistory(currentHistory);
      setIsLoading(true);
      setProposedRecipe(null);

      const systemPrompt = MENU_DESIGNER_PROMPT + `\n\nElaboraciones en la Carta Actual:\n${JSON.stringify(elaborations.map(e => ({name: e.name, cat: e.category})))}\n\nListado completo de escandallos (para reutilizar):\n${JSON.stringify(recipes.map(r => r.name))}`;

      try {
          const response = await callGemini(currentHistory, systemPrompt);
          const responseText = response.text || '';
          
          const jsonRegex = /```json\s*({[\s\S]*?})\s*```/;
          const jsonMatch = responseText.match(jsonRegex);
          let finalModelText = responseText;

          if (jsonMatch && jsonMatch[1]) {
             try {
                 const parsed = JSON.parse(jsonMatch[1]);
                 if (parsed.recipe) {
                     setProposedRecipe(parsed.recipe as Omit<Recipe, 'id'>);
                     finalModelText = responseText.replace(jsonRegex, '').trim();
                 }
             } catch (e) {
                 console.error("Failed to parse designer response:", e);
             }
          }

          setChatHistory([...currentHistory, { role: 'model', parts: [{ text: finalModelText }] }]);
      } catch (err) {
          console.error(err);
          setChatHistory([...currentHistory, { role: 'model', parts: [{ text: 'Ha ocurrido un error al conectar con el asistente.' }] }]);
      } finally {
          setIsLoading(false);
      }
  };

  const handleAcceptProposal = () => {
     if (!proposedRecipe) return;
     // 1. Add Recipe (escandallo)
     onSaveRecipe(proposedRecipe);
     // 2. Add to Carta (elaborations)
     onSaveElaborations([{
         name: proposedRecipe.name,
         category: proposedRecipe.category || 'Otros',
         stock: 0
     }]);
     setProposedRecipe(null);
     
     // Add a system message locally
     setChatHistory(prev => [...prev, { role: 'model', parts: [{ text: `✅ Se ha guardado "${proposedRecipe.name}" en tus escandallos y en la carta (sección ${proposedRecipe.category || 'Otros'}).` }]}]);
  };

  return (
      <div className="flex flex-col lg:flex-row h-full gap-6">
         {/* Left Side: Current Menu Visualizer */}
         <div className="w-full lg:w-1/3 bg-gray-800 rounded-lg p-4 flex flex-col items-start min-h-[50vh] overflow-y-auto custom-scrollbar shadow-xl border border-gray-700">
             <div className="flex items-center gap-2 text-white font-bold text-xl mb-6">
                 <DocumentScannerIcon />
                 <h2>Tu Carta Actual</h2>
             </div>
             
             {MENU_CATEGORIES.map(category => {
                 const items = groupedMenu[category];
                 if (!items || items.length === 0) return null;
                 return (
                     <div key={category} className="w-full mb-6">
                         <h3 className="text-blue-300 font-semibold border-b border-gray-600 pb-1 mb-3">{category}</h3>
                         <ul className="space-y-2">
                             {items.map(item => (
                                 <li key={item.id} className="bg-gray-700/50 p-2 rounded-md flex justify-between items-center text-sm">
                                     <span className="text-white truncate">{item.name}</span>
                                 </li>
                             ))}
                         </ul>
                     </div>
                 )
             })}
             
             {elaborations.length === 0 && (
                 <div className="text-gray-400 text-center w-full mt-10">
                     No hay elaboraciones en la carta todavía. Usa el chat para idear platos.
                 </div>
             )}
         </div>

         {/* Right Side: Chat & Proposal */}
         <div className="w-full lg:w-2/3 flex flex-col bg-gray-800 rounded-lg shadow-xl border border-gray-700 h-[70vh] lg:h-auto">
             <div className="bg-gray-900 p-4 border-b border-gray-700 flex items-center justify-between rounded-t-lg">
                 <div className="flex items-center gap-3">
                     <div className="bg-blue-600 p-2 rounded-full">
                        <SparkIcon />
                     </div>
                     <div>
                         <h2 className="text-white font-bold text-lg">Asistente de Menú IA</h2>
                         <p className="text-gray-400 text-xs text-left">Ideación de platos, escandallos y rentabilidad</p>
                     </div>
                 </div>
             </div>

             <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {chatHistory.length === 0 && (
                     <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 opacity-70 mt-10 space-y-4">
                         <DocumentScannerIcon />
                         <p className="max-w-md">Soy tu Asistente de Diseño de Cartas. Cuéntame qué concepto de restaurante tienes o pídeme sugerencias para añadir nuevos platos a tu menú actual.</p>
                     </div>
                 )}
                 <ChatDisplay chatHistory={chatHistory} />

                 {/* Proposed Recipe Card */}
                 {proposedRecipe && !isLoading && (
                     <div className="mt-4 border-2 border-dashed border-blue-500/50 bg-blue-900/20 p-4 rounded-xl relative max-w-[85%]">
                        <h3 className="text-blue-300 font-bold mb-2 flex items-center gap-2"><SparkIcon /> Plato Propuesto por la IA</h3>
                        <p className="text-white font-semibold text-lg">{proposedRecipe.name}</p>
                        <p className="text-gray-300 text-sm mt-1">Categoría: {proposedRecipe.category || 'Otros'}</p>
                        <div className="mt-4 flex gap-3">
                            <button 
                               onClick={handleAcceptProposal}
                               className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors">
                                <PlusIcon /> Añadir a Carta y Escandallos
                            </button>
                            <button 
                               onClick={() => setProposedRecipe(null)}
                               className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 transition-colors">
                                Ignorar
                            </button>
                        </div>
                     </div>
                 )}
             </div>

             <div className="p-4 bg-gray-900 border-t border-gray-700 rounded-b-lg">
                 <InputBar 
                    onSendMessage={handleSendMessage} 
                    isLoading={isLoading} 
                    placeholder="Ej: Sugiéreme 3 entrantes para un asador de carne..." 
                 />
             </div>
         </div>
      </div>
  );
};

export default MenuDesignerView;
