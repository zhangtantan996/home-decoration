import sys

with open('/Volumes/tantan/AI_project/home-decoration/mini/src/pages/home/index.scss', 'r') as f:
    text = f.read()

def check_braces(code):
    stack = []
    for i, char in enumerate(code):
        if char == '{':
            stack.append((char, i))
        elif char == '}':
            if not stack:
                return f"Error: Unmatched closing brace at index {i}"
            stack.pop()
    if stack:
        return f"Error: Unclosed opening brace(s) remaining: {[i for c, i in stack]}"
    return "All braces match properly."

print(check_braces(text))
