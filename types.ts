
export interface ChatMessagePart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
  functionCall?: Record<string, unknown>;
  functionResponse?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: ChatMessagePart[];
}

export interface Reservation {
  id: string;
  nombre: string;
  fecha: string; // ISO string format from datetime-local
  personas: number;
  notas: string;
  status?: 'pendiente' | 'confirmada' | 'rechazada' | 'completada';
}

export interface WorkLogEntry {
  type: 'in' | 'out';
  timestamp: string; // ISO string format
}

export type UserRole = 'manager' | 'employee' | 'admin' | 'cocinero' | 'camarero';

export interface Message {
  id: string;
  fromId: string;
  fromName: string;
  toId: string; // 'all' or employeeId
  text: string;
  timestamp: string;
  read: boolean;
}

export interface Task {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  assignedBy: string; // manager name or id
}

export interface Shift {
  id: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
}

export interface Employee {
  id: string;
  name: string;
  role: UserRole;
  logs: WorkLogEntry[];
  tasks: Task[];
  shifts?: Shift[];
}

export interface PriceHistoryEntry {
    date: string;
    price: number;
}

export interface StockItem {
  id:string;
  name: string;
  stock: number;
  lowStockThreshold: number;
  lastPrice?: number;
  priceHistory?: PriceHistoryEntry[];
  family?: string;
  showInTPV?: boolean;
}

export interface Elaboration {
    id: string;
    name: string;
    stock: number; // in portions
    category: string;
}

export interface FinancialData {
    sales: number;
    cogs: number;
    staff: number;
    rent: number;
    other: number;
}

export type SalesRanking = Record<string, number>;

export interface HistoricalData {
    id: string;
    date: string; // ISO string
    sales: number;
    expenses: number;
    foodCostPercentage: number;
}

export interface RecipeIngredient {
    stockItemId: string;
    name?: string; // For items not in stock
    quantity: number;
    unit: string;
    manualPrice?: number; // Permite sobreescribir el precio base de las facturas
}

export interface Recipe {
    id: string;
    name:string;
    yield?: number; // Número de raciones/porciones que produce la receta
    ingredients: RecipeIngredient[];
    preparation?: string;
    calculatedCost?: number; // Coste total calculado dinámicamente
    category?: string;
    showInTPV?: boolean;
}

export interface ClosingData {
    id: string;
    date: string;
    expectedSales: number;
    countedCash: number;
    discrepancy: number;
}

export interface ExpenseEntry {
    id: string;
    date: string;
    concept: string;
    amount: number;
    category: 'COGS' | 'Personal' | 'Alquiler/Suministros' | 'Otros';
    invoiceNumber?: string;
    invoiceUrl?: string;
    isClosed?: boolean;
}

export interface SaleEntry {
    id: string;
    date: string;
    concept: string;
    amount: number;
    invoiceUrl?: string;
    isClosed?: boolean;
}

export interface InventoryTransaction {
    id: string;
    stockItemId: string;
    type: 'entry' | 'exit';
    quantity: number;
    date: string;
    reason?: string;
}

export interface PurchaseItem {
    productName: string;
    quantity: number;
    unitPrice: number | null;
    family: string;
}

export interface PurchaseRecord {
    id: string;
    supplierName: string;
    date: string;
    totalAmount: number;
    items: PurchaseItem[];
    invoiceNumber?: string;
    invoiceUrl?: string;
}

export type OrderStatus = 'pendiente' | 'en preparación' | 'listo' | 'entregado' | 'pagado' | 'cerrado';

export interface OrderItem {
  id?: string;
  name: string;
  quantity: number;
  price?: number;
  status?: 'pendiente' | 'marchado' | 'salido';
  family?: string;
}

export interface Order {
  id: string;
  table: string;
  items: OrderItem[];
  status: OrderStatus;
  assignedCookId?: string;
  createdAt: string;
  updatedAt: string;
  total?: number;
  paidAmount?: number;
}

export interface MenuDish {
    name: string;
    price: number;
    ingredients: {
        name: string;
        quantity: number;
        unit: string;
    }[];
}

export interface MenuAnalysis {
    id: string;
    date: string;
    dishes: MenuDish[];
}

export type ImageSize = '1K' | '2K' | '4K';

export type AspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

export interface TipEntry {
  id: string;
  date: string;
  amount: number;
  method: 'efectivo' | 'tarjeta';
  employeeId: string | 'pool';
  orderId?: string;
}

export interface KitchenNotification {
  id: string;
  orderId: string;
  table: string;
  timestamp: string;
  isRead: boolean;
  itemSummary?: string;
}
