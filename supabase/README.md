# Supabase Setup

1. Create a new project at https://supabase.com
2. Go to **SQL Editor** and run these migrations in order:
   - `migrations/001_schema.sql`
   - `migrations/002_rls.sql`
3. Copy your project URL and anon key from **Settings → API**
4. Add to `apps/web/.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ANTHROPIC_API_KEY=your-anthropic-key
   ```
5. Add to `apps/mobile/.env.local`:
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```
