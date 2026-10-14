# Local security fork of braces 3.0.3

Source: https://github.com/micromatch/braces/tree/3.0.3 (npm braces@3.0.3).
Original MIT license and attribution are preserved. This is a private project fork,
not an upstream release. Only the package metadata and the depth checks differ.

GHSA-vfj7-8cjw-p6xm has no patched upstream release as of 2026-10-13.
The parser rejects more than 64 nested brace/parenthesis blocks before constructing
a deeply nested AST. compile, expand and stringify also validate supplied ASTs
iteratively before entering upstream recursive walkers. Repeated node references
(including cycles) are rejected; parent/prev backlinks are not traversed.
The failure is a bounded SyntaxError with code ERR_BRACES_DEPTH. Options cannot
disable the guard. Ordinary syntax, rangeLimit and maxLength keep upstream behavior.

This patch addresses recursive stack exhaustion; it does not claim unlimited
expansion is safe. Keep upstream rangeLimit and treat glob patterns as configuration.
Replace this fork with a verified upstream security release when one becomes
available, and rerun npm run check:security plus the complete project validation.

The checked-in .tgz is used by npm overrides for reproducible, integrity-checked
installs without symlinks. Repack changes using npm pack ./vendor/braces
--pack-destination ./vendor and update the lockfile. check:security verifies that
the installed source exactly matches this directory, including the license.
