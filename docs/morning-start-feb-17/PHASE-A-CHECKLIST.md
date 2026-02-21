# Phase A Checklist — Morning Briefing Verification

> Goal: ARI sends a useful morning briefing via Telegram every day.

## Already Done (From Codebase Audit)

- [x] BriefingGenerator class exists (`src/autonomous/briefings.ts`)
- [x] BriefingGenerator instantiated in autonomous agent (`agent.ts:230`)
- [x] Morning briefing handler registered (`agent.ts:751`)
- [x] Scheduler task defined: `morning-briefing` at 6:30 AM (`scheduler.ts:139`)
- [x] Evening summary handler registered (`agent.ts:760`)
- [x] Weekly review handler registered (`agent.ts:768`)
- [x] NotificationManager exists with multi-channel routing
- [x] Telegram sender exists (`integrations/telegram/sender.ts`)
- [x] NotificationRouter bridges events to Telegram (`autonomous/notification-router.ts`)

## Still Needed

### Verify End-to-End Delivery

- [ ] Confirm NotificationManager routes to Telegram (not old SMS path)
- [ ] Confirm TELEGRAM_BOT_TOKEN set in `~/.ari/.env`
- [ ] Confirm TELEGRAM_OWNER_USER_ID set in `~/.ari/.env`
- [ ] Confirm ANTHROPIC_API_KEY set in `~/.ari/.env`
- [ ] Test: trigger morning briefing manually via CLI
- [ ] Test: verify message appears in Telegram

### Optional Enhancements

- [x] Change briefing time from 7:00 AM to 6:30 AM (per plan preference)
- [ ] Add Intelligence Scanner content to morning briefing
- [ ] Add Life Monitor alerts to morning briefing
- [ ] Add weather/calendar integration (future)

### Deploy to Mac Mini

- [ ] SSH to Mac Mini: `ssh -o ConnectTimeout=10 -i ~/.ssh/id_ed25519 ari@100.81.73.34`
- [ ] Pull latest code
- [ ] Build: `npm run build`
- [ ] Test: `npm test`
- [ ] Install daemon: `npx ari daemon install`
- [ ] Start daemon: `npx ari daemon start`
- [ ] Verify: `npx ari daemon status`
- [ ] Wait for next scheduled briefing to verify

### Verification

- [ ] `npm run build` passes
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] `npm test` — all 4,885+ tests pass
- [ ] Morning briefing arrives on Telegram
