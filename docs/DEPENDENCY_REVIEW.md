# Dependency repair — 25 October 2026

**Update, 28 October:** fast-uri 3.1.9 is now accepted by the unchanged release-age policy.
The current full and production audits report zero advisories. See DEEP_REPAIR_STATUS.md.
The notes below describe the original 25 October review.

The original graph reported 23 production advisory findings (three critical) and 78 including
build tooling. These counts describe advisory matches, not independently demonstrated exploits.
The app uses Vinext on Workers, unoptimized images and no application `next/og`, Cache Component
or Server Action implementation; Node-specific Next attack paths were not demonstrated here.

Updated the Next/React/RSC/Vinext stack to mature patched releases: Next 16.4.1, React/DOM/RSC
19.3.1, Vinext 1.2.1 and Vite 8.1.6. Zod is now 4.6.7; record schemas use the v4 key/value form.
Removed unused Drizzle and resolver dependencies after checking application and script imports.
Required preview tools remain installed. Security fixes within transitive package lines are pinned
in pnpm-workspace.yaml, including sharp 0.35.5. The unused npm-style overrides block was removed;
pnpm's actual override policy remains in pnpm-workspace.yaml.

The seven-day package release-age policy, trust checks and allowed build scripts remain enabled.
The newest Next 16.4.3 release was blocked by that policy, so the mature security-patched 16.4.1
release was selected instead. No package age check was disabled or exempted.

Validation includes frozen-lockfile installation, typecheck, the application/database tests, lint
and a production Cloudflare build. Re-run `pnpm audit --prod` and `pnpm audit` as part of release
review because registry advisories change over time. Review and remove transitive overrides once
upstream dependencies adopt patched ranges. Do not apply an untested `audit fix --force` upgrade.

Primary notices reviewed:
- https://nextjs.org/blog/nextjs-security-update-october-14-2026
- https://github.com/vercel/next.js/security/advisories/GHSA-vcvr-r3jv-pc5j
- https://github.com/cloudflare/vinext/releases

The remaining build-only fast-uri notices require 3.1.9, published 19 October 2026 and still inside
the repository's seven-day release-age window at this review. Version 3.1.8 is selected meanwhile.
The affected dependency is pulled through webpack's schema validation, not used by public API
URL validation. No exposure to attacker-supplied build configuration was demonstrated. Revisit
3.1.9 after the policy window and repeat installation, audit and all checks. This residual is not
represented as a fully resolved advisory.
