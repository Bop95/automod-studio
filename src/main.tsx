import { Devvit, useWebView } from "@devvit/public-api";
import type { JSONObject } from "@devvit/public-api";
import { parseAutoModeratorYaml } from "./parser/yamlToJson";
import { serializeRulesToYaml } from "./serializer";

const WIKI_PAGE = "config/automoderator";
const TERMS_URL = "https://github.com/Bop95/automod-studio/blob/main/TERMS.md";
const PRIVACY_URL = "https://github.com/Bop95/automod-studio/blob/main/PRIVACY.md";
const DOCS_URL = "https://developers.reddit.com/docs/";
const DEVVIT_COMMUNITY_URL = "https://www.reddit.com/r/Devvit/";

Devvit.configure({
  redditAPI: true,
});

function toJSONObject(obj: Record<string, unknown>): JSONObject {
  return JSON.parse(JSON.stringify(obj)) as JSONObject;
}

function wikiSaveErrorMessage(err: unknown): string {
  const errMsg = err instanceof Error ? err.message : String(err);
  const hint = errMsg.includes("415")
    ? " (HTTP 415 — wiki may be locked, or install the uploaded app for full mod wiki permissions)"
    : "";
  return errMsg + hint;
}

Devvit.addCustomPostType({
  name: "AutoMod Studio",
  height: "tall",
  render: (context) => {
    const webView = useWebView<JSONObject, JSONObject>({
      url: "index.html",
      async onMessage(msg, hook) {
        const type = msg["type"];
        const reddit = context.reddit;

        if (type === "GET_RULES") {
          try {
            const subreddit = await reddit.getCurrentSubreddit();
            const subredditName = subreddit.name;
            let yamlContent = "";
            try {
              const wiki = await reddit.getWikiPage(subredditName, WIKI_PAGE);
              yamlContent = wiki.content ?? "";
            } catch {
              yamlContent = "";
            }
            const { rules, warnings } = parseAutoModeratorYaml(yamlContent);
            const username = await reddit.getCurrentUsername();
            let wikiPermLevel: string | undefined;
            try {
              const settings = await reddit.getWikiPageSettings(
                subredditName,
                WIKI_PAGE
              );
              wikiPermLevel = String(settings.permLevel);
            } catch {
              wikiPermLevel = undefined;
            }
            await hook.postMessage({
              type: "INIT",
              subredditName,
              rules: rules.map((r) => toJSONObject(r.raw)),
              warnings,
              currentUsername: username ?? null,
              canSave: Boolean(username),
              wikiPermLevel: wikiPermLevel ?? null,
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
            const subreddit = await reddit.getCurrentSubreddit();
            const username = await reddit.getCurrentUsername();
            if (!username) {
              await hook.postMessage({
                type: "SAVE_WIKI_ERROR",
                message:
                  "You must be signed in as a moderator to save to the subreddit wiki.",
              });
              return;
            }

            const rawRules = (msg["rules"] as JSONObject[] | undefined) ?? [];
            const yamlFromClient =
              typeof msg["yaml"] === "string" ? msg["yaml"] : "";
            const yamlContent = yamlFromClient.trim()
              ? yamlFromClient
              : serializeRulesToYaml(
                  rawRules as Record<string, unknown>[]
                );

            await reddit.updateWikiPage({
              subredditName: subreddit.name,
              page: WIKI_PAGE,
              content: yamlContent,
              reason: "Updated via AutoMod Studio",
            });
            await hook.postMessage({
              type: "SAVE_SUCCESS",
              savedBy: username,
              savedAt: Date.now(),
            });
          } catch (e) {
            const yamlFromClient =
              typeof msg["yaml"] === "string" ? msg["yaml"] : "";
            const rawRules = (msg["rules"] as JSONObject[] | undefined) ?? [];
            const yamlContent = yamlFromClient.trim()
              ? yamlFromClient
              : serializeRulesToYaml(
                  rawRules as Record<string, unknown>[]
                );
            await hook.postMessage({
              type: "SAVE_WIKI_ERROR",
              message: wikiSaveErrorMessage(e),
              yaml: yamlContent,
            });
          }
        }

        if (type === "GET_WIKI_REVISIONS") {
          try {
            const subreddit = await reddit.getCurrentSubreddit();
            const listing = reddit.getWikiPageRevisions({
              subredditName: subreddit.name,
              page: WIKI_PAGE,
              limit: 25,
            });
            const revisions = await listing.all();
            await hook.postMessage({
              type: "WIKI_REVISIONS",
              revisions: revisions.map((revision) => {
                const author = revision.author?.toJSON?.();
                return {
                  id: revision.id,
                  date: revision.date.getTime(),
                  reason: revision.reason || "",
                  author:
                    (author && typeof author.username === "string"
                      ? author.username
                      : null) || "unknown",
                };
              }),
            });
          } catch (e) {
            await hook.postMessage({
              type: "WIKI_REVISIONS",
              revisions: [],
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        if (type === "GET_WIKI_REVISION") {
          try {
            const subreddit = await reddit.getCurrentSubreddit();
            const revisionId = String(msg["revisionId"] || "");
            if (!revisionId) {
              throw new Error("Missing revision id");
            }
            const wiki = await reddit.getWikiPage(
              subreddit.name,
              WIKI_PAGE,
              revisionId as `${string}-${string}-${string}-${string}-${string}`
            );
            const { rules, warnings } = parseAutoModeratorYaml(
              wiki.content ?? ""
            );
            await hook.postMessage({
              type: "WIKI_REVISION",
              revisionId,
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

        if (type === "REVERT_WIKI") {
          try {
            const subreddit = await reddit.getCurrentSubreddit();
            const revisionId = String(msg["revisionId"] || "");
            if (!revisionId) {
              throw new Error("Missing revision id");
            }
            await reddit.revertWikiPage(
              subreddit.name,
              WIKI_PAGE,
              revisionId
            );
            const wiki = await reddit.getWikiPage(subreddit.name, WIKI_PAGE);
            const { rules, warnings } = parseAutoModeratorYaml(
              wiki.content ?? ""
            );
            await hook.postMessage({
              type: "REVERT_SUCCESS",
              revisionId,
              rules: rules.map((r) => toJSONObject(r.raw)),
              warnings,
            });
          } catch (e) {
            await hook.postMessage({
              type: "SAVE_WIKI_ERROR",
              message: wikiSaveErrorMessage(e),
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
        <spacer size="medium" />
        <hstack gap="small" alignment="center middle">
          <button
            appearance="plain"
            size="small"
            onPress={() => context.ui.navigateTo(TERMS_URL)}
          >
            Terms
          </button>
          <text size="small" color="secondary-weak">
            |
          </text>
          <button
            appearance="plain"
            size="small"
            onPress={() => context.ui.navigateTo(PRIVACY_URL)}
          >
            Privacy
          </button>
          <text size="small" color="secondary-weak">
            |
          </text>
          <button
            appearance="plain"
            size="small"
            onPress={() => context.ui.navigateTo(DOCS_URL)}
          >
            Docs
          </button>
          <text size="small" color="secondary-weak">
            |
          </text>
          <button
            appearance="plain"
            size="small"
            onPress={() => context.ui.navigateTo(DEVVIT_COMMUNITY_URL)}
          >
            r/Devvit
          </button>
        </hstack>
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
