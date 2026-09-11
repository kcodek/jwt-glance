# JWT Glance: Engineering Specification & Implementation Plan (V1 to V3)

---

## 1. Core Architectural Strategy & Invariants

```
                             JWT GLANCE CORE
            ┌───────────────────────────────────────────────┐
            │ Pure TypeScript • Zero External Dependencies  │
            │  detect.ts  •  parse.ts  •  temporal.ts       │
            └───────────────────────┬───────────────────────┘
                                    │
                         TokenAssessment (Union)
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
   VS Code Human UI        VS Code Agent Tool             Local MCP Server
    (Inlay + Hover)        (vscode.lm.registerTool)       (@jwt-glance/mcp)
   Zero Ext Runtime Deps   Zero Ext Runtime Deps       Official SDK (stdio only)
   Direct Range Render     Context-Isolated (URI/Pos)  Zero Network at Runtime

```

### 1.1 Non-Negotiable Invariants

1. **The Credential Isolation Invariant:** Raw tokens must remain as close to the local deterministic engine as possible. Neither human UI logs nor AI agent model contexts should ingest raw credential strings. Consumers receive structured, sanitized assessments.
2. **Zero-Runtime-Dependency Core:** Both `src/core/` and the main VS Code extension package maintain strictly `"dependencies": {}`.
3. **Deterministic Hexagonal Core:** `src/core/` contains zero imports from `vscode`, `node:fs`, or external runtimes. Every engine evaluation accepts `(candidate: string, referenceEpochSeconds: number)` to enable deterministic testing, agent replays, and zero clock drift.
4. **Strict Trust Semantics:** An unverified token is never labeled "Valid." Temporal states distinguish active time bounds from cryptographic authenticity.

---

## 2. Universal Data Contract (`src/core/types.ts`)

```typescript
export type TemporalStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'NOT_YET_ACTIVE'
  | 'NO_EXPIRATION'
  | 'INDETERMINATE';

export type TemporalWarning =
  | 'MALFORMED_EXP'
  | 'MALFORMED_NBF'
  | 'MALFORMED_IAT'
  | 'IAT_IN_FUTURE'
  | 'NBF_AFTER_EXP';

export type VerificationStatus =
  | 'NOT_PERFORMED'
  | 'VERIFIED'
  | 'FAILED';

export interface UnrecognizedToken {
  recognized: false;
  reason: 'INVALID_SEGMENT_COUNT' | 'NOT_THREE_SEGMENTS' | 'MALFORMED_HEADER' | 'MALFORMED_PAYLOAD';
}

export interface RecognizedToken {
  recognized: true;
  algorithm: string;
  isUnsecured: boolean; // true if alg === 'none'
  temporalStatus: TemporalStatus;
  expiresAtIso: string | null;
  secondsUntilExpiration: number | null; // positive = future, 0 = now, negative = past, null = none/indeterminate
  issuedAtIso: string | null;
  notBeforeIso: string | null;
  issuer: string | null;
  audience: string | string[] | null;
  subject: string | null;
  roles: string[];
  warnings: TemporalWarning[];
  verification: {
    status: VerificationStatus;
  };
}

export type TokenAssessment = UnrecognizedToken | RecognizedToken;

```

---

## 3. Phase-Wise Implementation Roadmap

```
┌─────────────────────────────────────────────────────────────┐
│ PHASE 1: Human Ambient Core (V1)                            │
│ Inlay hints before token, hover card, live refresh timer    │
│ Target: 20-24 Hours                                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 2: Two-Week Dogfooding & Micro-Fixes (V1.1)           │
│ Daily use across .env, .http, shell, configs                │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 3: Context-Preserving Agent Tool (V2)                 │
│ VS Code Language Model Tools API (inspect by URI/Location)   │
│ Engine bump: vscode >= 1.95                                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 4: Scoped File & Workspace Auditing (V2.1 - V2.2)     │
│ Diagnostic tools: inspectCredentialsInFile, auditFiles      │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│ PHASE 5: Standalone Local MCP Server (V3)                   │
│ Package: @jwt-glance/mcp (stdio JSON-RPC via official SDK)  │
└─────────────────────────────────────────────────────────────┘

```

---

## 4. Detailed Implementation Tasks (Phases 1 through 5)

### Phase 1: Human Ambient Core (V1)

*Focus: Read-only, host-driven lazy execution, zero runtime dependencies.*

#### 1.1 Project Structure & Build Configuration

* Initialize monorepo structure separating core logic from adapters:
```text
jwt-glance/
├── src/
│   ├── core/           # Pure, zero-dep parsing & assessment
│   │   ├── detect.ts
│   │   ├── parse.ts
│   │   ├── temporal.ts
│   │   ├── sanitize.ts
│   │   └── types.ts
│   └── vscode/         # VS Code presentation adapters
│       ├── inlayHints.ts
│       ├── hover.ts
│       ├── lineExpander.ts
│       └── extension.ts
├── test/
│   ├── unit/           # node:test unit suites
│   ├── integration/    # @vscode/test-electron smoke tests
│   └── corpus/         # 12,000-sample adversarial regression suite
├── package.json
├── tsconfig.json
└── esbuild.js

```


* Configure `package.json`:
* `"dependencies": {}` (enforce strict empty object).
* `"engines": { "vscode": "^1.85.0" }`.
* `"activationEvents": ["onStartupFinished"]`.


* Configure `esbuild.js` for CommonJS bundling, minification, and source map output.

#### 1.2 Pure Core Engine

* Implement `src/core/detect.ts`:
* Stage 1: Segment-based boundary check (supports both 2-segment signature-omitted tokens and 3-segment tokens with empty third segment for `alg: none`).
* Enforce maximum length sanity threshold (8 KB) to discard non-credential blobs.


* Implement `src/core/parse.ts`:
* Native base64url decoding via `Buffer.from(part, 'base64url')`.
* Safe JSON parsing for header and payload. Supports both 2-segment (`header.payload`) and 3-segment (`header.payload.signature`) tokens. Return `UnrecognizedToken` with descriptive reason if invalid.


* Implement `src/core/temporal.ts`:
* Strict `NumericDate` validation: Must be finite numbers. Strings, objects, arrays, and non-finite numbers trigger `INDETERMINATE` temporal status with `MALFORMED_*` warnings.
* Compute `secondsUntilExpiration` relative to the injected epoch argument.
* Evaluate warnings: `IAT_IN_FUTURE`, `NBF_AFTER_EXP`.


* Implement `src/core/sanitize.ts`:
* Markdown escaping for all claim strings rendered to hover cards. Ensure `MarkdownString.isTrusted = false`.



#### 1.3 VS Code Presentation Adapters

* Implement `src/vscode/lineExpander.ts`:
* Expand host-supplied `vscode.Range` to the first character of the start line and last character of the end line, avoiding token truncation at viewport boundaries.


* Implement `src/vscode/inlayHints.ts`:
* Attach hint immediately **before** the start position of the matched token.
* Default inline label format: `[JWT · <subject> · <status>]` (e.g. `[JWT · user-42 · Active 42m]`, `[JWT · Expired 8m]`, or `[JWT · UNSECURED alg:none · local-dev-user · Active 42m]`).
* Surfaces `sub` to enable instant credential identification while keeping full claim payloads in hover cards and the click action palette.


* Implement `src/vscode/hover.ts`:
* Format sanitized claim table, verification state notice (`Signature: Not performed`), and beautified JSON blocks.


* Implement 60-Second Invalidation Loop:
* Global timer triggering `onDidChangeInlayHints` once per minute to refresh relative times without document edits.



#### 1.4 Test & Packaging Gate

* Unit Tests: 100% coverage across valid tokens, `alg: none`, malformed claims, and boundary timestamps.
* Adversarial Suite: Run 12,000 regression strings (UUIDs, semantic versions, URLs, dot-notated environment keys) ensuring zero false positives.
* Integration Tests (`@vscode/test-electron`): Verify hint positioning, hover generation, and configuration updates.
* Bundle single `.vsix` artifact and install locally in VS Code and Cursor.

---

### Phase 2: Two-Week Dogfooding & Refinement (V1.1)

*Focus: Real-world operational validation without scope bloat.*

* Deploy the V1 `.vsix` exclusively on personal development workstations.
* Monitor everyday workflows across `.env`, `.http`, `.rest`, `.yml`, shell scripts, and raw code files.
* **Stop Criteria Check:**
* If ambient awareness proves unhelpful or annoying, pause the project.
* If it reliably eliminates context switches without editor latency or CPU spikes, proceed to public V1 release on Visual Studio Marketplace and Open VSX.


* Polish display edge cases discovered during real-world use:
* Add configuration: `jwtGlance.inlineClaims` (default: `[]`).
* Add configuration: `jwtGlance.minLineLength` / `jwtGlance.maxLineLength`.



---

### Phase 3: Context-Preserving Agent Tool (V2)

*Focus: Expose credential intelligence to VS Code Language Model Agents without leaking raw tokens into model context.*

#### 3.1 Platform Engine Upgrade

* Update `package.json`:
* `"engines": { "vscode": "^1.95.0" }` (required for finalized Language Model Tools API).


* Declare tool contribution in `package.json`:
```json
"contributes": {
  "languageModelTools": [
    {
      "name": "jwtGlance_inspectCredentialAtLocation",
      "displayName": "Inspect Credential at Location",
      "modelDescription": "Inspects a JWT credential located in a workspace file by position or variable name, returning temporal status, algorithm, and claims. Call this tool to diagnose authentication/authorization failures or check for expired test credentials without reading raw secret strings into context.",
      "inputSchema": {
        "type": "object",
        "properties": {
          "uri": {
            "type": "string",
            "description": "The file URI (e.g. file:///workspace/.env.test)"
          },
          "line": {
            "type": "integer",
            "description": "Zero-based line number containing the token"
          },
          "character": {
            "type": "integer",
            "description": "Optional zero-based character offset on the line"
          },
          "variable": {
            "type": "string",
            "description": "Optional variable name to locate on the line (e.g. AUTH_TOKEN)"
          }
        },
        "required": ["uri", "line"]
      }
    }
  ]
}

```



#### 3.2 Tool Implementation (`src/agent/inspectAtLocation.ts`)

* Implement tool handler using `vscode.lm.registerTool`:
1. Resolve `vscode.Uri.parse(input.uri)`.
2. Open or reference the active `vscode.TextDocument`.
3. Extract line content locally; isolate token via boundary regex.
4. Pass raw token directly to `assessToken(rawToken, nowEpoch)`.
5. Return serialized `TokenAssessment` JSON.
6. **Security verification:** Assert the raw token string is never written into the returned `LanguageModelToolResult`.



---

### Phase 4: Scoped File & Workspace Auditing (V2.1 - V2.2)

*Focus: Enable multi-token diagnosis with strict scope boundaries.*

#### 4.1 Single-File Inspection Tool (`jwtGlance_inspectCredentialsInFile`)

* Add tool accepting `{ uri: string }`.
* Read document line by line; locate all candidate tokens.
* Return a compressed manifest:
```json
[
  {
    "line": 14,
    "variable": "SERVICE_ACCOUNT_TOKEN",
    "algorithm": "RS256",
    "temporalStatus": "EXPIRED",
    "secondsUntilExpiration": -86400,
    "subject": "service-worker-01"
  }
]

```



#### 4.2 Workspace Scoped Audit Tool (`jwtGlance_auditCredentialFiles`)

* Enforce explicit glob allowlists to prevent unbounded scanning of sensitive directories:
* Default allowed globs: `["**/.env.test", "**/*.http", "**/*.rest", "**/test/fixtures/**"]`.
* Hardcoded deny: `["**/node_modules/**", "**/.git/**", "**/dist/**", "**/build/**"]`.


* Output structured summary reports to enable agents to identify expired fixtures across test suites in a single invocation.

---

### Phase 5: Standalone Local MCP Server (V3)

*Focus: Make the engine available to external CLI agents (Claude Code, terminal runners, CI) via Model Context Protocol.*

#### 5.1 Package Architecture

* Create standalone package `packages/mcp-server` published as `@jwt-glance/mcp`.
* Add dependency: `@modelcontextprotocol/sdk` (official SDK).
* Enforce runtime policy: Standalone CLI communicates strictly over `stdio` using JSON-RPC. Zero outbound network calls during runtime execution.

#### 5.2 Tool Exposure

* Expose tools mirroring the core engine capabilities:
1. `jwt_inspect_at_path`: Resolves local file paths, extracts the token, and returns `TokenAssessment` without piping the raw token over remote sockets.
2. `jwt_inspect_string`: Secondary fallback for user-pasted input strings.
3. `jwt_audit_file`: Returns structured assessments for all tokens detected within a target test file.


* Package distribution:
```bash
npm install -g @jwt-glance/mcp
# Configured in Claude Code / MCP client as:
# { "command": "jwt-glance-mcp" }

```



---

## 5. TODO & Master Task Checklist

### Sprint 1: Core Engine & Testing (V1) — COMPLETE
* [x] Initialize repository with strict TypeScript (`strict: true`, `noUncheckedIndexedAccess: true`).
* [x] Set up empty `"dependencies": {}` and verify esbuild single-file packaging.
* [x] Implement `src/core/types.ts` with the discriminated union `TokenAssessment`.
* [x] Implement `src/core/detect.ts` with two-stage syntax boundaries and length caps.
* [x] Implement `src/core/parse.ts` with native base64url decoding and JSON validation.
* [x] Implement `src/core/temporal.ts` with strict `NumericDate` checks, warning detections, and `INDETERMINATE` status.
* [x] Implement `src/core/sanitize.ts` with complete Markdown escaping.
* [x] Author unit test suite (`node:test`) covering RFC samples, edge cases, and injection payloads.

### Sprint 2: VS Code Presentation Layer (V1) — COMPLETE
* [x] Implement `src/vscode/lineExpander.ts` for boundary safety.
* [x] Implement `src/vscode/inlayHints.ts` rendering badges before tokens with PII-free defaults.
* [x] Implement `src/vscode/hover.ts` rendering sanitized claim tables with `Signature: Not performed`.
* [x] Implement 60-second periodic invalidation timer tied to `onDidChangeInlayHints`.
* [x] Build adversarial corpus runner (12,000 test cases) verifying zero false positives.
* [ ] Build `@vscode/test-electron` smoke test suite (8 integration scenarios).
* [x] Package local `.vsix` (`jwt-glance-0.1.0.vsix`) and complete dual verification in VS Code and Cursor.

### Sprint 3: Dogfooding & Production Launch (V1.1) — PENDING

* [ ] Run personal 2-week dogfood trial on daily development machines.
* [ ] Confirm low idle CPU load and imperceptible typing latency.
* [ ] Publish V1 to Visual Studio Marketplace and Open VSX Registry.

### Sprint 4: VS Code Language Model Tools (V2)

* [ ] Bump engine dependency in `package.json` to `"vscode": "^1.95.0"`.
* [ ] Define `jwtGlance_inspectCredentialAtLocation` contribution schema in manifest.
* [ ] Implement tool handler using `vscode.lm.registerTool`, isolating raw tokens from agent context.
* [ ] Write integration test verifying tool execution against mock workspace files.

### Sprint 5: Multi-Token Diagnostics & Workspace Auditing (V2.1 - V2.2)

* [ ] Implement `jwtGlance_inspectCredentialsInFile` returning line-indexed metadata manifests.
* [ ] Implement `jwtGlance_auditCredentialFiles` with hardcoded directory exclusions and strict globs.
* [ ] Validate end-to-end agent workflow resolving mock 401 integration test failures.

### Sprint 6: Standalone MCP Server (V3)

* [ ] Scaffold `packages/mcp-server` targeting Node.js execution.
* [ ] Integrate `@modelcontextprotocol/sdk` over standard input/output (`stdio`).
* [ ] Implement `jwt_inspect_at_path` and `jwt_audit_file` handlers.
* [ ] Verify local integration with Claude Code and external MCP hosts.