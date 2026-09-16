import type {IUser} from '@/modelTypes/IUser'
import AvatarService from '@/services/avatar'

const avatarService = new AvatarService()

function afterRender(callback: () => void) {
	if (typeof requestAnimationFrame === 'function') {
		requestAnimationFrame(callback)
		return
	}
	setTimeout(callback, 0)
}
const avatarCache = new Map<string, string>()
const pendingRequests = new Map<string, Promise<string>>()

type InvalidationListener = (username: string) => void

const invalidationListeners = new Set<InvalidationListener>()

/**
 * Anything rendering a cached avatar subscribes here and refetches when its user is invalidated.
 * A plain subscription rather than a reactive map, so non-Vue views can listen too.
 */
export function onAvatarInvalidated(listener: InvalidationListener): () => void {
	invalidationListeners.add(listener)
	return () => {
		invalidationListeners.delete(listener)
	}
}

// Returns undefined, never '': Vue renders src="" which the browser resolves to the page
// URL and reports as a failed image load.
export async function fetchAvatarBlobUrl(user: Pick<IUser, 'username'>, size = 50): Promise<string | undefined> {
	if (!user || !user.username) {
		return undefined
	}
	const key = `${user.username}-${size}`

	const cached = avatarCache.get(key)
	if (cached) {
		return cached
	}

	const pending = pendingRequests.get(key)
	if (pending) {
		return await pending
	}

	const requestPromise = avatarService.getBlobUrl(`/avatar/${user.username}?size=${size}`)
		.then(url => {
			avatarCache.set(key, url)
			pendingRequests.delete(key)
			return url
		})
		.catch(error => {
			pendingRequests.delete(key)
			throw error
		})

	pendingRequests.set(key, requestPromise)
	return await requestPromise
}

export function invalidateAvatarCache(user: Pick<IUser, 'username'>) {
	if (!user || !user.username) {
		return
	}

	const staleUrls: string[] = []
	for (const key of Array.from(avatarCache.keys())) {
		if (key.startsWith(`${user.username}-`))
		{
			const url = avatarCache.get(key)
			if (url) {
				staleUrls.push(url)
			}
			avatarCache.delete(key)
		}
	}

	for (const key of Array.from(pendingRequests.keys())) {
		if (key.startsWith(`${user.username}-`))
		{
			pendingRequests.delete(key)
		}
	}

	invalidationListeners.forEach(listener => listener(user.username))

	// Only after the listeners have rendered: revoking a url a live <img> still holds
	// breaks it on the next re-decode (print, content-visibility).
	afterRender(() => staleUrls.forEach(url => window.URL.revokeObjectURL(url)))
}
