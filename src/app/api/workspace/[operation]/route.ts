import { backendEnv } from "@/server/env";
import { readSessionUser, sameOrigin } from "@/server/auth";
import {
  hasWorkspaceContent,
  InputError,
  pushWorkspace,
  removeWorkspace,
  workspaceChanges,
} from "@/server/workspace";

const json = (body: unknown, status = 200) =>
  Response.json(body, {
    status,
    headers: { "cache-control": "private, no-store" },
  });
async function handle(
  request: Request,
  context: { params: Promise<{ operation: string }> },
) {
  if (request.method === "POST" && !sameOrigin(request))
    return json({ error: "Cross-origin request refused" }, 403);
  try {
    const env = await backendEnv();
    const user = await readSessionUser(request, env.DB);
    if (!user) return json({ error: "Unauthorized" }, 401);
    const { operation } = await context.params;
    const expected = request.headers.get("x-klipcode-account");
    if (
      (expected && expected !== user.id) ||
      (request.method === "POST" && !expected)
    )
      return json({ error: "Account changed; refresh your session" }, 409);
    if (operation === "has-content" && request.method === "GET")
      return json(await hasWorkspaceContent(env.DB, user.id));
    if (
      request.method !== "POST" ||
      !["changes", "push", "remove"].includes(operation)
    )
      return json({ error: "Not found" }, 404);
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return json({ error: "Expected JSON" }, 415);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Missing body" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4100000) {
        await reader.cancel();
        return json({ error: "Request too large" }, 413);
      }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const c of chunks) {
      bytes.set(c, offset);
      offset += c.length;
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (operation === "changes")
      return json(
        await workspaceChanges(
          env.DB,
          user.id,
          (body as { since?: unknown })?.since,
        ),
      );
    if (operation === "push") await pushWorkspace(env.DB, user.id, body);
    else await removeWorkspace(env.DB, user.id, body);
    return json({ ok: true });
  } catch (error) {
    if (
      error instanceof InputError ||
      (error instanceof Error &&
        error.message.includes("cannot contain cycles"))
    )
      return json({ error: "Invalid workspace change" }, 400);
    return json({ error: "Workspace temporarily unavailable" }, 500);
  }
}
export const GET = handle;
export const POST = handle;
