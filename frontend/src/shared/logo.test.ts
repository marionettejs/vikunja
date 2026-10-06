import {afterEach, expect, it, vi} from 'vitest'
import {Region, type RegionInstance} from 'marionette'
import {LogoView} from './logo'
const owners: RegionInstance[] = []
afterEach(() => {for (const owner of owners.splice(0)) owner.destroy(); document.body.replaceChildren(); document.documentElement.classList.remove('dark'); vi.useRealTimers(); vi.restoreAllMocks()})
it('Region teardown clears the seasonal clock and disconnects theme observation', () => {
	vi.useFakeTimers()
	vi.setSystemTime(new Date('2026-05-31T23:30:00Z'))
	const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
	const el = document.createElement('div'); document.body.append(el)
	const region = new Region({el}); owners.push(region)
	const view = new LogoView({config: {allow_icon_changes: true}})
	region.show(view)
	expect(el.querySelectorAll('svg path')).toHaveLength(11)
	vi.advanceTimersByTime(3600000)
	expect(el.querySelectorAll('svg path')).toHaveLength(16)
	region.empty()
	expect(disconnect).toHaveBeenCalledOnce()
	expect(vi.getTimerCount()).toBe(0)
	expect(view.isDestroyed()).toBe(true)
})
