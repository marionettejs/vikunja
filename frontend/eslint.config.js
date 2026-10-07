import js from '@eslint/js'
import parser from '@typescript-eslint/parser'
import typescript from '@typescript-eslint/eslint-plugin'
import pluginDepend from 'eslint-plugin-depend'
export default [
 {ignores:['**/*.test.ts','src/client/generated/**']},
 js.configs.recommended,
 pluginDepend.configs['flat/recommended'],
 {files:['**/*.{js,ts}'],languageOptions:{parser,parserOptions:{ecmaVersion:'latest',sourceType:'module'}},plugins:{'@typescript-eslint':typescript},rules:{
 'no-undef':'off','no-unused-vars':'off',quotes:['error','single'],'comma-dangle':['error','always-multiline'],semi:['error','never'],indent:['error','tab',{SwitchCase:1}],
 'depend/ban-dependencies':'warn',
 'no-restricted-syntax':['error',{selector:'ForInStatement',message:'Use Object.keys/entries or forEach instead of for...in.'}],
 '@typescript-eslint/no-unused-vars':['error',{caughtErrors:'all',caughtErrorsIgnorePattern:'^_',varsIgnorePattern:'^_',ignoreRestSiblings:true}],
 }},
]
