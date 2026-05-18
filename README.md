# AutoMod Studio

A visual editor for Reddit's AutoModerator — built inside Reddit with Devvit.

> Submitted to the [Reddit Mod Tools & Migrated Apps Hackathon](https://devpost.com/software/automod-studio) · May 2026

---

## The Problem

Every active subreddit uses AutoModerator to enforce rules automatically. But configuring it means hand-writing complex YAML in a plain text box — no validation, no testing, no visual feedback. One typo silently breaks your entire config. Non-technical mods are effectively locked out.

## The Solution

AutoMod Studio is a Devvit app that lets mods manage their AutoMod rules visually, directly inside Reddit:

- **See** all rules as a clean, labeled list instead of raw YAML
- **Edit** rules with form fields — dropdowns, text inputs — instead of writing YAML by hand
- **Test** rules before deploying with the built-in simulator
- **Save** changes back to Reddit automatically — no copy-pasting, no wiki editing

---

## Features

### Visual Rule Editor
Each AutoMod rule is displayed as an editable card with form fields for:
- Content type (comment, submission, link)
- Body/title conditions (contains, excludes, regex)
- Author filters (karma threshold, account age)
- Actions (remove, report, approve, spam, filter)
- Metadata (priority, moderator exemption)

### Rule Simulator
Paste sample post or comment text, select the content type, and see exactly which rules would fire — with a breakdown of why each rule matched or didn't.

### Direct Reddit Integration
Reads and writes directly to `r/subreddit/wiki/config/automoderator` via Reddit's API. No external servers, no copy-pasting — changes save instantly.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Platform | [Devvit](https://developers.reddit.com/) (Reddit Developer Platform) |
| Server | TypeScript + `@devvit/public-api` |
| UI | Vanilla HTML/CSS/JS (CSP-compliant webview) |
| YAML parsing | `js-yaml` |
| YAML serialization | Custom serializer (`src/serializer.ts`) |

---

## Project Structure

```
automod-studio/
├── devvit.yaml              # App manifest
├── src/
│   ├── main.tsx             # Devvit entry point (custom post + menu item)
│   ├── serializer.ts        # JSON → YAML conversion
│   ├── parser/
│   │   └── yamlToJson.ts    # YAML → JSON parser
│   └── types/
│       └── automod.ts       # TypeScript type definitions
├── webroot/
│   ├── index.html           # Webview shell
│   └── index.js             # Visual editor + simulator UI logic
├── package.json
└── tsconfig.json
```

---

## How It Works

```
Reddit Wiki (AutoMod YAML)
        ↓  getWikiPage()
    YAML Parser
        ↓
  Structured JSON rules
        ↓
  Webview (Visual Editor)
        ↓  user edits
  Updated JSON rules
        ↓
    YAML Serializer
        ↓  updateWikiPage()
Reddit Wiki (updated YAML)
```

---

## Getting Started (Development)

### Prerequisites
- Node.js 18+
- Devvit CLI: `npm install -g devvit`
- A Reddit account with a test subreddit

### Setup

```bash
git clone https://github.com/Bop95/automod-studio.git
cd automod-studio
npm install
devvit login
```

### Playtest

```bash
devvit playtest r/yoursubreddit
```

Open the playtest URL, go to Mod Tools, and click **AutoMod Studio**.

### Publish

```bash
devvit upload
```

---

## Milestones

| Milestone | Status | Description |
|---|---|---|
| 1 — Parser | ✅ Done | YAML → JSON parser with conditions/actions/metadata extraction |
| 2 — Devvit App | ✅ Done | Full visual editor, wiki read/write, rule simulator |

---

## License

ISC
