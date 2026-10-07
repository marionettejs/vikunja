import {resolve} from 'node:path'
import base from '../../frontend/playwright.config'
export default {...base, testDir: resolve(import.meta.dirname, '../../frontend/tests/e2e'), testMatch: ['**/task/comment-*.spec.ts', '**/task/mention-in-comment.spec.ts'], reporter: [['line']]}
