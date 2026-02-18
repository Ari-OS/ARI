import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CRMStore } from '../../../../src/integrations/crm/crm-store.js';
import type { Contact, ContactCategory } from '../../../../src/integrations/crm/crm-store.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createTestContact(overrides?: Partial<Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>>) {
  return {
    name: 'Jane Smith',
    email: 'jane@example.com',
    company: 'Acme Corp',
    phone: '555-1234',
    category: 'client' as ContactCategory,
    tags: ['vip', 'active'],
    notes: 'Key client for Q1 project',
    relationshipScore: 75,
    lastContactDate: new Date().toISOString(),
    ...overrides,
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CRMStore', () => {
  let store: CRMStore;

  beforeEach(() => {
    store = new CRMStore(':memory:');
    store.init();
  });

  afterEach(() => {
    store.close();
  });

  describe('init', () => {
    it('should create the contacts table', () => {
      // If init didn't create the table, createContact would throw
      const contact = store.createContact(createTestContact());
      expect(contact.id).toBeDefined();
    });

    it('should not fail on double init', () => {
      expect(() => store.init()).not.toThrow();
    });

    it('should throw if operations called before init', () => {
      const uninitStore = new CRMStore(':memory:');
      expect(() => uninitStore.createContact(createTestContact())).toThrow('not initialized');
      // Clean up — no close needed since not initialized
    });
  });

  describe('createContact / getContact', () => {
    it('should round-trip a contact', () => {
      const input = createTestContact();
      const created = store.createContact(input);

      expect(created.id).toBeDefined();
      expect(created.name).toBe('Jane Smith');
      expect(created.email).toBe('jane@example.com');
      expect(created.company).toBe('Acme Corp');
      expect(created.category).toBe('client');
      expect(created.tags).toEqual(['vip', 'active']);
      expect(created.relationshipScore).toBe(75);
      expect(created.createdAt).toBeDefined();
      expect(created.updatedAt).toBeDefined();

      const fetched = store.getContact(created.id);
      expect(fetched).not.toBeNull();
      expect(fetched!.name).toBe('Jane Smith');
      expect(fetched!.email).toBe('jane@example.com');
      expect(fetched!.tags).toEqual(['vip', 'active']);
    });

    it('should return null for non-existent contact', () => {
      const result = store.getContact('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle optional fields', () => {
      const contact = store.createContact(createTestContact({
        email: undefined,
        company: undefined,
        phone: undefined,
      }));

      const fetched = store.getContact(contact.id);
      expect(fetched!.email).toBeUndefined();
      expect(fetched!.company).toBeUndefined();
      expect(fetched!.phone).toBeUndefined();
    });

    it('should assign unique IDs to each contact', () => {
      const c1 = store.createContact(createTestContact({ name: 'Alice' }));
      const c2 = store.createContact(createTestContact({ name: 'Bob' }));
      expect(c1.id).not.toBe(c2.id);
    });
  });

  describe('searchContacts', () => {
    it('should find contacts by name', () => {
      store.createContact(createTestContact({ name: 'Jane Smith', email: 'jane@test.com' }));
      store.createContact(createTestContact({ name: 'John Doe', email: 'john@test.com' }));

      const results = store.searchContacts('Jane');
      expect(results).toHaveLength(1);
      expect(results[0].name).toBe('Jane Smith');
    });

    it('should find contacts by email', () => {
      store.createContact(createTestContact({ email: 'ceo@bigcorp.com' }));
      store.createContact(createTestContact({ name: 'Other', email: 'other@test.com' }));

      const results = store.searchContacts('bigcorp');
      expect(results).toHaveLength(1);
      expect(results[0].email).toBe('ceo@bigcorp.com');
    });

    it('should find contacts by company', () => {
      store.createContact(createTestContact({ company: 'Pryceless Solutions' }));
      store.createContact(createTestContact({ name: 'Other', company: 'Other Co' }));

      const results = store.searchContacts('Pryceless');
      expect(results).toHaveLength(1);
      expect(results[0].company).toBe('Pryceless Solutions');
    });

    it('should find contacts by notes', () => {
      store.createContact(createTestContact({ notes: 'Key decision maker for Q2 project' }));

      const results = store.searchContacts('decision maker');
      expect(results).toHaveLength(1);
    });

    it('should return empty array for no matches', () => {
      store.createContact(createTestContact());
      const results = store.searchContacts('zzzznonexistent');
      expect(results).toHaveLength(0);
    });

    it('should return results ordered by relationship score', () => {
      store.createContact(createTestContact({ name: 'Low Score', relationshipScore: 20 }));
      store.createContact(createTestContact({ name: 'High Score', relationshipScore: 90 }));
      store.createContact(createTestContact({ name: 'Mid Score', relationshipScore: 50 }));

      const results = store.searchContacts('Score');
      expect(results[0].name).toBe('High Score');
      expect(results[1].name).toBe('Mid Score');
      expect(results[2].name).toBe('Low Score');
    });
  });

  describe('updateContact', () => {
    it('should update contact fields', () => {
      const created = store.createContact(createTestContact());
      const updated = store.updateContact(created.id, {
        name: 'Jane Doe',
        company: 'New Corp',
        relationshipScore: 90,
      });

      expect(updated).not.toBeNull();
      expect(updated!.name).toBe('Jane Doe');
      expect(updated!.company).toBe('New Corp');
      expect(updated!.relationshipScore).toBe(90);
      // Unchanged fields preserved
      expect(updated!.email).toBe('jane@example.com');
    });

    it('should return null for non-existent contact', () => {
      const result = store.updateContact('non-existent', { name: 'Test' });
      expect(result).toBeNull();
    });

    it('should update the updatedAt timestamp', async () => {
      const created = store.createContact(createTestContact());
      // Ensure timestamp difference by waiting 2ms
      await new Promise(resolve => setTimeout(resolve, 2));
      const updated = store.updateContact(created.id, { notes: 'Updated notes' });
      expect(updated!.updatedAt).not.toBe(created.updatedAt);
    });
  });

  describe('deleteContact', () => {
    it('should delete an existing contact', () => {
      const created = store.createContact(createTestContact());
      expect(store.deleteContact(created.id)).toBe(true);
      expect(store.getContact(created.id)).toBeNull();
    });

    it('should return false for non-existent contact', () => {
      expect(store.deleteContact('non-existent')).toBe(false);
    });
  });

  describe('updateRelationshipScore', () => {
    it('should decay score based on days since last contact', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const contact = store.createContact(createTestContact({
        relationshipScore: 80,
        lastContactDate: thirtyDaysAgo.toISOString(),
      }));

      const newScore = store.updateRelationshipScore(contact.id);
      // Score should decay by ~30 points (1 per day)
      expect(newScore).toBe(50);
    });

    it('should not go below 0', () => {
      const sixtyDaysAgo = new Date();
      sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

      const contact = store.createContact(createTestContact({
        relationshipScore: 30,
        lastContactDate: sixtyDaysAgo.toISOString(),
      }));

      const newScore = store.updateRelationshipScore(contact.id);
      expect(newScore).toBeGreaterThanOrEqual(0);
    });

    it('should cap decay at 50 points', () => {
      const hundredDaysAgo = new Date();
      hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);

      const contact = store.createContact(createTestContact({
        relationshipScore: 100,
        lastContactDate: hundredDaysAgo.toISOString(),
      }));

      const newScore = store.updateRelationshipScore(contact.id);
      // Max 50-point decay: 100 - 50 = 50
      expect(newScore).toBe(50);
    });

    it('should return 0 for non-existent contact', () => {
      expect(store.updateRelationshipScore('non-existent')).toBe(0);
    });
  });

  describe('getStaleContacts', () => {
    it('should return contacts with no recent interaction', () => {
      const thirtyOneDaysAgo = new Date();
      thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

      store.createContact(createTestContact({
        name: 'Stale Contact',
        lastContactDate: thirtyOneDaysAgo.toISOString(),
      }));
      store.createContact(createTestContact({
        name: 'Fresh Contact',
        lastContactDate: new Date().toISOString(),
      }));

      const stale = store.getStaleContacts(30);
      expect(stale).toHaveLength(1);
      expect(stale[0].name).toBe('Stale Contact');
    });

    it('should use default 30-day threshold', () => {
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

      store.createContact(createTestContact({
        name: 'Very Stale',
        lastContactDate: fortyDaysAgo.toISOString(),
      }));

      const stale = store.getStaleContacts();
      expect(stale).toHaveLength(1);
    });

    it('should return empty for all-fresh contacts', () => {
      store.createContact(createTestContact({
        lastContactDate: new Date().toISOString(),
      }));

      const stale = store.getStaleContacts(30);
      expect(stale).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('should return correct total count', () => {
      store.createContact(createTestContact({ name: 'A' }));
      store.createContact(createTestContact({ name: 'B' }));
      store.createContact(createTestContact({ name: 'C' }));

      const stats = store.getStats();
      expect(stats.totalContacts).toBe(3);
    });

    it('should break down by category', () => {
      store.createContact(createTestContact({ category: 'client' }));
      store.createContact(createTestContact({ name: 'P1', category: 'prospect' }));
      store.createContact(createTestContact({ name: 'P2', category: 'prospect' }));
      store.createContact(createTestContact({ name: 'Partner', category: 'partner' }));

      const stats = store.getStats();
      expect(stats.byCategory['client']).toBe(1);
      expect(stats.byCategory['prospect']).toBe(2);
      expect(stats.byCategory['partner']).toBe(1);
    });

    it('should count stale contacts', () => {
      const fortyDaysAgo = new Date();
      fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

      store.createContact(createTestContact({
        name: 'Stale',
        lastContactDate: fortyDaysAgo.toISOString(),
      }));
      store.createContact(createTestContact({
        name: 'Fresh',
        lastContactDate: new Date().toISOString(),
      }));

      const stats = store.getStats();
      expect(stats.staleContacts).toBe(1);
    });

    it('should calculate average relationship score', () => {
      store.createContact(createTestContact({ name: 'A', relationshipScore: 80 }));
      store.createContact(createTestContact({ name: 'B', relationshipScore: 60 }));

      const stats = store.getStats();
      expect(stats.avgRelationshipScore).toBe(70);
    });

    it('should handle empty database', () => {
      const stats = store.getStats();
      expect(stats.totalContacts).toBe(0);
      expect(stats.staleContacts).toBe(0);
      expect(stats.avgRelationshipScore).toBe(0);
      expect(Object.keys(stats.byCategory)).toHaveLength(0);
    });
  });
});
