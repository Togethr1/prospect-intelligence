import { readFileSync, readdirSync } from 'node:fs'
import { extname, join, relative, sep } from 'node:path'

const forbidden = [
  ['browser-exposed provider key', /VITE_(OPENAI|HUNTER|GOOGLE).*KEY/g],
  ['unapproved paid provider call', /api\.openai\.com|maps\.googleapis\.com|r\.jina\.ai/g],
  ['private key material', /BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/g],
  ['common live token', /sk-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}/g],
]

const ignoredDirectories = new Set(['.git', '.next', 'node_modules', 'dist'])
const ignoredFiles = new Set([
  'package-lock.json',
  'extension/package-lock.json',
  'SECURITY_AUDIT.md',
  'scripts/security-check.mjs',
])
const binaryExtensions = new Set([
  '.avif', '.gif', '.ico', '.jpeg', '.jpg', '.pdf', '.png', '.woff', '.woff2',
  '.zip',
])

function listFiles(directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue
    const absolute = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...listFiles(absolute))
    else if (entry.isFile()) files.push(absolute)
  }
  return files
}

let failed = false
for (const absolute of listFiles('.')) {
  const file = relative('.', absolute).split(sep).join('/')
  if (ignoredFiles.has(file) || binaryExtensions.has(extname(file).toLowerCase())) continue

  let contents
  try {
    contents = readFileSync(absolute, 'utf8')
  } catch {
    continue
  }
  if (contents.includes('\u0000')) continue

  for (const [label, pattern] of forbidden) {
    pattern.lastIndex = 0
    const matches = [...contents.matchAll(pattern)]
    if (!matches.length) continue
    failed = true
    for (const match of matches) {
      const line = contents.slice(0, match.index).split('\n').length
      console.error(`FAILED: ${label}\n${file}:${line}`)
    }
  }
}

if (failed) process.exit(1)
console.log('Security source check passed.')
