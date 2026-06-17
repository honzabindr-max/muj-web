#!/usr/bin/env python3
"""
Hook: secret-scan
PostToolUse (Write|Edit|MultiEdit) + Stop
Scans written content and git diff for real-looking secrets.
"""
import sys
import json
import re
import subprocess

SECRET_PATTERNS = [
    (r'SUPABASE_SERVICE_ROLE[_KEY]*\s*[=:]\s*eyJ[A-Za-z0-9\-_\.]{40,}', 'supabase_service_role'),
    (r'SUPABASE_URL\s*[=:]\s*https://[a-z]{20,}\.supabase\.co', 'supabase_url'),
    (r'IPROYAL[^=\n]{0,20}[=:]\s*\S{10,}', 'iproyal_credential'),
    (r'postgres(?:ql)?://[^:@\s]+:[^@\s]{6,}@', 'pg_connection_string'),
    (r'Bearer\s+[A-Za-z0-9\-_\.+/=]{30,}', 'bearer_token'),
    (r'Authorization:\s*\w+\s+[A-Za-z0-9\-_\.+/=]{30,}', 'auth_header'),
    (r'api[_-]?(?:key|secret)\s*[=:]\s*[A-Za-z0-9\-_]{25,}', 'api_key'),
    (r'(?:ghp|ghs|github_pat|sbp|vercel)[_\-][A-Za-z0-9\-_]{20,}', 'api_token'),
    (r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----', 'private_key_pem'),
    (r'(?:password|secret|token)\s*[=:]\s*[A-Za-z0-9\-_\.+/]{20,}', 'secret_value'),
]

PLACEHOLDER_RE = re.compile(
    r'\$\{[^}]+\}'
    r'|<[a-z_][a-z_0-9\-]*>'
    r'|your[_\-]?\w+'
    r'|xxx+'
    r'|changeme|example\.com|placeholder|dummy|test_secret'
    r'|^\s*#',
    re.IGNORECASE
)

def is_placeholder(line):
    return bool(PLACEHOLDER_RE.search(line))

def scan_text(text, source):
    findings = []
    for i, line in enumerate(text.splitlines(), 1):
        if is_placeholder(line):
            continue
        for pattern, label in SECRET_PATTERNS:
            if re.search(pattern, line, re.IGNORECASE):
                safe_line = re.sub(
                    r'(eyJ|ghp_|sbp_|Bearer )([A-Za-z0-9]{6})[A-Za-z0-9\-_\.+/=]+',
                    r'\1\2***', line
                )
                findings.append(f"{source}:{i} [{label}] {safe_line.strip()[:100]}")
                break
    return findings

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    findings = []
    is_stop = 'stop_hook_active' in data
    tool_name = data.get('tool_name', '')

    if not is_stop and tool_name in ('Write', 'Edit', 'MultiEdit'):
        tool_input = data.get('tool_input', {})
        if tool_name == 'Write':
            content = tool_input.get('content', '')
            path = tool_input.get('file_path', 'Write')
            findings += scan_text(content, path)
        elif tool_name in ('Edit', 'MultiEdit'):
            edits = tool_input.get('edits', [tool_input])
            for edit in edits:
                new_str = edit.get('new_string', '')
                path = edit.get('file_path', tool_input.get('file_path', 'Edit'))
                findings += scan_text(new_str, path)

    if is_stop:
        for diff_args in [['git', 'diff', 'HEAD'], ['git', 'diff', '--staged']]:
            try:
                diff = subprocess.check_output(
                    diff_args, text=True, stderr=subprocess.DEVNULL, timeout=5
                )
                findings += scan_text(diff, ' '.join(diff_args))
            except Exception:
                pass

    if findings:
        print("BLOCKED — secret-scan: real-looking secrets detected.")
        print("Verify and rotate if real. Never commit or paste in chat.\n")
        for f in findings:
            print(f"  {f}")
        print("\nFalse positive? Review patterns in ~/.claude/hooks/secret-scan.py")
        sys.exit(2)

    sys.exit(0)

if __name__ == '__main__':
    main()
