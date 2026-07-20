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
  ChevronLeft,
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
  Calendar,
  Cloud,
  FileSpreadsheet,
  RefreshCw
} from 'lucide-react';
import { 
  auth, 
  db, 
  OperationType, 
  handleFirestoreError 
} from './firebase';
import { initializeApp, getApps } from 'firebase/app';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  User,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  getAuth
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
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// Helper to replace oklch color declarations in CSS string to prevent html2canvas errors
const replaceOklchInString = (cssText: string): string => {
  let index = cssText.toLowerCase().indexOf('oklch(');
  while (index !== -1) {
    let openParentheses = 1;
    let i = index + 6;
    while (i < cssText.length && openParentheses > 0) {
      if (cssText[i] === '(') openParentheses++;
      else if (cssText[i] === ')') openParentheses--;
      i++;
    }
    cssText = cssText.substring(0, index) + 'rgb(0, 0, 0)' + cssText.substring(i);
    index = cssText.toLowerCase().indexOf('oklch(');
  }
  return cssText;
};

// Helper to generate and optionally download a PDF from a DOM element
const generatePDFHelper = async (
  element: HTMLElement,
  fileName: string,
  download: boolean = true
): Promise<Blob | null> => {
  const originalStyles = new Map<HTMLStyleElement, string>();
  const tempStyleElements: HTMLStyleElement[] = [];
  const disabledLinks: HTMLLinkElement[] = [];

  try {
    // Hide components we don't want in the PDF (e.g. interactive controls)
    const excludeElements = element.querySelectorAll('.hide-on-pdf, button');
    excludeElements.forEach(el => el.classList.add('invisible'));

    // Sanitize any style elements containing oklch
    const styleElements = document.querySelectorAll('style');
    styleElements.forEach((el) => {
      const html = el.innerHTML;
      if (html && html.toLowerCase().includes('oklch(')) {
        originalStyles.set(el, html);
        el.innerHTML = replaceOklchInString(html);
      }
    });

    // Also sanitize local/same-origin <link rel="stylesheet"> elements
    const linkElements = Array.from(document.querySelectorAll('link[rel="stylesheet"]')) as HTMLLinkElement[];
    for (const link of linkElements) {
      try {
        const isLocal = !link.href || link.href.startsWith(window.location.origin) || link.href.startsWith('/');
        if (isLocal) {
          const response = await fetch(link.href);
          if (response.ok) {
            let cssText = await response.text();
            if (cssText.toLowerCase().includes('oklch(')) {
              cssText = replaceOklchInString(cssText);
              const tempStyle = document.createElement('style');
              tempStyle.innerHTML = cssText;
              document.head.appendChild(tempStyle);
              tempStyleElements.push(tempStyle);
              
              link.disabled = true;
              disabledLinks.push(link);
            }
          }
        }
      } catch (e) {
        console.warn('Could not sanitize link stylesheet:', link.href, e);
      }
    }

    // Capture the element using html2canvas
    const canvas = await html2canvas(element, {
      scale: 2, // Capture at high density
      useCORS: true, 
      logging: false,
      backgroundColor: '#ffffff',
    });

    // Restore hidden status
    excludeElements.forEach(el => el.classList.remove('invisible'));

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const imgWidth = 210; // A4 standard width
    const pageHeight = 295; // A4 standard height
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    // Drawing first page
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
    heightLeft -= pageHeight;

    // Handle multi-page PDFs
    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pageHeight;
    }

    if (download) {
      pdf.save(fileName);
    }

    return pdf.output('blob');
  } catch (error) {
    console.error('Error generating PDF:', error);
    return null;
  } finally {
    // Restore original styles
    originalStyles.forEach((val, el) => {
      el.innerHTML = val;
    });

    // Remove temporary style elements and re-enable link elements
    tempStyleElements.forEach(el => el.remove());
    disabledLinks.forEach(link => {
      link.disabled = false;
    });
  }
};

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Orders Search & Filter State
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

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

  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

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
            photoURL: u.photoURL || null,
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
    } catch (error: any) {
      console.error("Login failed:", error);
      const errorCode = error?.code;
      const errorMessage = error?.message || String(error);

      if (errorCode === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        alert(
          `Firebase Authentication Error: Unauthorized Domain!\n\n` +
          `To enable Google Sign-In on this domain, please follow these steps:\n\n` +
          `1. Open the Firebase Console (https://console.firebase.google.com/)\n` +
          `2. Select your project (gen-lang-client-0647954847 or similar)\n` +
          `3. Go to "Authentication" -> "Settings" -> "Authorized Domains"\n` +
          `4. Click "Add domain" and enter your current hosting domain: ${currentDomain}\n` +
          `5. Save and refresh this page. Google Login will work immediately!`
        );
      } else if (errorCode === 'auth/popup-blocked') {
        alert(
          `Login Failed: Pop-up blocked!\n\n` +
          `Your browser blocked the Google Sign-In pop-up. Please allow pop-ups for this site or try again.`
        );
      } else if (errorCode === 'auth/popup-closed-by-user') {
        alert(`Login was cancelled because the sign-in window was closed before completion.`);
      } else {
        alert(
          `Sign-in failed: ${errorMessage}\n\n` +
          `Code: ${errorCode || 'unknown'}`
        );
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setGoogleAccessToken(null);
  };

  const handleConnectGoogleSheets = async () => {
    const provider = new GoogleAuthProvider();
    provider.addScope('https://www.googleapis.com/auth/spreadsheets');
    provider.addScope('https://www.googleapis.com/auth/drive.file');
    try {
      const apps = getApps();
      let tempApp = apps.find(app => app.name === 'temp-sheets-app');
      if (!tempApp) {
        tempApp = initializeApp(firebaseConfig, 'temp-sheets-app');
      }
      const tempAuth = getAuth(tempApp);
      const result = await signInWithPopup(tempAuth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      if (credential?.accessToken) {
        setGoogleAccessToken(credential.accessToken);
        return credential.accessToken;
      }
    } catch (error) {
      console.error("Connect Google Sheets failed:", error);
      alert("Failed to connect to Google Sheets. Please make sure to grant the required permissions.");
    }
    return null;
  };

  const syncToGoogleSheetsQuietly = async (tokenInput?: string) => {
    const activeToken = tokenInput || googleAccessToken;
    if (!activeToken || !settings?.googleSheetId) return;
    try {
      const sheetId = settings.googleSheetId;
      const updateSheetValQuietly = async (tabName: string, headers: string[], rows: any[][]) => {
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}:clear`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${activeToken}` }
        });
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A1?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `${tabName}!A1`,
            majorDimension: 'ROWS',
            values: [headers, ...rows]
          })
        });
      };

      const orderHeaders = ['Order ID', 'Invoice Number', 'Customer Name', 'Total Amount', 'Paid Amount', 'Status', 'Payment Status', 'Items Description', 'Created At', 'Created By'];
      const orderRows = orders.map(o => [
        o.id || '',
        o.invoiceNumber || '',
        o.customerName || '',
        o.totalAmount || 0,
        o.paidAmount || 0,
        o.status || '',
        o.paymentStatus || '',
        o.items?.map(it => `${it.description || ''} (Qty: ${it.quantity || 1}, Price: ${it.unitPrice || 0}, Total: ${it.total || 0})`).join('; ') || '',
        o.createdAt && typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toISOString() : String(o.createdAt || ''),
        o.createdBy || ''
      ]);
      await updateSheetValQuietly('Orders', orderHeaders, orderRows);

      const expenseHeaders = ['Expense ID', 'Description', 'Amount', 'Category', 'Date', 'Created By'];
      const expenseRows = expenses.map(e => [
        e.id || '',
        e.description || '',
        e.amount || 0,
        e.category || '',
        e.date && typeof e.date.toDate === 'function' ? e.date.toDate().toISOString() : String(e.date || ''),
        e.createdBy || ''
      ]);
      await updateSheetValQuietly('Expenses', expenseHeaders, expenseRows);

      const customerHeaders = ['Customer ID', 'Name', 'Email', 'Phone', 'Address'];
      const customerRows = customers.map(c => [
        c.id || '',
        c.name || '',
        c.email || '',
        c.phone || '',
        c.address || ''
      ]);
      await updateSheetValQuietly('Customers', customerHeaders, customerRows);

      const productHeaders = ['Product ID', 'Name', 'Price per Sq Ft', 'Category'];
      const productRows = products.map(p => [
        p.id || '',
        p.name || '',
        p.pricePerSqFt || 0,
        p.category || ''
      ]);
      await updateSheetValQuietly('Products', productHeaders, productRows);

      const lastSynced = new Date().toLocaleString();
      await setDoc(doc(db, 'settings', user!.uid), {
        googleSheetsLastSyncedAt: lastSynced
      }, { merge: true });
    } catch (err) {
      console.error("Quiet background sync failed:", err);
    }
  };

  const syncToGoogleSheets = async (tokenToUse?: string) => {
    const activeToken = tokenToUse || googleAccessToken;
    if (!activeToken) {
      alert("Please connect your Google Account first.");
      return;
    }

    if (!settings) return;

    setIsSyncing(true);
    try {
      let sheetId = settings.googleSheetId;
      let sheetUrl = settings.googleSheetUrl;

      // 1. Create spreadsheet if it doesn't exist
      if (!sheetId) {
        const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            properties: {
              title: `${settings.name || 'My Print Shop'} - PrintPro Manager Backup`
            },
            sheets: [
              { properties: { title: 'Orders' } },
              { properties: { title: 'Expenses' } },
              { properties: { title: 'Customers' } },
              { properties: { title: 'Products' } }
            ]
          })
        });

        if (!createRes.ok) {
          const errMsg = await createRes.text();
          throw new Error(`Failed to create Google Sheet: ${errMsg}`);
        }

        const createData = await createRes.json();
        sheetId = createData.spreadsheetId;
        sheetUrl = createData.spreadsheetUrl;

        // Save to business settings in Firestore
        await setDoc(doc(db, 'settings', user!.uid), {
          googleSheetId: sheetId,
          googleSheetUrl: sheetUrl
        }, { merge: true });
      }

      // Helper function to update values
      const updateSheetVal = async (tabName: string, headers: string[], rows: any[][]) => {
        // Clear existing sheet contents first to avoid stale entries
        await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}:clear`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${activeToken}`
          }
        });

        // Write fresh values
        const updateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${tabName}!A1?valueInputOption=USER_ENTERED`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${activeToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `${tabName}!A1`,
            majorDimension: 'ROWS',
            values: [headers, ...rows]
          })
        });

        if (!updateRes.ok) {
          const errMsg = await updateRes.text();
          throw new Error(`Failed to write to sheet tab '${tabName}': ${errMsg}`);
        }
      };

      // 2. Prep and send data for Orders
      const orderHeaders = ['Order ID', 'Invoice Number', 'Customer Name', 'Total Amount', 'Paid Amount', 'Status', 'Payment Status', 'Items Description', 'Created At', 'Created By'];
      const orderRows = orders.map(o => [
        o.id || '',
        o.invoiceNumber || '',
        o.customerName || '',
        o.totalAmount || 0,
        o.paidAmount || 0,
        o.status || '',
        o.paymentStatus || '',
        o.items?.map(it => `${it.description || ''} (Qty: ${it.quantity || 1}, Price: ${it.unitPrice || 0}, Total: ${it.total || 0})`).join('; ') || '',
        o.createdAt && typeof o.createdAt.toDate === 'function' ? o.createdAt.toDate().toISOString() : String(o.createdAt || ''),
        o.createdBy || ''
      ]);
      await updateSheetVal('Orders', orderHeaders, orderRows);

      // 3. Prep and send data for Expenses
      const expenseHeaders = ['Expense ID', 'Description', 'Amount', 'Category', 'Date', 'Created By'];
      const expenseRows = expenses.map(e => [
        e.id || '',
        e.description || '',
        e.amount || 0,
        e.category || '',
        e.date && typeof e.date.toDate === 'function' ? e.date.toDate().toISOString() : String(e.date || ''),
        e.createdBy || ''
      ]);
      await updateSheetVal('Expenses', expenseHeaders, expenseRows);

      // 4. Prep and send data for Customers
      const customerHeaders = ['Customer ID', 'Name', 'Email', 'Phone', 'Address'];
      const customerRows = customers.map(c => [
        c.id || '',
        c.name || '',
        c.email || '',
        c.phone || '',
        c.address || ''
      ]);
      await updateSheetVal('Customers', customerHeaders, customerRows);

      // 5. Prep and send data for Products
      const productHeaders = ['Product ID', 'Name', 'Price per Sq Ft', 'Category'];
      const productRows = products.map(p => [
        p.id || '',
        p.name || '',
        p.pricePerSqFt || 0,
        p.category || ''
      ]);
      await updateSheetVal('Products', productHeaders, productRows);

      // Update sync time
      const lastSynced = new Date().toLocaleString();
      await setDoc(doc(db, 'settings', user!.uid), {
        googleSheetsLastSyncedAt: lastSynced
      }, { merge: true });

      alert("Successfully synchronized all data to your Google Sheet!");
    } catch (err: any) {
      console.error(err);
      alert(`Synchronizing to Google Sheets failed: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync effect: when lists change, if auto-sync is enabled and token exists, run sync in background without alerting
  useEffect(() => {
    if (settings?.googleSheetsAutoSync && googleAccessToken && settings.googleSheetId) {
      const timer = setTimeout(() => {
        syncToGoogleSheetsQuietly();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [orders, expenses, customers, products, googleAccessToken, settings?.googleSheetsAutoSync, settings?.googleSheetId]);

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

  const isPendingApproval = tenant?.subscriptionStatus === 'pending_approval';

  const trialDaysLeft = tenant?.trialExpiresAt && typeof tenant.trialExpiresAt.toDate === 'function'
    ? Math.max(0, Math.ceil((tenant.trialExpiresAt.toDate().getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0;
  
  // A user is restricted if they are NOT an admin AND they don't have an active trial, active subscription, or pending approval
  // Crucially, we wait for tenant to be defined before making this decision to avoid flashing/errors
  const isRestricted = tenant ? (!tenant.isAdmin && !isTrialActive && !isSubActive && !isPendingApproval) : false;

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
            <NavItem 
              icon={<BarChart3 className="w-5 h-5" />} 
              label="Accounts Report" 
              active={activeTab === 'reports'} 
              onClick={() => { setActiveTab('reports'); setIsSidebarOpen(false); }} 
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
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ''} className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border-2 border-white shadow-sm">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
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
            {tenant?.subscriptionStatus === 'pending_approval' && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 py-1 px-3 animate-pulse">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                Payment Pending Approval
              </Badge>
            )}
            {tenant?.subscriptionStatus === 'trial' && isTrialActive && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 gap-1.5 py-1 px-3">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                {trialDaysLeft} Days Trial Left
              </Badge>
            )}
            {!isOnline && (
              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1.5 py-1 px-3">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Working Offline
              </Badge>
            )}
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
              {activeTab === 'reports' && <MonthlyReportView orders={orders} expenses={expenses} settings={settings} user={user} />}
              {activeTab === 'subscription' && (
                <div className="max-w-5xl mx-auto py-8">
                  <SubscriptionView tenant={tenant} settings={platformSettings} user={user} onLogout={handleLogout} />
                </div>
              )}
              {activeTab === 'settings' && (
                <SettingsView 
                  settings={settings} 
                  user={user} 
                  googleAccessToken={googleAccessToken}
                  isSyncing={isSyncing}
                  handleConnectGoogleSheets={handleConnectGoogleSheets}
                  syncToGoogleSheets={syncToGoogleSheets}
                />
              )}
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
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('register');

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessType, setBusinessType] = useState('Digital Printing');
  const [currency, setCurrency] = useState('GHS_GH₵');

  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGetStartedClick = (tab: 'register' | 'login') => {
    setAuthTab(tab);
    setIsAuthModalOpen(true);
    setAuthError(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error("Login error:", err);
      let msg = "Failed to sign in. Please check your credentials.";
      if (err?.code === 'auth/user-not-found' || err?.code === 'auth/wrong-password') {
        msg = "Incorrect email or password.";
      } else if (err?.code === 'auth/invalid-email') {
        msg = "Please enter a valid email address.";
      }
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !confirmPassword || !ownerName || !companyName || !businessPhone) {
      setAuthError("All fields marked with * are required.");
      return;
    }
    if (password !== confirmPassword) {
      setAuthError("Passwords do not match.");
      return;
    }
    if (password.length < 6) {
      setAuthError("Password must be at least 6 characters long.");
      return;
    }
    setIsSubmitting(true);
    setAuthError(null);

    const [currencyCode, currencySymbol] = currency.split('_');

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const u = userCredential.user;

      // Set Display Name to owner name
      await updateProfile(u, { displayName: ownerName });

      // Create Tenant document
      const tenantRef = doc(db, 'tenants', u.uid);
      const newTenant = {
        id: u.uid,
        email: email,
        name: companyName,
        photoURL: null,
        createdAt: serverTimestamp(),
        isAdmin: email === ADMIN_EMAIL,
        trialExpiresAt: Timestamp.fromDate(addDays(new Date(), 5)),
        isApproved: true, // Pre-approve registration so they can trial immediately
        subscriptionStatus: 'trial',
        phone: businessPhone,
        address: businessAddress,
        industry: businessType
      };
      await setDoc(tenantRef, newTenant);

      // Create Settings document
      const settingsRef = doc(db, 'settings', u.uid);
      const newSettings = {
        tenantId: u.uid,
        name: companyName,
        address: businessAddress,
        phone: businessPhone,
        email: email,
        website: '',
        invoicePrefix: 'INV-',
        nextInvoiceNumber: 1001,
        currencyCode: currencyCode,
        currencySymbol: currencySymbol
      };
      await setDoc(settingsRef, newSettings);

      setIsAuthModalOpen(false);
    } catch (err: any) {
      console.error("Registration error:", err);
      let msg = err?.message || "Failed to create company account. Please try again.";
      if (err?.code === 'auth/email-already-in-use') {
        msg = "This email address is already in use.";
      } else if (err?.code === 'auth/weak-password') {
        msg = "Password is too weak. Please use a stronger password.";
      }
      setAuthError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={() => handleGetStartedClick('login')} className="text-slate-600 hover:text-blue-600 text-sm font-semibold hidden sm:inline-flex">
              Sign In
            </Button>
            <Button onClick={() => handleGetStartedClick('register')} className="bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-200 font-semibold">
              Get Started
            </Button>
          </div>
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
                <Button onClick={() => handleGetStartedClick('register')} className="h-14 px-8 text-lg font-bold bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-100 group">
                  Get Started (Free Trial)
                  <ChevronRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
                <Button variant="outline" onClick={() => handleGetStartedClick('login')} className="h-14 px-8 text-lg font-bold border-slate-200 hover:bg-slate-50">
                  Sign In
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
                    onClick={() => handleGetStartedClick('register')} 
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
              <Button onClick={() => handleGetStartedClick('register')} className="w-full bg-blue-600 hover:bg-blue-700 h-12 font-bold shadow-lg shadow-blue-500/20 group">
                Create Account
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

      {/* Modern Authentication & Business Registration Dialog */}
      <Dialog open={isAuthModalOpen} onOpenChange={(open) => { setIsAuthModalOpen(open); setAuthError(null); }}>
        <DialogContent className="sm:max-w-lg bg-white p-0 overflow-hidden max-h-[90vh] flex flex-col rounded-2xl border-none shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-6 text-white shrink-0">
            <DialogHeader className="text-left">
              <DialogTitle className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                <Printer className="w-6 h-6 text-blue-200" />
                {authTab === 'register' ? 'Register Your Company' : 'Welcome Back'}
              </DialogTitle>
              <DialogDescription className="text-blue-100 mt-1.5 text-sm">
                {authTab === 'register' 
                  ? 'Set up your printing shop in 60 seconds. Start your 5-day free trial.' 
                  : 'Sign in to access your print house command center.'}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="overflow-y-auto p-6 flex-1 space-y-4">
            <Tabs value={authTab} onValueChange={(val: any) => { setAuthTab(val); setAuthError(null); }} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 p-1 rounded-xl">
                <TabsTrigger value="register" className="font-semibold text-sm rounded-lg py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Register Company</TabsTrigger>
                <TabsTrigger value="login" className="font-semibold text-sm rounded-lg py-2 data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm">Existing Sign In</TabsTrigger>
              </TabsList>

              {authError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 text-red-700 text-xs font-semibold animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <TabsContent value="register">
                <form onSubmit={handleRegisterSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Owner Name *</label>
                      <Input 
                        placeholder="John Doe" 
                        value={ownerName} 
                        onChange={(e) => setOwnerName(e.target.value)} 
                        required 
                        className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Company Name *</label>
                      <Input 
                        placeholder="Apex Prints Ltd" 
                        value={companyName} 
                        onChange={(e) => setCompanyName(e.target.value)} 
                        required 
                        className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Business Email *</label>
                      <Input 
                        type="email" 
                        placeholder="owner@company.com" 
                        value={email} 
                        onChange={(e) => setEmail(e.target.value)} 
                        required 
                        className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Phone Number *</label>
                      <Input 
                        placeholder="+233 24 123 4567" 
                        value={businessPhone} 
                        onChange={(e) => setBusinessPhone(e.target.value)} 
                        required 
                        className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Business Address</label>
                    <Input 
                      placeholder="Ring Road Central, Accra, Ghana" 
                      value={businessAddress} 
                      onChange={(e) => setBusinessAddress(e.target.value)} 
                      className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Business Type</label>
                      <Select value={businessType} onValueChange={setBusinessType}>
                        <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-blue-500">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="Digital Printing">Digital Printing</SelectItem>
                          <SelectItem value="Offset Printing">Offset Printing</SelectItem>
                          <SelectItem value="Large Format Printing">Large Format Printing</SelectItem>
                          <SelectItem value="Graphic Design">Graphic Design</SelectItem>
                          <SelectItem value="Other">Other Type</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Operating Currency</label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="bg-slate-50 border-slate-200 focus:ring-blue-500">
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                          <SelectItem value="GHS_GH₵">Ghana Cedis (GH₵)</SelectItem>
                          <SelectItem value="USD_$">US Dollar ($)</SelectItem>
                          <SelectItem value="NGN_₦">Nigerian Naira (₦)</SelectItem>
                          <SelectItem value="GBP_£">British Pound (£)</SelectItem>
                          <SelectItem value="EUR_€">Euro (€)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Password *</label>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        value={password} 
                        onChange={(e) => setPassword(e.target.value)} 
                        required 
                        className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">Confirm Password *</label>
                      <Input 
                        type="password" 
                        placeholder="••••••••" 
                        value={confirmPassword} 
                        onChange={(e) => setConfirmPassword(e.target.value)} 
                        required 
                        className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-sm font-semibold text-white mt-2">
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Creating Account...
                      </div>
                    ) : 'Register & Start Trial'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="login">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">Email Address</label>
                    <Input 
                      type="email" 
                      placeholder="you@example.com" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      required 
                      className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold text-slate-700">Password</label>
                    </div>
                    <Input 
                      type="password" 
                      placeholder="••••••••" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      required 
                      className="bg-slate-50 border-slate-200 focus-visible:ring-blue-500"
                    />
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-700 h-11 text-sm font-semibold text-white mt-2">
                    {isSubmitting ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Signing in...
                      </div>
                    ) : 'Sign In'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-xs font-bold uppercase">Or Use Google</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <Button 
              type="button" 
              variant="outline" 
              onClick={async () => {
                setIsAuthModalOpen(false);
                await onLogin();
              }} 
              className="w-full border-slate-200 hover:bg-slate-50 h-11 text-sm font-semibold flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" stroke="none" />
              </svg>
              Sign In with Google
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);

  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [quickCustomerError, setQuickCustomerError] = useState<string | null>(null);

  // Order Backdating / Date Customization State
  const [orderDateMode, setOrderDateMode] = useState<'current' | 'custom'>('current');
  const [customOrderDate, setCustomOrderDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  // Order Editing State
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editPricingMode, setEditPricingMode] = useState<'standard' | 'area'>('standard');
  const [editSelectedProduct, setEditSelectedProduct] = useState<Product | null>(null);
  const [editWidth, setEditWidth] = useState<string>('0');
  const [editHeight, setEditHeight] = useState<string>('0');
  const [editQuantity, setEditQuantity] = useState<string>('1');
  const [editUnitPrice, setEditUnitPrice] = useState<string>('0');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editCustomerId, setEditCustomerId] = useState<string>('');
  const [editPaidAmount, setEditPaidAmount] = useState<string>('0');
  const [editOrderDateMode, setEditOrderDateMode] = useState<'original' | 'current' | 'custom'>('original');
  const [editCustomOrderDate, setEditCustomOrderDate] = useState<string>('');

  useEffect(() => {
    if (editPricingMode === 'area' && editSelectedProduct) {
      const w = parseFloat(editWidth) || 0;
      const h = parseFloat(editHeight) || 0;
      const calculatedPrice = w * h * editSelectedProduct.pricePerSqFt;
      setEditUnitPrice(calculatedPrice.toFixed(2));
    }
  }, [editPricingMode, editSelectedProduct, editWidth, editHeight]);

  const startEditOrder = (order: Order) => {
    setEditingOrder(order);
    setEditCustomerId(order.customerId);
    const item = order.items[0];
    if (item) {
      setEditDescription(item.description || '');
      setEditQuantity(String(item.quantity || 1));
      setEditUnitPrice(String(item.unitPrice || 0));
      if (item.width !== null && item.width !== undefined && item.height !== null && item.height !== undefined) {
        setEditPricingMode('area');
        setEditWidth(String(item.width));
        setEditHeight(String(item.height));
        if (item.productId) {
          setEditSelectedProduct(products.find(p => p.id === item.productId) || null);
        } else {
          setEditSelectedProduct(null);
        }
      } else {
        setEditPricingMode('standard');
        setEditWidth('0');
        setEditHeight('0');
        setEditSelectedProduct(null);
      }
    } else {
      setEditDescription('');
      setEditQuantity('1');
      setEditUnitPrice('0');
      setEditPricingMode('standard');
      setEditWidth('0');
      setEditHeight('0');
      setEditSelectedProduct(null);
    }
    setEditPaidAmount(String(order.paidAmount || 0));

    // Handle editing date initial states
    const orderDate = order.createdAt instanceof Timestamp ? order.createdAt.toDate() : new Date(order.createdAt);
    setEditCustomOrderDate(format(orderDate, 'yyyy-MM-dd'));
    setEditOrderDateMode('original');
  };

  // Search & Filter State
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderDateFrom, setOrderDateFrom] = useState('');
  const [orderDateTo, setOrderDateTo] = useState('');

  // Filtering Logic
  const filteredOrders = orders.filter(order => {
    // Search term (customer name or invoice number)
    const searchMatch = !orderSearchTerm || 
      order.customerName.toLowerCase().includes(orderSearchTerm.toLowerCase()) ||
      (order.invoiceNumber && order.invoiceNumber.toLowerCase().includes(orderSearchTerm.toLowerCase())) ||
      order.id?.toLowerCase().includes(orderSearchTerm.toLowerCase());

    // Status filter
    const statusMatch = orderStatusFilter === 'all' || order.status === orderStatusFilter;

    // Date range filter
    const createdAt = order.createdAt instanceof Timestamp ? order.createdAt.toDate() : 
                     (order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt));
    
    let dateMatch = true;
    if (orderDateFrom) {
      const fromDate = new Date(orderDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      dateMatch = dateMatch && createdAt >= fromDate;
    }
    if (orderDateTo) {
      const toDate = new Date(orderDateTo);
      toDate.setHours(23, 59, 59, 999);
      dateMatch = dateMatch && createdAt <= toDate;
    }

    return searchMatch && statusMatch && dateMatch;
  });

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
    setCreateError(null);
    const formData = new FormData(e.currentTarget);
    const customerId = formData.get('customerId') as string;
    const customer = customers.find(c => c.id === customerId);
    
    const qty = Number(quantity);
    const uPrice = Number(unitPrice);
    const total = qty * uPrice;

    setIsSubmitting(true);

    // Generate Invoice Number
    const invPrefix = settings?.invoicePrefix || 'INV';
    const invNumber = settings?.nextInvoiceNumber || 1001;
    const invoiceNumberString = `${invPrefix}-${invNumber.toString().padStart(4, '0')}`;

    const dateToUse = orderDateMode === 'custom' && customOrderDate
      ? Timestamp.fromDate(new Date(customOrderDate + 'T12:00:00'))
      : serverTimestamp();

    const newOrder: Omit<Order, 'id'> = {
      tenantId: user.uid,
      invoiceNumber: invoiceNumberString,
      customerId,
      customerName: customer?.name || 'Unknown',
      items: [
        { 
          description: formData.get('description') as string,
          productId: selectedProduct?.id || null,
          quantity: qty, 
          unitPrice: uPrice,
          width: pricingMode === 'area' ? Number(width) : null,
          height: pricingMode === 'area' ? Number(height) : null,
          area: pricingMode === 'area' ? (Number(width) * Number(height)) : null,
          total: total
        }
      ],
      totalAmount: total,
      paidAmount: Number(formData.get('paidAmount')),
      status: 'pending',
      paymentStatus: Number(formData.get('paidAmount')) >= total ? 'paid' : (Number(formData.get('paidAmount')) > 0 ? 'partial' : 'unpaid'),
      createdAt: dateToUse,
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
      setOrderDateMode('current');
      setCustomOrderDate(format(new Date(), 'yyyy-MM-dd'));
    } catch (error: any) {
      console.error("Error creating order:", error);
      const friendlyMsg = error?.message?.includes("permission-denied") || error?.code === "permission-denied"
        ? "Access Denied: You do not have permission to create orders. Please verify your account setup."
        : (error?.message || "An unexpected error occurred while saving the order.");
      setCreateError(friendlyMsg);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'orders');
      } catch (fe) {
        // Suppress unhandled re-throw to prevent page reload
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setQuickCustomerError(null);
    const formData = new FormData(e.currentTarget);
    
    const newCustomer: Omit<Customer, 'id'> = {
      tenantId: user.uid,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'customers'), newCustomer);
      setIsQuickAddCustomerOpen(false);
    } catch (error: any) {
      console.error("Error quick adding customer:", error);
      const friendlyMsg = error?.message?.includes("permission-denied") || error?.code === "permission-denied"
        ? "Access Denied: You do not have permission to add customers. Please verify your account setup."
        : (error?.message || "An unexpected error occurred while saving the customer.");
      setQuickCustomerError(friendlyMsg);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'customers');
      } catch (fe) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const updatePaymentStatus = async (orderId: string, paymentStatus: PaymentStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { paymentStatus, updatedAt: serverTimestamp() });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `orders/${orderId}`);
    }
  };

  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);

  const handleDeleteOrder = (orderId: string) => {
    setDeleteOrderId(orderId);
  };

  const executeDeleteOrder = async () => {
    if (!deleteOrderId) return;
    try {
      await deleteDoc(doc(db, 'orders', deleteOrderId));
      setDeleteOrderId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `orders/${deleteOrderId}`);
    }
  };

  const handleUpdateOrder = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingOrder) return;
    setEditError(null);

    const customer = customers.find(c => c.id === editCustomerId);
    
    const qty = Number(editQuantity);
    const uPrice = Number(editUnitPrice);
    const total = qty * uPrice;
    const paidAmt = Number(editPaidAmount);

    setIsSubmitting(true);

    const updatedOrder: Partial<Order> = {
      customerId: editCustomerId,
      customerName: customer?.name || 'Unknown',
      items: [
        { 
          description: editDescription,
          productId: editSelectedProduct?.id || null,
          quantity: qty, 
          unitPrice: uPrice,
          width: editPricingMode === 'area' ? Number(editWidth) : null,
          height: editPricingMode === 'area' ? Number(editHeight) : null,
          area: editPricingMode === 'area' ? (Number(editWidth) * Number(editHeight)) : null,
          total: total
        }
      ],
      totalAmount: total,
      paidAmount: paidAmt,
      paymentStatus: paidAmt >= total ? 'paid' : (paidAmt > 0 ? 'partial' : 'unpaid'),
      updatedAt: serverTimestamp()
    };

    if (editOrderDateMode === 'custom' && editCustomOrderDate) {
      updatedOrder.createdAt = Timestamp.fromDate(new Date(editCustomOrderDate + 'T12:00:00'));
    } else if (editOrderDateMode === 'current') {
      updatedOrder.createdAt = serverTimestamp();
    }

    try {
      await updateDoc(doc(db, 'orders', editingOrder.id!), updatedOrder);
      setEditingOrder(null);
    } catch (error: any) {
      console.error("Error updating order:", error);
      const friendlyMsg = error?.message?.includes("permission-denied") || error?.code === "permission-denied"
        ? "Access Denied: You do not have permission to update this order."
        : (error?.message || "An unexpected error occurred while updating the order.");
      setEditError(friendlyMsg);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `orders/${editingOrder.id}`);
      } catch (fe) {
        // Suppress unhandled re-throw
      }
    } finally {
      setIsSubmitting(false);
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

  const handleDownloadPDF = async (order: Order) => {
    if (!receiptRef.current) return;
    setIsGeneratingPDF(true);
    const invoiceNum = order.invoiceNumber || `INV-${order.id?.slice(-8).toUpperCase()}`;
    const fileName = `${invoiceNum}.pdf`;
    try {
      await generatePDFHelper(receiptRef.current, fileName, true);
    } catch (err) {
      console.error(err);
      alert("Failed to generate PDF download.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSharePDF = async (order: Order, method: 'whatsapp' | 'email' | 'sms') => {
    if (!receiptRef.current) return;
    setIsGeneratingPDF(true);
    const invoiceNum = order.invoiceNumber || `INV-${order.id?.slice(-8).toUpperCase()}`;
    const fileName = `${invoiceNum}.pdf`;
    
    // Fallback standard text share function
    const textShareFallback = () => {
      if (method === 'whatsapp') {
        handleShareWhatsApp(order);
      } else if (method === 'email') {
        handleShareEmail(order);
      } else if (method === 'sms') {
        handleShareSMS(order);
      }
    };

    try {
      const blob = await generatePDFHelper(receiptRef.current, fileName, false);
      if (blob) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
            text: `Invoice ${invoiceNum} from ${settings?.name || 'PrintPro Manager'}`
          });
        } else {
          if (confirm("Direct PDF file sharing is only supported on mobile browsers. Download the PDF and share the summary via text instead?")) {
            await generatePDFHelper(receiptRef.current, fileName, true); // trigger download
            textShareFallback();
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      alert("Direct PDF sharing failed. Triggering PDF download.");
      await generatePDFHelper(receiptRef.current, fileName, true);
    } finally {
      setIsGeneratingPDF(false);
    }
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="relative flex-1 w-full max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              id="order-search-input"
              placeholder="Search by customer name or invoice #..." 
              value={orderSearchTerm}
              onChange={(e) => setOrderSearchTerm(e.target.value)}
              className="pl-10 bg-slate-50/50 border-slate-200" 
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <Dialog open={isNewOrderOpen} onOpenChange={(open) => { setIsNewOrderOpen(open); if (!open) setCreateError(null); }}>
              <DialogTrigger render={
                <Button className="bg-blue-600 hover:bg-blue-700 h-10 px-6 font-bold shadow-lg shadow-blue-200 flex-1 lg:flex-none">
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
              {createError && (
                <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-700 text-xs font-medium animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <div>{createError}</div>
                </div>
              )}
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
                  <Dialog open={isQuickAddCustomerOpen} onOpenChange={(open) => { setIsQuickAddCustomerOpen(open); if (!open) setQuickCustomerError(null); }}>
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
                        {quickCustomerError && (
                          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-700 text-xs font-medium animate-in fade-in duration-200">
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                            <div>{quickCustomerError}</div>
                          </div>
                        )}
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
                          <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-full font-bold">
                            {isSubmitting ? "Saving..." : "Save Customer"}
                          </Button>
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

                <div className="grid gap-2 border-t border-slate-100 pt-4">
                  <Label className="text-slate-700 font-medium">Order Date</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={orderDateMode === 'current' ? 'default' : 'outline'}
                      className={`flex-1 h-9 text-xs font-bold ${
                        orderDateMode === 'current' 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => setOrderDateMode('current')}
                    >
                      Current Date & Time
                    </Button>
                    <Button
                      type="button"
                      variant={orderDateMode === 'custom' ? 'default' : 'outline'}
                      className={`flex-1 h-9 text-xs font-bold ${
                        orderDateMode === 'custom' 
                          ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                          : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => setOrderDateMode('custom')}
                    >
                      Backdate / Custom
                    </Button>
                  </div>
                  {orderDateMode === 'custom' && (
                    <div className="mt-2 animate-in fade-in-50 duration-200">
                      <Input
                        type="date"
                        value={customOrderDate}
                        onChange={(e) => setCustomOrderDate(e.target.value)}
                        className="h-10 text-slate-900 bg-white"
                        required
                      />
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-full">
                  {isSubmitting ? "Creating Order..." : "Create Order"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="order-status-filter" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Status Filter</Label>
          <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
            <SelectTrigger id="order-status-filter" className="bg-white border-slate-200">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="order-date-from" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date From</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              id="order-date-from"
              type="date" 
              value={orderDateFrom} 
              onChange={(e) => setOrderDateFrom(e.target.value)}
              className="pl-10 bg-white border-slate-200" 
            />
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="order-date-to" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Date To</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input 
              id="order-date-to"
              type="date" 
              value={orderDateTo} 
              onChange={(e) => setOrderDateTo(e.target.value)}
              className="pl-10 bg-white border-slate-200" 
            />
          </div>
        </div>
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
              {filteredOrders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Search className="w-8 h-8 text-slate-300" />
                      <p>No orders found matching your filters.</p>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setOrderSearchTerm('');
                          setOrderStatusFilter('all');
                          setOrderDateFrom('');
                          setOrderDateTo('');
                        }}
                        className="text-blue-600 font-bold"
                      >
                        Reset All Filters
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredOrders.map((order) => (
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
                    <Select 
                      defaultValue={order.paymentStatus} 
                      onValueChange={(v) => updatePaymentStatus(order.id!, v as PaymentStatus)}
                    >
                      <SelectTrigger className="w-[100px] h-8 border-none bg-transparent p-0 focus:ring-0">
                        <Badge variant="secondary" className={cn(
                          "font-medium w-full justify-center capitalize",
                          order.paymentStatus === 'paid' ? "bg-green-100 text-green-700 hover:bg-green-100" : 
                          order.paymentStatus === 'partial' ? "bg-amber-100 text-amber-700 hover:bg-amber-100" : "bg-red-100 text-red-700 hover:bg-red-100"
                        )}>
                          {order.paymentStatus}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid">Paid</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                        <SelectItem value="unpaid">Unpaid</SelectItem>
                      </SelectContent>
                    </Select>
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
                      
                      <Popover>
                        <PopoverTrigger render={
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-slate-400 hover:text-indigo-600"
                            title="Quick Payment Status"
                          >
                            <CreditCard className="w-4 h-4" />
                          </Button>
                        } />
                        <PopoverContent className="w-40 p-1" align="end">
                          <div className="flex flex-col">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="justify-start font-medium text-xs h-8" 
                              onClick={() => updatePaymentStatus(order.id!, 'paid')}
                            >
                              <CheckCircle2 className="mr-2 h-3.5 w-3.5 text-green-600" />
                              Mark as Paid
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="justify-start font-medium text-xs h-8" 
                              onClick={() => updatePaymentStatus(order.id!, 'partial')}
                            >
                              <Clock className="mr-2 h-3.5 w-3.5 text-amber-600" />
                              Mark as Partial
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="justify-start font-medium text-xs h-8" 
                              onClick={() => updatePaymentStatus(order.id!, 'unpaid')}
                            >
                              <AlertCircle className="mr-2 h-3.5 w-3.5 text-red-600" />
                              Mark as Unpaid
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>

                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-blue-600"
                        title="Edit Order"
                        onClick={() => startEditOrder(order)}
                      >
                        <Edit className="w-4 h-4" />
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
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        title="Delete Order"
                        onClick={() => handleDeleteOrder(order.id!)}
                      >
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
                  <div className="flex gap-4">
                    {settings?.logoUrl && (
                      <img src={settings.logoUrl} alt="Logo" className="w-16 h-16 object-contain rounded-lg border border-slate-100 p-1" referrerPolicy="no-referrer" />
                    )}
                    <div>
                      <h1 className="text-3xl font-bold text-slate-900">{settings?.name || 'PrintPro Manager'}</h1>
                      <p className="text-slate-500 text-sm whitespace-pre-line">{settings?.address}</p>
                      <p className="text-slate-500 text-sm">{settings?.phone}</p>
                    </div>
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
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {selectedOrder && (
                <>
                  <Button 
                    variant="outline" 
                    className="text-rose-600 border-rose-200 hover:bg-rose-50" 
                    onClick={() => handleDownloadPDF(selectedOrder)}
                    disabled={isGeneratingPDF}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    {isGeneratingPDF ? "Generating..." : "Download PDF"}
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-emerald-600 border-emerald-200 hover:bg-emerald-50" 
                    onClick={() => handleSharePDF(selectedOrder, 'whatsapp')}
                    disabled={isGeneratingPDF}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    WhatsApp PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-blue-600 border-blue-200 hover:bg-blue-50" 
                    onClick={() => handleSharePDF(selectedOrder, 'email')}
                    disabled={isGeneratingPDF}
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Email PDF
                  </Button>
                  <Button 
                    variant="outline" 
                    className="text-purple-600 border-purple-200 hover:bg-purple-50" 
                    onClick={() => handleSharePDF(selectedOrder, 'sms')}
                    disabled={isGeneratingPDF}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    SMS PDF
                  </Button>
                </>
              )}
            </div>
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" onClick={() => setIsReceiptOpen(false)}>Close</Button>
              <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => handlePrint()}>
                <Printer className="w-4 h-4 mr-2" />
                Print Invoice
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Order Dialog */}
      <Dialog open={editingOrder !== null} onOpenChange={(open) => { if (!open) { setEditingOrder(null); setEditError(null); } }}>
        <DialogContent className="sm:max-w-lg bg-white">
          <form onSubmit={handleUpdateOrder}>
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-bold text-lg">Edit Order {editingOrder?.invoiceNumber || `#${editingOrder?.id?.slice(-6).toUpperCase()}`}</DialogTitle>
              <DialogDescription className="text-slate-500 text-sm">Update the details for this printing job.</DialogDescription>
            </DialogHeader>
            {editError && (
              <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-700 text-xs font-medium animate-in fade-in duration-200">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                <div>{editError}</div>
              </div>
            )}
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="editCustomerId">Customer</Label>
                <Select value={editCustomerId} onValueChange={setEditCustomerId} required>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Pricing Mode</Label>
                  <Select value={editPricingMode} onValueChange={(v: any) => setEditPricingMode(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="area">Area-Based (Sq Ft)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editPricingMode === 'area' && (
                  <div className="grid gap-2">
                    <Label>Product / Material</Label>
                    <Select 
                      value={editSelectedProduct?.id || ""} 
                      onValueChange={(v) => setEditSelectedProduct(products.find(p => p.id === v) || null)}
                    >
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
                <Label htmlFor="editDescription">Job Description</Label>
                <Input 
                  id="editDescription" 
                  value={editDescription} 
                  onChange={(e) => setEditDescription(e.target.value)} 
                  placeholder="e.g. 500 Business Cards" 
                  required 
                />
              </div>

              {editPricingMode === 'area' ? (
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="editWidth">Width (ft)</Label>
                    <Input 
                      id="editWidth" 
                      type="number" 
                      step="0.1" 
                      value={editWidth} 
                      onChange={(e) => setEditWidth(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="editHeight">Height (ft)</Label>
                    <Input 
                      id="editHeight" 
                      type="number" 
                      step="0.1" 
                      value={editHeight} 
                      onChange={(e) => setEditHeight(e.target.value)} 
                      required 
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Area (sq ft)</Label>
                    <div className="h-10 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-md text-sm font-medium">
                      {(parseFloat(editWidth) * parseFloat(editHeight) || 0).toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="editQuantity">Quantity</Label>
                  <Input 
                    id="editQuantity" 
                    type="number" 
                    min="1" 
                    value={editQuantity} 
                    onChange={(e) => setEditQuantity(e.target.value)} 
                    required 
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="editUnitPrice">{editPricingMode === 'area' ? `Price per Piece (${settings?.currencySymbol || 'GH₵'})` : `Unit Price (${settings?.currencySymbol || 'GH₵'})`}</Label>
                  <Input 
                    id="editUnitPrice" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={editUnitPrice} 
                    onChange={(e) => setEditUnitPrice(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50 rounded-lg flex items-center justify-between">
                <span className="text-sm font-medium text-blue-700">Total Amount:</span>
                <span className="text-lg font-bold text-blue-900">
                  {settings?.currencySymbol || 'GH₵'}
                  {(Number(editQuantity) * Number(editUnitPrice)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </span>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="editPaidAmount">Paid Amount ({settings?.currencySymbol || 'GH₵'})</Label>
                <Input 
                  id="editPaidAmount" 
                  type="number" 
                  step="0.01" 
                  min="0" 
                  value={editPaidAmount} 
                  onChange={(e) => setEditPaidAmount(e.target.value)} 
                  required 
                />
              </div>

              <div className="grid gap-2 border-t border-slate-100 pt-4">
                <Label className="text-slate-700 font-medium">Order Date</Label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={editOrderDateMode === 'original' ? 'default' : 'outline'}
                    className={`flex-1 h-9 text-xs font-bold ${
                      editOrderDateMode === 'original' 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setEditOrderDateMode('original')}
                  >
                    Keep Original
                  </Button>
                  <Button
                    type="button"
                    variant={editOrderDateMode === 'current' ? 'default' : 'outline'}
                    className={`flex-1 h-9 text-xs font-bold ${
                      editOrderDateMode === 'current' 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setEditOrderDateMode('current')}
                  >
                    Current Date/Time
                  </Button>
                  <Button
                    type="button"
                    variant={editOrderDateMode === 'custom' ? 'default' : 'outline'}
                    className={`flex-1 h-9 text-xs font-bold ${
                      editOrderDateMode === 'custom' 
                        ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                        : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                    onClick={() => setEditOrderDateMode('custom')}
                  >
                    Set Custom Date
                  </Button>
                </div>
                {editOrderDateMode === 'custom' && (
                  <div className="mt-2 animate-in fade-in-50 duration-200">
                    <Input
                      type="date"
                      value={editCustomOrderDate}
                      onChange={(e) => setEditCustomOrderDate(e.target.value)}
                      className="h-10 text-slate-900 bg-white"
                      required
                    />
                  </div>
                )}
              </div>
            </div>
            <DialogFooter className="border-t border-slate-100 pt-4 mt-2">
              <Button type="button" variant="outline" onClick={() => setEditingOrder(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">
                {isSubmitting ? "Updating..." : "Update Order"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOrderId !== null} onOpenChange={(open) => { if (!open) setDeleteOrderId(null); }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2 font-bold text-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-slate-500 pt-2 text-sm leading-relaxed">
              Are you sure you want to delete this order? This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-4">
            <Button variant="outline" onClick={() => setDeleteOrderId(null)} className="font-semibold">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDeleteOrder} className="font-semibold bg-red-600 hover:bg-red-700 text-white">
              Delete Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProductsView({ products, settings, user }: { products: Product[], settings: BusinessSettings | null, user: User }) {
  const [isNewProductOpen, setIsNewProductOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);

  const handleAddProduct = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
    const formData = new FormData(e.currentTarget);
    
    const newProduct: Omit<Product, 'id'> = {
      tenantId: user.uid,
      name: formData.get('name') as string,
      pricePerSqFt: Number(formData.get('pricePerSqFt')),
      category: formData.get('category') as string,
    };

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'products'), newProduct);
      setIsNewProductOpen(false);
    } catch (error: any) {
      console.error("Error creating product:", error);
      const friendlyMsg = error?.message?.includes("permission-denied") || error?.code === "permission-denied"
        ? "Access Denied: You do not have permission to add products. Please verify your account setup."
        : (error?.message || "An unexpected error occurred while saving the product.");
      setCreateError(friendlyMsg);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'products');
      } catch (fe) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = (id: string) => {
    setDeleteProductId(id);
  };

  const executeDeleteProduct = async () => {
    if (!deleteProductId) return;
    try {
      await deleteDoc(doc(db, 'products', deleteProductId));
      setDeleteProductId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `products/${deleteProductId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Products & Services</h3>
        <Dialog open={isNewProductOpen} onOpenChange={(open) => { setIsNewProductOpen(open); if (!open) setCreateError(null); }}>
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
              {createError && (
                <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-700 text-xs font-medium animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <div>{createError}</div>
                </div>
              )}
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
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-full">
                  {isSubmitting ? "Saving..." : "Save Product"}
                </Button>
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

      <Dialog open={deleteProductId !== null} onOpenChange={(open) => { if (!open) setDeleteProductId(null); }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2 font-bold text-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-slate-500 pt-2 text-sm leading-relaxed">
              Are you sure you want to delete this product? This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-4">
            <Button variant="outline" onClick={() => setDeleteProductId(null)} className="font-semibold">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDeleteProduct} className="font-semibold bg-red-600 hover:bg-red-700 text-white">
              Delete Product
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ExpensesView({ expenses, settings, user }: { expenses: Expense[], settings: BusinessSettings | null, user: User }) {
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteExpenseId, setDeleteExpenseId] = useState<string | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);

  const handleAddExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
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
      setIsSubmitting(true);
      await addDoc(collection(db, 'expenses'), newExpense);
      setIsNewExpenseOpen(false);
    } catch (error: any) {
      console.error("Error creating expense:", error);
      const friendlyMsg = error?.message?.includes("permission-denied") || error?.code === "permission-denied"
        ? "Access Denied: You do not have permission to add expenses. Please verify your account setup."
        : (error?.message || "An unexpected error occurred while saving the expense.");
      setCreateError(friendlyMsg);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'expenses');
      } catch (fe) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = (expenseId: string) => {
    setDeleteExpenseId(expenseId);
  };

  const executeDeleteExpense = async () => {
    if (!deleteExpenseId) return;
    try {
      await deleteDoc(doc(db, 'expenses', deleteExpenseId));
      setDeleteExpenseId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `expenses/${deleteExpenseId}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-slate-900">Business Expenses</h3>
        <Dialog open={isNewExpenseOpen} onOpenChange={(open) => { setIsNewExpenseOpen(open); if (!open) setCreateError(null); }}>
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
              {createError && (
                <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-700 text-xs font-medium animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <div>{createError}</div>
                </div>
              )}
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
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-full">
                  {isSubmitting ? "Recording..." : "Record Expense"}
                </Button>
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
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-red-600"
                      title="Delete Expense"
                      onClick={() => handleDeleteExpense(expense.id!)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={deleteExpenseId !== null} onOpenChange={(open) => { if (!open) setDeleteExpenseId(null); }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2 font-bold text-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-slate-500 pt-2 text-sm leading-relaxed">
              Are you sure you want to delete this expense? This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-4">
            <Button variant="outline" onClick={() => setDeleteExpenseId(null)} className="font-semibold">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDeleteExpense} className="font-semibold bg-red-600 hover:bg-red-700 text-white">
              Delete Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CustomersView({ customers, settings, user }: { customers: Customer[], settings: BusinessSettings | null, user: User }) {
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [isBroadcastOpen, setIsBroadcastOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteCustomerId, setDeleteCustomerId] = useState<string | null>(null);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [createError, setCreateError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);

  const handleUpdateCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setEditError(null);
    const formData = new FormData(e.currentTarget);
    const updatedCustomer: Partial<Customer> = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      setIsSubmitting(true);
      await updateDoc(doc(db, 'customers', editingCustomer.id!), updatedCustomer);
      setEditingCustomer(null);
    } catch (error: any) {
      console.error("Error updating customer:", error);
      const friendlyMsg = error?.message?.includes("permission-denied") || error?.code === "permission-denied"
        ? "Access Denied: You do not have permission to update customer details."
        : (error?.message || "An unexpected error occurred while updating the customer.");
      setEditError(friendlyMsg);
      try {
        handleFirestoreError(error, OperationType.UPDATE, `customers/${editingCustomer.id}`);
      } catch (fe) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCustomer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setCreateError(null);
    const formData = new FormData(e.currentTarget);
    
    const newCustomer: Omit<Customer, 'id'> = {
      tenantId: user.uid,
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
    };

    try {
      setIsSubmitting(true);
      await addDoc(collection(db, 'customers'), newCustomer);
      setIsNewCustomerOpen(false);
    } catch (error: any) {
      console.error("Error creating customer:", error);
      const friendlyMsg = error?.message?.includes("permission-denied") || error?.code === "permission-denied"
        ? "Access Denied: You do not have permission to add customers. Please verify your account setup."
        : (error?.message || "An unexpected error occurred while saving the customer.");
      setCreateError(friendlyMsg);
      try {
        handleFirestoreError(error, OperationType.CREATE, 'customers');
      } catch (fe) {}
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCustomer = (id: string) => {
    setDeleteCustomerId(id);
  };

  const executeDeleteCustomer = async () => {
    if (!deleteCustomerId) return;
    try {
      await deleteDoc(doc(db, 'customers', deleteCustomerId));
      setDeleteCustomerId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `customers/${deleteCustomerId}`);
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

          <Dialog open={isNewCustomerOpen} onOpenChange={(open) => { setIsNewCustomerOpen(open); if (!open) setCreateError(null); }}>
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
                {createError && (
                  <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-700 text-xs font-medium animate-in fade-in duration-200">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                    <div>{createError}</div>
                  </div>
                )}
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
                  <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 w-full font-bold">
                    {isSubmitting ? "Saving..." : "Save Customer"}
                  </Button>
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
                <div className="flex gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-400 hover:text-blue-600"
                    title="Edit Customer"
                    onClick={() => setEditingCustomer(customer)}
                  >
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-400 hover:text-red-600"
                    title="Delete Customer"
                    onClick={() => handleDeleteCustomer(customer.id!)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
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

      <Dialog open={editingCustomer !== null} onOpenChange={(open) => { if (!open) { setEditingCustomer(null); setEditError(null); } }}>
        <DialogContent>
          {editingCustomer && (
            <form onSubmit={handleUpdateCustomer}>
              <DialogHeader>
                <DialogTitle>Edit Customer Details</DialogTitle>
                <DialogDescription>Modify contact or address details for this customer.</DialogDescription>
              </DialogHeader>
              {editError && (
                <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-100 flex items-start gap-2 text-red-700 text-xs font-medium animate-in fade-in duration-200">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-500" />
                  <div>{editError}</div>
                </div>
              )}
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">Full Name</Label>
                  <Input id="edit-name" name="name" defaultValue={editingCustomer.name} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">Email</Label>
                  <Input id="edit-email" name="email" type="email" defaultValue={editingCustomer.email || ''} placeholder="john@example.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-phone">Phone Number</Label>
                  <Input id="edit-phone" name="phone" defaultValue={editingCustomer.phone || ''} placeholder="+1 (555) 000-0000" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-address">Address</Label>
                  <Input id="edit-address" name="address" defaultValue={editingCustomer.address || ''} placeholder="123 Printing St." />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditingCustomer(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700 font-bold">
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteCustomerId !== null} onOpenChange={(open) => { if (!open) setDeleteCustomerId(null); }}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-slate-900 flex items-center gap-2 font-bold text-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Confirm Deletion
            </DialogTitle>
            <DialogDescription className="text-slate-500 pt-2 text-sm leading-relaxed">
              Are you sure you want to delete this customer? This action is permanent and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 justify-end pt-4 border-t border-slate-100 mt-4">
            <Button variant="outline" onClick={() => setDeleteCustomerId(null)} className="font-semibold">
              Cancel
            </Button>
            <Button variant="destructive" onClick={executeDeleteCustomer} className="font-semibold bg-red-600 hover:bg-red-700 text-white">
              Delete Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SettingsView({ 
  settings, 
  user, 
  googleAccessToken, 
  isSyncing, 
  handleConnectGoogleSheets, 
  syncToGoogleSheets 
}: { 
  settings: BusinessSettings | null, 
  user: User,
  googleAccessToken: string | null,
  isSyncing: boolean,
  handleConnectGoogleSheets: () => Promise<string | null>,
  syncToGoogleSheets: (token?: string) => Promise<void>
}) {
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
      logoUrl: formData.get('logoUrl') as string,
    };

    try {
      await setDoc(doc(db, 'settings', user.uid), { ...newSettings }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `settings/${user.uid}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
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
              <div className="grid gap-2">
                <Label htmlFor="logoUrl">Business Logo URL</Label>
                <Input id="logoUrl" name="logoUrl" defaultValue={settings?.logoUrl} placeholder="https://example.com/logo.png" />
                <p className="text-[10px] text-slate-400 font-medium">Link to your business logo image (square or horizontal recommended).</p>
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

      <Card className="shadow-sm border-slate-200 overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-50 to-blue-50/50 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500 rounded-lg text-white">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-slate-900">Google Sheets Integration</CardTitle>
              <CardDescription className="text-xs">
                Sync and back up your print shop data directly to Google Drive and Google Sheets.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-4">
          <p className="text-xs text-slate-500 leading-relaxed">
            Connecting Google Sheets lets you create and back up all your Orders, Expenses, Customers, and Products to a spreadsheet in your personal Google Drive. Keep your data locally accessible without any complex hosting.
          </p>

          {!googleAccessToken ? (
            <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h5 className="text-xs font-semibold text-slate-800">No active connection</h5>
                <p className="text-[10px] text-slate-400">Connect your Google account with Sheets and Drive permissions to start syncing.</p>
              </div>
              <Button 
                onClick={handleConnectGoogleSheets} 
                className="bg-emerald-600 hover:bg-emerald-700 text-white w-full sm:w-auto text-xs"
              >
                Connect Google Drive & Sheets
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-bounce" />
                  <div>
                    <h5 className="text-xs font-semibold text-emerald-800">Successfully Connected</h5>
                    <p className="text-[10px] text-emerald-600/80 font-medium font-mono">Token authorized for sessions</p>
                  </div>
                </div>
                <Button 
                  onClick={() => syncToGoogleSheets()} 
                  disabled={isSyncing} 
                  variant="outline"
                  className="bg-white border-emerald-200 hover:bg-emerald-50 text-emerald-700 font-medium text-xs py-1 px-3"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1.5" />
                      Syncing...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Sync All Now
                    </>
                  )}
                </Button>
              </div>

              {settings?.googleSheetId ? (
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                        Backup Spreadsheet Linked
                      </div>
                      <p className="text-[10px] text-slate-500">
                        Spreadsheet ID: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[9px]">{settings.googleSheetId.substring(0, 16)}...</code>
                      </p>
                    </div>
                    <a 
                      href={settings.googleSheetUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-xs font-medium text-blue-600 hover:underline hover:text-blue-700"
                    >
                      Open Google Sheet
                      <ExternalLink className="w-3 h-3 ml-1" />
                    </a>
                  </div>

                  <div className="pt-2.5 border-t border-slate-200/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                    <div>
                      Last synced: <span className="font-semibold text-slate-700">{settings.googleSheetsLastSyncedAt || "Never"}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        id="autoSync" 
                        checked={settings?.googleSheetsAutoSync || false}
                        onChange={async (e) => {
                          const autoSync = e.target.checked;
                          try {
                            await setDoc(doc(db, 'settings', user.uid), {
                              googleSheetsAutoSync: autoSync
                            }, { merge: true });
                          } catch (err) {
                            console.error(err);
                          }
                        }}
                        className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" 
                      />
                      <label htmlFor="autoSync" className="font-medium cursor-pointer text-slate-600 select-none">
                        Auto-sync on any changes
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-xl flex flex-col items-center justify-center gap-2.5 text-center">
                  <p className="text-xs text-blue-800 font-semibold">No backing spreadsheet created yet</p>
                  <Button 
                    onClick={() => syncToGoogleSheets()} 
                    disabled={isSyncing} 
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-4"
                  >
                    {isSyncing ? "Creating Spreadsheet..." : "Create Spreadsheet Backup"}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ==========================================
// MONTHLY ACCOUNTS & REPORT VIEW
// ==========================================

function MonthlyReportView({ 
  orders, 
  expenses, 
  settings, 
  user 
}: { 
  orders: Order[], 
  expenses: Expense[], 
  settings: BusinessSettings | null, 
  user: User 
}) {
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [reportMode, setReportMode] = useState<'monthly' | 'custom'>('monthly');
  const [customStartDate, setCustomStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [reportFilter, setReportFilter] = useState<'all' | 'activities' | 'income' | 'expenses'>('all');
  
  const reportRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: reportRef,
  });

  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const periodTitle = reportMode === 'monthly'
    ? `${MONTHS[selectedMonth]} ${selectedYear}`
    : `${format(new Date(customStartDate), 'PP')} - ${format(new Date(customEndDate), 'PP')}`;

  const generateReportSummaryText = () => {
    let msg = `Accounts Statement for ${periodTitle}\n`;
    msg += `Business: ${settings?.name || 'PrintPro'}\n\n`;
    msg += `📊 SUMMARY:\n`;
    msg += `- Gross Invoiced: ${settings?.currencySymbol || 'GH₵'}${totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    msg += `- Realized Cash: ${settings?.currencySymbol || 'GH₵'}${totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    msg += `- Receivables: ${settings?.currencySymbol || 'GH₵'}${totalOutstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    msg += `- Expenditures: ${settings?.currencySymbol || 'GH₵'}${totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}\n`;
    msg += `- Net Margin: ${settings?.currencySymbol || 'GH₵'}${cashNetProfit.toLocaleString(undefined, {minimumFractionDigits: 2})}\n\n`;
    msg += `Generated with PrintPro Manager.`;
    return msg;
  };

  const handleDownloadReportPDF = async () => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    const periodName = reportMode === 'monthly'
      ? `${MONTHS[selectedMonth]}_${selectedYear}`
      : `${customStartDate}_to_${customEndDate}`;
    const fileName = `Accounts_Report_${periodName}.pdf`;
    try {
      await generatePDFHelper(reportRef.current, fileName, true);
    } catch (err) {
      console.error(err);
      alert("Failed to download PDF.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleShareReportPDF = async (method: 'whatsapp' | 'email' | 'sms') => {
    if (!reportRef.current) return;
    setIsGeneratingPDF(true);
    const periodName = reportMode === 'monthly'
      ? `${MONTHS[selectedMonth]}_${selectedYear}`
      : `${customStartDate}_to_${customEndDate}`;
    const fileName = `Accounts_Report_${periodName}.pdf`;
    
    const textShareFallback = () => {
      const text = encodeURIComponent(generateReportSummaryText());
      if (method === 'whatsapp') {
        window.open(`https://wa.me/?text=${text}`, '_blank');
      } else if (method === 'email') {
        const subject = encodeURIComponent(`Accounts Statement: ${periodTitle}`);
        window.location.href = `mailto:?subject=${subject}&body=${text}`;
      } else if (method === 'sms') {
        window.location.href = `sms:?body=${text}`;
      }
    };

    try {
      const blob = await generatePDFHelper(reportRef.current, fileName, false);
      if (blob) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: fileName,
            text: `Accounts Report for ${periodTitle}`
          });
        } else {
          if (confirm("Direct PDF file sharing is only supported on mobile devices. We will download the PDF for you, and you can share the summary text instead?")) {
            await generatePDFHelper(reportRef.current, fileName, true); // trigger download
            textShareFallback();
          }
        }
      }
    } catch (err) {
      console.error(err);
      alert("Sharing PDF failed. Triggering manual download instead.");
      await generatePDFHelper(reportRef.current, fileName, true);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const YEARS = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i);

  // Parse safety helpers
  const getOrderDate = (o: Order) => {
    if (!o.createdAt) return new Date(2000, 0, 1);
    return o.createdAt instanceof Timestamp ? o.createdAt.toDate() : new Date(o.createdAt);
  };

  const getExpenseDate = (e: Expense) => {
    if (!e.date) return new Date(2000, 0, 1);
    return e.date instanceof Timestamp ? e.date.toDate() : new Date(e.date);
  };

  // Filter checks
  const isWithinCustomRange = (date: Date) => {
    if (reportMode === 'monthly') {
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    } else {
      const dateStr = format(date, 'yyyy-MM-dd');
      return dateStr >= customStartDate && dateStr <= customEndDate;
    }
  };

  // Filter lists
  const monthlyOrders = orders.filter(o => isWithinCustomRange(getOrderDate(o)));
  const activeOrders = monthlyOrders.filter(o => o.status !== 'cancelled');
  const cancelledOrders = monthlyOrders.filter(o => o.status === 'cancelled');

  const monthlyExpenses = expenses.filter(e => isWithinCustomRange(getExpenseDate(e)));

  // Computations
  const totalInvoiced = activeOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalCollected = activeOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0);
  const totalOutstanding = activeOrders.reduce((sum, o) => sum + ((o.totalAmount || 0) - (o.paidAmount || 0)), 0);
  const totalExpenses = monthlyExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  // Profit/Loss
  const accrualNetProfit = totalInvoiced - totalExpenses;
  const cashNetProfit = totalCollected - totalExpenses;

  // Breakdown aggregations
  const expensesByCategory = monthlyExpenses.reduce((acc, e) => {
    const cat = e.category?.toLowerCase() || 'other';
    acc[cat] = (acc[cat] || 0) + (e.amount || 0);
    return acc;
  }, {} as Record<string, number>);

  const ordersByStatus = monthlyOrders.reduce((acc, o) => {
    const st = o.status || 'pending';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Combined activities list (Income & Expenses)
  const combinedActivities = [
    ...activeOrders.map(o => ({
      id: o.id,
      date: getOrderDate(o),
      type: 'income',
      ref: o.invoiceNumber || `#${o.id?.slice(-6).toUpperCase()}`,
      party: o.customerName,
      description: o.items?.map(i => i.description).join(', ') || 'Custom Job',
      status: o.status,
      paymentStatus: o.paymentStatus,
      incomeAmount: o.totalAmount || 0,
      expenseAmount: 0,
      cashReceived: o.paidAmount || 0,
    })),
    ...monthlyExpenses.map(e => ({
      id: e.id,
      date: getExpenseDate(e),
      type: 'expense',
      ref: `EXP-${e.id?.slice(-4).toUpperCase() || 'LOG'}`,
      party: 'General Operating',
      description: e.description || 'Operational Expense',
      status: 'completed',
      paymentStatus: 'paid',
      incomeAmount: 0,
      expenseAmount: e.amount || 0,
      cashReceived: 0,
    }))
  ].sort((a, b) => a.date.getTime() - b.date.getTime()); // chronological (oldest to newest)

  // Render variables
  const currencySymbol = settings?.currencySymbol || 'GH₵';
  const businessName = settings?.name || 'My Print Shop';
  const logoUrl = settings?.logoUrl || '';

  // Daily Chart Data
  const getDailyChartData = () => {
    if (reportMode === 'monthly') {
      const daysInMonthCount = new Date(selectedYear, selectedMonth + 1, 0).getDate();
      return Array.from({ length: daysInMonthCount }, (_, idx) => {
        const day = idx + 1;
        const dayOrders = activeOrders.filter(o => getOrderDate(o).getDate() === day);
        const dayExpenses = monthlyExpenses.filter(e => getExpenseDate(e).getDate() === day);

        return {
          label: day.toString(),
          Invoiced: dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
          Collected: dayOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
          Expenses: dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
        };
      });
    } else {
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

      if (diffDays <= 45) {
        const data = [];
        for (let i = 0; i < diffDays; i++) {
          const currentDate = addDays(start, i);
          const dateStr = format(currentDate, 'yyyy-MM-dd');
          const dayOrders = activeOrders.filter(o => format(getOrderDate(o), 'yyyy-MM-dd') === dateStr);
          const dayExpenses = monthlyExpenses.filter(e => format(getExpenseDate(e), 'yyyy-MM-dd') === dateStr);

          data.push({
            label: format(currentDate, 'MMM d'),
            Invoiced: dayOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0),
            Collected: dayOrders.reduce((sum, o) => sum + (o.paidAmount || 0), 0),
            Expenses: dayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0),
          });
        }
        return data;
      } else {
        const dataMap: Record<string, { label: string; Invoiced: number; Collected: number; Expenses: number }> = {};
        
        activeOrders.forEach(o => {
          const d = getOrderDate(o);
          const monthStr = format(d, 'MMM yyyy');
          if (!dataMap[monthStr]) {
            dataMap[monthStr] = { label: monthStr, Invoiced: 0, Collected: 0, Expenses: 0 };
          }
          dataMap[monthStr].Invoiced += (o.totalAmount || 0);
          dataMap[monthStr].Collected += (o.paidAmount || 0);
        });

        monthlyExpenses.forEach(e => {
          const d = getExpenseDate(e);
          const monthStr = format(d, 'MMM yyyy');
          if (!dataMap[monthStr]) {
            dataMap[monthStr] = { label: monthStr, Invoiced: 0, Collected: 0, Expenses: 0 };
          }
          dataMap[monthStr].Expenses += (e.amount || 0);
        });

        return Object.values(dataMap).sort((a, b) => {
          const dateA = new Date(a.label);
          const dateB = new Date(b.label);
          return dateA.getTime() - dateB.getTime();
        });
      }
    }
  };

  const dailyChartData = getDailyChartData();

  // Month navigation helpers
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleApplyPreset = (preset: 'last7' | 'last30' | 'thisYear') => {
    const today = new Date();
    if (preset === 'last7') {
      setCustomStartDate(format(addDays(today, -6), 'yyyy-MM-dd'));
      setCustomEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'last30') {
      setCustomStartDate(format(addDays(today, -29), 'yyyy-MM-dd'));
      setCustomEndDate(format(today, 'yyyy-MM-dd'));
    } else if (preset === 'thisYear') {
      setCustomStartDate(format(new Date(today.getFullYear(), 0, 1), 'yyyy-MM-dd'));
      setCustomEndDate(format(new Date(today.getFullYear(), 11, 31), 'yyyy-MM-dd'));
    }
  };

  const getStatusBadge = (status: string) => {
    const base = "px-2.5 py-1 text-xs font-bold rounded-lg border uppercase tracking-wider";
    switch (status.toLowerCase()) {
      case 'completed': 
        return <span className={cn(base, "bg-green-50 text-green-700 border-green-200")}>Completed</span>;
      case 'delivered': 
        return <span className={cn(base, "bg-blue-50 text-blue-700 border-blue-200")}>Delivered</span>;
      case 'processing': 
        return <span className={cn(base, "bg-amber-50 text-amber-700 border-amber-200")}>Processing</span>;
      case 'pending': 
        return <span className={cn(base, "bg-slate-100 text-slate-700 border-slate-200")}>Pending</span>;
      case 'cancelled': 
        return <span className={cn(base, "bg-rose-50 text-rose-700 border-rose-200")}>Cancelled</span>;
      default: 
        return <span className={cn(base, "bg-slate-50 text-slate-600 border-slate-100")}>{status}</span>;
    }
  };

  const getPaymentBadge = (status: string) => {
    const base = "px-2.5 py-1 text-xs font-bold rounded-lg border uppercase tracking-wider";
    switch (status.toLowerCase()) {
      case 'paid': 
        return <span className={cn(base, "bg-emerald-50 text-emerald-700 border-emerald-200")}>Paid</span>;
      case 'partial': 
        return <span className={cn(base, "bg-orange-50 text-orange-700 border-orange-200")}>Partial</span>;
      case 'unpaid': 
        return <span className={cn(base, "bg-rose-50 text-rose-700 border-rose-200")}>Unpaid</span>;
      default: 
        return <span className={cn(base, "bg-slate-50 text-slate-600 border-slate-100")}>{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Interactive Month Selection Controls (Hidden on Print) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-4 lg:p-6 rounded-2xl shadow-sm border border-slate-200 print:hidden animate-in fade-in duration-300">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* View mode toggle */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit shadow-inner">
            <button
              type="button"
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                reportMode === 'monthly'
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
              onClick={() => setReportMode('monthly')}
            >
              Monthly View
            </button>
            <button
              type="button"
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-all",
                reportMode === 'custom'
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              )}
              onClick={() => setReportMode('custom')}
            >
              Custom Range
            </button>
          </div>

          {reportMode === 'monthly' ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200" onClick={handlePrevMonth}>
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <div className="flex gap-2">
                <Select value={selectedMonth.toString()} onValueChange={(val) => setSelectedMonth(Number(val))}>
                  <SelectTrigger className="w-[140px] font-medium bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((name, idx) => (
                      <SelectItem key={idx} value={idx.toString()}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedYear.toString()} onValueChange={(val) => setSelectedYear(Number(val))}>
                  <SelectTrigger className="w-[110px] font-medium bg-white border-slate-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {YEARS.map((year) => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" className="h-10 w-10 border-slate-200" onClick={handleNextMonth}>
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-end gap-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">Start Date</span>
                  <Input 
                    type="date" 
                    value={customStartDate} 
                    onChange={(e) => setCustomStartDate(e.target.value)} 
                    className="h-10 text-sm bg-white border-slate-200 focus:ring-blue-500 focus:border-blue-500 w-[145px]" 
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-400 font-bold uppercase mb-0.5">End Date</span>
                  <Input 
                    type="date" 
                    value={customEndDate} 
                    onChange={(e) => setCustomEndDate(e.target.value)} 
                    className="h-10 text-sm bg-white border-slate-200 focus:ring-blue-500 focus:border-blue-500 w-[145px]" 
                  />
                </div>
              </div>
              {/* Presets */}
              <div className="flex items-center gap-1.5 h-10">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleApplyPreset('last7')} 
                  className="h-8 text-[11px] font-bold border-slate-200 hover:bg-slate-50 px-2.5 rounded-lg text-slate-600"
                >
                  7 Days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleApplyPreset('last30')} 
                  className="h-8 text-[11px] font-bold border-slate-200 hover:bg-slate-50 px-2.5 rounded-lg text-slate-600"
                >
                  30 Days
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleApplyPreset('thisYear')} 
                  className="h-8 text-[11px] font-bold border-slate-200 hover:bg-slate-50 px-2.5 rounded-lg text-slate-600"
                >
                  This Year
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button 
            onClick={() => handlePrint()} 
            disabled={monthlyOrders.length === 0 && monthlyExpenses.length === 0}
            variant="outline"
            className="border-slate-200"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print Report
          </Button>
          <Button 
            onClick={handleDownloadReportPDF} 
            disabled={(monthlyOrders.length === 0 && monthlyExpenses.length === 0) || isGeneratingPDF}
            className="bg-rose-600 hover:bg-rose-700 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            {isGeneratingPDF ? "Generating..." : "Download PDF"}
          </Button>
          <Button 
            onClick={() => handleShareReportPDF('whatsapp')} 
            disabled={(monthlyOrders.length === 0 && monthlyExpenses.length === 0) || isGeneratingPDF}
            variant="outline"
            className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
          >
            <Share2 className="w-4 h-4 mr-2" />
            WhatsApp PDF
          </Button>
          <Button 
            onClick={() => handleShareReportPDF('email')} 
            disabled={(monthlyOrders.length === 0 && monthlyExpenses.length === 0) || isGeneratingPDF}
            variant="outline"
            className="text-blue-600 border-blue-200 hover:bg-blue-50"
          >
            <Mail className="w-4 h-4 mr-2" />
            Email PDF
          </Button>
          <Button 
            onClick={() => handleShareReportPDF('sms')} 
            disabled={(monthlyOrders.length === 0 && monthlyExpenses.length === 0) || isGeneratingPDF}
            variant="outline"
            className="text-purple-600 border-purple-200 hover:bg-purple-50"
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            SMS PDF
          </Button>
        </div>
      </div>

      {/* Report Filter Tabs (Hidden on Print) */}
      {!(monthlyOrders.length === 0 && monthlyExpenses.length === 0) && (
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl max-w-2xl print:hidden shadow-inner">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "flex-1 rounded-lg text-xs font-bold transition-all h-8 whitespace-nowrap",
              reportFilter === 'all' 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
            onClick={() => setReportFilter('all')}
          >
            Full Report
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "flex-1 rounded-lg text-xs font-bold transition-all h-8 whitespace-nowrap",
              reportFilter === 'activities' 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
            onClick={() => setReportFilter('activities')}
          >
            All Activities Timeline
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "flex-1 rounded-lg text-xs font-bold transition-all h-8 whitespace-nowrap",
              reportFilter === 'income' 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
            onClick={() => setReportFilter('income')}
          >
            Income Ledger
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className={cn(
              "flex-1 rounded-lg text-xs font-bold transition-all h-8 whitespace-nowrap",
              reportFilter === 'expenses' 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
            onClick={() => setReportFilter('expenses')}
          >
            Expenditure Ledger
          </Button>
        </div>
      )}

      {monthlyOrders.length === 0 && monthlyExpenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-16 text-center bg-white border border-slate-200 rounded-3xl shadow-sm">
          <div className="bg-slate-50 p-4 rounded-full mb-4">
            <Calendar className="w-12 h-12 text-slate-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No transactions recorded</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-1">There are no jobs or operating expenses logged in {periodTitle}.</p>
        </div>
      ) : (
        /* Printable Report Sheet */
        <div 
          ref={reportRef} 
          className="print:bg-white print:text-black print:p-8 space-y-6"
        >
          {/* Printable Business Header Brand */}
          <div className="hidden print:flex items-start justify-between border-b-2 border-slate-200 pb-6 mb-4">
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{businessName}</h1>
              {settings?.address && <p className="text-xs text-slate-500 mt-1">{settings.address}</p>}
              {settings?.phone && <p className="text-xs text-slate-500">{settings.phone}</p>}
              {settings?.email && <p className="text-xs text-slate-500">{settings.email}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-sm font-bold tracking-tight text-blue-600 uppercase">Financial Statement</h2>
              <p className="text-2xl font-bold text-slate-800 mt-1">{periodTitle}</p>
              <p className="text-[10px] text-slate-400 mt-1 uppercase font-semibold">Generated on: {format(new Date(), 'PPpp')}</p>
            </div>
          </div>

          <div className="print:hidden">
            <h2 className="text-lg font-bold text-slate-900">Statement for {periodTitle}</h2>
            <p className="text-xs text-slate-500">Summary of all printing jobs, customer billings, and operational expenses.</p>
          </div>

          {/* KPI Analytics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Gross Invoiced</span>
                <TrendingUp className="w-4 h-4 text-slate-400" />
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="text-xl font-black text-slate-900">{currencySymbol}{totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <p className="text-[10.5px] text-slate-400 mt-1 font-semibold">{activeOrders.length} print jobs booked</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider">Realized Cash</span>
                <DollarSign className="w-4 h-4 text-emerald-400" />
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="text-xl font-black text-emerald-600">{currencySymbol}{totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <p className="text-[10.5px] text-emerald-500/80 mt-1 font-semibold">Payments received</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                <span className="text-xs font-bold text-amber-500 uppercase tracking-wider">Receivables</span>
                <Receipt className="w-4 h-4 text-amber-400" />
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="text-xl font-black text-amber-600">{currencySymbol}{totalOutstanding.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <p className="text-[10.5px] text-amber-500/80 mt-1 font-semibold">Outstanding balance</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                <span className="text-xs font-bold text-rose-500 uppercase tracking-wider">Expenditures</span>
                <TrendingDown className="w-4 h-4 text-rose-400" />
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className="text-xl font-black text-rose-600">{currencySymbol}{totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                <p className="text-[10.5px] text-rose-500/80 mt-1 font-semibold">{monthlyExpenses.length} receipts recorded</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Accrued Margin</span>
                <BarChart3 className="w-4 h-4 text-slate-400" />
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className={cn(
                  "text-xl font-black",
                  accrualNetProfit >= 0 ? "text-blue-600" : "text-rose-600"
                )}>
                  {accrualNetProfit < 0 ? '-' : ''}{currencySymbol}{Math.abs(accrualNetProfit).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
                <p className="text-[10.5px] text-slate-400 mt-1 font-semibold font-bold">Billing - Cost</p>
              </CardContent>
            </Card>

            <Card className={cn(
              "shadow-sm border-slate-200 print:shadow-none print:border-slate-300",
              cashNetProfit >= 0 ? "bg-emerald-50/20 border-emerald-100" : "bg-rose-50/20 border-rose-100"
            )}>
              <CardHeader className="py-3 px-4 flex flex-row items-center justify-between pb-1">
                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Net Cash Profit</span>
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  cashNetProfit >= 0 ? "bg-emerald-500 animate-pulse" : "bg-rose-500"
                )} />
              </CardHeader>
              <CardContent className="py-2 px-4">
                <div className={cn(
                  "text-xl font-black",
                  cashNetProfit >= 0 ? "text-emerald-700" : "text-rose-700"
                )}>
                  {cashNetProfit < 0 ? '-' : ''}{currencySymbol}{Math.abs(cashNetProfit).toLocaleString(undefined, {minimumFractionDigits: 2})}
                </div>
                <p className="text-[10.5px] text-slate-500 mt-1 font-semibold">Realized cash margin</p>
              </CardContent>
            </Card>
          </div>

          {/* Performance Daily Chart & Costs Breakdown */}
          {reportFilter === 'all' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2 shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Transaction Activity Graph</CardTitle>
                  <CardDescription>Visualizing daily billings and spend across the month.</CardDescription>
                </CardHeader>
                <CardContent className="mt-2 h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="day" tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#94a3b8' }} />
                      <YAxis tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#94a3b8' }} />
                      <Tooltip 
                        contentStyle={{ background: '#fff', borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                        formatter={(val: number) => [`${currencySymbol}${val.toLocaleString()}`]}
                      />
                      <Area type="monotone" dataKey="Invoiced" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorInv)" name="Gross Job Billing" />
                      <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorExp)" name="Operating Expenditures" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Expenditure Category Weightings */}
              <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Costs Breakdown</CardTitle>
                  <CardDescription>Detailed classification of expenses.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {monthlyExpenses.length === 0 ? (
                    <div className="h-48 flex items-center justify-center text-xs font-medium text-slate-400">
                      No operating expenses logged this month.
                    </div>
                  ) : (
                    <div className="space-y-3.5 pt-2">
                      {Object.entries(expensesByCategory).map(([category, amount]) => {
                        const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                        return (
                          <div key={category} className="space-y-1">
                            <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                              <span className="capitalize">{category}</span>
                              <span className="text-slate-800 font-bold">{currencySymbol}{amount.toLocaleString(undefined, {minimumFractionDigits:2})} ({percentage.toFixed(0)}%)</span>
                            </div>
                            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-rose-500 rounded-full" 
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800">
                        <span>Total Operating Costs:</span>
                        <span className="text-rose-600 text-sm mt-0.5">{currencySymbol}{totalExpenses.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {reportFilter === 'activities' && (
            <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Activities Flow Graph</CardTitle>
                <CardDescription>All billing, collections, and expenses.</CardDescription>
              </CardHeader>
              <CardContent className="mt-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorColl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ background: '#fff', borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      formatter={(val: number) => [`${currencySymbol}${val.toLocaleString()}`]}
                    />
                    <Area type="monotone" dataKey="Invoiced" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorInv)" name="Gross Job Billing" />
                    <Area type="monotone" dataKey="Collected" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorColl)" name="Payments Received" />
                    <Area type="monotone" dataKey="Expenses" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorExp)" name="Expenditures" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {reportFilter === 'income' && (
            <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Income Performance Graph</CardTitle>
                <CardDescription>Gross billings vs cash received.</CardDescription>
              </CardHeader>
              <CardContent className="mt-2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dailyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorColl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#94a3b8' }} />
                    <YAxis tickLine={false} axisLine={false} style={{ fontSize: 10, fill: '#94a3b8' }} />
                    <Tooltip 
                      contentStyle={{ background: '#fff', borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}
                      formatter={(val: number) => [`${currencySymbol}${val.toLocaleString()}`]}
                    />
                    <Area type="monotone" dataKey="Invoiced" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorInv)" name="Gross Billings" />
                    <Area type="monotone" dataKey="Collected" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorColl)" name="Cash Collected" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {reportFilter === 'expenses' && (
            <Card className="shadow-sm border-slate-200 print:shadow-none print:border-slate-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-slate-700 uppercase tracking-wider">Costs & Expenses Breakdown</CardTitle>
                <CardDescription>Detailed classification of expenses.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {monthlyExpenses.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-xs font-medium text-slate-400">
                    No operating expenses logged this month.
                  </div>
                ) : (
                  <div className="space-y-4 pt-2">
                    {Object.entries(expensesByCategory).map(([category, amount]) => {
                      const percentage = totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0;
                      return (
                        <div key={category} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <span className="capitalize">{category}</span>
                            <span className="text-slate-800 font-bold">{currencySymbol}{amount.toLocaleString(undefined, {minimumFractionDigits:2})} ({percentage.toFixed(0)}%)</span>
                          </div>
                          <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500 rounded-full" 
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-slate-800">
                      <span>Total Registered Operating Costs:</span>
                      <span className="text-rose-600 text-sm mt-0.5">{currencySymbol}{totalExpenses.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Section: Chronological Activities Timeline */}
          {(reportFilter === 'all' || reportFilter === 'activities') && (
            <Card className="shadow-sm border-slate-100 print:shadow-none print:border-slate-300 break-after-page">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-wider">Chronological Activities Timeline</CardTitle>
                  <CardDescription className="print:hidden font-medium text-xs">A unified chronological report of all store receipts, invoices, and expenses.</CardDescription>
                </div>
                <Badge className="bg-slate-100 text-slate-800 border border-slate-200 font-medium">{combinedActivities.length} Activities</Badge>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">DATE</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">TYPE</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">REF #</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">CLIENT / PARTICULARS</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">DETAILS</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-slate-400 tracking-wider">INVOICED (+)</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-slate-400 tracking-wider">CASH RECVD (+)</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-slate-400 tracking-wider">EXPENSE (-)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {combinedActivities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-slate-400 text-xs font-semibold">
                          No activities registered in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      combinedActivities.map((act) => (
                        <TableRow key={act.id} className="hover:bg-slate-50/20">
                          <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                            {format(act.date, 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-xs font-semibold">
                            {act.type === 'income' ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">
                                Income
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full text-[10px] uppercase font-bold tracking-wider">
                                Expense
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-slate-600 whitespace-nowrap">
                            {act.ref}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-900">
                            {act.party}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 max-w-[180px] truncate">
                            {act.description}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-slate-900">
                            {act.incomeAmount > 0 ? `${currencySymbol}${act.incomeAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">
                            {act.cashReceived > 0 ? `${currencySymbol}${act.cashReceived.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-rose-600">
                            {act.expenseAmount > 0 ? `${currencySymbol}${act.expenseAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}` : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {combinedActivities.length > 0 && (
                      <TableRow className="bg-slate-50/30 font-bold border-t border-slate-200">
                        <TableCell colSpan={5} className="text-xs text-slate-900 text-right font-black">Statement Grand Totals:</TableCell>
                        <TableCell className="text-right text-xs text-slate-900 font-extrabold font-black">
                          {currencySymbol}{totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </TableCell>
                        <TableCell className="text-right text-xs text-emerald-600 font-black">
                          {currencySymbol}{totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </TableCell>
                        <TableCell className="text-right text-xs text-rose-600 font-black">
                          {currencySymbol}{totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Section: Works Ledger */}
          {(reportFilter === 'all' || reportFilter === 'income') && (
            <Card className="shadow-sm border-slate-100 print:shadow-none print:border-slate-300 break-after-page">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-wider">Monthly Works Ledger</CardTitle>
                  <CardDescription className="print:hidden">Chronological index of all orders created and processed.</CardDescription>
                </div>
                <Badge className="bg-blue-50 text-blue-600 border border-blue-200 font-medium">{monthlyOrders.length} Invoices</Badge>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="w-[100px] text-[10px] font-bold text-slate-400 tracking-wider">INVOICE</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">DATE</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">CLIENT</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">DESCRIPTION DETAILS</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">STATUS</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">PAYMENT</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-slate-400 tracking-wider">TOTAL VALUE</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-slate-400 tracking-wider">CASH RECVD</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="h-24 text-center text-slate-400 text-xs font-semibold">
                          No orders registered in this period.
                        </TableCell>
                      </TableRow>
                    ) : (
                      monthlyOrders.map((o) => (
                        <TableRow key={o.id} className="hover:bg-slate-50/20">
                          <TableCell className="font-mono text-xs text-slate-800 font-black">
                            {o.invoiceNumber || `#${o.id?.slice(-6).toUpperCase()}`}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                            {format(getOrderDate(o), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-900">
                            {o.customerName}
                          </TableCell>
                          <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">
                            {o.items?.map(i => i.description).join(', ') || 'Custom Job'}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(o.status)}
                          </TableCell>
                          <TableCell>
                            {getPaymentBadge(o.paymentStatus)}
                          </TableCell>
                          <TableCell className="text-right text-xs font-semibold text-slate-900">
                            {currencySymbol}{o.totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </TableCell>
                          <TableCell className="text-right text-xs font-bold text-emerald-600">
                            {currencySymbol}{o.paidAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {monthlyOrders.length > 0 && (
                      <TableRow className="bg-slate-50/30 font-bold border-t border-slate-200">
                        <TableCell colSpan={4} className="text-xs text-slate-900 text-right">Running Total (Excludes Cancelled): All Active Billings</TableCell>
                        <TableCell colSpan={2} />
                        <TableCell className="text-right text-xs text-slate-900 font-extrabold font-black">
                          {currencySymbol}{totalInvoiced.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </TableCell>
                        <TableCell className="text-right text-xs text-emerald-600 font-black">
                          {currencySymbol}{totalCollected.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Section: Expenditures Ledger */}
          {(reportFilter === 'all' || reportFilter === 'expenses') && (
            <Card className="shadow-sm border-slate-100 print:shadow-none print:border-slate-300">
              <CardHeader className="py-4 px-6 border-b border-slate-100 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-black text-slate-900 uppercase tracking-wider">Costs and Expenditures</CardTitle>
                  <CardDescription className="print:hidden font-medium text-xs">Ledger log of all expenditures filed across the shop.</CardDescription>
                </div>
                <Badge className="bg-rose-50 text-rose-600 border border-rose-200 font-medium">{monthlyExpenses.length} Receipts</Badge>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/50">
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">DATE</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">PARTICULARS DESCRIPTION</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">CLASSIFICATION CATEGORY</TableHead>
                      <TableHead className="text-[10px] font-bold text-slate-400 tracking-wider">CREATED BY</TableHead>
                      <TableHead className="text-right text-[10px] font-bold text-slate-400 tracking-wider font-semibold">COST VALUE</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthlyExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-slate-400 text-xs font-semibold">
                          No expenses registered during this statement.
                        </TableCell>
                      </TableRow>
                    ) : (
                      monthlyExpenses.map((e) => (
                        <TableRow key={e.id} className="hover:bg-slate-50/20">
                          <TableCell className="text-xs text-slate-500 whitespace-nowrap">
                            {format(getExpenseDate(e), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-xs font-semibold text-slate-900">
                            {e.description || 'General Operational Expense'}
                          </TableCell>
                          <TableCell className="text-xs font-semibold capitalize text-slate-500">
                            {e.category}
                          </TableCell>
                          <TableCell className="text-xs text-slate-500">
                            {e.createdBy === user.uid ? 'Me' : 'Staff Member'}
                          </TableCell>
                          <TableCell className="text-right text-xs font-black text-rose-600">
                            {currencySymbol}{e.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    {monthlyExpenses.length > 0 && (
                      <TableRow className="bg-slate-50/30 font-bold border-t border-slate-200">
                        <TableCell colSpan={4} className="text-xs text-slate-900 text-right font-bold">Total Operating Expenditure Costs:</TableCell>
                        <TableCell className="text-right text-xs text-rose-600 font-black font-semibold">
                          {currencySymbol}{totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Printable Authorization Footnotes */}
          <div className="hidden print:grid grid-cols-2 gap-12 pt-16 border-t border-slate-200 mt-12 text-center text-xs text-slate-500">
            <div className="space-y-4">
              <div className="h-10 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
              <p className="font-semibold text-slate-700">Client / Store Manager Signature</p>
              <p className="text-[10px] text-slate-400">Date: ____ / ____ / ________</p>
            </div>
            <div className="space-y-4">
              <div className="h-10 border-b border-dashed border-slate-300 w-3/4 mx-auto" />
              <p className="font-semibold text-slate-700">Accounts Department Sign-Off</p>
              <p className="text-[10px] text-slate-400">Date: ____ / ____ / ________</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

