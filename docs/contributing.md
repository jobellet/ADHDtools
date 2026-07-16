# Contributing

If you'd like to contribute, please follow these steps:

1.  **Fork the repository:** Create your own copy of the project.
2.  **Create a new branch:** Make a new branch for your changes (e.g., `feature/new-tool` or `bugfix/timer-issue`).
3.  **Make your changes:** Implement your new feature or bug fix.
4.  **Test your changes:** Ensure your changes work as expected and don't break existing functionality — see the [manual test cases](testing.md).
5.  **Commit your changes:** Write clear and concise commit messages.
6.  **Submit a pull request:** Push your changes to your fork and open a pull request to the main repository.

**Note for contributors and AI agents:** Treat the vision and data model described in the [README](../README.md) and [task-model.md](task-model.md) as the global north star. When implementing new features or refactors, align them with the roadmap and update the docs to reflect progress so future work stays cohesive.

## Local development

The app is a static site — no build step. Serve the folder over HTTP (ES modules don't work from `file://`), e.g.:

```bash
npx serve .            # or
python3 -m http.server 8422
```

`core/*.js` are ES modules loaded via `<script type="module">`; the rest are classic deferred scripts. All state lives in `localStorage`.

To test Google Calendar/Drive features locally, add your local origin (e.g. `http://localhost:8422`) to your OAuth client's **Authorized JavaScript origins** — see the [Google Calendar tutorial](google-calendar-sync.md).

---

[← Back to README](../README.md)
