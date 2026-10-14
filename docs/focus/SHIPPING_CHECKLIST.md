# SkillTwin Focus 0.1.1 — Store shipping checklist

**Release scope:** Chrome/Edge desktop browser extension only. Opt-in per-site limits, a three-question local SQL/Python/DSA quiz, up to two daily rewarded unlocks, and five-minute emergency bypass. No SkillTwin account or device-wide blocking.

## Build artifact (already built)

- Version: `0.1.1`, Manifest V3.
- Verified GitHub Actions run: [Focus Mode Extension QA, main](https://github.com/navadeep-17/SkillTwin/actions/runs/38515217089) — success.
- GitHub Actions artifact: `skilltwin-focus-0.1.1-store-package`. GitHub wraps the real store ZIP inside its own artifact ZIP; **extract the outer ZIP and upload the inner `SkillTwin_Focus_0.1.1_Chrome_Web_Store.zip`**.
- The upload ZIP must have `manifest.json` at ZIP root, not a nested folder.

## Submission requirements

1. Open [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/) with the account that will own the extension. Complete developer registration and any required verification.
2. Create an extension entry and upload the **inner** store ZIP.
3. Name: **SkillTwin Focus**; category **Productivity**; language English.
4. Paste listing copy from [STORE_LISTING.md](STORE_LISTING.md), including the early-access and approximate-tracking limitations. Do not claim mobile or entire-device blocking.
5. Upload at least one **actual, current extension UI screenshot** at 1280x800 or 640x400, and a 440x280 small promotional tile. The example-state rendered previews provided in chat are for review/asset drafting; replace them with genuine Chrome screenshots before submission.
6. Privacy policy URL: https://github.com/navadeep-17/SkillTwin/blob/main/extensions/chrome-focus-demo/PRIVACY.md
7. Privacy practices: single purpose is optional selected-site usage limits + learning checkpoints. Disclosure: active-tab domain matching, idle/window signals, settings, local aggregate time and quiz progress. No network transmission, ads, data sale or third-party sharing in 0.1.1.
8. Permission rationales: `tabs` active-site determination; `idle` inactivity detection; `storage` local state; `alarms` periodic checkpoints; `declarativeNetRequest` local site restriction; site-specific host access only for listed supported domains.
9. Add a real support contact address controlled by the publisher. Review the full submission details and then **Submit for Review**. Publication requires Google review and approval.

## Final QA before submission

- [ ] Install inner ZIP unpacked in fresh Chrome profile and verify no extension loading errors.
- [ ] Enable YouTube, exhaust 1-minute allowance, confirm quiz shown.
- [ ] Complete all three questions, click Return to website, verify browsing works.
- [ ] Continue using selected site until earned time is exhausted and verify **reblocking**.
- [ ] Verify bypass, disable, tab-switch/idle behavior, browser restart and daily reset.
- [ ] Confirm no unsupported sites are blocked.
- [ ] Inspect installed extension page errors and verify icon on both light and dark backgrounds.
- [ ] Confirm Privacy Policy URL is publicly accessible.
- [ ] Confirm release ZIP matches source and no secrets, keys, archives or test scripts are included.
- [ ] Use real browser screenshots showing the current extension UI.

**Current status:** CI and packaged-artifact inspection pass; user observed successful quiz → YouTube return. Reblocking after earned minutes is not yet confirmed by a complete user walkthrough. The Chrome Web Store listing has not been submitted or approved through this repository.

## Rollback

Keep an archived copy of the signed/published release artifact and follow Chrome Web Store's rollback/update process for published items. Since this version is opt-in and user-controlled, anyone can disable/uninstall Focus Mode if necessary.
