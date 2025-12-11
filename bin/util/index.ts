import { createHash } from 'node:crypto'
import { resolve, join } from 'node:path'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { $ } from 'execa'

const ROOT = resolve(import.meta.dirname, '../../')

export const is_sudo = () => process.getuid?.() === 0

export const createFileCache = (p?: { root?: string; name?: string; key?: string }) => {
  const folder = p?.name ?? 'temp-cache-'
  const dir = p?.root ? resolve(ROOT, join(p.root, folder)) : resolve(tmpdir(), folder)

  const resolve_key = (key: string) => {
    const name = p?.key ? `${p.key}-${key}` : key
    return `${name}.json`
  }

  let dir_exists = false
  const ensureDir = async () => {
    if (dir_exists) return
    await fs.mkdir(dir, { recursive: true })
    dir_exists = true
  }

  const set = async (key: string, value: any) => {
    await ensureDir()
    const path = resolve(dir, resolve_key(key))
    await fs.writeFile(path, JSON.stringify({ value }))
  }

  const get = (key: string) => {
    const path = resolve(dir, resolve_key(key))
    return fs
      .readFile(path, 'utf8')
      .then(JSON.parse)
      .then(({ value }) => value)
  }

  return {
    set,
    get,
    with:
      <A extends any[], R>(key: string, cb: (...args: A) => R) =>
      async (...args: A): Promise<Awaited<R>> => {
        const result = await get(key).catch(() => null)
        if (result && 'value' in result) return result.value
        const value = await cb(...args)
        await set(key, { value })
        return value
      },
  }
}

export const git = {
  current_hash: async () => {
    const diff = await $`git diff HEAD`.then((r) => r.stdout.trim())
    const hash = await $({ input: diff })`git hash-object --stdin`.then((r) => r.stdout.trim())
    return hash
  },
  has_changes: async () =>
    !(await $`git diff --quiet`.catch(() => false)) || !(await $`git diff --cached --quiet`.catch(() => false)),
  worktree: async <R>(hash: string, fn: (p: { cwd: string }) => Promise<R>) => {
    const path = resolve(ROOT, 'cache/worktree', hash)
    try {
      await $`git worktree add --detach ${path} ${hash}`
      await $({ cwd: path })`pnpm install`
      return await fn({ cwd: path })
    } finally {
      await $`git worktree remove --force ${path}`.catch(() => null)
    }
  },
  info: async (hash: string) => {
    const output = await $`git show -s --pretty=format:%h\ %s ${hash}`
    return output.stdout.trim()
  },
  rev: (rev: string) => $`git rev-parse ${rev}`.then((r) => r.stdout.trim()),
}
