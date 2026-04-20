import ast

with open('api.py', 'r', encoding='utf-8') as f:
    source = f.read()

try:
    ast.parse(source)
    print('PASS: api.py parses without syntax errors')
except SyntaxError as e:
    print(f'FAIL: Syntax error in api.py: {e}')
    raise

checks = [
    ('TYPE_MAP defined', '_TASK_TYPE_MAP'),
    ('PRIORITY_MAP defined', '_TASK_PRIORITY_MAP'),
    ('null changedBy fix', 'changed_by is None or str(changed_by)'),
    ('after_hours default 540', 'or 540'),
    ('hours fallback industry default', 'industry_default_4h_per_point'),
    ('type_encoded from map', '_TASK_TYPE_MAP.get(task_type'),
    ('priority_encoded from map', '_TASK_PRIORITY_MAP.get(priority'),
]

all_pass = True
for name, token in checks:
    if token in source:
        print(f'PASS: {name}')
    else:
        print(f'FAIL: {name} -- token not found: {repr(token)}')
        all_pass = False

print()
if all_pass:
    print('ALL PHASE 1 API.PY CHECKS PASSED')
else:
    print('SOME CHECKS FAILED -- review above')
