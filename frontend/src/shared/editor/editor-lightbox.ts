import {View} from 'marionette'
import LitDomApi from '@mnjs/adapters/dom/lit-html'
import {html} from 'lit-html'
import {MIN_SCALE, clampScale, clampTranslate, wheelZoomFactor, zoomAround, type ZoomMetrics, type ZoomTransform} from '@/helpers/imageZoom'
import {listIcon} from '../task-list/list-ui'
export const EditorLightboxView = View.extend({
	ui: {container: '.image-lightbox', image: 'img', toolbar: '.image-lightbox__toolbar', loader: '.image-lightbox__loader', error: '.image-lightbox__error', level: '.image-lightbox__level', zoom: '[data-zoom]'},
	tagName: 'dialog', className: 'modal-dialog fullscreen',
	initialize(options: {url: string, alt: string, t: (key: string) => string, close: () => void}) { void options },
	attributes() { return {'aria-label': this.options.t('misc.imagePreview')} },
	templateContext() { return {...this.options, close: () => this.requestClose()} },
	template: ({url, alt, t, close}: {url: string, alt: string, t: (key: string) => string, close: () => void}) => html`<div class="modal-container"><button type="button" class="base-button base-button--type-button close d-print-none" aria-label=${t('misc.closeDialog')} @click=${close}>${listIcon('times')}</button><div class="modal-content"><div class="image-lightbox"><div class="image-lightbox__loader"><div class="loader-container is-loading"></div></div><p class="image-lightbox__error" hidden>${t('misc.imageLoadFailed')}</p><img src=${url} alt=${alt || t('misc.imagePreview')} tabindex="0" class="image-lightbox__image" draggable="false"><div class="image-lightbox__toolbar" hidden><button type="button" class="base-button base-button--type-button image-lightbox__button" aria-label=${t('misc.zoomOut')} data-zoom="out">${listIcon('minus')}</button><span class="image-lightbox__level" role="status" aria-live="polite">100%</span><button type="button" class="base-button base-button--type-button image-lightbox__button" aria-label=${t('misc.zoomIn')} data-zoom="in">${listIcon('plus')}</button><button type="button" class="base-button base-button--type-button image-lightbox__button" aria-label=${t('misc.resetZoom')} data-zoom="reset">${listIcon('undo')}</button></div></div></div></div>`,
	onAttach() { this.previousOverflow = document.body.style.overflow; this.previousFocus = document.activeElement; document.body.style.overflow = 'hidden'; if (!this.options.url.startsWith('blob:')) { this.options.close(); return }; (this.el as HTMLDialogElement).showModal(); this.stopLightbox = mountLightbox(this) },
	requestClose() { if (this.closeTimer) return; this.el.setAttribute('data-closing', ''); document.body.style.overflow = this.previousOverflow; this.closeTimer = setTimeout(() => this.options.close(), 150) },
	onBeforeDestroy() { clearTimeout(this.closeTimer); this.stopLightbox?.(); (this.el as HTMLDialogElement).close(); document.body.style.overflow = this.previousOverflow; if (this.previousFocus instanceof HTMLElement && this.previousFocus.isConnected) this.previousFocus.focus() },
	closeTimer: undefined as ReturnType<typeof setTimeout> | undefined, previousOverflow: '', previousFocus: null as Element | null,
	stopLightbox: undefined as (() => void) | undefined,
}).setDomApi(LitDomApi)
function mountLightbox(view: InstanceType<typeof EditorLightboxView>) {
	const ZOOM_STEP = 1.4

	const containerRef = {value: (view.getUI('container')![0] as HTMLElement)}
	const imageRef = {value: (view.getUI('image')![0] as HTMLImageElement)}
	const loaded = {value: false}
	const failed = {value: false}

	const scale = {value: MIN_SCALE}
	const translateX = {value: 0}
	const translateY = {value: 0}

	const isPanning = {value: false}
	const pointers = new Map<number, {x: number, y: number}>()
	let panStart = {x: 0, y: 0, translateX: 0, translateY: 0}
	let pinchStartDistance = 0
	let pinchStartScale = 1

	function reset() {
		scale.value = MIN_SCALE
		translateX.value = 0
		translateY.value = 0
	}

	function currentTransform(): ZoomTransform {
		return {scale: scale.value, translateX: translateX.value, translateY: translateY.value}
	}

	function applyTransform(next: ZoomTransform) {
		scale.value = next.scale
		translateX.value = next.translateX
		translateY.value = next.translateY
	}

	// a 0-sized box before load would give bogus transforms
	const zoomable = {get value() { return loaded.value && !failed.value }}

	// cached: measuring after a transform write forces a reflow
	let metrics: ZoomMetrics | null = null

	function refreshMetrics() {
		const image = imageRef.value
		const container = containerRef.value
		if (!zoomable.value || !image || !container || image.offsetWidth === 0) {
			metrics = null
			return
		}
		const rect = container.getBoundingClientRect()
		metrics = {
			imageWidth: image.offsetWidth,
			imageHeight: image.offsetHeight,
			containerWidth: container.clientWidth,
			containerHeight: container.clientHeight,
			centerX: rect.left + rect.width / 2,
			centerY: rect.top + rect.height / 2,
		}
	}

	function currentMetrics(): ZoomMetrics | null {
		if (metrics === null) {
			refreshMetrics()
		}
		return metrics
	}

	function onLoad() {
		loaded.value = true
		refreshMetrics()
	}

	function onResize() {
		refreshMetrics()
		clampPan()
	}



	function clampPan() {
		const measured = currentMetrics()
		if (measured === null) {
			return
		}
		applyTransform(clampTranslate(currentTransform(), measured))
	}

	function zoomAt(clientX: number, clientY: number, factor: number) {
		const measured = currentMetrics()
		if (measured === null) {
			return
		}
		applyTransform(zoomAround(currentTransform(), measured, clientX, clientY, factor))
	}

	function zoomByStep(factor: number) {
		const measured = currentMetrics()
		if (measured === null) {
			return
		}
		zoomAt(measured.centerX, measured.centerY, factor)
	}

	function onWheel(event: WheelEvent) {
		zoomAt(event.clientX, event.clientY, wheelZoomFactor(event.deltaY, event.deltaMode))
	}

	function toggleZoom(event: MouseEvent) {
		if (scale.value > MIN_SCALE) {
			reset()
		} else {
			zoomAt(event.clientX, event.clientY, 2.5)
		}
	}

	// arrows move the viewport, so the image travels the opposite way; a Map so prototype keys can't match
	const PAN_KEYS = new Map<string, {x: number, y: number}>([
		['ArrowLeft', {x: 1, y: 0}],
		['ArrowRight', {x: -1, y: 0}],
		['ArrowUp', {x: 0, y: 1}],
		['ArrowDown', {x: 0, y: -1}],
	])
	const PAN_STEP = 48

	function onKeyDown(event: KeyboardEvent) {
		if (!zoomable.value) {
			return
		}

		// Ctrl/Cmd+'-' also arrives as '-'; don't break browser zoom
		if (event.ctrlKey || event.metaKey || event.altKey) {
			return
		}

		switch (event.key) {
			case '+':
			case '=':
				event.preventDefault()
				zoomByStep(ZOOM_STEP)
				return
			case '-':
				event.preventDefault()
				zoomByStep(1 / ZOOM_STEP)
				return
			case '0':
				event.preventDefault()
				reset()
				return
		}

		const direction = PAN_KEYS.get(event.key)
		if (direction === undefined || scale.value <= MIN_SCALE) {
			return
		}
		const measured = currentMetrics()
		if (measured === null) {
			return
		}

		event.preventDefault()
		const transform = currentTransform()
		applyTransform(clampTranslate({
			scale: transform.scale,
			translateX: transform.translateX + direction.x * PAN_STEP,
			translateY: transform.translateY + direction.y * PAN_STEP,
		}, measured))
	}

	function pointerDistance(): number {
		const [a, b] = [...pointers.values()]
		return Math.hypot(a.x - b.x, a.y - b.y)
	}

	function onPointerDown(event: PointerEvent) {
		if (!zoomable.value) {
			return
		}
		imageRef.value?.setPointerCapture(event.pointerId)
		pointers.set(event.pointerId, {x: event.clientX, y: event.clientY})

		if (pointers.size === 2) {
			pinchStartDistance = pointerDistance()
			pinchStartScale = scale.value
		} else if (pointers.size === 1 && scale.value > MIN_SCALE) {
			isPanning.value = true
			panStart = {
				x: event.clientX,
				y: event.clientY,
				translateX: translateX.value,
				translateY: translateY.value,
			}
		}
	}

	function onPointerMove(event: PointerEvent) {
		if (!pointers.has(event.pointerId)) {
			return
		}
		pointers.set(event.pointerId, {x: event.clientX, y: event.clientY})

		if (pointers.size === 2 && pinchStartDistance > 0) {
			const [a, b] = [...pointers.values()]
			const target = clampScale(pinchStartScale * (pointerDistance() / pinchStartDistance))
			zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, target / scale.value)
		} else if (isPanning.value) {
			translateX.value = panStart.translateX + (event.clientX - panStart.x)
			translateY.value = panStart.translateY + (event.clientY - panStart.y)
			clampPan()
		}
	}

	function onPointerUp(event: PointerEvent) {
		pointers.delete(event.pointerId)
		if (pointers.size < 2) {
			pinchStartDistance = 0
		}
		if (pointers.size === 0) {
			isPanning.value = false
			return
		}
		if (pointers.size !== 1) {
			return
		}

		// re-anchor the pan on the surviving pointer, else the next move snaps
		const [survivor] = [...pointers.values()]
		panStart = {
			x: survivor.x,
			y: survivor.y,
			translateX: translateX.value,
			translateY: translateY.value,
		}
		isPanning.value = scale.value > MIN_SCALE
	}

	const life = new AbortController(), image = imageRef.value!, container = containerRef.value!
	function refresh() { image.style.transform = `translate(${translateX.value}px, ${translateY.value}px) scale(${scale.value})`; image.classList.toggle('is-loaded', loaded.value); image.classList.toggle('is-zoomed', scale.value > 1); image.classList.toggle('is-panning', isPanning.value); image.hidden = failed.value; (view.getUI('toolbar')![0] as HTMLElement)!.hidden = !loaded.value; (view.getUI('loader')![0] as HTMLElement)!.hidden = loaded.value || failed.value; (view.getUI('error')![0] as HTMLElement)!.hidden = !failed.value; (view.getUI('level')![0] as HTMLElement)!.textContent = `${Math.round(scale.value * 100)}%` }
	function bind<T extends Event>(element: EventTarget, event: string, handler: (event: T) => void) { element.addEventListener(event, e => { handler(e as T); refresh() }, {signal: life.signal}) }
	bind(image, 'load', onLoad); bind(image, 'error', () => { failed.value = true }); bind(image, 'dblclick', toggleZoom); bind(image, 'keydown', onKeyDown); bind(image, 'pointerdown', onPointerDown); bind(image, 'pointermove', onPointerMove); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(event => bind(image, event, onPointerUp)); bind<WheelEvent>(container, 'wheel', event => { event.preventDefault(); onWheel(event) }); bind<MouseEvent>(container, 'click', event => { if (event.target === container && event.detail <= 1) view.requestClose() }); bind(view.el, 'cancel', event => { event.preventDefault(); view.requestClose() }); bind(window, 'resize', onResize)
	let modalBeforePrint = false
	bind(window, 'beforeprint', () => { const dialog = view.el as HTMLDialogElement; if (dialog.matches(':modal')) { modalBeforePrint = true; dialog.close(); dialog.show() } })
	bind(window, 'afterprint', () => { const dialog = view.el as HTMLDialogElement; if (modalBeforePrint && dialog.open) { dialog.close(); dialog.showModal(); modalBeforePrint = false } })
	Array.from(view.getUI('zoom')! as ArrayLike<HTMLElement>).forEach(button => bind(button, 'click', () => { if (button.dataset.zoom === 'reset') reset(); else zoomByStep(button.dataset.zoom === 'in' ? ZOOM_STEP : 1 / ZOOM_STEP) }))
	if (image.complete && image.naturalWidth) onLoad(); refresh()
	return () => { life.abort(); pointers.clear() }
}
