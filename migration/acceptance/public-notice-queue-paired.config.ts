import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const testMatch=['public-notice-queue-paired.spec.ts']
export default {...base,testMatch,projects:base.projects.map(project=>({...project,testMatch})),metadata:{...base.metadata,scope:'public-notice-real-writes-dedup-max-two-undo',expectedTotalCases:8,journeys:1},outputDir:resolve(import.meta.dirname,'public-notice-queue-paired-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'public-notice-queue-paired-report.json')}]]}
