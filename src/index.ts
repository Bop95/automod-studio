import { parseAutoModeratorYaml } from "./parser/yamlToJson";

const sampleAutoModeratorConfig = `---
type: comment
author:
  comment_karma: "< -50"
body (regex):
  - buy now
  - click here
action: remove
action_reason: "Spam phrase detected"
comment: |
  Your comment was removed automatically because it matched our spam filters.
moderators_exempt: false
priority: 10
`;

const parsedConfig = parseAutoModeratorYaml(sampleAutoModeratorConfig);

console.dir(parsedConfig, { depth: null });
