const changed = new Set<() => void>(), identity = new Set<() => void>()
export function observeTasks(onChanged: () => void, onIdentity: () => void) { changed.add(onChanged); identity.add(onIdentity); return () => { changed.delete(onChanged); identity.delete(onIdentity) } }

import type {ITask} from '@/modelTypes/ITask'

const cache = new Map<number, Promise<ITask>>()


export function getCachedTask(id: number): Promise<ITask> | undefined {
	return cache.get(id)
}

export function setCachedTask(id: number, task: Promise<ITask>) {
	cache.set(id, task)
}

// Takes the promise so a late rejection cannot evict a newer entry for the same id.
export function deleteCachedTask(id: number, task: Promise<ITask>) {
	if (cache.get(id) === task) {
		cache.delete(id)
	}
}

export function invalidateCachedTask(id: number) {
	cache.delete(id)
	for (const callback of changed) callback()
}

export function clearTaskCache() {
	cache.clear()
	for (const callback of identity) callback()
}
