import { test, expect } from "./fixtures";
import { TEST_PASSWORD } from "../../frontend/tests/support/constants";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { UserFactory } from "../../frontend/tests/factories/user";
import {
	SessionFactory,
	hashSessionToken,
} from "../../frontend/tests/factories/session";
import { createHmac } from "node:crypto";
const auth = async (page) => ({
	Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("token"))}`,
});
const base = () => String(process.env.API_URL).replace(/\/api\/v1\/?$/, "");
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
test.beforeEach(async ({ authenticatedPage: page }) => {
	void page;
	await ProjectFactory.create(1, { title: "Token fixture project" });
	await TaskFactory.create(1, { title: "Token fixture task", project_id: 1 });
});
for (const width of [1440, 390])
	test(`API token readonly preset actual scoped requests reload revoke ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/user/settings/api-tokens");
		if (width === 390) {
			const banner = page.locator(".add-to-home-screen");
			await expect(banner).toBeVisible();
			await banner.getByRole("button", {name: "Close banner", exact: true}).click();
			await expect(banner).not.toBeVisible();
		}
		await page
			.getByRole("button", { name: "Create a token", exact: true })
			.click();
		const title = page.getByRole("textbox", { name: "Title", exact: true });
		if (width > 769) await expect(title).toBeFocused();
		else await expect(title).not.toBeFocused();
		await title.fill("Readonly integration");
		await page.getByRole("button", { name: "Read only", exact: true }).click();
		if (process.env.VIKUNJA_TEST_MUTATE_TOKEN_SCOPE)
			await page.route("**/api/v1/tokens", async (route) => {
				if (route.request().method() !== "PUT") return route.continue();
				const response = await route.fetch(),
					body = await response.json();
				await route.fulfill({
					response,
					json: {
						...body,
						permissions: {
							...body.permissions,
							tasks: [...(body.permissions.tasks ?? []), "update"],
						},
					},
				});
			});
		const created = page.waitForResponse(
			(r) => r.url().endsWith("/tokens") && r.request().method() === "PUT",
		);
		await page
			.getByRole("button", { name: "Create token", exact: true })
			.click();
		const response = await created;
		expect(response.ok()).toBeTruthy();
		const token = await response.json();
		expect(token.permissions.tasks).toContain("read_all");
		expect(token.permissions.tasks).not.toContain("update");
		await expect(page.locator("body")).toContainText(token.token);
		const allowed = await apiContext.get("tasks", {
			headers: { Authorization: `Bearer ${token.token}` },
		});
		expect(allowed.ok()).toBeTruthy();
		const denied = await apiContext.post("tasks/1", {
			headers: { Authorization: `Bearer ${token.token}` },
			data: { title: "Forbidden title" },
		});
		expect([401, 403]).toContain(denied.status());
		await page.screenshot({ path: info.outputPath(`tokens-${width}.png`) });
		await page.reload();
		await expect(page.locator("tbody")).toContainText("Readonly integration");
		await expect(page.locator("body")).not.toContainText(token.token);
		await page
			.getByRole("row")
			.filter({ hasText: "Readonly integration" })
			.getByRole("button", { name: "Delete", exact: true })
			.click();
		await page.getByRole("button", { name: "Do it!", exact: true }).click();
		await expect(
			page.getByRole("row").filter({ hasText: "Readonly integration" }),
		).toHaveCount(0);
		const revoked = await apiContext.get("tasks", {
			headers: { Authorization: `Bearer ${token.token}` },
		});
		expect([401, 403]).toContain(revoked.status());
	});
test("sessions current protection foreign denial revoke and refresh invalidation", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/sessions");
	const headers = await auth(page),
		payload = await page.evaluate(() =>
			JSON.parse(atob(localStorage.getItem("token")!.split(".")[1])),
		);
	expect(payload.sid).toBeTruthy();
	await SessionFactory.create(
		1,
		{
			id: "10000000-0000-4000-8000-000000000001",
			device_info: "Fixture tablet",
			token_hash: hashSessionToken("fixture-tablet-refresh"),
			user_id: 1,
		},
		false,
	);
	await UserFactory.create(1, { id: 2, username: "foreign-fixture" }, false);
	await SessionFactory.create(
		1,
		{
			id: "20000000-0000-4000-8000-000000000002",
			device_info: "Foreign device",
			token_hash: hashSessionToken("fixture-foreign-refresh"),
			user_id: 2,
		},
		false,
	);
	await page.goto("/user/settings/sessions");
	await expect(
		page
			.getByRole("row")
			.filter({ hasText: "Current session" })
			.getByRole("button", { name: "Delete", exact: true }),
	).toHaveCount(0);
	await expect(page.locator("table")).toContainText("Fixture tablet");
	await expect(page.locator("table")).not.toContainText("Foreign device");
	const denied = await apiContext.delete(
		"user/sessions/20000000-0000-4000-8000-000000000002",
		{ headers },
	);
	expect([403, 404]).toContain(denied.status());
	await page
		.getByRole("row")
		.filter({ hasText: "Fixture tablet" })
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await page.getByRole("button", { name: "Do it!", exact: true }).click();
	await expect(page.locator("table")).not.toContainText("Fixture tablet");
	const remaining = await apiContext.get("user/sessions", { headers });
	expect((await remaining.json()).map((s) => s.id)).toContain(payload.sid);
	const refresh = await apiContext.post("user/token/refresh", {
		headers: { Cookie: "vikunja_refresh_token=fixture-tablet-refresh" },
	});
	expect(refresh.status()).toBe(401);
	await page.reload();
	await expect(page.locator("table")).not.toContainText("Fixture tablet");
});
test("CalDAV URL clipboard token CRUD and actual isolated DAV authentication", async ({
	authenticatedPage: page,
	apiContext,
}, info) => {
	await page.goto("/user/settings/caldav");
	await expect(page.getByRole("textbox")).toHaveValue(
		`${base()}/dav/principals/migration-reviewer/`,
	);
	await page
		.getByRole("button", { name: "Copy to clipboard", exact: true })
		.click();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		`${base()}/dav/principals/migration-reviewer/`,
	);
	const created = page.waitForResponse(
		(r) =>
			r.url().endsWith("/user/settings/token/caldav") &&
			r.request().method() === "PUT",
	);
	await page
		.getByRole("button", { name: "Create a CalDAV token", exact: true })
		.click();
	const response = await created;
	expect(response.ok()).toBeTruthy();
	const token = await response.json();
	await expect(page.locator("body")).toContainText(token.token);
	const dav = await apiContext.fetch(
		`${base()}/dav/principals/migration-reviewer/`,
		{
			method: "PROPFIND",
			headers: {
				Authorization: `Basic ${Buffer.from(`migration-reviewer:${token.token}`).toString("base64")}`,
				Depth: "0",
			},
		},
	);
	expect(dav.status()).toBe(207);
	await page.screenshot({ path: info.outputPath("caldav.png") });
	await page.reload();
	await expect(page.locator("body")).not.toContainText(token.token);
	await page
		.getByRole("row")
		.filter({ hasText: String(token.id) })
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	const rows = await apiContext.get("user/settings/token/caldav", {
		headers: await auth(page),
	});
	await expect
		.poll(
			async () =>
				(
					await (
						await apiContext.get("user/settings/token/caldav", {
							headers: await auth(page),
						})
					).json()
				).length,
		)
		.toBe(0);
	expect(rows.ok()).toBeTruthy();
});
test("feed URL clipboard and prefilled scoped API token grants only feed access", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/feeds");
	await expect(page.getByRole("textbox")).toHaveValue(
		`${base()}/feeds/notifications.atom`,
	);
	await page
		.getByRole("button", { name: "Copy to clipboard", exact: true })
		.click();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
		`${base()}/feeds/notifications.atom`,
	);
	await page
		.locator(".card-content")
		.getByRole("link", { name: "API Tokens", exact: true })
		.click();
	await expect(
		page.getByRole("textbox", { name: "Title", exact: true }),
	).toHaveValue("Atom feed");
	const created = page.waitForResponse(
		(r) => r.url().endsWith("/tokens") && r.request().method() === "PUT",
	);
	await page.getByRole("button", { name: "Create token", exact: true }).click();
	const response = await created;
	expect(response.ok()).toBeTruthy();
	const token = await response.json();
	expect(token.permissions).toEqual({ feeds: ["access"] });
	const feed = await apiContext.get(`${base()}/feeds/notifications.atom`, {
		headers: {
			Authorization: `Basic ${Buffer.from(`migration-reviewer:${token.token}`).toString("base64")}`,
		},
	});
	expect(feed.ok()).toBeTruthy();
	expect(await feed.text()).toContain("<feed");
	const denied = await apiContext.get("tasks", {
		headers: { Authorization: `Bearer ${token.token}` },
	});
	expect([401, 403]).toContain(denied.status());
});
test("TOTP enrollment QR invalid passcode enable logout login and disable", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/totp");
	await page.getByRole("button", { name: "Enroll", exact: true }).click();
	const headers = await auth(page),
		status = await apiContext.get("user/settings/totp", { headers });
	expect(status.ok()).toBeTruthy();
	const pending = await status.json();
	expect(pending.enabled).toBeFalsy();
	expect(pending.secret).toBeTruthy();
	await expect(page.locator(".card-content img")).toBeVisible();
	await page
		.getByRole("textbox", { name: "Passcode", exact: true })
		.fill("invalid");
	const rejected = page.waitForResponse((r) =>
		r.url().endsWith("/totp/enable"),
	);
	await page.getByRole("button", { name: "Confirm", exact: true }).click();
	expect((await rejected).ok()).toBeFalsy();
	await expect(
		page.getByRole("textbox", { name: "Passcode", exact: true }),
	).toHaveValue("invalid");
	await page
		.getByRole("textbox", { name: "Passcode", exact: true })
		.fill(otp(pending.secret));
	await page.getByRole("button", { name: "Confirm", exact: true }).click();
	await expect(page).toHaveURL(/\/login$/);
	const login = await apiContext.post("login", {
		data: {
			username: "migration-reviewer",
			password: TEST_PASSWORD,
			totp_passcode: otp(pending.secret, 30),
		},
	});
	expect(login.ok()).toBeTruthy();
	const body = await login.json();
	await page.addInitScript(
		(token) => localStorage.setItem("token", token),
		body.token,
	);
	await page.goto("/user/settings/totp");
	await page.getByRole("button", { name: "Disable", exact: true }).click();
	const password = page.getByRole("textbox", {
		name: "Please Enter Your Password",
		exact: true,
	});
	await expect(password).toBeFocused();
	await password.fill("wrong-password");
	const rejectedPassword = page.waitForResponse((r) =>
		r.url().endsWith("/totp/disable"),
	);
	await password.press("Enter");
	expect((await rejectedPassword).ok()).toBeFalsy();
	await expect(password).toHaveValue("wrong-password");
	await expect(password).toBeFocused();
	await password.fill(TEST_PASSWORD);
	await page
		.getByRole("button", {
			name: "Disable two factor authentication",
			exact: true,
		})
		.click();
	await expect(
		page.getByRole("button", { name: "Enroll", exact: true }),
	).toBeVisible();
	const absent = await apiContext.get("user/settings/totp", {
		headers: { Authorization: `Bearer ${body.token}` },
	});
	expect((await absent.json()).code).toBe(1016);
});

test("token validation expiry presets rejected write retains focused draft and retry", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/api-tokens");
	await page
		.getByRole("button", { name: "Create a token", exact: true })
		.click();
	const title = page.getByRole("textbox", { name: "Title", exact: true }),
		save = page.getByRole("button", { name: "Create token", exact: true });
	let writes = 0,
		fail = true;
	await page.route("**/api/v1/tokens", (route) => {
		if (route.request().method() !== "PUT") return route.continue();
		writes++;
		return fail
			? route.fulfill({
					status: 503,
					json: { message: "Fixture token write unavailable" },
				})
			: route.continue();
	});
	await save.click();
	await expect(title).toBeFocused();
	await expect(
		page.getByText("The title is required", { exact: true }),
	).toBeVisible();
	expect(writes).toBe(0);
	await title.fill("Scoped retry");
	await save.click();
	expect(writes).toBe(0);
	await page
		.getByRole("button", { name: "Task management", exact: true })
		.click();
	await page.getByLabel("Expires at", { exact: true }).selectOption("60");
	await title.press("Enter");
	await expect(
		page
			.getByRole("alert")
			.filter({ hasText: "Fixture token write unavailable" }),
	).toBeVisible();
	await expect(title).toHaveValue("Scoped retry");
	await expect(title).toBeFocused();
	await expect(save).toBeEnabled();
	fail = false;
	const created = page.waitForResponse(
		(r) => r.url().endsWith("/tokens") && r.request().method() === "PUT",
	);
	await title.press("Enter");
	const response = await created;
	expect(response.ok()).toBeTruthy();
	const token = await response.json();
	expect(writes).toBe(2);
	expect(token.permissions.tasks).toContain("update");
	expect(token.permissions.projects).not.toContain("update");
	expect(
		Math.abs(Date.parse(token.expires_at) - Date.now() - 60 * 86400000),
	).toBeLessThan(10000);
	expect(
		(await apiContext.get("tokens", { headers: await auth(page) })).ok(),
	).toBeTruthy();
});
test("accepted token write preserves later input focus without duplicate submission", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/api-tokens");
	await page
		.getByRole("button", { name: "Create a token", exact: true })
		.click();
	const title = page.getByRole("textbox", { name: "Title", exact: true }),
		save = page.getByRole("button", { name: "Create token", exact: true });
	await title.fill("Accepted first");
	await page.getByRole("button", { name: "Read only", exact: true }).click();
	let start!: () => void, release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	let writes = 0;
	await page.route("**/api/v1/tokens", async (route) => {
		if (route.request().method() !== "PUT") return route.continue();
		writes++;
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await save.click();
	await ready;
	await expect(save).toBeDisabled();
	await title.fill("Later unsent draft");
	await title.focus();
	await title.press("Enter");
	release();
	await expect(
		page.getByRole("row").filter({ hasText: "Accepted first" }),
	).toBeVisible();
	await expect(title).toHaveValue("Later unsent draft");
	await expect(title).toBeFocused();
	await expect(save).toBeEnabled();
	expect(writes).toBe(1);
	const tokens = await (
		await apiContext.get("tokens", { headers: await auth(page) })
	).json();
	expect(tokens.map((t) => t.title)).toEqual(["Accepted first"]);
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Create a token", exact: true }),
	).toBeFocused();
});
test("accepted token response after settings navigation leaves destination draft and focus intact", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/api-tokens");
	await page
		.getByRole("button", { name: "Create a token", exact: true })
		.click();
	await page
		.getByRole("textbox", { name: "Title", exact: true })
		.fill("Accepted before teardown");
	await page.getByRole("button", { name: "Read only", exact: true }).click();
	let start!: () => void, release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/tokens", async (route) => {
		if (route.request().method() !== "PUT") return route.continue();
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await page.getByRole("button", { name: "Create token", exact: true }).click();
	await ready;
	await page
		.getByRole("link", { name: "Update Your Email Address", exact: true })
		.click();
	const email = page.locator("#newEmail");
	await email.fill("retained@example.com");
	await email.focus();
	release();
	await page.waitForLoadState("networkidle");
	await expect(page).toHaveURL(/email-update$/);
	await expect(email).toHaveValue("retained@example.com");
	await expect(email).toBeFocused();
	await expect(page.locator("body")).not.toContainText(
		"You won’t see this token again",
	);
	const records = await (
		await apiContext.get("tokens", { headers: await auth(page) })
	).json();
	expect(records.map((t) => t.title)).toEqual(["Accepted before teardown"]);
});
test("token routes read error retry restores feed prefill and exact scope", async ({
	authenticatedPage: page,
}) => {
	let fail = true;
	await page.route("**/api/v1/routes", (route) =>
		fail
			? route.fulfill({
					status: 503,
					json: { message: "Fixture permissions unavailable" },
				})
			: route.continue(),
	);
	await page.goto(
		"/user/settings/api-tokens?title=Atom%20feed&scopes=feeds%3Aaccess",
	);
	await expect(
		page
			.getByRole("alert")
			.filter({ hasText: "Fixture permissions unavailable" }),
	).toBeVisible();
	fail = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	const title = page.getByRole("textbox", { name: "Title", exact: true });
	await expect(title).toHaveValue("Atom feed");
	await expect(title).toBeFocused();
	const response = page.waitForResponse(
		(r) => r.url().endsWith("/tokens") && r.request().method() === "PUT",
	);
	await page.getByRole("button", { name: "Create token", exact: true }).click();
	expect((await (await response).json()).permissions).toEqual({
		feeds: ["access"],
	});
});
test("session list retry delete failure confirmation cancel and real retry", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/general");
	await SessionFactory.create(
		1,
		{
			id: "30000000-0000-4000-8000-000000000003",
			device_info: "Retry phone",
			token_hash: hashSessionToken("retry-phone"),
		},
		false,
	);
	let readFail = true,
		deleteFail = true;
	await page.route("**/api/v1/user/sessions?*", (route) =>
		readFail
			? route.fulfill({
					status: 503,
					json: { message: "Fixture sessions unavailable" },
				})
			: route.continue(),
	);
	await page.route(
		"**/api/v1/user/sessions/30000000-0000-4000-8000-000000000003",
		(route) =>
			deleteFail
				? route.fulfill({
						status: 503,
						json: { message: "Fixture revoke unavailable" },
					})
				: route.continue(),
	);
	await page.goto("/user/settings/sessions");
	await expect(
		page.getByRole("alert").filter({ hasText: "Fixture sessions unavailable" }),
	).toBeVisible();
	readFail = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	const row = page.getByRole("row").filter({ hasText: "Retry phone" });
	await row.getByRole("button", { name: "Delete", exact: true }).click();
	await page.getByRole("button", { name: "Do it!", exact: true }).click();
	await expect(page.getByRole("dialog")).toContainText(
		"Fixture revoke unavailable",
	);
	await expect(row).toBeVisible();
	await page
		.getByRole("dialog")
		.getByRole("button", { name: "Cancel", exact: true })
		.click();
	await expect(page.getByRole("dialog")).toHaveCount(0);
	deleteFail = false;
	await row.getByRole("button", { name: "Delete", exact: true }).click();
	await page.getByRole("button", { name: "Do it!", exact: true }).click();
	await expect(row).toHaveCount(0);
	expect(
		(
			await (
				await apiContext.get("user/sessions", { headers: await auth(page) })
			).json()
		).some((s) => s.device_info === "Retry phone"),
	).toBeFalsy();
});
test("CalDAV create failure loading retry and deletion failure keeps owned token", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/user/settings/caldav");
	let fail = true;
	await page.route("**/api/v1/user/settings/token/caldav", (route) =>
		route.request().method() === "PUT" && fail
			? route.fulfill({
					status: 503,
					json: { message: "Fixture DAV unavailable" },
				})
			: route.continue(),
	);
	const create = page.getByRole("button", {
		name: "Create a CalDAV token",
		exact: true,
	});
	await create.click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture DAV unavailable",
	);
	await expect(create).toBeEnabled();
	fail = false;
	await create.click();
	const remove = page
		.getByRole("row")
		.getByRole("button", { name: "Delete", exact: true });
	await expect(remove).toHaveCount(1);
	await page.route("**/api/v1/user/settings/token/caldav/*", (route) =>
		route.fulfill({
			status: 503,
			json: { message: "Fixture DAV delete unavailable" },
		}),
	);
	await remove.click();
	await expect(page.getByRole("alert")).toContainText(
		"Fixture DAV delete unavailable",
	);
	await expect(remove).toHaveCount(1);
	await page.unroute("**/api/v1/user/settings/token/caldav/*");
	await remove.click();
	await expect(remove).toHaveCount(0);
});
test("TOTP read retry and delayed QR teardown leave new form intact", async ({
	authenticatedPage: page,
}) => {
	let fail = true;
	await page.route("**/api/v1/user/settings/totp", (route) =>
		route.request().method() === "GET" && fail
			? route.fulfill({
					status: 503,
					json: { message: "Fixture TOTP unavailable" },
				})
			: route.continue(),
	);
	await page.goto("/user/settings/totp");
	await expect(page.getByRole("alert")).toContainText(
		"Fixture TOTP unavailable",
	);
	fail = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	let start!: () => void, release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/settings/totp/qrcode", async (route) => {
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await page.getByRole("button", { name: "Enroll", exact: true }).click();
	await ready;
	await page
		.getByRole("textbox", { name: "Passcode", exact: true })
		.fill("unsent-code");
	await page
		.getByRole("link", { name: "Update Your Email Address", exact: true })
		.click();
	const email = page.locator("#newEmail");
	await email.fill("qr-teardown@example.com");
	await email.focus();
	release();
	await page.waitForLoadState("networkidle");
	await expect(email).toHaveValue("qr-teardown@example.com");
	await expect(email).toBeFocused();
	await expect(page.locator(".card-content img")).toHaveCount(0);
});
test("disabled TOTP and CalDAV configurations hide navigation and skip service requests", async ({
	authenticatedPage: page,
}) => {
	await page.route("**/api/v1/info", async (route) => {
		const response = await route.fetch();
		await route.fulfill({
			response,
			json: {
				...(await response.json()),
				totp_enabled: false,
				caldav_enabled: false,
			},
		});
	});
	const calls: string[] = [];
	page.on("request", (r) => {
		if (/api\/v1\/user\/settings\/(totp|token\/caldav)/.test(r.url()))
			calls.push(r.url());
	});
	await page.goto("/user/settings/totp");
	await expect(
		page.getByRole("link", { name: "Two Factor Authentication", exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Enroll", exact: true }),
	).toHaveCount(0);
	await page.goto("/user/settings/caldav");
	await expect(
		page.getByRole("link", { name: "CalDAV", exact: true }),
	).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Create a CalDAV token", exact: true }),
	).toHaveCount(0);
	expect(calls).toEqual([]);
});

test("custom token expiry group selection real serialization and editor cleanup", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/user/settings/api-tokens");
	await page
		.getByRole("button", { name: "Create a token", exact: true })
		.click();
	await page
		.getByRole("textbox", { name: "Title", exact: true })
		.fill("Custom feed date");
	await page.getByRole("checkbox", { name: /^feeds$/i }).check();
	await page
		.getByRole("combobox", { name: "Expires at", exact: true })
		.selectOption("custom");
	const date = page.getByRole("textbox", { name: "Expires at", exact: true });
	await date.click();
	const tomorrow = new Date(Date.now() + 86400000),
		label = new Intl.DateTimeFormat("en-US", {
			month: "long",
			day: "numeric",
			year: "numeric",
		}).format(tomorrow);
	await page
		.locator(".flatpickr-calendar.open")
		.getByLabel(label, { exact: true })
		.click();
	await page.getByRole("textbox", { name: "Title", exact: true }).focus();
	const created = page.waitForResponse(
		(r) => r.url().endsWith("/tokens") && r.request().method() === "PUT",
	);
	await page.getByRole("button", { name: "Create token", exact: true }).click();
	const response = await created;
	expect(response.ok()).toBeTruthy();
	const token = await response.json();
	expect(token.permissions).toEqual({ feeds: ["access"] });
	expect(Date.parse(token.expires_at) - Date.now()).toBeGreaterThan(
		23 * 3600000,
	);
	expect(Date.parse(token.expires_at) - Date.now()).toBeLessThan(25 * 3600000);
	await expect(page.locator(".flatpickr-calendar")).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Create a token", exact: true }),
	).toBeFocused();
});

test("successful token retry clears prior error while retaining a later focused draft", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/user/settings/api-tokens");
	await page
		.getByRole("button", { name: "Create a token", exact: true })
		.click();
	const title = page.getByRole("textbox", { name: "Title", exact: true }),
		save = page.getByRole("button", { name: "Create token", exact: true });
	await title.fill("Retry accepted");
	await page.getByRole("button", { name: "Read only", exact: true }).click();
	let fail = true,
		start!: () => void,
		release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/tokens", async (route) => {
		if (route.request().method() !== "PUT") return route.continue();
		if (fail)
			return route.fulfill({
				status: 503,
				json: { message: "Prior token failure" },
			});
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response });
	});
	await save.click();
	await expect(
		page.getByRole("alert").filter({ hasText: "Prior token failure" }),
	).toBeVisible();
	fail = false;
	await save.click();
	await ready;
	await title.fill("Later untouched");
	await title.focus();
	release();
	await expect(save).toBeEnabled();
	await expect(title).toHaveValue("Later untouched");
	await expect(title).toBeFocused();
	await expect(
		page.getByRole("alert").filter({ hasText: "Prior token failure" }),
	).toHaveCount(0);
});
