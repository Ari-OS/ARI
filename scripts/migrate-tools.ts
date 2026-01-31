#!/usr/bin/env npx tsx
/**
 * Tool Migration Script
 *
 * Migrates ToolDefinition objects (old format with mixed capability + policy)
 * into separate capability and policy JSON files for the new separation of powers architecture.
 *
 * Usage:
 *   npx tsx scripts/migrate-tools.ts
 *
 * This script:
 * 1. Reads tool definitions from a source (Executor's built-in tools)
 * 2. Splits them into capabilities (technical) and policies (permission)
 * 3. Writes to config/tool-capabilities.json and config/tool-policies.json
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { ToolDefinition, ToolCapability, ToolPolicy } from '../src/kernel/types.js';

interface ToolCapabilitiesConfig {
  $schema: string;
  version: string;
  description: string;
  tools: ToolCapability[];
}

interface ToolPoliciesConfig {
  $schema: string;
  version: string;
  description: string;
  policies: Array<ToolPolicy & { description?: string }>;
}

/**
 * Extract capability from ToolDefinition.
 */
function extractCapability(tool: ToolDefinition): ToolCapability {
  return {
    id: tool.id,
    name: tool.name,
    description: tool.description,
    timeout_ms: tool.timeout_ms,
    sandboxed: tool.sandboxed,
    parameters: tool.parameters,
  };
}

/**
 * Extract policy from ToolDefinition.
 */
function extractPolicy(tool: ToolDefinition): ToolPolicy {
  return {
    tool_id: tool.id,
    permission_tier: tool.permission_tier,
    required_trust_level: tool.required_trust_level,
    allowed_agents: tool.allowed_agents,
  };
}

/**
 * Migrate an array of ToolDefinitions to capability + policy configs.
 */
function migrateTools(tools: ToolDefinition[]): {
  capabilities: ToolCapabilitiesConfig;
  policies: ToolPoliciesConfig;
} {
  const capabilities: ToolCapabilitiesConfig = {
    $schema: './schemas/tool-capabilities.schema.json',
    version: '1.0.0',
    description: "Tool capability definitions for ARI's ToolRegistry. Contains technical details only, no permission logic.",
    tools: tools.map(extractCapability),
  };

  const policies: ToolPoliciesConfig = {
    $schema: './schemas/tool-policies.schema.json',
    version: '1.0.0',
    description: "Tool permission policies for ARI's PolicyEngine. Defines who can use each tool and under what conditions.",
    policies: tools.map((tool) => ({
      ...extractPolicy(tool),
      description: `Policy for ${tool.name}`,
    })),
  };

  return { capabilities, policies };
}

/**
 * The 4 built-in tools from Executor.registerBuiltInTools()
 */
const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    id: 'file_read',
    name: 'Read File',
    description: 'Read contents of a file from the filesystem',
    permission_tier: 'READ_ONLY',
    required_trust_level: 'standard',
    allowed_agents: [],
    timeout_ms: 5000,
    sandboxed: true,
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute file path to read' },
    },
  },
  {
    id: 'file_write',
    name: 'Write File',
    description: 'Write contents to a file on the filesystem',
    permission_tier: 'WRITE_SAFE',
    required_trust_level: 'verified',
    allowed_agents: [],
    timeout_ms: 10000,
    sandboxed: true,
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute file path to write' },
      content: { type: 'string', required: true, description: 'Content to write to the file' },
    },
  },
  {
    id: 'file_delete',
    name: 'Delete File',
    description: 'Delete a file from the filesystem (destructive operation)',
    permission_tier: 'WRITE_DESTRUCTIVE',
    required_trust_level: 'operator',
    allowed_agents: [],
    timeout_ms: 5000,
    sandboxed: true,
    parameters: {
      path: { type: 'string', required: true, description: 'Absolute file path to delete' },
    },
  },
  {
    id: 'system_config',
    name: 'System Configuration',
    description: 'Modify ARI system configuration (administrative operation)',
    permission_tier: 'ADMIN',
    required_trust_level: 'system',
    allowed_agents: ['core', 'overseer'],
    timeout_ms: 3000,
    sandboxed: false,
    parameters: {
      key: { type: 'string', required: true, description: 'Configuration key to modify' },
      value: { type: 'string', required: true, description: 'New value for the configuration key' },
    },
  },
];

/**
 * Main migration function.
 */
function main(): void {
  const configDir = join(process.cwd(), 'config');

  console.log('🔧 Tool Migration Script');
  console.log('========================\n');

  console.log(`Migrating ${BUILT_IN_TOOLS.length} built-in tools...`);

  const { capabilities, policies } = migrateTools(BUILT_IN_TOOLS);

  // Write capabilities
  const capabilitiesPath = join(configDir, 'tool-capabilities.json');
  writeFileSync(capabilitiesPath, JSON.stringify(capabilities, null, 2) + '\n');
  console.log(`✅ Written: ${capabilitiesPath}`);
  console.log(`   - ${capabilities.tools.length} tool capabilities`);

  // Write policies
  const policiesPath = join(configDir, 'tool-policies.json');
  writeFileSync(policiesPath, JSON.stringify(policies, null, 2) + '\n');
  console.log(`✅ Written: ${policiesPath}`);
  console.log(`   - ${policies.policies.length} tool policies`);

  console.log('\n📊 Migration Summary:');
  console.log('─────────────────────');
  for (const tool of BUILT_IN_TOOLS) {
    console.log(`  ${tool.id}:`);
    console.log(`    Capability: ${tool.name} (timeout: ${tool.timeout_ms}ms, sandboxed: ${tool.sandboxed})`);
    console.log(`    Policy: ${tool.permission_tier} (trust: ${tool.required_trust_level})`);
  }

  console.log('\n✨ Migration complete!');
  console.log('\nNext steps:');
  console.log('1. Review the generated JSON files');
  console.log('2. Use ToolRegistry.loadCapabilitiesFromConfig() to load capabilities');
  console.log('3. Use PolicyEngine.loadPoliciesFromConfig() to load policies');
  console.log('4. Register handlers using ToolRegistry.registerHandler()');
}

// Run if executed directly
main();
