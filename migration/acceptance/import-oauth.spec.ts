import { test, expect } from "./fixtures";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { createDefaultViews } from "../../frontend/tests/e2e/project/prepareProjects";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createServer } from "node:http";
import { TEST_PASSWORD } from "../../frontend/tests/support/constants";
import { setupApiUrl } from "../../frontend/tests/support/authenticateUser";
const auth = async (page) => ({
	Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("token"))}`,
});
const csv = {
	name: "controlled.csv",
	mimeType: "text/csv",
	buffer: Buffer.from(
		"title,description,done,priority,labels\nImported red task,red description,false,3,red\nImported done task,done description,true,1,blue\n",
	),
};
const openCSV = async (page) => {
	await page.goto("/migrate/csv");
	await page.locator("input[type=file]").setInputFiles(csv);
	await expect(
		page.getByRole("button", { name: "Import Tasks", exact: true }),
	).toBeEnabled();
};
const preview = (page) => page.locator(".preview-tasks");
test.beforeEach(async () => {
	await ProjectFactory.create(1, { title: "Import fixture project" });
	await createDefaultViews(1);
	await TaskFactory.create(1, { title: "Import fixture task", project_id: 1 });
});
for (const width of [1440, 390])
	test(`CSV actual mapping preview import catalog reload ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await openCSV(page);
		if (width === 390) {
			const banner = page.locator(".add-to-home-screen");
			await expect(banner).toBeVisible();
			await banner.getByRole("button", {name: "Close banner", exact: true}).click();
			await expect(banner).not.toBeVisible();
		}
		await expect(
			preview(page).getByText("Imported red task", { exact: true }),
		).toBeVisible();
		await expect
			.poll(() =>
				page
					.locator(
						".preview-tasks .task:has(.tasktext.done) .fancy-checkbox__icon polyline",
					)
					.evaluate((el) => getComputedStyle(el).strokeDashoffset),
			)
			.toBe("42px");
		const importButton = page.getByRole("button", {
			name: "Import Tasks",
			exact: true,
		});
		const selects = page.locator(".mapping-row select");
		await selects.nth(0).selectOption("ignore");
		await expect(importButton).toBeDisabled();
		await selects.nth(0).selectOption("title");
		await expect(importButton).toBeEnabled();
		const requests = [];
		page.on("request", (r) => {
			if (
				/\/tasks(?:\/|\?)/.test(r.url()) &&
				["POST", "PUT", "DELETE"].includes(r.method())
			)
				requests.push(r.url());
		});
		await preview(page).getByText("Imported red task", { exact: true }).click();
		await expect(page).toHaveURL(/\/migrate\/csv$/);
		expect(requests).toEqual([]);
		await page.screenshot({
			path: info.outputPath(`csv-mapping-${width}.png`),
		});
		const saved = page.waitForResponse(
			(r) =>
				r.url().endsWith("/migration/csv/migrate") &&
				r.request().method() === "PUT",
		);
		await importButton.click();
		expect((await saved).ok()).toBeTruthy();
		await expect(
			page.getByRole("link", { name: "Go to overview", exact: true }),
		).toBeVisible();
		const projects = await (
			await apiContext.get("projects", { headers: await auth(page) })
		).json();
		const imported = projects.find((p) => p.title === "Imported from CSV");
		expect(imported).toBeTruthy();
		const tasks = await (
			await apiContext.get(`projects/${imported.id}/tasks`, {
				headers: await auth(page),
			})
		).json();
		expect(tasks.map((t) => t.title).sort()).toEqual([
			"Imported done task",
			"Imported red task",
		]);
		const red = tasks.find((t) => t.title === "Imported red task");
		expect(red.priority).toBe(3);
		expect(red.description).toContain("red description");
		expect(red.done).toBe(false);
		expect(tasks.find((t) => t.title === "Imported done task").done).toBe(true);
		await page
			.getByRole("link", { name: "Go to overview", exact: true })
			.click();
		await expect(
			page.getByText("Imported from CSV", { exact: true }).first(),
		).toBeVisible();
		await page.reload();
		await expect(
			page.getByText("Imported from CSV", { exact: true }).first(),
		).toBeVisible();
	});
test("CSV rejected import preserves mapping file focused draft and real retry", async ({
	authenticatedPage: page,
}) => {
	await openCSV(page);
	let fail = true;
	await page.route("**/migration/csv/migrate", (route) =>
		fail
			? route.fulfill({
					status: 503,
					json: { message: "Controlled import rejected" },
				})
			: route.continue(),
	);
	const skip = page.getByLabel("Skip Rows"),
		node = await skip.elementHandle();
	await skip.fill("1");
	await skip.press("Tab");
	await expect(
		page.getByRole("button", { name: "Import Tasks", exact: true }),
	).toBeEnabled();
	await page.getByRole("button", { name: "Import Tasks", exact: true }).click();
	await expect(
		page.getByRole("alert").filter({ hasText: "Controlled import rejected" }),
	).toBeVisible();
	await expect(skip).toHaveValue("1");
	expect(await skip.evaluate((el, old) => el === old, node)).toBe(true);
	await skip.fill("0");
	await skip.press("Tab");
	await expect(
		page.getByRole("button", { name: "Import Tasks", exact: true }),
	).toBeEnabled();
	fail = false;
	await page.getByRole("button", { name: "Import Tasks", exact: true }).click();
	await expect(
		page.getByRole("link", { name: "Go to overview", exact: true }),
	).toBeVisible();
});
test("CSV cancelled delayed preview cannot restore mapping or lose destination focus", async ({
	authenticatedPage: page,
}) => {
	await openCSV(page);
	let started, release;
	const ready = new Promise<void>((r) => (started = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/migration/csv/preview", async (route) => {
		const response = await route.fetch();
		started();
		await gate;
		await route.fulfill({ response });
	});
	const skip = page.getByLabel("Skip Rows");
	await skip.fill("1");
	await skip.press("Tab");
	await ready;
	await page.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Select CSV file", exact: true }),
	).toBeVisible();
	release();
	await expect(page.locator(".mapping-step")).toHaveCount(0);
	await expect(
		page.getByRole("button", { name: "Select CSV file", exact: true }),
	).toBeVisible();
});
test("CSV late detection after SPA transition cannot publish mapping or error", async ({
	authenticatedPage: page,
}) => {
	let started, release;
	const ready = new Promise<void>((r) => (started = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/migration/csv/detect", async (route) => {
		const response = await route.fetch();
		started();
		await gate;
		await route.fulfill({ response });
	});
	await page.goto("/migrate/csv");
	await page.locator("input[type=file]").setInputFiles(csv);
	await ready;
	await page.evaluate(() => {
		history.pushState({}, "", "/user/settings/email-update");
		dispatchEvent(new PopStateEvent("popstate"));
	});
	const email = page.locator("#newEmail");
	await email.fill("later@example.test");
	await email.focus();
	release();
	await expect(email).toHaveValue("later@example.test");
	await expect(email).toBeFocused();
	await expect(page.locator(".mapping-step")).toHaveCount(0);
});
test("migration chooser links and actual TickTick file import refresh catalog", async ({
	authenticatedPage: page,
	apiContext,
}, info) => {
	await page.goto("/user/settings/migrate");
	await expect(
		page.getByRole("heading", {
			name: "Import from other services",
			exact: true,
		}),
	).toBeVisible();
	await expect(page.getByRole("link", { name: /CSV/ })).toBeVisible();
	await page.screenshot({ path: info.outputPath("import-choice.png") });
	await page.getByRole("link", { name: /TickTick/ }).click();
	const saved = page.waitForResponse(
		(r) =>
			r.url().endsWith("/migration/ticktick/migrate") &&
			r.request().method() === "PUT",
	);
	await page.locator("input[type=file]").setInputFiles({
		name: "ticktick.csv",
		mimeType: "text/csv",
		buffer: readFileSync(
			resolve(
				import.meta.dirname,
				"../../pkg/modules/migration/ticktick/testdata_ticktick_export.csv",
			),
		),
	});
	expect((await saved).ok()).toBeTruthy();
	await expect(
		page.getByRole("link", { name: "Go to overview", exact: true }),
	).toBeVisible();
	const projects = await (
		await apiContext.get("projects", { headers: await auth(page) })
	).json();
	expect(projects.length).toBeGreaterThan(1);
	await page.getByRole("link", { name: "Go to overview", exact: true }).click();
	await page.reload();
	await expect(
		page
			.getByRole("link", {
				name: projects.find((p) => p.title !== "Import fixture project").title,
				exact: true,
			})
			.first(),
	).toBeVisible();
	await expect(
		page.getByText(/We will delete your Vikunja account at/),
	).toHaveCount(0);
});
test("credential import required fields rejection and delayed route teardown retain drafts", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/migrate/planka");
	const start = page.getByRole("button", { name: "Start import", exact: true });
	await start.click();
	await expect(
		page.getByRole("alert").filter({ hasText: "A url is required." }),
	).toBeVisible();
	const url = page.getByLabel("Planka URL", { exact: true }),
		token = page.locator("input[type=password]").first();
	await url.fill("http://127.0.0.1:1");
	await token.fill("controlled-token");
	let payload;
	await page.route("**/api/v2/migration/planka/migrate", (route) => {
		payload = route.request().postDataJSON();
		return route.fulfill({
			status: 400,
			json: { message: "Controlled credential refusal" },
		});
	});
	await start.click();
	await expect(page.getByRole("alert")).toContainText(
		"Controlled credential refusal",
	);
	await expect(url).toHaveValue("http://127.0.0.1:1");
	await expect(token).toHaveValue("controlled-token");
	expect(payload).toEqual({
		url: "http://127.0.0.1:1",
		token: "controlled-token",
	});
	let entered, release;
	const ready = new Promise<void>((r) => (entered = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v2/migration/planka/migrate", async (route) => {
		entered();
		await gate;
		await route.fulfill({ json: { message: "started" } });
	});
	await start.click();
	await ready;
	await token.fill("later-token");
	await token.focus();
	await expect(token).toHaveValue("later-token");
	await page.evaluate(() => {
		history.pushState({}, "", "/user/settings/email-update");
		dispatchEvent(new PopStateEvent("popstate"));
	});
	const email = page.locator("#newEmail");
	await email.fill("destination@example.test");
	await email.focus();
	release();
	await expect(email).toHaveValue("destination@example.test");
	await expect(email).toBeFocused();
	await expect(page.locator("main")).not.toContainText(
		"Controlled credential refusal",
	);
});
const verifier =
	"controlled-pkce-verifier-with-at-least-43-characters-0123456789";
const challenge = createHash("sha256").update(verifier).digest("base64url");
const params = (callback) =>
	new URLSearchParams({
		response_type: "code",
		client_id: "fixture-client",
		redirect_uri: callback,
		code_challenge: challenge,
		code_challenge_method: "S256",
		state: "fixture-state",
	}).toString();
test("OAuth actual loopback callback PKCE token exchange identity replay denial", async ({
	authenticatedPage: page,
	apiContext,
	baseURL,
}) => {
	const callback = new URL("/oauth-fixture-callback", baseURL).toString();
	await page.route("**/oauth-fixture-callback?*", (route) =>
		route.fulfill({
			contentType: "text/html",
			body: "<h1>Controlled OAuth callback</h1>",
		}),
	);
	await page.goto("/oauth/authorize?" + params(callback));
	await expect(
		page.getByRole("heading", { name: "Controlled OAuth callback" }),
	).toBeVisible();
	const url = new URL(page.url());
	expect(url.searchParams.get("state")).toBe("fixture-state");
	const code = url.searchParams.get("code");
	expect(code).toBeTruthy();
	const body = {
		grant_type: "authorization_code",
		code,
		client_id: "fixture-client",
		redirect_uri: callback,
		code_verifier: verifier,
	};
	const response = await apiContext.post("oauth/token", { data: body });
	expect(response.ok()).toBeTruthy();
	const token = await response.json();
	expect(token.access_token).toBeTruthy();
	expect(token.refresh_token).toBeTruthy();
	const me = await apiContext.get("user", {
		headers: { Authorization: "Bearer " + token.access_token },
	});
	expect(me.ok()).toBeTruthy();
	expect((await me.json()).username).toBe("migration-reviewer");
	expect((await apiContext.post("oauth/token", { data: body })).ok()).toBe(
		false,
	);
});
test("OAuth missing params and unsafe redirect report actual errors without navigation", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/oauth/authorize");
	await expect(page.getByRole("alert")).toContainText("Missing");
	await page.goto("/oauth/authorize?" + params("https://example.test/refused"));
	await expect(page.getByRole("alert")).toBeVisible();
	await expect(page).toHaveURL(/\/oauth\/authorize\?/);
});
test("OAuth delayed authorization cannot redirect after route replacement", async ({
	authenticatedPage: page,
	baseURL,
}) => {
	let entered, release;
	const ready = new Promise<void>((r) => (entered = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/oauth/authorize", async (route) => {
		const response = await route.fetch();
		entered();
		await gate;
		await route.fulfill({ response });
	});
	await page.goto(
		"/oauth/authorize?" +
			params(new URL("/oauth-fixture-callback", baseURL).toString()),
	);
	await ready;
	await expect(
		page.getByText("Authenticating…", { exact: true }),
	).toBeVisible();
	await page.evaluate(() => {
		history.pushState({}, "", "/user/settings/email-update");
		dispatchEvent(new PopStateEvent("popstate"));
	});
	const email = page.locator("#newEmail");
	await email.fill("oauth-destination@example.test");
	await email.focus();
	release();
	await expect(email).toHaveValue("oauth-destination@example.test");
	await expect(email).toBeFocused();
	await expect(page).toHaveURL(/\/user\/settings\/email-update$/);
});

test("CSV latest preview wins while mapping field DOM and focused draft remain", async ({
	authenticatedPage: page,
}) => {
	await openCSV(page);
	let entered,
		release,
		count = 0;
	const ready = new Promise<void>((r) => (entered = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/migration/csv/preview", async (route) => {
		const response = await route.fetch();
		if (++count === 1) {
			entered();
			await gate;
		}
		await route.fulfill({ response });
	});
	const skip = page.getByLabel("Skip Rows"),
		node = await skip.elementHandle();
	await skip.fill("1");
	await skip.press("Tab");
	await ready;
	await skip.fill("0");
	await skip.press("Tab");
	await skip.focus();
	await expect(
		page.getByRole("button", { name: "Import Tasks", exact: true }),
	).toBeEnabled();
	await expect(
		preview(page).getByText("Imported red task", { exact: true }),
	).toBeVisible();
	release();
	await expect(
		preview(page).getByText("Imported red task", { exact: true }),
	).toBeVisible();
	await expect(skip).toHaveValue("0");
	await expect(skip).toBeFocused();
	expect(await skip.evaluate((el, old) => el === old, node)).toBe(true);
});

test("service status running completed reimport and unknown source contract", async ({
	authenticatedPage: page,
}) => {
	let status = {
		started_at: "2026-01-01T00:00:00Z",
		finished_at: null as string | null,
	};
	await page.route("**/api/v2/migration/planka/status", (route) =>
		route.fulfill({ json: status }),
	);
	await page.goto("/migrate/planka");
	await expect(
		page.getByText(
			"A migration is currently in progress. Please wait until it is done.",
			{ exact: true },
		),
	).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Start import", exact: true }),
	).toHaveCount(0);
	status.finished_at = "2026-01-02T00:00:00Z";
	await page.reload();
	await expect(
		page.getByText(
			/It looks like you've already imported your stuff from Planka/,
		),
	).toBeVisible();
	await page
		.getByRole("button", {
			name: "I am sure, please start migrating now!",
			exact: true,
		})
		.click();
	await expect(
		page.getByRole("button", { name: "Start import", exact: true }),
	).toBeVisible();
	await page.goto("/migrate/unknown-controlled");
	await expect(
		page.getByRole("heading", { name: "Not found", exact: true }),
	).toBeVisible();
});

test("credential actual backend refusal against isolated local Planka probe preserves input", async ({
	authenticatedPage: page,
}) => {
	const requests: string[] = [];
	const server = createServer((req, res) => {
		requests.push(req.url!);
		res.writeHead(401, { "Content-Type": "application/json" });
		res.end(JSON.stringify({ message: "Fixture Planka refuses token" }));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	try {
		const address = server.address() as { port: number };
		await page.goto("/migrate/planka");
		const url = page.getByLabel("Planka URL", { exact: true }),
			token = page.locator("input[type=password]").first();
		await url.fill("http://127.0.0.1:" + address.port);
		await token.fill("controlled-denied-token");
		const refused = page.waitForResponse(
			(r) =>
				r.url().endsWith("/migration/planka/migrate") &&
				r.request().method() === "POST",
		);
		await page
			.getByRole("button", { name: "Start import", exact: true })
			.click();
		expect((await refused).status()).toBe(400);
		await expect(page.getByRole("alert")).toBeVisible();
		await expect(token).toHaveValue("controlled-denied-token");
		expect(requests).toContain("/api/users/me");
		await expect(
			page.getByRole("button", { name: "Start import", exact: true }),
		).toBeEnabled();
	} finally {
		await new Promise<void>((resolve, reject) => {
			server.close((e) => (e ? reject(e) : resolve()));
			server.closeAllConnections();
		});
	}
});

test("OAuth anonymous copied login hash survives reload and actual login callback", async ({
	page,
	currentUser,
	baseURL,
}) => {
	const callback = new URL("/oauth-fixture-callback", baseURL).toString(),
		destination = "/oauth/authorize?" + params(callback);
	await page.route("**/oauth-fixture-callback?*", (route) =>
		route.fulfill({
			contentType: "text/html",
			body: "<h1>Controlled OAuth callback</h1>",
		}),
	);
	await setupApiUrl(page);
	await page.goto(destination);
	await expect(page.locator("#loginform")).toBeVisible();
	const login = new URL(page.url());
	expect(login.pathname).toBe("/login");
	expect(decodeURIComponent(login.hash.slice("#redirect=".length))).toBe(
		destination,
	);
	await page.evaluate(() => localStorage.removeItem("lastVisited"));
	await page.reload();
	await page.locator("#username").fill(currentUser.username);
	await page.locator("#password").fill(TEST_PASSWORD);
	await page.getByRole("button", { name: "Login", exact: true }).click();
	await expect(
		page.getByRole("heading", { name: "Controlled OAuth callback" }),
	).toBeVisible();
	expect(new URL(page.url()).searchParams.get("state")).toBe("fixture-state");
	expect(new URL(page.url()).searchParams.get("code")).toBeTruthy();
});
