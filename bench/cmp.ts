import { spawn, execSync } from 'node:child_process'
import * as path from 'node:path'
import * as fs from 'node:fs'

type Row = { avg: number; min: number; p75: number }
type Snap = { ref: string; at: string; rows: Record<string, Row> }
type Tgt = { label: string; snap: Snap }

const root = path.resolve(import.meta.dirname, '..')
const snapDir = path.join(root, 'bench/snapshots')
const cache = '/tmp/lickle-bench'
const tsx = path.join(root, 'node_modules/.bin/tsx')

// ---------------- git ----------------

const sh = (cmd: string, cwd = root) =>
  execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    .toString()
    .trim()

const refSha = (r: string) => sh(`git rev-parse ${r}^{commit}`)
const isRef = (a: string) => {
  try {
    execSync(`git rev-parse --verify ${a}^{commit}`, { cwd: root, stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// ---------------- bench runner ----------------

const runBench = (cwd: string, ref: string): Promise<Snap> =>
  new Promise((res, rej) => {
    const p = spawn(tsx, ['bench/bench.ts'], {
      cwd,
      env: { ...process.env, BENCH_JSON: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let out = '',
      err = ''
    p.stdout.on('data', (d) => (out += d))
    p.stderr.on('data', (d) => (err += d))
    p.on('close', (code) => {
      if (code !== 0) return rej(new Error(`bench failed (${cwd}):\n${err}`))
      try {
        const j = JSON.parse(out)
        const rows: Record<string, Row> = {}
        for (const b of j.benchmarks) {
          const s = b.runs[0]?.stats
          if (!s) continue
          const g = j.layout?.[b.group]?.name ?? ''
          rows[`${g} / ${b.alias}`] = { avg: s.avg, min: s.min, p75: s.p75 }
        }
        res({ ref, at: new Date().toISOString(), rows })
      } catch (e) {
        rej(e)
      }
    })
  })

const extract = (sha: string): string => {
  const dir = path.join(cache, sha)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    execSync(`git archive ${sha} | tar -x -C ${dir}`, { cwd: root, stdio: 'inherit' })
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'))
  }
  fs.mkdirSync(path.join(dir, 'bench'), { recursive: true })
  fs.copyFileSync(path.join(root, 'bench/bench.ts'), path.join(dir, 'bench/bench.ts'))
  return dir
}

const runRef = async (ref: string): Promise<Tgt> => {
  const sha = refSha(ref)
  return { label: `${ref}@${sha.slice(0, 7)}`, snap: await runBench(extract(sha), sha) }
}

// ---------------- snapshots ----------------

const snapPath = (n: string) => path.join(snapDir, `${n}.json`)
const loadSnap = (n: string): Snap => JSON.parse(fs.readFileSync(snapPath(n), 'utf8'))
const saveSnap = (n: string, s: Snap) => {
  fs.mkdirSync(snapDir, { recursive: true })
  fs.writeFileSync(snapPath(n), JSON.stringify(s, null, 2) + '\n')
}

const resolveTgt = async (a: string): Promise<Tgt> => {
  if (fs.existsSync(snapPath(a))) return { label: a, snap: loadSnap(a) }
  if (isRef(a)) return runRef(a)
  throw new Error(`'${a}' is neither a snapshot nor a git ref`)
}

// ---------------- table ----------------

const fmt = (ns: number) => {
  const u = ['ns', 'µs', 'ms', 's']
  let v = ns,
    i = 0
  while (v >= 1000 && i < 3) ((v /= 1000), i++)
  return `${v.toFixed(2)} ${u[i]}`
}
const ansi = (s: string, code: number) => `\x1b[${code}m${s}\x1b[0m`
const stripAnsi = (s: string) => s.replace(/\x1b\[\d+m/g, '')
const pct = (cur: number, ref: number) => {
  const d = ((cur - ref) / ref) * 100
  const s = `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`
  return ansi(s, Math.abs(d) < 2 ? 90 : d > 0 ? 31 : 32)
}
const pad = (s: string, n: number, right = false) => {
  const sp = ' '.repeat(Math.max(0, n - stripAnsi(s).length))
  return right ? sp + s : s + sp
}

const diffTable = (cur: Snap, tgts: Tgt[]) => {
  const all = Array.from(new Set([...Object.keys(cur.rows), ...tgts.flatMap((t) => Object.keys(t.snap.rows))]))
  const w = Math.max(5, ...all.map((n) => n.length))
  const head =
    pad('bench', w) +
    '  ' +
    pad('current', 12, true) +
    tgts.map((t) => '  ' + pad(t.label, 16, true) + '  ' + pad('Δ', 8, true)).join('')
  console.log(ansi(head, 1))
  for (const n of all) {
    const cr = cur.rows[n]
    let line = pad(n, w) + '  ' + pad(cr ? fmt(cr.avg) : '-', 12, true)
    for (const t of tgts) {
      const tr = t.snap.rows[n]
      line += '  ' + pad(tr ? fmt(tr.avg) : '-', 16, true) + '  ' + pad(cr && tr ? pct(cr.avg, tr.avg) : '-', 8, true)
    }
    console.log(line)
  }
}

// ---------------- main ----------------

const usage = `Usage:
  tsx bench/cmp.ts save [name]        save current bench results (default: baseline)
  tsx bench/cmp.ts diff [target...]   compare current vs snapshot name(s) or git ref(s)
                                      (default target: baseline)
`

const [cmd, ...args] = process.argv.slice(2)
if (cmd === 'save') {
  const n = args[0] ?? 'baseline'
  console.error(`> running bench ...`)
  const s = await runBench(root, sh('git rev-parse --short HEAD'))
  saveSnap(n, s)
  console.log(`saved ${path.relative(root, snapPath(n))} (${Object.keys(s.rows).length} benches)`)
} else if (cmd === 'diff') {
  console.error(`> running bench (current) ...`)
  const cur = await runBench(root, 'current')
  const tgts: Tgt[] = []
  for (const a of args.length ? args : ['baseline']) {
    console.error(`> resolving ${a} ...`)
    tgts.push(await resolveTgt(a))
  }
  diffTable(cur, tgts)
} else {
  process.stderr.write(usage)
  process.exit(cmd ? 1 : 0)
}
