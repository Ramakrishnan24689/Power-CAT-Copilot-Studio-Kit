<!--
  GitHub Copilot Instruction (Generic) — Power Apps Component Framework + Fluent UI React v9
  Purpose: Provide an end-to-end, repeatable specification so Copilot can reliably scaffold, implement, test, optimize, and package reusable PCF code components using TypeScript + (optionally) React + Fluent UI React v9 without embedding tenant-specific values.
  Keep this file generic. Do not add secrets, org URLs, or environment IDs. Always use placeholders.
-->

# Copilot Instructions — Generic PCF + Fluent UI React v9 Components

## 1. Objective & Scope
Transform user prompts into production-quality Power Apps Component Framework (PCF) controls that are:
manifest-first, type-safe, performant, accessible (WCAG 2.1 AA intent), themable, testable, and easy to deploy (quick push or managed solution packaging). Support field, dataset, and virtualized/compound scenarios. Each response should converge on working code rather than high-level suggestions whenever possible.

## 2. Authoritative References (Always Prefer)
1. Official PCF best practices: https://learn.microsoft.com/power-apps/developer/component-framework/code-components-best-practices
2. Fluent UI React v9 docs: https://react.fluentui.dev/
3. Public sample repository (supplementary only):
  - PowerCAT components: https://github.com/microsoft/powercat-code-components

If a pattern conflicts, prefer (1) > (2) > (3). Summarize the trade-off before diverging.

## 3. Guiding Principles
- Manifest-first: modify `ControlManifest.Input.xml` before implementing code.
- Deterministic outputs: same prompt + repo state => same edits.
- Minimal surface changes: only touch the files required for the task.
- Explicit placeholders: `<YourNamespace>`, `<ControlName>`, `<prefix>`, `<profileName>`, `<PublisherName>`.
- Strong typing: never use `any` if a concrete type is derivable.
- Accessibility by default: roles, labels, keyboard, focus outlines, ARIA attributes.
- Performance: O(1) or O(n) simple transformations; defer heavy operations; lazy-load optional features.
- Security: no secrets, avoid localStorage/sessionStorage for sensitive data, sanitize dynamic HTML.
- Reusability: modular components, theming via Fluent Provider tokens, minimal global leakage.

## 4. Supported Scenarios
- Field controls (single value binding)
- Dataset controls (tabular binding + paging, sorting, filtering)
- Composite/compound controls (multiple bound & input props)
- Event exposing controls (`common-event` + `ExplicitCommonEvents` pattern)
- Themed UI components using Fluent UI v9 primitives (Button, Nav, Tree, Toolbar, etc.)

## 5. Canonical Workflow (High-Level)
1. Clarify: restate user intent; identify manifest changes needed.
2. Manifest update: add/modify properties, datasets, resources, events, version bump.
3. Regenerate types: `npm run refreshTypes` → update imports.
4. Implement/update TypeScript + React components.
5. Add/extend tests & lint fixes.
6. Validate build: `npm run build` (and optional `npm test`).
7. Provide usage + deployment instructions (quick push & solution packaging).

### 5.1 Prerequisites & Quick Start
Prerequisites (install once):
| Tool | Purpose | Min / Notes |
|------|---------|-------------|
| Node.js LTS | Build & scripts | ≥ 18.x (align with Power Apps supported) |
| npm (bundled) | Package manager | Or pnpm/yarn (keep repo consistent) |
| Power Platform CLI (`pac`) | Scaffolding, push, solution | `pac --version` to verify |
| .NET SDK + MSBuild | Solution packaging | Only needed for managed solution build |
| Git | Version control | Optional but expected |
| VS Code (recommended) | Dev environment | Extensions: Power Platform Tools, ESLint |

Environment sanity check:
```powershell
node -v
npm -v
pac --version
```

Create & run (field control example for CardControl):
```powershell
pac pcf init --namespace Contoso --name CardControl --template field --framework react --run-npm-install
cd CardControl
# Edit manifest: set control-type="virtual", add properties, platform libraries
npm run refreshTypes
npm run build
pac pcf push -pp <prefix>
```

Daily Dev Loop:
```powershell
npm run start   # watch build
pac pcf push -pp <prefix>   # in another terminal after changes
```

If using virtual React (preferred) after scaffolding: adjust manifest (`control-type="virtual"`, add platform libraries) then re-run `npm run refreshTypes`.

## 6. Scaffolding (PowerShell Examples)
```
pac pcf init --namespace <YourNamespace> --name <ControlName> --template <field|dataset|standard> --framework react --run-npm-install
```
Virtual React controls (preferred):
- `control` element attribute `control-type="virtual"` in manifest.
- Add `<platform-library name="React" version="<SupportedVersion>" />` and `<platform-library name="Fluent" version="<SupportedVersion>" />` under `<resources>`.
- Do NOT bundle React or Fluent dependencies directly (remove from dependencies if scaffold added them). Rely on platform provided versions; only add types (`@types/react`, etc.) as dev dependencies if needed for compile-time.
- `index.ts` should implement `ReactControl<IInputs, IOutputs>` returning a ReactElement from `updateView` (no manual DOM container management).
```
Add (or ensure) scripts in `package.json` (idempotent):
```
"scripts": {
  "refreshTypes": "pcf-scripts refreshTypes",
  "build": "pcf-scripts build",
  "start": "pcf-scripts start \"watch\"",
  "lint": "eslint . --ext .ts,.tsx",
  "lint:fix": "eslint . --ext .ts,.tsx --fix",
  "test": "jest --passWithNoTests"
}
```

## 7. Manifest Authoring Patterns
- Properties: use `usage="bound"` for data-bound values, `usage="input"` for maker-configurable flags, `usage="output"` only if host must read after `notifyOutputChanged`.
- Datasets: define `data-set` with `property-set` child entries mirroring required columns; include `pfx-default-value` Table(...) for design-time examples only.
- Versioning: increment `<version>` on any behavioral or resource change; follow semantic intent (major for breaking, minor for features, patch for fixes).
- Resources: every compiled JS/CSS asset referenced; do not enumerate `node_modules` directly.
- Localization: supply `display-name-key` and `description-key`; add matching `.resx` entries (see subsection below).
- Events: adopt `common-event` + `ExplicitCommonEvents` when exposing selection, click, or custom actions.
- Reuse: prefer `common-property` definitions when patterns repeat (e.g., `compact`, `theme`, `layoutMode`).

### 7.1 Localization (.resx) Details
Purpose: Link manifest keys (`display-name-key`, `description-key`) to user-facing strings for each locale.

Workflow:
1. Add `<string-resources path="strings/<ControlName>.1033.resx" />` under `<resources>` (1033 = base en-US).
2. For every new property, dataset, event, or control element with `display-name-key` / `description-key`, add corresponding `<data name="Key">` entries to the base `.resx`.
3. Additional locales replicate the file with LCID suffix (e.g., `.1031.resx`) preserving key names exactly.

Key Naming Convention (example):
`<ControlName>_<Area>_<Element>_(Display|Description)`
e.g., `Nav_Items_Display`, `Nav_Items_Description`, `Nav_SelectedKey_Display`, `Nav_SelectedKey_Description`.

Guidelines:
- Human-friendly values; sentence case; descriptions explain purpose & constraints.
- Avoid placeholders like "TBD" in main branch; fill before release.
- Changing a key name requires manifest + resx update and a version bump (minor or major depending on impact).
- Do not embed environment-specific data or secrets.
- Validate presence of all keys in CI (optional future enhancement).

Example fragment:
```xml
<root>
  <data name="Nav_Items_Display" xml:space="preserve"><value>Navigation Items</value></data>
  <data name="Nav_Items_Description" xml:space="preserve"><value>Dataset providing hierarchical navigation items.</value></data>
  <data name="Nav_SelectedKey_Display" xml:space="preserve"><value>Selected Key</value></data>
  <data name="Nav_SelectedKey_Description" xml:space="preserve"><value>Currently selected navigation item unique key.</value></data>
</root>
```

Quality Gate: Reject changes introducing new manifest keys without corresponding base `.resx` entries.

## 8. Type Generation & Imports
After manifest edits: `npm run refreshTypes` then import from `generated/ManifestTypes`. Do NOT manually edit generated files. Avoid stale types by failing fast if a property cannot be found.

## 9. Project Structure (Suggest Minimal Baseline)
```
<ControlName>/
  ControlManifest.Input.xml
  index.ts            (PCF entry – lifecycle adapter)
  src/
    components/       (React presentational components)
    hooks/            (custom hooks, optional)
    utils/            (pure helpers)
  css/
    <ControlName>.css (scoped styles)
  __tests__/          (unit & component tests)
  generated/          (manifest types)
```

### 9.1 Control README Standard
Every control README MUST contain (order recommended):
1. Overview (1–3 sentences) + optional screenshot placeholder `docs/<ControlName>.png`.
2. Features (bullets).
3. Maker Setup (binding steps, property table, event wiring notes).
4. Dataset Schema (table of property-sets) – if dataset control.
5. Properties & Events (concise table; link to manifest for full list).
6. Outputs Contract (bound vs output explanation; sample JSON if used).
7. Accessibility Notes (keyboard, roles, contrast, focus).
8. Quick Start (dev commands: refreshTypes, build, push).
9. Testing (how to run tests; highlight critical cases).
10. Localization (list base key file path; refer to Section 7.1 here).
11. Versioning / Changelog (semantic mapping + link to CHANGELOG.md).
12. Troubleshooting (3–6 most common issues + fixes).
13. Backlog / Enhancements (short prioritized list).
14. License / Support (MIT / Internal Only, etc.).

Fail PR review if a new control lacks this structure.

## 10. PCF Lifecycle Implementation Guidelines (Virtual React Only)
- Manifest `control-type="virtual"`.
- `init(context, notifyOutputChanged, state)`: no container parameter; return value ignored.
- `updateView(context)`: RETURN a `React.ReactElement` representing the control UI (no explicit `ReactDOM.render`).
- `getOutputs()`: same semantics as standard.
- `destroy()`: perform cleanup (subscriptions, timers) — no manual unmount needed; platform manages React tree lifecycle.
- Still use `context.mode.trackContainerResize(true)` if layout depends on container size.

## 11. React & Fluent UI v9 Integration
- Use `@fluentui/react-components` for primitives; import only required symbols.
- Wrap the root with `<FluentProvider theme={...}>` only if custom theme mapping needed; otherwise rely on host theme.
- Memoize heavy subtrees with `React.memo` and stable prop shapes.
- Avoid re-render storms: compute derived data outside JSX; bail early if `updatedProperties` irrelevant.

## 12. Accessibility & ARIA
- Keyboard: Tab sequence stable; arrow/home/end navigation for composite widgets.
- Roles: Choose semantic role first (e.g., `list`, `tree`, `toolbar`) then augment with ARIA only when needed.
- Focus: visible outline on actionable elements; never remove outline without a replacement.
- Announcements: dynamic content updates should use ARIA live regions sparingly.
- Color contrast: rely on Fluent tokens; avoid hard-coded low-contrast colors.

## 13. Performance & Bundle Size
- Target (suggested) < 150 KB gzipped per control (excluding shared runtime).
- Prefer tree-shakable imports; no wildcard `* as Fluent` patterns.
- Defer optional large data transforms until needed (e.g., virtualization for long lists).
- Avoid synchronous loops over full dataset pages when not required (paginate/segment).

## 14. Security & Privacy
- Never embed credentials; use placeholders.
- Validate/sanitize any HTML (prefer text nodes).
- Avoid storing PII in local component state beyond what is rendered.

## 15. State & Data Mapping (Dataset Example)
Map each `recordId` to a view model object. Use stable keys for React `key` props. Prefer pure functions for mapping: `(row) => ({ id: row.getValue('ItemKey'), ... })`.

## 16. Testing Strategy
- Framework: Jest + React Testing Library.
- Minimum tests: render smoke test, property update diff test, event trigger (e.g., selection) test, accessibility role test, dataset mapping test.
- Mock `ComponentFramework.Context` (lightweight harness) for outputs.

### 16.1 Testing Pattern Examples
Lightweight context mock helper (inline or `__tests__/testUtils.ts`):
```ts
import { IInputs, IOutputs } from '../generated/ManifestTypes';

export function makeMockContext(partial: Partial<ComponentFramework.Context<IInputs>>): ComponentFramework.Context<IInputs> {
  return {
    // minimal fields used in tests; expand as needed
    parameters: partial.parameters || ({} as any),
    events: (partial as any).events || {},
    mode: { trackContainerResize: jest.fn() } as any,
  } as ComponentFramework.Context<IInputs>;
}
```

Smoke render test (virtual control):
```ts
import { MyControl } from '../index';

describe('MyControl', () => {
  it('renders without crashing', () => {
    const control = new MyControl();
    const notify = jest.fn();
    const ctx = makeMockContext({ parameters: {} as any });
    control.init(ctx, notify, {} as any);
    const el = control.updateView(ctx);
    expect(el).toBeTruthy();
  });
});
```

Event & output test snippet:
```ts
it('fires OnSelect once and updates output', () => {
  const control = new MyControl();
  const notify = jest.fn();
  const events = { OnSelect: jest.fn() };
  const ctx = makeMockContext({ parameters: { /* ... */ } as any, events });
  control.init(ctx, notify, {} as any);
  // simulate selection: call internal handler via returned element props or expose test hook
  (control as any).handleSelect?.('k1');
  expect(events.OnSelect).toHaveBeenCalledTimes(1);
  expect(notify).toHaveBeenCalledTimes(1);
  expect(control.getOutputs()).toMatchObject({ selectedKey: 'k1' });
});
```

Keyboard focus test (React Testing Library):
```ts
// Render NavView directly – pass synthetic items & simulate keydown
```

Guidelines:
- Avoid deep snapshot tests; prefer behavioral assertions.
- Mock only what you use; missing context parts should fail fast.
- Clean up timers with `afterEach(jest.useRealTimers)` if debouncing.


## 17. Linting & Code Quality
- ESLint + TypeScript rules; fail on unused vars and implicit `any`.
- Add `lint:fix` script; run pre-build or in CI.

## 18. Continuous Integration (Minimal YAML Concept)
Steps: checkout → setup Node LTS → `npm ci` → `npm run lint` → `npm run build` → `npm test` → (optional) artifact upload of solution or build output (not `node_modules`).

## 19. Packaging & Deployment
- Dev quick push (unmanaged):
```
pac auth create -u https://<your-org>.crm.dynamics.com --name <profileName>
pac pcf push -pp <prefix>
```
- Solution packaging (managed/unmanaged):
```
pac solution init --publisher-name <PublisherName> --publisher-prefix <prefix>
pac solution add-reference --path <relative-control-path>
msbuild /t:restore
msbuild /p:Configuration=Release
```
- Validate version increment before packaging.

## 20. Versioning & Upgrade
- Semantic style: major (breaking), minor (non-breaking feature), patch (bug/security fix).
- Document migration notes in README/CHANGELOG for any breaking change to manifest property names or outputs.

## 21. Events & Outputs
### 21.1 Manifest Event Patterns
You can expose maker-wirable events via two mechanisms:
1. `common-event` (reusable across controls) – declare once, reference across multiple controls.
2. Control-specific `<event name="SomeEvent" />` – ad hoc event unique to the control.

Example (generic) manifest fragment for a virtual React control:
```xml
<control ... control-type="virtual">
  <property name="Value" of-type="TwoOptions" usage="bound" />
  <common-event name="OnSelect" />
  <event name="OnToggle" />
  <resources>
    <code path="index.ts" order="1" />
    <platform-library name="React" version="<ReactVersion>" />
    <platform-library name="Fluent" version="<FluentVersion>" />
  </resources>
</control>
```
Guidelines:
- Use `common-event` for semantic actions likely reused (OnSelect, OnItemInvoked, OnRowExpanded).
- Use control-local `<event>` for state-specific variants (OnCheck / OnUncheck) or domain-specific actions not shared elsewhere.
- Keep event names PascalCase and action-oriented.

### 21.2 Runtime Invocation (Virtual React)
Generated types expose strongly-typed `context.events` methods matching manifest declarations.

Sample (generic toggle control) pattern:
```ts
public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
  this.context = context;
  const checked = !!context.parameters.Value.raw;
  const onChange = (newVal: boolean) => {
    if (checked !== newVal) {
      // Fire generic action event
      this.context.events.OnSelect();
      // Fire granular events
      newVal ? this.context.events.OnCheck?.() : this.context.events.OnUncheck?.();
      this.internalChecked = newVal;
      this.notifyOutputChanged();
    }
  };
  return React.createElement(ToggleView, { checked, onChange });
}
```
Notes:
- Optional chaining (`?.`) protects against missing events if reused types are version-skewed.
- Maintain internal state (e.g., `this.internalChecked`) updated immediately so `getOutputs` returns latest value.

### 21.3 Output Strategy
Choose the minimal output contract:
- Single primitive change → separate bound property (`Checked`).
- Multiple correlated values/events → one JSON serialized string property (usage="output").
- High-frequency events (e.g., cursor, drag) – throttle or batch before calling `notifyOutputChanged`.

### 21.4 Debouncing & Idempotency
- Never call `notifyOutputChanged` if no outputs changed (compare previous vs new internal state).
- For rapid toggles, debounce event outputs (e.g., 50–100ms) if host processing is expensive; document this behavior.

### 21.5 Accessibility & Events
- Ensure event firing mirrors actual user intent (keyboard Enter/Space, pointer click) and isn’t fired twice.
- For toggle patterns, update ARIA attributes (e.g., `aria-checked`) in the React component synchronized with internal state.

### 21.6 Testing Events
Unit test expectations:
1. Simulate user action (click / key press) in React view.
2. Assert `context.events.<EventName>` mock called exactly once.
3. Assert `notifyOutputChanged` invoked only after state mutation.
4. Assert `getOutputs()` returns updated bound/output values.

Pseudo Jest test snippet:
```ts
it('fires OnSelect and OnCheck when toggled on', () => {
  const events = { OnSelect: jest.fn(), OnCheck: jest.fn(), OnUncheck: jest.fn() };
  const context = makeMockContext({ Value: false }, events);
  control.init(context, notifyChangedMock, {} as any);
  const el = control.updateView(context);
  // simulate toggle -> call internal handler
  simulateToggle(true, el);
  expect(events.OnSelect).toHaveBeenCalledTimes(1);
  expect(events.OnCheck).toHaveBeenCalledTimes(1);
  expect(events.OnUncheck).not.toHaveBeenCalled();
  expect(notifyChangedMock).toHaveBeenCalledTimes(1);
});
```

### 21.7 Anti-Patterns
- Emitting multiple mutually-exclusive events when one suffices (choose OnToggle with payload vs OnCheck/OnUncheck pair if consumers don’t need granularity).
- Emitting events before validating new state.
- Passing large arbitrary objects in JSON outputs (flatten or only include deltas).
- Using events to transport static configuration (prefer input properties instead).

### 21.8 Migration Tips
If converting a legacy standard control to virtual React, ensure:
- Events re-declared (no auto-conversion) in manifest.
- Internal state naming updated (avoid stale `this._` prefixes) and outputs aligned.
- Tests updated to mock `context.events` instead of legacy patterns.

Summary Rule of Thumb: Event fired → internal state updated → outputs ready → `notifyOutputChanged()` called once.

### 21.9 Decision Matrices
Bound vs Output vs Input:
| Scenario | Use Bound | Use Output | Use Input |
|----------|-----------|------------|-----------|
| Persist maker-selected value | ✔ | – | – |
| Transient interaction (hover, ephemeral selection) | – | ✔ | – |
| Maker configuration toggle | – | – | ✔ |
| Host needs both persistence + event | ✔ + event | (If no persistence) ✔ | Input not suitable |

Dataset vs Multiple Properties:
| Need hierarchical/tabular rows | Dataset |  |  |
| <= 3 flat values only |  | Individual properties |  |
| Need paging/sorting host features | Dataset |  |  |

Event vs Output:
| Requirement | Choose Event | Choose Output |
|-------------|--------------|---------------|
| Maker wires formula/action | ✔ | Possibly (if polling) |
| Host only needs final value | – | ✔ |
| High-frequency updates | Throttle event or avoid | Prefer aggregated output |

JSON Output (single blob) usage:
- Use when multiple correlated fields must atomically update.
- Keep schema stable; version with minor increments; document shape in README.
- Avoid large arrays if dataset already supplies rows.

Idempotency Guard:
- Always compare previous & next internal state before calling `notifyOutputChanged`.


## 22. Error Handling & Diagnostics
- Fail gracefully: guard null/undefined dataset rows.
- Log (optionally) to `console.debug` for dev; strip or gate behind a manifest `debug` flag if persisted.

## 23. Common Pitfalls (Avoid)
- Direct DOM mutations inside React subtree (except refs / focus management).
- Re-rendering full tree on every unrelated context update.
- Leaving React tree mounted after `destroy`.
- Hardcoding colors that break dark mode.
- Ignoring `allocatedWidth/Height` causing overflow.

## 24. Prompt Patterns (For Users Asking Copilot)
- Scaffold new dataset control: "Create a dataset PCF named <Name> with columns A,B,C; include Fluent UI v9 list, selection output." 
- Add property: "Add a TwoOptions input property 'compact' with default false and wire it to shrink padding." 
- Accessibility enhancement: "Add keyboard navigation (Arrow, Home, End) to existing tree component and update tests." 

## 25. Acceptance Checklists
Development Done:
- [ ] Manifest updated & version bumped
- [ ] `npm run refreshTypes` executed
- [ ] Build passes (`npm run build`)
- [ ] Lint clean (`npm run lint`)
- [ ] Tests passing with meaningful coverage
- [ ] Accessibility roles + keyboard verified
- [ ] No large unused dependencies

PR Review:
- [ ] Diff limited to necessary files
- [ ] No secrets / URLs embedded
- [ ] README updated (usage + properties + events)
- [ ] Changelog / release notes (if version change)

Release Packaging:
- [ ] Solution built (managed/unmanaged as required)
- [ ] Version incremented since last release
- [ ] Event & property changes documented
- [ ] Manual smoke test in model-driven + canvas (and portals if applicable)

### 25.1 Troubleshooting
| Symptom | Likely Cause | Resolution |
|---------|--------------|-----------|
| Build fails: missing type for property | Manifest edited but `refreshTypes` not run | Run `npm run refreshTypes` then rebuild |
| React/Fluent duplicated in bundle | Added as dependency instead of relying on platform | Remove runtime deps; keep only `@types/react` dev dep if needed |
| Event not firing | Not declared in manifest or using wrong name | Add `<common-event name=...>` & regenerate types |
| Selection not persisting | Output used where bound property needed | Change `usage` to `bound` & handle `raw` value accordingly |
| Dataset rows undefined | Accessing before page load / paging not loaded | Check `paging.hasNextPage` and null-guard rows |
| No styles applied | CSS not listed in `resources` | Add `<css path="css/<ControlName>.css" order="1" />` |
| Duplicate keys warning | Dataset integrity issue | Ensure source enforces unique key; skip duplicates |
| Large dataset sluggish | No virtualization | Implement virtualization after threshold (Section 30) |

Fast Debug Checklist (copyable):
1. Manifest change? → refreshTypes.
2. Output not updating? → verify `notifyOutputChanged` condition & internal state diff.
3. Styling issue? → confirm CSS resource entry.
4. Event missing? → check `context.events` presence in debugger.
5. Unexpected re-renders? → log `updatedProperties` & bail early.

## 26. Example Minimal Virtual React Control
```ts
import { IInputs, IOutputs } from "./generated/ManifestTypes";
import * as React from 'react';
import { MyControlView } from './src/components/MyControlView';

export class MyControl implements ComponentFramework.ReactControl<IInputs, IOutputs> {
  private context!: ComponentFramework.Context<IInputs>;
  private notifyOutputChanged!: () => void;
  private selectedKey?: string;

  public init(context: ComponentFramework.Context<IInputs>, notifyOutputChanged: () => void, state: ComponentFramework.Dictionary): void {
    this.context = context;
    this.notifyOutputChanged = notifyOutputChanged;
  }

  public updateView(context: ComponentFramework.Context<IInputs>): React.ReactElement {
    this.context = context;
    const props = {/* derive props from context */};
    return React.createElement(MyControlView, props);
  }

  public getOutputs(): IOutputs { return { selectedKey: this.selectedKey }; }
  public destroy(): void { /* cleanup subscriptions if any */ }
}
```

## 27. Fluent UI v9 Usage Notes
- Prefer importing component-level entry points (e.g., `import { Button } from '@fluentui/react-components';`).
- Use tokens over hard-coded CSS where possible.
- For icons, consider `@fluentui/react-icons` (import only used icons).

## 28. Adding Keyboard Navigation (Pattern)
1. Provide a focusable root with `tabIndex={0}` if necessary.
2. Maintain an ordered array of interactive element refs.
3. Handle Arrow/Home/End in `onKeyDown` and call `.focus()` on targets.
4. Prevent default only when overriding native movement.

## 29. Theming
- Default: rely on host (Power Apps) injection; do not force theme unless required.
- If exposing a theme variant property, map to a curated subset (e.g., light | dark | highContrast) and wrap root in `<FluentProvider theme={...}>`.

## 30. Virtualization (If Needed)
- For large datasets, integrate a windowing solution (e.g., `react-window`) gated behind a size threshold; document trade-offs.

## 31. Extensibility Hooks
- Consider exposing callbacks via outputs (JSON) if dynamic behaviors needed; document shape.
- Provide internal utility modules to keep the React view pure.

## 32. Glossary (Quick)
- Bound Property: value connected to data source; host persists changes.
- Input Property: configuration only; not persisted as data.
- Output Property: value host reads after `notifyOutputChanged`.
- Dataset: tabular binding with paging & column metadata.

## 33. Non-Goals
- Server-side data orchestration (beyond dataset consumption)
- Multi-tenant environment provisioning
- Business rule authoring

## 34. When Unsure
Provide 2–3 implementation options with pros/cons, ask the user to choose before proceeding with destructive edits.

## 35. Final Response Template (Internal Guidance)
When completing a task:
1. Brief summary of action(s)
2. Files changed (bullet list)
3. Next optional improvements
4. Commands (optional fenced) for user to replicate key steps

## 36.Do not use Emojis unless explicitly requested.
Do not include emojis in any part of the response or in the code unless the user specifically requests them.

---
End of generic instructions. Apply these rules to every future PCF + Fluent UI request in this repository unless the user explicitly overrides a rule.

## Appendix A: New Control Quick Template

Use this compressed checklist when adding a brand-new virtual React PCF control. It distills the broader guidance above.

0. Scaffold Control (ALWAYS START HERE)
```powershell
pac pcf init --namespace <YourNamespace> --name <ControlName> --template field --framework react --run-npm-install
cd <ControlName>
```

1. Define Intent
- Name / namespace
- Scenario (field | dataset | composite)
- Primary value(s) or dataset shape
- Needed interactions (selection, toggle, invoke)

2. Update Manifest (ControlManifest.Input.xml) - Generated by pac pcf init
- Change `<control control-type="virtual" ...>` (from standard)
- Add Properties (usage: bound | input | output) beyond the default
- (If dataset) add `<data-set>` + required `property-set` columns
- Events: prefer `<common-event name="OnSelect" />` when applicable
- Resources: add platform React + Fluent libraries + CSS to existing `index.ts`
- Localization: add `<string-resources path="strings/<ControlName>.1033.resx" />`

3. Localization File (strings/<ControlName>.1033.resx)
- Add `<data>` entries for control display/description + each property/event
- Human-friendly, sentence case; no placeholders like TODO

4. Regenerate Types (CRITICAL after manifest changes)
`npm run refreshTypes`

5. Implement Entry (index.ts)
- Class implements `ComponentFramework.ReactControl<IInputs, IOutputs>`
- Store `context` & `notifyOutputChanged`
- `updateView` returns React element (no manual render/unmount)
- Compare internal state before calling `notifyOutputChanged`

6. Build React View(s)
- Pure props: no direct context usage inside deep components
- Add accessibility roles & keyboard handling
- Keep styling lean; rely on host theme tokens

7. Outputs & Events Flow
- Update internal state first
- Fire events (`context.events.*`) as needed
- Call `notifyOutputChanged` once if outputs changed

8. Tests (Minimum)
- Smoke render (no crash)
- State change triggers single notify + event
- Keyboard interaction
- Idempotent duplicate action (no extra notify)

9. Quality Gates
- `npm run lint` clean
- `npm run build` success
- All tests pass
- No direct bundling of React/Fluent

10. README (Control Folder)
- Overview, Features
- Properties & Events table
- Outputs contract
- Accessibility notes
- Quick start commands
- Troubleshooting & Backlog

11. Optional Packaging
- `pac pcf push -pp <prefix>` for dev
- Add to solution & build if releasing

12. Post-Add Cleanup
- Remove any temporary scaffolding notes
- Ensure version bumped if committing to main

Copy/Paste Mini Template:
```
Control: <Name>
Namespace: <YourNamespace>
Type: field | dataset | composite
Properties:
  - <PropName> (bound/input/output, type, purpose)
Events:
  - OnSelect (if needed)
Outputs:
  - <OutputName>: <description>
Keyboard:
  - Arrows / Enter / Space / Home / End (as applicable)
Risks:
  - <Performance / Accessibility>
Backlog:
  - <Enhancement 1>
```

Use this appendix instead of keeping separate per-control implementation plan files; fold deltas into each control's README.