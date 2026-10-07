import {resolve} from 'node:path'
import base from './playwright.config'
export default {...base,retries:0,timeout:90000,testMatch:['lazy-style-parity.spec.ts'],outputDir:resolve(import.meta.dirname,'lazy-style-parity-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'lazy-style-parity-report.json')}]]}
