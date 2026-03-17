# OpenClaw Integration Testing Guide

## Pre-flight Checklist

- [ ] OpenClaw Gateway running on port 18789
- [ ] Kimi API key configured in Gateway settings
- [ ] Plugin installed in Obsidian vault
- [ ] Plugin enabled in Obsidian Settings → Community Plugins

## Configuration Tests

### 1. Gateway Connection Test

**In Obsidian Settings → OpenCodian → Gateway**:
- Verify Gateway URL is `ws://127.0.0.1:18789`
- Look for status indicator:
  - ✅ Gateway is running = GOOD
  - ❌ Gateway not detected = Check if Gateway is running
  - 🔄 Checking... = Network issue or timeout

### 2. Environment Variables Test

**Settings → Environment → Custom Variables**:
```
ANTHROPIC_API_KEY=sk-...
ANTHROPIC_BASE_URL=https://api.moonshot.ai/anthropic
ANTHROPIC_MODEL=kimi-k2.5
```

**Expected Result**: Model selector should show Kimi models (k1.5, k2.5, etc.)

## Functional Tests

### Test 1: Simple Query

1. Open OpenCodian sidebar (click icon or use hotkey)
2. Type: `Hello! Please introduce yourself.`
3. Send message

**Expected Behavior**:
- Status should show "Waiting for response..."
- Message should stream in gradually
- No errors in console
- Response completes successfully

**Check**: Open browser DevTools (Cmd+Opt+I) and look for:
- `[OpenClawService] Connected to OpenClaw Gateway`
- No WebSocket errors

### Test 2: Tool Call (Read File)

1. Create a test file in your vault: `test.md`
2. Add content: `# Test File\nThis is a test.`
3. Ask: `Please read the contents of test.md and summarize it`

**Expected Behavior**:
- Tool call appears: `Read` with file path
- If permission mode is "Ask", approval prompt appears
- Tool result shows file contents
- Claude summarizes the content

### Test 3: Tool Call (Bash)

Ask: `What is the current working directory?`

**Expected Behavior**:
- Bash tool call: `pwd`
- Approval prompt (if in "Ask" mode)
- Result shows vault path
- Claude explains the result

### Test 4: Streaming Thinking

1. Enable "Extended Thinking" in toolbar
2. Ask: `Explain the architecture of a microservices system`

**Expected Behavior**:
- Thinking block appears (collapsible)
- Thinking content streams in
- Regular response follows thinking

### Test 5: Permission Modes

Test each permission mode:

**Ask Mode**:
- Every tool call should show approval dialog
- Can approve/deny individual calls
- Denied tools should show error in chat

**Auto Mode**:
- All safe tools auto-approved
- No approval dialogs (except dangerous commands)
- Should execute smoothly

**Paranoid Mode**:
- All tools require approval
- Even Read/Grep need confirmation

## Debugging

### Common Issues

#### 1. Gateway Connection Failed

**Symptom**: ❌ Gateway not detected

**Check**:
```bash
# Verify Gateway is running
curl http://127.0.0.1:18789/health  # or equivalent health endpoint

# Check Gateway logs
# (depends on your Gateway implementation)
```

#### 2. No Response / Hanging

**Symptom**: Query sent but no response

**Check browser console for**:
- `[OpenClawService] WebSocket error:`
- Connection timeouts
- Message parsing errors

**Check**:
- Gateway logs for incoming requests
- Kimi API key is valid
- Network connectivity

#### 3. Tool Calls Not Working

**Symptom**: Tools called but no results

**Check**:
- Tool approval callbacks are set up
- Gateway is forwarding tool calls correctly
- Vault path is accessible

#### 4. Models Not Showing

**Symptom**: Model selector empty or showing defaults

**Check**:
- Environment variables are saved
- `ANTHROPIC_MODEL` is set
- Restart Obsidian after changing env vars

### Debug Logging

Enable detailed logging by opening browser console (Cmd+Opt+I):

**Look for these log messages**:
- `[OpenClawService] Connected to OpenClaw Gateway`
- `[OpenClawService] Session initialized: <session-id>`
- `[OpenClawService] Unknown message type: <type>` (indicates unsupported message)

**Gateway messages should include**:
- `agent.query` (outgoing)
- `agent.response` (incoming text)
- `tool.call` (tool use)
- `tool.result` (tool results)
- `agent.thinking` (thinking content)

### Advanced Debugging

**Test WebSocket Connection Directly**:
```javascript
// Run in browser console
const ws = new WebSocket('ws://127.0.0.1:18789');
ws.onopen = () => console.log('Connected!');
ws.onerror = (err) => console.error('Error:', err);
ws.onmessage = (msg) => console.log('Message:', msg.data);

// Send test message
ws.send(JSON.stringify({
  type: 'agent.query',
  payload: {
    prompt: 'Hello',
    model: 'kimi-k2.5',
    sessionId: null
  }
}));
```

**Expected**: Should see connection + response messages

## OpenClaw Gateway Protocol

Expected message types (for reference):

### Outgoing (Plugin → Gateway)
- `agent.query`: Send user prompt
- `agent.cancel`: Cancel ongoing query
- `session.create`: Create new session
- `session.resume`: Resume existing session
- `config.setModel`: Change model
- `config.setPermissionMode`: Change permission mode
- `tool.approve`: Approve/deny tool call

### Incoming (Gateway → Plugin)
- `agent.response`: Text response chunk
- `agent.thinking`: Thinking content
- `tool.call`: Tool use request
- `tool.result`: Tool execution result
- `tool.approval_required`: Request approval for tool
- `session.init`: Session created
- `error`: Error message

## Success Criteria

✅ **Minimal Success**:
- Gateway connection works
- Simple queries get responses
- Text streams correctly
- No console errors

✅ **Full Success**:
- All tool calls work (Read, Write, Bash, etc.)
- Permission modes function correctly
- Thinking mode works
- Sessions persist across restarts
- Multiple conversations work
- No memory leaks or connection issues

## Next Steps After Testing

Once basic functionality works:

1. **Migrate remaining features** (if desired):
   - TitleGenerationService → OpenClaw
   - InstructionRefineService → OpenClaw
   - InlineEditService → OpenClaw

2. **Performance testing**:
   - Large conversations
   - Multiple concurrent queries
   - Long-running sessions

3. **Error handling**:
   - Gateway crashes
   - Network interruptions
   - Invalid responses

4. **Production readiness**:
   - Reconnection logic
   - Better error messages
   - User-facing status indicators
