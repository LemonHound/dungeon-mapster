# Adding a New Feature

1. Each feature will be given a new folder in the /features/ folder (found in the root)
2. Each of these folders will have a spec.md file
3. Design conversation: reference CLAUDE.md + provided spec.md, refine the approach
4. Update spec.md with final design, create adr.md if significant changes to architecture will be made
5. Implementation conversation: reference CLAUDE.md + finalized spec.md

# Conversation Preferences

* Keep responses brief. Only provide explanations when requested.
* Never use emojis or comments in code unless explicitly requested.
* Write simple code, use best practice naming conventions.
* Check your work - after each response, review the response and note any potential mistakes or files that should be
  checked for consistency / conflicts.
* Provide suggestions for refactoring, simplification, or modernization. Unless otherwise directed, this should always
  be initiated through a new feature/folder and spec.md file.

# Pull Requests

* Always enable auto-merge (`gh pr merge --auto --squash`) immediately after creating a PR.

# General Instructions

* You will be told if the conversation is either planning or implementation. If not told, ask.
  * For planning, reference "Adding a New Feature" steps 1-4.
  * For implementation, reference "Adding a New Feature" step 5.
* When implementing a new feature, scan the full codebase for existing code to build on. All current code is synced to
  the project files.
* Check your work:
  * Never re-invent the wheel
  * Re-use existing methods and variables when feasible
  * Watch for any potential issues or limitations with the solution provided, and call attention to them. If possible,
    suggest a solution or request clarification.