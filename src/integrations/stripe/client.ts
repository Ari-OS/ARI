/**
 * Stripe Integration
 *
 * Provides invoicing and payment tracking for Pryceless Solutions via Stripe API
 * Requires Stripe secret key (sk_live_... or sk_test_...)
 *
 * Usage:
 *   const stripe = new StripeClient(process.env.STRIPE_SECRET_KEY);
 *   const invoice = await stripe.createInvoice(customerId, [{ description: 'IT Support', amount: 15000 }]);
 *   const balance = await stripe.getBalance();
 */

import { createLogger } from '../../kernel/logger.js';

const log = createLogger('stripe-client');

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Invoice {
  id: string;
  number: string;
  customer: string;
  customerName?: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  amountDue: number; // cents
  amountPaid: number;
  currency: string;
  dueDate?: Date;
  createdAt: Date;
  paidAt?: Date;
  hostedInvoiceUrl?: string;
}

export interface Payment {
  id: string;
  amount: number; // cents
  currency: string;
  status: string;
  description?: string;
  customerName?: string;
  createdAt: Date;
}

export interface BalanceData {
  available: number; // cents
  pending: number;
  currency: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  created: Date;
}

interface ApiInvoice {
  id: string;
  number: string | null;
  customer: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  due_date: number | null;
  created: number;
  status_transitions: {
    paid_at: number | null;
  };
  hosted_invoice_url: string | null;
}

interface ApiCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  description: string | null;
  created: number;
  billing_details: {
    name: string | null;
  };
}

interface ApiBalance {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

interface ApiCustomer {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  created: number;
}

interface ApiInvoiceItem {
  id: string;
}

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

// ─── Stripe Client ──────────────────────────────────────────────────────────

export class StripeClient {
  private secretKey: string;
  private baseUrl = 'https://api.stripe.com/v1';
  private cacheTtlMs = 10 * 60 * 1000; // 10 minutes
  private balanceCache: CacheEntry<BalanceData> | null = null;
  private invoicesCache: CacheEntry<Invoice[]> | null = null;
  private customersCache: Map<string, CacheEntry<Customer>> = new Map();

  constructor(secretKey: string) {
    if (!secretKey) {
      throw new Error('Stripe secret key is required');
    }
    if (!secretKey.startsWith('sk_')) {
      throw new Error('Invalid Stripe secret key format (must start with sk_)');
    }
    this.secretKey = secretKey;
  }

  /**
   * Create an invoice for a customer
   */
  async createInvoice(
    customerId: string,
    items: Array<{ description: string; amount: number; quantity?: number }>
  ): Promise<Invoice> {
    try {
      // Create draft invoice
      const createParams = new URLSearchParams({
        customer: customerId,
        auto_advance: 'false', // Keep as draft initially
      });

      const createResponse = await this.request<ApiInvoice>('POST', '/invoices', createParams);

      // Add line items
      for (const item of items) {
        const itemParams = new URLSearchParams({
          customer: customerId,
          invoice: createResponse.id,
          description: item.description,
          amount: String(item.amount),
          quantity: String(item.quantity ?? 1),
        });

        await this.request<ApiInvoiceItem>('POST', '/invoiceitems', itemParams);
      }

      // Finalize invoice
      const finalizeParams = new URLSearchParams();
      const finalizedInvoice = await this.request<ApiInvoice>(
        'POST',
        `/invoices/${createResponse.id}/finalize`,
        finalizeParams
      );

      const invoice = this.mapInvoice(finalizedInvoice);

      log.info(`Created invoice ${invoice.number} for ${customerId}: $${(invoice.amountDue / 100).toFixed(2)}`);
      this.invalidateInvoicesCache();
      return invoice;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to create invoice: ${message}`);
      throw new Error(`Failed to create invoice: ${message}`);
    }
  }

  /**
   * Get invoices with optional status filter
   */
  async getInvoices(status?: string, limit: number = 10): Promise<Invoice[]> {
    const cached = this.invoicesCache;

    if (cached && !status && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug('Using cached invoices');
      return cached.data.slice(0, limit);
    }

    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (status) {
        params.set('status', status);
      }

      const response = await this.request<{ data: ApiInvoice[] }>(
        'GET',
        `/invoices?${params.toString()}`
      );

      const invoices = response.data.map(inv => this.mapInvoice(inv));

      if (!status) {
        this.invoicesCache = { data: invoices, fetchedAt: Date.now() };
      }

      log.info(`Fetched ${invoices.length} invoices${status ? ` with status ${status}` : ''}`);
      return invoices;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get invoices: ${message}`);
      throw new Error(`Failed to get invoices: ${message}`);
    }
  }

  /**
   * Get account balance
   */
  async getBalance(): Promise<BalanceData> {
    const cached = this.balanceCache;

    if (cached && Date.now() - cached.fetchedAt < this.cacheTtlMs) {
      log.debug('Using cached balance');
      return cached.data;
    }

    try {
      const response = await this.request<ApiBalance>('GET', '/balance');

      const available = response.available[0]?.amount ?? 0;
      const pending = response.pending[0]?.amount ?? 0;
      const currency = response.available[0]?.currency ?? 'usd';

      const balance: BalanceData = {
        available,
        pending,
        currency,
      };

      this.balanceCache = { data: balance, fetchedAt: Date.now() };
      log.info(`Fetched balance: $${(available / 100).toFixed(2)} available, $${(pending / 100).toFixed(2)} pending`);
      return balance;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get balance: ${message}`);
      throw new Error(`Failed to get balance: ${message}`);
    }
  }

  /**
   * Get recent payments
   */
  async getRecentPayments(limit: number = 10): Promise<Payment[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      const response = await this.request<{ data: ApiCharge[] }>(
        'GET',
        `/charges?${params.toString()}`
      );

      const payments: Payment[] = response.data.map(charge => ({
        id: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        status: charge.status,
        description: charge.description ?? undefined,
        customerName: charge.billing_details.name ?? undefined,
        createdAt: new Date(charge.created * 1000),
      }));

      log.info(`Fetched ${payments.length} recent payments`);
      return payments;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get recent payments: ${message}`);
      throw new Error(`Failed to get recent payments: ${message}`);
    }
  }

  /**
   * Get customers
   */
  async getCustomers(limit: number = 10): Promise<Customer[]> {
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      const response = await this.request<{ data: ApiCustomer[] }>(
        'GET',
        `/customers?${params.toString()}`
      );

      const customers: Customer[] = response.data.map(cust => ({
        id: cust.id,
        name: cust.name ?? 'Unknown',
        email: cust.email ?? '',
        phone: cust.phone ?? undefined,
        created: new Date(cust.created * 1000),
      }));

      log.info(`Fetched ${customers.length} customers`);
      return customers;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to get customers: ${message}`);
      throw new Error(`Failed to get customers: ${message}`);
    }
  }

  /**
   * Create a new customer
   */
  async createCustomer(name: string, email: string, phone?: string): Promise<Customer> {
    try {
      const params = new URLSearchParams({
        name,
        email,
      });

      if (phone) {
        params.set('phone', phone);
      }

      const response = await this.request<ApiCustomer>('POST', '/customers', params);

      const customer: Customer = {
        id: response.id,
        name: response.name ?? name,
        email: response.email ?? email,
        phone: response.phone ?? phone,
        created: new Date(response.created * 1000),
      };

      log.info(`Created customer ${customer.id}: ${customer.name}`);
      return customer;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to create customer: ${message}`);
      throw new Error(`Failed to create customer: ${message}`);
    }
  }

  /**
   * Send an invoice to the customer via email
   */
  async sendInvoice(invoiceId: string): Promise<boolean> {
    try {
      const params = new URLSearchParams();
      await this.request<ApiInvoice>('POST', `/invoices/${invoiceId}/send`, params);

      log.info(`Sent invoice ${invoiceId} to customer`);
      return true;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      log.error(`Failed to send invoice: ${message}`);
      throw new Error(`Failed to send invoice: ${message}`);
    }
  }

  /**
   * Format invoices and balance for briefing display
   */
  formatForBriefing(invoices: Invoice[], balance: BalanceData): string {
    const lines: string[] = [];

    // Balance
    lines.push('💰 Pryceless Solutions - Stripe Balance:');
    const availableDollars = (balance.available / 100).toFixed(2);
    const pendingDollars = (balance.pending / 100).toFixed(2);
    lines.push(`  Available: $${availableDollars} ${balance.currency.toUpperCase()}`);
    lines.push(`  Pending: $${pendingDollars} ${balance.currency.toUpperCase()}`);

    // Outstanding invoices
    const outstanding = invoices.filter(inv => inv.status === 'open');
    if (outstanding.length > 0) {
      lines.push('');
      lines.push(`📄 ${outstanding.length} Outstanding Invoices:`);

      for (const invoice of outstanding.slice(0, 5)) {
        const amount = (invoice.amountDue / 100).toFixed(2);
        const dueDate = invoice.dueDate
          ? new Date(invoice.dueDate).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : 'No due date';
        const customerName = invoice.customerName ?? invoice.customer;
        lines.push(`  ${invoice.number}: $${amount} - ${customerName} (Due: ${dueDate})`);
      }

      if (outstanding.length > 5) {
        lines.push(`  ... and ${outstanding.length - 5} more`);
      }

      const totalOutstanding = outstanding.reduce((sum, inv) => sum + inv.amountDue, 0);
      lines.push(`  Total Outstanding: $${(totalOutstanding / 100).toFixed(2)}`);
    }

    // Recent paid invoices
    const paid = invoices.filter(inv => inv.status === 'paid').slice(0, 3);
    if (paid.length > 0) {
      lines.push('');
      lines.push('✅ Recent Payments:');
      for (const invoice of paid) {
        const amount = (invoice.amountPaid / 100).toFixed(2);
        const paidDate = invoice.paidAt
          ? new Date(invoice.paidAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            })
          : 'Unknown';
        const customerName = invoice.customerName ?? invoice.customer;
        lines.push(`  ${invoice.number}: $${amount} - ${customerName} (Paid: ${paidDate})`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Internal method to make Stripe API requests
   */
  private async request<T>(
    method: string,
    endpoint: string,
    body?: URLSearchParams
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${this.secretKey}`,
      'Stripe-Version': '2023-10-16',
    };

    const options: RequestInit = {
      method,
      headers,
    };

    if (body && method === 'POST') {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.body = body.toString();
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json() as { error?: { message?: string } };
        const errorMessage = errorData.error?.message ?? response.statusText;
        throw new Error(`Stripe API error (${response.status}): ${errorMessage}`);
      }

      return await response.json() as T;
    } catch (error: unknown) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Stripe API request failed: ${String(error)}`);
    }
  }

  /**
   * Map API invoice to our Invoice type
   */
  private mapInvoice(apiInvoice: ApiInvoice): Invoice {
    return {
      id: apiInvoice.id,
      number: apiInvoice.number ?? apiInvoice.id,
      customer: apiInvoice.customer,
      status: apiInvoice.status as Invoice['status'],
      amountDue: apiInvoice.amount_due,
      amountPaid: apiInvoice.amount_paid,
      currency: apiInvoice.currency,
      dueDate: apiInvoice.due_date ? new Date(apiInvoice.due_date * 1000) : undefined,
      createdAt: new Date(apiInvoice.created * 1000),
      paidAt: apiInvoice.status_transitions.paid_at
        ? new Date(apiInvoice.status_transitions.paid_at * 1000)
        : undefined,
      hostedInvoiceUrl: apiInvoice.hosted_invoice_url ?? undefined,
    };
  }

  /**
   * Invalidate invoices cache when creating/updating invoices
   */
  private invalidateInvoicesCache(): void {
    this.invoicesCache = null;
  }
}
