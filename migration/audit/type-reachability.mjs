import ts from '../../frontend/node_modules/typescript/lib/typescript.js'
import {readFileSync,writeFileSync} from 'node:fs'
import {resolve,relative} from 'node:path'
const frontend=resolve(import.meta.dirname,'../../frontend')
const configuration=ts.readConfigFile(resolve(frontend,'tsconfig.app.json'),ts.sys.readFile)
const parsed=ts.parseJsonConfigFileContent(configuration.config,ts.sys,frontend)
const program=ts.createProgram(parsed.fileNames,parsed.options)
const graph=new Map(),typeGraph=new Map()
for(const source of program.getSourceFiles()){
 if(!source.fileName.startsWith(frontend+'/src/'))continue
 const imports=[]
 const types=[]
 function visit(node){
  let specifier,onlyType=false
  if(ts.isImportDeclaration(node)||ts.isExportDeclaration(node)) {specifier=node.moduleSpecifier;onlyType=Boolean(node.isTypeOnly||node.importClause?.isTypeOnly)}
  else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword)specifier=node.arguments[0]
  else if(ts.isImportTypeNode(node)&&ts.isLiteralTypeNode(node.argument)){specifier=node.argument.literal;onlyType=true}
  if(specifier&&ts.isStringLiteral(specifier)){
   const result=ts.resolveModuleName(specifier.text,source.fileName,parsed.options,ts.sys).resolvedModule?.resolvedFileName
   if(result?.startsWith(frontend+'/src/')){types.push(result);if(!onlyType)imports.push(result)}
  }
  ts.forEachChild(node,visit)
 }
 visit(source)
 graph.set(source.fileName,imports);typeGraph.set(source.fileName,types)
}
function closure(graph,roots){const result=new Set(roots),queue=[...roots];for(const file of queue)for(const dependency of graph.get(file)??[])if(!result.has(dependency)){result.add(dependency);queue.push(dependency)}return result}
const entries=['src/main.ts','src/sw.ts'].map(file=>resolve(frontend,file))
const runtime=closure(graph,entries),entryTypes=closure(typeGraph,entries)
const tests=closure(typeGraph,[...graph.keys()].filter(file=>/\.(?:test|spec)\.ts$/.test(file)))
const log=readFileSync(process.argv[2],'utf8')
const diagnostics=[...new Set(log.split('\n').filter(line=>/^src\/.*\): error TS\d+:/.test(line)))].map(message=>{
 const file=message.match(/^(src\/.*?)\(/)[1],absolute=resolve(frontend,file)
 return {file,message,entry_value_import_closure:runtime.has(absolute),entry_type_import_closure:entryTypes.has(absolute),test_import_closure:tests.has(absolute)}
})
const summary={unique:diagnostics.length,entry_value_import_closure:diagnostics.filter(d=>d.entry_value_import_closure).length,entry_type_import_closure:diagnostics.filter(d=>d.entry_type_import_closure).length,test_import_closure:diagnostics.filter(d=>d.test_import_closure).length,unreached:diagnostics.filter(d=>!d.entry_type_import_closure&&!d.test_import_closure).length}
const result={summary,interpretation:'Import closure is evidence of dependency, not proof of runtime execution. Named type-only imports are conservatively included in the value closure. Unreached files require individual contract/scope review; this script never excludes or deletes them.',roots:entries.map(file=>relative(frontend,file)),diagnostics}
writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');process.stdout.write(JSON.stringify(summary)+'\n')
