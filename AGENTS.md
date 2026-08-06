# AGENTS.md
## Project
KlipCode is a web app for creating and storing code snippets, both privately on your local device and in the cloud, letting you sync your snippets across your devices.
More than an alternative to other code snippet tools, this project focuses on being a lightweight, minimalist alternative to Notion for developers.
This repository is a VERY EARLY WIP. Proposing sweeping changes that improve long-term maintainability is encouraged.
## Product priorities
- Access and copy a snippet's content ASAP, with no friction.
- Create snippets ASAP, with no friction.
- Move through the app quickly and comfortably through excellent performance and UX.
- Modern, professional, clean UI inspired by Vercel and Linear.
## Maintainability
Long term maintainability is a core priority. If you add new functionality, first check if there is shared logic that can be extracted to a separate module. Duplicate logic across multiple files is a code smell and should be avoided. Don't be afraid to change existing code. Don't take shortcuts by just adding local logic to solve a problem.
