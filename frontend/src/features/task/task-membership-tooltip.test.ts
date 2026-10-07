/// <reference types="node" />
import {afterEach, expect, it, vi} from 'vitest'
import {Region} from 'marionette'
import {AvatarTooltipView} from './task-membership-user'
import {readFileSync} from 'node:fs'
import {dirname, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'
const baseStyles = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/components/tooltip-base.scss'), 'utf8')
const themeStyles = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/components/tooltip.scss'), 'utf8').replace('@import "tooltip-base";', '').replace(/^\/\/.*$/gm, '')

const position = vi.hoisted(() => vi.fn())
vi.mock('@floating-ui/dom', async importOriginal => ({
	...await importOriginal<typeof import('@floating-ui/dom')>(), computePosition: position,
}))
let region: InstanceType<typeof Region> | undefined
afterEach(() => {region?.destroy(); position.mockReset(); document.head.querySelector('[data-tooltip-test-style]')?.remove(); document.body.replaceChildren(); document.documentElement.classList.remove('dark'); document.documentElement.style.removeProperty('--white'); document.documentElement.style.removeProperty('--grey-900')})
function mount() {
	const style = document.createElement('style')
	style.dataset.tooltipTestStyle = ''
	style.textContent = themeStyles + baseStyles
	document.head.append(style)
	const host = document.createElement('div'), trigger = document.createElement('img')
	document.body.append(trigger, host)
	region = new Region({el: host})
	const tooltip = new AvatarTooltipView({trigger, text: 'Creator'})
	region.show(tooltip)
	return tooltip
}
it.each(['top', 'bottom'] as const)('real tooltip placement %s selects original vendor arrow rules', async placement => {
	position.mockResolvedValue({placement, x: 20, y: 30, middlewareData: {arrow: {x: 7}}})
	const tooltip = mount()
	await vi.waitFor(() => expect(tooltip.el.getAttribute('data-popper-placement')).toBe(placement))
	const arrow = tooltip.el.querySelector<HTMLElement>('.v-popper__arrow-container')!, outer = tooltip.el.querySelector<HTMLElement>('.v-popper__arrow-outer')!
	expect((tooltip.el as HTMLElement).style.transform).toBe('translate3d(20px, 30px, 0)')
	expect(getComputedStyle(tooltip.el).zIndex).toBe('10000')
	expect(getComputedStyle(tooltip.el).visibility).toBe('visible')
	const inner = tooltip.el.querySelector<HTMLElement>('.v-popper__inner')!, innerStyle = getComputedStyle(inner)
	expect(innerStyle.paddingTop).toBe('7px')
	expect(innerStyle.paddingRight).toBe('12px')
	expect(innerStyle.paddingBottom).toBe('6px')
	expect(innerStyle.borderRadius).toBe('6px')
	expect(innerStyle.backgroundColor).toBe('rgba(0, 0, 0, .8)')
	expect(getComputedStyle(arrow).position).toBe('absolute')
	expect(getComputedStyle(arrow).width).toBe('10px')
	expect(arrow.style.left).toBe('7px')
	expect(getComputedStyle(outer).borderStyle).toBe('solid')
	expect(getComputedStyle(outer).borderLeftColor).toBe('transparent')
	expect(getComputedStyle(outer).borderRightColor).toBe('transparent')
	expect(getComputedStyle(outer)[placement === 'top' ? 'borderBottomWidth' : 'borderTopWidth']).toBe('0px')
	expect(getComputedStyle(outer)[placement === 'top' ? 'borderTopWidth' : 'borderBottomWidth']).toBe('6px')
	if (placement === 'bottom') {
		expect(getComputedStyle(arrow).top).toBe('0px')
		expect(getComputedStyle(outer).top).toBe('-6px')
	}
})
it('destroying real tooltip before positioning settles cannot publish late placement styles', async () => {
	let finish!: (value: unknown) => void
	position.mockReturnValue(new Promise(resolve => {finish = resolve}))
	const tooltip = mount()
	region!.empty()
	finish({placement: 'top', x: 20, y: 30, middlewareData: {arrow: {x: 7}}})
	await Promise.resolve()
	expect(tooltip.isDestroyed()).toBe(true)
	expect(tooltip.el.getAttribute('data-popper-placement')).toBeNull()
	expect((tooltip.el as HTMLElement).style.transform).toBe('')
	expect(document.querySelector('[role=tooltip]')).toBeNull()
})

it.each(['light', 'dark'] as const)('original vendor import order keeps default sizing and %s theme colors', async theme => {
	position.mockResolvedValue({placement: 'top', x: 20, y: 30, middlewareData: {arrow: {x: 7}}})
	if (theme === 'dark') document.documentElement.classList.add('dark')
	// Distinct diagnostic tokens prove that the original dark selector wins;
	// actual theme token values are verified by the parent's paired captures.
	document.documentElement.style.setProperty('--white', 'rgb(11, 12, 13)')
	document.documentElement.style.setProperty('--grey-900', 'rgb(21, 22, 23)')
	const tooltip = mount(), inner = tooltip.el.querySelector<HTMLElement>('.v-popper__inner')!
	const style = getComputedStyle(inner)
	expect(style.paddingTop).toBe('7px')
	expect(style.paddingRight).toBe('12px')
	expect(style.paddingBottom).toBe('6px')
	expect(style.borderRadius).toBe('6px')
	expect(style.backgroundColor).toBe(theme === 'dark' ? 'rgb(11, 12, 13)' : 'rgba(0, 0, 0, .8)')
	expect(style.color).toBe(theme === 'dark' ? 'rgb(21, 22, 23)' : '#fff')
})
