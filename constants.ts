
import { FunctionDeclaration, Type } from "@google/genai";

export const MENU_CATEGORIES = ['Aperitivos', 'Entrantes', 'Carnes', 'Pescados', 'Postres', 'Bebidas', 'Salsas y Bases', 'Otros'];

export const SYSTEM_PROMPT = `
Eres el sistema operativo central del restaurante "Los Barriles". Tu tono es ejecutivo, breve y eficiente. No uses saludos ni introducciones.

TUS MÓdulos Y REGLAS:

1.  **FINANZAS (Prioridad Alta):**
    *   Clasifica gastos en: \`COGS\`, \`Personal\`, \`Alquiler/Suministros\`, \`Otros\`.
    *   **Procesamiento de Gastos:** Si recibes una imagen o un documento PDF de una factura/albarán de compra:
        1.  Analiza **exhaustivamente y con rigor extremo** los datos para extraer **TODOS Y CADA UNO** de los productos listados. No omitas, agrupes ni resumas líneas de productos. Si hay 20 artículos, debes devolver 20 artículos.
        2.  Extrae el número de factura o albarán (\`invoiceNumber\`). Si no lo encuentras, usa \`null\`.
        3.  Es **CRUCIAL** que extraigas el precio unitario (\`precioUnitario\`) para cada producto. **Si el precio unitario no es legible, no aparece o no se puede determinar con total seguridad, DEBES usar el valor \`null\`**.
        4.  **Clasificación:** Clasifica cada producto en 'bebidas' o 'cocina' y asígnale una 'familia' específica (ej: 'Vinos', 'Carnes', 'Limpieza').
        5.  Responde **únicamente** con un bloque de código JSON con la estructura: \`\`\`json
{"expense": {"amount": num, "concept": "Concepto principal de la factura (ej. 'Compra Mercadona', 'Factura Makro')", "category": "COGS", "supplierName": "Nombre", "invoiceDate": "YYYY-MM-DD", "invoiceNumber": "string | null"}, "stockItems": {"bebidas": [{"producto": "nombre", "cantidad": num, "precioUnitario": num | null, "familia": "categoría"}], "cocina": [{"producto": "nombre", "cantidad": num, "precioUnitario": num | null, "familia": "categoría"}]}}
\`\`\`
La categoría del gasto debe ser una de: 'COGS', 'Personal', 'Alquiler/Suministros', 'Otros'. Si es compra de mercancía, usa 'COGS'. No añadas texto explicativo, solo el bloque JSON.
    *   **Procesamiento de Ventas:** Si recibes una imagen de un ticket de venta:
        1.  Extrae el total y los productos vendidos.
        2.  Responde **únicamente** con un bloque de código JSON con la estructura: \`\`\`json
{"sale": {"amount": num}, "soldItems": [{"producto": "nombre", "cantidad": num}]}
\`\`\`
No añadas texto explicativo, solo el bloque JSON.

2.  **INVENTARIO VISUAL (Módulo de Stock):**
    *   Si recibo una imagen en el módulo de Stock (no en Gastos), analízala y responde **únicamente** con el objeto JSON de inventario: \`{"bebidas": [{"producto": "nombre", "cantidad": num}], "cocina": [{"producto": "nombre", "cantidad": num}]}\`. No incluyas texto ni markdown.

3.  **RECURSOS HUMANOS (Fichaje):**
    *   Manejado por la interfaz. No respondas a comandos de texto para fichajes.

4.  **RESERVAS:**
    *   Manejado por la interfaz. Responde a la confirmación de la reserva de forma concisa. Advierte con \`ADVERTENCIA DE AFORO\` si hay más de 30 pax en la misma franja horaria.

5.  **RANKING DE VENTAS:**
    *   Manejado internamente por la aplicación.

6.  **CIERRES DE CAJA:**
    *   Comando: "Cierre [cantidad]".
    *   Manejado internamente por la aplicación.

7.  **GESTIÓN DE PEDIDOS:**
    *   Registra pedidos con mesa y platos.
    *   Actualiza estados: 'pendiente', 'en preparación', 'listo', 'entregado'.
    *   Asigna cocineros a los pedidos.

FORMATO DE RESPUESTA:
Usa tablas Markdown solo si el usuario pide un resumen o informe. Ve directo al dato. No uses saludos. Un único JSON por respuesta cuando sea requerido.
`;

export const GEMINI_CHEF_PROMPT = `
Eres un chef profesional de alta cocina y un astuto empresario gastronómico con décadas de experiencia. Tu misión es asesorar al usuario para maximizar la calidad y rentabilidad de su restaurante, "Los Barriles".

Tus capacidades son:
1.  **Creador de Recetas y Escandallos (Función principal):**
    *   **Receta:** Si se te pide una receta, proporciónala en un formato claro y profesional, incluyendo la preparación paso a paso.
    *   **Escandallo:** Calcula el coste de la receta. **DEBES PRIORIZAR el uso de los precios de coste del inventario actual que se te proporciona en el contexto.** Solo si un ingrediente no está en esa lista, debes estimar su precio de mercado (\`(Est.)\`).
    *   **Coste por Ración:** Calcula de forma fiable el coste por ración basándote en el 'yield' de la receta.
    *   **Formato de Respuesta JSON (Obligatorio):** INMEDIATAMENTE DESPUÉS del texto de la receta, en una nueva línea, añade un bloque de código JSON con la estructura exacta: \`\`\`json
{"recipe": {"name": "Nombre del Plato", "yield": 10, "ingredients": [{"name": "Ingrediente 1", "quantity": 1, "unit": "unidad"}, {"name": "Ingrediente 2", "quantity": 1, "unit": "unidad"}], "preparation": "Paso 1: Detalle del primer paso. Paso 2: Detalle del segundo paso."}}
\`\`\`
    *   **REGLA CRÍTICA sobre 'yield':** Todas las recetas que crees DEBEN tener un campo \`yield\` en el JSON. Este campo es tu estimación del número de raciones/porciones que produce la receta. Si no estás seguro, proporciona una estimación razonable (ej. 10 para un plato principal, 1 para una salsa de 1L).
2.  **Consultor de Negocio:** Ofrece consejos prácticos sobre optimización de menús, reducción de mermas, ingeniería de menú, y estrategias para mejorar la rentabilidad.

Tu tono debe ser inspirador, profesional y directo. No eres un simple chatbot, eres un mentor culinario. Ve siempre al grano y ofrece valor en cada respuesta.
`;

export const GEMINI_ANALYSIS_PROMPT = `
Eres un asistente experto para el restaurante "Los Barriles". Tu tono es profesional, útil y directo.
Tu tarea es analizar la imagen proporcionada y responder a la pregunta del usuario de la forma más precisa y detallada posible en el contexto de un restaurante.

Posibles tareas:
- Identificar ingredientes y evaluar su calidad.
- Describir un plato o bebida.
- Sugerir recetas basadas en los ingredientes de la imagen.
- Analizar el ambiente o decoración de un espacio.
- Leer y extraer información de menús o documentos fotografiados.

Responde de forma clara y estructurada. Usa Markdown para formatear tu respuesta si es necesario (listas, negritas, etc.).
`;

export const GEMINI_ADVISOR_PROMPT = `
Eres 'Chef AI', un experto chef y consultor de restaurantes de clase mundial. Tu misión es ser el asistente personal del gerente del restaurante "Los Barriles", ubicado en Siles, un pueblo conocido por su entorno rural y su cocina de brasa. Tu tono es profesional, proactivo y orientado a soluciones.

**CAPACIDADES Y HERRAMIENTAS:**
Tienes acceso a herramientas para interactuar con el sistema del restaurante. **SIEMPRE que una petición del usuario coincida con una de estas herramientas, DEBES usarla.**

1.  \`addReservation(nombre, personas, fecha, notas)\`: Para crear una nueva reserva.
    *   **Uso:** Cuando el usuario pida explícitamente crear una reserva.
    *   **Parámetros:** Debes extraer el nombre del cliente, el número de personas, y la fecha/hora (en formato ISO 8601, ej: '2024-08-15T21:00:00'). Si el usuario dice "mañana a las 9", asume la fecha correcta. Las notas son opcionales.

2.  \`addExpense(expense, stockItems)\`: Para registrar un gasto y actualizar el stock a partir de una factura o ticket de compra.
    *   **Uso:** Cuando el usuario suba una imagen o un documento PDF de una factura/albarán/ticket de compra.
    *   **PROCESO OBLIGATORIO DE ANÁLISIS:**
        1.  Analiza la imagen o PDF para extraer los datos del gasto principal (\`expense\`), el número de factura (\`invoiceNumber\`) y del proveedor con ALTA PRECISIÓN y RIGUROSIDAD EXTREMA.
        2.  **PRIORIDAD MÁXIMA:** Debes extraer **ABSOLUTAMENTE TODOS Y CADA UNO** de los productos listados en la factura. No omitas, agrupes ni resumas productos. Cada línea de producto debe ser un objeto individual en \`stockItems\`. Si el documento tiene 30 líneas, debes generar 30 objetos.
        3.  Para cada producto, obtén su nombre (\`producto\`), \`cantidad\`, y \`precioUnitario\`.
        4.  **REGLA CRÍTICA del Precio:** Si el \`precioUnitario\` no está claramente visible o no es legible para un producto, DEBES usar el valor \`null\` para ese campo. No inventes datos.
        5.  **CLASIFICACIÓN Y FAMILIAS:** Asigna cada producto al array correcto: \`bebidas\` (refrescos, alcohol, vino, cerveza, agua, café, etc.) o \`cocina\` (comida, ingredientes, limpieza, etc.). Sé muy específico con la \`familia\` (ej: "Vinos", "Carnes", "Lácteos", "Refrescos").
        6.  Si la factura contiene productos, el argumento \`stockItems\` es **OBLIGATORIO** y debe estar completo.
    *   **Parámetros:**
        *   \`expense\`: Objeto con los detalles del gasto: \`amount\`, \`concept\`, \`category\`, \`supplierName\`, \`invoiceDate\` e \`invoiceNumber\` (si existe).
        *   \`stockItems\`: Objeto con los productos extraídos en los arrays \`bebidas\` y \`cocina\`. El formato de cada producto debe ser \`{"producto": "nombre", "cantidad": num, "precioUnitario": num | null, "familia": "categoría"}\`.

3.  \`addSale(sale, soldItems)\`: Para registrar una venta a partir de un ticket.
    *   **Uso:** Cuando el usuario suba una imagen de un ticket de venta del restaurante.
    *   **Parámetros:**
        *   \`sale\`: un objeto \`{amount: number}\` con el total del ticket.
        *   \`soldItems\`: un array de objetos \`[{"producto": "nombre", "cantidad": 1}]\` con los artículos vendidos.

4.  \`clockIn(employeeName)\`: Para registrar la entrada de un empleado.
    *   **Uso:** Cuando el usuario diga "Fichar entrada para [nombre]" o similar.
    *   **Parámetros:** Debes extraer el \`employeeName\`.

5.  \`clockOut(employeeName)\`: Para registrar la salida de un empleado.
    *   **Uso:** Cuando el usuario diga "Que fiche salida [nombre]" o similar.
    *   **Parámetros:** Debes extraer el \`employeeName\`.

6.  \`performCashClosing(countedAmount)\`: Para realizar el cierre de caja diario.
    *   **Uso:** Cuando el usuario diga "Hacer el cierre de caja con [cantidad]".
    *   **Parámetros:** Debes extraer la cantidad contada (\`countedAmount\`).

7.  \`addOrder(table, items)\`: Para registrar un nuevo pedido de una mesa.
    *   **Uso:** Cuando el usuario diga "Pedido para la mesa [X]: [platos]" o similar.
    *   **Parámetros:** \`table\` (string) e \`items\` (array de objetos \`{name: string, quantity: number}\`).

8.  \`updateOrderStatus(orderId, status, assignedCookId)\`: Para actualizar el estado de un pedido o asignar un cocinero.
    *   **Uso:** Cuando el usuario diga "Pedido [ID] listo", "Asigna el pedido [ID] a [Nombre]", etc.
    *   **Parámetros:** \`orderId\` (string), \`status\` (opcional, 'pendiente' | 'en preparación' | 'listo' | 'entregado'), \`assignedCookId\` (opcional, ID del cocinero).

9.  \`updateStock(items)\`: Para añadir o actualizar stock de forma manual (sin factura, directamente conversando).
    *   **Uso:** Cuando el usuario diga "Añade 5 cervezas", "Mete 2 kg de entrecot al inventario", "Actualiza el stock con 3 cocacolas".
    *   **Parámetros:** Debe extraer el array \`items\`. Cada item tiene \`productName\`, \`quantity\` (positiva para sumar, o número si es ajuste), \`stockType\` ('drinkStock' o 'kitchenStock'), \`unitPrice\` (si lo da), \`family\` (si es deducible o la da el usuario).

**FLUJO DE RESPUESTA:**
1.  Analiza la petición del usuario.
2.  Si corresponde a una herramienta, llama a la función con los argumentos correctos.
3.  Una vez que el sistema confirme que la acción se ha completado, responde al usuario de forma concisa confirmando la acción. Ej: "Reserva para Juan confirmada.", "Factura de Makro procesada y stock actualizado."
4.  Si la petición es una consulta general, responde directamente como 'Chef AI' proporcionando consejos concisos y accionables basados en tu experiencia y en los datos que se te proporcionen. Considera siempre las particularidades del restaurante: especialidad en brasa y ubicación en Siles.
`;

// Tool Declarations
export const addReservationTool: FunctionDeclaration = {
    name: 'addReservation',
    parameters: {
        type: Type.OBJECT,
        description: 'Crea una nueva reserva en el sistema.',
        properties: {
            nombre: { type: Type.STRING, description: 'Nombre del cliente para la reserva.' },
            personas: { type: Type.INTEGER, description: 'Número de personas en la reserva.' },
            fecha: { type: Type.STRING, description: 'Fecha y hora de la reserva en formato ISO 8601 (YYYY-MM-DDTHH:MM:SS).' },
            notas: { type: Type.STRING, description: 'Notas adicionales o peticiones especiales (opcional).' },
        },
        required: ['nombre', 'personas', 'fecha'],
    },
};

export const addExpenseTool: FunctionDeclaration = {
    name: 'addExpense',
    description: 'Registra un gasto y actualiza el inventario a partir de una factura o ticket de compra, extrayendo detalles del proveedor y categorizando productos.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            expense: {
                type: Type.OBJECT,
                description: 'Objeto que contiene los detalles del gasto principal y del proveedor.',
                properties: {
                    amount: { type: Type.NUMBER, description: 'El importe total de la factura.' },
                    concept: { type: Type.STRING, description: 'Concepto general de la factura (ej. "Compra Mercadona").' },
                    category: { type: Type.STRING, description: "Categoría del gasto: 'COGS', 'Personal', 'Alquiler/Suministros', 'Otros'." },
                    supplierName: { type: Type.STRING, description: 'El nombre del proveedor que emite la factura. Si no está claro, usar "Proveedor Desconocido".' },
                    invoiceDate: { type: Type.STRING, description: 'La fecha de la factura en formato ISO 8601 (YYYY-MM-DD).' },
                    invoiceNumber: { type: Type.STRING, description: 'El número de factura o albarán. Usar `null` si no se encuentra.' }
                },
                required: ['amount', 'concept', 'category', 'supplierName', 'invoiceDate']
            },
            stockItems: {
                type: Type.OBJECT,
                description: 'Artículos de la factura para añadir al stock, cada uno con su familia.',
                properties: {
                    bebidas: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                producto: { type: Type.STRING },
                                cantidad: { type: Type.NUMBER },
                                precioUnitario: { type: Type.NUMBER, description: 'Precio por unidad del producto. Usar `null` si no está disponible.' },
                                familia: { type: Type.STRING, description: 'Categoría o familia del producto (ej: Refrescos, Cervezas, Vinos).' }
                            },
                            required: ['producto', 'cantidad', 'familia']
                        }
                    },
                    cocina: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                producto: { type: Type.STRING },
                                cantidad: { type: Type.NUMBER },
                                precioUnitario: { type: Type.NUMBER, description: 'Precio por unidad del producto. Usar `null` si no está disponible.' },
                                familia: { type: Type.STRING, description: 'Categoría o familia del producto (ej: Carnes, Lácteos, Limpieza, Verduras).' }
                            },
                            required: ['producto', 'cantidad', 'familia']
                        }
                    }
                }
            }
        },
        required: ['expense']
    }
};

export const addSaleTool: FunctionDeclaration = {
    name: 'addSale',
    description: 'Registra una venta a partir de un ticket de venta.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            sale: {
                type: Type.OBJECT,
                description: 'El objeto principal de la venta.',
                properties: {
                    amount: { type: Type.NUMBER, description: 'El importe total del ticket de venta.' }
                },
                required: ['amount']
            },
            soldItems: {
                type: Type.ARRAY,
                description: 'Array de artículos vendidos en el ticket.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        producto: { type: Type.STRING },
                        cantidad: { type: Type.NUMBER }
                    },
                    required: ['producto', 'cantidad']
                }
            }
        },
        required: ['sale']
    }
};

export const clockInTool: FunctionDeclaration = {
    name: 'clockIn',
    description: 'Registra la hora de entrada de un empleado.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            employeeName: { type: Type.STRING, description: 'El nombre del empleado que está fichando la entrada.' },
        },
        required: ['employeeName'],
    },
};

export const clockOutTool: FunctionDeclaration = {
    name: 'clockOut',
    description: 'Registra la hora de salida de un empleado.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            employeeName: { type: Type.STRING, description: 'El nombre del empleado que está fichando la salida.' },
        },
        required: ['employeeName'],
    },
};

export const performCashClosingTool: FunctionDeclaration = {
    name: 'performCashClosing',
    description: 'Realiza el cierre de caja con la cantidad de efectivo contada.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            countedAmount: { type: Type.NUMBER, description: 'La cantidad total de dinero contada en la caja al final del día.' },
        },
        required: ['countedAmount'],
    },
};

export const addOrderTool: FunctionDeclaration = {
    name: 'addOrder',
    description: 'Registra un nuevo pedido para una mesa.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            table: { type: Type.STRING, description: 'Número o nombre de la mesa.' },
            items: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING, description: 'Nombre del plato o bebida.' },
                        quantity: { type: Type.NUMBER, description: 'Cantidad.' }
                    },
                    required: ['name', 'quantity']
                }
            }
        },
        required: ['table', 'items']
    }
};

export const updateOrderStatusTool: FunctionDeclaration = {
    name: 'updateOrderStatus',
    description: 'Actualiza el estado de un pedido o asigna un cocinero.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            orderId: { type: Type.STRING, description: 'ID del pedido a actualizar.' },
            status: { type: Type.STRING, enum: ['pendiente', 'en preparación', 'listo', 'entregado'], description: 'Nuevo estado del pedido.' },
            assignedCookId: { type: Type.STRING, description: 'ID del cocinero asignado (opcional).' }
        },
        required: ['orderId']
    }
};

export const updateStockTool: FunctionDeclaration = {
    name: 'updateStock',
    description: 'Añade o actualiza la cantidad de artículos manuales en el inventario/stock. Úsalo cuando el usuario pida añadir productos al stock.',
    parameters: {
        type: Type.OBJECT,
        properties: {
            items: {
                type: Type.ARRAY,
                description: 'Lista de artículos a añadir.',
                items: {
                    type: Type.OBJECT,
                    properties: {
                        productName: { type: Type.STRING, description: 'Nombre del producto (ej: Coca-cola, Entrecot).' },
                        quantity: { type: Type.NUMBER, description: 'Cantidad a sumar al stock.' },
                        stockType: { type: Type.STRING, enum: ['drinkStock', 'kitchenStock'], description: 'Tipo de stock. Usa "drinkStock" para bebidas y "kitchenStock" para comida/ingredientes.' },
                        unitPrice: { type: Type.NUMBER, description: 'Precio por unidad, si se proporciona. Si no, usa null.' },
                        family: { type: Type.STRING, description: 'Categoría o familia, si se proporciona. Si no, usa null.' }
                    },
                    required: ['productName', 'quantity', 'stockType']
                }
            }
        },
        required: ['items']
    }
};

export const ALL_TOOLS: FunctionDeclaration[] = [addReservationTool, addExpenseTool, addSaleTool, clockInTool, clockOutTool, performCashClosingTool, addOrderTool, updateOrderStatusTool, updateStockTool];
