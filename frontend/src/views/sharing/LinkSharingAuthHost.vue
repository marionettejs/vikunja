<script setup lang="ts">
import {onMounted, onUnmounted, ref, watch, nextTick} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import {i18n} from '@/i18n'
import {useTitle} from '@vueuse/core'
import Message from '@/components/misc/Message.vue'
import {LinkSharingPasswordView, type LinkSharingPasswordViewInstance} from '@/marionette/views/LinkSharingPasswordView'
import {LINK_SHARE_HASH_PREFIX} from '@/constants/linkShareHash'

import {useBaseStore} from '@/stores/base'
import {useAuthStore} from '@/stores/auth'
import {useRedirectToLastVisited} from '@/composables/useRedirectToLastVisited'
import type {IProject} from '@/modelTypes/IProject'

const {t} = i18n.global
useTitle(t('sharing.authenticating'))
const {getLastVisitedRoute} = useRedirectToLastVisited()

const baseStore = useBaseStore()
const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

const loading = ref(false)
const authenticateWithPassword = ref(false)
const errorMessage = ref('')

let passwordView: LinkSharingPasswordViewInstance | null = null
let isMounted = true

function destroyPasswordView(): void {
	if (passwordView) {
		passwordView.destroy()
		passwordView = null
	}
}

async function renderPasswordView(): Promise<void> {
	destroyPasswordView()

	const view = new LinkSharingPasswordView({
		t,
		loading: loading.value,
		errorMessage: errorMessage.value,
		onSubmit: (password: string) => {
			authenticate(password)
		},
	}) as LinkSharingPasswordViewInstance
	passwordView = view
	view.render()
	// Wait for the v-if container to enter the DOM before appending.
	await nextTick()
	if (!isMounted) {
		destroyPasswordView()
		return
	}
	const container = document.getElementById('password-view-container')
	if (container) {
		container.appendChild(view.el)
	}
}

async function redirectToProject(projectId: IProject['id']) {
	const hash = LINK_SHARE_HASH_PREFIX + route.params.share

	const viewId =
		new URLSearchParams(window.location.search).get('view') || null

	const last = getLastVisitedRoute()
	if (last) {
		return router.push({
			...last,
			hash,
		})
	}

	if (viewId) {
		return router.push({
			name: 'project.view',
			params: {
				projectId,
				viewId,
			},
			hash,
		})
	}

	return router.push({
		name: 'project.index',
		params: {
			projectId,
		},
		hash,
	})
}

async function authenticate(password = '') {
	errorMessage.value = ''

	if (authStore.authLinkShare) {
		// FIXME: push to 'project.list' since authenticated?
		return
	}

	loading.value = true
	if (passwordView) {
		passwordView.setLoading(true)
	}

	try {
		const {project_id: projectId} = await authStore.linkShareAuth({
			hash: route.params.share as string,
			password,
		})
		const logoVisible = route.query.logoVisible
			? route.query.logoVisible === 'true'
			: true
		baseStore.setLogoVisible(logoVisible)

		return redirectToProject(projectId)
	} catch (e: unknown) {
		const err = e as {response?: {status?: number; data?: {code?: number; message?: string}}}
		if (err?.response?.data?.code === 13001) {
			authenticateWithPassword.value = true
			return
		}

		// Handle generic 403 errors that might occur after initial auth
		if (err?.response?.status === 403 && !err?.response?.data?.code) {
			errorMessage.value = t('sharing.accessDenied')
			authenticateWithPassword.value = false
			return
		}

		// Handle network/server errors
		if ((err?.response?.status ?? 0) >= 500 || !err?.response) {
			errorMessage.value = t('sharing.serverError')
			authenticateWithPassword.value = false
			return
		}

		// Never log the error object itself: AxiosError.config.data holds the plaintext share password.
		console.error('Link share authentication error:', err?.response?.status, err?.response?.data?.code)

		// TODO: Put this logic in a global errorMessage handler method which checks all auth codes
		let errMsg = t('sharing.error')
		if (err?.response?.data?.message) {
			errMsg = err.response.data.message
		}
		if (err?.response?.data?.code === 13002) {
			errMsg = t('sharing.invalidPassword')
			authenticateWithPassword.value = true
		}
		errorMessage.value = errMsg
	} finally {
		loading.value = false
		if (passwordView) {
			passwordView.setLoading(false)
		}
		if (authenticateWithPassword.value && passwordView) {
			passwordView.setErrorMessage(errorMessage.value)
		}
	}
}

onMounted(() => {
	authenticate()
})

watch(() => authenticateWithPassword.value, (show) => {
	if (show) {
		renderPasswordView()
	} else {
		destroyPasswordView()
	}
})

watch(() => errorMessage.value, () => {
	if (passwordView) {
		passwordView.setErrorMessage(errorMessage.value)
	}
})

watch(i18n.global.locale, () => {
	if (isMounted && authenticateWithPassword.value) {
		renderPasswordView()
	}
})

onUnmounted(() => {
	isMounted = false
	destroyPasswordView()
})
</script>

<template>
	<div>
		<Message
			v-if="loading"
			variant="info"
		>
			{{ t('sharing.authenticating') }}
		</Message>
		<div
			v-if="authenticateWithPassword"
			id="password-view-container"
		/>
		<Message
			v-if="errorMessage !== ''"
			variant="danger"
			class="mbs-4"
		>
			{{ errorMessage }}
		</Message>
	</div>
</template>