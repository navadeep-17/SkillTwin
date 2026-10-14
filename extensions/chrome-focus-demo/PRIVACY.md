# SkillTwin Focus — Privacy Policy
Last updated: October 14, 2026.

SkillTwin Focus is an opt-in, offline-first Chrome/Edge browser extension that measures approximate active time on websites users select, then displays a learning quiz checkpoint.

## Data handled
It reads only the hostname of the currently active tab, Chrome's window-focus state, and Chrome's active/idle state. It locally stores selected domain names, the allowance and reward settings, aggregate monitored usage time, date, quiz progress and unlock/bypass state using `chrome.storage.local`. It does not store complete URLs, browsing histories, page titles, search queries, account credentials, or page contents.

## Sharing and transmission
**The 0.1.1 preview does not send this information or quiz responses to SkillTwin servers, Supabase, advertisers, analytics vendors or any other third party.** There are no remote network calls, trackers, or advertisements in this preview.

## Permissions and purpose
`tabs` checks the foreground website; `idle` avoids charging when away; `storage` saves settings and usage on your device; `alarms` schedules timer checks; `declarativeNetRequest` temporarily redirects selected-site navigation to a local quiz screen. Host access is limited to supported websites (YouTube, Instagram, Reddit, X/Twitter) and is only used when a site is selected and Focus Mode enabled.

## User controls and retention
Focus Mode starts disabled. Users may change selections, disable restrictions, use the five-minute emergency bypass, reset daily state, or uninstall the extension at any time. Local data remains on-device until reset or removed with the extension. It is not backed up by SkillTwin.

## Future updates and contact
A future personalized or cloud-connected release would have different data practices and must be disclosed separately before implementation. Contact the team via the [SkillTwin issue tracker](https://github.com/navadeep-17/SkillTwin/issues).
