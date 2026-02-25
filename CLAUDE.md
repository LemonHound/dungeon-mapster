# Adding a New Feature

1. Each feature will be given a new folder in the /features/ folder (found in the root)
2. Each of these folders will have a spec.md file
3. Design conversation: reference CLAUDE.md + provided spec.md, refine the approach
4. Update spec.md with final design, create adr.md if significant changes to architecture will be made
5. Implementation conversation: reference CLAUDE.md + finalized spec.md

# Conversation Preferences

* Keep responses brief. Only provide explanations when requested.
* Never use emojis or comments in code, unless explicitly requested.
* Write simple code, use best practice naming conventions.
* Check your work - after each response, review the response and note any potential mistakes or files that should be
  checked for consistency / conflicts.
* Provide suggestions for refactoring, simplification, or modernization. Unless otherwise directed, this should always
  be initiated through a new feature/folder and spec.md file.