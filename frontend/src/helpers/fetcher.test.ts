import {beforeEach, describe, expect, it} from 'vitest'

import {apiV2Url, getApiV2BaseUrl} from './fetcher'

describe('v2 API URLs', () => {
	beforeEach(() => {
		window.API_URL = 'https://api.example.com/root/api/v1'
	})

	it('derives the v2 base URL from the configured API URL', () => {
		expect(getApiV2BaseUrl()).toBe('https://api.example.com/root/api/v2/')
	})

	it('builds v2 endpoint URLs from the shared base URL', () => {
		expect(apiV2Url('labels?sort_by=title')).toBe('https://api.example.com/root/api/v2/labels?sort_by=title')
	})
})

import axios, {AxiosError} from 'axios'
import {afterEach, vi} from 'vitest'
import {AuthenticatedHTTPFactory} from './fetcher'
import {removeToken, saveToken} from './auth'

const jwt = (id: number, generation: string) => `x.${btoa(JSON.stringify({id, type: 1, jti: generation}))}.y`
describe('expired request ownership', () => {
 const originalAdapter = axios.defaults.adapter
 beforeEach(() => {removeToken(); localStorage.clear(); saveToken(jwt(1, 'old'), true)})
 afterEach(() => {axios.defaults.adapter = originalAdapter; removeToken(); vi.restoreAllMocks()})
 it('late concurrent401 uses the token renewed for its sibling request', async () => {
  let release!: () => void, refreshes = 0
  const gate = new Promise<void>(done => {release = done}), attempts = new Map<string, number>()
  axios.defaults.adapter = async config => {
   const url = config.url!, attempt = (attempts.get(url) ?? 0) + 1; attempts.set(url, attempt)
   if (url.includes('token/refresh')) {refreshes++; return {data: {token: jwt(1, 'new')}, status: 200, statusText: 'OK', headers: {}, config}}
   if (attempt === 1) {
    if (url === 'late') await gate
    throw new AxiosError('expired', undefined, config, {}, {data: {code: 11}, status: 401, statusText: 'Unauthorized', headers: {}, config})
   }
   expect(config.headers.get('Authorization')).toBe(`Bearer ${jwt(1, 'new')}`)
   return {data: {}, status: 200, statusText: 'OK', headers: {}, config}
  }
  const http = AuthenticatedHTTPFactory(), early = http.get('early'), late = http.get('late')
  await early; release(); await late
  expect(refreshes).toBe(1); expect([...attempts.entries()]).toContainEqual(['late', 2])
 })
 it.each(['abort', 'identity'] as const)('does not replay an expired request after %s during refresh', async reason => {
  let release!: () => void, entered!: () => void, requests = 0
  const gate = new Promise<void>(done => {release = done}), seen = new Promise<void>(done => {entered = done})
  axios.defaults.adapter = async config => {
   if (config.url!.includes('token/refresh')) {entered(); await gate; return {data: {token: jwt(1, 'new')}, status: 200, statusText: 'OK', headers: {}, config}}
   requests++
   throw new AxiosError('expired', undefined, config, {}, {data: {code: 11}, status: 401, statusText: 'Unauthorized', headers: {}, config})
  }
  const controller = new AbortController(), pending = AuthenticatedHTTPFactory().get('owned', {signal: controller.signal})
  const rejected = expect(pending).rejects.toBeDefined()
  await seen
  if (reason === 'abort') controller.abort(); else saveToken(jwt(2, 'other'), true)
  release(); await rejected; expect(requests).toBe(1)
 })
})
