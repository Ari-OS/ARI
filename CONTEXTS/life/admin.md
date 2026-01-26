# 📋 ADMIN — LIFE CONTEXT
## Personal Administration & Organization

**Context Type:** Life Domain  
**Load Trigger:** Operator mentions tasks, appointments, scheduling, organization, errands, paperwork  
**Version:** 12.0.0  
**Partition:** LIFE_ADMIN

---

## SCOPE

- Task management and prioritization
- Calendar coordination
- Document organization
- Appointment scheduling
- Reminder systems
- Errand tracking
- General life admin

---

## TASK MANAGEMENT PRINCIPLES

### Priority Framework
1. **Urgent + Important** — Do now
2. **Important + Not Urgent** — Schedule
3. **Urgent + Not Important** — Delegate or batch
4. **Neither** — Eliminate or defer

### Operator Preferences
- Clear priorities in the morning
- Focus blocks for deep work
- End of day: log outcomes, set up tomorrow
- Batch similar tasks
- Say no to almost everything

---

## MEMORY PARTITION

```json
{
  "partition": "LIFE_ADMIN",
  "sensitivity": "INTERNAL",
  "retention": "task_completion + 30d"
}
```

---

*Context loaded for general administrative tasks.*
