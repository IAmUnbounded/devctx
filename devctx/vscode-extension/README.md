# DevContext for VS Code

DevContext is a CLI tool and VS Code extension for persistent AI coding context. It helps you maintain context across sessions, tools, and team members.

## Features

- **Auto-Capture**: Automatically captures context when you save files.
- **Save Context**: Manually save context with structured data (Task, Approaches, Decisions, State, Next Steps, Blockers).
- **Resume Context**: Resume context from previous sessions.
- **Log**: View session history.
- **Diff**: View changes since last save.

## Requirements

- DevContext CLI installed globally or locally (`npm install -g devctx`).
- Git initialized in the workspace.

## Extension Settings

This extension contributes the following settings:

* `devctx.autoResume`: Enable/disable auto-resume on startup.
* `devctx.defaultBranch`: Default branch to track context for.

## Known Issues

See GitHub repository for current issues.

## Release Notes

### 0.5.0

Initial release of DevContext VS Code extension.
