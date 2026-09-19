<script setup lang="ts">
import {onMounted, onUnmounted, watch, ref, nextTick} from 'vue'
import {useRoute} from 'vue-router'
import {i18n} from '@/i18n'
import {getErrorText} from '@/message'
import {AuthenticatedHTTPFactory} from '@/helpers/fetcher'
import {OAuthAuthorizeView, type OAuthAuthorizeViewInstance} from '@/marionette/views/OAuthAuthorizeView'

import {useTitle} from '@/composables/useTitle'

const {t} = i18n.global
useTitle(() => t('user.auth.authenticating'))

const route = useRoute()

const loading = ref(true)
const errorMessage = ref('')
const redirectedToApp = ref(false)

const requiredParams = [
	'response_type',
	'client_id',
	'redirect_uri',
	'code_challenge',
	'code_challenge_method',
] as const

let oauthView: OAuthAuthorizeViewInstance | null = null
let isMounted = false
let renderGeneration = 0
let authorizeGeneration = 0

function destroyOAuthView(): void {
	if (oauthView) {
		oauthView.destroy()
		oauthView = null
	}
}

async function authorize(): Promise<void> {
	const generation = ++authorizeGeneration
	const missing = requiredParams.filter(p => !route.query[p])
	if (missing.length > 0) {
		if (!isMounted || generation !== authorizeGeneration) {
			return
		}
		errorMessage.value = t('user.auth.oauthMissingParams', {params: missing.join(', ')})
		loading.value = false
		oauthView?.setErrorMessage(errorMessage.value)
		oauthView?.setLoading(false)
		return
	}

	try {
		const HTTP = AuthenticatedHTTPFactory()
		const response = await HTTP.post('oauth/authorize', {
			response_type: route.query.response_type,
			client_id: route.query.client_id,
			redirect_uri: route.query.redirect_uri,
			state: route.query.state,
			code_challenge: route.query.code_challenge,
			code_challenge_method: route.query.code_challenge_method,
		})

		if (!isMounted || generation !== authorizeGeneration) {
			return
		}

		const {code, redirect_uri, state} = response.data

		const redirectUrl = new URL(redirect_uri as string)
		redirectUrl.searchParams.set('code', code as string)
		if (state) {
			redirectUrl.searchParams.set('state', state as string)
		}

		redirectedToApp.value = true
		loading.value = false
		oauthView?.setRedirectedToApp(true)
		oauthView?.setLoading(false)

		window.location.href = redirectUrl.toString()
	} catch (e) {
		if (!isMounted || generation !== authorizeGeneration) {
			return
		}
		errorMessage.value = getErrorText(e)
		loading.value = false
		oauthView?.setErrorMessage(errorMessage.value)
		oauthView?.setLoading(false)
	}
}

async function renderOAuthView(): Promise<void> {
	const generation = ++renderGeneration
	destroyOAuthView()

	await nextTick()

	if (!isMounted || generation !== renderGeneration) {
		return
	}

	const hostEl = document.getElementById('oauth-authorize-host')
	if (!hostEl) {
		return
	}

	oauthView = new OAuthAuthorizeView({
		t,
		loading: loading.value,
		errorMessage: errorMessage.value,
		redirectedToApp: redirectedToApp.value,
	}) as OAuthAuthorizeViewInstance

	hostEl.appendChild(oauthView.el)
	oauthView.render()
}

onMounted(async () => {
	isMounted = true
	await renderOAuthView()
	await authorize()
})

onUnmounted(() => {
	isMounted = false
	authorizeGeneration++
	renderGeneration++
	destroyOAuthView()
})

watch(
	() => [loading.value, errorMessage.value, redirectedToApp.value] as const,
	() => {
		if (oauthView) {
			oauthView.setLoading(loading.value)
			oauthView.setErrorMessage(errorMessage.value)
			oauthView.setRedirectedToApp(redirectedToApp.value)
		}
	},
)

watch(i18n.global.locale, () => {
	if (isMounted) {
		renderOAuthView()
	}
})
</script>

<template>
	<div id="oauth-authorize-host" />
</template>