# PipeVault Quick Checklists

This reference keeps the admin and customer journeys tight so new team members can get productive fast. All items assume the Supabase project at `https://cvevhvjxnklbbhtqzyvw.supabase.co` and Gemini API access.

## Admin Setup Checklist

- Confirm environment: `.env` contains `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_GOOGLE_AI_API_KEY`.
- Supabase schema: run `supabase/schema.sql` and `supabase/rls-policies-fix.sql` once per project to seed yards, apply RLS, and allow authenticated customers to register their domain.
- Authentication: create at least one admin account (email/password) and verify it appears in Supabase Auth → Users.
- Test login flows locally with `npm run dev`: ensure admin dashboard renders, global search works, and the approval queue loads live data.
- Gemini sanity check: submit a storage request (mock data is fine) and confirm the AI summary populates in the pending approval card.

## Daily Admin Operations

- Review pending requests (Admin Dashboard → Approvals tab); verify reference ID uniqueness before approval.
- Allocate storage racks when approving: confirm occupancy numbers update in the Storage tab after each decision.
- Record truck movements (Deployments tab) immediately after deliveries or pickups so inventory status stays accurate.
- Monitor capacity: Storage tab shows utilisation; aim to keep utilisation under 80% before assigning new racks.
- AI assistant: for quick context (`Admin AI Assistant` tab) ask for pending counts, rack availability, or high-usage companies.

## Customer Journey Checklist

- Landing page: four cards visible with clear copy; “Request New Pipe Storage” starts without authentication.
- New request flow:
  - Customer completes contact details, pipe specs, and trucking decision.
  - System generates and displays a reference ID, creates the Supabase record, and emails are optional.
  - User is signed up automatically (`email` + `reference ID` password) unless the account already exists.
- Status checks: “Inquire” card prompts for email + reference ID; statuses render (Pending, Approved with location, Rejected with reason).
- Delivery scheduling cards are intentionally gated until the customer has an approved request.

## Deployment Checklist

- Local verification: `npm install`, `npm run build` (resolves TypeScript and Vite warnings), optional `npm run preview`.
- Update configuration: ensure production hosting platform has matching environment variables and Supabase keys.
- Commit and push: GitHub Actions deploys to GitHub Pages; wait for pipeline completion before notifying stakeholders.
- Post-deploy: smoke test the production URL (customer landing, admin login, AI helpers) and confirm Supabase logs update.

Keep this file in sync with operational changes so both admins and customers always have a reliable path through PipeVault.
