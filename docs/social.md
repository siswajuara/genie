# Website social API

The complete implementation and documentation have moved to the website repository:

- [Reference index](../../website/genie-references/README.md)
- [Full setup, API contract, packages, credentials, provider mappings, and deployment guide](../../website/genie-references/social-api/README.md)
- [Supabase SQL migration](../../website/genie-references/social-api/supabase/migrations/202610230001_social_api.sql)

Genie's social client calls your website API. Configure its URL and user-scoped token in **Setting → Social accounts → Your website API**. Provider keys are saved encrypted by the website. The desktop stores only its website token in the OS credential vault; browser previews keep that token in memory.

Publish, schedules, saved social drafts, insights, and community data belong to the website database. Codex, chat history, Canvas documents, pages, frames, and Canvas versions remain local. Selected frame exports are uploaded as social media assets using signed Supabase Storage URLs; Canvas source JSON is not uploaded.

The Next.js routes, provider adapter, cron worker, SQL migration, environment template, token script, and provider tests now live under `website/genie-references/social-api`. Desktop transport files remain in this application, with snapshots in the reference folder. Adapt the migration's Supabase Auth ownership to the website's custom authentication/Drizzle model before deployment. No database migration or live publishing was performed.
