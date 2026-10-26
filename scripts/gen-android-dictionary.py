import re

src = open('lib/i18n.ts', encoding='utf-8').read()
start = src.index('const SV: Record<string, string> = {')
end = src.index('\n};', start)
block = src[start:end]
pat = re.compile(r'(?:"((?:[^"\\]|\\.)*)"|([A-Za-z]+)):\s*\n?\s*"((?:[^"\\]|\\.)*)",')
pairs = []
for m in pat.finditer(block):
    key = m.group(1) if m.group(1) is not None else m.group(2)
    val = m.group(3)
    pairs.append((key, val))

def k(s):
    return s.replace('\\"', '"').replace('\\', '\\\\').replace('"', '\\"').replace('$', '\\$')

lines = []
for key, val in pairs:
    lines.append(f'    "{k(key)}" to "{k(val)}",')

out = '''package com.authsignature.app.i18n

// Generated from lib/i18n.ts (the website's Swedish dictionary). Do not edit by hand: change the
// website dictionary and run scripts/gen-android-dictionary.py, or add app-only texts in I18n.kt.
internal val SHARED_SV: Map<String, String> = mapOf(
''' + '\n'.join(lines) + '\n)\n'

import os
os.makedirs('android/app/src/main/java/com/authsignature/app/i18n', exist_ok=True)
open('android/app/src/main/java/com/authsignature/app/i18n/SharedDictionary.kt', 'w', encoding='utf-8').write(out)
print(len(pairs), 'entries')
