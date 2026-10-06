import {expect, it} from 'vitest'
import {parseRoute, queryHref} from './routes'
it('retains repeated public query parameters without making them route identities', () => {
	const route = parseRoute(new URL('http://fixture/projects/12/3?filter=done%3Dfalse&page=2&tag=one&tag=two'))
	expect(route.kind).toBe('project'); expect(route.key).toBe('project:12:3'); expect(route.params).toEqual({projectId: '12', viewId: '3'}); expect(route.query.tag).toEqual(['one', 'two'])
	expect(parseRoute(new URL('http://fixture/projects/12/3?page=1')).key).toBe(route.key)
})
// Independently confirmed with pinned Vue reference vue-router 5.3.1 stringifyQuery.
it('serializes query removals and dates as normal browser URLs', () => {
	expect(queryHref('/projects/1/3', {sort: 'title:desc', filter: undefined, page: 2})).toBe('/projects/1/3?sort=title:desc&page=2')
	expect(parseRoute(new URL('http://fixture/tasks/5')).params.id).toBe('5')
})
