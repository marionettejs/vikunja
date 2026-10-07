import {resolve} from 'node:path'
import base from './benchmark.config'
import {publishedBuild, repositoryRoot} from './published-baseline'
const build = publishedBuild()
export default {
 ...base, timeout: 300000, testMatch: ['performance-cause.spec.ts'],
 webServer: {command: `${process.execPath} ${resolve(repositoryRoot, 'frontend/node_modules/vite/bin/vite.js')} preview --host 127.0.0.1 --port 4470 --strictPort --outDir ${build} --mode production`, cwd: resolve(repositoryRoot, 'frontend'), url: 'http://127.0.0.1:4470', reuseExistingServer: false},
 outputDir: resolve(import.meta.dirname, 'performance-cause-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'performance-cause-report.json')}]],
}
