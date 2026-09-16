import {describe, it, expect, vi} from 'vitest'

import {getDisplayName} from './user'
import {fetchAvatarBlobUrl, invalidateAvatarCache} from '@/helpers/avatarCache'
import type {IUser} from '@/modelTypes/IUser'

const {getBlobUrl} = vi.hoisted(() => ({getBlobUrl: vi.fn()}))

vi.mock('@/services/avatar', () => ({
	default: class {
		getBlobUrl = getBlobUrl
	},
}))

function makeUser(overrides: Partial<IUser> = {}): IUser {
	return {
		id: 1,
		email: 'test@example.com',
		username: 'testuser',
		name: '',
		exp: 0,
		type: 1,
		created: new Date(),
		updated: new Date(),
		settings: {} as IUser['settings'],
		isLocalUser: true,
		pendingEmail: '',
		deletionScheduledAt: null,
		...overrides,
	}
}

describe('getDisplayName', () => {
	it('should return the name when set', () => {
		const user = makeUser({name: 'Jane Doe'})
		expect(getDisplayName(user)).toBe('Jane Doe')
	})

	it('should fall back to username when name is empty', () => {
		const user = makeUser({name: '', username: 'janedoe'})
		expect(getDisplayName(user)).toBe('janedoe')
	})
})

describe('fetchAvatarBlobUrl', () => {
	it('should resolve to undefined for a user without a username', async () => {
		await expect(fetchAvatarBlobUrl({} as IUser)).resolves.toBeUndefined()
	})
})

describe('invalidateAvatarCache', () => {
	it('revokes the dropped blob urls, but only once the version bump rendered', async () => {
		const revoke = vi.spyOn(window.URL, 'revokeObjectURL').mockImplementation(() => {})

		getBlobUrl.mockResolvedValueOnce('blob:stale-40')
		await fetchAvatarBlobUrl({username: 'stale'}, 40)
		getBlobUrl.mockResolvedValueOnce('blob:stale-20')
		await fetchAvatarBlobUrl({username: 'stale'}, 20)
		getBlobUrl.mockResolvedValueOnce('blob:kept-40')
		await fetchAvatarBlobUrl({username: 'kept'}, 40)

		invalidateAvatarCache({username: 'stale'})
		// A live <img> still holds the url until the subscribers have re-rendered.
		expect(revoke).not.toHaveBeenCalled()

		await new Promise(resolve => requestAnimationFrame(resolve))

		expect(revoke).toHaveBeenCalledTimes(2)
		expect(revoke).toHaveBeenCalledWith('blob:stale-40')
		expect(revoke).toHaveBeenCalledWith('blob:stale-20')

		revoke.mockRestore()
	})

	it('drops the result of a request that an invalidation overtook', async () => {
		let resolveStale: (url: string) => void = () => {}
		getBlobUrl.mockReturnValueOnce(new Promise(resolve => {
			resolveStale = resolve
		}))

		const inFlight = fetchAvatarBlobUrl({username: 'raced'}, 40)

		invalidateAvatarCache({username: 'raced'})
		resolveStale('blob:before-invalidation')
		await inFlight

		// A later read must go back to the service rather than reuse the overtaken answer.
		getBlobUrl.mockResolvedValueOnce('blob:after-invalidation')
		await expect(fetchAvatarBlobUrl({username: 'raced'}, 40)).resolves.toBe('blob:after-invalidation')
	})

	it('still caches a request for a user another invalidation did not touch', async () => {
		getBlobUrl.mockResolvedValueOnce('blob:bystander')
		const inFlight = fetchAvatarBlobUrl({username: 'bystander'}, 40)
		invalidateAvatarCache({username: 'somebody-else'})
		await inFlight

		getBlobUrl.mockResolvedValueOnce('blob:unused')
		await expect(fetchAvatarBlobUrl({username: 'bystander'}, 40)).resolves.toBe('blob:bystander')
	})
})
