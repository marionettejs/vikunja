<template>
	<Modal
		variant="hint-modal"
		@close="$router.back()"
	>
		<Card
			class="has-no-shadow"
			:title="$t('about.title')"
			:padding="false"
			:show-close="true"
			@close="$router.back()"
		>
			<MarionetteViewHost :view-factory="versionViewFactory" />
			<template #footer>
				<XButton
					variant="secondary"
					@click.prevent.stop="$router.back()"
				>
					{{ $t('misc.close') }}
				</XButton>
			</template>
		</Card>
	</Modal>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'

import {VERSION as frontendVersion} from '@/version.json'
import {useConfigStore} from '@/stores/config'
import MarionetteViewHost from '@/components/bridge/MarionetteViewHost.vue'
import AboutVersionView from '@/marionette/views/AboutVersionView'

const {t, locale} = useI18n()
const configStore = useConfigStore()
const apiVersion = computed(() => configStore.version)
const versionsEqual = computed(() => apiVersion.value === frontendVersion)

const versionViewFactory = computed(() => {
	void locale.value
	const lines = versionsEqual.value
		? [t('about.version', {version: apiVersion.value})]
		: [
			t('about.frontendVersion', {version: frontendVersion}),
			t('about.apiVersion', {version: apiVersion.value}),
		]
	return () => new AboutVersionView({lines})
})
</script>
