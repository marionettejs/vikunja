// Isolated OIDC provider: disposable keys, synthetic identity, single-use codes.
import { createServer } from "node:http";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";
const issuer = "http://127.0.0.1:18765";
const { publicKey, privateKey } = generateKeyPairSync("rsa", {
	modulusLength: 2048,
});
const jwk = {
	...publicKey.export({ format: "jwk" }),
	kid: "fixture-key",
	alg: "RS256",
	use: "sig",
};
const codes = new Map();
const claims = {
	sub: "isolated-oidc-user",
	email: "oidc-fixture@example.invalid",
	email_verified: true,
	name: "OIDC Fixture",
	preferred_username: "oidc-fixture",
};
const encode = (value) =>
	Buffer.from(JSON.stringify(value)).toString("base64url");
const jwt = () => {
	const now = Math.floor(Date.now() / 1000),
		payload = `${encode({ alg: "RS256", kid: jwk.kid, typ: "JWT" })}.${encode({ ...claims, iss: issuer, aud: "fixture-client", iat: now, exp: now + 300 })}`;
	return `${payload}.${sign("RSA-SHA256", Buffer.from(payload), privateKey).toString("base64url")}`;
};
createServer(async (req, res) => {
	const url = new URL(req.url, issuer);
	const json = (data, status = 200) => {
		res.writeHead(status, { "Content-Type": "application/json" });
		res.end(JSON.stringify(data));
	};
	if (url.pathname === "/.well-known/openid-configuration")
		return json({
			issuer,
			authorization_endpoint: issuer + "/authorize",
			token_endpoint: issuer + "/token",
			jwks_uri: issuer + "/jwks",
			userinfo_endpoint: issuer + "/userinfo",
			end_session_endpoint: issuer + "/logout",
			response_types_supported: ["code"],
			subject_types_supported: ["public"],
			id_token_signing_alg_values_supported: ["RS256"],
			token_endpoint_auth_methods_supported: ["client_secret_basic"],
		});
	if (url.pathname === "/jwks") return json({ keys: [jwk] });
	if (url.pathname === "/authorize") {
		const code = randomUUID(),
			redirect = new URL(url.searchParams.get("redirect_uri"));
		codes.set(code, redirect.toString());
		redirect.searchParams.set("code", code);
		redirect.searchParams.set("state", url.searchParams.get("state"));
		res.writeHead(302, { Location: redirect.toString() });
		return res.end();
	}
	if (url.pathname === "/token") {
		let body = "";
		for await (const chunk of req) body += chunk;
		const values = new URLSearchParams(body),
			code = values.get("code");
		if (
			req.headers.authorization !==
				`Basic ${Buffer.from("fixture-client:fixture-secret").toString("base64")}` ||
			!codes.has(code) ||
			codes.get(code) !== values.get("redirect_uri")
		)
			return json({ error: "invalid_grant" }, 400);
		codes.delete(code);
		return json({
			access_token: "fixture-access",
			token_type: "Bearer",
			expires_in: 300,
			id_token: jwt(),
		});
	}
	if (url.pathname === "/userinfo") return json(claims);
	if (url.pathname === "/logout") {
		res.writeHead(302, {
			Location:
				url.searchParams.get("post_logout_redirect_uri") ||
				"http://127.0.0.1:18766/login",
		});
		return res.end();
	}
	json({ error: "not_found" }, 404);
}).listen(18765, "127.0.0.1", () =>
	process.stdout.write("Isolated provider ready on 18765\n"),
);
