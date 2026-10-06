import { test, expect } from "./fixtures";
import { ProjectFactory } from "../../frontend/tests/factories/project";
import { TaskFactory } from "../../frontend/tests/factories/task";
import { createDefaultViews } from "../../frontend/tests/e2e/project/prepareProjects";
const auth = async (page) => ({
	Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem("token"))}`,
});
const select = async (page, name: string) => {
	const radio = page.getByRole("radio", { name, exact: true });
	await radio.focus();
	await radio.press("Space");
	await expect(radio).toBeChecked();
};
test.beforeEach(async () => {
	await ProjectFactory.create(1, { title: "System fixture project" });
	await createDefaultViews(1);
	await TaskFactory.create(1, { title: "System fixture task", project_id: 1 });
});
for (const width of [1440, 390])
	test(`avatar real local providers persistence and image endpoint ${width}`, async ({
		authenticatedPage: page,
		apiContext,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/user/settings/avatar");
		if (width === 390) {
			const banner = page.locator(".add-to-home-screen");
			await expect(banner).toBeVisible();
			await banner.getByRole("button", {name: "Close banner", exact: true}).click();
			await expect(banner).not.toBeVisible();
		}
		for (const [label, provider] of [
			["Default", "default"],
			["Initials", "initials"],
			["Marble", "marble"],
		]) {
			await select(page, label);
			const saved = page.waitForResponse(
				(r) =>
					r.url().endsWith("/user/settings/avatar") &&
					r.request().method() === "POST",
			);
			await page.getByRole("button", { name: "Save", exact: true }).click();
			expect((await saved).ok()).toBeTruthy();
			expect(
				(
					await (
						await apiContext.get("user/settings/avatar", {
							headers: await auth(page),
						})
					).json()
				).avatar_provider,
			).toBe(provider);
			await page.reload();
			await expect(
				page.getByRole("radio", { name: label, exact: true }),
			).toBeChecked();
			const image = await apiContext.get("avatar/migration-reviewer?size=64", {
				headers: await auth(page),
			});
			expect(image.ok()).toBeTruthy();
			expect(image.headers()["content-type"]).toMatch(/image\//);
			expect((await image.body()).length).toBeGreaterThan(10);
		}
		await page.screenshot({ path: info.outputPath(`avatar-${width}.png`) });
	});
test("avatar cropped upload produces square image persisted across reload", async ({
	authenticatedPage: page,
	apiContext,
}, info) => {
	await page.goto("/user/settings/avatar");
	await select(page, "Upload");
	const fixture = await page.evaluate(() => {
		const canvas = document.createElement("canvas");
		canvas.width = 160;
		canvas.height = 80;
		const ctx = canvas.getContext("2d")!;
		ctx.fillStyle = "red";
		ctx.fillRect(0, 0, 80, 80);
		ctx.fillStyle = "lime";
		ctx.fillRect(80, 0, 80, 80);
		return canvas.toDataURL().split(",")[1];
	});
	await page.locator("input[type=file]").setInputFiles({
		name: "controlled-avatar.png",
		mimeType: "image/png",
		buffer: Buffer.from(fixture, "base64"),
	});
	const upload = page.getByRole("button", {
		name: "Upload Avatar",
		exact: true,
	});
	await expect(upload).toBeEnabled();
	await page.screenshot({ path: info.outputPath("avatar-crop.png") });
	const saved = page.waitForResponse(
		(r) =>
			r.url().endsWith("/user/settings/avatar/upload") &&
			r.request().method() === "PUT",
	);
	await upload.click();
	expect((await saved).ok()).toBeTruthy();
	await expect(
		page.locator(".cropper-container, .vue-advanced-cropper"),
	).toHaveCount(0);
	await page.reload();
	await expect(
		page.getByRole("radio", { name: "Upload", exact: true }),
	).toBeChecked();
	const image = await apiContext.get("avatar/migration-reviewer?size=64", {
		headers: await auth(page),
	});
	expect(image.ok()).toBeTruthy();
	const data = await page.evaluate(
		async (encoded) => {
			const image = new Image();
			image.src = "data:image/png;base64," + encoded;
			await image.decode();
			const canvas = document.createElement("canvas");
			canvas.width = image.width;
			canvas.height = image.height;
			const ctx = canvas.getContext("2d")!;
			ctx.drawImage(image, 0, 0);
			return {
				width: image.width,
				height: image.height,
				red: Array.from(
					ctx.getImageData(0, 0, image.width, image.height).data,
				).some((v, i) => i % 4 === 0 && v > 0),
			};
		},
		(await image.body()).toString("base64"),
	);
	expect(data.width).toBe(data.height);
	expect(data.width).toBe(64);
	expect(data.red).toBeTruthy();
});
test("avatar rejected save retry retains a later provider selection while pending", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/avatar");
	let fail = true,
		start!: () => void,
		release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/settings/avatar", async (route) => {
		if (route.request().method() !== "POST") return route.continue();
		if (fail)
			return route.fulfill({
				status: 503,
				json: { message: "Avatar save failed" },
			});
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response });
	});
	await select(page, "Initials");
	const save = page.getByRole("button", { name: "Save", exact: true });
	await save.click();
	await expect(
		page.getByRole("alert").filter({ hasText: "Avatar save failed" }),
	).toBeVisible();
	await expect(
		page.getByRole("radio", { name: "Initials", exact: true }),
	).toBeChecked();
	fail = false;
	await save.click();
	await ready;
	await expect(save).toBeDisabled();
	await select(page, "Marble");
	release();
	await expect(save).toBeEnabled();
	await expect(
		page.getByRole("radio", { name: "Marble", exact: true }),
	).toBeChecked();
	await expect(
		page.getByRole("radio", { name: "Marble", exact: true }),
	).toBeFocused();
	expect(
		(
			await (
				await apiContext.get("user/settings/avatar", {
					headers: await auth(page),
				})
			).json()
		).avatar_provider,
	).toBe("initials");
	await expect(
		page.getByRole("alert").filter({ hasText: "Avatar save failed" }),
	).toHaveCount(0);
});
test("avatar read retry and provider supplied notices use route owned UI", async ({
	authenticatedPage: page,
}) => {
	let fail = true;
	await page.route("**/api/v1/user/settings/avatar", (route) =>
		route.fulfill(
			fail
				? { status: 503, json: { message: "Avatar read unavailable" } }
				: { json: { avatar_provider: "initials" } },
		),
	);
	await page.goto("/user/settings/avatar");
	await expect(
		page.getByRole("alert").filter({ hasText: "Avatar read unavailable" }),
	).toBeVisible();
	fail = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await expect(
		page.getByRole("radio", { name: "Initials", exact: true }),
	).toBeChecked();
	await page.unroute("**/api/v1/user/settings/avatar");
	for (const provider of ["ldap", "openid"]) {
		await page.route("**/api/v1/user/settings/avatar", (route) =>
			route.fulfill({ json: { avatar_provider: provider } }),
		);
		await page.reload();
		await expect(page.getByRole("radio")).toHaveCount(0);
		await expect(
			page.getByRole("button", { name: "Save", exact: true }),
		).toHaveCount(0);
		await expect(page.locator(".card-content")).toContainText(
			provider === "ldap" ? "LDAP" : "login provider",
		);
		await page.unroute("**/api/v1/user/settings/avatar");
	}
});
test("late avatar write cannot disturb destination draft or publish notification", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/user/settings/avatar");
	let start!: () => void, release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/settings/avatar", async (route) => {
		if (route.request().method() !== "POST") return route.continue();
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	await select(page, "Marble");
	await page.getByRole("button", { name: "Save", exact: true }).click();
	await ready;
	await page
		.getByRole("link", { name: "Update Your Email Address", exact: true })
		.click();
	const email = page.locator("#newEmail");
	await email.fill("avatar-destination@example.com");
	await email.focus();
	release();
	await page.waitForLoadState("networkidle");
	await expect(email).toHaveValue("avatar-destination@example.com");
	await expect(email).toBeFocused();
	await expect(
		page.getByText("Avatar status was updated successfully!", { exact: true }),
	).toHaveCount(0);
});
for (const width of [1440, 390])
	test(`about close Escape history and cleanup ${width}`, async ({
		authenticatedPage: page,
	}, info) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto("/projects");
		await expect(
			page
				.locator("main")
				.getByText("System fixture project", { exact: true })
				.first(),
		).toBeVisible();
		await page.evaluate(() => {
			history.pushState({}, "", "/about");
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(page.getByRole("dialog")).toContainText(/Version|version/);
		await expect
			.poll(() =>
				page.getByRole("dialog").evaluate((el) => getComputedStyle(el).opacity),
			)
			.toBe("1");
		await page.screenshot({ path: info.outputPath(`about-${width}.png`) });
		await page.keyboard.press("Escape");
		await expect(page).toHaveURL(/\/projects$/);
		await expect(page.getByRole("dialog")).toHaveCount(0);
		expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
			"hidden",
		);
	});
test("legacy list redirect preserves repeated query values hash and reload", async ({
	authenticatedPage: page,
}) => {
	await page.goto(
		"/lists/1/1?sort_by[]=title&sort_by[]=id&filter=done%3Dfalse#controlled-hash",
	);
	await expect(page).toHaveURL(/\/projects\/1\/1\?/);
	const url = new URL(page.url());
	expect(url.searchParams.getAll("sort_by[]")).toEqual(["title", "id"]);
	expect(url.hash).toBe("#controlled-hash");
	await expect(
		page
			.getByRole("link", { name: "System fixture task", exact: true })
			.first(),
	).toBeVisible();
	await page.reload();
	await expect(page).toHaveURL(/\/projects\/1\/1\?/);
});
for (const path of [
	"/missing/nested/path",
	"/missing%2Fencoded",
	"/user/settings/not-a-setting",
])
	test(`not found deep link title and reload ${path}`, async ({
		authenticatedPage: page,
	}, info) => {
		await page.goto(path);
		await expect(
			page.getByRole("heading", { name: "Not found", exact: true }),
		).toBeVisible();
		await expect(page).toHaveTitle(/404/);
		await page.screenshot({ path: info.outputPath("not-found.png") });
		await page.reload();
		await expect(
			page.getByRole("heading", { name: "Not found", exact: true }),
		).toBeVisible();
	});

async function controlledImage(page) {
	const encoded = await page.evaluate(() => {
		const c = document.createElement("canvas");
		c.width = 160;
		c.height = 80;
		const ctx = c.getContext("2d")!;
		ctx.fillStyle = "red";
		ctx.fillRect(0, 0, 80, 80);
		ctx.fillStyle = "lime";
		ctx.fillRect(80, 0, 80, 80);
		return c.toDataURL().split(",")[1];
	});
	return {
		name: "controlled-avatar.png",
		mimeType: "image/png",
		buffer: Buffer.from(encoded, "base64"),
	};
}
test("avatar upload rejection retains crop DOM and retries the actual file", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/user/settings/avatar");
	await select(page, "Upload");
	await page
		.locator("input[type=file]")
		.setInputFiles(await controlledImage(page));
	const crop = page.locator(".cropper-container, .vue-advanced-cropper");
	await expect(crop).toBeVisible();
	await crop.evaluate((el) => ((window as any).heldCropNode = el));
	let fail = true;
	await page.route("**/api/v1/user/settings/avatar/upload", (route) =>
		fail
			? route.fulfill({
					status: 503,
					json: { message: "Avatar upload rejected" },
				})
			: route.continue(),
	);
	const button = page.getByRole("button", {
		name: "Upload Avatar",
		exact: true,
	});
	await expect(button).toBeEnabled();
	const rejected = page.waitForResponse((r) =>
		r.url().endsWith("/user/settings/avatar/upload"),
	);
	await button.click();
	expect((await rejected).status()).toBe(503);
	await expect(crop).toBeVisible();
	expect(
		await crop.evaluate((el) => el === (window as any).heldCropNode),
	).toBeTruthy();
	await expect(
		page.getByRole("alert").filter({ hasText: "Avatar upload rejected" }),
	).toBeVisible();
	fail = false;
	const accepted = page.waitForResponse((r) =>
		r.url().endsWith("/user/settings/avatar/upload"),
	);
	await button.click();
	expect((await accepted).ok()).toBeTruthy();
	await expect(crop).toHaveCount(0);
});
test("accepted avatar upload after navigation cannot publish and releases cropper", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/user/settings/avatar");
	await select(page, "Upload");
	await page
		.locator("input[type=file]")
		.setInputFiles(await controlledImage(page));
	let start!: () => void, release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/settings/avatar/upload", async (route) => {
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response }).catch(() => {});
	});
	const button = page.getByRole("button", {
		name: "Upload Avatar",
		exact: true,
	});
	await expect(button).toBeEnabled();
	await button.click();
	await ready;
	await expect(button).toBeDisabled();
	await page
		.getByRole("link", { name: "Update Your Email Address", exact: true })
		.click();
	const email = page.locator("#newEmail");
	await email.fill("crop-teardown@example.com");
	await email.focus();
	release();
	await page.waitForLoadState("networkidle");
	await expect(email).toHaveValue("crop-teardown@example.com");
	await expect(email).toBeFocused();
	await expect(
		page.locator(".cropper-container, .vue-advanced-cropper"),
	).toHaveCount(0);
	await expect(
		page.getByText("The avatar has been set successfully!", { exact: true }),
	).toHaveCount(0);
});

test("avatar read retry preserves a later focused provider draft", async ({
	authenticatedPage: page,
}) => {
	let fail = true,
		start!: () => void,
		release!: () => void;
	const ready = new Promise<void>((r) => (start = r)),
		gate = new Promise<void>((r) => (release = r));
	await page.route("**/api/v1/user/settings/avatar", async (route) => {
		if (fail)
			return route.fulfill({
				status: 503,
				json: { message: "Avatar read failed" },
			});
		const response = await route.fetch();
		start();
		await gate;
		await route.fulfill({ response });
	});
	await page.goto("/user/settings/avatar");
	await expect(
		page.getByRole("alert").filter({ hasText: "Avatar read failed" }),
	).toBeVisible();
	fail = false;
	await page.getByRole("button", { name: "Retry", exact: true }).click();
	await ready;
	await select(page, "Marble");
	release();
	await expect(
		page.getByRole("button", { name: "Retry", exact: true }),
	).toBeHidden();
	await expect(
		page.getByRole("radio", { name: "Marble", exact: true }),
	).toBeChecked();
	await expect(
		page.getByRole("radio", { name: "Marble", exact: true }),
	).toBeFocused();
});

test("about keyboard account-menu entry and footer close return to prior route", async ({
	authenticatedPage: page,
}) => {
	await page.goto("/projects");
	await expect(
		page
			.locator("main")
			.getByText("System fixture project", { exact: true })
			.first(),
	).toBeVisible();
	const account = page.getByRole("button", {
		name: "migration-reviewer",
		exact: true,
	});
	await account.focus();
	await account.press("Enter");
	const about = page.getByRole("link", { name: "About", exact: true });
	await about.focus();
	await about.press("Enter");
	await expect(page.getByRole("dialog")).toBeVisible();
	await expect(
		page.getByRole("button", { name: "Close dialog", exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "Close", exact: true }).last().click();
	await expect(page).toHaveURL(/\/projects$/);
	await expect(page.getByRole("dialog")).toHaveCount(0);
	expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
		"hidden",
	);
});

test("avatar provider switches retain the selected file until accepted upload", async ({
	authenticatedPage: page,
	apiContext,
}) => {
	await page.goto("/user/settings/avatar");
	await select(page, "Upload");
	const fixture = await page.evaluate(() => {
		const canvas = document.createElement("canvas");
		canvas.width = 80;
		canvas.height = 80;
		const ctx = canvas.getContext("2d")!;
		ctx.fillStyle = "red";
		ctx.fillRect(0, 0, 80, 80);
		return canvas.toDataURL().split(",")[1];
	});
	await page
		.locator("input[type=file]")
		.setInputFiles({
			name: "provider-draft.png",
			mimeType: "image/png",
			buffer: Buffer.from(fixture, "base64"),
		});
	const crop = page.locator(".cropper-container, .vue-advanced-cropper");
	await expect(crop).toBeVisible();
	await select(page, "Default");
	await expect(crop).toBeHidden();
	await select(page, "Upload");
	await expect(crop).toBeVisible();
	const upload = page.getByRole("button", {
		name: "Upload Avatar",
		exact: true,
	});
	await expect(upload).toBeEnabled();
	const saved = page.waitForResponse(
		(r) =>
			r.url().endsWith("/user/settings/avatar/upload") &&
			r.request().method() === "PUT",
	);
	await upload.click();
	expect((await saved).ok()).toBeTruthy();
	await expect(crop).toHaveCount(0);
	expect(
		(
			await (
				await apiContext.get("user/settings/avatar", {
					headers: await auth(page),
				})
			).json()
		).avatar_provider,
	).toBe("upload");
});
