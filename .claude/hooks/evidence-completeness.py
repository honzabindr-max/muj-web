#!/usr/bin/env python3
"""
Hook: evidence-completeness (Stop)
Blocks session end unless last assistant output contains evidence bundle
or explicit 'missing evidence' escape. Only fires when session made code changes.
"""
import sys
import json
import os
import re

REQUIRED_SIGNALS = [
    (r'git rev-parse HEAD|HEAD\s+[0-9a-f]{7,40}|\bcommit\s+[0-9a-f]{7,40}\b', 'repo identity'),
    (r'git status|nothing to commit|working tree clean|Changes not staged|Untracked files', 'git status'),
    (r'git diff --stat|\d+ files? changed', 'diff stat'),
    (r'@@ [-+]\d+|^\+\+\+ |^--- |diff --git', 'focused diff'),
    (r'positive grep|grep.*found|\bfound\b.*symbol|[1-9]\d* match', 'positive grep'),
    (r'negative grep|no match|0 match(?:es)?|not found.*symbol', 'negative grep'),
    (r'test_\w+|pytest|jest|\.test\.|PASSED|FAILED|\bpassed\b|\bfailed\b', 'relevant test'),
    (r'secret.scan|scan.*clean|no secrets?|secret-scan|BLOCKED.*secret', 'secret scan'),
]

ESCAPE_RE = re.compile(
    r'[Mm]issing evidence|BLOCKED|ROZDĚLANÉ|ČEKÁ NA OVĚŘENÍ|[Nn]on.code turn|N/A',
    re.IGNORECASE
)

CODE_CHANGE_TOOLS = {'Write', 'Edit', 'MultiEdit', 'NotebookEdit'}

def read_transcript(path):
    if not path or not os.path.exists(path):
        return [], ''
    messages = []
    last_assistant_text = ''
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line)
                    messages.append(msg)
                except Exception:
                    continue
    except Exception:
        pass
    for msg in messages:
        if msg.get('type') == 'message' and msg.get('role') == 'assistant':
            parts = msg.get('content', [])
            texts = []
            for p in parts:
                if isinstance(p, dict) and p.get('type') == 'text':
                    texts.append(p.get('text', ''))
                elif isinstance(p, str):
                    texts.append(p)
            if texts:
                last_assistant_text = '\n'.join(texts)
    return messages, last_assistant_text

def session_has_code_changes(messages):
    for msg in messages:
        if msg.get('type') != 'message':
            continue
        for part in msg.get('content', []):
            if isinstance(part, dict) and part.get('type') == 'tool_use':
                if part.get('name') in CODE_CHANGE_TOOLS:
                    return True
    return False

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    if data.get('stop_hook_active'):
        sys.exit(0)

    transcript_path = data.get('transcript_path', '')
    messages, text = read_transcript(transcript_path)

    if not text:
        sys.exit(0)

    if ESCAPE_RE.search(text):
        sys.exit(0)

    if not session_has_code_changes(messages):
        sys.exit(0)

    missing = []
    for pattern, label in REQUIRED_SIGNALS:
        if not re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            missing.append(label)

    if missing:
        print(
            "EVIDENCE INCOMPLETE — nelze ukončit session.\n"
            "Chybí v posledním výstupu:\n" +
            '\n'.join(f'  - {m}' for m in missing) +
            "\n\n"
            "Zavolej evidence-gate subagenta s TASK_TYPE, nebo napiš:\n"
            "  missing evidence: N/A — [důvod]"
        )
        sys.exit(2)

    sys.exit(0)

if __name__ == '__main__':
    main()
