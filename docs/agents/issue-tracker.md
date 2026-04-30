# Issue tracker: GitHub

Issues and PRDs for this repo live as GitHub issues in **`randowha/ai-heroes`**. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Always target the fork: pass `--repo randowha/ai-heroes` explicitly, or run inside the clone where `origin` points at the fork.

## When a skill says "publish to the issue tracker"

Create a GitHub issue in `randowha/ai-heroes`.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments --repo randowha/ai-heroes`.
