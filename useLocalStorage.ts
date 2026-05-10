import { useState, Dispatch, SetStateAction } from 'react';

// Este hook personalizado sincroniza un estado con el localStorage.
function useLocalStorage<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  // Obtiene el valor del localStorage o usa el valor inicial.
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  // Envuelve el 'setter' de useState para que también guarde en localStorage.
  const setValue: Dispatch<SetStateAction<T>> = (value) => {
    try {
      setStoredValue((prev) => {
        let valueToStore = value instanceof Function ? value(prev) : value;

        // Si la clave es para el historial de chat, asegúrate de que no exceda los 20 mensajes y limpia imágenes antiguas.
        if ((key === 'chatHistory' || key === 'chatbotHistory') && Array.isArray(valueToStore)) {
          if (valueToStore.length > 20) {
            valueToStore = valueToStore.slice(valueToStore.length - 20);
          }
          
          valueToStore = (valueToStore as unknown[]).map((msg: unknown, index: number, array: unknown[]) => {
            const message = msg as { parts?: { inlineData?: unknown }[] };
            if (index < array.length - 3 && message.parts) {
              return {
                ...message,
                parts: message.parts.map((part: { inlineData?: unknown }) => {
                  if (part.inlineData) {
                    return { text: "[Imagen eliminada para ahorrar espacio]" };
                  }
                  return part;
                })
              };
            }
            return msg;
          });
        }

        if (typeof window !== 'undefined') {
          try {
            window.localStorage.setItem(key, JSON.stringify(valueToStore));
          } catch (e) {
            console.error(`Error al guardar en localStorage para la clave "${key}":`, e);
            if (key === 'chatHistory' || key === 'chatbotHistory' || key === 'chefChatHistory') {
              try {
                const minimalHistory = (valueToStore as { parts?: { inlineData?: unknown }[] }[]).slice(-5).map((msg) => ({
                  ...msg,
                  parts: msg.parts?.map((part) => part.inlineData ? { text: "[Imagen eliminada]" } : part)
                }));
                window.localStorage.setItem(key, JSON.stringify(minimalHistory));
              } catch (innerError) {
                console.error("Incluso la limpieza de emergencia falló:", innerError);
              }
            }
          }
        }
        return valueToStore;
      });
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}

export default useLocalStorage;
