<script setup lang="ts">
import {onMounted, onUnmounted, watch, ref, nextTick, computed} from 'vue'
import {useRouter, useRoute} from 'vue-router'
import {i18n} from '@/i18n'
import {useAuthStore, JUST_LOGGED_OUT_KEY} from '@/stores/auth'
import {useConfigStore} from '@/stores/config'
import {useRedirectToLastVisited} from '@/composables/useRedirectToLastVisited'
import {isDesktopApp} from '@/helpers/desktopAuth'
import {REDIRECT_HASH_PREFIX} from '@/constants/redirectHash'
import {getAutoRedirectProvider, redirectToProvider} from '@/helpers/redirectToProvider'
import {getErrorText} from '@/message'
import {LoginFormView, type LoginFormViewInstance} from '@/marionette/views/LoginFormView'
import DesktopLogin from '@/views/user/DesktopLogin.vue'

import {useTitle} from '@/composables/useTitle'

const {t} = i18n.global
useTitle(() => t('user.auth.login'))

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const configStore = useConfigStore()
const {redirectIfSaved} = useRedirectToLastVisited()

const registrationEnabled = computed(() => configStore.auth.local.registrationEnabled)
const localAuthEnabled = computed(() => configStore.auth.local.enabled)
const ldapAuthEnabled = computed(() => configStore.auth.ldap.enabled)

const openidConnect = computed(() => configStore.auth.openidConnect)

const isLoading = computed(() => authStore.isLoading)
const isDesktop = isDesktopApp()

const confirmedEmailSuccess = ref(false)
const errorMessage = ref('')
const needsTotpPasscode = ref(authStore.needsTotpPasscode)

let formView: LoginFormViewInstance | null = null
let isMounted = false

function destroyFormView(): void {
	if (formView) {
		formView.destroy()
		formView = null
	}
}

async function handleSubmit(credentials: {username: string; password: string; longToken: boolean; totpPasscode?: string}) {
	errorMessage.value = ''

	try {
		await authStore.login(credentials)
		authStore.setNeedsTotpPasscode(false)
		needsTotpPasscode.value = false
		redirectIfSaved()
	} catch (e: unknown) {
		const code = (e as {response?: {data?: {code?: number}}})?.response?.data?.code
		if (code === 1017 && !credentials.totpPasscode) {
			needsTotpPasscode.value = true
			formView?.setNeedsTotpPasscode(true)
			return
		}

		errorMessage.value = getErrorText(e)
		formView?.setErrorMessage(errorMessage.value)
	}
}

function handleForgotPassword(): void {
	router.push({name: 'user.password-reset.request'})
}

function handleRegister(): void {
	router.push({name: 'user.register'})
}

function handleOpenIdProviderClick(providerKey: string): void {
	const provider = openidConnect.value.providers?.find(p => p.key === providerKey)
	if (provider) {
		redirectToProvider(provider)
	}
}

async function renderFormView(): Promise<void> {
	destroyFormView()

	if (isDesktop) {
		return
	}

	if (!localAuthEnabled.value && !ldapAuthEnabled.value && !openidConnect.value.enabled) {
		return
	}

	await nextTick()

	const formEl = document.getElementById('login-form-host')
	if (!formEl) {
		return
	}

	formView = new LoginFormView({
		t,
		localAuthEnabled: localAuthEnabled.value,
		ldapAuthEnabled: ldapAuthEnabled.value,
		registrationEnabled: registrationEnabled.value,
		openidEnabled: openidConnect.value.enabled,
		openidProviders: (openidConnect.value.providers ?? []).map(p => ({
			key: p.key,
			label: t('user.auth.loginWith', {provider: p.name}),
		})),
		needsTotpPasscode: needsTotpPasscode.value,
		loading: isLoading.value,
		errorMessage: errorMessage.value,
		confirmedEmailSuccess: confirmedEmailSuccess.value,
		onSubmit: handleSubmit,
		onForgotPassword: handleForgotPassword,
		onRegister: handleRegister,
		onOpenIdProviderClick: handleOpenIdProviderClick,
	}) as LoginFormViewInstance

	formEl.appendChild(formView.el)
	formView.render()
}

async function checkAutoRedirect(justLoggedOut: boolean): Promise<void> {
	const autoRedirectProvider = getAutoRedirectProvider({
		localAuthEnabled: localAuthEnabled.value,
		ldapAuthEnabled: ldapAuthEnabled.value,
		openIdEnabled: openidConnect.value.enabled,
		providers: openidConnect.value.providers ?? [],
		isDesktopApp: isDesktop,
		justLoggedOut,
		hasCopyableRedirect: route.hash.startsWith(REDIRECT_HASH_PREFIX),
	})

	if (autoRedirectProvider) {
		redirectToProvider(autoRedirectProvider)
	}
}

async function initPage(): Promise<void> {
	try {
		const confirmed = await authStore.verifyEmail()
		confirmedEmailSuccess.value = confirmed
		if (formView) {
			formView.setConfirmedEmailSuccess(confirmed)
		}
	} catch (e) {
		errorMessage.value = getErrorText(e)
		if (formView) {
			formView.setErrorMessage(errorMessage.value)
		}
	}

	if (authStore.authenticated) {
		router.push({name: 'home'})
		return
	}

	const justLoggedOut = sessionStorage.getItem(JUST_LOGGED_OUT_KEY) !== null
	if (justLoggedOut) {
		sessionStorage.removeItem(JUST_LOGGED_OUT_KEY)
	}

	await checkAutoRedirect(justLoggedOut)
}

onMounted(async () => {
	isMounted = true
	await initPage()
	renderFormView()
})

onUnmounted(() => {
	isMounted = false
	destroyFormView()
})

watch(
	() => [isLoading.value, needsTotpPasscode.value, errorMessage.value, confirmedEmailSuccess.value] as const,
	() => {
		if (formView) {
			formView.setLoading(isLoading.value)
			formView.setNeedsTotpPasscode(needsTotpPasscode.value)
			formView.setErrorMessage(errorMessage.value)
			formView.setConfirmedEmailSuccess(confirmedEmailSuccess.value)
		}
	},
)

watch(
	() => authStore.needsTotpPasscode,
	(needs) => {
		needsTotpPasscode.value = needs
	},
)

watch(i18n.global.locale, () => {
	if (isMounted) {
		renderFormView()
	}
})

watch(
	() => [localAuthEnabled.value, ldapAuthEnabled.value, registrationEnabled.value, openidConnect.value] as const,
	() => {
		if (isMounted && !isDesktop) {
			renderFormView()
		}
	},
)
</script>

<template>
	<div>
		<DesktopLogin v-if="isDesktop" />

		<div
			v-else
			id="login-form-host"
		/>
	</div>
</template>