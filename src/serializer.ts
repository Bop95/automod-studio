import yaml from "js-yaml";

export function serializeRulesToYaml(rules: Record<string, unknown>[]): string {
  if (rules.length === 0) return "";

  return rules
    .map((rule) =>
      yaml.dump(rule, {
        indent: 2,
        lineWidth: 120,
        noRefs: true,
      })
    )
    .join("---\n");
}
