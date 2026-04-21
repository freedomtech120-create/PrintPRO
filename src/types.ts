export type OrderStatus = 'pending' | 'processing' | 'completed' | 'delivered' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export interface OrderItem {
  description: string;
  productId?: string;
  quantity: number;
  unitPrice: number;
  width?: number; // in feet
  height?: number; // in feet
  area?: number; // sq ft
  total: number;
}

export interface Order {
  id?: string;
  tenantId: string;
  invoiceNumber?: string;
  customerId: string;
  customerName: string;
  items: OrderItem[];
  totalAmount: number;
  paidAmount: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  createdAt: any;
  updatedAt: any;
  createdBy: string;
}

export interface Expense {
  id?: string;
  tenantId: string;
  description: string;
  amount: number;
  category: string;
  date: any;
  createdBy: string;
}

export interface Customer {
  id?: string;
  tenantId: string;
  name: string;
  email: string;
  phone: string;
  address: string;
}
 
export interface Product {
  id?: string;
  tenantId: string;
  name: string;
  pricePerSqFt: number;
  category: string;
}

export interface Tenant {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  createdAt: any;
  isAdmin?: boolean;
  // Subscription fields
  trialExpiresAt: any;
  subscriptionExpiresAt?: any;
  isApproved: boolean; // Admin manually confirms active users
  subscriptionStatus: 'trial' | 'active' | 'expired' | 'pending_approval';
  lastPaymentRef?: string;
  planType?: '3m' | '6m' | '1y';
}

export interface PlatformSettings {
  prices: {
    '3m': number;
    '6m': number;
    '1y': number;
  };
  currencyCode: string;
  currencySymbol: string;
  paystackPublicKey: string;
}

export interface BusinessSettings {
  tenantId: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  currencyCode: string;
  currencySymbol: string;
  smsProvider?: 'arkasel' | 'mnotify';
  smsApiKey?: string;
  smsSenderId?: string;
}
