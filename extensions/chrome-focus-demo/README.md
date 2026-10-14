# SkillTwin Focus — Chrome/Edge extension demo

Opt-in, offline-first demonstration of the mentor's **Learn to Unlock** idea.

## Install locally
1. Download or extract the [demo extension source](https://github.com/navadeep-17/SkillTwin/tree/feature/focus-mode-extension-demo/extensions/chrome-focus-demo) to a folder.
2. In desktop Chrome visit chrome://extensions; in Edge visit edge://extensions.
3. Enable Developer mode and choose **Load unpacked**. Select the directory that contains manifest.json.
4. Pin SkillTwin Focus, open the popup, choose YouTube or another supported website, turn Focus Mode on, and Save.
5. Leave the allowance and quiz reward at **1 minute** for the demo. Actively use the selected website. Allow about 30 seconds of alarm jitter.
6. After the website redirects to the SkillTwin Focus checkpoint, answer three multiple-choice questions. Wrong answers show an explanation and still count.
7. The website unlocks for another minute of active usage. Use **Reset demo** to repeat, the five-minute emergency bypass to exit temporarily, or toggle Focus Mode off any time.

## What's built
- Selected-domain tracking for YouTube, Instagram, Reddit and X/Twitter (including subdomains).
- Approximate active/focused-window timer with saved state; 30-second Chrome alarm reconciliation.
- Dynamic main-frame redirect to packaged blocked.html when allowance expires.
- Three locally reviewed SQL/Python/DSA questions, feedback, two extra unlocks per day.
- Persistent progress in chrome.storage.local, disable/bypass/reset, and a UI for policy edits.

## Scope and limitations
- This **does not lock the entire laptop or phone**, block other browsers, or provide tamper-proof controls.
- Tracking is approximate; sleeping, background media and service-worker scheduling can affect timings.
- All questions are bundled locally. Answers are inspectable; quiz attempts do not count toward canonical SkillTwin skill evidence.
- No Supabase, Gemini, Railway or SkillTwin account integration in this timeboxed demo. No browser history is uploaded.
- Full manual Chrome walkthrough is required before claiming real-browser validation.

## Tests

Run from this folder:

    npm test
    npm run check

The automated tests cover policy state, domains, timers, midnight reset, replay limits, Chrome background-worker message logic, grants and bypass. See the repository's docs/FOCUS_MODE_90_MINUTE_IMPLEMENTATION_PLAN.md for the build/release plan.
