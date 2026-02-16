import { describe, it, expect } from 'vitest';
import {
  generateDiagram,
  getAvailableTypes,
} from '../../../src/skills/diagram-generator.js';

describe('DiagramGenerator', () => {
  describe('getAvailableTypes', () => {
    it('should return all diagram types including all', () => {
      const types = getAvailableTypes();
      expect(types).toContain('layers');
      expect(types).toContain('scheduler');
      expect(types).toContain('notifications');
      expect(types).toContain('data-flow');
      expect(types).toContain('eventbus');
      expect(types).toContain('all');
    });

    it('should return 6 types total', () => {
      expect(getAvailableTypes()).toHaveLength(6);
    });
  });

  describe('generateDiagram', () => {
    it('should generate layers diagram', () => {
      const results = generateDiagram('layers');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('layers');
      expect(results[0].title).toBe('ARI 7-Layer Architecture');
      expect(results[0].mermaid).toContain('graph TB');
      expect(results[0].mermaid).toContain('Layer 0: COGNITIVE');
      expect(results[0].mermaid).toContain('Layer 1: KERNEL');
      expect(results[0].mermaid).toContain('Layer 6: INTERFACES');
      expect(results[0].mermaid).toContain('EventBus');
    });

    it('should generate scheduler diagram', () => {
      const results = generateDiagram('scheduler');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('scheduler');
      expect(results[0].mermaid).toContain('gantt');
      expect(results[0].mermaid).toContain('Morning Briefing');
      expect(results[0].mermaid).toContain('Evening Summary');
      expect(results[0].mermaid).toContain('Essential');
      expect(results[0].mermaid).toContain('Investment');
    });

    it('should generate notifications diagram', () => {
      const results = generateDiagram('notifications');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('notifications');
      expect(results[0].mermaid).toContain('flowchart TD');
      expect(results[0].mermaid).toContain('Notification Router');
      expect(results[0].mermaid).toContain('Telegram');
      expect(results[0].mermaid).toContain('Cooldown Check');
      expect(results[0].mermaid).toContain('Quiet Hours');
    });

    it('should generate data-flow diagram', () => {
      const results = generateDiagram('data-flow');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('data-flow');
      expect(results[0].mermaid).toContain('flowchart LR');
      expect(results[0].mermaid).toContain('Data Sources');
      expect(results[0].mermaid).toContain('Delivery Layer');
      expect(results[0].mermaid).toContain('Intelligence');
    });

    it('should generate eventbus diagram', () => {
      const results = generateDiagram('eventbus');
      expect(results).toHaveLength(1);
      expect(results[0].type).toBe('eventbus');
      expect(results[0].mermaid).toContain('flowchart TD');
      expect(results[0].mermaid).toContain('EventBus');
      expect(results[0].mermaid).toContain('message:received');
      expect(results[0].mermaid).toContain('L1 Kernel');
      expect(results[0].mermaid).toContain('L3 Agents');
      expect(results[0].mermaid).toContain('L4 Strategic');
    });

    it('should generate all diagrams when type is all', () => {
      const results = generateDiagram('all');
      expect(results).toHaveLength(5);
      const types = results.map((r) => r.type);
      expect(types).toContain('layers');
      expect(types).toContain('scheduler');
      expect(types).toContain('notifications');
      expect(types).toContain('data-flow');
      expect(types).toContain('eventbus');
    });

    it('should throw for unknown diagram type', () => {
      expect(() => generateDiagram('invalid' as 'layers')).toThrow('Unknown diagram type: invalid');
    });

    it('should produce valid mermaid for all types', () => {
      const results = generateDiagram('all');
      for (const result of results) {
        // All diagrams should start with a valid mermaid directive
        const firstLine = result.mermaid.trim().split('\n')[0];
        expect(
          firstLine.startsWith('graph') ||
          firstLine.startsWith('flowchart') ||
          firstLine.startsWith('gantt') ||
          firstLine.startsWith('sequenceDiagram'),
        ).toBe(true);
      }
    });
  });

  describe('diagram content quality', () => {
    it('should include all 7 layers in layers diagram', () => {
      const [diagram] = generateDiagram('layers');
      for (const layer of ['Layer 0', 'Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5', 'Layer 6']) {
        expect(diagram.mermaid).toContain(layer);
      }
    });

    it('should include key components in layers diagram', () => {
      const [diagram] = generateDiagram('layers');
      for (const component of ['Gateway', 'Sanitizer', 'EventBus', 'Guardian', 'Council', 'Scheduler']) {
        expect(diagram.mermaid).toContain(component);
      }
    });

    it('should include essential tasks in scheduler diagram', () => {
      const [diagram] = generateDiagram('scheduler');
      for (const task of ['Morning Briefing', 'Evening Summary', 'Intelligence Scan', 'Health Check']) {
        expect(diagram.mermaid).toContain(task);
      }
    });

    it('should include delivery channels in notifications diagram', () => {
      const [diagram] = generateDiagram('notifications');
      expect(diagram.mermaid).toContain('Telegram');
      expect(diagram.mermaid).toContain('Notion');
      expect(diagram.mermaid).toContain('Briefing');
    });

    it('should include data sources in data-flow diagram', () => {
      const [diagram] = generateDiagram('data-flow');
      for (const source of ['Anthropic', 'Yahoo Finance', 'CoinGecko', 'Hacker News']) {
        expect(diagram.mermaid).toContain(source);
      }
    });

    it('should show cross-layer communication in eventbus diagram', () => {
      const [diagram] = generateDiagram('eventbus');
      expect(diagram.mermaid).toContain('message:received');
      expect(diagram.mermaid).toContain('security:alert');
      expect(diagram.mermaid).toContain('scheduler:task_');
    });
  });
});
