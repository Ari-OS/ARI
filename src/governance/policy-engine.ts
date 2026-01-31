import { createHash, createHmac, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import type { AuditLogger } from '../kernel/audit.js';
import type { EventBus } from '../kernel/event-bus.js';
import type {
  AgentId,
  TrustLevel,
  PermissionTier,
  ToolPolicy,
  ToolCallToken,
  PermissionRequest,
  PermissionCheckResult,
} from '../kernel/types.js';
import { TRUST_SCORES, PermissionTierSchema, TrustLevelSchema, AgentIdSchema } from '../kernel/types.js';

/**
 * Structure of tool-policies.json config file.
 */
interface ToolPoliciesConfig {
  version: string;
  description: string;
  policies: Array<{
    tool_id: string;
    permission_tier: string;
    required_trust_level: string;
    allowed_agents: string[];
    rate_limit?: number;
    description?: string;
  }>;
}

/**
 * Risk multipliers by trust level (from Constitution Article III).
 * Lower multipliers mean less risk amplification.
 */
const RISK_MULTIPLIERS: Record<TrustLevel, number> = {
  system: 0.5,
  operator: 0.6,
  verified: 0.75,
  standard: 1.0,
  untrusted: 1.5,
  hostile: 2.0,
};

/**
 * Base severity scores by permission tier.
 * Higher tiers have higher base severity.
 */
const TIER_SEVERITY: Record<PermissionTier, number> = {
  READ_ONLY: 0.1,
  WRITE_SAFE: 0.3,
  WRITE_DESTRUCTIVE: 0.6,
  ADMIN: 0.9,
};

/**
 * Token TTL in milliseconds (5 minutes as per Constitution).
 */
const TOKEN_TTL_MS = 5 * 60 * 1000;

/**
 * Approval timeout in milliseconds (30 seconds default).
 */
const APPROVAL_TIMEOUT_MS = 30 * 1000;

interface PendingApproval {
  request: PermissionRequest;
  policy: ToolPolicy;
  resolve: (token: ToolCallToken) => void;
  reject: (reason: string) => void;
  timeout: NodeJS.Timeout;
}

/**
 * PolicyEngine - Central authority for permission decisions.
 *
 * Implements the Constitutional separation of powers by handling
 * ONLY permission logic. Does not execute tools or modify tool definitions.
 *
 * Responsibilities:
 * - 3-layer permission checking (agent allowlist, trust level, permission tier)
 * - Risk score calculation with trust multipliers
 * - Approval workflow for WRITE_DESTRUCTIVE and ADMIN operations
 * - ToolCallToken generation with cryptographic signatures
 * - Audit logging for all permission decisions
 *
 * Constitutional Alignment:
 * - Article II Section 2.4.1: PolicyEngine is the Permission Authority
 * - Article IV Section 4.3: Three-Layer Permission Check
 * - Article IV Section 4.4: ToolCallToken specification
 */
export class PolicyEngine {
  private readonly policies = new Map<string, ToolPolicy>();
  private readonly pendingApprovals = new Map<string, PendingApproval>();
  private readonly usedTokens = new Set<string>();

  /** Secret key for token signatures (generated per instance) */
  private readonly signingKey: string;

  constructor(
    private readonly auditLogger: AuditLogger,
    private readonly eventBus: EventBus
  ) {
    // Generate a random signing key for this instance
    this.signingKey = randomUUID() + randomUUID();
  }

  /**
   * Register a tool policy.
   * Defines permission requirements for a tool.
   */
  registerPolicy(policy: ToolPolicy): void {
    this.policies.set(policy.tool_id, policy);

    void this.auditLogger.log('policy:register', 'policy_engine', 'system', {
      tool_id: policy.tool_id,
      permission_tier: policy.permission_tier,
      required_trust_level: policy.required_trust_level,
      allowed_agents: policy.allowed_agents,
    });
  }

  /**
   * Get a registered policy by tool ID.
   */
  getPolicy(toolId: string): ToolPolicy | undefined {
    return this.policies.get(toolId);
  }

  /**
   * Get all registered policies.
   */
  getAllPolicies(): ToolPolicy[] {
    return Array.from(this.policies.values());
  }

  /**
   * Request permission to execute a tool.
   * Returns a ToolCallToken if permission is granted.
   * May block waiting for approval if required.
   *
   * @param toolId - The tool to execute
   * @param agentId - The requesting agent
   * @param parameters - Tool parameters
   * @param trustLevel - The trust level of the request source
   * @returns Promise<ToolCallToken> on success
   * @throws Error if permission denied or approval rejected
   */
  async requestPermission(
    toolId: string,
    agentId: AgentId,
    parameters: Record<string, unknown>,
    trustLevel: TrustLevel
  ): Promise<ToolCallToken> {
    const requestId = randomUUID();

    // Get the policy
    const policy = this.policies.get(toolId);
    if (!policy) {
      await this.auditLogger.log('permission:denied', agentId, trustLevel, {
        request_id: requestId,
        tool_id: toolId,
        reason: 'Policy not found',
      });
      throw new Error(`No policy found for tool: ${toolId}`);
    }

    // Perform 3-layer permission check
    const checkResult = this.checkPermissions(agentId, trustLevel, policy);

    // Log the permission check
    await this.auditLogger.log(
      checkResult.allowed ? 'permission:checked' : 'permission:denied',
      agentId,
      trustLevel,
      {
        request_id: requestId,
        tool_id: toolId,
        check_result: checkResult,
      }
    );

    // If not allowed at all, throw
    if (!checkResult.allowed) {
      this.eventBus.emit('permission:denied', {
        requestId,
        toolId,
        agentId,
        reason: checkResult.reason,
        violations: checkResult.violations,
      });
      throw new Error(`Permission denied: ${checkResult.reason}`);
    }

    // If approval required, enter approval workflow
    if (checkResult.requires_approval) {
      return this.requestApproval(requestId, toolId, agentId, parameters, trustLevel, policy);
    }

    // Auto-approved - generate token immediately
    const token = this.generateToken(
      toolId,
      agentId,
      parameters,
      trustLevel,
      policy.permission_tier,
      null, // No approver for auto-approved
      'Auto-approved: meets trust and tier requirements'
    );

    await this.auditLogger.log('permission:granted', agentId, trustLevel, {
      request_id: requestId,
      tool_id: toolId,
      token_id: token.token_id,
      auto_approved: true,
    });

    this.eventBus.emit('permission:granted', {
      requestId,
      toolId,
      agentId,
      tokenId: token.token_id,
      autoApproved: true,
    });

    return token;
  }

  /**
   * Perform the 3-layer permission check.
   *
   * Layer 1: Agent Allowlist - Is this agent authorized?
   * Layer 2: Trust Level - Does source meet minimum trust?
   * Layer 3: Permission Tier - Is approval required?
   */
  checkPermissions(
    agentId: AgentId,
    trustLevel: TrustLevel,
    policy: ToolPolicy
  ): PermissionCheckResult {
    const violations: string[] = [];
    let allowed = true;

    // Layer 1: Agent Allowlist
    if (policy.allowed_agents.length > 0 && !policy.allowed_agents.includes(agentId)) {
      allowed = false;
      violations.push(`Agent ${agentId} not in tool allowlist`);
    }

    // Layer 2: Trust Level Threshold
    const requiredTrustScore = TRUST_SCORES[policy.required_trust_level];
    const actualTrustScore = TRUST_SCORES[trustLevel];
    if (actualTrustScore < requiredTrustScore) {
      allowed = false;
      violations.push(
        `Trust level ${trustLevel} (${actualTrustScore}) insufficient, requires ${policy.required_trust_level} (${requiredTrustScore})`
      );
    }

    // Calculate risk score
    const riskScore = this.calculateRiskScore(trustLevel, policy.permission_tier);

    // Layer 3: Permission Tier Gating
    const requiresApproval = this.requiresApproval(policy.permission_tier);

    // Auto-block at high risk
    if (riskScore >= 0.8) {
      allowed = false;
      violations.push(`Risk score ${riskScore.toFixed(2)} exceeds auto-block threshold (0.8)`);
    }

    return {
      allowed,
      requires_approval: allowed && requiresApproval,
      reason: allowed
        ? requiresApproval
          ? 'Requires approval due to permission tier'
          : 'Permission granted'
        : violations.join('; '),
      risk_score: riskScore,
      violations,
    };
  }

  /**
   * Calculate risk score based on trust level and permission tier.
   * Risk Score = Base Severity × Trust Multiplier
   */
  private calculateRiskScore(trustLevel: TrustLevel, permissionTier: PermissionTier): number {
    const baseSeverity = TIER_SEVERITY[permissionTier];
    const multiplier = RISK_MULTIPLIERS[trustLevel];
    return Math.min(1.0, baseSeverity * multiplier);
  }

  /**
   * Determine if permission tier requires explicit approval.
   * WRITE_DESTRUCTIVE and ADMIN require approval.
   */
  private requiresApproval(tier: PermissionTier): boolean {
    return tier === 'WRITE_DESTRUCTIVE' || tier === 'ADMIN';
  }

  /**
   * Enter the approval workflow for operations requiring explicit approval.
   */
  private async requestApproval(
    requestId: string,
    toolId: string,
    agentId: AgentId,
    parameters: Record<string, unknown>,
    trustLevel: TrustLevel,
    policy: ToolPolicy
  ): Promise<ToolCallToken> {
    const request: PermissionRequest = {
      request_id: requestId,
      tool_id: toolId,
      agent_id: agentId,
      parameters,
      trust_level: trustLevel,
      requested_at: new Date().toISOString(),
      status: 'PENDING',
      resolved_at: null,
      resolved_by: null,
      rejection_reason: null,
    };

    await this.auditLogger.log('permission:approval_required', agentId, trustLevel, {
      request_id: requestId,
      tool_id: toolId,
      permission_tier: policy.permission_tier,
    });

    this.eventBus.emit('permission:approval_required', {
      requestId,
      toolId,
      agentId,
      parameters,
      permissionTier: policy.permission_tier,
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingApprovals.delete(requestId);
        request.status = 'EXPIRED';
        request.resolved_at = new Date().toISOString();

        void this.auditLogger.log('permission:expired', agentId, trustLevel, {
          request_id: requestId,
          tool_id: toolId,
        });

        this.eventBus.emit('permission:expired', { requestId, toolId, agentId });

        reject(new Error('Approval request expired'));
      }, APPROVAL_TIMEOUT_MS);

      this.pendingApprovals.set(requestId, {
        request,
        policy,
        resolve,
        reject,
        timeout,
      });
    });
  }

  /**
   * Approve a pending permission request.
   *
   * @param requestId - The request to approve
   * @param approver - The agent approving (must be arbiter, overseer, or operator)
   * @param reasoning - Reason for approval
   */
  async approve(
    requestId: string,
    approver: AgentId,
    reasoning: string
  ): Promise<void> {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) {
      throw new Error(`No pending approval for request ${requestId}`);
    }

    // Verify approver authorization
    const authorizedApprovers: AgentId[] = ['arbiter', 'overseer'];
    if (!authorizedApprovers.includes(approver)) {
      throw new Error(`Agent ${approver} is not authorized to approve permissions`);
    }

    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(requestId);

    const { request, policy } = pending;
    request.status = 'APPROVED';
    request.resolved_at = new Date().toISOString();
    request.resolved_by = approver;

    // Generate the token
    const token = this.generateToken(
      request.tool_id,
      request.agent_id,
      request.parameters,
      request.trust_level,
      policy.permission_tier,
      approver,
      reasoning
    );

    await this.auditLogger.log('permission:approved', approver, 'system', {
      request_id: requestId,
      tool_id: request.tool_id,
      requesting_agent: request.agent_id,
      token_id: token.token_id,
      reasoning,
    });

    this.eventBus.emit('permission:approved', {
      requestId,
      toolId: request.tool_id,
      agentId: request.agent_id,
      tokenId: token.token_id,
      approver,
    });

    pending.resolve(token);
  }

  /**
   * Reject a pending permission request.
   *
   * @param requestId - The request to reject
   * @param rejector - The agent rejecting
   * @param reason - Reason for rejection
   */
  async reject(
    requestId: string,
    rejector: AgentId,
    reason: string
  ): Promise<void> {
    const pending = this.pendingApprovals.get(requestId);
    if (!pending) {
      throw new Error(`No pending approval for request ${requestId}`);
    }

    clearTimeout(pending.timeout);
    this.pendingApprovals.delete(requestId);

    const { request } = pending;
    request.status = 'REJECTED';
    request.resolved_at = new Date().toISOString();
    request.resolved_by = rejector;
    request.rejection_reason = reason;

    await this.auditLogger.log('permission:rejected', rejector, 'system', {
      request_id: requestId,
      tool_id: request.tool_id,
      requesting_agent: request.agent_id,
      reason,
    });

    this.eventBus.emit('permission:rejected', {
      requestId,
      toolId: request.tool_id,
      agentId: request.agent_id,
      rejector,
      reason,
    });

    pending.reject(reason);
  }

  /**
   * Get pending approval requests.
   */
  getPendingApprovals(): PermissionRequest[] {
    return Array.from(this.pendingApprovals.values()).map((p) => p.request);
  }

  /**
   * Generate a ToolCallToken with cryptographic signature.
   */
  private generateToken(
    toolId: string,
    agentId: AgentId,
    parameters: Record<string, unknown>,
    trustLevel: TrustLevel,
    permissionTier: PermissionTier,
    approvedBy: AgentId | null,
    approvalReasoning: string
  ): ToolCallToken {
    const tokenId = randomUUID();
    const now = new Date();
    const issuedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + TOKEN_TTL_MS).toISOString();

    // Hash parameters for binding
    const parametersHash = this.hashParameters(parameters);

    // Generate signature
    const signature = this.signToken(
      tokenId,
      toolId,
      agentId,
      parametersHash,
      issuedAt,
      expiresAt
    );

    return {
      token_id: tokenId,
      tool_id: toolId,
      agent_id: agentId,
      parameters,
      parameters_hash: parametersHash,
      permission_tier: permissionTier,
      trust_level: trustLevel,
      approved_by: approvedBy,
      approval_reasoning: approvalReasoning,
      issued_at: issuedAt,
      expires_at: expiresAt,
      signature,
      used: false,
    };
  }

  /**
   * Verify a ToolCallToken for execution.
   *
   * Checks:
   * - Signature validity
   * - Token not expired
   * - Token not already used
   * - Parameters match hash
   *
   * @param token - The token to verify
   * @param parameters - The parameters being executed with
   * @returns True if token is valid for execution
   */
  verifyToken(token: ToolCallToken, parameters: Record<string, unknown>): boolean {
    // Check if already used
    if (token.used || this.usedTokens.has(token.token_id)) {
      return false;
    }

    // Check expiration
    if (new Date(token.expires_at) < new Date()) {
      return false;
    }

    // Verify parameters match
    const currentHash = this.hashParameters(parameters);
    if (currentHash !== token.parameters_hash) {
      return false;
    }

    // Verify signature
    const expectedSignature = this.signToken(
      token.token_id,
      token.tool_id,
      token.agent_id,
      token.parameters_hash,
      token.issued_at,
      token.expires_at
    );

    return token.signature === expectedSignature;
  }

  /**
   * Mark a token as used (single-use enforcement).
   */
  markTokenUsed(tokenId: string): void {
    this.usedTokens.add(tokenId);
  }

  /**
   * Hash parameters using SHA-256.
   */
  private hashParameters(parameters: Record<string, unknown>): string {
    const json = JSON.stringify(parameters, Object.keys(parameters).sort());
    return createHash('sha256').update(json).digest('hex');
  }

  /**
   * Sign token data using HMAC-SHA256.
   */
  private signToken(
    tokenId: string,
    toolId: string,
    agentId: string,
    parametersHash: string,
    issuedAt: string,
    expiresAt: string
  ): string {
    const data = `${tokenId}:${toolId}:${agentId}:${parametersHash}:${issuedAt}:${expiresAt}`;
    return createHmac('sha256', this.signingKey).update(data).digest('hex');
  }

  /**
   * Load tool policies from a JSON config file.
   *
   * @param configPath - Path to tool-policies.json
   * @returns Number of policies loaded
   */
  loadPoliciesFromConfig(configPath: string): number {
    const content = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as ToolPoliciesConfig;

    let loaded = 0;
    for (const policyData of config.policies) {
      // Validate and transform the policy data
      const policy: ToolPolicy = {
        tool_id: policyData.tool_id,
        permission_tier: PermissionTierSchema.parse(policyData.permission_tier),
        required_trust_level: TrustLevelSchema.parse(policyData.required_trust_level),
        allowed_agents: policyData.allowed_agents.map((a) => AgentIdSchema.parse(a)),
        rate_limit: policyData.rate_limit,
      };

      this.registerPolicy(policy);
      loaded++;
    }

    void this.auditLogger.log('policy:config_loaded', 'policy_engine', 'system', {
      config_path: configPath,
      config_version: config.version,
      policies_loaded: loaded,
    });

    return loaded;
  }
}
