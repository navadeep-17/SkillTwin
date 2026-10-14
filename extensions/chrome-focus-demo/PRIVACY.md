# SkillTwin Focus — Privacy Policy
Last updated: October 14, 2026.

SkillTwin Focus is an opt-in, offline-first Chrome/Edge extension. It measures approximate time spent in the foreground on websites selected by the user and then offers a short learning quiz in exchange for more browsing time. It does not control the device or other apps.

## What the extension handles

The extension checks the URL of the currently active tab to identify whether its hostname matches a supported, user-selected site. It also checks whether the browser window is focused and whether Chrome reports an active or idle user. The full URL is processed transiently to determine the domain; it is not saved or transmitted.

The extension stores in `chrome.storage.local` only: selected site identifiers, time allowance and reward settings, aggregate monitored time for the current day, day/date, current quiz position, counts of earned unlocks, and temporary bypass/unlock state. It does not store complete URLs, browsing history, page titles, searches, passwords, communications, cookies or site content.

## Data use, sharing and transmission

In version 0.1.1, all Focus tracking, quiz evaluation and rewards run locally. **No user information, browsing activity, settings or quiz responses are uploaded or sent to SkillTwin servers, Supabase, analytics vendors, advertisers or third parties.** There are no tracking SDKs, advertising systems or remote API calls in this preview. No user account is required.

Data is used only to measure selected-site usage, display an optional quiz checkpoint, and control temporary access to the selected sites.

## Chrome permissions

- `tabs`: determine whether the active tab is on a site you chose.
- `idle`: avoid counting time when you are inactive.
- `storage`: save preferences and local timer state between browser sessions.
- `alarms`: periodically reconcile usage while Chrome's extension service worker is not constantly running.
- `declarativeNetRequest`: redirect selected-site navigations to the locally packaged quiz checkpoint once an allowance is exhausted.
- Site-scoped host permissions: limited to supported websites, YouTube, Instagram, Reddit, and X/Twitter.

These permissions are used only to deliver the extension's disclosed purpose.

## Your choices, retention and deletion

Focus Mode is off by default and must be enabled by the user. Users can choose sites, change timer settings, use the five-minute emergency bypass, disable Focus Mode, or reset the current demo day's state at any time. Local state remains in browser extension storage until reset or the extension's data is removed/uninstalled. It is not backed up to SkillTwin.

## Chrome Web Store Limited Use

**The use of information received from Google APIs will adhere to the Chrome Web Store User Data Policy, including the Limited Use requirements.** In particular, browsing-activity information is used only for the user-facing focus restrictions described above, and is never transferred or sold for advertising, profiling or unrelated uses.

## Future releases and support

If a future version adds cloud synchronization, SkillTwin account pairing or personalized quizzes, this privacy policy and the in-product disclosures must be updated before those practices become active.

Questions or privacy requests: [SkillTwin GitHub issue tracker](https://github.com/navadeep-17/SkillTwin/issues).
