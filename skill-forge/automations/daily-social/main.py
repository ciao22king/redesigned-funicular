#!/usr/bin/env python3
"""Daily social publisher for Skill Forge.

Deterministic, no LLM. Each run picks the next piece of copy from a rotating
pool and publishes it to the connected channels via the Composio MCP gateway.
State (rotation index + last results) lives in the automation KV store.

Credentials: the Composio OAuth client_id and refresh_token are read from the
KV key "composio"; a refreshed refresh_token is written back when it rotates.
Set DRY_RUN=1 to render the post without publishing.
"""
import json, os, sys, time, urllib.error, urllib.request, urllib.parse

SITE = "https://skill-forge.ciao22king.workers.dev"
OG_IMAGE = SITE + "/opengraph-image"
MCP_URL = "https://connect.composio.dev/mcp"
TOKEN_EP = "https://login.composio.dev/oauth2/token"

LINKEDIN_AUTHOR = "urn:li:person:U0CikiARb7"
PINTEREST_BOARD = "1125548200563604519"

_KV_TOKEN = os.environ.get("AUTOMATION_KV_TOKEN", "")
_KV_BASE = os.environ.get("AUTOMATION_API_URL", "").rstrip("/")

# Rotating copy: different angle every day so the feed does not see the same
# post on repeat.
POSTS = [
    {
        "text": "Your notes are not a skill yet.\n\n"
                "If you build with AI agents, you know the feeling: you *can* do a task - "
                "the edge cases, the order of operations, the mistakes to avoid - but it "
                "lives in half-finished notes and old chat threads. An agent can't use that.\n\n"
                "Skill Forge turns that raw material into an operational document: when to "
                "use it, prerequisites, a numbered procedure, examples, common mistakes and a "
                "verification checklist. Download it, or publish it to a marketplace.\n\n"
                "Free to try: " + SITE,
        "pin_title": "Skill Forge - turn notes into AI agent skills",
        "pin_desc": "Turn notes, documents or a rough idea into a complete, structured skill for AI agents. Free.",
    },
    {
        "text": "Two ways to create a skill with Skill Forge:\n\n"
                "A) You already have material. Upload up to 20 files - transcripts, notes, "
                "exported PDFs, a rough draft. The model merges everything into one document "
                "and fills the gaps.\n\n"
                "B) You start from an idea. Answer six questions about name, domain, goal, "
                "tone and constraints. The model writes the full procedure from scratch.\n\n"
                "Either way you get a structured, reusable skill. Try it: " + SITE,
        "pin_title": "Two ways to write an AI agent skill",
        "pin_desc": "From existing material or from a single idea - Skill Forge writes the full structured skill.",
    },
    {
        "text": "A prompt is not a skill.\n\n"
                "A skill says when to use it, what to do first, what to do next, which "
                "mistakes are common, and how to verify the result. That structure is what "
                "makes an agent reliable instead of unpredictable.\n\n"
                "Skill Forge writes that structure for you, from whatever notes you already "
                "have. Then you can download it or publish it to the public marketplace.\n\n"
                + SITE,
        "pin_title": "A prompt is not a skill",
        "pin_desc": "Structure is what makes an agent reliable. Skill Forge writes that structure for you.",
    },
    {
        "text": "How Skill Forge is built:\n\n"
                "- Next.js deployed to Cloudflare Workers with OpenNext\n"
                "- D1 (SQLite at the edge) for data\n"
                "- KV for rate limiting\n"
                "- One-click GitHub sign-in to sign the skills you publish\n\n"
                "Small stack, edge-fast, and the uploaded material stays only in the request - "
                "it is not archived.\n\n"
                "Have a look: " + SITE,
        "pin_title": "Skill Forge on Cloudflare Workers",
        "pin_desc": "Next.js + OpenNext on Cloudflare Workers, D1 and KV. Fast at the edge.",
    },
    {
        "text": "What would you turn into a skill first?\n\n"
                "Code review? Incident triage? Writing a release note? Onboarding a new dev? "
                "A recurring report nobody wants to write?\n\n"
                "Skill Forge turns any of those into a complete, reusable skill for your AI "
                "agents - with a numbered procedure and a verification checklist.\n\n"
                "Free to try: " + SITE,
        "pin_title": "What would you turn into a skill?",
        "pin_desc": "Code review, incident triage, release notes - turn any recurring task into a reusable AI skill.",
    },
    {
        "text": "The marketplace is the part I like most.\n\n"
                "Every skill you publish on Skill Forge gets its own page, so a good prompt "
                "stops being a throwaway and becomes a reusable building block. Skills are "
                "signed with your GitHub identity, so authorship is visible.\n\n"
                "Write one, publish it, and let someone else start from it.\n\n"
                + SITE,
        "pin_title": "Publish your AI skills to a marketplace",
        "pin_desc": "Give every skill a page, signed with your GitHub identity. Reusable, not throwaway.",
    },
]


def kv_available():
    return bool(_KV_TOKEN and _KV_BASE)


def kv_get(key):
    req = urllib.request.Request(f"{_KV_BASE}/v1/kv/{key}",
                                 headers={"Authorization": f"Bearer {_KV_TOKEN}"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read())["value"]
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def kv_set(key, value):
    req = urllib.request.Request(f"{_KV_BASE}/v1/kv/{key}", data=json.dumps(value).encode(),
                                 headers={"Authorization": f"Bearer {_KV_TOKEN}",
                                          "Content-Type": "application/json"}, method="PUT")
    with urllib.request.urlopen(req, timeout=30) as r:
        r.read()


def fire_callback(status="COMPLETED", error=None):
    url = os.environ.get("AUTOMATION_CALLBACK_URL", "")
    if not url:
        return
    body = {"status": status, "run_id": os.environ.get("AUTOMATION_RUN_ID", "")}
    if error:
        body["error"] = error
    req = urllib.request.Request(url, data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": f"Bearer {os.environ.get('AUTOMATION_CALLBACK_API_KEY', '')}"})
    try:
        urllib.request.urlopen(req, timeout=30)
    except Exception as e:
        print(f"Callback error (non-fatal): {e}")


def refresh_token(creds):
    body = urllib.parse.urlencode({"grant_type": "refresh_token",
                                   "refresh_token": creds["refresh_token"],
                                   "client_id": creds["client_id"]}).encode()
    req = urllib.request.Request(TOKEN_EP, data=body,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"}, method="POST")
    with urllib.request.urlopen(req, timeout=30) as r:
        tok = json.load(r)
    if tok.get("refresh_token"):
        creds["refresh_token"] = tok["refresh_token"]
        if kv_available():
            kv_set("composio", creds)
    return tok["access_token"]


class MCP:
    def __init__(self, token):
        self.token = token
        self.sid = None
        self._post({"jsonrpc": "2.0", "id": 1, "method": "initialize",
                    "params": {"protocolVersion": "2025-06-18", "capabilities": {},
                               "clientInfo": {"name": "daily-social", "version": "1"}}})
        self._post({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}, notify=True)

    def _post(self, body, notify=False, timeout=300):
        h = {"Content-Type": "application/json",
             "Accept": "application/json, text/event-stream",
             "Authorization": "Bearer " + self.token}
        if self.sid:
            h["Mcp-Session-Id"] = self.sid
        req = urllib.request.Request(MCP_URL, data=json.dumps(body).encode(), headers=h, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            self.sid = r.headers.get("Mcp-Session-Id") or self.sid
            raw = r.read().decode()
        if notify:
            return None
        for line in raw.splitlines():
            if line.startswith("data: "):
                return json.loads(line[6:])
        return json.loads(raw)

    def call(self, name, args):
        d = self._post({"jsonrpc": "2.0", "id": 9, "method": "tools/call",
                        "params": {"name": name, "arguments": args}})
        for c in d.get("result", {}).get("content", []):
            if c.get("type") == "text":
                try:
                    return json.loads(c["text"])
                except Exception:
                    return {"text": c["text"]}
        return d.get("result", {})


def publish_linkedin(mcp, text):
    r = mcp.call("COMPOSIO_MULTI_EXECUTE_TOOL", {"tools": [
        {"tool_slug": "LINKEDIN_CREATE_LINKED_IN_POST", "account": "linkedin_wearer-delhi",
         "arguments": {"author": LINKEDIN_AUTHOR, "commentary": text,
                       "visibility": "PUBLIC", "lifecycleState": "PUBLISHED"}}],
        "sync_response_to_workbench": False, "thought": "daily Skill Forge post",
        "current_step": "PUBLISH"})
    res = r.get("data", {}).get("results", [{}])[0].get("response", {})
    return res.get("successful"), json.dumps(res)[:300]


def publish_pinterest(mcp, title, desc):
    r = mcp.call("COMPOSIO_MULTI_EXECUTE_TOOL", {"tools": [
        {"tool_slug": "PINTEREST_CREATE_PIN", "account": "pinterest_labor-arrie",
         "arguments": {"board_id": PINTEREST_BOARD, "title": title[:100], "description": desc[:800],
                       "link": SITE, "alt_text": title[:500],
                       "media_source": {"source_type": "image_url", "url": OG_IMAGE}}}],
        "sync_response_to_workbench": False, "thought": "daily Skill Forge pin",
        "current_step": "PUBLISH"})
    res = r.get("data", {}).get("results", [{}])[0].get("response", {})
    return res.get("successful"), json.dumps(res)[:300]


def main():
    dry = os.environ.get("DRY_RUN") == "1"
    idx = (kv_get("rotation") or 0) if kv_available() else 0
    post = POSTS[idx % len(POSTS)]
    print(f"rotation index {idx} -> post {idx % len(POSTS)}")
    print("--- LinkedIn ---\n" + post["text"][:200] + "...")

    if dry:
        print("DRY_RUN: not publishing")
        fire_callback("COMPLETED")
        return 0

    creds = kv_get("composio") if kv_available() else None
    if not creds:
        raise RuntimeError("missing Composio credentials in KV key 'composio'")

    token = refresh_token(creds)
    mcp = MCP(token)

    results = {}
    try:
        ok, info = publish_linkedin(mcp, post["text"])
        results["linkedin"] = {"ok": ok, "info": info}
        print("linkedin:", ok, info)
    except Exception as e:
        results["linkedin"] = {"ok": False, "info": f"{type(e).__name__}: {e}"}
        print("linkedin ERROR:", e)

    try:
        ok, info = publish_pinterest(mcp, post["pin_title"], post["pin_desc"])
        results["pinterest"] = {"ok": ok, "info": info}
        print("pinterest:", ok, info)
    except Exception as e:
        results["pinterest"] = {"ok": False, "info": f"{type(e).__name__}: {e}"}
        print("pinterest ERROR:", e)

    if kv_available():
        kv_set("rotation", idx + 1)
        kv_set("last_run", {"at": int(time.time()), "results": results})
    print("done:", json.dumps(results)[:400])
    fire_callback("COMPLETED")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as e:
        print(f"FATAL: {e}", file=sys.stderr)
        fire_callback("FAILED", str(e))
        sys.exit(1)
