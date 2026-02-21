const fs = require('fs');
const path = 'tests/security/injection-detection.test.ts';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
  /expect\(categories\)\.toContain\('Direct Override'\);\s+expect\(categories\)\.toContain\('Role Manipulation'\);\s+expect\(categories\)\.toContain\('Command Injection'\);\s+expect\(categories\)\.toContain\('Prompt Extraction'\);\s+expect\(categories\)\.toContain\('Authority Claims'\);\s+expect\(categories\)\.toContain\('Data Exfiltration'\);\s+expect\(categories\)\.toContain\('SSRF'\);\s+expect\(categories\)\.toContain\('Path Traversal'\);\s+expect\(categories\)\.toContain\('Null Byte Injection'\);\s+expect\(categories\)\.toContain\('XML Injection'\);\s+expect\(categories\)\.toContain\('Jailbreak'\);\s+expect\(categories\)\.toContain\('Tag Injection'\);\s+expect\(categories\)\.toContain\('Script Injection'\);\s+expect\(categories\)\.toContain\('SQL Injection'\);/g,
  \`expect(categories).toContain('direct_override');
      expect(categories).toContain('role_manipulation');
      expect(categories).toContain('command');
      expect(categories).toContain('prompt_extraction');
      expect(categories).toContain('authority_claim');
      expect(categories).toContain('data_exfiltration');
      expect(categories).toContain('ssrf');
      expect(categories).toContain('path');
      expect(categories).toContain('null_byte');
      expect(categories).toContain('xml');
      expect(categories).toContain('jailbreak');
      expect(categories).toContain('xss');
      expect(categories).toContain('script');
      expect(categories).toContain('sql');\`
);
fs.writeFileSync(path, content);
