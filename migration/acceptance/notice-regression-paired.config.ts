import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const testMatch=['settings-sharing-appearance-paired.spec.ts','public-notice-queue-paired.spec.ts','notice-session-lifetime-paired.spec.ts']
export default {...base,testMatch,projects:base.projects.map(project=>({...project,testMatch})),metadata:{...base.metadata,scope:'private-modal-notice-public-queue-session-regression',expectedTotalCases:40,journeys:5},outputDir:resolve(import.meta.dirname,'notice-regression-paired-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'notice-regression-paired-report.json')}]]}
