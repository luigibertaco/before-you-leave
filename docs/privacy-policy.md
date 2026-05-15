# Privacy Policy — Before You Leave

**Last updated:** May 15, 2026

## Overview

Before You Leave is a Chrome extension that adds a confirmation step to the Google Meet "Leave call" button with one-click meeting summarization via Meet's built-in Gemini feature.

## Data Collection

**Before You Leave does not collect, transmit, or store any personal data.**

- No analytics or telemetry
- No tracking pixels or cookies
- No network requests of any kind
- No access to your Google account, microphone, camera, or browsing history

## Permissions

The extension requests a single permission:

- **`storage`** — Used exclusively to save your custom prompt templates. Templates are synced across your Chrome devices via Chrome's built-in sync mechanism. No data is sent to any third-party server.

The extension runs only on `https://meet.google.com/*` and has no access to any other websites.

## How It Works

The extension operates entirely within your browser:

1. A content script runs on Google Meet pages to detect the "Leave call" button
2. A lock overlay is injected over the button to prevent accidental hang-ups
3. When clicked, a confirmation dialog offers options to stay, leave, or summarize the meeting via Meet's built-in Gemini sidebar
4. All prompt templates are stored locally in Chrome's sync storage

No meeting content, transcripts, or summaries leave your browser through this extension. The summarization feature uses Google Meet's own Gemini integration — the extension simply automates clicking the Gemini button and entering a prompt.

## Open Source

Before You Leave is open source under the MIT License. You can inspect every line of code at [github.com/luigibertaco/before-you-leave](https://github.com/luigibertaco/before-you-leave).

## Contact

For questions about this privacy policy, open an issue on the [GitHub repository](https://github.com/luigibertaco/before-you-leave/issues).

## Changes

Any changes to this privacy policy will be reflected in this document with an updated date. The full change history is available in the repository's git log.
