#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# ARI V12.0 Setup & Validation Scripts
# ═══════════════════════════════════════════════════════════════

# This file contains reference scripts for ARI V12.0 deployment.
# Copy individual functions as needed.

# ═══════════════════════════════════════════════════════════════
# SETUP SCRIPT
# ═══════════════════════════════════════════════════════════════

setup_ari() {
    echo "🖤 ARI V12.0 Setup"
    echo "═══════════════════════════════════════"
    
    # Check prerequisites
    echo "Checking prerequisites..."
    command -v git >/dev/null 2>&1 || { echo "❌ Git required"; exit 1; }
    echo "✅ Git available"
    
    # Clone repository
    if [ ! -d "ari-v11" ]; then
        echo "Cloning repository..."
        git clone https://github.com/PryceHedrick/ari-v11.git
    fi
    
    cd ari-v11
    
    # Checkout V12.0 branch
    echo "Checking out V12.0..."
    git checkout v12.0-aurora-protocol 2>/dev/null || git checkout -b v12.0-aurora-protocol
    
    # Verify structure
    echo "Verifying structure..."
    required_files=(
        "SYSTEM/CORE.md"
        "SYSTEM/ROUTER.md"
        "SYSTEM/EXECUTOR.md"
        "GOVERNANCE/ARBITER.md"
        "CONFIG/tool_registry.json"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$file" ]; then
            echo "  ✅ $file"
        else
            echo "  ❌ $file missing"
        fi
    done
    
    echo ""
    echo "✅ Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Create Claude Project at claude.ai"
    echo "2. Upload files from SYSTEM/ and GOVERNANCE/ to knowledge base"
    echo "3. Start conversation to verify activation"
}

# ═══════════════════════════════════════════════════════════════
# VALIDATION SCRIPT
# ═══════════════════════════════════════════════════════════════

validate_universality() {
    echo "🔍 Validating Universality..."
    echo "═══════════════════════════════════════"
    
    # Check for business content in kernel
    echo "Scanning SYSTEM/ for business references..."
    
    business_terms=("Pryceless" "Solutions" "pryceless" "750" "1800" "3500")
    found=0
    
    for term in "${business_terms[@]}"; do
        if grep -r "$term" SYSTEM/ 2>/dev/null | grep -v ".git"; then
            echo "❌ Found '$term' in SYSTEM/"
            found=1
        fi
    done
    
    if [ $found -eq 0 ]; then
        echo "✅ No business content in kernel"
    else
        echo "❌ Business content found in kernel - FAIL"
        return 1
    fi
    
    # Verify context packs exist
    echo ""
    echo "Checking context packs..."
    if [ -f "CONTEXTS/ventures/pryceless_solutions.md" ]; then
        echo "✅ Venture context exists"
    else
        echo "❌ Venture context missing"
    fi
    
    echo ""
    echo "✅ Universality validation complete"
}

validate_security() {
    echo "🔒 Validating Security Configuration..."
    echo "═══════════════════════════════════════"
    
    # Check tool registry
    echo "Checking tool registry..."
    if [ -f "CONFIG/tool_registry.json" ]; then
        if grep -q '"default_action": "DENY"' CONFIG/tool_registry.json; then
            echo "✅ Tool registry deny-by-default"
        else
            echo "❌ Tool registry not deny-by-default"
        fi
    else
        echo "❌ Tool registry missing"
    fi
    
    # Check memory schema
    echo "Checking memory schema..."
    if [ -f "SCHEMAS/memory_entry.json" ]; then
        if grep -q "quarantine_status" SCHEMAS/memory_entry.json; then
            echo "✅ Memory schema has quarantine"
        else
            echo "❌ Memory schema missing quarantine"
        fi
    else
        echo "❌ Memory schema missing"
    fi
    
    # Check event schema
    echo "Checking event schema..."
    if [ -f "SCHEMAS/event.json" ]; then
        if grep -q "previous_hash" SCHEMAS/event.json; then
            echo "✅ Event schema has hash chaining"
        else
            echo "❌ Event schema missing hash chain"
        fi
    else
        echo "❌ Event schema missing"
    fi
    
    echo ""
    echo "✅ Security validation complete"
}

validate_governance() {
    echo "🏛️ Validating Governance..."
    echo "═══════════════════════════════════════"
    
    # Check governance files
    governance_files=(
        "GOVERNANCE/ARBITER.md"
        "GOVERNANCE/OVERSEER.md"
        "GOVERNANCE/GOVERNANCE.md"
    )
    
    for file in "${governance_files[@]}"; do
        if [ -f "$file" ]; then
            echo "✅ $file exists"
        else
            echo "❌ $file missing"
        fi
    done
    
    echo ""
    echo "✅ Governance validation complete"
}

run_all_validations() {
    echo "═══════════════════════════════════════════════════════════════"
    echo "        ARI V12.0 FULL VALIDATION SUITE"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""
    
    validate_universality
    echo ""
    validate_security
    echo ""
    validate_governance
    
    echo ""
    echo "═══════════════════════════════════════════════════════════════"
    echo "        VALIDATION COMPLETE"
    echo "═══════════════════════════════════════════════════════════════"
}

# ═══════════════════════════════════════════════════════════════
# HEALTH CHECK
# ═══════════════════════════════════════════════════════════════

health_check() {
    echo "💓 ARI V12.0 Health Check"
    echo "═══════════════════════════════════════"
    
    # Count files
    system_files=$(find SYSTEM/ -name "*.md" 2>/dev/null | wc -l)
    governance_files=$(find GOVERNANCE/ -name "*.md" 2>/dev/null | wc -l)
    context_files=$(find CONTEXTS/ -name "*.md" 2>/dev/null | wc -l)
    config_files=$(find CONFIG/ -name "*.json" 2>/dev/null | wc -l)
    schema_files=$(find SCHEMAS/ -name "*.json" 2>/dev/null | wc -l)
    
    echo "System prompts:    $system_files"
    echo "Governance docs:   $governance_files"
    echo "Context packs:     $context_files"
    echo "Config files:      $config_files"
    echo "Schema files:      $schema_files"
    
    total=$((system_files + governance_files + context_files + config_files + schema_files))
    echo ""
    echo "Total files:       $total"
    
    if [ $total -ge 20 ]; then
        echo ""
        echo "✅ Health check PASSED"
    else
        echo ""
        echo "⚠️  Some files may be missing"
    fi
}

# ═══════════════════════════════════════════════════════════════
# USAGE
# ═══════════════════════════════════════════════════════════════

usage() {
    echo "ARI V12.0 Scripts"
    echo ""
    echo "Usage: source scripts.sh && <function>"
    echo ""
    echo "Functions:"
    echo "  setup_ari              - Initial setup"
    echo "  validate_universality  - Check no business in kernel"
    echo "  validate_security      - Check security config"
    echo "  validate_governance    - Check governance docs"
    echo "  run_all_validations    - Run all validations"
    echo "  health_check           - Quick health check"
}

# Print usage if sourced without arguments
echo "ARI V12.0 Scripts loaded. Run 'usage' for help."
