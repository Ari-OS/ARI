# GitHub Account Reinstatement Appeal

## Send to: <https://support.github.com/contact>

**Subject:** Account Suspension Appeal — Automated False Positive (PryceHedrick)

---

**Your GitHub username:** PryceHedrick

**Message:**

Hi GitHub Support,

My account (PryceHedrick) was suspended today (February 16, 2026). I believe this was triggered by automated abuse detection due to legitimate API activity from my development environment.

**What I was doing:**
I'm building an open-source AI project called ARI (<https://github.com/Ari-OS/ARI>) under my organization Ari-OS. Today I was using the GitHub CLI (`gh`) and GitHub API to:

1. Update repository metadata (description, homepage URL, topics)
2. Update my organization profile README via the API
3. Manage repository settings (social preview image)

These were all legitimate administrative actions on my own repositories and organization. I was making these changes using `gh api` commands from my local development machine (MacBook Air) and a Mac Mini build server.

**Why it may have looked suspicious:**

- Multiple rapid API calls in succession (updating repo metadata, committing to .github repo, checking project settings)
- API calls from two machines (MacBook Air and Mac Mini) using the same authenticated token
- This is the second suspension today — the first was likely the same trigger

**My account details:**

- I'm a solo developer building ARI as a personal AI operating system
- My organization Ari-OS has one repository (ARI) with 88,000+ lines of TypeScript
- I have a legitimate development workflow with CI/CD
- No automated bots or scrapers — just CLI tools (Claude Code, gh CLI)

**Request:**
Please reinstate my account. I'll reduce the rate of API calls going forward. I understand the automated detection is necessary and I'm happy to comply with any rate limiting guidelines.

Thank you for your time.

Best regards,
Pryce Hedrick
GitHub: PryceHedrick
Organization: Ari-OS
Website: prycehedrick.com

---

## Steps to Submit

1. Go to <https://support.github.com/contact>
2. If you can't log in, use: <https://support.github.com/contact?tags=account-recovery>
3. Select "Account Recovery" or "Suspended Account"
4. Copy/paste the message above
5. Submit

## Prevention Going Forward

- Rate limit API calls (no more than 1 per second for management operations)
- Avoid bulk repo/project operations via API
- Use GitHub web UI for sensitive operations (deleting repos, managing projects)
- Consider using a GitHub App token instead of personal token for automation
