
import AbstractModel from './abstractModel'
import UserSettingsModel from '@/models/userSettings'

import { AUTH_TYPES, type IUser, type AuthType } from '@/modelTypes/IUser'
import type { IUserSettings } from '@/modelTypes/IUserSettings'
import AvatarService from '@/services/avatar'

const avatarService = new AvatarService()
const avatarCache = new Map<string, string>()
const pendingRequests = new Map<string, Promise<string>>()

// Bumped on invalidation so components rendering that user's cached avatar refetch it.


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

const avatarListeners = new Map<string, Set<() => void>>()
export function observeAvatar(username: string, changed: () => void) {
	const listeners = avatarListeners.get(username) ?? new Set<() => void>()
	avatarListeners.set(username, listeners); listeners.add(changed)
	return () => { listeners.delete(changed); if (!listeners.size) avatarListeners.delete(username) }
}

export function invalidateAvatarCache(user: Pick<IUser, 'username'>) {
	if (!user || !user.username) {
		return
	}

	const staleUrls: string[] = []
	for (const key of Array.from(avatarCache.keys())) {
		if (key.startsWith(`${user.username}-`)) {
			const url = avatarCache.get(key)
			if (url) {
				staleUrls.push(url)
			}
			avatarCache.delete(key)
		}
	}

	for (const key of Array.from(pendingRequests.keys())) {
		if (key.startsWith(`${user.username}-`)) {
			pendingRequests.delete(key)
		}
	}


	// Only after the version bump rendered: revoking a url a live <img> still holds
	// breaks it on the next re-decode (print, content-visibility).
	for (const changed of avatarListeners.get(user.username) ?? []) changed()
	queueMicrotask(() => staleUrls.forEach(url => window.URL.revokeObjectURL(url)))
}

export function getDisplayName(user: IUser) {
	if (user.name !== '') {
		return user.name
	}

	return user.username
}

export default class UserModel extends AbstractModel<IUser> implements IUser {
	id = 0
	email = ''
	username = ''
	name = ''
	exp = 0
	type: AuthType = AUTH_TYPES.UNKNOWN

	created = new Date(NaN)
	updated = new Date(NaN)
	settings: IUserSettings = new UserSettingsModel({})

	isLocalUser = false
	pendingEmail = ''
	deletionScheduledAt: IUser['deletionScheduledAt'] = null
	isAdmin?: boolean
	botOwnerId = 0

	constructor(data: Partial<IUser> = {}) {
		super()
		this.assignData(data)

		this.created = new Date(this.created)
		this.updated = new Date(this.updated)

		this.settings = new UserSettingsModel(this.settings || {})
	}

	get isBot(): boolean {
		return (this.botOwnerId ?? 0) > 0
	}
}
