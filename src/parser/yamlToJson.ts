import yaml from "js-yaml";

import type {
  AutoModRuleDocument,
  AutoModRuleMetadata,
  ParsedAutoModConfig,
  ParsedAutoModRule,
} from "../types/automod";

const ACTION_KEYS = new Set([
  "action",
  "action_reason",
  "comment",
  "comment_locked",
  "comment_stickied",
  "message",
  "modmail",
  "modmail_subject",
  "modmail_body",
  "report_reason",
  "set_flair",
  "set_locked",
  "set_nsfw",
  "set_spoiler",
  "set_sticky",
]);

const METADATA_KEYS = new Set(["moderators_exempt", "priority"]);

function isPlainObject(value: unknown): value is AutoModRuleDocument {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function extractRuleName(rule: AutoModRuleDocument, index: number): string {
  const candidateKeys = ["comment", "action_reason", "title", "type"];

  for (const key of candidateKeys) {
    const value = rule[key];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().split("\n")[0] ?? `Rule ${index}`;
    }
  }

  return `Rule ${index}`;
}

function buildRuleId(rule: AutoModRuleDocument, index: number): string {
  const slug = slugify(extractRuleName(rule, index));
  return slug.length > 0 ? `${slug}-${index}` : `rule-${index}`;
}

function extractMetadata(rule: AutoModRuleDocument): AutoModRuleMetadata {
  const metadata: AutoModRuleMetadata = {};

  if (typeof rule.moderators_exempt === "boolean") {
    metadata.moderatorsExempt = rule.moderators_exempt;
  }

  if (typeof rule.priority === "number") {
    metadata.priority = rule.priority;
  }

  return metadata;
}

function partitionRuleFields(rule: AutoModRuleDocument): Pick<ParsedAutoModRule, "actions" | "conditions"> {
  const actions: AutoModRuleDocument = {};
  const conditions: AutoModRuleDocument = {};

  for (const [key, value] of Object.entries(rule)) {
    if (METADATA_KEYS.has(key)) {
      continue;
    }

    if (ACTION_KEYS.has(key)) {
      actions[key] = value;
      continue;
    }

    conditions[key] = value;
  }

  return { actions, conditions };
}

export function parseAutoModeratorYaml(source: string): ParsedAutoModConfig {
  const documents: unknown[] = [];
  const warnings: string[] = [];

  yaml.loadAll(source, (document: unknown) => {
    documents.push(document);
  });

  const rules = documents.flatMap((document, zeroBasedIndex) => {
    const index = zeroBasedIndex + 1;

    if (document == null) {
      warnings.push(`Skipped empty YAML document at position ${index}.`);
      return [];
    }

    if (!isPlainObject(document)) {
      warnings.push(`Skipped document ${index} because AutoModerator rules must be objects.`);
      return [];
    }

    const { actions, conditions } = partitionRuleFields(document);

    return [
      {
        id: buildRuleId(document, index),
        index,
        name: extractRuleName(document, index),
        raw: document,
        conditions,
        actions,
        metadata: extractMetadata(document),
      },
    ];
  });

  return { rules, warnings };
}
