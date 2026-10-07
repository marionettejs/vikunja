import { test, expect } from "./fixtures";
import type { Page, Locator } from "@playwright/test";
import { proContract } from "./pro-contract-fixture";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { createDefaultViews } from "../../frontend/tests/e2e/project/prepareProjects";
// Frozen Vue and native expose the same actions through different public controls.
function adminTimeUi(page: Page) {
	const project = test.info().project.name;
	const vue = project.startsWith("vue-") || (!project.startsWith("marionette-") && process.env.VIKUNJA_REFERENCE_VUE === "1");
	return {
		// Vue UsersView/TimeEntryForm notify globally; native reports inside the active form.
		error: (scope: Page | Locator) => vue ? page.locator(".vue-notification.error") : scope.getByRole("alert"),
		success: (text: string) => (vue ? page.locator(".vue-notification.success") : page.getByRole("alert")).filter({hasText: text}),
		// Vue ProjectSearch's accessible name comes from its placeholder, not its adjacent label.
		project: (scope: Page | Locator) => scope.getByRole("combobox", {name: vue ? "Type to search for a project…" : "Project", exact: true}),
		// Vue's DatepickerWithRange trigger slot is an XButton; native uses details/summary.
		range: (dialog: Locator) => vue ? dialog.locator(".datepicker-with-range-container > button") : dialog.locator("summary"),
		// Vue Modal shows the external close on desktop and the Card close on mobile.
		closeFilters: (dialog: Locator) => dialog.getByRole("button", {name: vue && (page.viewportSize()?.width ?? 1440) > 769 ? "Close dialog" : "Close", exact: true}),
	};
}
async function typeSearch(search: Locator, query: string) {
	// Vue Multiselect searches on keyup; fill emits input only. Use real keyboard events in both apps.
	await search.focus();
	await search.press("ControlOrMeta+a");
	await search.pressSequentially(query);
}

test.beforeEach(async () => {
	await ProjectFactory.create(1, { title: "Contract project" });
	await createDefaultViews(1);
	await TaskFactory.create(1, { title: "Contract task", project_id: 1 });
});
for (const path of [
	"/time-tracking",
	"/admin",
	"/admin/users",
	"/admin/projects",
])
	test(`real unlicensed UI and backend gate ${path}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		const requests: string[] = [];
		page.on("request", (request) => {
			if (/\/api\/v[12]\/(admin|time-entries)/.test(request.url()))
				requests.push(request.url());
		});
		await page.goto(path);
		await expect(page.getByText(/not found/i).first()).toBeVisible();
		expect(requests).toEqual([]);
		const token = await page.evaluate(() => localStorage.getItem("token")),
			base = process.env.API_URL!,
			endpoint =
				path === "/time-tracking"
					? base.replace("/v1", "/v2") + "time-entries"
					: base + path.slice(1) + (path === "/admin" ? "/overview" : "");
		const response = await apiContext.get(endpoint, {
			headers: { Authorization: `Bearer ${token}` },
		});
		expect(response.ok()).toBeFalsy();
		expect([403, 404]).toContain(response.status());
		await page.screenshot({ path: info.outputPath("disabled.png") });
	});
test("frontend contract admin advertised feature denies ordinary user", async ({
	authenticatedPage: page,
}) => {
	const fixture = await proContract(page, {
		admin: false,
		features: ["admin_panel"],
	});
	await page.goto("/admin/users");
	await expect(page.getByText(/not found/i).first()).toBeVisible();
	expect(fixture.calls).toEqual([]);
});
for (const width of [1440, 390])
	test(`frontend contract admin overview and local user changes ${width}`, async ({
		authenticatedPage: page,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		const fixture = await proContract(page);
		await page.goto("/admin");
		await expect(page.getByText("frontend-contract-only")).toBeVisible();
		await page.screenshot({ path: info.outputPath("overview.png") });
		await page.goto("/admin/users");
		const row = page.getByRole("row").filter({ hasText: "contract-local" });
		await row.getByRole("button", { name: "Details" }).click();
		const dialog = page.getByRole("dialog");
		await dialog.getByLabel("Administrator", { exact: true }).check();
		await dialog.getByLabel("Status", { exact: true }).selectOption("2");
		fixture.rejectNext("/status");
		await dialog.getByRole("button", { name: "Save changes" }).click();
		await expect(adminTimeUi(page).error(dialog)).toContainText("contract rejection");
		expect(
			fixture.calls.filter(
				(c) => c.path.endsWith("/admin") && c.method === "PATCH",
			),
		).toHaveLength(1);
		await expect(
			dialog.getByLabel("Administrator", { exact: true }),
		).toBeChecked();
		await dialog.getByRole("button", { name: "Save changes" }).click();
		await expect(dialog).toHaveCount(0);
		// Keep the identical call-count failure while checking the remaining user-visible outcome.
		expect.soft(
			fixture.calls.filter(
				(c) => c.path.endsWith("/admin") && c.method === "PATCH",
			),
		).toHaveLength(1);
		await expect(row).toContainText("Disabled");
		await row.getByRole("button", { name: "Details" }).click();
		await dialog
			.getByLabel("New password", { exact: true })
			.fill("contract-password");
		await dialog
			.getByRole("button", { name: "Set password", exact: true })
			.click();
		await expect(
			dialog.getByLabel("New password", { exact: true }),
		).toHaveValue("");
		expect(
			fixture.calls.find((c) => c.path.endsWith("/password"))?.body,
		).toEqual({ new_password: "contract-password" });
		await dialog
			.getByRole("button", { name: "Send password-reset email" })
			.click();
		await expect(
			adminTimeUi(page).success("password-reset email was sent"),
		).toBeVisible();
		await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
		await page.screenshot({ path: info.outputPath("users.png") });
	});
test("frontend contract admin create external password restriction and delete modes", async ({
	authenticatedPage: page,
}) => {
	const fixture = await proContract(page);
	await page.goto("/admin/users");
	await page.getByRole("button", { name: "Add user" }).click();
	let dialog = page.getByRole("dialog");
	await dialog.getByLabel("Username", { exact: true }).fill("created-contract");
	await dialog
		.getByLabel("Email address", { exact: true })
		.fill("created@example.test");
	await dialog
		.getByLabel("Password", { exact: true })
		.fill("contract-password");
	await dialog.getByRole("button", { name: "Create user" }).click();
	await expect(dialog).toHaveCount(0);
	const row = page.getByRole("row").filter({ hasText: "created-contract" });
	await row.getByRole("button", { name: "Details" }).click();
	await dialog.getByRole("button", { name: "Delete", exact: true }).click();
	await dialog.getByRole("button", { name: "Schedule deletion" }).click();
	await expect(dialog).toHaveCount(0);
	await expect(row).toBeVisible();
	await row.getByRole("button", { name: "Details" }).click();
	await dialog.getByRole("button", { name: "Delete", exact: true }).click();
	await dialog.getByRole("button", { name: "Delete now" }).click();
	await expect(row).toHaveCount(0);
	expect(
		fixture.calls.filter((c) => c.method === "DELETE").map((c) => c.query),
	).toEqual(["?mode=scheduled", "?mode=now"]);
	await page
		.getByRole("row")
		.filter({ hasText: "contract-oidc" })
		.getByRole("button", { name: "Details" })
		.click();
	await expect(dialog.getByText("contract-subject")).toBeVisible();
	await expect(
		dialog.getByRole("button", { name: "Set password", exact: true }),
	).toHaveCount(0);
});
test("frontend contract admin owner search keyboard selection and transport", async ({
	authenticatedPage: page,
}, info) => {
	const fixture = await proContract(page);
	await page.goto("/admin/projects");
	await page.getByRole("row").filter({hasText:"Contract project"})
		.getByRole("button", { name: "Open project settings menu" })
		.click();
	await page
		.getByRole("button", { name: "Reassign owner", exact: true })
		.click();
	const dialog = page.getByRole("dialog"),
		search = dialog.getByRole("combobox");
	await typeSearch(search, "contract-local");
	await expect(dialog.getByRole("option")).toHaveCount(1);
	await search.press("Enter");
	await dialog
		.getByRole("button", { name: "Reassign owner", exact: true })
		.click();
	await expect(dialog).toHaveCount(0);
	expect(fixture.calls.find((c) => c.path.endsWith("/owner"))?.body).toEqual({
		owner_id: 2,
	});
	await page.screenshot({ path: info.outputPath("projects.png") });
});
for (const width of [1440, 390])
	test(`frontend contract time manual edit delete and timer lifecycle ${width}`, async ({
		authenticatedPage: page,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		const fixture = await proContract(page);
		await page.goto("/time-tracking");
		await page.locator("[data-cy=addTimeEntry]").click();
		await typeSearch(adminTimeUi(page).project(page), "Contract");
		await page.getByRole("option", { name: "Contract project" }).click();
		await page.locator("[data-cy=timeEntryComment]").fill("Manual contract");
		await page.locator("[data-cy=smartFill]").click();
		await page.locator("[data-cy=saveTimeEntry]").click();
		let row = page
			.locator("[data-cy=timeEntry]")
			.filter({ hasText: "Manual contract" });
		await expect(row).toBeVisible();
		const created = fixture.calls.find(
			(c) => c.method === "POST" && c.path.endsWith("/time-entries"),
		)!;
		expect(created.body.project_id).toBe(1);
		expect(created.body.end_time).toBeTruthy();
		await row.locator("[data-cy=editTimeEntry]").click();
		await page.locator("[data-cy=timeEntryComment]").fill("Edited contract");
		fixture.rejectNext("/time-entries/");
		await page.locator("[data-cy=updateTimeEntry]").click();
		await expect(adminTimeUi(page).error(page)).toContainText("contract rejection");
		await expect(page.locator("[data-cy=timeEntryComment]")).toHaveValue(
			"Edited contract",
		);
		await page.locator("[data-cy=updateTimeEntry]").click();
		row = page
			.locator("[data-cy=timeEntry]")
			.filter({ hasText: "Edited contract" });
		await expect(row).toBeVisible();
		await row.locator("[data-cy=deleteTimeEntry]").click();
		await expect(row).toHaveCount(0);
		await page.locator("[data-cy=addTimeEntry]").click();
		await typeSearch(adminTimeUi(page).project(page), "Contract");
		await page.getByRole("option", { name: "Contract project" }).click();
		await page.locator("[data-cy=timeEntryComment]").fill("Timer contract");
		await page.locator("[data-cy=startTimer]").click();
		await expect(page.locator("[data-cy=timerBadge]")).toBeVisible();
		const timer = fixture.calls
			.filter((c) => c.method === "POST" && c.path.endsWith("/time-entries"))
			.at(-1)!;
		expect(timer.body).not.toHaveProperty("end_time");
		await page.reload();
		await expect(page.locator("[data-cy=timerBadge]")).toBeVisible();
		await page.locator("[data-cy=stopTimer]").click();
		await expect(page.locator("[data-cy=timerBadge]")).toHaveCount(0);
		expect(fixture.entries[0].end_time).toBeTruthy();
		await page.screenshot({ path: info.outputPath("time.png") });
	});
test("frontend contract time deep links restore before browse and task form uses locked task", async ({
	authenticatedPage: page,
}) => {
	const fixture = await proContract(page);
	await page.goto(
		"/time-tracking?project=1&task=1&from=2026-01-01&to=2026-12-31",
	);
	await expect(page.locator("[data-cy=openTimeTrackingFilters]")).toBeVisible();
	await expect
		.poll(
			() =>
				fixture.calls.find(
					(c) =>
						c.path.endsWith("/time-entries") &&
						c.query.includes("per_page=250"),
				)?.query,
		)
		.toContain("task_id+%3D+1");
	const browse = fixture.calls.find((c) => c.query.includes("per_page=250"))!;
	expect(new URLSearchParams(browse.query).get("filter")).toContain(
		"project_id = 1",
	);
	await page.goto("/tasks/1");
	await page.getByRole("button", { name: "Track time", exact: true }).click();
	await expect(page.locator("[data-cy=timeEntryForm]")).toBeVisible();
	await expect(
		page.locator("[data-cy=timeEntryForm]").getByRole("combobox"),
	).toHaveCount(0);
	await page.locator("[data-cy=timeEntryComment]").fill("Locked task contract");
	await page.locator("[data-cy=saveTimeEntry]").click();
	await expect(
		page
			.locator("[data-cy=timeEntry]")
			.filter({ hasText: "Locked task contract" }),
	).toBeVisible();
	expect(
		fixture.calls.find(
			(c) => c.method === "POST" && c.body?.comment === "Locked task contract",
		)?.body.task_id,
	).toBe(1);
});
test("frontend contract time and admin late route responses cannot reopen abandoned content", async ({
	authenticatedPage: page,
}) => {
	const fixture = await proContract(page);
	fixture.holdNext("/admin/users");
	await page.goto("/admin/users");
	await expect
		.poll(() => fixture.calls.some((c) => c.path.endsWith("/admin/users")))
		.toBeTruthy();
	await page
		.getByRole("link", { name: "Projects", exact: true })
		.first()
		.click();
	fixture.release();
	await expect(page).toHaveURL(/\/projects$/);
	await expect(
		page.getByRole("button", { name: "Details", exact: true }),
	).toHaveCount(0);
	fixture.holdNext("per_page=250");
	await page.goto("/time-tracking");
	await expect
		.poll(() => fixture.calls.some((c) => c.query.includes("per_page=250")))
		.toBeTruthy();
	await page
		.getByRole("link", { name: "Projects", exact: true })
		.first()
		.click();
	fixture.release();
	await expect(page).toHaveURL(/\/projects$/);
	await expect(page.locator("[data-cy=addTimeEntry]")).toHaveCount(0);
});
for (const width of [1440, 390])
	test(`frontend contract time filters preserve focused form and persist query ${width}`, async ({
		authenticatedPage: page,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		const fixture = await proContract(page);
		await page.goto("/time-tracking");
		await page.locator("[data-cy=addTimeEntry]").click();
		const comment = page.locator("[data-cy=timeEntryComment]");
		await comment.fill("Draft survives filter");
		await page.locator("[data-cy=openTimeTrackingFilters]").click();
		const dialog = page.getByRole("dialog");
		await expect(dialog).toBeVisible();
		await adminTimeUi(page).range(dialog).click();
		await dialog
			.getByRole("button", { name: "This Month", exact: true })
			.click();
		await expect(page).toHaveURL(/from=now\/M/);
		await typeSearch(adminTimeUi(page).project(dialog), "Contract");
		await dialog.getByRole("option", { name: "Contract project" }).click();
		await expect
			.poll(() =>
				new URLSearchParams(
					fixture.calls
						.filter((c) => c.query.includes("per_page=250"))
						.at(-1)?.query,
				).get("filter"),
			)
			.toContain("project_id = 1");
		await adminTimeUi(page).closeFilters(dialog).click();
		await expect(dialog).toHaveCount(0);
		await expect(comment).toHaveValue("Draft survives filter");
		await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
		await page.locator("[data-cy=openTimeTrackingFilters]").click();
		await expect(
			adminTimeUi(page).project(dialog),
		).toHaveValue("Contract project");
		await adminTimeUi(page).closeFilters(dialog).click();
		await page.screenshot({ path: info.outputPath("filters.png") });
	});
test("frontend contract advertised enabled UI does not unlock real backend", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await proContract(page);
	await page.goto("/admin");
	await expect(page.getByText("frontend-contract-only")).toBeVisible();
	const headers = {
			Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("token"))}`,
		},
		base = process.env.API_URL!;
	for (const path of [
		base + "admin/users",
		base + "admin/projects",
		base.replace("/v1", "/v2") + "time-entries",
	]) {
		const response = await apiContext.get(path, { headers });
		expect(response.status()).toBe(404);
	}
	const info = await (await apiContext.get(base + "info")).json();
	expect(info.enabled_pro_features ?? []).not.toContain("admin_panel");
	expect(info.enabled_pro_features ?? []).not.toContain("time_tracking");
});
test("frontend contract time author controls and settled totals exclude running entry", async ({
	authenticatedPage: page,
}, info) => {
	const fixture = await proContract(page),
		now = new Date(),
		earlier = new Date(+now - 7200000);
	fixture.entries.push(
		{
			id: 10,
			user_id: 1,
			project_id: 1,
			task_id: 0,
			start_time: earlier.toISOString(),
			end_time: now.toISOString(),
			comment: "Own settled",
			created: now.toISOString(),
			updated: now.toISOString(),
		},
		{
			id: 11,
			user_id: 2,
			project_id: 1,
			task_id: 0,
			start_time: earlier.toISOString(),
			end_time: now.toISOString(),
			comment: "Other settled",
			created: now.toISOString(),
			updated: now.toISOString(),
		},
		{
			id: 12,
			user_id: 1,
			project_id: 1,
			task_id: 0,
			start_time: now.toISOString(),
			end_time: null,
			comment: "Running contract",
			created: now.toISOString(),
			updated: now.toISOString(),
		},
	);
	await page.goto("/time-tracking");
	await expect(page.locator("[data-cy=timeEntry]")).toHaveCount(3);
	const other = page
		.locator("[data-cy=timeEntry]")
		.filter({ hasText: "Other settled" });
	await expect(
		other.locator("[data-cy=editTimeEntry],[data-cy=deleteTimeEntry]"),
	).toHaveCount(0);
	await expect(page.locator("tfoot")).toContainText("4h 0m");
	await expect(
		page.locator("[data-cy=timeEntry]").filter({ hasText: "Running contract" }),
	).toContainText("…");
	await page.screenshot({ path: info.outputPath("totals.png") });
});
test("frontend contract admin rejected create retains focused later draft and modal cancellation aborts", async ({
	authenticatedPage: page,
}) => {
	const fixture = await proContract(page);
	await page.goto("/admin/users");
	await page.getByRole("button", { name: "Add user" }).click();
	const dialog = page.getByRole("dialog"),
		username = dialog.getByLabel("Username", { exact: true });
	await username.fill("draft-contract");
	await dialog
		.getByLabel("Email address", { exact: true })
		.fill("draft@example.test");
	await dialog.getByLabel("Password", { exact: true }).fill("draft-password");
	fixture.rejectNext("/admin/users");
	fixture.holdNext("/admin/users");
	await dialog
		.getByRole("button", { name: "Create user", exact: true })
		.click();
	await username.fill("later-draft");
	await username.focus();
	fixture.release();
	await expect(adminTimeUi(page).error(dialog)).toContainText("contract rejection");
	await expect(username).toBeFocused();
	await expect(username).toHaveValue("later-draft");
	await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
	await expect(dialog).toHaveCount(0);
	await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
	expect(
		fixture.users.some(
			(u) => u.username === "draft-contract" || u.username === "later-draft",
		),
	).toBeFalsy();
});
test("frontend contract timer websocket events own shell lifetime and clean up on logout", async ({
	authenticatedPage: page,
}) => {
	const fixture = await proContract(page);
	let send: (data: object) => void = () => {},
		authenticated = false,
		closed = false;
	await page.routeWebSocket(/\/api\/v1\/ws$/, (socket) => {
		send = (data) => socket.send(JSON.stringify(data));
		socket.onMessage((message) => {
			const data = JSON.parse(String(message));
			if (data.action === "auth") {
				authenticated = Boolean(data.token);
				send({ action: "auth.success", success: true });
			}
		});
		socket.onClose(() => {
			closed = true;
		});
	});
	await page.goto("/time-tracking");
	await expect.poll(() => authenticated).toBeTruthy();
	const now = new Date().toISOString(),
		entry = {
			id: 900,
			user_id: 1,
			project_id: 1,
			task_id: 0,
			start_time: now,
			end_time: null,
			comment: "Websocket contract",
			created: now,
			updated: now,
		};
	send({ event: "timer.created", data: entry });
	await expect(page.locator("[data-cy=timerBadge]")).toBeVisible();
	await page
		.getByRole("link", { name: "Projects", exact: true })
		.first()
		.click();
	await expect(page.locator("[data-cy=timerBadge]")).toBeVisible();
	send({ event: "timer.updated", data: { ...entry, end_time: now } });
	await expect(page.locator("[data-cy=timerBadge]")).toHaveCount(0);
	send({ event: "timer.created", data: entry });
	await expect(page.locator("[data-cy=timerBadge]")).toBeVisible();
	send({ event: "timer.deleted", data: entry });
	await expect(page.locator("[data-cy=timerBadge]")).toHaveCount(0);
	expect(fixture.calls.some((c) => c.query.includes("end_time"))).toBeTruthy();
	await page.locator(".username-dropdown-trigger").click();
	await page.getByRole("button", { name: "Logout", exact: true }).click();
	await expect.poll(() => closed).toBeTruthy();
	await expect(page).toHaveURL(/\/login$/);
});
