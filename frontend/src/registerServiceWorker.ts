import {getFullBaseUrl} from './helpers/getFullBaseUrl'

export async function registerServiceWorker(worker: ServiceWorkerContainer, signal: AbortSignal) {
	try {
		const registration = await worker.register(getFullBaseUrl() + 'sw.js')
		if (signal.aborted) return
		const updated = () => {
			if (!signal.aborted) document.dispatchEvent(new CustomEvent('swUpdated', {detail: registration}))
		}
		if (registration.waiting) updated()
		const observed = new WeakSet<ServiceWorker>()
		const watch = (installing: ServiceWorker | null) => {
			if (!installing || observed.has(installing) || signal.aborted) return
			observed.add(installing)
			const changed = () => {
				if (installing.state !== 'installed') return
				installing.removeEventListener('statechange', changed)
				if (!signal.aborted && worker.controller) updated()
			}
			installing.addEventListener('statechange', changed, {signal})
			changed()
		}
		registration.addEventListener('updatefound', () => watch(registration.installing), {signal})
		watch(registration.installing)
	} catch (error) {
		if (!signal.aborted) console.error('Error during service worker registration:', error)
	}
}
