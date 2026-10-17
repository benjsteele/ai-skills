# Skills

Project skills for Claude Code live here, one directory per skill:

```
.claude/skills/
└── <skill-name>/
    ├── SKILL.md        # required: YAML frontmatter (name, description) + instructions
    └── ...             # optional: scripts, references, templates
```

Minimal `SKILL.md`:

```markdown
---
name: my-skill
description: What the skill does and when Claude should use it.
---

# My Skill

Instructions for Claude go here.
```
