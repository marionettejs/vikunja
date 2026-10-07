import {resolve} from 'node:path'
import base from './supported-device-paired.config'
const testMatch=['notice-session-lifetime-paired.spec.ts']
export default {...base,testMatch,projects:base.projects.map(project=>({...project,testMatch})),metadata:{...base.metadata,scope:'accepted-notice-real-logout-Undo-lifetime',expectedTotalCases:16,journeys:2},outputDir:resolve(import.meta.dirname,'notice-session-lifetime-paired-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'notice-session-lifetime-paired-report.json')}]]}
