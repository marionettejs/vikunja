import {resolve} from 'node:path'
import base from './playwright.config'
export default {
 ...base, retries: 0,
 testMatch: ['task-editor.spec.ts', 'task-comments.spec.ts', 'editor-input-contract.spec.ts', 'organization.spec.ts'],
 outputDir: resolve(import.meta.dirname, 'toolbar-lifetime-results'),
 reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'toolbar-lifetime-report.json')}]],
}
