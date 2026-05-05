export type AutoModRuleDocument = Record<string, unknown>;

export interface AutoModRuleMetadata {
  moderatorsExempt?: boolean;
  priority?: number;
}

export interface ParsedAutoModRule {
  id: string;
  index: number;
  name: string;
  raw: AutoModRuleDocument;
  conditions: AutoModRuleDocument;
  actions: AutoModRuleDocument;
  metadata: AutoModRuleMetadata;
}

export interface ParsedAutoModConfig {
  rules: ParsedAutoModRule[];
  warnings: string[];
}
