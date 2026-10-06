import { UserFactory } from "../../frontend/tests/factories/user";
import { createHmac } from "node:crypto";
import { test, expect } from "./fixtures";
import { setupApiUrl } from "../../frontend/tests/support/authenticateUser";
const callback = "/auth/openid/fixture/callback";
test.beforeEach(async ({ page }) => {
	await setupApiUrl(page);
});
for (const width of [1440, 390])
	test(`OIDC actual signed provider login identity reload ${width}`, async ({
		page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/login");
		const button = page.getByRole("button", {
			name: "Log in with Isolated OIDC",
		});
		await expect(button).toBeVisible();
		await expect(button).toHaveCSS("background-color", "rgb(255, 255, 255)");
		await button.focus();
		await expect(button).toBeFocused();
		await page.screenshot({ path: info.outputPath(`oidc-login-${width}.png`) });
		const exchanged = page.waitForResponse(
			(r) => r.url().endsWith(callback) && r.request().method() === "POST",
		);
		await button.press("Enter");
		const response = await exchanged;
		expect(response.ok(), await response.text()).toBeTruthy();
		await expect(page).toHaveURL(/\/$/);
		expect(
			await page.evaluate(() => localStorage.getItem("loggedInViaProvider")),
		).toBe("fixture");
		const token = await page.evaluate(() => localStorage.getItem("token"));
		expect(token).toBeTruthy();
		const identity = await apiContext.get("user", {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(identity.ok()).toBeTruthy();
		expect(await identity.json()).toMatchObject({
			username: "oidc-fixture",
			name: "OIDC Fixture",
			is_local_user: false,
			auth_provider: "Isolated OIDC",
		});
		await page.reload();
		await expect(page).toHaveURL(/\/$/);
		await expect(page.locator("#loginform")).toHaveCount(0);
	});
test("OIDC wrong state and provider error never exchange and clear tab passcode", async ({
	page,
}) => {
	let calls = 0;
	page.on("request", (r) => {
		if (r.url().endsWith(callback)) calls++;
	});
	await page.goto("/login");
	await page.evaluate(() => {
		localStorage.setItem("state", "expected");
		sessionStorage.setItem("openid_pending_totp_fixture", "123456");
	});
	await page.goto("/auth/openid/fixture?state=wrong&code=unused");
	await expect(page.getByRole("alert")).toContainText(
		"State does not match, refusing to continue!",
	);
	expect(calls).toBe(0);
	expect(
		await page.evaluate(() =>
			sessionStorage.getItem("openid_pending_totp_fixture"),
		),
	).toBeNull();
	await page.goto(
		"/auth/openid/fixture?error=access_denied&message=Provider%20refused",
	);
	await expect(
		page.getByRole("alert").filter({ hasText: "Provider refused" }),
	).toContainText("Provider refused");
	await expect(page.getByText("access_denied", { exact: true })).toBeVisible();
	expect(calls).toBe(0);
});
test("OIDC real rejected authorization code exposes error and ends loading", async ({
	page,
}) => {
	await page.goto("/login");
	await page.evaluate(() => localStorage.setItem("state", "expected"));
	const exchanged = page.waitForResponse((r) => r.url().endsWith(callback));
	await page.goto("/auth/openid/fixture?state=expected&code=invalid");
	expect((await exchanged).ok()).toBeFalsy();
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page.getByText("Authenticating…", { exact: true })).toBeHidden();
	expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
});
test("OIDC delayed callback navigation cannot publish identity or redirect", async ({
	page,
}) => {
	await page.goto("/login");
	let seen = false,
		release!: () => void;
	const gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/auth/openid/fixture/callback", async (route) => {
		seen = true;
		await gate;
		await route.continue().catch(() => {});
	});
	try {
		const clicking = page
			.getByRole("button", { name: "Log in with Isolated OIDC" })
			.click({ noWaitAfter: true });
		await expect.poll(() => seen).toBeTruthy();
		await expect(
			page.getByText("Authenticating…", { exact: true }),
		).toBeVisible();
		await page.evaluate(() => {
			history.pushState({}, "", "/login");
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		await expect(page.locator("#username")).toBeFocused();
		release();
		await clicking;
		await page.waitForTimeout(250);
		await expect(page).toHaveURL(/\/login$/);
		expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
	} finally {
		release();
	}
});
test("OIDC TOTP challenge restart contract uses new single-use code and tab draft", async ({
	page,
}) => {
	// Frontend error contract fixture only; provider and subsequent backend exchange remain real.
	await page.route(
		"**/api/v1/auth/openid/fixture/callback",
		async (route) => {
			await route.fulfill({
				status: 412,
				json: { code: 1017, message: "TOTP required" },
			});
		},
		{ times: 1 },
	);
	await page.goto("/login");
	await page.getByRole("button", { name: "Log in with Isolated OIDC" }).click();
	const passcode = page.locator("#openIdTotpPasscode");
	await expect(passcode).toBeFocused();
	const first = new URL(page.url()).searchParams.get("code");
	await passcode.fill("123456");
	const exchanged = page.waitForResponse((r) => r.url().endsWith(callback));
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	const response = await exchanged;
	expect(response.request().postDataJSON()).toMatchObject({
		totp_passcode: "123456",
	});
	expect(response.request().postDataJSON().code).not.toBe(first);
	expect(response.ok()).toBeTruthy();
	await expect(page).toHaveURL(/\/$/);
	expect(
		await page.evaluate(() =>
			sessionStorage.getItem("openid_pending_totp_fixture"),
		),
	).toBeNull();
});

function otp(secret: string, offsetSeconds = 0) {
	let bits = "",
		bytes: number[] = [];
	for (const ch of secret.replace(/=+$/, ""))
		bits += "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
			.indexOf(ch)
			.toString(2)
			.padStart(5, "0");
	for (let i = 0; i + 8 <= bits.length; i += 8)
		bytes.push(parseInt(bits.slice(i, i + 8), 2));
	const counter = Buffer.alloc(8);
	counter.writeBigUInt64BE(
		BigInt(Math.floor((Date.now() + offsetSeconds * 1000) / 30000)),
	);
	const hash = createHmac("sha1", Buffer.from(bytes)).update(counter).digest(),
		offset = hash[hash.length - 1] & 15;
	return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(
		6,
		"0",
	);
}

test("OIDC real enrolled TOTP rejects invalid draft then restarts and logs in", async ({
	page,
	apiContext,
}) => {
	await UserFactory.create(1, {
		username: "oidc-fixture",
		email: "oidc-fixture@example.invalid",
	});
	await page.goto("/login");
	await page.getByRole("button", { name: "Log in with Isolated OIDC" }).click();
	await expect(page).toHaveURL(/\/$/);
	const token = await page.evaluate(() => localStorage.getItem("token")),
		headers = { Authorization: `Bearer ${token}` };
	const enrolled = await apiContext.post("user/settings/totp/enroll", {
		headers,
	});
	expect(enrolled.ok()).toBeTruthy();
	const pending = await enrolled.json();
	const enabled = await apiContext.post("user/settings/totp/enable", {
		headers,
		data: { passcode: otp(pending.secret) },
	});
	expect(enabled.ok()).toBeTruthy();
	await page.evaluate(() => {
		localStorage.removeItem("token");
		localStorage.removeItem("loggedInViaProvider");
	});
	await page.context().clearCookies();
	await page.goto("/login");
	await page.getByRole("button", { name: "Log in with Isolated OIDC" }).click();
	const passcode = page.locator("#openIdTotpPasscode");
	await expect(passcode).toBeFocused();
	await passcode.fill("invalid");
	const rejected = page.waitForResponse((r) => r.url().endsWith(callback));
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	const denial = await rejected;
	expect(denial.status()).toBe(412);
	expect(await denial.json()).toMatchObject({ code: 1017 });
	await expect(passcode).toBeFocused();
	await expect(passcode).toHaveValue("");
	expect(
		await page.evaluate(() =>
			sessionStorage.getItem("openid_pending_totp_fixture"),
		),
	).toBeNull();
	await page.goto("/login");
	await page.getByRole("button", { name: "Log in with Isolated OIDC" }).click();
	await expect(passcode).toBeFocused();
	await passcode.fill(otp(pending.secret, 30));
	const exchanged = page.waitForResponse((r) => r.url().endsWith(callback));
	await page.getByRole("button", { name: "Continue", exact: true }).click();
	expect((await exchanged).ok()).toBeTruthy();
	await expect(page).toHaveURL(/\/$/);
});

test("OIDC backend logout provider roundtrip revokes refresh and returns to login", async ({
	page,
	apiContext,
}) => {
	await page.goto("/login");
	await page.getByRole("button", { name: "Log in with Isolated OIDC" }).click();
	await expect(page).toHaveURL(/\/$/);
	const cookie = (await page.context().cookies())
		.map((c) => `${c.name}=${c.value}`)
		.join("; ");
	expect(cookie).toBeTruthy();
	// Mage gives the API and frontend different origins. Model the public reverse proxy's frontend root.
	await page.route("http://127.0.0.1:18765/logout?*", async (route) => {
		const response = await route.fetch({ maxRedirects: 0 });
		expect(response.status()).toBe(302);
		expect(response.headers().location).toBe(
			new URL(String(process.env.API_URL)).origin + "/",
		);
		await route.fulfill({
			response,
			headers: {
				...response.headers(),
				location: String(process.env.BASE_URL) + "/login",
			},
		});
	});
	let data;
	await page.route("**/api/v1/user/logout", async (route) => {
		const response = await route.fetch();
		expect(response.ok()).toBeTruthy();
		data = await response.json();
		await route.fulfill({ response });
	});
	const providerLogout = page.waitForRequest((r) =>
		r.url().startsWith("http://127.0.0.1:18765/logout"),
	);
	await page.locator(".username-dropdown-trigger").click();
	await page.getByRole("button", { name: "Logout", exact: true }).click();
	const url = new URL((await providerLogout).url());
	expect(data.oidc_logout_url).toContain("127.0.0.1:18765/logout");
	expect(url.searchParams.get("client_id")).toBe("fixture-client");
	expect(url.searchParams.get("id_token_hint")).toBeTruthy();
	await expect(page).toHaveURL(/\/login$/);
	await expect(page.locator("#username")).toBeVisible();
	expect(await page.evaluate(() => localStorage.getItem("token"))).toBeNull();
	const reused = await apiContext.post("user/token/refresh", {
		headers: { Cookie: cookie },
	});
	expect(reused.status()).toBe(401);
	await page.reload();
	await expect(page.locator("#username")).toBeVisible();
});

test("OIDC protected deep link returns to saved actual project after reauthentication", async ({
	page,
	apiContext,
}) => {
	await page.goto("/login");
	await page.getByRole("button", { name: "Log in with Isolated OIDC" }).click();
	await expect(page).toHaveURL(/\/$/);
	const token = await page.evaluate(() => localStorage.getItem("token"));
	const projects = await (
		await apiContext.get("projects", {
			headers: { Authorization: `Bearer ${token}` },
		})
	).json();
	const project = projects.find((p) => p.views?.length);
	expect(project).toBeTruthy();
	const href = `/projects/${project.id}/${project.views[0].id}`;
	await page.evaluate(() => localStorage.removeItem("token"));
	await page.context().clearCookies();
	await page.goto(href);
	await expect(page).toHaveURL(/\/login$/);
	await page.getByRole("button", { name: "Log in with Isolated OIDC" }).click();
	await expect(page).toHaveURL(new RegExp(`${href}$`));
	await expect(page.getByPlaceholder("Add a task…")).toBeVisible();
	await page.reload();
	await expect(page.getByPlaceholder("Add a task…")).toBeVisible();
});
for (const suppress of [false, true])
	test(`OIDC only config auto redirect honors logout marker ${suppress}`, async ({
		page,
	}) => {
		// Advertised frontend config contract; backend identity exchange remains real.
		await page.route("**/api/v1/info", async (route) => {
			const response = await route.fetch(),
				data = await response.json();
			await route.fulfill({
				response,
				json: {
					...data,
					auth: {
						...data.auth,
						local: { ...data.auth.local, enabled: false },
						ldap: { ...data.auth.ldap, enabled: false },
					},
				},
			});
		});
		if (suppress)
			await page.addInitScript(() =>
				sessionStorage.setItem("justLoggedOut", "true"),
			);
		await page.goto("/login");
		if (suppress) {
			await expect(
				page.getByRole("button", { name: "Log in with Isolated OIDC" }),
			).toBeVisible();
			await expect(page).toHaveURL(/\/login$/);
		} else {
			await expect(page).toHaveURL(/\/$/);
			expect(
				await page.evaluate(() => localStorage.getItem("loggedInViaProvider")),
			).toBe("fixture");
		}
	});
