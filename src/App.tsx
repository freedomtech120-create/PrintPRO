/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  LayoutDashboard, 
  Receipt, 
  Users, 
  Settings as SettingsIcon, 
  LogOut, 
  Printer, 
  Search,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  ChevronRight,
  Download,
  FileText,
  Trash2,
  Edit,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Menu,
  X,
  UserPlus,
  Tag,
  Share2,
  Mail,
  MessageSquare,
  Send,
  Filter,
  ShieldCheck,
  Eye,
  Phone,
  MapPin,
  Globe,
  Building2,
  Monitor,
  BarChart3,
  ExternalLink,
  CreditCard,
  Zap,
  Coins,
  UserCircle,
  Briefcase,
  Settings2,
  Calendar
} from 'lucide-react';
import { 
  auth, 
  db, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  addDoc, 
  updateDoc, 
  doc, 
  deleteDoc,
  serverTimestamp,
  where,
  limit,
  Timestamp,
  increment,
  getDoc,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, subMonths, isWithinInterval, addDays, isAfter, addMonths, addYears } from 'date-fns';
import { usePaystackPayment } from 'react-paystack';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area
} from 'recharts';
import { useReactToPrint } from 'react-to-print';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import axios from 'axios';

// UI Components
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/// Types
import { Order, Expense, Customer, Product, BusinessSettings, OrderStatus, PaymentStatus, OrderItem, Tenant, PlatformSettings } from './types';

const ADMIN_EMAIL = 'freedomtech120@gmail.com';
const PAYSTACK_PUBLIC_KEY = (import.meta as any).env.VITE_PAYSTACK_PUBLIC_KEY || '';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [viewingTenantId, setViewingTenantId] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Initialize tenant
        const tenantRef = doc(db, 'tenants', u.uid);
        const tenantSnap = await getDoc(tenantRef);
        
        if (!tenantSnap.exists()) {
          const newTenant: Tenant = {
            id: u.uid,
            email: u.email || '',
            name: u.displayName || 'New Business',
            photoURL: u.photoURL || undefined,
            createdAt: serverTimestamp(),
            isAdmin: u.email === ADMIN_EMAIL,
            trialExpiresAt: Timestamp.fromDate(addDays(new Date(), 5)),
            isApproved: u.email === ADMIN_EMAIL, // Admin is pre-approved
            subscriptionStatus: 'trial'
          };
          await setDoc(tenantRef, newTenant);
          setTenant(newTenant);
        } else {
          const data = tenantSnap.data() as Tenant;
          // Migration: Add trial if missing for existing users so they don't get locked out immediately
          if (!data.trialExpiresAt && !data.subscriptionExpiresAt && !data.isAdmin) {
            const update = {
              trialExpiresAt: Timestamp.fromDate(addDays(new Date(), 5)),
              subscriptionStatus: 'trial',
              isApproved: false
            };
            await updateDoc(tenantRef, update);
            setTenant({ ...data, ...update, id: tenantSnap.id } as Tenant);
          } else {
            setTenant({ id: tenantSnap.id, ...data } as Tenant);
          }
        }

        // Initialize platform settings (admin only collection essentially, but we read it)
        const platRef = doc(db, 'platform', 'settings');
        const platSnap = await getDoc(platRef);
        if (!platSnap.exists()) {
          const defaultPlat: PlatformSettings = {
            prices: { '3m': 50, '6m': 90, '1y': 150 },
            currencyCode: 'GHS',
            currencySymbol: 'GH₵',
            paystackPublicKey: PAYSTACK_PUBLIC_KEY
          };
          // Only admin can write this, but we initialize if missing and we are admin
          if (u.email === ADMIN_EMAIL) {
            await setDoc(platRef, defaultPlat);
          }
          setPlatformSettings(defaultPlat);
        } else {
          setPlatformSettings(platSnap.data() as PlatformSettings);
        }

        // Initialize settings if not exists
        const settingsRef = doc(db, 'settings', u.uid);
        const settingsSnap = await getDoc(settingsRef);
        if (!settingsSnap.exists()) {
          const defaultSettings: BusinessSettings = {
            tenantId: u.uid,
            name: u.displayName || 'My Print Shop',
            address: '',
            phone: '',
            email: u.email || '',
            website: '',
            invoicePrefix: 'INV-',
            nextInvoiceNumber: 1001,
            currencyCode: 'GHS',
            currencySymbol: 'GH₵'
          };
          await setDoc(settingsRef, defaultSettings);
        }
      } else {
        setTenant(null);
      }
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const targetTenantId = (user.email === ADMIN_EMAIL && viewingTenantId) ? viewingTenantId : user.uid;

    // Listen for orders
    const ordersQuery = query(
      collection(db, 'orders'), 
      where('tenantId', '==', targetTenantId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribeOrders = onSnapshot(ordersQuery, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(ordersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'orders'));

    // Listen for expenses
    const expensesQuery = query(
      collection(db, 'expenses'), 
      where('tenantId', '==', targetTenantId),
      orderBy('date', 'desc')
    );
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const expensesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(expensesData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'expenses'));

    // Listen for customers
    const customersQuery = query(
      collection(db, 'customers'), 
      where('tenantId', '==', targetTenantId),
      orderBy('name', 'asc')
    );
    const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(customersData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'customers'));
  
    // Listen for products
    const productsQuery = query(
      collection(db, 'products'), 
      where('tenantId', '==', targetTenantId),
      orderBy('name', 'asc')
    );
    const unsubscribeProducts = onSnapshot(productsQuery, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
      setProducts(productsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'products'));

    // Listen for settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', targetTenantId), (snapshot) => {
      if (snapshot.exists()) {
        setSettings(snapshot.data() as BusinessSettings);
      } else {
        setSettings(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `settings/${targetTenantId}`));

    // Admin: Listen for all tenants
    let unsubscribeTenants = () => {};
    if (user.email === ADMIN_EMAIL) {
      const tenantsQuery = query(collection(db, 'tenants'), orderBy('createdAt', 'desc'));
      unsubscribeTenants = onSnapshot(tenantsQuery, (snapshot) => {
        const tenantsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Tenant));
        setTenants(tenantsData);
      });
    }

    return () => {
      unsubscribeOrders();
      unsubscribeExpenses();
      unsubscribeCustomers();
      unsubscribeProducts();
      unsubscribeSettings();
      unsubscribeTenants();
    };
  }, [user, viewingTenantId]);

  useEffect(() => {
    if (!user) return;
    const unsubscribeTenant = onSnapshot(doc(db, 'tenants', user.uid), (snapshot) => {
      if (snapshot.exists()) {
        setTenant({ id: snapshot.id, ...snapshot.data() } as Tenant);
      }
    });
    return () => unsubscribeTenant();
  }, [user]);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium">Loading PrintPro...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LandingPage onLogin={handleLogin} platformSettings={platformSettings} />;
  }

  // Check subscription access safely
  const isTrialActive = tenant?.trialExpiresAt && typeof tenant.trialExpiresAt.toDate === 'function' 
    ? isAfter(tenant.trialExpiresAt.toDate(), new Date()) 
    : false;
    
  const isSubActive = tenant?.subscriptionExpiresAt && typeof tenant.subscriptionExpiresAt.toDate === 'function' 
    ? isAfter(tenant.subscriptionExpiresAt.toDate(), new Date()) 
    : false;
  
  // A user is restricted if they are NOT an admin AND (Not Approved OR both trial and sub are expired)
  // Crucially, we wait for tenant to be defined before making this decision to avoid flashing/errors
  const isRestricted = tenant ? (!tenant.isAdmin && (!tenant.isApproved || (!isTrialActive && !isSubActive))) : false;

  if (user && !tenant && !loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-600 font-medium">Synchronizing profile...</p>
        </div>
      </div>
    );
  }

  if (!loading && user && isRestricted) {
    return <SubscriptionView tenant={tenant} settings={platformSettings} user={user} onLogout={handleLogout} />;
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          <div className="p-6 flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl">
              <Printer className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">PrintPro</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden ml-auto">
              <X className="w-6 h-6 text-slate-500" />
            </button>
          </div>

          <nav className="flex-1 px-4 space-y-2 mt-4">
            <NavItem 
              icon={<LayoutDashboard className="w-5 h-5" />} 
              label="Dashboard" 
              active={activeTab === 'dashboard'} 
              onClick={() => { setActiveTab('dashboard'); setIsSidebarOpen(false); }} 
            />
            <NavItem 
              icon={<Package className="w-5 h-5" />} 
              label="Orders" 
              active={activeTab === 'orders'} 
              onClick={() => { setActiveTab('orders'); setIsSidebarOpen(false); }} 
            />
            <NavItem 
              icon={<TrendingDown className="w-5 h-5" />} 
              label="Expenses" 
              active={activeTab === 'expenses'} 
              onClick={() => { setActiveTab('expenses'); setIsSidebarOpen(false); }} 
            />
            <NavItem 
              icon={<Tag className="w-5 h-5" />} 
              label="Products" 
              active={activeTab === 'products'} 
              onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }} 
            />
            <NavItem 
              icon={<Users className="w-5 h-5" />} 
              label="Customers" 
              active={activeTab === 'customers'} 
              onClick={() => { setActiveTab('customers'); setIsSidebarOpen(false); }} 
            />
            <NavItem 
              icon={<MessageSquare className="w-5 h-5" />} 
              label="Messaging" 
              active={activeTab === 'messaging'} 
              onClick={() => { setActiveTab('messaging'); setIsSidebarOpen(false); }} 
            />
            {user?.email === ADMIN_EMAIL && (
              <NavItem 
                icon={<ShieldCheck className="w-5 h-5" />} 
                label="Admin Portal" 
                active={activeTab === 'admin'} 
                onClick={() => { setActiveTab('admin'); setIsSidebarOpen(false); }} 
              />
            )}
            <NavItem 
              icon={<SettingsIcon className="w-5 h-5" />} 
              label="Settings" 
              active={activeTab === 'settings'} 
              onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }} 
            />
            <NavItem 
              icon={<CreditCard className="w-5 h-5" />} 
              label="Subscription" 
              active={activeTab === 'subscription'} 
              onClick={() => { setActiveTab('subscription'); setIsSidebarOpen(false); }} 
            />
          </nav>

          <div className="p-4 mt-auto border-t border-slate-100">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 mb-4">
              <img src={user.photoURL || ''} alt={user.displayName || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{user.displayName}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
              </div>
            </div>
            <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={handleLogout}>
              <LogOut className="w-5 h-5 mr-3" />
              Sign Out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-bottom border-slate-200 flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 rounded-lg">
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-semibold text-slate-800 capitalize">{activeTab}</h2>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setActiveTab('orders')}>
              <Plus className="w-4 h-4 mr-2" />
              New Order
            </Button>
          </div>
        </header>

        {viewingTenantId && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 lg:px-8 py-2.5 flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 text-amber-800">
              <div className="bg-amber-100 p-1.5 rounded-lg">
                <Eye className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium">
                Viewing business: <span className="font-bold underline decoration-amber-300">{tenants.find(t => t.id === viewingTenantId)?.name || 'Loading...'}</span>
              </p>
            </div>
            <Button 
              size="sm" 
              variant="outline" 
              className="bg-white border-amber-200 text-amber-700 hover:bg-amber-100 hover:text-amber-800 h-8 font-bold"
              onClick={() => setViewingTenantId(null)}
            >
              <XCircle className="w-3.5 h-3.5 mr-2" />
              Stop Viewing
            </Button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="max-w-7xl mx-auto"
            >
              {activeTab === 'dashboard' && <DashboardView orders={orders} expenses={expenses} settings={settings} />}
              {activeTab === 'orders' && <OrdersView orders={orders} customers={customers} products={products} settings={settings} user={user} />}
              {activeTab === 'products' && <ProductsView products={products} settings={settings} user={user} />}
              {activeTab === 'expenses' && <ExpensesView expenses={expenses} settings={settings} user={user} />}
              {activeTab === 'customers' && <CustomersView customers={customers} settings={settings} user={user} />}
              {activeTab === 'messaging' && <MessagingView customers={customers} settings={settings} />}
              {activeTab === 'subscription' && (
                <div className="max-w-5xl mx-auto py-8">
                  <SubscriptionView tenant={tenant} settings={platformSettings} user={user} onLogout={handleLogout} />
                </div>
              )}
              {activeTab === 'settings' && <SettingsView settings={settings} user={user} />}
              {activeTab === 'admin' && user?.email === ADMIN_EMAIL && (
                <AdminView 
                  tenants={tenants} 
                  viewingTenantId={viewingTenantId}
                  onImpersonate={(id) => { setViewingTenantId(id); setActiveTab('dashboard'); }}
                  onStopImpersonation={() => setViewingTenantId(null)}
                  platformSettings={platformSettings}
                  onUpdatePlatformSettings={async (s) => {
                    await updateDoc(doc(db, 'platform', 'settings'), s as any);
                    setPlatformSettings(s);
                  }}
                  onToggleApproval={async (tId, current) => {
                    const t = tenants.find(ten => ten.id === tId);
                    if (!t) return;
                    
                    const update: any = { isApproved: !current };
                    
                    // If approving a pending user, activate their subscription
                    if (!current && t.subscriptionStatus === 'pending_approval' && t.planType) {
                      update.subscriptionStatus = 'active';
                      let expiry = new Date();
                      if (t.planType === '3m') expiry = addMonths(expiry, 3);
                      else if (t.planType === '6m') expiry = addMonths(expiry, 6);
                      else if (t.planType === '1y') expiry = addYears(expiry, 1);
                      update.subscriptionExpiresAt = Timestamp.fromDate(expiry);
                    }
                    
                    await updateDoc(doc(db, 'tenants', tId), update);
                  }}
                  onGrantPlan={async (tId) => {
                    const expiry = addYears(new Date(), 1);
                    await updateDoc(doc(db, 'tenants', tId), {
                      isApproved: true,
                      subscriptionStatus: 'active',
                      planType: '1y',
                      subscriptionExpiresAt: Timestamp.fromDate(expiry)
                    });
                  }}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center w-full px-4 py-3 rounded-xl text-sm font-medium transition-all",
        active 
          ? "bg-blue-50 text-blue-600 shadow-sm" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <span className={cn("mr-3", active ? "text-blue-600" : "text-slate-400")}>{icon}</span>
      {label}
    </button>
  );
}

// --- Views ---

function MessagingView({ customers, settings }: { customers: Customer[], settings: BusinessSettings | null }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.phone.includes(searchTerm)
  );

  const toggleSelectAll = () => {
    if (selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedCustomerIds([]);
    } else {
      setSelectedCustomerIds(filteredCustomers.map(c => c.id || ''));
    }
  };

  const toggleSelectCustomer = (id: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSendSMS = async () => {
    if (!settings?.smsApiKey || !settings?.smsSenderId) {
      alert("Please configure SMS Gateway in Settings first.");
      return;
    }

    if (selectedCustomerIds.length === 0) {
      alert("Please select at least one customer.");
      return;
    }

    if (!message.trim()) {
      alert("Please enter a message.");
      return;
    }

    const recipients = customers
      .filter(c => selectedCustomerIds.includes(c.id || ''))
      .map(c => c.phone.replace(/\D/g, ''))
      .filter(p => !!p);

    if (recipients.length === 0) {
      alert("Selected customers have no valid phone numbers.");
      return;
    }

    setIsSending(true);
    try {
      await axios.post('/api/send-sms', {
        provider: settings.smsProvider,
        apiKey: settings.smsApiKey,
        senderId: settings.smsSenderId,
        recipients,
        message: message
      });
      alert(`Message broadcast to ${recipients.length} customers!`);
      setMessage('');
      setSelectedCustomerIds([]);
    } catch (error: any) {
      alert("Failed to send message: " + (error.response?.data?.details || error.message));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Contact Selection */}
      <div className="lg:col-span-1 flex flex-col gap-4">
        <Card className="flex-1 flex flex-col overflow-hidden border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-lg flex items-center justify-between">
              Contacts
              <span className="text-xs font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                {selectedCustomerIds.length} Selected
              </span>
            </CardTitle>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input 
                placeholder="Search customers..." 
                className="pl-10 h-9" 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-y-auto max-h-[60vh]">
            <div className="p-2 border-b border-slate-50 bg-slate-50/50">
              <button 
                onClick={toggleSelectAll}
                className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center gap-2 px-2 py-1"
              >
                {selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0 ? 'Deselect All' : 'Select All Filtered'}
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {filteredCustomers.length > 0 ? (
                filteredCustomers.map(customer => (
                  <div 
                    key={customer.id} 
                    className={cn(
                      "flex items-center gap-3 p-3 transition-colors cursor-pointer hover:bg-slate-50",
                      selectedCustomerIds.includes(customer.id || '') && "bg-blue-50/30"
                    )}
                    onClick={() => toggleSelectCustomer(customer.id || '')}
                  >
                    <input 
                      type="checkbox" 
                      checked={selectedCustomerIds.includes(customer.id || '')}
                      onChange={() => {}}
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{customer.name}</p>
                      <p className="text-xs text-slate-500 truncate">{customer.phone}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-slate-500 text-sm">
                  No customers found.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Message Profile */}
      <div className="lg:col-span-2 space-y-6">
        <Card className="border-slate-200">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-600" />
              Compose Message
            </CardTitle>
            <CardDescription>
              Create your ceremonial or reminder message profile here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Message Content</Label>
              <textarea 
                className="w-full min-h-[200px] p-4 rounded-xl border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none shadow-sm"
                placeholder="Type your message here... e.g., 'Happy Anniversary! Enjoy 10% off your next printing project.'"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>Avoid special characters for better delivery.</span>
                <span>{message.length} characters</span>
              </div>
            </div>

            <div className="pt-4 flex flex-col md:flex-row gap-4 items-center justify-between border-t border-slate-100">
              <div className="text-sm text-slate-500 italic">
                {selectedCustomerIds.length > 0 ? (
                  `Message will be sent to ${selectedCustomerIds.length} recipient(s).`
                ) : (
                  'No recipients selected.'
                )}
              </div>
              <Button 
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 font-bold px-8 shadow-lg shadow-blue-200"
                disabled={isSending || selectedCustomerIds.length === 0 || !message.trim()}
                onClick={handleSendSMS}
              >
                {isSending ? (
                  'Sending...'
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Send Message Profile
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Templates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card 
            className="border-slate-200 cursor-pointer hover:border-blue-300 transition-all group"
            onClick={() => setMessage("Greetings from PrintPro! Your printing job is ready for pickup. Thank you for your business.")}
          >
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 group-hover:text-blue-600">
                <Clock className="w-4 h-4" />
                Pickup Reminder
              </CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                Your printing job is ready for pickup...
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card 
            className="border-slate-200 cursor-pointer hover:border-blue-300 transition-all group"
            onClick={() => setMessage("Happy Anniversary! As a loyal customer, enjoy a special 15% discount on your next order this week. Use code PRINT15.")}
          >
            <CardHeader className="p-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2 group-hover:text-blue-600">
                <Tag className="w-4 h-4" />
                Ceremonial Promo
              </CardTitle>
              <CardDescription className="text-xs line-clamp-1">
                Happy Anniversary! As a loyal customer...
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  );
}

// --- Marketing Components ---

function LandingPage({ onLogin, platformSettings }: { onLogin: () => void, platformSettings: PlatformSettings | null }) {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-blue-100 selection:text-blue-700">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Printer className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">PrintPro</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#pricing" className="hover:text-blue-600 transition-colors">Pricing</a>
            <a href="#about" className="hover:text-blue-600 transition-colors">About</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
          </div>
          <Button onClick={onLogin} className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200">
            Get Started
          </Button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 mb-6 px-4 py-1.5 rounded-full font-bold uppercase tracking-wider text-[10px]">
                The Business OS for Printers
              </div>
              <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-6">
                Scale Your <span className="text-blue-600">Printing Hub</span> With Precision.
              </h1>
              <p className="text-lg text-slate-600 mb-8 max-w-lg leading-relaxed">
                PrintPro Manager simplifies order tracking, customer relationships, and business analytics. Built specifically for modern print houses and large-format businesses.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Button onClick={onLogin} className="h-14 px-8 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 group">
                  Sign in with Google
                  <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button variant="outline" className="h-14 px-8 text-lg font-bold border-slate-200 hover:bg-slate-50">
                  View Demo
                </Button>
              </div>
              <div className="mt-10 flex items-center gap-4 py-4 px-6 bg-slate-50 rounded-2xl w-fit">
                <div className="flex -space-x-3">
                  {[1, 2, 3, 4].map((i) => (
                    <img 
                      key={i} 
                      src={`https://i.pravatar.cc/100?img=${i + 10}`} 
                      className="w-10 h-10 rounded-full border-2 border-white shadow-sm" 
                      alt="User" 
                      referrerPolicy="no-referrer"
                    />
                  ))}
                </div>
                <p className="text-sm text-slate-500 font-medium">
                  Trusted by <span className="text-slate-900 font-bold">50+ local print houses</span>
                </p>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative"
            >
              <div className="absolute -inset-4 bg-gradient-to-r from-blue-100 to-indigo-100 rounded-[2.5rem] blur-2xl opacity-50"></div>
              <div className="relative rounded-[2rem] overflow-hidden shadow-2xl border-8 border-white">
                <img 
                  src="https://images.unsplash.com/photo-1563906267088-b029e7101114?q=80&w=2070&auto=format&fit=crop" 
                  alt="Modern Printing House" 
                  className="w-full aspect-[4/3] object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-8">
                  <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-4 rounded-xl flex items-center gap-4 max-w-sm">
                    <div className="bg-green-500 p-2 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-xs font-bold uppercase opacity-80">Production Pulse</p>
                      <p className="text-white font-bold">+24% Efficiency this month</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -top-6 -right-6 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 hidden md:block">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">Latest Order</p>
                    <p className="text-slate-900 font-bold">INV-4501</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </header>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-blue-600 font-bold uppercase tracking-widest text-[10px] mb-4">Pricing Plans</h2>
            <h3 className="text-4xl font-bold text-slate-900 mb-4 tracking-tight">Simple, Transparent Pricing</h3>
            <p className="text-slate-600 max-w-2xl mx-auto">Start today with a 5-day full access trial. All pricing is listed in Ghana Cedis (GH₵).</p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { id: '3m', label: '3 Months', price: platformSettings?.prices?.['3m'] || 50, icon: <Package className="w-8 h-8 text-blue-600" />, desc: 'Great for seasonal busy periods.' },
              { id: '6m', label: '6 Months', price: platformSettings?.prices?.['6m'] || 90, highlight: true, icon: <Building2 className="w-8 h-8 text-indigo-600" />, desc: 'Best value for growing print houses.' },
              { id: '1y', label: '1 Year', price: platformSettings?.prices?.['1y'] || 150, icon: <Globe className="w-8 h-8 text-emerald-600" />, desc: 'Total peace of mind for professionals.' },
            ].map((plan) => (
              <Card key={plan.id} className={cn(
                "relative overflow-hidden border-none shadow-xl transition-all hover:-translate-y-2 group",
                plan.highlight ? "bg-slate-900 text-white ring-4 ring-blue-500/10 scale-105 z-10" : "bg-white"
              )}>
                {plan.highlight && (
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-bold px-3 py-1.5 rounded-bl-lg uppercase tracking-tighter shadow-lg">
                    Best Value
                  </div>
                )}
                <CardHeader className="pt-10 pb-4">
                  <div className="mb-4 bg-slate-50 p-3 rounded-2xl w-fit group-hover:bg-white transition-colors">{plan.icon}</div>
                  <CardTitle className="text-2xl font-bold">{plan.label}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-8 p-6 bg-slate-50/50 rounded-2xl border border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-4xl font-black", plan.highlight ? "text-blue-400" : "text-slate-900")}>{platformSettings?.currencySymbol || 'GH₵'}{plan.price}</span>
                      <span className={cn("text-sm opacity-60", !plan.highlight && "text-slate-500")}>/ one-time</span>
                    </div>
                    <p className={cn("text-xs mt-2", plan.highlight ? "text-slate-400" : "text-slate-500")}>{plan.desc}</p>
                  </div>
                  
                  <ul className="space-y-4 mb-8 text-sm">
                    {["Centralized Dashboard", "Automatic Invoices", "Messaging Hub", "Smart Profit Reports"].map((feat, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <span className={cn(plan.highlight ? "text-slate-300" : "text-slate-600")}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  
                  <Button 
                    onClick={onLogin} 
                    className={cn(
                      "w-full h-14 text-sm font-bold shadow-lg", 
                      plan.highlight ? "bg-blue-600 hover:bg-blue-700 shadow-blue-500/20" : "bg-slate-900 hover:bg-slate-800 text-white"
                    )}
                  >
                    Activate {plan.label} Access
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-4">Everything You Need to Command Your Workshop.</h2>
            <p className="text-slate-600">We've built a multi-tenant platform centered around efficiency and clarity. Stop guessing and start growing.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Monitor className="w-6 h-6" />}
              title="Centralized Dashboard"
              description="Get a high-level view of your orders, expenses, and business performance in one glance."
            />
            <FeatureCard 
              icon={<BarChart3 className="w-6 h-6" />}
              title="Smart Analytics"
              description="Deep dive into profit margins and category-wise performance with interactive charts."
            />
            <FeatureCard 
              icon={<Users className="w-6 h-6" />}
              title="CRM for Printers"
              description="Keep track of customer history, phone numbers, and addresses for lightning-fast repeat orders."
            />
            <FeatureCard 
              icon={<MessageSquare className="w-6 h-6" />}
              title="Messaging Hub"
              description="Send pick-up reminders and promotional messages directly to your customers' phones."
            />
            <FeatureCard 
              icon={<ShieldCheck className="w-6 h-6" />}
              title="Secure Multi-tenancy"
              description="Built on industrial-grade security. Your business data is isolated and encrypted."
            />
            <FeatureCard 
              icon={<Globe className="w-6 h-6" />}
              title="Remote Access"
              description="Manage your print house from anywhere in the world, on any device."
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1610632380989-68d199ff36e4?q=80&w=1974&auto=format&fit=crop" 
                className="rounded-[2rem] shadow-2xl relative z-10 w-full" 
                alt="Printer Detail" 
                referrerPolicy="no-referrer"
              />
              <div className="absolute -bottom-8 -left-8 bg-blue-600 text-white p-8 rounded-2xl z-20 shadow-xl">
                <p className="text-4xl font-black mb-1">100%</p>
                <p className="text-sm font-medium opacity-80">Data Accuracy Guaranteed</p>
              </div>
            </div>
            <div>
              <h2 className="text-4xl font-bold text-slate-900 mb-6 leading-tight">Born in the Print Shop, Built for the Future.</h2>
              <div className="space-y-6 text-slate-600 leading-relaxed text-lg">
                <p>
                  PrintPro started as a simple solution for a single shop and evolved into a powerful multi-tenant platform. We understand the chaotic nature of large-format printing—the deadlines, the material costs, and the need for precision.
                </p>
                <p>
                  Our mission is to empower local print houses with tools previously only available to giant corporations. Join us in digitizing the printing industry, one invoice at a time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <footer id="contact" className="bg-slate-900 pt-20 pb-10 text-white selection:bg-blue-500/30 selection:text-white">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-16 mb-20">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg">
                  <Printer className="w-6 h-6 text-white" />
                </div>
                <span className="text-2xl font-bold tracking-tight">PrintPro</span>
              </div>
              <p className="text-slate-400 text-sm leading-relaxed">
                The ultimate management operating system for professional printers across the globe. Streamline, scale, and succeed.
              </p>
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <Globe className="w-4 h-4" />
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-lg font-bold">Contact Owner</h4>
              <div className="space-y-4">
                <div className="flex items-start gap-4 group cursor-pointer text-slate-400 hover:text-white transition-colors">
                  <div className="bg-blue-600/20 text-blue-400 p-2.5 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Email Support</p>
                    <p className="text-sm font-medium">freedomtech120@gmail.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4 group cursor-pointer text-slate-400 hover:text-white transition-colors">
                  <div className="bg-blue-600/20 text-blue-400 p-2.5 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition-all">
                    <MapPin className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">Global HQ</p>
                    <p className="text-sm font-medium">Innovation District, Silicon Valley</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <h4 className="text-lg font-bold">Ready to Start?</h4>
              <p className="text-slate-400 text-sm">Join the 50+ businesses scaling their printing operations today.</p>
              <Button onClick={onLogin} className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-bold shadow-lg shadow-blue-500/20 group">
                Sign in with Google
                <ExternalLink className="w-4 h-4 ml-2 opacity-60 group-hover:opacity-100 transition-opacity" />
              </Button>
            </div>
          </div>

          <div className="pt-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 text-slate-500 text-xs font-medium text-center md:text-left">
            <p>© 2024 PrintPro Manager. All rights reserved.</p>
            <div className="flex gap-8">
              <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
              <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
              <a href="#" className="hover:text-white transition-colors">Cookie Policy</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="bg-white p-8 rounded-3xl border border-slate-100 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-500/5 transition-all group">
      <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-blue-600 group-hover:text-white transition-colors">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-600 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

// --- Views ---

function AdminView({ tenants, onImpersonate, viewingTenantId, onStopImpersonation, platformSettings, onUpdatePlatformSettings, onToggleApproval, onGrantPlan }: { 
  tenants: Tenant[], 
  onImpersonate: (id: string) => void,
  viewingTenantId: string | null,
  onStopImpersonation: () => void,
  platformSettings: PlatformSettings | null,
  onUpdatePlatformSettings: (s: PlatformSettings) => Promise<void>,
  onToggleApproval: (id: string, current: boolean) => Promise<void>,
  onGrantPlan: (id: string) => Promise<void>
}) {
  const [activeSubTab, setActiveSubTab] = useState<'tenants' | 'settings'>('tenants');
  const [editingPrices, setEditingPrices] = useState(platformSettings?.prices || { '3m': 50, '6m': 90, '1y': 150 });
  const [editingKey, setEditingKey] = useState(platformSettings?.paystackPublicKey || '');
  const [editingCurrencyCode, setEditingCurrencyCode] = useState(platformSettings?.currencyCode || 'GHS');
  const [editingCurrencySymbol, setEditingCurrencySymbol] = useState(platformSettings?.currencySymbol || 'GH₵');

  useEffect(() => {
    if (platformSettings) {
      setEditingPrices(platformSettings.prices || { '3m': 50, '6m': 90, '1y': 150 });
      setEditingKey(platformSettings.paystackPublicKey || '');
      setEditingCurrencyCode(platformSettings.currencyCode || 'GHS');
      setEditingCurrencySymbol(platformSettings.currencySymbol || 'GH₵');
    }
  }, [platformSettings]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-blue-600" />
            Admin Portal
          </h3>
          <p className="text-slate-500">Manage tenants, pricing, and system access.</p>
        </div>
        <div className="flex items-center gap-3">
          <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as any)} className="w-[300px]">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="tenants">Tenants</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
          </Tabs>
          {viewingTenantId && (
            <Button size="sm" variant="ghost" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 font-bold" onClick={onStopImpersonation}>
              <XCircle className="w-4 h-4 mr-2" />
              Stop Impersonation
            </Button>
          )}
        </div>
      </div>

      {activeSubTab === 'tenants' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tenants.map((t) => (
            <Card key={t.id} className={cn(
              "shadow-sm border-slate-200 transition-all",
              viewingTenantId === t.id ? "ring-2 ring-amber-500 border-amber-500 bg-amber-50/30" : "hover:border-blue-200"
            )}>
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  {t.photoURL ? (
                    <img src={t.photoURL} alt={t.name} referrerPolicy="no-referrer" className="w-10 h-10 rounded-full border border-slate-100" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                      {t.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-base truncate">{t.name}</CardTitle>
                      {viewingTenantId === t.id && <Eye className="w-3 h-3 text-amber-500" />}
                    </div>
                    <CardDescription className="text-xs truncate">{t.email}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 mt-2 text-sm text-slate-600">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 uppercase font-bold tracking-wider">Status</span>
                    <Badge variant={t.subscriptionStatus === 'expired' ? 'destructive' : t.subscriptionStatus === 'trial' ? 'secondary' : 'default'} className="text-[10px] h-5">
                      {t.subscriptionStatus || 'Unknown'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400 uppercase font-bold tracking-wider">Approval</span>
                    <Badge variant={t.isApproved ? 'default' : 'outline'} className={cn("text-[10px] h-5", !t.isApproved && "border-amber-200 text-amber-600")}>
                      {t.isApproved ? 'Active' : 'Unapproved'}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-xs font-mono text-[9px] text-slate-400">
                    <span>Ends: {t.subscriptionExpiresAt instanceof Timestamp ? format(t.subscriptionExpiresAt.toDate(), 'MMM d, yy') : (t.trialExpiresAt instanceof Timestamp ? format(t.trialExpiresAt.toDate(), 'MMM d, yy') : 'N/A')}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <Button 
                      variant="outline"
                      className={cn("text-xs font-bold", t.isApproved ? "text-amber-600" : "text-green-600")}
                      onClick={() => onToggleApproval(t.id, t.isApproved)}
                    >
                      {t.isApproved ? <XCircle className="w-3 h-3 mr-1" /> : <CheckCircle2 className="w-3 h-3 mr-1" />}
                      {t.isApproved ? 'Suspend' : 'Approve'}
                    </Button>
                    <Button 
                      variant={viewingTenantId === t.id ? "secondary" : "outline"}
                      className={cn("text-xs font-bold")}
                      onClick={() => viewingTenantId === t.id ? onStopImpersonation() : onImpersonate(t.id)}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      View
                    </Button>
                  </div>
                  {!t.isApproved || (!t.subscriptionExpiresAt && t.subscriptionStatus !== 'active') ? (
                    <Button 
                      variant="ghost" 
                      className="w-full mt-2 text-[10px] h-7 font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      onClick={() => onGrantPlan(t.id)}
                    >
                      <Zap className="w-3 h-3 mr-1" />
                      Grant 1-Year Manual Activation
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="max-w-2xl shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Global Platform Settings</CardTitle>
            <CardDescription>Control subscription prices and platform integration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Currency Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Currency Code (ISO)</Label>
                  <Input 
                    value={editingCurrencyCode} 
                    onChange={(e) => setEditingCurrencyCode(e.target.value.toUpperCase())}
                    placeholder="GHS, USD, NGN"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Currency Symbol</Label>
                  <Input 
                    value={editingCurrencySymbol} 
                    onChange={(e) => setEditingCurrencySymbol(e.target.value)}
                    placeholder="GH₵, $, ₦"
                  />
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <h4 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Subscription Pricing ({editingCurrencySymbol})</h4>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>3 Months</Label>
                  <Input 
                    type="number" 
                    value={editingPrices['3m']} 
                    onChange={(e) => setEditingPrices({...editingPrices, '3m': Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>6 Months</Label>
                  <Input 
                    type="number" 
                    value={editingPrices['6m']} 
                    onChange={(e) => setEditingPrices({...editingPrices, '6m': Number(e.target.value)})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>1 Year</Label>
                  <Input 
                    type="number" 
                    value={editingPrices['1y']} 
                    onChange={(e) => setEditingPrices({...editingPrices, '1y': Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Paystack Public Key</Label>
              <Input 
                value={editingKey} 
                onChange={(e) => setEditingKey(e.target.value)}
                placeholder="pk_test_..."
              />
              <p className="text-[10px] text-slate-400">This key is used for the client-side Paystack payment popup.</p>
            </div>
            <Button 
              className="bg-blue-600 hover:bg-blue-700 w-full font-bold"
              onClick={() => {
                onUpdatePlatformSettings({ 
                  ...platformSettings, 
                  prices: editingPrices, 
                  paystackPublicKey: editingKey,
                  currencyCode: editingCurrencyCode,
                  currencySymbol: editingCurrencySymbol
                });
              }}
            >
              Save Platform Settings
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SubscriptionView({ tenant, settings, user, onLogout }: { 
  tenant: Tenant | null, 
  settings: PlatformSettings | null,
  user: User,
  onLogout: () => void
}) {
  const [selectedPlan, setSelectedPlan] = useState<'3m' | '6m' | '1y'>('3m');
  const [isProcessing, setIsProcessing] = useState(false);

  // Guard: Don't render until settings (especially Paystack Key) is loaded
  if (!settings) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const price = settings.prices?.[selectedPlan] || 0;
  
  const config: any = {
    reference: (new Date()).getTime().toString(),
    email: user.email || '',
    amount: price * 100, // Smallest subunit (pesewas/cents)
    publicKey: settings.paystackPublicKey || '',
    currency: settings.currencyCode || 'GHS',
    metadata: {
      custom_fields: [
        { display_name: "Tenant ID", variable_name: "tenant_id", value: user.uid },
        { display_name: "Plan Type", variable_name: "plan_type", value: selectedPlan }
      ]
    }
  };

  const initializePayment = usePaystackPayment(config);

  const onSuccess = async (reference: any) => {
    setIsProcessing(true);
    try {
      await updateDoc(doc(db, 'tenants', user.uid), {
        subscriptionStatus: 'pending_approval',
        lastPaymentRef: reference.reference,
        planType: selectedPlan,
        isApproved: false // Require admin manual confirmation as requested
      });
    } catch (error) {
      console.error("Failed to update subscription status:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const onClose = () => {
    setIsProcessing(false);
  };

  const plans = [
    { id: '3m', label: '3 Months', price: settings?.prices['3m'] || 0, icon: <Package className="w-5 h-5 text-blue-600" /> },
    { id: '6m', label: '6 Months', price: settings?.prices['6m'] || 0, icon: <Building2 className="w-5 h-5 text-indigo-600" /> },
    { id: '1y', label: '1 Year', price: settings?.prices['1y'] || 0, icon: <Globe className="w-5 h-5 text-emerald-600" /> },
  ];

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6 selection:bg-blue-500/30">
      <div className="max-w-4xl w-full grid lg:grid-cols-2 gap-12 items-center">
        <div className="text-white">
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-600 p-2.5 rounded-2xl">
              <Printer className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-3xl font-black tracking-tight">PrintPro <span className="text-blue-500">Premium</span></h2>
          </div>
          <h1 className="text-4xl font-bold mb-6">Your Trial has Ended.</h1>
          <p className="text-slate-400 text-lg mb-8 leading-relaxed">
            Continue growing your printing business with unrestricted access to invoices, analytics, and CRM features.
          </p>
          <ul className="space-y-4 text-slate-300">
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Unlimited Automated Invoices
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              SMS Broadcasts & Reminders
            </li>
            <li className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              Advanced Profit & Loss Reports
            </li>
          </ul>
        </div>

        <Card className="border-none shadow-2xl bg-white p-8">
          <CardHeader className="p-0 mb-6">
            <CardTitle className="text-2xl font-bold">Choose a Plan</CardTitle>
            <CardDescription>Secure payment via Paystack</CardDescription>
          </CardHeader>
          
          {/* Status Banner */}
          <div className="mb-6 p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Current Status</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-slate-900 font-bold text-sm">
                  {tenant?.subscriptionStatus === 'active' ? 'Full Access Active' : 
                   tenant?.subscriptionStatus === 'pending_approval' ? 'Awaiting Activation' : 
                   tenant?.subscriptionStatus === 'trial' ? '5-Day Free Trial' : 'Subscription Expired'}
                </p>
                <Badge variant="outline" className="h-4 text-[8px] font-bold border-slate-200">
                  {tenant?.subscriptionStatus || 'N/A'}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Valid Until</p>
              <p className="text-slate-900 font-mono text-sm mt-1">
                {tenant?.subscriptionExpiresAt instanceof Timestamp ? format(tenant.subscriptionExpiresAt.toDate(), 'MMM d, yyyy') : 
                 tenant?.trialExpiresAt instanceof Timestamp ? format(tenant.trialExpiresAt.toDate(), 'MMM d, yyyy') : 'N/A'}
              </p>
            </div>
          </div>
          
          <div className="space-y-4 mb-8">
            {plans.map((plan) => {
              const isActive = tenant?.subscriptionStatus === 'active' && tenant?.planType === plan.id;
              const isPending = tenant?.subscriptionStatus === 'pending_approval' && tenant?.planType === plan.id;
              
              return (
                <div 
                  key={plan.id}
                  onClick={() => !isActive && !isPending && setSelectedPlan(plan.id as any)}
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl border-2 transition-all group relative",
                    selectedPlan === plan.id 
                      ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600" 
                      : "border-slate-100 bg-slate-50 hover:border-slate-200",
                    (isActive || isPending) && "cursor-default"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-white rounded-xl shadow-sm">
                      {plan.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-slate-900">{plan.label}</p>
                        {isActive && <Badge className="bg-green-100 text-green-700 hover:bg-green-100 h-5 text-[9px] font-black uppercase">Active Plan</Badge>}
                        {isPending && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 h-5 text-[9px] font-black uppercase">Pending Approval</Badge>}
                      </div>
                      <p className="text-xs text-slate-500">Full platform access</p>
                    </div>
                  </div>
                  <div className="text-right font-black text-slate-900 text-lg">
                    {settings?.currencySymbol || 'GH₵'}{plan.price}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="space-y-4">
            {tenant?.subscriptionStatus === 'pending_approval' ? (
              <div className="bg-amber-50 border border-amber-200 p-4 rounded-2xl flex items-start gap-4 animate-pulse">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-amber-900 font-bold text-sm">Payment Confirmation Pending</p>
                  <p className="text-amber-700 text-xs">The site administrator is currently reviewing your payment. Please wait for activation.</p>
                </div>
              </div>
            ) : !settings.paystackPublicKey ? (
              <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-start gap-4">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-900 font-bold text-sm">Configuration Required</p>
                  <p className="text-red-700 text-xs">The administrator needs to set the Paystack Public Key in the Admin Portal for payments to work.</p>
                </div>
              </div>
            ) : (
              <Button 
                className="w-full h-14 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100"
                onClick={() => {
                  try {
                    initializePayment({onSuccess, onClose});
                  } catch (e) {
                    alert("Paystack could not be initialized. Please check your Public Key.");
                  }
                }}
                disabled={isProcessing}
              >
                Pay with Paystack
                <ExternalLink className="w-5 h-5 ml-2" />
              </Button>
            )}
            
            <Button variant="ghost" className="w-full text-slate-500 hover:text-slate-700" onClick={onLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>

          <p className="mt-8 text-[10px] text-slate-400 text-center leading-relaxed">
            By paying, you agree to our Terms of Service. Payments are processed securely. Your business context will be activated manually by the administrator within 24 hours of confirmation.
          </p>
        </Card>
      </div>
    </div>
  );
}

function DashboardView({ orders, expenses, settings }: { orders: Order[], expenses: Expense[], settings: BusinessSettings | null }) {
  const currentMonth = new Date();
  const startOfCurrentMonth = startOfMonth(currentMonth);
  const endOfCurrentMonth = endOfMonth(currentMonth);

  const monthlyOrders = orders.filter(o => {
    const date = o.createdAt instanceof Timestamp ? o.createdAt.toDate() : new Date(o.createdAt);
    return isWithinInterval(date, { start: startOfCurrentMonth, end: endOfCurrentMonth });
  });

  const monthlyExpenses = expenses.filter(e => {
    const date = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date);
    return isWithinInterval(date, { start: startOfCurrentMonth, end: endOfCurrentMonth });
  });

  const totalRevenue = monthlyOrders.reduce((sum, o) => sum + o.totalAmount, 0);
  const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Chart Data
  const chartData = Array.from({ length: 6 }).map((_, i) => {
    const date = subMonths(currentMonth, 5 - i);
    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(date);
    
    const revenue = orders
      .filter(o => {
        const d = o.createdAt instanceof Timestamp ? o.createdAt.toDate() : new Date(o.createdAt);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, o) => sum + o.totalAmount, 0);

    const expense = expenses
      .filter(e => {
        const d = e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date);
        return isWithinInterval(d, { start: monthStart, end: monthEnd });
      })
      .reduce((sum, e) => sum + e.amount, 0);

    return {
      name: format(date, 'MMM'),
      revenue,
      expense,
      profit: revenue - expense
    };
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Monthly Revenue" 
          value={`${settings?.currencySymbol || 'GH₵'}${totalRevenue.toLocaleString()}`} 
          icon={<TrendingUp className="w-6 h-6 text-green-600" />}
          trend="+12% from last month"
          color="green"
        />
        <StatCard 
          title="Monthly Expenses" 
          value={`${settings?.currencySymbol || 'GH₵'}${totalExpenses.toLocaleString()}`} 
          icon={<TrendingDown className="w-6 h-6 text-red-600" />}
          trend="+5% from last month"
          color="red"
        />
        <StatCard 
          title="Net Profit" 
          value={`${settings?.currencySymbol || 'GH₵'}${netProfit.toLocaleString()}`} 
          icon={<Coins className="w-6 h-6 text-blue-600" />}
          trend="+18% from last month"
          color="blue"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
            <CardDescription>Last 6 months performance</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle>Profit Trend</CardTitle>
            <CardDescription>Monthly net profit growth</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Area type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorProfit)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Orders</CardTitle>
            <CardDescription>Latest printing jobs</CardDescription>
          </div>
          <Button variant="outline" size="sm">View All</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.slice(0, 5).map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.customerName}</TableCell>
                  <TableCell>
                    <StatusBadge status={order.status} />
                  </TableCell>
                  <TableCell>{settings?.currencySymbol || 'GH₵'}{order.totalAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-slate-500">
                    {format(order.createdAt instanceof Timestamp ? order.createdAt.toDate() : new Date(order.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon, trend, color }: { title: string, value: string, icon: React.ReactNode, trend: string, color: 'green' | 'red' | 'blue' }) {
  const colorClasses = {
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    blue: "bg-blue-50 text-blue-600"
  };

  return (
    <Card className="shadow-sm border-slate-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className={cn("p-3 rounded-2xl", colorClasses[color])}>
            {icon}
          </div>
          <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">{title}</span>
        </div>
        <div className="space-y-1">
          <h3 className="text-3xl font-bold text-slate-900">{value}</h3>
          <p className="text-sm text-slate-500 flex items-center gap-1">
            {trend}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: OrderStatus }) {
  const variants: Record<OrderStatus, { label: string, className: string, icon: React.ReactNode }> = {
    pending: { label: 'Pending', className: 'bg-amber-50 text-amber-600 border-amber-100', icon: <Clock className="w-3 h-3 mr-1" /> },
    processing: { label: 'Processing', className: 'bg-blue-50 text-blue-600 border-blue-100', icon: <AlertCircle className="w-3 h-3 mr-1" /> },
    completed: { label: 'Completed', className: 'bg-green-50 text-green-600 border-green-100', icon: <CheckCircle2 className="w-3 h-3 mr-1" /> },
    delivered: { label: 'Delivered', className: 'bg-indigo-50 text-indigo-600 border-indigo-100', icon: <Package className="w-3 h-3 mr-1" /> },
    cancelled: { label: 'Cancelled', className: 'bg-slate-50 text-slate-600 border-slate-100', icon: <XCircle className="w-3 h-3 mr-1" /> },
  };

  const config = variants[status];

  return (
    <Badge variant="outline" className={cn("px-2 py-0.5 font-medium", config.className)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}

function OrdersView({ orders, customers, products, settings, user }: { orders: Order[], customers: Customer[], products: Product[], settings: BusinessSettings | null, user: User }) {
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [isQuickAddCustomerOpen, setIsQuickAddCustomerOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  // New Order Form State
  const [pricingMode, setPricingMode] = useState<'standard' | 'area'>('standard');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [width, setWidth] = useState<string>('0');
  const [height, setHeight] = useState<string>('0');
  const [quantity, setQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('0');

  useEffect(() => {
    if (pricingMode === 'area' && selectedProduct) {
      const w = parseFloat(width) || 0;
      const h = parseFloat(height) || 0;
      const calculatedPrice = w * h * selectedProduct.pricePerSqFt;
      setUnitPrice(calculatedPrice.toFixed(2));
    }
  }, [pricingMode, selectedProduct, width, height]);

  const handlePrint = useReactToPrint({
    contentRef: receiptRef,
  });

  const handleAddOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const customerId = formData.get('customerId') as string;
    const customer = customers.find(c => c.id === customerId);
    
    const qty = Number(quantity);
    const uPrice = Number(unitPrice);
    const total = qty * uPrice;

    // Generate Invoice Number
    const invPrefix = settings?.invoicePrefix || 'INV';
    const invNumber = settings?.nextInvoiceNumber || 1001;
    const invoiceNumberString = `${invPrefix}-${invNumber.toString().padStart(4, '0')}`;

    const newOrder: Omit<Order, 'id'> = {
      tenantId: user.uid,
      invoiceNumber: invoiceNumberString,
      customerId,
      customerName: customer?.name || 'Unknown',
      items: [
        { 
          description: formData.get('description') as string,
          productId: selectedProduct?.id,
          quantity: qty, 
          unitPrice: uPrice,
          width: pricingMode === 'area' ? Number(width) : undefined,
          height: pricingMode === 'area' ? Number(height) : undefined,
          area: pricingMode === 'area' ? (Number(width) * Number(height)) : undefined,
          total: total
        }
      ],
      totalAmount: total,
      paidAmount: Number(formData.get('paidAmount')),
      status: 'pending',
      paymentStatus: Number(formData.get('paidAmount')) >= total ? 'paid' : (Number(formData.get('paidAmount')) > 0 ? 'partial' : 'unpaid'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdBy: user.uid
    };

    try {
      await addDoc(collection(db, 'orders'), newOrder);
      
      // Increment next invoice number in settings
      await updateDoc(doc(db, 'settings', user.uid), {
        nextInvoiceNumber: increment(1)
      });

      setIsNewOrderOpen(false);
      // Reset form
      setPricingMode('standard');
      setSelectedProduct(null);
      setWidth('0');
      setHeight('0');
      setQuantity('1');
      setUnitPrice('0');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'orders');
    }
  };

  const handleQuickAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newCustomer: Omit<Customer, 'id'> = {
      tenantId: user.uid,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      await addDoc(collection(db, 'customers'), newCustomer);
      setIsQuickAddCustomerOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const generateOrderMessage = (order: Order) => {
    const date = order.createdAt instanceof Timestamp ? order.createdAt.toDate() : new Date(order.createdAt);
    let message = `Invoice for ${order.customerName}\nInvoice: ${order.invoiceNumber || '#' + order.id?.slice(-8).toUpperCase()}\nDate: ${format(date, 'MMM d, yyyy')}\n\n`;
    
    order.items.forEach(item => {
      message += `- ${item.description}: ${item.quantity} x ${settings?.currencySymbol || 'GH₵'}${item.unitPrice.toFixed(2)} = ${settings?.currencySymbol || 'GH₵'}${item.total.toFixed(2)}\n`;
      if (item.area) {
        message += `  Size: ${item.width}ft x ${item.height}ft\n`;
      }
    });
    
    message += `\nTotal Amount: ${settings?.currencySymbol || 'GH₵'}${order.totalAmount.toFixed(2)}`;
    message += `\nPaid Amount: ${settings?.currencySymbol || 'GH₵'}${order.paidAmount.toFixed(2)}`;
    message += `\nBalance Due: ${settings?.currencySymbol || 'GH₵'}${(order.totalAmount - order.paidAmount).toFixed(2)}`;
    message += `\n\nThank you for choosing ${settings?.name || 'PrintPro Manager'}!`;
    
    return message;
  };

  const handleShareWhatsApp = (order: Order) => {
    const message = encodeURIComponent(generateOrderMessage(order));
    const customer = customers.find(c => c.id === order.customerId);
    const phone = customer?.phone ? customer.phone.replace(/\D/g, '') : '';
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  };

  const handleShareEmail = (order: Order) => {
    const subject = encodeURIComponent(`Invoice from ${settings?.name || 'PrintPro Manager'}`);
    const body = encodeURIComponent(generateOrderMessage(order));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleShareSMS = async (order: Order) => {
    if (!settings?.smsApiKey || !settings?.smsSenderId) {
      alert("Please configure SMS Gateway in Settings first.");
      return;
    }

    const customer = customers.find(c => c.id === order.customerId);
    const phone = customer?.phone?.replace(/\D/g, '');
    
    if (!phone) {
      alert("Customer has no phone number.");
      return;
    }

    const message = generateOrderMessage(order);
    
    try {
      await axios.post('/api/send-sms', {
        provider: settings.smsProvider,
        apiKey: settings.smsApiKey,
        senderId: settings.smsSenderId,
        recipients: [phone],
        message: message
      });
      alert("Invoice sent via SMS!");
    } catch (error: any) {
      alert("Failed to send SMS: " + (error.response?.data?.details || error.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative w-full max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input placeholder="Search orders..." className="pl-10 bg-white border-slate-200" />
        </div>
        <Dialog open={isNewOrderOpen} onOpenChange={setIsNewOrderOpen}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Order
            </Button>
          } />
          <DialogContent className="sm:max-w-lg">
            <form onSubmit={handleAddOrder}>
              <DialogHeader>
                <DialogTitle>Create New Order</DialogTitle>
                <DialogDescription>Enter the details for the new printing job.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex items-end gap-2">
                  <div className="grid gap-2 flex-1">
                    <Label htmlFor="customerId">Customer</Label>
                    <Select name="customerId" required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a customer" />
                      </SelectTrigger>
                      <SelectContent>
                        {customers.map(c => (
                          <SelectItem key={c.id} value={c.id!}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={isQuickAddCustomerOpen} onOpenChange={setIsQuickAddCustomerOpen}>
                    <DialogTrigger render={
                      <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0 border-slate-200 hover:bg-slate-50 hover:text-blue-600">
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    } />
                    <DialogContent>
                      <form onSubmit={handleQuickAddCustomer}>
                        <DialogHeader>
                          <DialogTitle>Quick Add Customer</DialogTitle>
                          <DialogDescription>Add a new customer without leaving the order form.</DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" name="name" placeholder="John Doe" required />
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="phone">Phone Number</Label>
                            <Input id="phone" name="phone" placeholder="+1 (555) 000-0000" />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full">Save Customer</Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>Pricing Mode</Label>
                    <Select value={pricingMode} onValueChange={(v: any) => setPricingMode(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="standard">Standard</SelectItem>
                        <SelectItem value="area">Area-Based (Sq Ft)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {pricingMode === 'area' && (
                    <div className="grid gap-2">
                      <Label>Product / Material</Label>
                      <Select onValueChange={(v) => setSelectedProduct(products.find(p => p.id === v) || null)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select material" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id!}>{p.name} ({settings?.currencySymbol || 'GH₵'}{p.pricePerSqFt}/sqft)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">Job Description</Label>
                  <Input id="description" name="description" placeholder="e.g. 500 Business Cards" required />
                </div>

                {pricingMode === 'area' ? (
                  <div className="grid grid-cols-3 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="width">Width (ft)</Label>
                      <Input id="width" type="number" step="0.1" value={width} onChange={(e) => setWidth(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="height">Height (ft)</Label>
                      <Input id="height" type="number" step="0.1" value={height} onChange={(e) => setHeight(e.target.value)} required />
                    </div>
                    <div className="grid gap-2">
                      <Label>Area (sq ft)</Label>
                      <div className="h-10 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-medium">
                        {(parseFloat(width) * parseFloat(height) || 0).toFixed(2)}
                      </div>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input id="quantity" type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="unitPrice">{pricingMode === 'area' ? `Price per Piece (${settings?.currencySymbol || 'GH₵'})` : `Unit Price (${settings?.currencySymbol || 'GH₵'})`}</Label>
                    <Input 
                      id="unitPrice" 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      value={unitPrice} 
                      onChange={(e) => setUnitPrice(e.target.value)} 
                      required 
                    />
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                  <span className="text-sm font-medium text-blue-700">Total Amount:</span>
                  <span className="text-lg font-bold text-blue-900">{settings?.currencySymbol || 'GH₵'}{(Number(quantity) * Number(unitPrice)).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="paidAmount">Paid Amount ({settings?.currencySymbol || 'GH₵'})</Label>
                  <Input id="paidAmount" name="paidAmount" type="number" step="0.01" min="0" defaultValue="0" required />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full">Create Order</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="w-[120px]">Invoice #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="font-mono text-xs text-slate-500 font-bold">
                    {order.invoiceNumber || `#${order.id?.slice(-6).toUpperCase()}`}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-slate-900">{order.customerName}</div>
                    <div className="text-xs text-slate-500">{order.items[0]?.description}</div>
                  </TableCell>
                  <TableCell>
                    <Select 
                      defaultValue={order.status} 
                      onValueChange={(v) => updateOrderStatus(order.id!, v as OrderStatus)}
                    >
                      <SelectTrigger className="w-[130px] h-8 border-none bg-transparent p-0 focus:ring-0">
                        <StatusBadge status={order.status} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="processing">Processing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={cn(
                      "font-medium",
                      order.paymentStatus === 'paid' ? "bg-green-100 text-green-700" : 
                      order.paymentStatus === 'partial' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    )}>
                      {order.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold">{settings?.currencySymbol || 'GH₵'}{order.totalAmount.toLocaleString()}</TableCell>
                  <TableCell className="text-slate-500">
                    {format(order.createdAt instanceof Timestamp ? order.createdAt.toDate() : new Date(order.createdAt), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-green-600"
                        title="Share on WhatsApp"
                        onClick={() => handleShareWhatsApp(order)}
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        title="Print Invoice"
                        onClick={() => { setSelectedOrder(order); setIsReceiptOpen(true); }}
                      >
                        <Printer className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Receipt/Invoice Dialog */}
      <Dialog open={isReceiptOpen} onOpenChange={setIsReceiptOpen}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden bg-white">
          <div className="p-8 max-h-[80vh] overflow-y-auto" ref={receiptRef}>
            {selectedOrder && (
              <div className="space-y-8">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-3xl font-bold text-slate-900">{settings?.name || 'PrintPro Manager'}</h1>
                    <p className="text-slate-500 text-sm whitespace-pre-line">{settings?.address}</p>
                    <p className="text-slate-500 text-sm">{settings?.phone}</p>
                  </div>
                  <div className="text-right">
                    <h2 className="text-xl font-bold text-blue-600">INVOICE</h2>
                    <p className="text-slate-900 font-medium">{selectedOrder.invoiceNumber || `#${selectedOrder.id?.slice(-8).toUpperCase()}`}</p>
                    <p className="text-slate-500 text-sm">Date: {format(selectedOrder.createdAt instanceof Timestamp ? selectedOrder.createdAt.toDate() : new Date(selectedOrder.createdAt), 'MMM d, yyyy')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-8 py-6 border-y border-slate-100">
                  <div>
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Bill To</h3>
                    <p className="font-bold text-slate-900">{selectedOrder.customerName}</p>
                    {customers.find(c => c.id === selectedOrder.customerId)?.address && (
                      <p className="text-slate-500 text-sm">{customers.find(c => c.id === selectedOrder.customerId)?.address}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Status</h3>
                    <StatusBadge status={selectedOrder.status} />
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedOrder.items.map((item, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">
                          <div>{item.description}</div>
                          {item.area && (
                            <div className="text-xs text-slate-500 font-normal mt-0.5">
                              Size: {item.width}ft x {item.height}ft ({item.area.toFixed(2)} sq ft)
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{settings?.currencySymbol || 'GH₵'}{item.unitPrice.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                        <TableCell className="text-right font-bold">{settings?.currencySymbol || 'GH₵'}{item.total.toLocaleString(undefined, {minimumFractionDigits: 2})}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-slate-500">
                      <span>Subtotal</span>
                      <span>{settings?.currencySymbol || 'GH₵'}{selectedOrder.totalAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-slate-500">
                      <span>Paid</span>
                      <span>-{settings?.currencySymbol || 'GH₵'}{selectedOrder.paidAmount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xl font-bold text-slate-900 pt-2 border-t border-slate-200">
                      <span>Balance</span>
                      <span>{settings?.currencySymbol || 'GH₵'}{(selectedOrder.totalAmount - selectedOrder.paidAmount).toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-12 text-center">
                  <p className="text-slate-500 text-sm">Thank you for your business!</p>
                  <p className="text-slate-400 text-xs mt-1">Generated by PrintPro Manager</p>
                </div>
              </div>
            )}
          </div>
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-end gap-3">
            <Button variant="outline" onClick={() => setIsReceiptOpen(false)}>Close</Button>
            {selectedOrder && (
              <>
                <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleShareWhatsApp(selectedOrder)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
                <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50" onClick={() => handleShareEmail(selectedOrder)}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </Button>
                <Button variant="outline" className="text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => handleShareSMS(selectedOrder)}>
                  <MessageSquare className="w-4 h-4 mr-2" />
                  SMS
                </Button>
              </>
            )}
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handlePrint()}>
              <Printer className="w-4 h-4 mr-2" />
              Print Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductsView({ products, settings, user }: { products: Product[], settings: BusinessSettings | null, user: User }) {
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newProduct: Omit<Product, 'id'> = {
      tenantId: user.uid,
      name: formData.get('name') as string,
      pricePerSqFt: Number(formData.get('pricePerSqFt')),
      category: formData.get('category') as string,
    };

    try {
      await addDoc(collection(db, 'products'), newProduct);
      setIsNewProductOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'products');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Products & Services</h3>
        <Dialog open={isNewProductOpen} onOpenChange={setIsNewProductOpen}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Product
            </Button>
          } />
          <DialogContent>
            <form onSubmit={handleAddProduct}>
              <DialogHeader>
                <DialogTitle>Add New Product</DialogTitle>
                <DialogDescription>Define a product with its price per square foot.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Product Name</Label>
                  <Input id="name" name="name" placeholder="Vinyl Banner" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="pricePerSqFt">Price per Sq Ft ({settings?.currencySymbol || 'GH₵'})</Label>
                  <Input id="pricePerSqFt" name="pricePerSqFt" type="number" step="0.01" min="0" placeholder="5.00" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Input id="category" name="category" placeholder="Large Format Printing" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full">Save Product</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="shadow-sm border-slate-200">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-bold">{product.name}</CardTitle>
              <Tag className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{settings?.currencySymbol || 'GH₵'}{product.pricePerSqFt.toFixed(2)} / sq ft</div>
              <p className="text-xs text-slate-500 mt-1 capitalize">{product.category}</p>
              <div className="flex justify-end mt-4">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 text-slate-400 hover:text-red-600"
                  onClick={() => handleDeleteProduct(product.id!)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ExpensesView({ expenses, settings, user }: { expenses: Expense[], settings: BusinessSettings | null, user: User }) {
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newExpense: Omit<Expense, 'id'> = {
      tenantId: user.uid,
      description: formData.get('description') as string,
      amount: Number(formData.get('amount')),
      category: formData.get('category') as string,
      date: serverTimestamp(),
      createdBy: user.uid
    };

    try {
      await addDoc(collection(db, 'expenses'), newExpense);
      setIsNewExpenseOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'expenses');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Business Expenses</h3>
        <Dialog open={isNewExpenseOpen} onOpenChange={setIsNewExpenseOpen}>
          <DialogTrigger render={
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Expense
            </Button>
          } />
          <DialogContent>
            <form onSubmit={handleAddExpense}>
              <DialogHeader>
                <DialogTitle>Add New Expense</DialogTitle>
                <DialogDescription>Record a business cost to track your profit accurately.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="description">Description</Label>
                  <Input id="description" name="description" placeholder="e.g. Ink Cartridges" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="amount">Amount ({settings?.currencySymbol || 'GH₵'})</Label>
                  <Input id="amount" name="amount" type="number" step="0.01" min="0" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="category">Category</Label>
                  <Select name="category" required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="supplies">Supplies</SelectItem>
                      <SelectItem value="rent">Rent</SelectItem>
                      <SelectItem value="utilities">Utilities</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full">Record Expense</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead>Description</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expenses.map((expense) => (
                <TableRow key={expense.id}>
                  <TableCell className="font-medium">{expense.description}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">{expense.category}</Badge>
                  </TableCell>
                  <TableCell className="text-red-600 font-semibold">-{settings?.currencySymbol || 'GH₵'}{expense.amount.toLocaleString()}</TableCell>
                  <TableCell className="text-slate-500">
                    {format(expense.date instanceof Timestamp ? expense.date.toDate() : new Date(expense.date), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CustomersView({ customers, settings, user }: { customers: Customer[], settings: BusinessSettings | null, user: User }) {
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newCustomer: Omit<Customer, 'id'> = {
      tenantId: user.uid,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      await addDoc(collection(db, 'customers'), newCustomer);
      setIsNewCustomerOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'customers');
    }
  };

  const handleBroadcastSms = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!settings?.smsApiKey || !settings?.smsSenderId) {
      alert("Please configure SMS Gateway in Settings first.");
      return;
    }

    const formData = new FormData(e.currentTarget);
    const message = formData.get('message') as string;
    const recipients = customers.map(c => c.phone).filter(p => !!p);

    if (recipients.length === 0) {
      alert("No customers with phone numbers found.");
      return;
    }

    setIsSending(true);
    try {
      await axios.post('/api/send-sms', {
        provider: settings.smsProvider,
        apiKey: settings.smsApiKey,
        senderId: settings.smsSenderId,
        recipients: recipients,
        message: message
      });
      alert("Broadcast message sent successfully!");
      setIsBroadcastOpen(false);
    } catch (error: any) {
      console.error("SMS Error:", error);
      alert("Failed to send broadcast: " + (error.response?.data?.details || error.message));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Customers</h3>
        <div className="flex gap-2">
          <Dialog open={isBroadcastOpen} onOpenChange={setIsBroadcastOpen}>
            <DialogTrigger render={
              <Button variant="outline" className="text-blue-600 border-blue-200 hover:bg-blue-50">
                <MessageSquare className="w-4 h-4 mr-2" />
                Broadcast SMS
              </Button>
            } />
            <DialogContent>
              <form onSubmit={handleBroadcastSms}>
                <DialogHeader>
                  <DialogTitle>Broadcast SMS Message</DialogTitle>
                  <DialogDescription>Send a message to all customers with a phone number.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                    <strong>Recipients:</strong> {customers.filter(c => !!c.phone).length} customers will receive this message.
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="message">Message Body</Label>
                    <textarea 
                      id="message" 
                      name="message" 
                      className="min-h-[120px] p-3 rounded-md border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                      placeholder="Enter ceremonial or reminder message..."
                      required
                    ></textarea>
                    <p className="text-[10px] text-slate-400">Avoid using special characters for maximum compatibility.</p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={isSending} className="bg-blue-600 hover:bg-blue-700 w-full font-bold">
                    {isSending ? "Sending..." : "Send Broadcast"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isNewCustomerOpen} onOpenChange={setIsNewCustomerOpen}>
            <DialogTrigger render={
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Plus className="w-4 h-4 mr-2" />
                Add Customer
              </Button>
            } />
            <DialogContent>
              <form onSubmit={handleAddCustomer}>
                <DialogHeader>
                  <DialogTitle>Add New Customer</DialogTitle>
                  <DialogDescription>Store customer details for quick order creation.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input id="name" name="name" placeholder="John Doe" required />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" placeholder="john@example.com" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input id="phone" name="phone" placeholder="+1 (555) 000-0000" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address">Address</Label>
                    <Input id="address" name="address" placeholder="123 Printing St." />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="bg-blue-600 hover:bg-blue-700 w-full font-bold">Save Customer</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {customers.map((customer) => (
          <Card key={customer.id} className="shadow-sm border-slate-200 hover:border-blue-200 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                  {customer.name.charAt(0).toUpperCase()}
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400">
                  <Edit className="w-4 h-4" />
                </Button>
              </div>
              <CardTitle className="mt-4">{customer.name}</CardTitle>
              <CardDescription>{customer.email || 'No email provided'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Contact</p>
                <p className="text-sm text-slate-600">{customer.phone || 'No phone'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Address</p>
                <p className="text-sm text-slate-600 truncate">{customer.address || 'No address'}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SettingsView({ settings, user }: { settings: BusinessSettings | null, user: User }) {
  const handleSaveSettings = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const newSettings: BusinessSettings = {
      tenantId: user.uid,
      name: formData.get('name') as string,
      address: formData.get('address') as string,
      phone: formData.get('phone') as string,
      email: formData.get('email') as string,
      website: formData.get('website') as string,
      invoicePrefix: formData.get('invoicePrefix') as string,
      nextInvoiceNumber: Number(formData.get('nextInvoiceNumber')),
      currencyCode: formData.get('currencyCode') as string || 'GHS',
      currencySymbol: formData.get('currencySymbol') as string || 'GH₵',
      smsProvider: formData.get('smsProvider') as 'arkasel' | 'mnotify',
      smsApiKey: formData.get('smsApiKey') as string,
      smsSenderId: formData.get('smsSenderId') as string,
    };

    try {
      await setDoc(doc(db, 'settings', user.uid), { ...newSettings }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `settings/${user.uid}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle>Business Settings</CardTitle>
          <CardDescription>Configure your business details for invoices and receipts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Business Name</Label>
                <Input id="name" name="name" defaultValue={settings?.name} placeholder="Your Print Shop" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Business Address</Label>
                <Input id="address" name="address" defaultValue={settings?.address} placeholder="123 Main St, City, Country" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" name="phone" defaultValue={settings?.phone} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Business Email</Label>
                  <Input id="email" name="email" defaultValue={settings?.email} type="email" placeholder="contact@printshop.com" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" name="website" defaultValue={settings?.website} placeholder="www.printshop.com" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="invoicePrefix">Invoice Prefix</Label>
                  <Input id="invoicePrefix" name="invoicePrefix" defaultValue={settings?.invoicePrefix} placeholder="INV-" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="nextInvoiceNumber">Next Invoice Number</Label>
                  <Input id="nextInvoiceNumber" name="nextInvoiceNumber" defaultValue={settings?.nextInvoiceNumber} type="number" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                <div className="grid gap-2">
                  <Label htmlFor="currencyCode">Business Currency Code (ISO)</Label>
                  <Input id="currencyCode" name="currencyCode" defaultValue={settings?.currencyCode || 'GHS'} placeholder="USD, GHS, etc." />
                  <p className="text-[10px] text-slate-400 font-medium">Standard 3-letter currency code.</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="currencySymbol">Currency Symbol</Label>
                  <Input id="currencySymbol" name="currencySymbol" defaultValue={settings?.currencySymbol || 'GH₵'} placeholder="$, GH₵, etc." />
                  <p className="text-[10px] text-slate-400 font-medium">Symbol for invoices and reports.</p>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                  SMS Gateway Configuration
                </h4>
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="smsProvider">SMS Provider</Label>
                    <Select name="smsProvider" defaultValue={settings?.smsProvider || 'arkasel'}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select provider" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="arkasel">Arkasel</SelectItem>
                        <SelectItem value="mnotify">mNotify</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="smsApiKey">API Key</Label>
                    <Input id="smsApiKey" name="smsApiKey" type="password" defaultValue={settings?.smsApiKey} placeholder="Enter your API Key" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="smsSenderId">Sender ID (Alpha Numeric)</Label>
                    <Input id="smsSenderId" name="smsSenderId" defaultValue={settings?.smsSenderId} placeholder="e.g. PRINTPRO" />
                  </div>
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">Save Settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

