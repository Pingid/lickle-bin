// Mirror package.json's version into jsr.json. Run by the `version` lifecycle
// (after `npm version` bumps package.json) and again from `prepublishOnly` as a
// safety net for manually-edited versions.
import { readFileSync, writeFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const jsr = JSON.parse(readFileSync('jsr.json', 'utf8'))

if (jsr.version === pkg.version) {
  console.log(`jsr.json already at ${pkg.version}`)
  process.exit(0)
}

jsr.version = pkg.version
writeFileSync('jsr.json', JSON.stringify(jsr, null, 2) + '\n')
console.log(`jsr.json synced to ${pkg.version}`)
