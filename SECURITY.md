# Security

This project is a static page: it has no accounts, no server code, no forms and no tracking, and it stores nothing about
visitors (the browser keeps only whether the introduction, or on phones the offer of the tour, was already seen; an amount
or a search typed on a phone stays on the phone and is sent nowhere). The page loads only its own files and sets a
Content Security Policy that blocks everything else.

To report a vulnerability, please use GitHub's **private vulnerability reporting** (the "Report a vulnerability" button
under the repository's *Security* tab) rather than a public issue.

In scope: the page in `docs/`, the build and verification code in `src/`, the workflow in `.github/`. Errors in figures
are not security issues; please report them in a public issue so that everyone can see the correction.
