# Daily social post automation

Deterministic (no LLM) OpenHands automation that publishes one Skill Forge post
per day to the connected channels (LinkedIn + Pinterest) through the Composio
MCP gateway.

- Schedule: daily at 09:00 Europe/Rome
- Copy rotates through a fixed pool so the feed never sees the same post twice
- State (rotation index, last results) lives in the automation KV store
- Credentials: KV key `composio` holds `{client_id, refresh_token}`; the refresh
  token is written back when it rotates
- Automation id: 31537c81-515c-4e22-b1c7-169fa35f48cc

## Deploy / update

```bash
cd automations/daily-social
python3 -m py_compile main.py
tar -czf /tmp/daily-social.tar.gz main.py
curl -X POST "$OPENHANDS_HOST/api/automation/v1/uploads?name=daily-social" \
  -H "Authorization: Bearer $OPENHANDS_API_KEY" \
  -H "Content-Type: application/gzip" --data-binary @/tmp/daily-social.tar.gz
# then PATCH the automation with the new tarball_path
```

## Test without publishing

```bash
DRY_RUN=1 python3 main.py
```
