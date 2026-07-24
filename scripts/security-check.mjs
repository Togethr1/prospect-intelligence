import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { extname } from 'node:path'

const secretPatterns = [
  ['browser-exposed provider key', /VITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)/g],
  ['unapproved content proxy', /r\.jina\.ai/g],
  ['private key material', /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/g],
  ['OpenAI-style secret', /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g],
  ['Anthropic secret', /sk-ant-[A-Za-z0-9_-]{20,}/g],
  ['Google API key', /AIza[0-9A-Za-z_-]{20,}/g],
  ['GitHub token', /gh[pousr]_[A-Za-z0-9]{20,}/g],
  ['Slack token', /xox[baprs]-[A-Za-z0-9-]{20,}/g],
  ['AWS access key', /AKIA[0-9A-Z]{16}/g],
  [
    'literal credential assignment',
    /(?:api[_-]?key|access[_-]?token|client[_-]?secret|password)\s*[:=]\s*['"][^'"\s]{16,}['"]/gi,
  ],
]

const ignoredFiles = new Set([
  'package-lock.json',
  'extension/package-lock.json',
  'SECURITY_AUDIT.md',
  'scripts/security-check.mjs',
])
const binaryExtensions = new Set([
  '.avif', '.gif', '.ico', '.jpeg', '.jpg', '.png', '.woff', '.woff2', '.zip',
])

function listCandidateFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { encoding: 'utf8' },
  )
  return [...new Set(output.split('\0').filter(Boolean))].sort()
}

function releasePathError(file) {
  if (file === 'data/.gitkeep') return null
  if (file.startsWith('data/')) return 'local application data'
  if (file === '.env' || (/^\.env\./.test(file) && file !== '.env.example')) return 'environment file'
  if (file === '.DS_Store' || file.endsWith('/.DS_Store')) return 'operating-system metadata'
  if (file.startsWith('.next/') || file.startsWith('extension/dist/') || file.includes('/node_modules/')) {
    return 'generated dependency or build output'
  }
  if (['.key', '.pem', '.p12', '.pfx'].includes(extname(file).toLowerCase())) {
    return 'credential or certificate file'
  }
  return null
}

let failed = false
for (const file of listCandidateFiles()) {
  const pathError = releasePathError(file)
  if (pathError) {
    failed = true
    console.error(`FAILED: ${pathError}\n${file}`)
    continue
  }
  if (ignoredFiles.has(file) || binaryExtensions.has(extname(file).toLowerCase())) continue

  let contents
  try {
    contents = readFileSync(file, 'utf8')
  } catch {
    continue
  }
  if (contents.includes('\u0000')) continue

  for (const [label, pattern] of secretPatterns) {
    pattern.lastIndex = 0
    for (const match of contents.matchAll(pattern)) {
      failed = true
      const line = contents.slice(0, match.index).split('\n').length
      console.error(`FAILED: ${label}\n${file}:${line}`)
    }
  }
}

if (failed) process.exit(1)
console.log('Tracked and release-candidate source check passed.')
