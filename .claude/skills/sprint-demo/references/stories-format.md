# Sprint stories file

One YAML file per sprint: `demo/sprints/sprint-<N>.yaml`.

```yaml
sprint: 2                         # number, used for the file name sprint-2.demo.ts
name: Sprint 2                    # display name
goal: Shipping details are saved  # shown under the title on the opening card
app: http://localhost:6006/       # where the demo runs (Storybook)

stories:
  - id: HP-7                      # tracker key, shown as the caption badge
    title: Save shipping information
    status: Done                  # only Done stories are demoed
    acceptance:                   # one demo step (caption + action + assertion) each
      - When I save valid shipping details, then I see a confirmation
      - When the name is missing, then I'm asked to fill it in
    notes: Optional context for the demo, e.g. known limitations to mention on screen
```

## Mapping from trackers (for when the file is generated)

| File field | Jira | Azure DevOps |
|---|---|---|
| `sprint`, `name` | Sprint (board's active or chosen sprint) | Iteration path |
| `goal` | Sprint goal | Iteration description (or ask) |
| `id` | Issue key (`HP-7`) | Work item ID (`#1234`) |
| `title` | Summary | Title |
| `status` | Status category "Done" | State "Done" / "Closed" / "Resolved" |
| `acceptance` | Acceptance-criteria field, or the description's "Acceptance criteria" list | `Microsoft.VSTS.Common.AcceptanceCriteria` (HTML; one item per list entry) |
| `notes` | (optional) | (optional) |

Include only stories (or user stories / product backlog items), not sub-tasks or bugs, unless the
user asks for bugs to be shown.
