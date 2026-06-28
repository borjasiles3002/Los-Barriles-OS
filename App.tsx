
import React, { useEffect, useState } from 'react';
import { ChatMessage, ChatMessagePart, StockItem, Elaboration, Employee, Reservation, FinancialData, HistoricalData, Recipe, ClosingData, ExpenseEntry, SaleEntry, WorkLogEntry, PurchaseRecord, PurchaseItem, Order, OrderStatus, MenuAnalysis, MenuDish, InventoryTransaction, UserRole, Message, Task, KitchenNotification } from './types';
import useLocalStorage from './useLocalStorage';
import { callGemini } from './services/geminiService';
import { checkAndOpenKeySelector, hasAistudio } from './utils/aistudio';
import { HeaderIcon, BackIcon, LoadingSpinner, RefreshIcon, MessageIcon, LogInIcon, UserIcon, VentasIcon } from './components/icons';
import MainMenu from './components/MainMenu';
import ReservasView from './components/ReservasView';
import HRView from './components/HRView';
import StockView from './components/StockView';
import SummaryView from './components/SummaryView';
import ElaborationsView from './components/ElaborationsView';
import CierresView from './components/CierresView';
import MarketingView from './components/MarketingView';
import GastosView from './components/GastosView';
import VentasView from './components/VentasView';
import AnalysisView from './components/AnalysisView';
import ChatbotWidget from './components/ChatbotWidget';
import ComprasView from './components/ComprasView';
import SupplierComparatorView from './components/SupplierComparatorView';
import InvoicesView from './components/InvoicesView';
import MermasView from './components/MermasView';
import InventoryView from './components/InventoryView';
import OrdersView from './components/OrdersView';
import MenuDesignerView from './components/MenuDesignerView';
import AIReportsView from './components/AIReportsView';
import { PublicMenu, QRGeneratorView } from './components/DigitalMenuView';
import { PublicReservationView } from './components/PublicReservationView';
import SettingsView from './components/SettingsView';
import EmployeeDashboard from './components/EmployeeDashboard';
import MessagesView from './components/MessagesView';
import TPVView from './components/TPVView';
import KitchenView from './components/KitchenView';
import LoginView from './components/LoginView';
import SalaMonitorView from './components/SalaMonitorView';
import { SettingsIcon } from './components/icons';

// Firebase Imports
import { 
  db,
  auth,
  storage,
  ref,
  uploadBytes,
  getDownloadURL,
  signInWithPopup,
  signInAnonymously,
  googleProvider,
  onAuthStateChanged,
  onSnapshot,
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  handleFirestoreError,
  OperationType,
  User
} from './src/firebase';

// Check if we are rendering the public menu
const searchParams = new URLSearchParams(window.location.search);
const isPublicMenu = searchParams.get('view') === 'public_menu';
const isPublicReservation = searchParams.get('view') === 'public_reservation';
const isSalaMonitor = searchParams.get('view') === 'sala';
const forcedView = searchParams.get('view') as View | null;

export type View = 'main' | 'gestion' | 'stock' | 'hr' | 'reservas' | 'gastos' | 'ventas' | 'cierres' | 'summary' | 'elaborations' | 'marketing' | 'analysis' | 'compras' | 'invoices' | 'menu_designer' | 'settings' | 'orders' | 'supplier_comparator' | 'inventory' | 'employee_dashboard' | 'messages' | 'login' | 'tpv' | 'kitchen' | 'finance' | 'inventory_purchases' | 'gastronomy' | 'ai_tools';

const App: React.FC = () => {
  // Centralized State with localStorage persistence
  // const [, setChatHistory] = useLocalStorage<ChatMessage[]>('chatHistory', []);

  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const [kitchenNotifications, setKitchenNotifications] = useState<KitchenNotification[]>([]);
  const [currentView, setCurrentView] = useLocalStorage<View>('currentView', 'login');

  useEffect(() => {
    // Only force view if it's a valid internal view and we are not in a public view
    const validViews: View[] = ['main', 'tpv', 'kitchen', 'orders', 'employee_dashboard', 'stock', 'hr', 'reservas', 'finance', 'inventory_purchases', 'gastronomy', 'ai_tools', 'messages', 'settings'];
    if (forcedView && validViews.includes(forcedView)) {
      setCurrentView(forcedView);
    }
  }, [forcedView]);
  const [theme, setTheme] = useLocalStorage<'dark' | 'light'>('theme', 'dark');
  const [userRole, setUserRole] = useLocalStorage<UserRole>('userRole', 'employee');
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);

  // Sub-tabs state
  const [financeTab, setFinanceTab] = useState<'summary' | 'ventas' | 'gastos' | 'cierres'>('summary');
  const [inventoryTab, setInventoryTab] = useState<'stock' | 'inventory_tx' | 'compras' | 'invoices' | 'supplier_comparator' | 'mermas'>('stock');
  const [gastronomyTab, setGastronomyTab] = useState<'elaborations' | 'menu_designer' | 'digital_menu'>('elaborations');
  const [aiToolsTab, setAiToolsTab] = useState<'analysis' | 'marketing' | 'reports'>('reports');

  // Shared State (Firestore)
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [drinkStock, setDrinkStock] = useState<StockItem[]>([]);
  const [kitchenStock, setKitchenStock] = useState<StockItem[]>([]);
  const [elaborations, setElaborations] = useState<Elaboration[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [_menuAnalyses, setMenuAnalyses] = useState<MenuAnalysis[]>([]);
  const [salesHistory, setSalesHistory] = useState<SaleEntry[]>([]);
  const [tipsHistory, setTipsHistory] = useState<TipEntry[]>([]);
  const [expenseHistory, setExpenseHistory] = useState<ExpenseEntry[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseRecord[]>([]);
  const [closingHistory, setClosingHistory] = useState<ClosingData[]>([]);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (user && user.email === "borjasiles3002@gmail.com") {
        // We defer this until employees are loaded.
        // It's handled by other effects as well.
      }
    });
    return () => unsubscribe();
  }, []);

  // Offline/online detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA install prompt
  useEffect(() => {
    const handler = (e: Event) => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (firebaseUser && firebaseUser.email === "borjasiles3002@gmail.com" && employees.length > 0 && !currentUser) {
        const manager = employees.find(e => e.role === 'manager' || e.role === 'admin');
        if (manager) {
          handleLogin(manager.id);
        }
    }
  }, [firebaseUser, employees, currentUser]);

  useEffect(() => {
    if (currentUser) {
      const updatedUser = employees.find(e => e.id === currentUser.id);
      if (updatedUser && JSON.stringify(updatedUser) !== JSON.stringify(currentUser)) {
        setCurrentUser(updatedUser);
      }
    }
  }, [employees, currentUser?.id]);

  useEffect(() => {
    const savedId = localStorage.getItem('selectedEmployeeId');
    if (savedId && employees.length > 0 && !currentUser) {
      const emp = employees.find(e => e.id === savedId);
      if (emp) {
        setCurrentUser(emp);
        setUserRole(emp.role);
        if (currentView === 'login') {
          if (emp.role === 'manager' || emp.role === 'admin') {
            setCurrentView('main');
          } else if (emp.role === 'camarero' || emp.role === 'employee') {
            setCurrentView('tpv');
          } else if (emp.role === 'cocinero') {
            setCurrentView('kitchen');
          } else {
            setCurrentView('tpv');
          }
        }
      }
    }
  }, [employees.length, currentUser]);

  // Real-time Listeners
  useEffect(() => {
    // Public Listeners
    const unsubEmployees = onSnapshot(collection(db, 'employees'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as Employee));
      setEmployees(data);
      // Update current user if they are in the list
      const storedUserId = localStorage.getItem('selectedEmployeeId');
      if (storedUserId) {
        const found = data.find(e => e.id === storedUserId);
        if (found) setCurrentUser(found);
      }
    }, (err) => {
      // Only log if it's not a permission error for unauth users
      if (auth.currentUser) handleFirestoreError(err, OperationType.LIST, 'employees');
    });

    // Protected Listeners - Only if authenticated
    const unsubs: (() => void)[] = [];

    if (firebaseUser) {
      unsubs.push(onSnapshot(query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(150)), (snapshot) => {
        setMessages(snapshot.docs.map(doc => ({ ...doc.data() } as Message)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'messages')));

      unsubs.push(onSnapshot(collection(db, 'drinkStock'), (snapshot) => {
        setDrinkStock(snapshot.docs.map(doc => ({ ...doc.data() } as StockItem)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'drinkStock')));

      unsubs.push(onSnapshot(collection(db, 'kitchenStock'), (snapshot) => {
        setKitchenStock(snapshot.docs.map(doc => ({ ...doc.data() } as StockItem)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'kitchenStock')));

      let initialReservationsLoaded = false;
      unsubs.push(onSnapshot(query(collection(db, 'reservations'), orderBy('fecha', 'desc'), limit(150)), (snapshot) => {
        setReservations(snapshot.docs.map(doc => ({ ...doc.data() } as Reservation)));
        
        if (initialReservationsLoaded) {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const data = change.doc.data() as Reservation;
                    if (data.status === 'pendiente') {
                        try {
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
                            const ctx = new AudioContextClass();
                            const osc = ctx.createOscillator();
                            const gainNode = ctx.createGain();
                            osc.connect(gainNode);
                            gainNode.connect(ctx.destination);
                            osc.type = 'sine';
                            osc.frequency.setValueAtTime(600, ctx.currentTime);
                            osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
                            gainNode.gain.setValueAtTime(0, ctx.currentTime);
                            gainNode.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 0.05);
                            gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
                            osc.start(ctx.currentTime);
                            osc.stop(ctx.currentTime + 0.5);
                            
                            // Browser notification
                            if ('Notification' in window) {
                                if (Notification.permission === 'granted') {
                                    new Notification("Nueva Reserva Online", { 
                                        body: `${data.nombre} - ${data.personas} pax para el ${new Date(data.fecha).toLocaleString()}`,
                                        icon: '/favicon.ico'
                                    });
                                } else if (Notification.permission !== 'denied') {
                                    Notification.requestPermission();
                                }
                            }
                        } catch(e) {
                            console.error("Error playing notification sound:", e);
                        }
                    }
                }
            });
        }
        initialReservationsLoaded = true;
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'reservations');
      }));

      unsubs.push(onSnapshot(query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(200)), (snapshot) => {
        setOrders(snapshot.docs.map(doc => ({ ...doc.data() } as Order)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'orders')));

      unsubs.push(onSnapshot(query(collection(db, 'salesHistory'), orderBy('date', 'desc'), limit(150)), (snapshot) => {
        setSalesHistory(snapshot.docs.map(doc => ({ ...doc.data() } as SaleEntry)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'salesHistory')));

      unsubs.push(onSnapshot(query(collection(db, 'tipsHistory'), orderBy('date', 'desc'), limit(150)), (snapshot) => {
        setTipsHistory(snapshot.docs.map(doc => ({ ...doc.data() } as TipEntry)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'tipsHistory')));

      unsubs.push(onSnapshot(query(collection(db, 'expenseHistory'), orderBy('date', 'desc'), limit(150)), (snapshot) => {
        setExpenseHistory(snapshot.docs.map(doc => ({ ...doc.data() } as ExpenseEntry)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'expenseHistory')));

      unsubs.push(onSnapshot(query(collection(db, 'closingHistory'), orderBy('date', 'desc'), limit(150)), (snapshot) => {
        setClosingHistory(snapshot.docs.map(doc => ({ ...doc.data() } as ClosingData)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'closingHistory')));

      unsubs.push(onSnapshot(query(collection(db, 'purchaseHistory'), orderBy('date', 'desc'), limit(150)), (snapshot) => {
        setPurchaseHistory(snapshot.docs.map(doc => ({ ...doc.data() } as PurchaseRecord)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'purchaseHistory')));

      unsubs.push(onSnapshot(collection(db, 'recipes'), (snapshot) => {
        setRecipes(snapshot.docs.map(doc => ({ ...doc.data() } as Recipe)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'recipes')));

      unsubs.push(onSnapshot(collection(db, 'elaborations'), (snapshot) => {
        setElaborations(snapshot.docs.map(doc => ({ ...doc.data() } as Elaboration)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'elaborations')));

      unsubs.push(onSnapshot(query(collection(db, 'menuAnalyses'), orderBy('date', 'desc'), limit(150)), (snapshot) => {
        setMenuAnalyses(snapshot.docs.map(doc => ({ ...doc.data() } as MenuAnalysis)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'menuAnalyses')));

      unsubs.push(onSnapshot(query(collection(db, 'historicalData'), orderBy('date', 'desc'), limit(150)), (snapshot) => {
        setHistoricalData(snapshot.docs.map(doc => ({ ...doc.data() } as HistoricalData)));
      }, (err) => handleFirestoreError(err, OperationType.LIST, 'historicalData')));

      // Kitchen notifications listener
      let initialNotifsLoaded = false;
      unsubs.push(onSnapshot(
        query(collection(db, 'kitchenNotifications'), where('isRead', '==', false), orderBy('timestamp', 'desc'), limit(50)),
        (snapshot) => {
          const notifs = snapshot.docs.map(d => d.data() as KitchenNotification);
          if (initialNotifsLoaded && snapshot.docChanges().some(c => c.type === 'added')) {
            playKitchenSound();
          }
          setKitchenNotifications(notifs);
          initialNotifsLoaded = true;
        },
        (err) => console.warn('kitchenNotifications listener error:', err)
      ));
    }

    return () => {
      unsubEmployees();
      unsubs.forEach(unsub => unsub());
    };
  }, [firebaseUser]);
  
  // HR State
  // (Removed local state, now using Firestore listeners)

  // Reservations State
  // (Removed local state, now using Firestore listeners)

  // Financial State
  const [financials, setFinancials] = useState<FinancialData>({ sales: 0, cogs: 0, staff: 0, rent: 0, other: 0 });
  const [historicalData, setHistoricalData] = useState<HistoricalData[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  useEffect(() => {
    const activeSales = salesHistory.filter(s => !s.isClosed);
    const activeExpenses = expenseHistory.filter(e => !e.isClosed);
    
    const totalSales = activeSales.reduce((sum, s) => sum + s.amount, 0);
    const totalCogs = activeExpenses.filter(e => e.category === 'COGS').reduce((sum, e) => sum + e.amount, 0);
    const totalStaff = activeExpenses.filter(e => e.category === 'Personal').reduce((sum, e) => sum + e.amount, 0);
    const totalRent = activeExpenses.filter(e => e.category === 'Alquiler/Suministros').reduce((sum, e) => sum + e.amount, 0);
    const totalOther = activeExpenses.filter(e => e.category === 'Otros').reduce((sum, e) => sum + e.amount, 0);

    setFinancials({
        sales: totalSales,
        cogs: totalCogs,
        staff: totalStaff,
        rent: totalRent,
        other: totalOther
    });
  }, [salesHistory, expenseHistory]);

  // Removed auto-seeding logic to prevent default employees from reappearing

  const playKitchenSound = () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const play = (freq: number, t: number, dur: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.45, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        osc.start(t); osc.stop(t + dur);
      };
      play(523, ctx.currentTime, 0.25);
      play(659, ctx.currentTime + 0.18, 0.25);
      play(784, ctx.currentTime + 0.36, 0.4);
    } catch { /* audio not available */ }
  };

  const handleRefreshAllData = () => {
    setIsRefreshing(true);
    setRefreshMessage("Sincronizando datos con la nube...");
    
    // In Firestore, data is already synced via listeners. 
    // We just recalculate totals for the UI.
    setTimeout(() => {
      const activeSales = salesHistory.filter(s => !s.isClosed);
      const activeExpenses = expenseHistory.filter(e => !e.isClosed);
      
      const totalSales = activeSales.reduce((sum, s) => sum + s.amount, 0);
      const totalCogs = activeExpenses.filter(e => e.category === 'COGS').reduce((sum, e) => sum + e.amount, 0);
      const totalStaff = activeExpenses.filter(e => e.category === 'Personal').reduce((sum, e) => sum + e.amount, 0);
      const totalRent = activeExpenses.filter(e => e.category === 'Alquiler/Suministros').reduce((sum, e) => sum + e.amount, 0);
      const totalOther = activeExpenses.filter(e => e.category === 'Otros').reduce((sum, e) => sum + e.amount, 0);

      setFinancials({
          sales: totalSales,
          cogs: totalCogs,
          staff: totalStaff,
          rent: totalRent,
          other: totalOther
      });

      setIsRefreshing(false);
      setRefreshMessage("¡Sincronización completada!");
      setTimeout(() => setRefreshMessage(null), 2000);
    }, 1000);
  };


  const viewTitles: Record<View, string> = {
    main: 'Menú Principal',
    gestion: 'Gestión',
    stock: 'Gestión de Stock',
    hr: 'Gestión de Personal',
    reservas: 'Gestión de Reservas',
    gastos: 'Registro de Gastos',
    ventas: 'Registro de Ventas',
    cierres: 'Cierres de Caja',
    summary: 'Resumen Financiero',
    elaborations: 'Elaboraciones y Escandallos',
    marketing: 'Marketing y Contenido',
    analysis: 'Análisis Visual',
    compras: 'Compras y Proveedores',
    invoices: 'Analizador de Facturas',
    menu_designer: 'Diseñador de Carta',
    orders: 'Gestión de Pedidos',
    settings: 'Configuración',
    supplier_comparator: 'Comparador de Proveedores',
    inventory: 'Gestión de Inventario',
    employee_dashboard: 'Panel de Empleado',
    messages: 'Mensajería Interna',
    login: 'Acceso al Sistema',
    finance: 'Finanzas y Caja',
    inventory_purchases: 'Inventario y Compras',
    gastronomy: 'Oferta Gastronómica',
    ai_tools: 'Herramientas de IA'
  };
  
  const navigateTo = (view: View) => {
    // Role Blocking
    if (userRole === 'camarero') {
      if (!['tpv', 'reservas', 'employee_dashboard', 'messages', 'settings'].includes(view)) {
         alert('Acceso denegado: este módulo es para cocina o gerencia.');
         return;
      }
    } else if (userRole === 'cocinero') {
      if (!['kitchen', 'orders', 'gastronomy', 'employee_dashboard', 'messages', 'settings'].includes(view)) {
         alert('Acceso denegado: este módulo es para sala o gerencia.');
         return;
      }
    } else if (userRole === 'employee' || userRole === 'camarero') {
       if (['finance', 'inventory_purchases', 'hr', 'ai_tools'].includes(view)) {
           alert('Acceso denegado: módulo exclusivo de gerencia.');
           return;
       }
    }
    
    setCurrentView(view);
  };
    
  const goBack = () => {
    if (userRole !== 'manager' && userRole !== 'admin') {
      if (currentView === 'employee_dashboard') return;
      setCurrentView('employee_dashboard');
      return;
    }
    
    if (['finance', 'inventory_purchases', 'gastronomy', 'ai_tools', 'hr', 'reservas', 'settings', 'tpv', 'kitchen', 'messages', 'employee_dashboard', 'orders'].includes(currentView)) {
      setCurrentView('main');
    } else if (currentView === 'supplier_comparator') {
      setInventoryTab('compras');
    }
  };

  const handleInventoryTransaction = async (tx: Omit<InventoryTransaction, 'id' | 'date'>) => {
    const newTx: InventoryTransaction = {
      id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString(),
      ...tx
    };

    try {
      await setDoc(doc(db, 'inventoryTransactions', newTx.id), newTx);
      setInventoryTransactions(prev => [newTx, ...prev]);

      const quantityChange = tx.type === 'entry' ? tx.quantity : -tx.quantity;
      
      const drinkItem = drinkStock.find(item => item.id === tx.stockItemId);
      if (drinkItem) {
        await updateDoc(doc(db, 'drinkStock', drinkItem.id), {
          stock: Math.max(0, drinkItem.stock + quantityChange)
        });
      } else {
        const kitchenItem = kitchenStock.find(item => item.id === tx.stockItemId);
        if (kitchenItem) {
          await updateDoc(doc(db, 'kitchenStock', kitchenItem.id), {
            stock: Math.max(0, kitchenItem.stock + quantityChange)
          });
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory');
    }
  };

  const updateStock = async (stockList: StockItem[], collectionName: 'drinkStock' | 'kitchenStock', name: string, quantity: number, price?: number | null, family?: string, reason?: string) => {
      const normalizedName = name.toLowerCase().trim();
      const existingItem = stockList.find(item => item.name.toLowerCase().trim() === normalizedName);
      
      let itemId = '';
      try {
        if (existingItem) {
            itemId = existingItem.id;
            const updatedData: Partial<StockItem> = { stock: existingItem.stock + quantity };
            if (price != null && price !== existingItem.lastPrice) {
                updatedData.lastPrice = price;
                const newPriceEntry = { date: new Date().toISOString(), price };
                updatedData.priceHistory = [newPriceEntry, ...(existingItem.priceHistory || [])];
            }
            if (family && (!existingItem.family || existingItem.family === 'Sin Categoría' || existingItem.family === 'Otros')) {
                updatedData.family = family;
            }
            await updateDoc(doc(db, collectionName, itemId), { ...updatedData });
        } else {
            itemId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newPriceHistory = (price != null) ? [{ date: new Date().toISOString(), price }] : [];
            const newItem: StockItem = { 
              id: itemId, 
              name: name.trim(), 
              stock: quantity, 
              lowStockThreshold: 10, 
              family: family || 'Otros',
              showInTPV: false
            };
            if (price != null) {
              newItem.lastPrice = price;
            }
            if (newPriceHistory.length > 0) {
              newItem.priceHistory = newPriceHistory;
            }
            await setDoc(doc(db, collectionName, itemId), newItem);
        }

        // Record transaction
        const newTx: InventoryTransaction = {
          id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          stockItemId: itemId,
          type: quantity >= 0 ? 'entry' : 'exit',
          quantity: Math.abs(quantity),
          reason: reason || (quantity >= 0 ? 'Compra / Entrada' : 'Salida / Ajuste')
        };
        await setDoc(doc(db, 'inventoryTransactions', newTx.id), newTx);
        setInventoryTransactions(prev => [newTx, ...prev]);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, collectionName);
      }
  };

  const deductFromStock = async (name: string, quantity: number) => {
    const lowerCaseName = name.toLowerCase().trim();
    
    const drinkItem = drinkStock.find(i => i.name.toLowerCase().trim() === lowerCaseName);
    const kitchenItem = kitchenStock.find(i => i.name.toLowerCase().trim() === lowerCaseName);

    try {
      if (drinkItem) {
          const newStock = Math.max(0, drinkItem.stock - quantity);
          await updateDoc(doc(db, 'drinkStock', drinkItem.id), { stock: newStock });
          
          const newTx: InventoryTransaction = {
              id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              date: new Date().toISOString(),
              stockItemId: drinkItem.id,
              type: 'exit',
              quantity: quantity,
              reason: 'Venta (Ticket)'
          };
          await setDoc(doc(db, 'inventoryTransactions', newTx.id), newTx);
          setInventoryTransactions(prev => [newTx, ...prev]);
      } else if (kitchenItem) {
          const newStock = Math.max(0, kitchenItem.stock - quantity);
          await updateDoc(doc(db, 'kitchenStock', kitchenItem.id), { stock: newStock });
          
          const newTx: InventoryTransaction = {
              id: `tx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              date: new Date().toISOString(),
              stockItemId: kitchenItem.id,
              type: 'exit',
              quantity: quantity,
              reason: 'Venta (Ticket)'
          };
          await setDoc(doc(db, 'inventoryTransactions', newTx.id), newTx);
          setInventoryTransactions(prev => [newTx, ...prev]);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'inventory/sales');
    }
  };

  const isDrinkFamily = (family: string) => {
    const f = family.toLowerCase();
    const drinkKeywords = [
      'refresco', 'cerveza', 'vino', 'bebida', 'licor', 'agua', 'zumo', 
      'alcohol', 'espirituoso', 'copa', 'combinado', 'café', 'cafe', 'infusión', 'infusion',
      'tinto', 'blanco', 'rosado', 'caña', 'tercio', 'botella', 'destilado', 'cóctel', 'coctel'
    ];
    return drinkKeywords.some(keyword => f.includes(keyword));
  };

  const processPurchaseItems = (items: PurchaseItem[]) => {
    console.log(`Procesando ${items.length} artículos de compra...`);
    items.forEach((item, index) => {
      console.log(`[${index + 1}/${items.length}] Actualizando stock para: ${item.productName} (${item.quantity} unidades)`);
      const isDrink = isDrinkFamily(item.family || '');
      if (isDrink) {
        updateStock(drinkStock, 'drinkStock', item.productName, item.quantity, item.unitPrice, item.family, 'Compra (Factura)');
      } else {
        updateStock(kitchenStock, 'kitchenStock', item.productName, item.quantity, item.unitPrice, item.family, 'Compra (Factura)');
      }
    });
  };

  const uploadInvoiceToStorage = async (fileParts: ChatMessagePart[], fileName: string): Promise<string | undefined> => {
    const filePart = fileParts.find(p => p.inlineData);
    if (!filePart || !filePart.inlineData) return undefined;

    try {
      const { data, mimeType } = filePart.inlineData;
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

  const handleAddExpense = async (expense: Omit<ExpenseEntry, 'id' | 'date'>) => {
      const newExpense: ExpenseEntry = {
          id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          ...expense
      };
      if (newExpense.invoiceNumber === undefined) delete newExpense.invoiceNumber;
      if (newExpense.invoiceUrl === undefined) delete newExpense.invoiceUrl;
      if (newExpense.isClosed === undefined) delete newExpense.isClosed;

      try {
        await setDoc(doc(db, 'expenseHistory', newExpense.id), newExpense);
        setExpenseHistory(prev => [newExpense, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'expenseHistory');
      }
  };

  const handleAddSale = async (sale: Omit<SaleEntry, 'id' | 'date'>) => {
      const newSale: SaleEntry = {
          id: `sale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          ...sale
      };
      if (newSale.invoiceUrl === undefined) delete newSale.invoiceUrl;
      if (newSale.isClosed === undefined) delete newSale.isClosed;

      try {
        await setDoc(doc(db, 'salesHistory', newSale.id), newSale);
        setSalesHistory(prev => [newSale, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'salesHistory');
      }
  };

  const handleAddTip = async (tip: Omit<TipEntry, 'id' | 'date'>) => {
      const newTip: TipEntry = {
          id: `tip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          date: new Date().toISOString(),
          ...tip
      };

      try {
        await setDoc(doc(db, 'tipsHistory', newTip.id), newTip);
        setTipsHistory(prev => [newTip, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'tipsHistory');
      }
  };

  const handleUpdateStockThreshold = async (id: string, type: 'drink' | 'kitchen', threshold: number) => {
    const collectionName = type === 'drink' ? 'drinkStock' : 'kitchenStock';
    try {
      await updateDoc(doc(db, collectionName, id), { lowStockThreshold: threshold });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const handleUpdateStockPrice = async (id: string, type: 'drink' | 'kitchen', price: number) => {
    const collectionName = type === 'drink' ? 'drinkStock' : 'kitchenStock';
    const stockList = type === 'drink' ? drinkStock : kitchenStock;
    const item = stockList.find(i => i.id === id);
    if (item) {
      const newPriceEntry = { date: new Date().toISOString(), price };
      try {
        await updateDoc(doc(db, collectionName, id), {
          lastPrice: price,
          priceHistory: [newPriceEntry, ...(item.priceHistory || [])]
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
      }
    }
  };

  const handleUpdateStockFamily = async (id: string, type: 'drink' | 'kitchen', family: string) => {
    const collectionName = type === 'drink' ? 'drinkStock' : 'kitchenStock';
    try {
      await updateDoc(doc(db, collectionName, id), { family });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const handleRenameFamily = async (oldFamily: string, newFamily: string, type: 'drink' | 'kitchen') => {
    const collectionName = type === 'drink' ? 'drinkStock' : 'kitchenStock';
    const itemsToUpdate = type === 'drink' ? drinkStock.filter(i => i.family === oldFamily) : kitchenStock.filter(i => i.family === oldFamily);
    
    try {
      await Promise.all(itemsToUpdate.map(item => 
        updateDoc(doc(db, collectionName, item.id), { family: newFamily })
      ));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, collectionName);
    }
  };

  const handleUpdateStockQuantity = async (id: string, type: 'drink' | 'kitchen', quantity: number) => {
    const collectionName = type === 'drink' ? 'drinkStock' : 'kitchenStock';
    try {
      await updateDoc(doc(db, collectionName, id), { stock: quantity });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const handleUpdateStockVisibility = async (id: string, type: 'drink' | 'kitchen', showInTPV: boolean) => {
    const collectionName = type === 'drink' ? 'drinkStock' : 'kitchenStock';
    try {
      await updateDoc(doc(db, collectionName, id), { showInTPV });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const deleteStockItem = async (id: string, type: 'drink' | 'kitchen') => {
    if (window.confirm('¿Seguro que quieres eliminar este artículo del stock?')) {
      const collectionName = type === 'drink' ? 'drinkStock' : 'kitchenStock';
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
      }
    }
  };

  const deleteClosingEntry = async (id: string) => {
    if (window.confirm('¿Seguro que quieres eliminar este registro de cierre?')) {
      try {
        await deleteDoc(doc(db, 'closingHistory', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `closingHistory/${id}`);
      }
    }
  };

  const handleAnalyzeAndAddPurchase = async (fileParts: ChatMessagePart[], _userPrompt: string): Promise<string> => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    const stockContext = [...drinkStock, ...kitchenStock]
        .map(item => `- ${item.name} (Familia: ${item.family || 'N/A'})`)
        .join('\n');

    const invoicePrompt = `
      Analiza la siguiente imagen o documento PDF de factura o albarán con ALTA PRECISIÓN y RIGUROSIDAD. 
      Tu objetivo es extraer ABSOLUTAMENTE TODA la información de compra, sin omitir ni un solo artículo.
      
      **No incluyas nada más que el JSON en tu respuesta.**

      Contexto de familias de productos existentes para ayudarte a clasificar:
      ${stockContext}

      Reglas de Oro para la extracción (SÍGUELAS A RAJATABLA):
      1. **Extracción Exhaustiva:** Debes extraer CADA LÍNEA de producto que aparezca en el documento. Si hay 20 artículos, debes devolver 20 artículos en el array 'items'. No resumas ni agrupes.
      2. **Clasificación Inteligente:** Clasifica cada producto en una categoría lógica:
         - BEBIDAS: Cervezas, Vinos, Refrescos, Licores, Cafés, Aguas, Destilados.
         - COCINA: Carnes, Pescados, Pastas, Lácteos, Verduras, Frutas, Secos, Conservas, Especias, Aceites.
         - OTROS: Limpieza, Menaje, Suministros.
      3. **Precisión en Nombres:** Extrae el nombre del producto tal cual aparece. Si ya existe en el contexto (mira la lista de arriba), usa EXACTAMENTE ese nombre para mantener la sincronización del inventario.
      4. **Cantidades:** Extrae la cantidad numérica exacta. Fíjate bien en si son unidades, kg, cajas, etc.
      5. **Precios Unitarios:** El unitPrice es el precio por unidad/kg antes de impuestos. 
         IMPORTANTE: Si el precio unitario no es legible, no aparece o no se puede calcular con total seguridad, DEBES usar null. No inventes datos.
      6. **Proveedor y Fecha:** Busca el nombre fiscal del proveedor y la fecha de emisión (YYYY-MM-DD).
      7. **Número de Factura:** Extrae el número de factura o albarán (invoiceNumber). Si no lo encuentras, usa null.
      8. **Totales:** El totalAmount debe ser el importe total de la factura (incluyendo impuestos).
    `;

    const analysisChatHistory: ChatMessage[] = [{ role: 'user', parts: [...fileParts, { text: invoicePrompt }] }];

    try {
        const response = await callGemini(analysisChatHistory, '', {
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    purchase: {
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
                },
                required: ['purchase']
            }
        }, 'gemini-2.0-flash');
        const responseText = response.text;
        if (!responseText) {
            throw new Error("La IA no devolvió una respuesta de texto.");
        }

        const jsonRegex = /```json\s*({[\s\S]*?})\s*```/;
        const jsonMatch = responseText.match(jsonRegex);
        const jsonString = jsonMatch ? jsonMatch[1] : responseText;

        const parsedData = JSON.parse(jsonString);
        const purchaseData = parsedData.purchase as Omit<PurchaseRecord, 'id'>;

        if (!purchaseData || !purchaseData.items || !purchaseData.supplierName) {
            throw new Error("El JSON recibido de la IA no tiene el formato esperado.");
        }
        
        const invoiceUrl = await uploadInvoiceToStorage(fileParts, `factura_${purchaseData.supplierName}.pdf`);

        const newPurchase: PurchaseRecord = {
            id: `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ...purchaseData
        };
        if (purchaseData.invoiceNumber) newPurchase.invoiceNumber = purchaseData.invoiceNumber;
        if (invoiceUrl) newPurchase.invoiceUrl = invoiceUrl;
        
        try {
          await setDoc(doc(db, 'purchaseHistory', newPurchase.id), newPurchase);
          setPurchaseHistory(prev => [newPurchase, ...prev].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'purchaseHistory');
        }

        processPurchaseItems(purchaseData.items);

        const newExpense: Omit<ExpenseEntry, 'id' | 'date' | 'isClosed'> & { date?: string } = {
            concept: `Compra a ${purchaseData.supplierName}`,
            amount: purchaseData.totalAmount,
            category: 'COGS',
        };
        if (purchaseData.invoiceNumber) newExpense.invoiceNumber = purchaseData.invoiceNumber;
        if (invoiceUrl) newExpense.invoiceUrl = invoiceUrl;

        handleAddExpense(newExpense);

        return `Factura de ${purchaseData.supplierName} procesada con éxito. Se han añadido ${purchaseData.items.length} productos al stock y se ha registrado un gasto de ${purchaseData.totalAmount.toFixed(2)}€.`;

    } catch (err) {
        const error = err as Error;
        const isMissingKey = error.message.includes("ERROR_CLAVE_API") || error.message.includes("403") || error.message.includes("PERMISSION_DENIED") || error.message.includes("API key");
        const errorMessage = error.message.includes("ERROR_CLAVE_API") 
            ? error.message 
            : (isMissingKey 
                ? "ERROR_CLAVE_API: Falta la clave de API o no es válida. Por favor, selecciónala."
                : (error.message || 'Error desconocido al procesar la factura.'));
        setAnalysisError(errorMessage);
        throw new Error(errorMessage);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleAnalyzeAndAddSale = async (fileParts: ChatMessagePart[], _userPrompt: string): Promise<string> => {
    setIsAnalyzing(true);
    setAnalysisError(null);

    const salePrompt = `
      Analiza la siguiente imagen de ticket de venta del restaurante. Tu objetivo es extraer el total de la venta y los productos vendidos para descontarlos del stock.
      
      **No incluyas nada más que el JSON en tu respuesta.**

      Reglas para la extracción:
      1. **Total:** Extrae el importe total del ticket.
      2. **Productos:** Extrae cada producto vendido y su cantidad.
    `;

    const analysisChatHistory: ChatMessage[] = [{ role: 'user', parts: [...fileParts, { text: salePrompt }] }];

    try {
        const response = await callGemini(analysisChatHistory, '', {
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    sale: {
                        type: 'OBJECT',
                        properties: {
                            totalAmount: { type: 'NUMBER' },
                            items: {
                                type: 'ARRAY',
                                items: {
                                    type: 'OBJECT',
                                    properties: {
                                        productName: { type: 'STRING' },
                                        quantity: { type: 'NUMBER' }
                                    },
                                    required: ['productName', 'quantity']
                                }
                            }
                        },
                        required: ['totalAmount', 'items']
                    }
                },
                required: ['sale']
            }
        }, 'gemini-2.0-flash');
        
        const responseText = response.text;
        if (!responseText) throw new Error("La IA no devolvió una respuesta de texto.");

        const jsonRegex = /```json\s*({[\s\S]*?})\s*```/;
        const jsonMatch = responseText.match(jsonRegex);
        const jsonString = jsonMatch ? jsonMatch[1] : responseText;

        const parsedData = JSON.parse(jsonString);
        const saleData = parsedData.sale;

        if (!saleData || !saleData.items) throw new Error("Formato JSON inválido.");

        const invoiceUrl = await uploadInvoiceToStorage(fileParts, `ticket_venta_${Date.now()}.pdf`);

        const concept = saleData.items.map((item: { productName: string; quantity: number }) => `${item.quantity}x ${item.productName}`).join(', ');
        handleAddSale({ amount: saleData.totalAmount, concept, invoiceUrl });

        saleData.items.forEach((item: { productName: string; quantity: number }) => {
            deductFromStock(item.productName, item.quantity);
        });

        return `Ticket de venta procesado con éxito. Total: ${saleData.totalAmount.toFixed(2)}€. Se han descontado ${saleData.items.length} artículos del stock.`;

    } catch (err) {
        const error = err as Error;
        const isMissingKey = error.message.includes("ERROR_CLAVE_API") || error.message.includes("403") || error.message.includes("PERMISSION_DENIED") || error.message.includes("API key");
        const errorMessage = error.message.includes("ERROR_CLAVE_API") 
            ? error.message 
            : (isMissingKey 
                ? "ERROR_CLAVE_API: Falta la clave de API o no es válida. Por favor, selecciónala."
                : (error.message || 'Error al procesar el ticket de venta.'));
        setAnalysisError(errorMessage);
        throw new Error(errorMessage);
    } finally {
        setIsAnalyzing(false);
    }
  };

  const deletePurchaseRecord = async (id: string) => {
    const purchaseToDelete = purchaseHistory.find(p => p.id === id);
    if (!purchaseToDelete) return;

    try {
      await deleteDoc(doc(db, 'purchaseHistory', id));

      await Promise.all(purchaseToDelete.items.map(item => {
          const isDrink = isDrinkFamily(item.family || '');
          if (isDrink) {
              return updateStock(drinkStock, 'drinkStock', item.productName, -item.quantity, null, undefined, 'Eliminación de Factura');
          } else {
              return updateStock(kitchenStock, 'kitchenStock', item.productName, -item.quantity, null, undefined, 'Eliminación de Factura');
          }
      }));

      // Try to find and delete the associated expense
      const possibleExpense = expenseHistory.find(e => 
          e.amount === purchaseToDelete.totalAmount && 
          e.concept.includes(purchaseToDelete.supplierName) &&
          (purchaseToDelete.invoiceNumber ? e.invoiceNumber === purchaseToDelete.invoiceNumber : true)
      );
      if (possibleExpense) {
          await deleteDoc(doc(db, 'expenseHistory', possibleExpense.id));
          setExpenseHistory(prev => prev.filter(e => e.id !== possibleExpense.id));
      }

      setPurchaseHistory(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `purchaseHistory/${id}`);
    }
  };

  const handleResetFirestoreData = async () => {
    const collectionsToClear = [
      'salesHistory',
      'expenseHistory',
      'purchaseHistory',
      'closingHistory',
      'inventoryTransactions',
      'orders',
      'reservations',
      'messages',
      'historicalData',
      'menuAnalyses',
      'system'
    ];

    for (const collName of collectionsToClear) {
      try {
        const q = query(collection(db, collName));
        const snapshot = await getDocs(q);
        const deletePromises = snapshot.docs.map(doc => deleteDoc(doc.ref));
        await Promise.all(deletePromises);
      } catch (err) {
        console.error(`Error clearing collection ${collName}:`, err);
      }
    }
    
    // Reset local states that are not automatically updated by listeners if needed
    // (Though listeners should handle most of it)
    setSalesHistory([]);
    setExpenseHistory([]);
    setPurchaseHistory([]);
    setClosingHistory([]);
    setInventoryTransactions([]);
    setOrders([]);
    setReservations([]);
    setMessages([]);
    setHistoricalData([]);
    setMenuAnalyses([]);
    
    // Reset financials
    setFinancials({ sales: 0, cogs: 0, staff: 0, rent: 0, other: 0 });
  };
  
  // Handlers for Chatbot to modify state
  const handleChatAddReservation = (args: { nombre: string; fecha: string; personas: number; notas?: string }) => {
    const { nombre, fecha, personas, notas } = args;
    if(!nombre || !fecha || !personas) throw new Error("Faltan detalles para la reserva.");
    handleAddReservation({ nombre, fecha, personas, notas: notas || '' });
  };

interface ChatPurchaseItem {
    producto?: string;
    productName?: string;
    cantidad?: number;
    quantity?: number;
    precioUnitario?: number | null;
    unitPrice?: number | null;
    familia?: string;
    family?: string;
}

  const handleChatAddExpense = (args: { expense: Omit<ExpenseEntry, 'id' | 'date'> & { invoiceNumber?: string | null, supplierName?: string, invoiceDate?: string }; stockItems?: { bebidas?: ChatPurchaseItem[]; cocina?: ChatPurchaseItem[] } }) => {
    const { expense, stockItems } = args;
    if (expense) {
        handleAddExpense(expense);
        
        const allPurchaseItems: PurchaseItem[] = [];
        if (stockItems) {
            const { bebidas, cocina } = stockItems;
            if (bebidas) {
                console.log(`Procesando ${bebidas.length} bebidas desde el chat...`);
                bebidas.forEach((item, index) => {
                    const productName = item.producto || item.productName;
                    const quantity = item.cantidad || item.quantity;
                    const unitPrice = item.precioUnitario !== undefined ? item.precioUnitario : item.unitPrice;
                    const family = item.familia || item.family;

                    console.log(`[Bebida ${index + 1}/${bebidas.length}] Actualizando stock para: ${productName}`);
                    updateStock(drinkStock, 'drinkStock', productName, quantity, unitPrice, family, 'Compra (Chat)');
                    allPurchaseItems.push({ productName, quantity, unitPrice, family });
                });
            }
            if (cocina) {
                console.log(`Procesando ${cocina.length} artículos de cocina desde el chat...`);
                cocina.forEach((item, index) => {
                    const productName = item.producto || item.productName;
                    const quantity = item.cantidad || item.quantity;
                    const unitPrice = item.precioUnitario !== undefined ? item.precioUnitario : item.unitPrice;
                    const family = item.familia || item.family;

                    console.log(`[Cocina ${index + 1}/${cocina.length}] Actualizando stock para: ${productName}`);
                    updateStock(kitchenStock, 'kitchenStock', productName, quantity, unitPrice, family, 'Compra (Chat)');
                    allPurchaseItems.push({ productName, quantity, unitPrice, family });
                });
            }
        }

        const newPurchaseRecord: PurchaseRecord = {
            id: `pur-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            supplierName: expense.supplierName || 'Proveedor Desconocido',
            date: expense.invoiceDate || new Date().toISOString(),
            totalAmount: expense.amount,
            items: allPurchaseItems,
        };
        if (expense.invoiceNumber) newPurchaseRecord.invoiceNumber = expense.invoiceNumber;
        setPurchaseHistory(prev => [newPurchaseRecord, ...prev].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    }
  };

  const handleChatAddSale = (args: { sale: { amount: number }; soldItems?: { producto: string; cantidad: number }[] }) => {
      const { sale, soldItems } = args;
      if(sale) {
          const concept = soldItems ? soldItems.map((item: { cantidad: number; producto: string }) => `${item.cantidad}x ${item.producto}`).join(', ') : 'Ticket analizado por IA';
          handleAddSale({ amount: sale.amount, concept });
      }
      if (soldItems) {
          soldItems.forEach((item: { producto: string; cantidad: number }) => deductFromStock(item.producto, item.cantidad));
      }
  };

  const handleChatUpdateStock = (items: { productName: string; quantity: number; stockType: 'drinkStock' | 'kitchenStock'; unitPrice?: number; family?: string; }[]) => {
      items.forEach(item => {
          const list = item.stockType === 'drinkStock' ? drinkStock : kitchenStock;
          updateStock(list, item.stockType, item.productName, item.quantity, Math.max(item.unitPrice || 0, 0) || null, item.family, 'Ajuste Manual (Chat)');
      });
  };
  
  const handleClock = async (employeeId: string, type: 'in' | 'out') => {
    const now = new Date().toISOString();
    const newLog: WorkLogEntry = { type, timestamp: now };
    const emp = employees.find(e => e.id === employeeId);
    if (emp) {
      try {
        await updateDoc(doc(db, 'employees', employeeId), {
          logs: [...emp.logs, newLog]
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employees/${employeeId}`);
      }
    }
  };

  const handleAddEmployee = async (name: string, role: UserRole) => {
    const newEmployee: Employee = {
      id: `emp-${Date.now()}`,
      name,
      role,
      logs: [],
      tasks: []
    };

    try {
      await setDoc(doc(db, 'employees', newEmployee.id), newEmployee);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'employees');
    }
  };

  const handleUpdateEmployee = async (id: string, updates: Partial<Employee>) => {
    try {
      await updateDoc(doc(db, 'employees', id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `employees/${id}`);
    }
  };

  const handleDeleteEmployee = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'employees', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `employees/${id}`);
    }
  };

  const handleAssignTask = async (employeeId: string, text: string) => {
    const newTask: Task = {
        id: `task-${Date.now()}`,
        text,
        completed: false,
        createdAt: new Date().toISOString(),
        assignedBy: currentUser?.name || 'Gerente'
    };
    const emp = employees.find(e => e.id === employeeId);
    if (emp) {
      try {
        await updateDoc(doc(db, 'employees', employeeId), {
          tasks: [newTask, ...emp.tasks]
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employees/${employeeId}`);
      }
    }
  };

  const handleToggleTask = async (employeeId: string, taskId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (emp) {
      try {
        await updateDoc(doc(db, 'employees', employeeId), {
          tasks: emp.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t)
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `employees/${employeeId}`);
      }
    }
  };

  const handleSendMessage = async (toId: string, text: string) => {
    const newMessage: Message = {
        id: `msg-${Date.now()}`,
        fromId: currentUser?.id || 'admin',
        fromName: currentUser?.name || 'Gerente',
        toId,
        text,
        timestamp: new Date().toISOString(),
        read: false
    };
    try {
      await setDoc(doc(db, 'messages', newMessage.id), newMessage);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    }
  };

  const handleLogin = async (employeeId: string) => {
    const emp = employees.find(e => e.id === employeeId);
    if (emp) {
        if (!auth.currentUser) {
          try {
            await signInAnonymously(auth);
          } catch (err) {
            console.error("Error signing in anonymously:", err);
          }
        }
        setCurrentUser(emp);
        setUserRole(emp.role);
        localStorage.setItem('selectedEmployeeId', employeeId);
        if (emp.role === 'manager' || emp.role === 'admin') {
          setCurrentView('main');
        } else if (emp.role === 'camarero' || emp.role === 'employee') {
          setCurrentView('tpv');
        } else if (emp.role === 'cocinero') {
          setCurrentView('kitchen');
        } else {
          setCurrentView('tpv');
        }
    }
  };

  const handleLogout = () => {
    auth.signOut();
    setCurrentUser(null);
    setUserRole('employee');
    localStorage.removeItem('selectedEmployeeId');
    setCurrentView('login');
  };

  const handleGoogleLogin = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      
      // Check if this is the manager email
      if (user.email === "borjasiles3002@gmail.com") {
        const manager = employees.find(e => e.role === 'manager' || e.role === 'admin');
        if (manager) {
          handleLogin(manager.id);
        } else {
          // If no manager record exists yet, create one
          const newManager: Employee = {
            id: 'admin',
            name: user.displayName || 'Gerente',
            role: 'manager',
            logs: [],
            tasks: []
          };
          await setDoc(doc(db, 'employees', newManager.id), newManager);
          handleLogin(newManager.id);
        }
      } else {
        // For other users, we could check if their email matches an employee
        const emp = employees.find(e => e.id === user.uid); // Or check email
        if (emp) {
          handleLogin(emp.id);
        } else {
          alert("Acceso denegado. Tu cuenta de Google no está vinculada a ningún empleado.");
        }
      }
    } catch (err) {
      console.error("Error signing in with Google:", err);
    }
  };
  
  const handleChatClockByName = (employeeName: string, type: 'in' | 'out') => {
    const employee = employees.find(e => e.name.toLowerCase() === employeeName.toLowerCase());
    if (!employee) {
        throw new Error(`Empleado "${employeeName}" no encontrado.`);
    }
    handleClock(employee.id, type);
  };

  const handleAddReservation = async (res: Omit<Reservation, 'id'>) => {
    const newRes: Reservation = { id: `res-${Date.now()}`, ...res };
    try {
      await setDoc(doc(db, 'reservations', newRes.id), newRes);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reservations');
    }
  };

  const handleUpdateReservation = async (res: Reservation) => {
    try {
      await updateDoc(doc(db, 'reservations', res.id), { ...res });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reservations/${res.id}`);
    }
  };

  const handleDeleteReservation = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'reservations', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `reservations/${id}`);
    }
  };

  const handleAddOrder = async (order: Omit<Order, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
    const newOrder: Order = {
      ...order,
      id: `order-${Date.now()}`,
      status: 'pendiente',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    if (newOrder.assignedCookId === undefined) delete newOrder.assignedCookId;
    if (newOrder.total === undefined) delete newOrder.total;
    if (newOrder.paidAmount === undefined) delete newOrder.paidAmount;

    try {
      await setDoc(doc(db, 'orders', newOrder.id), newOrder);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'orders');
    }
  };

  const handleUpdateOrder = async (order: Order) => {
    try {
      const updateData = { ...order, updatedAt: new Date().toISOString() };
      if (updateData.assignedCookId === undefined) delete updateData.assignedCookId;
      if (updateData.total === undefined) delete updateData.total;
      if (updateData.paidAmount === undefined) delete updateData.paidAmount;
      await updateDoc(doc(db, 'orders', order.id), updateData);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    }
  };

  const handleUpdateOrderStatus = async (orderId: string, status: OrderStatus, assignedCookId?: string) => {
    try {
      const updateData: Partial<Order> = { status, updatedAt: new Date().toISOString() };
      if (assignedCookId !== undefined) updateData.assignedCookId = assignedCookId;
      await updateDoc(doc(db, 'orders', orderId), { ...updateData });

      if (status === 'listo') {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          const notif: KitchenNotification = {
            id: `kn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            orderId,
            table: order.table,
            timestamp: new Date().toISOString(),
            isRead: false,
            itemSummary: order.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
          };
          await setDoc(doc(db, 'kitchenNotifications', notif.id), notif);
        }
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const dismissKitchenNotifications = async () => {
    try {
      await Promise.all(
        kitchenNotifications.map(n => updateDoc(doc(db, 'kitchenNotifications', n.id), { isRead: true }))
      );
    } catch { /* best-effort */ }
  };

  const handleDeleteOrder = async (orderId: string) => {
    try {
      await deleteDoc(doc(db, 'orders', orderId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `orders/${orderId}`);
    }
  };

  const handleAddRecipe = async (recipe: Omit<Recipe, 'id'>) => {
    const newRecipe: Recipe = { id: `recipe-${Date.now()}`, ...recipe };
    try {
      await setDoc(doc(db, 'recipes', newRecipe.id), newRecipe);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'recipes');
    }
  };

  const handleUpdateRecipe = async (recipe: Recipe) => {
    try {
      await updateDoc(doc(db, 'recipes', recipe.id), { ...recipe });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `recipes/${recipe.id}`);
    }
  };

  const handleAddElaboration = async (elaboration: Omit<Elaboration, 'id'>) => {
    const newElaboration: Elaboration = { id: `elab-${Date.now()}`, ...elaboration };
    try {
      await setDoc(doc(db, 'elaborations', newElaboration.id), newElaboration);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'elaborations');
    }
  };

  const handleUpdateElaboration = async (elaboration: Elaboration) => {
    try {
      await updateDoc(doc(db, 'elaborations', elaboration.id), { ...elaboration });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `elaborations/${elaboration.id}`);
    }
  };

  const handleDeleteElaboration = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'elaborations', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `elaborations/${id}`);
    }
  };

  const handlePerformCashClosing = async (args: { countedAmount: number }): Promise<string> => {
        const { countedAmount } = args;
        const expectedSales = financials.sales;
        const discrepancy = countedAmount - expectedSales;
        
        const newClosing: ClosingData = {
            id: `closing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString(),
            expectedSales,
            countedCash: countedAmount,
            discrepancy,
        };

        const totalExpensesToday = financials.cogs + financials.staff + financials.rent + financials.other;
        const foodCostPercentage = expectedSales > 0 ? (financials.cogs / expectedSales) * 100 : 0;
        
        const newHistoricalEntry: HistoricalData = {
            id: `hist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            date: new Date().toISOString(),
            sales: expectedSales,
            expenses: totalExpensesToday,
            foodCostPercentage: foodCostPercentage,
        };
        
        try {
            await setDoc(doc(db, 'closingHistory', newClosing.id), newClosing);
            await setDoc(doc(db, 'historicalData', newHistoricalEntry.id), newHistoricalEntry);
            
            // Archive open sales and expenses by setting isClosed to true
            const salesSnapshot = await getDocs(query(collection(db, 'salesHistory')));
            const expensesSnapshot = await getDocs(query(collection(db, 'expenseHistory')));
            
            const updatePromises: Promise<void>[] = [];
            salesSnapshot.docs.forEach(docSnap => {
                if (!docSnap.data().isClosed) {
                    updatePromises.push(updateDoc(docSnap.ref, { isClosed: true }));
                }
            });
            expensesSnapshot.docs.forEach(docSnap => {
                if (!docSnap.data().isClosed) {
                    updatePromises.push(updateDoc(docSnap.ref, { isClosed: true }));
                }
            });
            
            await Promise.all(updatePromises);
        } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, 'closingHistory/historicalData');
        }
        
        return `Cierre de caja registrado con un descuadre de ${discrepancy.toFixed(2)}€. Las ventas han sido archivadas y reseteadas.`;
    };

    const _handleSaveToElaborations = async (dishes: MenuDish[]) => {
      const newRecipes: Recipe[] = [];
      const newElaborations: Elaboration[] = [];

      dishes.forEach(dish => {
        // Check if it already exists to avoid duplicates
        if (recipes.some(r => r.name.toLowerCase() === dish.name.toLowerCase())) return;

        const recipeId = `r-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newRecipe: Recipe = {
          id: recipeId,
          name: dish.name,
          yield: 1, // Default yield for a dish
          ingredients: dish.ingredients.map(ing => {
            const stockItem = [...drinkStock, ...kitchenStock].find(s => s.name.toLowerCase() === ing.name.toLowerCase());
            return {
              stockItemId: stockItem?.id || `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              name: ing.name,
              quantity: ing.quantity,
              unit: ing.unit
            };
          }),
          preparation: "Generado automáticamente desde análisis de carta."
        };
        newRecipes.push(newRecipe);

        const newElaboration: Elaboration = {
          id: `e-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: dish.name,
          stock: 0,
          category: 'Otros' // Default category
        };
        newElaborations.push(newElaboration);
      });

      if (newRecipes.length > 0) {
        try {
          await Promise.all([
            ...newRecipes.map(recipe => setDoc(doc(db, 'recipes', recipe.id), recipe)),
            ...newElaborations.map(elab => setDoc(doc(db, 'elaborations', elab.id), elab))
          ]);
          alert(`Se han guardado ${newRecipes.length} platos y elaboraciones en la base de datos.`);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'recipes/elaborations');
          alert('Hubo un error al guardar las elaboraciones en la base de datos.');
        }
      } else {
        alert("No se añadieron platos nuevos (posiblemente ya existían).");
      }
    };

  if (isPublicMenu) {
    return <PublicMenu elaborations={elaborations} />;
  }

  if (isSalaMonitor) {
    return <SalaMonitorView />;
  }

  if (isPublicReservation) {
    return <PublicReservationView onAddReservation={(res) => {
        // Since we are not logged in we can use addDoc to bypass rules if needed or let user do it if allowed.
        // Wait, standard firestore rules might block this if not signed in!
        // For anon users, we enabled anonymous auth in handleLogin, but for public page it may not exist.
        // We will just invoke handleAddReservation and hope anonymous auth or rules allow it.
        handleAddReservation(res.nombre, res.fecha, res.personas, res.notas);
    }} />;
  }

  return (
    <div className={`flex flex-col min-h-screen font-sans transition-colors duration-300 ${theme === 'dark' ? 'bg-gray-900 text-gray-200' : 'bg-gray-50 text-gray-800'}`}>
      <header className={`${theme === 'dark' ? 'bg-gray-800/50 border-gray-700' : 'bg-white border-gray-200 shadow-sm'} backdrop-blur-sm border-b p-4 flex items-center justify-between sticky top-0 z-10`}>
          <div className="flex items-center gap-4">
            {((userRole === 'manager' && currentView !== 'main') || (userRole === 'employee' && currentView !== 'employee_dashboard')) && currentView !== 'login' ? (
              <button onClick={goBack} className={`${theme === 'dark' ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'} transition-colors`}>
                <BackIcon />
              </button>
            ) : <HeaderIcon /> }
            <h1 className={`text-xl font-bold tracking-wider uppercase ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>{viewTitles[currentView]}</h1>
          </div>
          <div className="flex items-center gap-2">
            {currentView !== 'login' && userRole === 'manager' && (
              <button 
                onClick={() => setCurrentView('messages')}
                className={`p-2 rounded-lg transition-colors ${currentView === 'messages' ? 'bg-purple-600 text-white' : (theme === 'dark' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900')}`}
                title="Mensajes"
              >
                <MessageIcon className="w-5 h-5" />
              </button>
            )}
            {currentView !== 'login' && (
              <button 
                onClick={handleLogout}
                className={`p-2 rounded-lg transition-colors ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-800 hover:text-red-400' : 'text-gray-500 hover:bg-gray-100 hover:text-red-600'}`}
                title="Cerrar Sesión"
              >
                <LogInIcon className="w-5 h-5 rotate-180" />
              </button>
            )}
            <button 
              onClick={handleRefreshAllData}
              disabled={isRefreshing}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all text-sm font-bold ${isRefreshing ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 border border-emerald-500/30'}`}
              title="Actualizar todos los datos"
            >
              {isRefreshing ? <LoadingSpinner /> : <RefreshIcon />}
              <span className="hidden sm:inline">Actualizar datos</span>
            </button>
            <button 
              onClick={() => setCurrentView('settings')}
            className={`p-2 rounded-lg transition-colors ${currentView === 'settings' ? 'bg-blue-600 text-white' : (theme === 'dark' ? 'text-gray-400 hover:bg-gray-800 hover:text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900')}`}
            title="Configuración"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          </div>
      </header>
      
      {/* Offline banner */}
      {!isOnline && (
        <div className="bg-yellow-600 text-black px-4 py-2 text-center text-sm font-bold flex items-center justify-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728M5.636 5.636a9 9 0 000 12.728M12 12h.01M9.172 9.172A4 4 0 0112 8a4 4 0 012.828 1.172" /></svg>
          Sin conexión — los datos se sincronizarán cuando vuelva la red
        </div>
      )}

      {/* PWA install banner */}
      {installPrompt && (
        <div className={`px-4 py-2 flex items-center justify-between gap-2 text-sm ${theme === 'dark' ? 'bg-blue-900/80 text-blue-100' : 'bg-blue-50 text-blue-900 border-b border-blue-200'}`}>
          <span>Instala la app en tu pantalla de inicio para acceso rápido</span>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => { (installPrompt as any).prompt(); setInstallPrompt(null); }}
              className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
            >
              Instalar
            </button>
            <button onClick={() => setInstallPrompt(null)} className="px-2 py-1 text-xs opacity-60 hover:opacity-100">✕</button>
          </div>
        </div>
      )}

      <main className={`flex-1 flex flex-col overflow-y-auto p-4 sm:p-6 ${currentUser && (userRole === 'employee' || userRole === 'camarero' || userRole === 'cocinero') ? 'pb-24 md:pb-6' : ''}`}>
        {refreshMessage && (
          <div className="mb-4 p-3 bg-emerald-900/50 border border-emerald-700 rounded-xl text-center animate-fade-in flex items-center justify-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping" />
            <p className="text-emerald-200 text-sm font-medium">{refreshMessage}</p>
          </div>
        )}
        {/* Kitchen-ready notification banner for camareros */}
        {kitchenNotifications.length > 0 && (userRole === 'camarero' || userRole === 'employee') && (
          <div className="mb-4 p-3 bg-green-900/80 border border-green-500 rounded-xl flex items-center justify-between gap-3 animate-fade-in">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🍽️</span>
              <div>
                <p className="text-green-200 font-bold text-sm">{kitchenNotifications.length} plato(s) listo(s) para servir</p>
                <p className="text-green-400 text-xs">{kitchenNotifications.map(n => n.table).join(', ')}</p>
              </div>
            </div>
            <button
              onClick={dismissKitchenNotifications}
              className="px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg shrink-0"
            >
              Entendido
            </button>
          </div>
        )}
        {isAnalyzing && (
          <div className="mb-4 p-4 bg-blue-900/50 border border-blue-700 rounded-lg text-center flex items-center justify-center gap-3">
            <LoadingSpinner />
            <p className="text-blue-200 text-sm font-medium animate-pulse">Analizando documento con IA...</p>
          </div>
        )}
        {analysisError && (
          <div className="mb-4 p-4 bg-red-900/50 border border-red-700 rounded-lg text-center">
            <p className="text-red-200 text-sm mb-2">{analysisError}</p>
            {analysisError.includes("ERROR_CLAVE_API") && (
              <div className="flex flex-col items-center gap-2 mt-2">
                {hasAistudio() ? (
                  <button 
                    onClick={async () => {
                      const opened = await checkAndOpenKeySelector();
                      if (opened) {
                        setAnalysisError(null);
                      } else {
                        alert("No se pudo abrir el selector. Asegúrate de estar en AI Studio y usar el menú de configuración.");
                      }
                    }}
                    className="px-4 py-2 bg-red-600 text-white text-sm font-bold rounded hover:bg-red-700 transition-colors shadow-lg"
                  >
                    Seleccionar Clave de API
                  </button>
                ) : (
                  <button 
                    onClick={() => setCurrentView('settings')}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded hover:bg-blue-700 transition-colors shadow-lg"
                  >
                    Ir a Configuración para poner Clave
                  </button>
                )}
                {!hasAistudio() && (
                  <p className="text-[10px] text-red-300 italic max-w-xs">
                    Si el botón no funciona, usa el icono de engranaje en la parte superior derecha de esta app para introducir tu clave manualmente.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
        {currentView === 'login' && <LoginView employees={employees} onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} theme={theme} />}
        {currentView === 'main' && <MainMenu navigateTo={navigateTo} userRole={userRole} />}
        {currentView === 'employee_dashboard' && currentUser && (
          <EmployeeDashboard 
             employee={currentUser}
             messages={messages}
             tipsHistory={tipsHistory}
             onClock={handleClock}
             onToggleTask={handleToggleTask}
             onSendMessage={handleSendMessage}
             onLogout={handleLogout}
             onNavigate={navigateTo}
             theme={theme}
          />
        )}
        {currentView === 'messages' && (
          <MessagesView 
             messages={messages}
             employees={employees}
             currentUser={currentUser}
             onSendMessage={handleSendMessage}
             theme={theme}
          />
        )}
        {currentView === 'orders' && (
          <OrdersView 
             orders={orders}
             employees={employees}
             onAddOrder={handleAddOrder}
             onUpdateStatus={handleUpdateOrderStatus}
             onDeleteOrder={handleDeleteOrder}
          />
        )}
        {/* HR and Reservas remanentes */}
        {currentView === 'reservas' && (
          <ReservasView 
            reservations={reservations} 
            onAdd={handleAddReservation}
            onUpdate={handleUpdateReservation}
            onDelete={handleDeleteReservation}
          />
        )}
        {currentView === 'hr' && (
          <HRView 
            employees={employees} 
            onClock={handleClock} 
            onAddTask={handleAssignTask} 
            onToggleTask={handleToggleTask} 
            onSendMessage={handleSendMessage} 
            onAddEmployee={handleAddEmployee}
            onUpdateEmployee={handleUpdateEmployee}
            onDeleteEmployee={handleDeleteEmployee}
            messages={messages} 
          />
        )}

        {/* FINANZAS Y CAJA */}
        {currentView === 'finance' && (
          <div className="space-y-6 animate-fade-in w-full">
            <div className="flex space-x-2 overflow-x-auto pb-2 border-b border-gray-700 whitespace-nowrap">
              <button onClick={() => setFinanceTab('summary')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${financeTab === 'summary' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Resumen</button>
              <button onClick={() => setFinanceTab('ventas')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${financeTab === 'ventas' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Ventas</button>
              <button onClick={() => setFinanceTab('gastos')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${financeTab === 'gastos' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Gastos</button>
              <button onClick={() => setFinanceTab('cierres')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${financeTab === 'cierres' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Cierres de Caja</button>
            </div>
            {financeTab === 'summary' && <SummaryView financials={financials} historicalData={historicalData} closingHistory={closingHistory} onAddSale={handleAddSale} />}
            {financeTab === 'ventas' && <VentasView onAddSale={handleAddSale} isLoading={isLoading} salesHistory={salesHistory} />}
            {financeTab === 'gastos' && (
              <GastosView 
                onAddExpense={handleAddExpense} 
                onAddExpenseWithAI={(args, invoiceUrl) => {
                  handleAddExpense({
                    ...args.expense,
                    invoiceUrl
                  });
                  if (args.stockItems) {
                    if (args.stockItems.bebidas) processPurchaseItems(args.stockItems.bebidas);
                    if (args.stockItems.cocina) processPurchaseItems(args.stockItems.cocina);
                  }
                }} 
                isLoading={isLoading} 
                setIsLoading={setIsLoading} 
                expenseHistory={expenseHistory} 
                purchaseHistory={purchaseHistory} 
              />
            )}
            {financeTab === 'cierres' && <CierresView closingHistory={closingHistory} onDeleteEntry={deleteClosingEntry} onPerformCashClosing={handlePerformCashClosing} financials={financials} />}
          </div>
        )}

        {/* INVENTARIO Y COMPRAS */}
        {currentView === 'inventory_purchases' && (
          <div className="space-y-6 animate-fade-in w-full">
             <div className="flex space-x-2 overflow-x-auto pb-2 border-b border-gray-700 whitespace-nowrap">
              <button onClick={() => setInventoryTab('stock')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${inventoryTab === 'stock' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Stock Actual</button>
              <button onClick={() => setInventoryTab('inventory_tx')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${inventoryTab === 'inventory_tx' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Movimientos</button>
              <button onClick={() => setInventoryTab('compras')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${inventoryTab === 'compras' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Proveedores y Pedidos</button>
              <button onClick={() => setInventoryTab('invoices')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${inventoryTab === 'invoices' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Analizador Facturas</button>
              <button onClick={() => setInventoryTab('supplier_comparator')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${inventoryTab === 'supplier_comparator' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Comparador de Precios</button>
              <button onClick={() => setInventoryTab('mermas')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${inventoryTab === 'mermas' ? 'bg-red-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Gestor de Mermas</button>
            </div>
            {inventoryTab === 'stock' && (
              <StockView 
                isLoading={isLoading} 
                drinkStock={drinkStock} 
                kitchenStock={kitchenStock} 
                onUpdateThreshold={handleUpdateStockThreshold}
                onUpdatePrice={handleUpdateStockPrice}
                onUpdateFamily={handleUpdateStockFamily}
                _onUpdateVisibility={handleUpdateStockVisibility}
                onRenameFamily={handleRenameFamily}
                onDeleteItem={deleteStockItem}
                onAddTransaction={handleInventoryTransaction}
              />
            )}
            {inventoryTab === 'inventory_tx' && (
              <InventoryView 
                drinkStock={drinkStock} 
                kitchenStock={kitchenStock} 
                transactions={inventoryTransactions} 
                onAddTransaction={handleInventoryTransaction} 
              />
            )}
            {inventoryTab === 'compras' && <ComprasView purchaseHistory={purchaseHistory} onDeletePurchase={deletePurchaseRecord} navigateTo={(v) => { if(v === 'supplier_comparator') setInventoryTab('supplier_comparator'); else setCurrentView(v); }} />}
            {inventoryTab === 'supplier_comparator' && <SupplierComparatorView purchaseHistory={purchaseHistory} onBack={() => setInventoryTab('compras')} />}
            {inventoryTab === 'invoices' && (
              <InvoicesView 
                drinkStock={drinkStock} 
                kitchenStock={kitchenStock} 
                onAddPurchase={async (data, invoiceUrl) => {
                  const newPurchase: PurchaseRecord = { 
                    id: `purchase-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, 
                    ...data
                  };
                  if (invoiceUrl) newPurchase.invoiceUrl = invoiceUrl;
                  if (newPurchase.invoiceNumber === undefined || newPurchase.invoiceNumber === null) {
                      delete newPurchase.invoiceNumber;
                  }

                  try {
                    await setDoc(doc(db, 'purchaseHistory', newPurchase.id), newPurchase);
                    setPurchaseHistory(prev => [newPurchase, ...prev]);
                    processPurchaseItems(data.items);
                    
                    const expenseData: Omit<ExpenseEntry, 'id' | 'date'> = {
                      concept: `Compra a ${data.supplierName}`,
                      amount: data.totalAmount,
                      category: 'COGS'
                    };
                    if (data.invoiceNumber) expenseData.invoiceNumber = data.invoiceNumber;
                    if (invoiceUrl) expenseData.invoiceUrl = invoiceUrl;

                    handleAddExpense(expenseData);
                  } catch (err) {
                    handleFirestoreError(err, OperationType.CREATE, 'purchaseHistory');
                  }
                }} 
                purchaseHistory={purchaseHistory}
                expenseHistory={expenseHistory}
                onRefresh={handleRefreshAllData}
                isRefreshing={isRefreshing}
              />
            )}
            {inventoryTab === 'mermas' && (
              <MermasView 
                drinkStock={drinkStock} 
                kitchenStock={kitchenStock} 
                transactions={inventoryTransactions} 
                onAddTransaction={handleInventoryTransaction} 
              />
            )}
          </div>
        )}

        {/* OFERTA GASTRONOMICA */}
        {currentView === 'gastronomy' && (
          <div className="space-y-6 animate-fade-in w-full">
             <div className="flex space-x-2 overflow-x-auto pb-2 border-b border-gray-700 whitespace-nowrap">
              <button onClick={() => setGastronomyTab('elaborations')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${gastronomyTab === 'elaborations' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Recetas y Escandallos</button>
              <button onClick={() => setGastronomyTab('menu_designer')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${gastronomyTab === 'menu_designer' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Asistente de Carta</button>
              <button onClick={() => setGastronomyTab('digital_menu')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${gastronomyTab === 'digital_menu' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Mi Carta Digital (QR)</button>
            </div>
            {gastronomyTab === 'elaborations' && (
              <ElaborationsView 
                allStock={[...kitchenStock, ...drinkStock]} 
                onUpdateStockThreshold={handleUpdateStockThreshold}
                onUpdateStockQuantity={handleUpdateStockQuantity}
                recipes={recipes} 
                onAddRecipe={handleAddRecipe}
                onUpdateRecipe={handleUpdateRecipe}
                elaborations={elaborations} 
                onAddElaboration={handleAddElaboration}
                onUpdateElaboration={handleUpdateElaboration}
                onDeleteElaboration={handleDeleteElaboration}
              />
            )}
            {gastronomyTab === 'menu_designer' && (
              <MenuDesignerView 
                recipes={recipes} 
                elaborations={elaborations}
                onSaveElaborations={(newElaborations) => {
                  newElaborations.forEach(e => handleAddElaboration(e));
                }}
                onSaveRecipe={(recipeData) => {
                  handleAddRecipe(recipeData);
                }}
              />
            )}
            {gastronomyTab === 'digital_menu' && (
              <QRGeneratorView url={`${window.location.origin}${window.location.pathname}?view=public_menu`} />
            )}
          </div>
        )}

        {/* HERRAMIENTAS IA */}
        {currentView === 'ai_tools' && (
          <div className="space-y-6 animate-fade-in w-full">
             <div className="flex space-x-2 overflow-x-auto pb-2 border-b border-gray-700 whitespace-nowrap">
              <button onClick={() => setAiToolsTab('reports')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${aiToolsTab === 'reports' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Reporte Ejecutivo IA</button>
              <button onClick={() => setAiToolsTab('marketing')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${aiToolsTab === 'marketing' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Generador Marketing</button>
              <button onClick={() => setAiToolsTab('analysis')} className={`px-4 py-2 rounded-lg font-bold transition-colors ${aiToolsTab === 'analysis' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}>Visión IA (Platos/Tickets)</button>
            </div>
            {aiToolsTab === 'reports' && <AIReportsView sales={salesHistory} expenses={expenseHistory} mermas={inventoryTransactions} drinkStock={drinkStock} kitchenStock={kitchenStock} />}
            {aiToolsTab === 'marketing' && <MarketingView onNavigate={setCurrentView} />}
            {aiToolsTab === 'analysis' && <AnalysisView drinkStock={drinkStock} kitchenStock={kitchenStock} />}
          </div>
        )}
        {currentView === 'settings' && (
          <SettingsView 
            theme={theme} 
            setTheme={setTheme} 
            onBack={goBack} 
            onResetData={handleResetFirestoreData}
            userRole={userRole}
          />
        )}
        {currentView === 'tpv' && (
          <TPVView 
            orders={orders}
            recipes={recipes}
            drinkStock={drinkStock}
            employees={employees}
            onAddOrder={handleAddOrder}
            onUpdateOrder={handleUpdateOrder}
            onDeleteOrder={handleDeleteOrder}
            onAddSale={(amount, concept) => handleAddSale({ amount, concept })}
            onAddTip={handleAddTip}
          />
        )}
        {currentView === 'kitchen' && (
          <KitchenView 
            orders={orders}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onUpdateOrder={handleUpdateOrder}
          />
        )}
      </main>
      <ChatbotWidget 
        onAddReservation={handleChatAddReservation} 
        onAddExpense={handleChatAddExpense} 
        onAddSale={handleChatAddSale}
        onUpdateStock={handleChatUpdateStock}
        onClockIn={(name) => handleChatClockByName(name, 'in')}
        onClockOut={(name) => handleChatClockByName(name, 'out')}
        onAddOrder={handleAddOrder}
        onUpdateOrderStatus={handleUpdateOrderStatus}
        onPerformCashClosing={handlePerformCashClosing}
        onAnalyzeInvoices={handleAnalyzeAndAddPurchase}
        onAnalyzeSalesTicket={handleAnalyzeAndAddSale}
        drinkStock={drinkStock}
        kitchenStock={kitchenStock}
        financials={financials}
        historicalData={historicalData}
       />
      {/* Bottom Navigation for Mobile Employees */}
      {currentUser && (userRole === 'employee' || userRole === 'camarero' || userRole === 'cocinero') && (
        <div className={`fixed bottom-0 left-0 right-0 z-50 md:hidden flex justify-around items-center p-2 border-t backdrop-blur-lg ${theme === 'dark' ? 'bg-gray-900/90 border-gray-800' : 'bg-white/90 border-gray-200 shadow-lg'}`}>
          <button 
            onClick={() => setCurrentView('employee_dashboard')}
            className={`flex flex-col items-center gap-1 p-2 transition-all ${currentView === 'employee_dashboard' ? 'text-blue-500 scale-110' : 'text-gray-500'}`}
          >
            <UserIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold">INICIO</span>
          </button>
          
          {(userRole === 'camarero' || userRole === 'employee') && (
            <button
              onClick={() => { setCurrentView('tpv'); dismissKitchenNotifications(); }}
              className={`flex flex-col items-center gap-1 p-2 transition-all relative ${currentView === 'tpv' ? 'text-blue-500 scale-110' : 'text-gray-500'}`}
            >
              <VentasIcon className="w-6 h-6" />
              {kitchenNotifications.length > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center px-1">
                  {kitchenNotifications.length}
                </span>
              )}
              <span className="text-[10px] font-bold">TPV</span>
            </button>
          )}

          {(userRole === 'cocinero' || userRole === 'employee') && (
            <button 
              onClick={() => setCurrentView('kitchen')}
              className={`flex flex-col items-center gap-1 p-2 transition-all ${currentView === 'kitchen' ? 'text-blue-500 scale-110' : 'text-gray-500'}`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
              <span className="text-[10px] font-bold">COCINA</span>
            </button>
          )}

          <button 
            onClick={() => setCurrentView('reservas')}
            className={`flex flex-col items-center gap-1 p-2 transition-all ${currentView === 'reservas' ? 'text-blue-500 scale-110' : 'text-gray-500'}`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span className="text-[10px] font-bold">RESERVAS</span>
          </button>

          <button 
            onClick={() => setCurrentView('messages')}
            className={`flex flex-col items-center gap-1 p-2 transition-all ${currentView === 'messages' ? 'text-blue-500 scale-110' : 'text-gray-500'}`}
          >
            <MessageIcon className="w-6 h-6" />
            <span className="text-[10px] font-bold">CHAT</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
