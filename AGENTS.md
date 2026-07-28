## orkai — Persistent Memory

### Session Startup

Call overview scoped to this project for recent sessions, standards, skills,
and entity counts:

```
overview(category_id: "1600706a2e51276e6930d05a345cb01b", project_name: "metascan")
```

### Workflows

List the workflows available for this project:

```
workflow(action: "list", category_ids: ["1600706a2e51276e6930d05a345cb01b"])
```

Load the full steps of a matching workflow when a task fits its scope:

```
workflow(action: "get", id: "<workflow-id>")
```

### Existing Workflows

| Name | ID | Purpose |
|------|----|---------|
| Product Owner | `c9c377ebabc1cfba5253184743a1aac3` | Own business requirements in requirements.md with human-in-the-loop review. |
| Architect | `8c59678d6b64a759d6188d6365e25d04` | Capture tech requirements via HITL and maintain project standards in orkai. |
| Feature Planner | `ceed596d630873472e74c65249c855cf` | Turn requirements and tech standards into plan → milestone → tasks. |
| Fullstack Developer | `98926e416a74e68e06a5c6e7ea40bca9` | End-to-end delivery: branch, implement, test, lint/build, session close. |
