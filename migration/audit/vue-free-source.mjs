import {readFileSync,readdirSync,writeFileSync} from 'node:fs'
import {resolve,relative} from 'node:path'
import {execFileSync} from 'node:child_process'
const root=resolve(import.meta.dirname,'../..'), frontend=resolve(root,'frontend')
const vueName=/vue|^pinia$|^histoire$|^@histoire\//i
const manifest=JSON.parse(readFileSync(resolve(frontend,'package.json'),'utf8'))
const direct=Object.keys({...manifest.dependencies,...manifest.devDependencies}).filter(name=>vueName.test(name))
const tree=JSON.parse(execFileSync('pnpm',['list','--depth','Infinity','--json'],{cwd:frontend,encoding:'utf8',maxBuffer:16*1024*1024}))
const installed=new Set()
function visit(node){if(!node||typeof node!=='object')return;for(const key of ['dependencies','devDependencies','optionalDependencies'])for(const [name,child] of Object.entries(node[key]??{})){if(vueName.test(name))installed.add(name);visit(child)}}
tree.forEach(visit)
const files=[]
function walk(dir){for(const item of readdirSync(dir,{withFileTypes:true})){const path=resolve(dir,item.name);if(item.isDirectory())walk(path);else files.push(path)}}
walk(resolve(frontend,'src'))
const sfcs=files.filter(path=>path.endsWith('.vue')).map(path=>relative(root,path))
const imports=[]
for(const path of files.filter(path=>/\.(?:ts|js)$/.test(path))){const source=readFileSync(path,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*\(|import\s*)['"]([^'"]+)['"]/g)){if(vueName.test(match[1])||match[1].endsWith('.vue'))imports.push({file:relative(root,path),specifier:match[1]})}}
const lock=readFileSync(resolve(frontend,'pnpm-lock.yaml'),'utf8')
const lockMatches=lock.split('\n').filter(line=>/\bvue|@vue|\bpinia@|\bhistoire@/i.test(line))
const tooling=['vite.config.ts','eslint.config.js','.stylelintrc.json','pnpm-workspace.yaml','env.d.ts'].flatMap(file=>readFileSync(resolve(frontend,file),'utf8').split('\n').filter(line=>/['"](?:[^'"]*\/)?(?:vue|pinia|histoire|vue-tsc|vite-svg-loader)(?:[-/][^'"]*)?['"]/.test(line)).map(line=>({file,line})))
const report={direct,installed:[...installed],sfcs,imports,lockMatches,tooling,retained_test_files:files.filter(path=>/\.(?:test|spec)\.[jt]s$/.test(path)).length}
writeFileSync(resolve(process.argv[2]??'/tmp/vikunja-vue-source-audit.json'),JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify(report))
if([direct,[...installed],sfcs,imports,lockMatches,tooling].some(matches=>matches.length))process.exitCode=1
