# AutoMod Studio Privacy Policy

Last updated: May 25, 2026

AutoMod Studio is a Reddit Devvit app that helps subreddit moderators view, edit, test, and deploy Reddit AutoModerator rules. This Privacy Policy explains what data the app uses, how it is stored, and what choices moderators have.

## Summary

- AutoMod Studio is designed for subreddit moderators.
- The app reads and writes the subreddit AutoModerator wiki page only for the subreddit where it is installed or playtested.
- The app does not use external analytics, advertising networks, data brokers, or third-party tracking services.
- The app does not sell, license, or commercialize Reddit data.
- Sandbox test content entered in the simulator is processed locally in the webview and is not intentionally saved to Reddit, Redis, or an external service.

## Data the App Uses

AutoMod Studio may access or process the following data to provide its moderation workflow:

| Data | Purpose |
| --- | --- |
| Subreddit name | Shows the active workspace and calls the correct Reddit wiki APIs. |
| Current moderator username | Shows save context and records local save history labels. |
| AutoModerator wiki content | Parses, displays, edits, validates, and deploys rules. |
| AutoModerator wiki revision metadata | Displays version history and supports restore or revert actions. |
| Rule drafts and local snapshots | Preserves unsaved edits and recent local history on the moderator's device. |
| Simulator sample title, body, and URL | Tests draft rules before deployment. |

## Storage

AutoMod Studio currently uses:

- **Reddit wiki**: the live AutoModerator configuration is stored by Reddit at `config/automoderator`.
- **Browser local storage**: unsaved drafts, local UI preferences, and local snapshot history may be stored on the moderator's device.
- **Reddit/Devvit infrastructure**: Reddit hosts the Devvit app runtime and handles Reddit API authentication.

AutoMod Studio does not currently store rule snapshots in Devvit Redis and does not send app data to an external server.

## Data Sharing

AutoMod Studio does not share app data with advertisers, analytics providers, data brokers, or AI model providers.

The app uses Reddit's Devvit platform and Reddit APIs. Reddit may process platform-level data according to Reddit's own policies. AutoMod Studio does not control Reddit's platform-level data practices.

## External Services

AutoMod Studio does not currently use HTTP Fetch to call external APIs.

The repository README may use third-party badge or diagram image services for project documentation. Those README assets are not part of the in-Reddit app workflow.

## Moderator Responsibilities

Moderators are responsible for the AutoModerator rules they create, test, and deploy. If a moderator enters real post/comment content into the simulator, that content should be treated as sensitive community moderation context. The app is designed not to persist simulator samples, but moderators should avoid entering unnecessary personal or sensitive information.

## Data Deletion and Controls

- Moderators can clear local drafts and local snapshot data by using the app's discard controls or clearing browser/site storage.
- Removing or editing AutoModerator rules in the app affects the subreddit wiki only after a moderator confirms deployment.
- Reddit wiki revisions and audit records are controlled by Reddit and subreddit moderation tooling.

## Children

AutoMod Studio is not directed to children under 13. The app is intended for Reddit moderators using Reddit's platform.

## Security

AutoMod Studio relies on Reddit and Devvit authentication and permission controls for subreddit access. Moderators should install and use the app only in communities where they are authorized to manage AutoModerator settings.

## Changes

This Privacy Policy may be updated as AutoMod Studio changes. Material changes should be reflected by updating this file and the app listing or documentation.

## Contact

For questions, support, or privacy requests, contact the project maintainer through the GitHub repository or Reddit account associated with the Devvit app.
