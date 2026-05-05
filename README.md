# 🚀 AutoMod Studio

A Devvit-native visual configuration engine for Reddit AutoModerator.

---

## 📌 Overview

Reddit AutoModerator uses YAML-based configuration, which can be difficult to read, write, and maintain—especially for non-technical moderators.

AutoMod Studio simplifies this process by converting YAML rules into structured data and enabling easier interaction through programmatic and visual interfaces.

This project is part of the CollabGuard system, designed to improve collaboration and efficiency for Reddit moderation teams.

---

## 🎯 Features

- 🔄 YAML → JSON Parser  
  Convert AutoModerator YAML configuration into a structured JavaScript object.

- 🧠 Rule Engine (Planned)  
  Interpret and validate moderation rules.

- 🧪 Rule Simulator (Planned)  
  Test rules against sample inputs before deploying.

- 🖥️ Visual Builder (Planned)  
  Enable no-code rule creation through a UI interface.

- 🔁 JSON → YAML Conversion (Planned)  
  Convert structured rules back into valid AutoModerator YAML.

---

## ⚙️ Tech Stack

- TypeScript
- Node.js
- js-yaml

---

## 📂 Project Structure

```
automod-studio/
├── src/
│ ├── parser/ # YAML ↔ JSON conversion
│ ├── rules/ # Rule logic
│ ├── simulator/ # Rule testing
│ ├── types/ # Type definitions
│ └── index.ts # Entry point
├── package.json
├── tsconfig.json
└── README.md
```
---

## 🚀 Getting Started

### 1. Clone the repository

git clone https://github.com/Bop95/automod-studio.git cd automod-studio

### 2. Install dependencies

npm install

### 3. Run the project

npx ts-node src/index.ts

---

## 🧠 Architecture

AutoMod YAML ↓ Parser (YAML → JSON) ↓ Rule Engine ↓ Simulator / UI ↓ Deploy back to Reddit
