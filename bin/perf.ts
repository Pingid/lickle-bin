import { run as runMitata } from 'mitata'
import { $ } from 'execa'

import { createFileCache, git, is_sudo } from './util'

type BenchmarkResult = Awaited<ReturnType<typeof runMitata>>
type Stats = NonNullable<BenchmarkResult['benchmarks'][0]['runs'][0]['stats']>
type Entry = { label: string; result: BenchmarkResult }

const cache = createFileCache({ name: 'perf-cache', root: 'cache', key: is_sudo() ? 'sudo' : '' })

const run_benchmark = async (p?: { cwd?: string }) => {
  const env = { ...process.env, BENCH_FORMAT: 'json' }
  const result = is_sudo() ? await $({ env, ...p })`sudo -E pnpm bench` : await $({ env, ...p })`pnpm bench`
  const json = result.stdout.trim().replace(/^[^{]*\{/, '{')
  const data = JSON.parse(json) as BenchmarkResult
  return data
}

const run = async () => {
  const [, , ...args] = process.argv

  const revs = [...args]
  const changes = await git.has_changes()

  if (revs.length === 0) {
    if (changes) revs.push('HEAD')
    else revs.push('HEAD~1')
  }

  const results: Entry[] = []

  for (const rev of revs) {
    const hash = await git.rev(rev)
    const info = await git.info(hash)
    console.log(`benchmarking [\x1b[1m${info}\x1b[0m]`)
    const data = await cache.with(hash + (is_sudo() ? '-sudo' : ''), () => git.worktree(hash, run_benchmark))()
    results.push({ label: info, result: data })
  }

  if (changes && revs.length === 1) {
    const current_hash = await git.current_hash()
    const current = await cache.with(current_hash + (is_sudo() ? '-sudo' : ''), () => run_benchmark())()
    results.push({ label: 'CURRENT', result: current })
  }

  print_legend()
  print_results(results)
}

const print_legend = () => {
  console.log()
  console.log('\x1b[1mLegend:\x1b[0m')
  console.log('  \x1b[1mAvg Time\x1b[0m   Average time per execution (lower is better).')
  console.log(
    '  \x1b[1mComp\x1b[0m        Comparison vs Baseline. \x1b[32mGreen\x1b[0m is faster, \x1b[31mRed\x1b[0m is slower.',
  )
  console.log('  \x1b[1mp75\x1b[0m        75th percentile (75% of runs were faster than this).')
  console.log('  \x1b[1mIPC\x1b[0m        Instructions Per Cycle (higher implies better CPU efficiency).')
  console.log('  \x1b[1mInstr\x1b[0m      CPU instructions executed per run.')
  console.log()
}

const print_results = (entries: Entry[]) => {
  if (entries.length === 0) return

  const benchmarks = extract_benchmarks(entries)
  // Sort alphabetically to ensure JSON.* and Bin.* are grouped together
  const names = [...new Set(entries.flatMap((e) => Object.keys(extract_stats(e.result))))].sort()
  const maxLabelLen = Math.max(...entries.map((e) => e.label.length), 10)

  console.log('\x1b[1mPerformance Comparison\x1b[0m')
  console.log()

  for (const name of names) {
    const all = benchmarks.get(name)
    if (!all || name.includes('JSON.')) continue

    let displayEntries = entries
    if (displayEntries.length === 0) continue

    console.log(`\x1b[1m${name}\x1b[0m`)

    const hLabel = 'Rev'.padEnd(maxLabelLen)
    console.log(
      `  \x1b[90m${hLabel}  ${'Avg Time'.padEnd(14)}  ${'Comp'.padEnd(8)}  ${'p75'.padEnd(12)}  ${'Range (min … max)'}\x1b[0m`,
    )

    const baselineEntry = displayEntries[0]
    const baselineStats = all.get(baselineEntry.label)

    for (let i = 0; i < displayEntries.length; i++) {
      const entry = displayEntries[i]
      const s = all.get(entry.label)
      if (!s) continue

      const isBaseline = i === 0

      // 1. Main Stats Line
      const label = entry.label.padEnd(maxLabelLen)
      const avg = format_ns(s.avg).padEnd(14)
      let delta = '\x1b[90m-\x1b[0m       '
      if (!isBaseline && baselineStats) {
        delta = format_delta(s.avg, baselineStats.avg).padEnd(17)
      }
      const p75 = format_ns(s.p75).padEnd(12)
      const range = `${format_ns(s.min)} … ${format_ns(s.max)}`
      const heap = s.heap ? ` \x1b[90m(${format_bytes(s.heap.avg)})\x1b[0m` : ''

      console.log(`  ${label}  \x1b[1m${avg}\x1b[0m  ${delta}  ${p75}  \x1b[90m${range}\x1b[0m${heap}`)

      // 2. Optional Counters Line (if running with sudo)
      if (s.counters) {
        const c = s.counters as any
        // Extract averages
        const instr = c.instructions?.avg || 0
        const cycles = c.cycles?.avg || 0
        const ipc = cycles > 0 ? (instr / cycles).toFixed(2) : '0.00'

        // Format strings
        const instrStr = format_count(instr)
        const cyclesStr = format_count(cycles)

        // Indented detail line in gray
        console.log(`  \x1b[90m${''.padEnd(maxLabelLen)}  └─ ${instrStr} instr, ${cyclesStr} cycles, ${ipc} IPC\x1b[0m`)
      }
    }
    console.log()
  }
}

const extract_stats = (result: BenchmarkResult): Record<string, Stats> => {
  const stats: Record<string, Stats> = {}
  for (const bench of result.benchmarks) {
    const run = bench.runs[0]
    if (run?.stats) stats[bench.alias] = run.stats
  }
  return stats
}

const extract_benchmarks = (entries: Entry[]): Map<string, Map<string, Stats>> => {
  const map = new Map<string, Map<string, Stats>>()
  for (const entry of entries) {
    for (const [name, stats] of Object.entries(extract_stats(entry.result))) {
      if (!map.has(name)) map.set(name, new Map())
      map.get(name)!.set(entry.label, stats)
    }
  }
  return map
}

const format_ns = (ns: number): string => {
  if (ns < 1000) return `${ns.toFixed(2)} ns`
  if (ns < 1_000_000) return `${(ns / 1000).toFixed(2)} µs`
  if (ns < 1_000_000_000) return `${(ns / 1_000_000).toFixed(2)} ms`
  return `${(ns / 1_000_000_000).toFixed(2)} s`
}

const format_bytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes.toFixed(0)} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const format_count = (num: number): string => {
  if (num < 1000) return num.toFixed(0)
  if (num < 1_000_000) return `${(num / 1000).toFixed(2)}k`
  return `${(num / 1_000_000).toFixed(2)}M`
}

const format_delta = (current: number, baseline: number): string => {
  const diff = current - baseline
  const percentage = (diff / baseline) * 100
  const sign = percentage > 0 ? '+' : ''
  const text = `${sign}${percentage.toFixed(1)}%`

  if (Math.abs(percentage) < 1.0) return `\x1b[90m${text}\x1b[0m`
  if (percentage < 0) return `\x1b[32m${text}\x1b[0m`
  return `\x1b[31m${text}\x1b[0m`
}

run()
