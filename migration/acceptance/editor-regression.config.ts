import {resolve} from 'node:path'
import base from '../../frontend/playwright.config'
export default {...base, testDir: resolve(import.meta.dirname, '../../frontend/tests/e2e'), testMatch: ['**/editor/*.spec.ts', '**/task/tiptap-editor-save.spec.ts', '**/task/nested-checklist-strikethrough.spec.ts'], reporter: [['line']]}
