# SkillTwin Focus — Chrome Web Store submission checklist

## Listing copy
**Name:** SkillTwin Focus

**Category:** Productivity

**Short description:** Limit distracting websites. Complete short learning quizzes to earn more browsing time.

**Full description:**
Use distracting sites more intentionally with SkillTwin Focus. Choose YouTube, Instagram, Reddit, or X/Twitter; set a daily allowance for approximate active website usage. When you reach the allowance, the extension pauses navigation to selected sites and asks three quick SQL, Python, or data-structures practice questions. Completing the challenge earns a limited amount of additional browsing time.

Everything in this preview works locally. No account is required, and your browsing activity and quiz answers are not uploaded. You choose which websites are monitored, and can disable Focus Mode or use a five-minute emergency bypass whenever needed.

This is an early-access browser preview. It does not block apps or your device, or yet connect to the personalized SkillTwin web platform. Time tracking is approximate due to Chrome service-worker and activity-sampling constraints.

## Privacy disclosure
Single purpose: opt-in limits on selected sites with learning checkpoints.
Data: selected domain hostnames, active-tab/window and idle signals, aggregate time, policy settings and quiz progress; all stored locally.
External transfer, analytics, ad targeting, sharing or sales: none.
Privacy policy URL: https://github.com/navadeep-17/SkillTwin/blob/main/extensions/chrome-focus-demo/PRIVACY.md

Permission rationale: `tabs` to identify selected active sites, `idle` to pause while away, `storage` for local state, `alarms` for periodic timing, `declarativeNetRequest` for local redirects, and site-specific host permissions to restrict only supported domains.

## Publishing steps
1. Register the publisher at https://chrome.google.com/webstore/devconsole/ (one-time developer registration fee and required verification).
2. Upload `SkillTwin_Focus_0.1.1_Chrome_Web_Store.zip` (manifest.json at ZIP root).
3. Upload current, unedited screenshots taken from actual browser extension interactions (at least one at 1280×800 or 640×400), icon, and any other listing assets requested.
4. Set the description, category, accurate developer contact details, permission explanations, and privacy disclosures above. Verify the privacy policy link resolves on main.
5. Submit for Google's review. Do not claim public availability before Google approves and assigns a store listing URL.
