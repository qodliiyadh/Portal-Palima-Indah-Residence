const upstream = "https://bimasislam.kemenag.go.id/api/sihat/";
const routes = new Map([
  ["provinsi", []],
  ["kabko", ["prov"]],
  ["jadwal", ["prov", "kabko", "thn", "bln"]],
]);
const id = /^[A-Za-z0-9_+/-]{1,512}={0,2}$/;
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "accept",
  "X-Content-Type-Options": "nosniff",
};
function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { ...headers, "Cache-Control": status === 200 ? "public, max-age=300" : "no-store" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);
  const query = new URL(request.url).searchParams;
  const route = query.get("action") ?? "";
  const keys = routes.get(route);
  if (!keys || query.size !== keys.length + 1 || query.getAll("action").length !== 1) {
    return json({ error: "Invalid action or parameters" }, 400);
  }
  const url = new URL(route, upstream);
  for (const key of keys) {
    const [value, duplicate] = query.getAll(key);
    const pattern = key === "thn" ? /^20\d{2}$/ : key === "bln" ? /^(0[1-9]|1[0-2])$/ : id;
    if (!value || duplicate !== undefined || !pattern.test(value)) {
      return json({ error: "Invalid parameters" }, 400);
    }
    url.searchParams.set(key, value);
  }
  try {
    const result = await fetch(url, {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(10000),
    });
    if (!result.ok) return json({ error: "Kemenag unavailable" }, 502);
    const body = await result.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return json({ error: "Invalid Kemenag response" }, 502);
    }
    return json(body);
  } catch {
    return json({ error: "Kemenag unavailable" }, 502);
  }
});
