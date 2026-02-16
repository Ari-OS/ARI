# ARI Commit Setup

Guide for configuring ARI's GitHub identity for commits.

## Bot Account (Recommended)

1. Create a GitHub account for ARI (e.g., `ARI-Assistant`)
2. Upload the triple-helix iris avatar
3. Get the account's noreply email: `<id>+ARI-Assistant@users.noreply.github.com`

## Configuration

Add to `.claude/settings.local.json`:

```json
{
  "ariCommitAuthor": {
    "name": "ARI",
    "email": "<id>+ARI-Assistant@users.noreply.github.com"
  }
}
```

## Avatar Specifications

- **Size**: 460x460 pixels minimum
- **Format**: PNG with transparency or JPG
- **Theme**: Triple-helix iris design matching ARI's identity

## Verification

After setup, test with:
```bash
git log --format='%an <%ae> | %cn <%ce>' -1
```
