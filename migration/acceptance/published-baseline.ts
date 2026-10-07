import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
export const repositoryRoot = resolve(import.meta.dirname, '../..')
export function publishedBuild() {
 const input = process.env.BENCHMARK_NATIVE_BASELINE_BUILD
 if (!input) throw new Error('An immutable published production directory is required')
 const build = resolve(input)
 const manifest = JSON.parse(readFileSync(resolve(repositoryRoot, 'migration/benchmark/results-2026-10-06/bundle-native.json'), 'utf8'))
 for (const [name, asset] of Object.entries(manifest.files) as Array<[string, {sha256: string}]>) {
  if (createHash('sha256').update(readFileSync(resolve(build, name))).digest('hex') !== asset.sha256) throw new Error('Published baseline asset differs: ' + name)
 }
 return build
}
