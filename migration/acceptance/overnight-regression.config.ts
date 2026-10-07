import {resolve} from 'node:path'
import base from './playwright.config'
// Previous full480 trace-on run remains immutable. Retain every failure trace
// here; passing cases retain report/log and requested screenshots. This bounds
// disk use without changing tests, assertions, retries or supported backend.
export default {...base,outputDir:resolve(import.meta.dirname,'overnight-regression-results'),reporter:[['line'],['json',{outputFile:resolve(import.meta.dirname,'overnight-regression-report.json')}]],use:{...base.use,trace:'retain-on-failure'}}
