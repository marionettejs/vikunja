import {resolve} from 'node:path'
import base from './performance-cause.config'
export default {...base, timeout: 600000, testMatch:['performance-tail.spec.ts'],outputDir:resolve(import.meta.dirname,'performance-tail-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'performance-tail-report.json')}]]}
