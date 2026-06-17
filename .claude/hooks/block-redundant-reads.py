#!/usr/bin/env python3
"""
Hook: block-redundant-reads (PreToolUse → Read)
- File > 300 lines without limit param: require grep/rg or limit+offset.
- Same file read again without limit: block with offset suggestion.
"""
import sys
import json
import os
import subprocess

STATE_DIR = '/tmp/claude-hook-reads'

def get_state_file(session_id):
    os.makedirs(STATE_DIR, exist_ok=True)
    return os.path.join(STATE_DIR, f'{session_id}.json')

def load_state(session_id):
    sf = get_state_file(session_id)
    try:
        with open(sf) as f:
            return json.load(f)
    except Exception:
        return {}

def save_state(session_id, state):
    try:
        with open(get_state_file(session_id), 'w') as f:
            json.dump(state, f)
    except Exception:
        pass

def count_lines(path):
    try:
        result = subprocess.check_output(
            ['wc', '-l', path], text=True, stderr=subprocess.DEVNULL, timeout=3
        )
        return int(result.strip().split()[0])
    except Exception:
        return 0

def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        sys.exit(0)

    tool_input = data.get('tool_input', {})
    file_path = tool_input.get('file_path', '')
    limit = tool_input.get('limit')
    offset = tool_input.get('offset')
    session_id = data.get('session_id', 'unknown')

    if not file_path or not os.path.exists(file_path):
        sys.exit(0)

    state = load_state(session_id)
    read_count = state.get(file_path, 0)

    if limit and int(limit) <= 300:
        state[file_path] = read_count + 1
        save_state(session_id, state)
        sys.exit(0)

    line_count = count_lines(file_path)

    if line_count > 300:
        state[file_path] = read_count + 1
        save_state(session_id, state)

        if read_count == 0:
            print(
                f"BLOCK: {file_path} má {line_count} řádků (limit: 300 bez limit param).\n"
                f"Použij grep pro cílené hledání:\n"
                f"  grep -n 'hledaný_symbol' {file_path}\n"
                f"  rg 'pattern' {file_path}\n"
                f"Nebo čti po částech:\n"
                f"  Read(file_path='{file_path}', limit=200, offset=0)\n"
                f"Druhé čtení bez limit je blokováno."
            )
            sys.exit(2)
        else:
            if limit is None and offset is None:
                print(
                    f"BLOCK: {file_path} byl v této session již čten ({read_count}x).\n"
                    f"Pro opakované čtení použij limit+offset:\n"
                    f"  Read(file_path='{file_path}', limit=200, offset=0)\n"
                    f"  Read(file_path='{file_path}', limit=200, offset=200)\n"
                    f"Nebo grep pro konkrétní symbol."
                )
                sys.exit(2)

    state[file_path] = read_count + 1
    save_state(session_id, state)
    sys.exit(0)

if __name__ == '__main__':
    main()
