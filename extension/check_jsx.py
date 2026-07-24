import re

with open('src/views/ResearchView.tsx', 'r') as f:
    text = f.read()

# remove comments
text = re.sub(r'\{/\*.*?\*/\}', '', text, flags=re.DOTALL)

stack = []
line_num = 1
for i, c in enumerate(text):
    if c == '\n':
        line_num += 1
    if c == '<':
        # Find end of tag
        end = text.find('>', i)
        if end != -1:
            tag_content = text[i+1:end].strip()
            if tag_content.startswith('/'):
                tag_name = tag_content[1:].split()[0]
                if stack and stack[-1][0] == tag_name:
                    stack.pop()
                else:
                    print(f"Mismatch at {line_num}: closing {tag_name}, expected {stack[-1][0] if stack else 'None'}")
            elif not tag_content.endswith('/') and not tag_content.startswith('!--') and tag_content != '':
                tag_name = tag_content.split()[0]
                # exclude self closing ones that might not have /
                if tag_name not in ['input', 'br', 'hr', 'img']:
                    stack.append((tag_name, line_num))

if stack:
    print("Unclosed tags:")
    for tag in stack:
        print(tag)
else:
    print("All good!")
