import {resolve} from 'node:path'
import base from './vue-observation-parity.config'
const testMatch = ['notice-fades-paired.spec.ts']
export default {...base, testMatch, projects: ['vue', 'marionette'].flatMap(app => [1440, 390].map(width => ({...base.projects[0], name: `${app}-fade-${width}`, testMatch, grep: undefined, use: {...base.projects[0].use, baseURL: app === 'vue' ? 'http://127.0.0.1:4470' : process.env.BASE_URL!, viewport: {width, height: 900}}}))), metadata: {...base.metadata, scope: 'real task write; observed source-duration entry/dismiss/expiry opacity'}, outputDir: resolve(import.meta.dirname, 'notice-fades-paired-results'), reporter: [['line'], ['json', {outputFile: resolve(import.meta.dirname, 'notice-fades-paired-report.json')}]]}
