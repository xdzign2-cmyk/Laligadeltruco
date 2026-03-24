---
description: Activates the "Sistema 4x4" protocol: Supabase DB Protection (Blindado), Local ZIP Backup (Respaldo), and GitHub Cloud Sync.
---

# Sistema 4x4 Protocol (Corrected)

This workflow executes the comprehensive backup and security protocol as defined by the user:

1.  **Sistema Blindado (Supabase DB)**
    - Verifies and secures the critical SQL backup files (`backups/SISTEMA_BLINDADO_2026.sql`, `backups/GARANTIA_REALTIME_2026.sql`).
    - Ensures these "Shield" files are included in the commits.

2.  **Respaldo Local (Source Code)**
    - Creates a compressed timestamped ZIP archive of the `src` directory to `backups/`.

3.  **GitHub Cloud Backup**
    - Stages all changes (Code + SQL Shield files + Zips).
    - Commits with the "Sistema 4x4" security tag.
    - Pushes to `origin main`.

## Execution Steps

1. (Implicit) Ensure SQL backups are ready (user usually manages these, but we ensure they are committed).
// turbo
2. Create the local zip backup of source code.
// turbo
3. Stage SQL files, Zip backup, and Source code.
// turbo
4. Commit and Push to GitHub.
