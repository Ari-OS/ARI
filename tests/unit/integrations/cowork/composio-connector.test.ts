/**
 * Composio Connector Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ComposioConnector,
  convertToARITools,
  COMPOSIO_APPS,
  type ComposioTool,
  type ComposioApp,
} from '../../../../src/integrations/cowork/composio-connector.js';

describe('ComposioConnector', () => {
  let connector: ComposioConnector;

  beforeEach(() => {
    connector = new ComposioConnector({
      apiKey: 'test-key',
      rateLimitPerMinute: 10,
    });
  });

  describe('App Management', () => {
    it('should register an app', () => {
      const app: ComposioApp = {
        id: 'gmail',
        name: 'Gmail',
        description: 'Email service',
        tools: ['send_email'],
        authType: 'oauth2',
        isConnected: true,
      };

      connector.registerApp(app);
      const apps = connector.getConnectedApps();

      expect(apps).toHaveLength(1);
      expect(apps[0].id).toBe('gmail');
    });

    it('should block apps in blocklist', () => {
      const app: ComposioApp = {
        id: 'shell',
        name: 'Shell',
        description: 'Shell access',
        tools: ['execute'],
        authType: 'none',
        isConnected: true,
      };

      expect(() => connector.registerApp(app)).toThrow('blocked by security policy');
    });

    it('should enforce allowlist when configured', () => {
      const restrictedConnector = new ComposioConnector({
        apiKey: 'test-key',
        allowedApps: ['gmail'],
      });

      const slackApp: ComposioApp = {
        id: 'slack',
        name: 'Slack',
        description: 'Messaging',
        tools: ['send'],
        authType: 'oauth2',
        isConnected: true,
      };

      expect(() => restrictedConnector.registerApp(slackApp)).toThrow('not in the allowed list');
    });
  });

  describe('Tool Management', () => {
    beforeEach(() => {
      connector.registerApp({
        id: 'gmail',
        name: 'Gmail',
        description: 'Email',
        tools: [],
        authType: 'oauth2',
        isConnected: true,
      });
    });

    it('should register a tool', () => {
      const tool: ComposioTool = {
        id: 'send_email',
        name: 'Send Email',
        app: 'gmail',
        description: 'Send an email',
        parameters: {
          to: { type: 'string', description: 'Recipient', required: true },
          subject: { type: 'string', description: 'Subject', required: true },
          body: { type: 'string', description: 'Body', required: true },
        },
        category: 'write',
      };

      connector.registerTool(tool);
      const tools = connector.getTools();

      expect(tools).toHaveLength(1);
      expect(tools[0].id).toBe('send_email');
    });

    it('should require app to be registered first', () => {
      const tool: ComposioTool = {
        id: 'unknown_tool',
        name: 'Unknown',
        app: 'unknown_app',
        description: 'Test',
        parameters: {},
        category: 'read',
      };

      expect(() => connector.registerTool(tool)).toThrow('not connected');
    });

    it('should get tools by app', () => {
      connector.registerApp({
        id: 'slack',
        name: 'Slack',
        description: 'Messaging',
        tools: [],
        authType: 'oauth2',
        isConnected: true,
      });

      connector.registerTool({
        id: 'gmail_send',
        name: 'Send',
        app: 'gmail',
        description: 'Send email',
        parameters: {},
        category: 'write',
      });

      connector.registerTool({
        id: 'slack_send',
        name: 'Send',
        app: 'slack',
        description: 'Send message',
        parameters: {},
        category: 'write',
      });

      const gmailTools = connector.getToolsByApp('gmail');
      expect(gmailTools).toHaveLength(1);
      expect(gmailTools[0].id).toBe('gmail_send');
    });
  });

  describe('Tool Execution', () => {
    beforeEach(() => {
      connector.registerApp({
        id: 'gmail',
        name: 'Gmail',
        description: 'Email',
        tools: [],
        authType: 'oauth2',
        isConnected: true,
      });

      connector.registerTool({
        id: 'send_email',
        name: 'Send Email',
        app: 'gmail',
        description: 'Send an email',
        parameters: {
          to: { type: 'string', description: 'Recipient', required: true },
        },
        category: 'write',
      });
    });

    it('should execute a tool successfully', async () => {
      const result = await connector.execute({
        toolId: 'send_email',
        parameters: { to: 'test@example.com' },
        requestedBy: 'executor',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.toolId).toBe('send_email');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(result.hash).toBeDefined();
    });

    it('should fail for unknown tool', async () => {
      const result = await connector.execute({
        toolId: 'unknown_tool',
        parameters: {},
        requestedBy: 'executor',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('should enforce rate limiting', async () => {
      const limitedConnector = new ComposioConnector({
        apiKey: 'test-key',
        rateLimitPerMinute: 2,
      });

      limitedConnector.registerApp({
        id: 'gmail',
        name: 'Gmail',
        description: 'Email',
        tools: [],
        authType: 'oauth2',
        isConnected: true,
      });

      limitedConnector.registerTool({
        id: 'send_email',
        name: 'Send',
        app: 'gmail',
        description: 'Send',
        parameters: {},
        category: 'write',
      });

      // First two should succeed
      await limitedConnector.execute({
        toolId: 'send_email',
        parameters: {},
        requestedBy: 'executor',
        timestamp: new Date().toISOString(),
      });

      await limitedConnector.execute({
        toolId: 'send_email',
        parameters: {},
        requestedBy: 'executor',
        timestamp: new Date().toISOString(),
      });

      // Third should be rate limited
      const result = await limitedConnector.execute({
        toolId: 'send_email',
        parameters: {},
        requestedBy: 'executor',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded');
    });

    it('should emit events for destructive actions', async () => {
      connector.registerTool({
        id: 'delete_all',
        name: 'Delete All',
        app: 'gmail',
        description: 'Delete all emails',
        parameters: {},
        category: 'destructive',
      });

      const eventSpy = vi.fn();
      connector.on('composio:destructive_action', eventSpy);

      await connector.execute({
        toolId: 'delete_all',
        parameters: {},
        requestedBy: 'executor',
        timestamp: new Date().toISOString(),
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          toolId: 'delete_all',
          requestedBy: 'executor',
        })
      );
    });
  });

  describe('Statistics', () => {
    it('should track statistics', () => {
      connector.registerApp({
        id: 'gmail',
        name: 'Gmail',
        description: 'Email',
        tools: [],
        authType: 'oauth2',
        isConnected: true,
      });

      connector.registerTool({
        id: 'read_email',
        name: 'Read',
        app: 'gmail',
        description: 'Read emails',
        parameters: {},
        category: 'read',
      });

      connector.registerTool({
        id: 'send_email',
        name: 'Send',
        app: 'gmail',
        description: 'Send email',
        parameters: {},
        category: 'write',
      });

      const stats = connector.getStats();

      expect(stats.connectedApps).toBe(1);
      expect(stats.registeredTools).toBe(2);
      expect(stats.toolsByCategory.read).toBe(1);
      expect(stats.toolsByCategory.write).toBe(1);
    });
  });
});

describe('convertToARITools', () => {
  it('should convert Composio tools to ARI format', () => {
    const connector = new ComposioConnector({ apiKey: 'test' });

    connector.registerApp({
      id: 'gmail',
      name: 'Gmail',
      description: 'Email',
      tools: [],
      authType: 'oauth2',
      isConnected: true,
    });

    connector.registerTool({
      id: 'send_email',
      name: 'Send Email',
      app: 'gmail',
      description: 'Send an email',
      parameters: {},
      category: 'write',
    });

    connector.registerTool({
      id: 'delete_email',
      name: 'Delete Email',
      app: 'gmail',
      description: 'Delete an email',
      parameters: {},
      category: 'destructive',
    });

    const ariTools = convertToARITools(connector);

    expect(ariTools).toHaveLength(2);
    expect(ariTools[0].id).toBe('composio:send_email');
    expect(ariTools[0].permission_tier).toBe('WRITE_SAFE');
    expect(ariTools[1].permission_tier).toBe('WRITE_DESTRUCTIVE');
    expect(ariTools[0].required_trust_level).toBe('verified');
  });
});

describe('COMPOSIO_APPS', () => {
  it('should have common app definitions', () => {
    expect(COMPOSIO_APPS.gmail).toBeDefined();
    expect(COMPOSIO_APPS.slack).toBeDefined();
    expect(COMPOSIO_APPS.github).toBeDefined();
    expect(COMPOSIO_APPS.notion).toBeDefined();
  });

  it('should have proper auth types', () => {
    expect(COMPOSIO_APPS.gmail.authType).toBe('oauth2');
    expect(COMPOSIO_APPS.stripe.authType).toBe('api_key');
  });
});
