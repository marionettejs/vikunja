import {setupApiUrl} from "../../frontend/tests/support/authenticateUser";
import { test, expect } from "./fixtures";
import { TEST_PASSWORD } from "../../frontend/tests/support/constants";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { TokenFactory } from "../../frontend/tests/factories/token";
import { UserProjectFactory } from "../../frontend/tests/factories/users_project";
import { UserFactory } from "../../frontend/tests/factories/user";
import { execFileSync } from "node:child_process";
const auth = async (page) => ({
	Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("token"))}`,
});
test.beforeEach(async ({ authenticatedPage: page }) => {
	void page;
	await ProjectFactory.create(1, { title: "Export fixture project" });
	await TaskFactory.create(1, { title: "Export fixture task", project_id: 1 });
});
for (const width of [1440, 390])
	test(`export actual ZIP generation download wrong password reload ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/user/settings/data-export");
		if (width === 390) {
			const banner = page.locator(".add-to-home-screen");
			await expect(banner).toBeVisible();
			await banner.getByRole("button", {name: "Close banner", exact: true}).click();
			await expect(banner).not.toBeVisible();
		}
		const password = page.getByRole("textbox", {
				name: "Current password",
				exact: true,
			}),
			request = page.getByRole("button", {
				name: "Request a copy of my Vikunja Data",
				exact: true,
			});
		await request.click();
		await expect(password).toBeFocused();
		await password.fill("incorrect");
		let response = page.waitForResponse((r) =>
			r.url().endsWith("/user/export/request"),
		);
		await request.click();
		expect((await response).ok()).toBeFalsy();
		await expect(password).toHaveValue("incorrect");
		await expect(request).toBeFocused();
		await password.fill(TEST_PASSWORD);
		response = page.waitForResponse((r) =>
			r.url().endsWith("/user/export/request"),
		);
		await request.click();
		expect((await response).ok()).toBeTruthy();
		await expect(password).toHaveValue("");
		const headers = await auth(page);
		await expect
			.poll(
				async () => {
					const r = await apiContext.get("user/export", { headers });
					return (await r.json()).id ?? 0;
				},
				{ timeout: 20000 },
			)
			.toBeGreaterThan(0);
		await page.reload();
		await expect(page.locator("body")).toContainText(
			"Your export is ready to download.",
		);
		await page.screenshot({ path: info.outputPath(`export-${width}.png`) });
		await page.getByRole("link", { name: "Download", exact: true }).click();
		await expect(page).toHaveURL(/user\/export\/download$/);
		const pwd = page.getByRole("textbox", {
			name: "Current password",
			exact: true,
		});
		await pwd.fill("incorrect");
		response = page.waitForResponse((r) =>
			r.url().endsWith("/user/export/download"),
		);
		await page.getByRole("button", { name: "Download", exact: true }).click();
		expect((await response).ok()).toBeFalsy();
		await expect(pwd).toHaveValue("incorrect");
		await pwd.fill(TEST_PASSWORD);
		const downloading = page.waitForEvent("download");
		await page.getByRole("button", { name: "Download", exact: true }).click();
		const download = await downloading;
		expect(download.suggestedFilename()).toBe("vikunja-export.zip");
		const path = await download.path();
		const contents = JSON.parse(
			execFileSync(
				"python3",
				[
					"-c",
					'import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({"files":z.namelist(),"data":z.read("data.json").decode()}))',
					path!,
				],
				{ encoding: "utf8" },
			),
		);
		expect(contents.files).toContain("VERSION");
		expect(contents.data).toContain("Export fixture project");
		expect(contents.data).toContain("Export fixture task");
		await page
			.getByRole("link", { name: "Request another export", exact: true })
			.click();
		await expect(page).toHaveURL(/settings\/data-export$/);
	});
test("deletion request wrong password real confirm fixture scheduled reload and cancel", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/deletion");
	const password = page.getByRole("textbox", {
		name: "Current password",
		exact: true,
	});
	await page
		.getByRole("button", { name: "Delete my account", exact: true })
		.click();
	await expect(password).toBeFocused();
	await password.fill("incorrect");
	let response = page.waitForResponse((r) =>
		r.url().endsWith("/user/deletion/request"),
	);
	await password.press("Enter");
	expect((await response).ok()).toBeFalsy();
	await expect(password).toHaveValue("incorrect");
	await password.fill(TEST_PASSWORD);
	response = page.waitForResponse((r) =>
		r.url().endsWith("/user/deletion/request"),
	);
	await password.press("Enter");
	expect((await response).ok()).toBeTruthy();
	await expect(page.locator("body")).toContainText(
		"The request was successful.",
	);
	await TokenFactory.create(1, {
		token: "controlled-deletion-confirm",
		user_id: 1,
		kind: 3,
	});
	const confirm = await apiContext.post("user/deletion/confirm", {
		headers: await auth(page),
		data: { token: "controlled-deletion-confirm" },
	});
	expect(confirm.ok()).toBeTruthy();
	await page.reload();
	await expect(page.locator("body")).toContainText(
		"We will delete your Vikunja account at",
	);
	const cancel = page.getByRole("button", {
		name: "Cancel the deletion of my account",
		exact: true,
	});
	await password.fill("incorrect");
	response = page.waitForResponse((r) =>
		r.url().endsWith("/user/deletion/cancel"),
	);
	await password.press("Enter");
	expect((await response).ok()).toBeFalsy();
	await expect(password).toHaveValue("incorrect");
	await password.fill(TEST_PASSWORD);
	await cancel.click();
	await expect(
		page.getByRole("button", { name: "Delete my account", exact: true }),
	).toBeVisible();
	expect(
		(await (await apiContext.get("user", { headers: await auth(page) })).json())
			.deletion_scheduled_at,
	).toMatch(/^0001-/);
	await page.reload();
	await expect(
		page.getByRole("button", { name: "Delete my account", exact: true }),
	).toBeVisible();
});
for (const scope of ["user", "project"])
	test(`webhook real scoped CRUD basic auth secret reload validation ${scope}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		const path =
				scope === "user"
					? "/user/settings/webhooks"
					: "/projects/1/settings/webhooks",
			endpoint =
				scope === "user" ? "user/settings/webhooks" : "projects/1/webhooks";
		await page.goto(path);
		const eventName = scope === "user" ? "task.reminder.fired" : "task.updated";
		const target = page.getByRole("textbox", {
			name: "Target URL",
			exact: true,
		});
		await target.fill("invalid");
		await page
			.getByRole("button", { name: "Create webhook", exact: true })
			.click();
		await expect(page.locator("body")).toContainText(
			"Please provide a valid URL.",
		);
		await target.fill("https://fixture.invalid/hooks");
		await page
			.getByRole("button", { name: "Create webhook", exact: true })
			.click();
		await expect(page.locator("body")).toContainText(
			"You must select at least one event.",
		);
		await page
			.getByRole("checkbox", {
				name: new RegExp(eventName.replaceAll(".", "\\.")),
			})
			.focus();
		await page
			.getByRole("checkbox", {
				name: new RegExp(eventName.replaceAll(".", "\\.")),
			})
			.press("Space");
		await page
			.getByRole("textbox", { name: "Secret", exact: true })
			.fill("fixture-signing-secret");
		await page
			.getByRole("button", { name: "Use Basic Auth?", exact: true })
			.click();
		await page
			.getByRole("textbox", { name: "Basic Auth User", exact: true })
			.fill("fixture-user");
		await page
			.getByRole("textbox", { name: "Basic Auth Password", exact: true })
			.fill("fixture-password");
		const created = page.waitForResponse(
			(r) =>
				new URL(r.url()).pathname.endsWith("/" + endpoint) &&
				r.request().method() === "PUT",
		);
		await page
			.getByRole("button", { name: "Create webhook", exact: true })
			.click();
		const r = await created;
		expect(r.ok()).toBeTruthy();
		expect(r.request().postDataJSON()).toMatchObject({
			target_url: "https://fixture.invalid/hooks",
			events: [eventName],
			secret: "fixture-signing-secret",
			basic_auth_user: "fixture-user",
			basic_auth_password: "fixture-password",
		});
		await expect(
			page
				.getByRole("row")
				.filter({ hasText: "https://fixture.invalid/hooks" }),
		).toBeVisible();
		await page.screenshot({ path: info.outputPath(`webhooks-${scope}.png`) });
		await page.reload();
		const row = page
			.getByRole("row")
			.filter({ hasText: "https://fixture.invalid/hooks" });
		await expect(row).toBeVisible();
		await row
			.getByRole("button", { name: "Delete this webhook", exact: true })
			.click();
		await page.getByRole("button", { name: "Do it!", exact: true }).click();
		await expect(row).toHaveCount(0);
		expect(
			await (
				await apiContext.get(endpoint, { headers: await auth(page) })
			).json(),
		).toEqual([]);
	});
test("bots actual creation name status token scope enable revoke delete and reload", async ({
	authenticatedPage: page,
	apiContext,
}, info) => {
	await page.goto("/user/settings/bots");
	await page.getByPlaceholder("bot-myassistant").fill("fixture-assistant");
	await page
		.getByPlaceholder("My Assistant", { exact: true })
		.fill("Fixture Assistant");
	const created = page.waitForResponse(
		(r) => r.url().endsWith("/user/bots") && r.request().method() === "PUT",
	);
	await page.getByRole("button", { name: "Create bot", exact: true }).click();
	const r = await created;
	expect(r.ok()).toBeTruthy();
	const bot = await r.json();
	expect(bot.username).toBe("bot-fixture-assistant");
	const card = page
		.locator(".bot-card")
		.filter({ hasText: "bot-fixture-assistant" });
	await card.getByRole("button", { name: "Edit", exact: true }).click();
	const name = card.getByPlaceholder("My Assistant", { exact: true });
	await expect(name).toBeFocused();
	await name.fill("Renamed assistant");
	await name.press("Enter");
	await expect(card).toContainText("Renamed assistant");
	await card.getByRole("button", { name: "Create token", exact: true }).click();
	await card
		.getByRole("textbox", { name: "Title", exact: true })
		.fill("Bot readonly");
	await card.getByRole("button", { name: "Read only", exact: true }).click();
	const tokenResponse = page.waitForResponse(
		(r) => r.url().endsWith("/tokens") && r.request().method() === "PUT",
	);
	await card.getByRole("button", { name: "Create token", exact: true }).click();
	const token = await (await tokenResponse).json();
	expect(token.owner_id).toBe(bot.id);
	expect(token.permissions.tasks).not.toContain("update");
	await UserProjectFactory.create(
		1,
		{ user_id: bot.id, project_id: 1, permission: 0 },
		false,
	);
	const headers = { Authorization: `Bearer ${token.token}` };
	expect((await apiContext.get("tasks", { headers })).ok()).toBeTruthy();
	expect([401, 403]).toContain(
		(
			await apiContext.post("tasks/1", {
				headers,
				data: { title: "Forbidden bot write" },
			})
		).status(),
	);
	await page.screenshot({ path: info.outputPath("bots.png") });
	await card.getByRole("button", { name: "Disable", exact: true }).click();
	await expect(
		card.getByRole("button", { name: "Enable", exact: true }),
	).toBeVisible();
	expect((await apiContext.get("tasks", { headers })).status()).toBe(401);
	await card.getByRole("button", { name: "Enable", exact: true }).click();
	await expect(
		card.getByRole("button", { name: "Disable", exact: true }),
	).toBeVisible();
	expect((await apiContext.get("tasks", { headers })).ok()).toBeTruthy();
	await page.reload();
	await expect(card).toContainText("Renamed assistant");
	await expect(card).not.toContainText(token.token);
	await card
		.getByRole("button", { name: "Delete", exact: true })
		.first()
		.click();
	await page.getByRole("button", { name: "Do it!", exact: true }).click();
	await expect(card).toHaveCount(0);
	expect((await apiContext.get("tasks", { headers })).status()).toBe(401);
	expect(
		await (
			await apiContext.get("user/bots", { headers: await auth(page) })
		).json(),
	).toEqual([]);
});

test("export status retry preserves password DOM caret and later draft", async ({
	authenticatedPage: page,
}) => {
	let fail = true,
		start!: () => void,
		release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/export", async (route) => {
		if (fail)
			return route.fulfill({
				status: 503,
				json: { message: "Export status unavailable" },
			});
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response });
	});
	await page.goto("/user/settings/data-export");
	const input = page.getByRole("textbox", {
		name: "Current password",
		exact: true,
	});
	await input.fill("early-password");
	await input.evaluate((el) => ((window as any).exportPasswordNode = el));
	fail = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await ready;
	await input.fill("later-password");
	await input.focus();
	await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(3, 6));
	release();
	await expect(
		page.getByRole("button", { name: "Retry", exact: true }),
	).toBeHidden();
	await expect(input).toHaveValue("later-password");
	await expect(input).toBeFocused();
	expect(
		await input.evaluate((el: HTMLInputElement) => ({
			same: el === (window as any).exportPasswordNode,
			start: el.selectionStart,
			end: el.selectionEnd,
		})),
	).toEqual({ same: true, start: 3, end: 6 });
});

test("accepted export request retains later focused password and suppresses duplicate submit", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/user/settings/data-export");
	let start!: () => void,
		release!: () => void,
		count = 0;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/export/request", async (route) => {
		count++;
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response });
	});
	const input = page.getByRole("textbox", {
			name: "Current password",
			exact: true,
		}),
		save = page.getByRole("button", {
			name: "Request a copy of my Vikunja Data",
			exact: true,
		});
	await input.fill(TEST_PASSWORD);
	await save.click();
	await ready;
	await expect(save).toBeDisabled();
	await input.fill("later-unsent");
	await input.focus();
	await input.press("Enter");
	release();
	await expect(save).toBeEnabled();
	await expect(input).toHaveValue("later-unsent");
	await expect(input).toBeFocused();
	expect(count).toBe(1);
});

test("accepted deletion cancellation retains later focused password and caret", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/deletion");
	await TokenFactory.create(1, {
		token: "controlled-draft-cancel",
		user_id: 1,
		kind: 3,
	});
	expect(
		(
			await apiContext.post("user/deletion/confirm", {
				headers: await auth(page),
				data: { token: "controlled-draft-cancel" },
			})
		).ok(),
	).toBeTruthy();
	await page.reload();
	let start!: () => void, release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/deletion/cancel", async (route) => {
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response });
	});
	const input = page.getByRole("textbox", {
		name: "Current password",
		exact: true,
	});
	await input.fill(TEST_PASSWORD);
	await page
		.getByRole("button", {
			name: "Cancel the deletion of my account",
			exact: true,
		})
		.click();
	await ready;
	await input.fill("later-deletion-draft");
	await input.focus();
	await input.evaluate((el: HTMLInputElement) => el.setSelectionRange(2, 5));
	release();
	await expect(
		page.getByRole("button", { name: "Delete my account", exact: true }),
	).toBeVisible();
	await expect(input).toHaveValue("later-deletion-draft");
	await expect(input).toBeFocused();
	expect(
		await input.evaluate((el: HTMLInputElement) => [
			el.selectionStart,
			el.selectionEnd,
		]),
	).toEqual([2, 5]);
});

test("webhook failure retry preserves focused later URL secret and event draft", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/user/settings/webhooks");
	let fail = true,
		start!: () => void,
		release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/settings/webhooks", async (route) => {
		if (route.request().method() !== "PUT") return route.continue();
		if (fail)
			return route.fulfill({
				status: 503,
				json: { message: "Webhook failed" },
			});
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response });
	});
	const target = page.getByRole("textbox", { name: "Target URL", exact: true }),
		secret = page.getByRole("textbox", { name: "Secret", exact: true }),
		save = page.getByRole("button", { name: "Create webhook", exact: true });
	await target.fill("https://fixture.invalid/retry");
	await secret.fill("original-secret");
	await page.getByRole("checkbox", { name: /task\.reminder\.fired/ }).focus();
	await page
		.getByRole("checkbox", { name: /task\.reminder\.fired/ })
		.press("Space");
	await save.click();
	await expect(
		page.getByRole("alert").filter({ hasText: "Webhook failed" }),
	).toBeVisible();
	await expect(target).toHaveValue("https://fixture.invalid/retry");
	await expect(secret).toHaveValue("original-secret");
	fail = false;
	await save.click();
	await ready;
	await target.fill("https://fixture.invalid/later");
	await secret.fill("later-secret");
	await target.focus();
	release();
	await expect(save).toBeEnabled();
	await expect(target).toBeFocused();
	await expect(target).toHaveValue("https://fixture.invalid/later");
	await expect(secret).toHaveValue("later-secret");
	await expect(
		page.getByRole("checkbox", { name: /task\.reminder\.fired/ }),
	).toBeChecked();
	await expect(
		page.getByRole("alert").filter({ hasText: "Webhook failed" }),
	).toHaveCount(0);
	await expect(
		page.getByRole("row").filter({ hasText: "https://fixture.invalid/retry" }),
	).toBeVisible();
});

test("late project webhook response cannot publish in a different project dialog", async ({
	authenticatedPage: page,
}) => {
	await ProjectFactory.create(2, { title: "Scoped webhook project" });
	await page.goto("/projects/1/settings/webhooks");
	let start!: () => void, release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/projects/1/webhooks", async (route) => {
		if (route.request().method() !== "PUT") return route.continue();
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await page
		.getByRole("textbox", { name: "Target URL", exact: true })
		.fill("https://fixture.invalid/project-one");
	await page.getByRole("checkbox", { name: /task\.updated/ }).focus();
	await page.getByRole("checkbox", { name: /task\.updated/ }).press("Space");
	await page
		.getByRole("button", { name: "Create webhook", exact: true })
		.click();
	await ready;
	await page.evaluate(() => {
		history.pushState({}, "", "/projects/2/settings/webhooks");
		window.dispatchEvent(new PopStateEvent("popstate"));
	});
	const target = page.getByRole("textbox", { name: "Target URL", exact: true });
	await target.fill("https://fixture.invalid/project-two-draft");
	await target.focus();
	release();
	await page.waitForLoadState("networkidle");
	await expect(target).toHaveValue("https://fixture.invalid/project-two-draft");
	await expect(target).toBeFocused();
	await expect(
		page
			.getByRole("row")
			.filter({ hasText: "https://fixture.invalid/project-one" }),
	).toHaveCount(0);
});

test("bot token revocation is scoped and two editor labels own unique inputs", async ({
	authenticatedPage: page,
	apiContext,
}, info) => {
	await page.goto("/user/settings/bots");
	const headers = await auth(page);
	for (const username of ["bot-scope-one", "bot-scope-two"])
		expect(
			(
				await apiContext.put("user/bots", {
					headers,
					data: { username, name: username },
				})
			).ok(),
		).toBeTruthy();
	await page.reload();
	const first = page.locator(".bot-card").filter({ hasText: "bot-scope-one" }),
		second = page.locator(".bot-card").filter({ hasText: "bot-scope-two" });
	await first
		.getByRole("button", { name: "Create token", exact: true })
		.click();
	await second
		.getByRole("button", { name: "Create token", exact: true })
		.click();
	const a = first.getByRole("textbox", { name: "Title", exact: true }),
		b = second.getByRole("textbox", { name: "Title", exact: true });
	expect(await a.getAttribute("id")).not.toBe(await b.getAttribute("id"));
	await a.fill("First bot token");
	await b.fill("Second bot draft");
	await first.getByRole("button", { name: "Read only", exact: true }).click();
	const accepted = page.waitForResponse(
		(r) => r.url().endsWith("/tokens") && r.request().method() === "PUT",
	);
	await first
		.getByRole("button", { name: "Create token", exact: true })
		.click();
	const token = await (await accepted).json();
	await expect(
		first.getByRole("row").filter({ hasText: "First bot token" }),
	).toBeVisible();
	const warning = first
		.locator(".message")
		.filter({ hasText: "Store it in a secure location" });
	await expect(warning.locator("code")).toHaveText(token.token);
	expect(await warning.evaluate((el) => getComputedStyle(el).color)).toBe(
		await page.locator("body").evaluate((el) => getComputedStyle(el).color),
	);
	await page.screenshot({ path: info.outputPath("bot-token-editors.png") });
	await first
		.getByRole("row")
		.filter({ hasText: "First bot token" })
		.getByRole("button", { name: "Delete", exact: true })
		.click();
	await expect(
		first.getByRole("row").filter({ hasText: "First bot token" }),
	).toHaveCount(0);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	await expect(b).toHaveValue("Second bot draft");
	expect(
		(
			await apiContext.get("tasks", {
				headers: { Authorization: `Bearer ${token.token}` },
			})
		).status(),
	).toBe(401);
	for (const card of [first, second]) {
		await card
			.getByRole("button", { name: "Delete", exact: true })
			.first()
			.click();
		await page.getByRole("button", { name: "Do it!", exact: true }).click();
		await expect(card).toHaveCount(0);
	}
	expect(await (await apiContext.get("user/bots", { headers })).json()).toEqual(
		[],
	);
});

test("foreign bot and webhook ownership are rejected by the real backend", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/bots");
	const owner = await auth(page);
	const bot = await (
		await apiContext.put("user/bots", {
			headers: owner,
			data: { username: "bot-private-scope", name: "Private bot" },
		})
	).json();
	const webhook = await (
		await apiContext.put("user/settings/webhooks", {
			headers: owner,
			data: {
				target_url: "https://fixture.invalid/private",
				events: ["task.reminder.fired"],
			},
		})
	).json();
	await UserFactory.create(1, { id: 7, username: "isolated-outsider" }, false);
	const login = await apiContext.post("login", {
		data: { username: "isolated-outsider", password: TEST_PASSWORD },
	});
	expect(login.ok()).toBeTruthy();
	const outsider = { Authorization: `Bearer ${(await login.json()).token}` };
	expect(
		await (await apiContext.get("user/bots", { headers: outsider })).json(),
	).toEqual([]);
	expect(
		await (
			await apiContext.get("user/settings/webhooks", { headers: outsider })
		).json(),
	).toEqual([]);
	for (const request of [
		() =>
			apiContext.post(`user/bots/${bot.id}`, {
				headers: outsider,
				data: { name: "Forbidden" },
			}),
		() => apiContext.delete(`user/bots/${bot.id}`, { headers: outsider }),
		() =>
			apiContext.get("tokens", {
				headers: outsider,
				params: { owner_id: bot.id },
			}),
		() =>
			apiContext.delete(`user/settings/webhooks/${webhook.id}`, {
				headers: outsider,
			}),
	])
		expect([403, 404]).toContain((await request()).status());
	expect(
		(
			await apiContext.get("projects/1/webhooks", { headers: outsider })
		).status(),
	).toBe(403);
});

test("read only project webhook navigation cannot create or delete webhooks", async ({
	browser,
	apiContext,
}) => {
	await UserFactory.create(1, { id: 7, username: "isolated-reader" }, false);
	await UserProjectFactory.create(
		1,
		{ user_id: 7, project_id: 1, permission: 0 },
		false,
	);
	const login = await apiContext.post("login", {
		data: { username: "isolated-reader", password: TEST_PASSWORD },
	});
	expect(login.ok()).toBeTruthy();
	const token = (await login.json()).token,
		headers = { Authorization: `Bearer ${token}` };
	const context = await browser.newContext();
	try {
		const page = await context.newPage();
		await setupApiUrl(page);
		await page.goto("/login");
		await page.locator("#username").fill("isolated-reader");
		await page.locator("#password").fill(TEST_PASSWORD);
		await page.getByRole("button", {name: "Login", exact: true}).click();
		await expect(page.locator(".username-dropdown-trigger")).toContainText("isolated-reader");
		await page.goto("/projects/1/settings/webhooks");
		await expect(page.locator(".username-dropdown-trigger")).toContainText("isolated-reader");
		await expect(
			page.getByRole("button", { name: "Create webhook", exact: true }),
		).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Delete this webhook", exact: true }),
		).toHaveCount(0);
		expect(
			(
				await apiContext.put("projects/1/webhooks", {
					headers,
					data: {
						target_url: "https://fixture.invalid/forbidden",
						events: ["task.updated"],
					},
				})
			).status(),
		).toBe(403);
	} finally {await context.close()}
});

test("late export download cannot publish after navigation or disturb destination password", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/data-export");
	const headers = await auth(page);
	expect(
		(
			await apiContext.post("user/export/request", {
				headers,
				data: { password: TEST_PASSWORD },
			})
		).ok(),
	).toBeTruthy();
	await expect
		.poll(
			async () =>
				(await (await apiContext.get("user/export", { headers })).json()).id ??
				0,
			{ timeout: 20000 },
		)
		.toBeGreaterThan(0);
	await page.goto("/user/export/download");
	let start!: () => void,
		release!: () => void,
		downloads = 0;
	page.on("download", () => downloads++);
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/export/download", async (route) => {
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await page
		.getByRole("textbox", { name: "Current password", exact: true })
		.fill(TEST_PASSWORD);
	await page.getByRole("button", { name: "Download", exact: true }).click();
	await ready;
	await page
		.getByRole("link", { name: "Request another export", exact: true })
		.click();
	const input = page.getByRole("textbox", {
		name: "Current password",
		exact: true,
	});
	await input.fill("destination-password");
	await input.focus();
	release();
	await page.waitForLoadState("networkidle");
	await expect(input).toHaveValue("destination-password");
	await expect(input).toBeFocused();
	expect(downloads).toBe(0);
});

test("bot name failure retry preserves a later focused draft after accepted save", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/bots");
	const headers = await auth(page),
		bot = await (
			await apiContext.put("user/bots", {
				headers,
				data: { username: "bot-draft-owner", name: "Original name" },
			})
		).json();
	await page.reload();
	const card = page.locator(".bot-card").filter({ hasText: "bot-draft-owner" });
	await card.getByRole("button", { name: "Edit", exact: true }).click();
	const name = card.getByPlaceholder("My Assistant", { exact: true });
	let fail = true,
		start!: () => void,
		release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route(`**/api/v1/user/bots/${bot.id}`, async (route) => {
		if (route.request().method() !== "POST") return route.continue();
		if (fail)
			return route.fulfill({
				status: 503,
				json: { message: "Bot name failed" },
			});
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response });
	});
	await name.fill("Accepted name");
	await name.press("Enter");
	await expect(
		card.getByRole("alert").filter({ hasText: "Bot name failed" }),
	).toBeVisible();
	await expect(name).toHaveValue("Accepted name");
	await expect(name).toBeFocused();
	fail = false;
	await name.press("Enter");
	await ready;
	await name.fill("Later unsent name");
	await name.focus();
	release();
	await expect(
		card.getByRole("button", { name: "Save", exact: true }),
	).toBeEnabled();
	await expect(name).toHaveValue("Later unsent name");
	await expect(name).toBeFocused();
	await expect(
		card.getByRole("alert").filter({ hasText: "Bot name failed" }),
	).toHaveCount(0);
	expect(
		(await (await apiContext.get(`user/bots/${bot.id}`, { headers })).json())
			.name,
	).toBe("Accepted name");
});
