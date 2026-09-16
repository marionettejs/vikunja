import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'

vi.mock('@/helpers/avatarCache', async importOriginal => {
	const original = await importOriginal<typeof import('@/helpers/avatarCache')>()
	return {...original, fetchAvatarBlobUrl: vi.fn(async () => 'blob:avatar')}
})

import {fetchAvatarBlobUrl, invalidateAvatarCache} from '@/helpers/avatarCache'
import {UserAvatarView} from './UserAvatarView'
import type {UserAvatarViewInstance} from './UserAvatarView'

const fetchMock = vi.mocked(fetchAvatarBlobUrl)

describe('UserAvatarView', () => {
	const views: UserAvatarViewInstance[] = []

	function create(options: {username: string, size?: number, alt?: string}) {
		const view = new UserAvatarView(options)
		views.push(view)
		view.render()
		document.body.appendChild(view.el)
		return view
	}

	const settled = () => new Promise(resolve => setTimeout(resolve, 0))

	beforeEach(() => {
		document.body.innerHTML = ''
		fetchMock.mockReset()
		fetchMock.mockResolvedValue('blob:avatar')
	})

	afterEach(() => {
		views.splice(0).forEach(view => view.destroy())
		document.body.innerHTML = ''
	})

	it('renders a sized placeholder until the blob url resolves', () => {
		const view = create({username: 'user1', size: 40})

		expect(view.el.querySelector('img')).toBeNull()
		expect(view.el.querySelector('.user-avatar-placeholder')?.getAttribute('style'))
			.toContain('--user-avatar-size: 40px')
	})

	it('renders the image once the blob url resolves', async () => {
		const view = create({username: 'user1', size: 40})
		await settled()

		const img = view.el.querySelector('img')!
		expect(img.getAttribute('src')).toBe('blob:avatar')
		expect(img.getAttribute('width')).toBe('40')
		expect(img.getAttribute('alt')).toBe('')
		expect(fetchMock).toHaveBeenCalledWith({username: 'user1'}, 40)
	})

	it('keeps a missing avatar as a placeholder instead of raising', async () => {
		fetchMock.mockRejectedValue(new Error('nope'))
		const view = create({username: 'ghost'})
		await settled()

		expect(view.el.querySelector('img')).toBeNull()
		expect(view.el.querySelector('.user-avatar-placeholder')).not.toBeNull()
	})

	it('refetches when its own user is invalidated and ignores other users', async () => {
		create({username: 'user1', size: 40})
		await settled()
		expect(fetchMock).toHaveBeenCalledTimes(1)

		invalidateAvatarCache({username: 'someone-else'})
		await settled()
		expect(fetchMock).toHaveBeenCalledTimes(1)

		fetchMock.mockResolvedValueOnce('blob:new')
		invalidateAvatarCache({username: 'user1'})
		await settled()

		expect(views[0].el.querySelector('img')?.getAttribute('src')).toBe('blob:new')
	})

	it('drops a stale fetch when the user changes mid-flight', async () => {
		let resolveFirst: (url: string) => void = () => {}
		fetchMock.mockReturnValueOnce(new Promise(resolve => {
			resolveFirst = resolve
		}))

		const view = create({username: 'slow', size: 40})
		fetchMock.mockResolvedValueOnce('blob:second')
		view.setUser('fast')
		await settled()

		resolveFirst('blob:first')
		await settled()

		expect(view.el.querySelector('img')?.getAttribute('src')).toBe('blob:second')
	})

	it('stops listening once destroyed', async () => {
		const view = create({username: 'user1'})
		await settled()
		view.destroy()

		invalidateAvatarCache({username: 'user1'})
		await settled()

		expect(fetchMock).toHaveBeenCalledTimes(1)
	})
})
