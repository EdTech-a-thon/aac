# AAC

This is a pnpm monorepo containing three distinct apps:

- `manager`: A dashboard web app providing power user access to manage AAC vocabularies on behalf of users.
- `app`: The AAC mobile app
- `api`: A shared api server that both the `manager` and `app` can speak to. Backed by a Supabase database.

Getting started:

```bash
pnpm install # Install all packages for the entire monorepo
pnpm approve-builds # Run necessary postinstall scripts

# Manual: Create files apps/api/.env.local, apps/app/.env.local, and apps/manager/.env.local based on each corresponding .env.template file

pnpm dev # Start all three dev servers simultaneously
# Visit http://localhost:5173/ to view management dashboard
# Visit http://localhost:8081/ for web version of mobile app
```

## Developing

This project is being developed using [Matt Pocock's agent skills](https://www.aihero.dev/skills) (already installed in `.agents/skills`). These skills are configured to create and manage tickets in [this repo's Github Issues](https://github.com/EdTech-a-thon/aac/issues).

This project also has some Supabase skills installed.
