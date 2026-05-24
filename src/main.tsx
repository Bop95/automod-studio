import { Devvit, useWebView } from "@devvit/public-api";
import type { JSONObject } from "@devvit/public-api";
import { parseAutoModeratorYaml } from "./parser/yamlToJson";
import { serializeRulesToYaml } from "./serializer";

Devvit.configure({
  redditAPI: true,
});

function toJSONObject(obj: Record<string, unknown>): JSONObject {
  return JSON.parse(JSON.stringify(obj)) as JSONObject;
}

Devvit.addCustomPostType({
  name: "AutoMod Studio",
  height: "tall",
  render: (context) => {
    const webView = useWebView<JSONObject, JSONObject>({
      url: "index.html",
      async onMessage(msg, hook) {
        const type = msg["type"];

        if (type === "GET_RULES") {
          try {
            const subreddit = await context.reddit.getCurrentSubreddit();
            let yamlContent = "";
            try {
              const wiki = await context.reddit.getWikiPage(
                subreddit.name,
                "config/automoderator"
              );
              yamlContent = wiki.content ?? "";
            } catch {
              // Wiki page doesn't exist yet — start with empty config
              yamlContent = "";
            }
            const { rules, warnings } = parseAutoModeratorYaml(yamlContent);
            await hook.postMessage({
              type: "INIT",
              subredditName: subreddit.name,
              rules: rules.map((r) => toJSONObject(r.raw)),
              warnings,
            });
          } catch (e) {
            await hook.postMessage({
              type: "ERROR",
              message: e instanceof Error ? e.message : String(e),
            });
          }
        }

        if (type === "SAVE") {
          try {
            const rawRules = (msg["rules"] as JSONObject[] | undefined) ?? [];
            const subreddit = await context.reddit.getCurrentSubreddit();
            const yamlContent = serializeRulesToYaml(
              rawRules as Record<string, unknown>[]
            );
            await context.reddit.updateWikiPage({
              subredditName: subreddit.name,
              page: "config/automoderator",
              content: yamlContent,
              reason: "Updated via AutoMod Studio",
            });
            await hook.postMessage({ type: "SAVE_SUCCESS" });
          } catch (e) {
            await hook.postMessage({
              type: "ERROR",
              message: e instanceof Error ? e.message : String(e),
            });
          }
        }
      },
    });

    return (
      <vstack height="100%" width="100%" alignment="center middle" gap="medium">
        <text size="xxlarge" weight="bold">
          AutoMod Studio
        </text>
        <text size="medium" color="secondary-plain">
          Visual editor for your AutoMod rules
        </text>
        <button onPress={() => webView.mount()} appearance="primary" size="large">
          Open Editor
        </button>
      </vstack>
    );
  },
});

Devvit.addMenuItem({
  label: "AutoMod Studio",
  location: "subreddit",
  forUserType: "moderator",
  onPress: async (_event, context) => {
    const subreddit = await context.reddit.getCurrentSubreddit();
    const post = await context.reddit.submitPost({
      title: "AutoMod Studio — Visual Rule Editor",
      subredditName: subreddit.name,
      preview: (
        <vstack height="100%" width="100%" alignment="center middle" gap="medium">
          <text size="xxlarge" weight="bold">
            AutoMod Studio
          </text>
          <text size="medium" color="secondary-plain">
            Loading...
          </text>
        </vstack>
      ),
    });
    context.ui.navigateTo(post);
  },
});

export default Devvit;
