import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StripeClient } from '../../../../src/integrations/stripe/client.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('StripeClient', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should accept valid secret key', () => {
      const client = new StripeClient('sk_test_123456');
      expect(client).toBeDefined();
    });

    it('should throw when secret key is missing', () => {
      expect(() => new StripeClient('')).toThrow('required');
    });

    it('should throw when secret key format is invalid', () => {
      expect(() => new StripeClient('invalid_key')).toThrow('sk_');
    });
  });

  describe('createInvoice', () => {
    it('should create invoice with line items successfully', async () => {
      // Mock: create draft, add items, finalize
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'in_123',
            number: null,
            customer: 'cus_123',
            status: 'draft',
            amount_due: 0,
            amount_paid: 0,
            currency: 'usd',
            due_date: null,
            created: 1234567890,
            status_transitions: { paid_at: null },
            hosted_invoice_url: null,
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ii_1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ id: 'ii_2' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'in_123',
            number: 'INV-001',
            customer: 'cus_123',
            status: 'open',
            amount_due: 25000,
            amount_paid: 0,
            currency: 'usd',
            due_date: 1234567890,
            created: 1234567890,
            status_transitions: { paid_at: null },
            hosted_invoice_url: 'https://invoice.stripe.com/i/123',
          }),
        });

      const client = new StripeClient('sk_test_123');
      const invoice = await client.createInvoice('cus_123', [
        { description: 'IT Support - February', amount: 15000 },
        { description: 'Hardware Setup', amount: 10000, quantity: 1 },
      ]);

      expect(invoice.id).toBe('in_123');
      expect(invoice.number).toBe('INV-001');
      expect(invoice.status).toBe('open');
      expect(invoice.amountDue).toBe(25000);
      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('should throw when invoice creation fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'Invalid customer' } }),
      });

      const client = new StripeClient('sk_test_123');
      await expect(
        client.createInvoice('invalid_cus', [{ description: 'Test', amount: 1000 }])
      ).rejects.toThrow('Invalid customer');
    });
  });

  describe('getInvoices', () => {
    it('should get invoices successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'in_1',
              number: 'INV-001',
              customer: 'cus_123',
              status: 'open',
              amount_due: 15000,
              amount_paid: 0,
              currency: 'usd',
              due_date: 1234567890,
              created: 1234567890,
              status_transitions: { paid_at: null },
              hosted_invoice_url: 'https://invoice.stripe.com/i/1',
            },
            {
              id: 'in_2',
              number: 'INV-002',
              customer: 'cus_456',
              status: 'paid',
              amount_due: 0,
              amount_paid: 20000,
              currency: 'usd',
              due_date: null,
              created: 1234567890,
              status_transitions: { paid_at: 1234567900 },
              hosted_invoice_url: null,
            },
          ],
        }),
      });

      const client = new StripeClient('sk_test_123');
      const invoices = await client.getInvoices();

      expect(invoices).toHaveLength(2);
      expect(invoices[0].number).toBe('INV-001');
      expect(invoices[1].status).toBe('paid');
      expect(invoices[1].paidAt).toBeInstanceOf(Date);
    });

    it('should filter invoices by status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'in_1',
              number: 'INV-001',
              customer: 'cus_123',
              status: 'open',
              amount_due: 15000,
              amount_paid: 0,
              currency: 'usd',
              due_date: null,
              created: 1234567890,
              status_transitions: { paid_at: null },
              hosted_invoice_url: null,
            },
          ],
        }),
      });

      const client = new StripeClient('sk_test_123');
      const invoices = await client.getInvoices('open');

      expect(invoices).toHaveLength(1);
      expect(invoices[0].status).toBe('open');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('status=open'),
        expect.anything()
      );
    });

    it('should cache invoices for 10 minutes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const client = new StripeClient('sk_test_123');
      const invoices1 = await client.getInvoices();
      const invoices2 = await client.getInvoices();

      expect(invoices1).toEqual(invoices2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getBalance', () => {
    it('should get balance successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: [{ amount: 50000, currency: 'usd' }],
          pending: [{ amount: 15000, currency: 'usd' }],
        }),
      });

      const client = new StripeClient('sk_test_123');
      const balance = await client.getBalance();

      expect(balance.available).toBe(50000);
      expect(balance.pending).toBe(15000);
      expect(balance.currency).toBe('usd');
    });

    it('should handle empty balance', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: [],
          pending: [],
        }),
      });

      const client = new StripeClient('sk_test_123');
      const balance = await client.getBalance();

      expect(balance.available).toBe(0);
      expect(balance.pending).toBe(0);
      expect(balance.currency).toBe('usd');
    });

    it('should cache balance for 10 minutes', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: [{ amount: 50000, currency: 'usd' }],
          pending: [{ amount: 0, currency: 'usd' }],
        }),
      });

      const client = new StripeClient('sk_test_123');
      const balance1 = await client.getBalance();
      const balance2 = await client.getBalance();

      expect(balance1).toEqual(balance2);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRecentPayments', () => {
    it('should get recent payments successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'ch_1',
              amount: 15000,
              currency: 'usd',
              status: 'succeeded',
              description: 'Payment for INV-001',
              created: 1234567890,
              billing_details: { name: 'John Doe' },
            },
            {
              id: 'ch_2',
              amount: 20000,
              currency: 'usd',
              status: 'succeeded',
              description: null,
              created: 1234567800,
              billing_details: { name: null },
            },
          ],
        }),
      });

      const client = new StripeClient('sk_test_123');
      const payments = await client.getRecentPayments(2);

      expect(payments).toHaveLength(2);
      expect(payments[0].amount).toBe(15000);
      expect(payments[0].customerName).toBe('John Doe');
      expect(payments[1].customerName).toBeUndefined();
      expect(payments[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe('getCustomers', () => {
    it('should get customers successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'cus_123',
              name: 'Acme Corp',
              email: 'billing@acme.com',
              phone: '+1234567890',
              created: 1234567890,
            },
            {
              id: 'cus_456',
              name: null,
              email: 'user@example.com',
              phone: null,
              created: 1234567800,
            },
          ],
        }),
      });

      const client = new StripeClient('sk_test_123');
      const customers = await client.getCustomers();

      expect(customers).toHaveLength(2);
      expect(customers[0].name).toBe('Acme Corp');
      expect(customers[0].phone).toBe('+1234567890');
      expect(customers[1].name).toBe('Unknown');
      expect(customers[1].phone).toBeUndefined();
    });
  });

  describe('createCustomer', () => {
    it('should create customer successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cus_new',
          name: 'New Customer',
          email: 'new@example.com',
          phone: '+1234567890',
          created: 1234567890,
        }),
      });

      const client = new StripeClient('sk_test_123');
      const customer = await client.createCustomer(
        'New Customer',
        'new@example.com',
        '+1234567890'
      );

      expect(customer.id).toBe('cus_new');
      expect(customer.name).toBe('New Customer');
      expect(customer.email).toBe('new@example.com');
      expect(customer.phone).toBe('+1234567890');
    });

    it('should create customer without phone', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cus_new',
          name: 'New Customer',
          email: 'new@example.com',
          phone: null,
          created: 1234567890,
        }),
      });

      const client = new StripeClient('sk_test_123');
      const customer = await client.createCustomer('New Customer', 'new@example.com');

      expect(customer.phone).toBeUndefined();
    });
  });

  describe('sendInvoice', () => {
    it('should send invoice successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'in_123',
          number: 'INV-001',
          customer: 'cus_123',
          status: 'open',
          amount_due: 15000,
          amount_paid: 0,
          currency: 'usd',
          due_date: null,
          created: 1234567890,
          status_transitions: { paid_at: null },
          hosted_invoice_url: null,
        }),
      });

      const client = new StripeClient('sk_test_123');
      const result = await client.sendInvoice('in_123');

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/invoices/in_123/send'),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('should throw when send fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: { message: 'Invoice not found' } }),
      });

      const client = new StripeClient('sk_test_123');
      await expect(client.sendInvoice('in_invalid')).rejects.toThrow('Invoice not found');
    });
  });

  describe('formatForBriefing', () => {
    it('should format invoices and balance for Pryceless Solutions', () => {
      const invoices = [
        {
          id: 'in_1',
          number: 'INV-001',
          customer: 'cus_123',
          customerName: 'Acme Corp',
          status: 'open' as const,
          amountDue: 15000,
          amountPaid: 0,
          currency: 'usd',
          dueDate: new Date('2026-03-01'),
          createdAt: new Date('2026-02-01'),
        },
        {
          id: 'in_2',
          number: 'INV-002',
          customer: 'cus_456',
          customerName: 'Tech Startup Inc',
          status: 'open' as const,
          amountDue: 20000,
          amountPaid: 0,
          currency: 'usd',
          dueDate: new Date('2026-03-15'),
          createdAt: new Date('2026-02-15'),
        },
        {
          id: 'in_3',
          number: 'INV-003',
          customer: 'cus_789',
          customerName: 'Local Business',
          status: 'paid' as const,
          amountDue: 0,
          amountPaid: 10000,
          currency: 'usd',
          paidAt: new Date('2026-02-10'),
          createdAt: new Date('2026-02-01'),
        },
      ];

      const balance = {
        available: 50000,
        pending: 15000,
        currency: 'usd',
      };

      const client = new StripeClient('sk_test_123');
      const briefing = client.formatForBriefing(invoices, balance);

      expect(briefing).toContain('Pryceless Solutions');
      expect(briefing).toContain('Available: $500.00 USD');
      expect(briefing).toContain('Pending: $150.00 USD');
      expect(briefing).toContain('2 Outstanding Invoices');
      expect(briefing).toContain('INV-001: $150.00 - Acme Corp');
      expect(briefing).toContain('INV-002: $200.00 - Tech Startup Inc');
      expect(briefing).toContain('Total Outstanding: $350.00');
      expect(briefing).toContain('Recent Payments');
      expect(briefing).toContain('INV-003: $100.00 - Local Business');
    });

    it('should handle no outstanding invoices gracefully', () => {
      const invoices = [
        {
          id: 'in_1',
          number: 'INV-001',
          customer: 'cus_123',
          status: 'paid' as const,
          amountDue: 0,
          amountPaid: 15000,
          currency: 'usd',
          paidAt: new Date('2026-02-10'),
          createdAt: new Date('2026-02-01'),
        },
      ];

      const balance = {
        available: 15000,
        pending: 0,
        currency: 'usd',
      };

      const client = new StripeClient('sk_test_123');
      const briefing = client.formatForBriefing(invoices, balance);

      expect(briefing).toContain('Available: $150.00 USD');
      expect(briefing).not.toContain('Outstanding Invoices');
      expect(briefing).toContain('Recent Payments');
    });

    it('should truncate long invoice lists', () => {
      const invoices = Array.from({ length: 10 }, (_, i) => ({
        id: `in_${i}`,
        number: `INV-${String(i).padStart(3, '0')}`,
        customer: `cus_${i}`,
        status: 'open' as const,
        amountDue: 10000,
        amountPaid: 0,
        currency: 'usd',
        createdAt: new Date('2026-02-01'),
      }));

      const balance = {
        available: 0,
        pending: 100000,
        currency: 'usd',
      };

      const client = new StripeClient('sk_test_123');
      const briefing = client.formatForBriefing(invoices, balance);

      expect(briefing).toContain('10 Outstanding Invoices');
      expect(briefing).toContain('... and 5 more');
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const client = new StripeClient('sk_test_123');
      await expect(client.getBalance()).rejects.toThrow('Network error');
    });

    it('should handle API errors with messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { message: 'Invalid API key' } }),
      });

      const client = new StripeClient('sk_test_123');
      await expect(client.getBalance()).rejects.toThrow('Invalid API key');
    });

    it('should handle API errors without messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      });

      const client = new StripeClient('sk_test_123');
      await expect(client.getBalance()).rejects.toThrow('Internal Server Error');
    });

    it('should include status code in error messages', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
      });

      const client = new StripeClient('sk_test_123');
      await expect(client.getBalance()).rejects.toThrow('429');
    });
  });

  describe('request formatting', () => {
    it('should use form-encoded bodies for POST requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'cus_123',
          name: 'Test Customer',
          email: 'test@example.com',
          phone: null,
          created: 1234567890,
        }),
      });

      const client = new StripeClient('sk_test_123');
      await client.createCustomer('Test Customer', 'test@example.com');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/x-www-form-urlencoded',
          }),
          body: expect.stringContaining('name=Test+Customer'),
        })
      );
    });

    it('should include authorization header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: [],
          pending: [],
        }),
      });

      const client = new StripeClient('sk_test_secret123');
      await client.getBalance();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer sk_test_secret123',
          }),
        })
      );
    });

    it('should include Stripe API version header', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          available: [],
          pending: [],
        }),
      });

      const client = new StripeClient('sk_test_123');
      await client.getBalance();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Stripe-Version': '2023-10-16',
          }),
        })
      );
    });
  });
});
