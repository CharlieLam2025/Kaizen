const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

function normalizeCode(raw) {
  const text = String(raw || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/^Kaizen-?/i, "");
  if (!/^[A-HJ-NP-Z2-9]{4}$/i.test(text)) return "";
  return `Kaizen-${text.toUpperCase()}`;
}

function makeCode() {
  let out = "Kaizen-";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  for (const b of bytes) out += CODE_CHARS[b % CODE_CHARS.length];
  return out;
}

function cleanVideos(list) {
  return (Array.isArray(list) ? list : [])
    .filter((v) => v && v.videoId)
    .slice(0, 200)
    .map((v) => ({
      videoId: String(v.videoId).slice(0, 40),
      title: String(v.title || v.videoId).replace(/\s+/g, " ").trim().slice(0, 120),
      lastSeconds: Math.max(0, Math.min(86400, Math.floor(Number(v.lastSeconds) || 0))),
      updatedAt: Number(v.updatedAt) || 0,
    }));
}

function publicGroup(row) {
  const members = Object.values(row.members || {})
    .map((m) => ({
      clientId: m.clientId,
      name: m.name,
      task: m.task || "",
      updatedAt: m.updatedAt || 0,
      videos: m.videos || [],
    }))
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return {
    code: row.code,
    task: row.task || "",
    updatedAt: row.updatedAt || 0,
    members,
  };
}

async function readGroup(env, code) {
  const raw = await env.GROUPS.get(`g:${code}`);
  return raw ? JSON.parse(raw) : null;
}

async function writeGroup(env, row) {
  await env.GROUPS.put(`g:${row.code}`, JSON.stringify(row));
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (!env.GROUPS) return json({ error: "小组存储还没接上" }, 500);

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    try {
      if (request.method === "POST" && path === "/v1/groups") {
        const body = await request.json().catch(() => ({}));
        let code = "";
        for (let i = 0; i < 8; i += 1) {
          const next = makeCode();
          if (!(await env.GROUPS.get(`g:${next}`))) {
            code = next;
            break;
          }
        }
        if (!code) return json({ error: "口令用完了，稍后再试。" }, 503);
        const row = {
          code,
          task: String(body.task || "").slice(0, 200),
          createdAt: Date.now(),
          updatedAt: Date.now(),
          members: {},
        };
        await writeGroup(env, row);
        return json({ group: publicGroup(row) });
      }

      const found = path.match(/^\/v1\/groups\/([^/]+)(?:\/me)?$/);
      if (!found) return json({ error: "没有这条路。" }, 404);
      const code = normalizeCode(decodeURIComponent(found[1]));
      if (!code) return json({ error: "口令不对。" }, 400);
      const row = await readGroup(env, code);
      if (!row) return json({ error: "没有这个小组。" }, 404);

      if (request.method === "GET" && path === `/v1/groups/${found[1]}`) {
        return json({ group: publicGroup(row) });
      }

      if (path !== `/v1/groups/${found[1]}/me`) return json({ error: "没有这条路。" }, 404);

      const body = await request.json().catch(() => ({}));
      const clientId = String(body.clientId || "").slice(0, 80);
      if (!clientId) return json({ error: "缺了身份。" }, 400);

      if (request.method === "DELETE") {
        delete row.members[clientId];
        row.updatedAt = Date.now();
        await writeGroup(env, row);
        return json({ ok: true });
      }

      if (request.method !== "PUT") return json({ error: "方法不对。" }, 405);
      if (Object.keys(row.members).length >= 12 && !row.members[clientId]) {
        return json({ error: "这个小组满了。" }, 409);
      }

      row.members[clientId] = {
        clientId,
        name: String(body.name || "搭子").slice(0, 40),
        task: String(body.task || row.task || "").slice(0, 200),
        videos: cleanVideos(body.videos),
        updatedAt: Date.now(),
      };
      if (body.task) row.task = String(body.task).slice(0, 200);
      row.updatedAt = Date.now();
      await writeGroup(env, row);
      return json({ group: publicGroup(row) });
    } catch (error) {
      return json({ error: error.message || "小组同步失败。" }, 500);
    }
  },
};
