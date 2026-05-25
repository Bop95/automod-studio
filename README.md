# AutoMod Studio

<p align="center">
  <img alt="AutoMod Studio banner" src="https://capsule-render.vercel.app/api?type=waving&height=190&color=0:FF4500,100:172033&text=AutoMod%20Studio&fontColor=ffffff&fontAlignY=38&desc=Visual%20workspace%20for%20Reddit%20AutoModerator&descAlignY=58&descAlign=50" />
</p>

<p align="center">
  <strong>A native Devvit workspace for building, testing, versioning, and deploying Reddit AutoModerator rules.</strong>
</p>

<p align="center">
  <a href="https://developers.reddit.com/"><img alt="Devvit" src="https://img.shields.io/badge/Devvit-0.12.24-FF4500?style=for-the-badge&logo=reddit&logoColor=white"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-6.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white"></a>
  <a href="https://www.npmjs.com/package/js-yaml"><img alt="js-yaml" src="https://img.shields.io/badge/js--yaml-4.1.1-CB3837?style=for-the-badge&logo=npm&logoColor=white"></a>
  <img alt="HTML5" src="https://img.shields.io/badge/HTML5-Webview-E34F26?style=for-the-badge&logo=html5&logoColor=white">
  <img alt="CSS3" src="https://img.shields.io/badge/CSS3-Design%20System-1572B6?style=for-the-badge&logo=css3&logoColor=white">
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/license-BSD--3--Clause-172033?style=flat-square">
  <img alt="Platform" src="https://img.shields.io/badge/platform-Reddit%20Developer%20Platform-FF4500?style=flat-square">
  <img alt="Status" src="https://img.shields.io/badge/status-hackathon%20ready-16A34A?style=flat-square">
</p>

<p align="center">
  <a href="./TERMS.md">Terms</a>
  &nbsp; | &nbsp;
  <a href="./PRIVACY.md">Privacy</a>
  &nbsp; | &nbsp;
  <a href="https://developers.reddit.com/docs/">Docs</a>
  &nbsp; | &nbsp;
  <a href="https://www.reddit.com/r/Devvit/">r/Devvit</a>
</p>

---

## Overview

AutoMod Studio turns Reddit AutoModerator from a raw YAML editing workflow into a visual, moderator-friendly control room. It reads `r/subreddit/wiki/config/automoderator`, parses the configuration into editable rule cards, lets moderators test rules against sample content, and writes validated YAML back to Reddit through Devvit.

The goal is simple: make powerful moderation automation safer, easier to review, and accessible to non-technical mod teams without moving sensitive workflow data outside Reddit.

## Why It Matters

Moderators often maintain AutoModerator by editing large YAML files directly. A small indentation mistake, malformed regex, or broad rule can break moderation for an entire community. AutoMod Studio adds a structured interface around that workflow:

| Problem | AutoMod Studio Response |
| --- | --- |
| Raw YAML is easy to break | Rules are edited through guided fields and YAML previews |
| Testing changes is manual | Simulator shows which rules would match sample content |
| Config history is hard to compare | Local snapshots and Reddit wiki revisions are shown in one timeline |
| Non-technical mods are blocked | Templates and rule cards make common policies approachable |
| Deploying is risky | Save flow warns that the full AutoModerator wiki page will be replaced |

## Product Surface

- **Templates** - starter rules for spam, new accounts, civility, link farming, flair, and title quality.
- **My Rules** - table view of the current AutoModerator config with readiness indicators.
- **Rule Builder** - guided editor for actions, metadata, author limits, body/title checks, URL checks, flair checks, and YAML preview.
- **Simulator** - approximate local matching against sample title, body, URL, and content type.
- **Version History** - combines local snapshots with Reddit wiki revisions for restore and revert workflows.
- **Settings** - workspace display controls and deployment context.

## Architecture

```mermaid
flowchart LR
  A[Reddit Wiki<br/>config/automoderator] -->|getWikiPage| B[YAML Parser<br/>js-yaml]
  B --> C[Structured Rule JSON]
  C --> D[Devvit Webview<br/>Visual Editor]
  D --> E[Simulator<br/>Local Match Engine]
  D --> F[Draft + Local Snapshots<br/>Browser Storage]
  D -->|SAVE| G[YAML Serializer]
  G -->|updateWikiPage| A
  A -->|Wiki Revisions API| H[Version History]
  H --> D
```

## Data Flow

```mermaid
sequenceDiagram
  participant Mod as Moderator
  participant UI as AutoMod Studio Webview
  participant App as Devvit App
  participant Wiki as Reddit Wiki

  Mod->>UI: Open editor
  UI->>App: GET_RULES
  App->>Wiki: Read config/automoderator
  Wiki-->>App: Raw YAML
  App-->>UI: Parsed rules + warnings
  Mod->>UI: Edit and test rules
  UI->>UI: Validate broad or duplicate rules
  Mod->>UI: Save rule
  UI->>App: SAVE rules
  App->>Wiki: Replace AutoModerator config
  Wiki-->>App: Save result
  App-->>UI: Success or error
```

## Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| Reddit platform | Devvit `0.12.24` | Custom post, menu item, Reddit API access |
| App runtime | TypeScript | Devvit handlers, parser, serializer |
| UI | HTML, CSS, vanilla JavaScript | CSP-friendly embedded webview |
| YAML bridge | `js-yaml` | Parse and serialize AutoModerator documents |
| State | Webview state + localStorage | Draft recovery and local snapshot history |
| Reddit source of truth | Wiki API | Read, update, inspect, and revert `config/automoderator` |

## Repository Layout

```text
automod-studio/
├── devvit.yaml
├── package.json
├── src/
│   ├── main.tsx
│   ├── serializer.ts
│   ├── parser/
│   │   └── yamlToJson.ts
│   └── types/
│       ├── automod.ts
│       └── js-yaml.d.ts
└── webroot/
    ├── index.html
    ├── index.js
    └── styles.css
```

## Core Modules

### Devvit Entry Point

`src/main.tsx` configures Reddit API access, registers the custom post type, mounts the webview, and handles messages for:

- `GET_RULES`
- `SAVE`
- `GET_WIKI_REVISIONS`
- `GET_WIKI_REVISION`
- `REVERT_WIKI`

### YAML Parser

`src/parser/yamlToJson.ts` loads multi-document AutoModerator YAML, skips invalid or empty documents with warnings, and partitions each rule into:

- raw rule document
- conditions
- actions
- metadata
- display name and stable UI id

### YAML Serializer

`src/serializer.ts` converts edited rule objects back into clean YAML documents joined with AutoModerator `---` separators.

### Webview Interface

`webroot/index.js` owns the visual editor, simulator, draft persistence, local history timeline, and shell navigation. `webroot/styles.css` provides the full light/dark design system and responsive app layout.

## Getting Started

### Prerequisites

- Node.js 18+
- Devvit CLI
- Reddit account with moderator access to a test subreddit

```bash
npm install -g devvit
npm install
```

### Login

```bash
npm run login
```

### Upload

```bash
npm run upload
```

### Playtest

```bash
npm run dev
```

Or target your own small test subreddit:

```bash
npm run dev -- r/yoursubreddit
```

Open the playtest subreddit, go to Mod Tools, and select **AutoMod Studio**.

## Development Commands

| Command | Description |
| --- | --- |
| `npm run login` | Authenticate the Devvit CLI |
| `npm run upload` | Upload/register the app with Reddit |
| `npm run dev` | Start Devvit playtest |
| `npm run check` | Run TypeScript type checking |

## App Listing Links

Use these URLs in the Reddit Developer Portal app details form so Reddit can show the native Terms and Privacy links on the app surface:

| Field | URL |
| --- | --- |
| Terms of Service | `https://github.com/Bop95/automod-studio/blob/main/TERMS.md` |
| Privacy Policy | `https://github.com/Bop95/automod-studio/blob/main/PRIVACY.md` |

## Current Capabilities

- Read AutoModerator YAML from Reddit wiki.
- Parse multiple YAML documents into rule objects.
- Edit common AutoModerator fields through a visual builder.
- Preview generated YAML per rule.
- Detect broad rules before deployment.
- Detect duplicate rules before deployment.
- Test body, title, URL, regex, and content type matching locally.
- Preserve unsaved drafts in the browser.
- Save local history snapshots after deploy.
- Load Reddit wiki revisions and restore/revert versions.

## Safety Model

AutoMod Studio treats the Reddit wiki as the source of truth. Edits remain local until a moderator explicitly deploys. Before saving, the app warns that the entire AutoModerator page will be replaced with the rules currently loaded in the editor.

The simulator is intentionally labeled approximate. It is designed to catch common mistakes before deployment, not to claim byte-for-byte parity with Reddit's production AutoModerator engine.

## Roadmap

- Redis-backed server snapshots for shared moderator history.
- Deeper AutoModerator schema coverage.
- Safer regex analysis and ReDoS warnings.
- More complete author and submission simulation.
- Import/export rule templates.
- Permission-aware UI for config-capable moderators.
- Automated parser and serializer test fixtures.

## License

BSD-3-Clause
