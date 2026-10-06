import {test as original, expect} from '../../frontend/tests/support/fixtures'
import {UserFactory} from '../../frontend/tests/factories/user'
import {faker} from '@faker-js/faker'

// Keep reference and pilot screenshots deterministic without changing original fixtures.
export const test = original.extend({
	currentUser: async ({apiContext}, use) => {
		void apiContext
		faker.seed(42)
		const [user] = await UserFactory.create(1, {username: 'migration-reviewer', created: '2026-01-01T00:00:00Z', updated: '2026-01-01T00:00:00Z'})
		await use(user)
	},
})
export {expect}
