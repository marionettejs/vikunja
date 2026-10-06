import {afterEach, expect, it, vi} from 'vitest'
import {SessionApplication} from './session'
import {getToken, saveToken, removeToken, getTokenIdentity} from '@/helpers/auth'
const transport = vi.hoisted(() => ({get: vi.fn(), post: vi.fn(), interceptors: {request: {use: vi.fn()}}}))
vi.mock('@/helpers/fetcher', () => ({HTTPFactory: () => transport, AuthenticatedHTTPFactory: () => transport, apiV2Url: (path: string) => path}))
afterEach(() => { removeToken(); transport.get.mockReset(); transport.post.mockReset() })
function token(id: number) { return `header.${btoa(JSON.stringify({id, type: 1}))}.signature` }
it('an aborted older identity restart cannot remove the newer tab token or publish signed in', async () => {
 let rejectOld!: (error: unknown) => void
 transport.get.mockImplementation((path: string) => path === 'info' ? Promise.resolve({data: {}}) : getTokenIdentity(getToken())?.id === 2 ? new Promise((_resolve, reject) => {rejectOld = reject}) : Promise.resolve({data: {id: getTokenIdentity(getToken())?.id, username: 'fixture-user'}}))
 saveToken(token(1), true); const session = new SessionApplication(); await session.start(); const signedIn = vi.fn(); session.on('signed:in', signedIn)
 session.storageChanged(new StorageEvent('storage', {key: 'token', newValue: token(2)})); await vi.waitFor(() => expect(rejectOld).toBeDefined()); session.storageChanged(new StorageEvent('storage', {key: 'token', newValue: token(3)})); await vi.waitFor(() => expect(session.getState().get('user')?.id).toBe(3)); rejectOld(new DOMException('obsolete request', 'AbortError')); await Promise.resolve(); await Promise.resolve(); expect(getTokenIdentity(getToken())?.id).toBe(3); expect(session.getState().get('status')).toBe('authenticated'); expect(signedIn).toHaveBeenCalledTimes(1); session.destroy()
})
it('an ignored abort from a delayed share response cannot publish its token or identity', async () => {
 let resolve!: (value: unknown) => void
 transport.post.mockImplementation(() => new Promise(ready => {resolve = ready}))
 saveToken(token(3), true)
 const session = new SessionApplication(), request = new AbortController()
 const pending = session.authenticateShare('old-share', '', true, request.signal)
 request.abort()
 resolve({data: {token: `header.${btoa(JSON.stringify({id: 1, type: 2}))}.signature`, project_id: 1}})
 await expect(pending).rejects.toMatchObject({name: 'AbortError'})
 expect(getTokenIdentity(getToken())).toEqual({id: 3, type: 1})
 expect(session.getState().get('shareHash')).toBe('')
 expect(session.getState().get('user')).toBeNull()
 session.destroy()
})
it('a canceled user read after successful login cannot publish the new identity or persist its token', async () => {
 let resolve!: (value: unknown) => void
 transport.post.mockResolvedValue({data: {token: token(2)}})
 transport.get.mockImplementation(() => new Promise(ready => {resolve = ready}))
 saveToken(token(1), true)
 const session = new SessionApplication(), request = new AbortController()
 const pending = session.login({username: 'new-user', password: 'fixture-password', long_token: false}, request.signal)
 await vi.waitFor(() => expect(resolve).toBeDefined())
 request.abort(); resolve({data: {id: 2, username: 'new-user'}})
 await expect(pending).rejects.toMatchObject({name: 'AbortError'})
 expect(getTokenIdentity(getToken())).toEqual({id: 1, type: 1})
 expect(getTokenIdentity(localStorage.getItem('token'))).toEqual({id: 1, type: 1})
 expect(session.getState().get('user')).toBeNull()
 session.destroy()
})
it('registration retries only rejected language metadata and publishes the backend user as a personal identity', async () => {
 transport.post.mockRejectedValueOnce({response: {data: {code: 2002, invalid_fields: ['language: Unsupported language']}}})
 transport.post.mockResolvedValueOnce({data: {}})
 transport.post.mockResolvedValueOnce({data: {token: token(2)}})
 transport.get.mockResolvedValue({data: {id: 2, username: 'registered-user'}})
 const session = new SessionApplication(), signal = new AbortController().signal
 await session.register({username: 'registered-user', email: 'fixture@example.com', password: 'fixture-password'}, 'xx', signal)
 expect(transport.post).toHaveBeenNthCalledWith(1, 'register', {username: 'registered-user', email: 'fixture@example.com', password: 'fixture-password', language: 'xx'}, {signal})
 expect(transport.post).toHaveBeenNthCalledWith(2, 'register', {username: 'registered-user', email: 'fixture@example.com', password: 'fixture-password', language: 'en'}, {signal})
 expect(transport.post).toHaveBeenCalledTimes(3)
 expect(session.getState().get('user')?.type).toBe(1)
 expect(session.getState().get('user')?.username).toBe('registered-user')
 session.destroy()
})
for (const abort of [true, false]) it(`OIDC identity cannot publish after ${abort ? 'navigation abort' : 'a newer session transition'}`, async () => {
 let resolve!: (value: unknown) => void
 transport.post.mockResolvedValue({data: {token: token(2)}})
 transport.get.mockImplementation(() => new Promise(ready => {resolve = ready}))
 saveToken(token(1), true); localStorage.removeItem('loggedInViaProvider')
 const session = new SessionApplication(), request = new AbortController()
 session.getState().set('config', {auth: {openid_connect: {enabled: true, providers: [{key: 'fixture', name: 'Fixture', auth_url: 'http://127.0.0.1:18765/authorize', client_id: 'fixture', scope: 'openid'}]}}})
 const pending = session.openId('fixture', 'code', undefined, request.signal)
 await vi.waitFor(() => expect(resolve).toBeDefined())
 if (abort) request.abort(); else session.getState().set('transition', 1)
 resolve({data: {id: 2, username: 'new-user'}})
 await expect(pending).rejects.toMatchObject({name: 'AbortError'})
 expect(getTokenIdentity(getToken())).toEqual({id: 1, type: 1});expect(localStorage.getItem('loggedInViaProvider')).toBeNull();expect(session.getState().get('user')).toBeNull()
 session.destroy()
})
