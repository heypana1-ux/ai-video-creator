-- =============================================================================
-- AdReel AI - Supabase seed
--
-- Creates a brand kit and one example project for an existing auth user.
-- Run AFTER the user has signed up once (auth.users must already contain them):
--   psql "$DATABASE_URL" -v user_email="'du@example.com'" -f supabase/seed.sql
--
-- For the local demo store use `npm run seed` instead.
-- =============================================================================

\set ON_ERROR_STOP on

do $$
declare
  target_user uuid;
  target_workspace uuid;
  new_project uuid;
  new_concept uuid;
begin
  select id into target_user from auth.users order by created_at limit 1;
  if target_user is null then
    raise exception 'Kein Benutzer in auth.users gefunden. Bitte zuerst registrieren.';
  end if;

  insert into public.users (id, email, display_name)
  select target_user, email, coalesce(raw_user_meta_data ->> 'display_name', split_part(email, '@', 1))
  from auth.users where id = target_user
  on conflict (id) do nothing;

  select id into target_workspace from public.workspaces where owner_id = target_user limit 1;
  if target_workspace is null then
    insert into public.workspaces (owner_id, name, credits, onboarded_at)
    values (target_user, 'AdReel Demo-Studio', 500, now())
    returning id into target_workspace;
  end if;

  insert into public.subscriptions (workspace_id, plan, status, credits_per_month)
  values (target_workspace, 'demo', 'active', 500)
  on conflict (workspace_id) do nothing;

  insert into public.brand_kits
    (workspace_id, name, primary_color, secondary_color, accent_color, font_family)
  values
    (target_workspace, 'NOVA Nightdrive', '#8B5CF6', '#EC4899', '#38BDF8', 'Inter');

  insert into public.projects (workspace_id, owner_id, name, category, status, duration_seconds, brief)
  values (
    target_workspace,
    target_user,
    'Midnight Drive – Release-Kampagne',
    'music',
    'draft',
    15,
    jsonb_build_object(
      'category', 'music',
      'name', 'Midnight Drive – Release-Kampagne',
      'description', 'Neue Synthwave-Single über nächtliche Autofahrten.',
      'audience', 'Synthwave-Hörer zwischen 18 und 34',
      'goal', 'Streams am Release-Tag',
      'platform', 'tiktok',
      'language', 'de',
      'tone', 'emotional',
      'durationSeconds', 15,
      'callToAction', 'Jetzt überall streamen',
      'targetUrl', '',
      'logoAssetId', null,
      'brandColors', '[]'::jsonb,
      'mediaAssetIds', '[]'::jsonb,
      'styleId', 'music_visualizer',
      'extraPrompt', '',
      'details', jsonb_build_object(
        'artistName', 'NOVA',
        'songTitle', 'Midnight Drive',
        'genre', 'Synthwave',
        'mood', 'melancholisch, treibend',
        'releaseDate', '14. März',
        'streamingUrl', '',
        'audioAssetId', null,
        'coverAssetId', null,
        'lyricsExcerpt', 'Ich fahr durch die Nacht. Die Stadt schläft schon.',
        'songSectionStart', 0,
        'songSectionEnd', 30,
        'rightsConfirmed', true
      )
    )
  )
  returning id into new_project;

  insert into public.concepts
    (workspace_id, project_id, title, big_idea, hook, call_to_action, caption, hashtags, style_id, is_demo)
  values (
    target_workspace,
    new_project,
    'Release-Teaser: „Midnight Drive“',
    'Harter Einstieg auf den Drop, danach Cover, Artist und Release-Datum.',
    'Dieser Part von „Midnight Drive“ geht nicht mehr aus dem Kopf.',
    'Jetzt überall streamen',
    'NOVA – Midnight Drive. 14. März überall verfügbar.',
    '["#fyp","#newmusic","#synthwave"]'::jsonb,
    'music_visualizer',
    true
  )
  returning id into new_concept;

  insert into public.scenes
    (workspace_id, project_id, concept_id, index, duration_ms, title, source, text, transition, effect, voiceover_text)
  values
    (target_workspace, new_project, new_concept, 0, 4000, 'Drop-Einstieg',
     '{"kind":"color_gradient","assetId":null,"url":null,"prompt":"","gradient":["#1E1B4B","#701A75","#BE185D"],"isDemo":true}'::jsonb,
     '{"content":"Ton an.","subline":"NOVA – Midnight Drive","fontFamily":"Inter","fontSize":86,"color":"#FFFFFF","position":"center","animation":"pop"}'::jsonb,
     'none', 'pulse', ''),
    (target_workspace, new_project, new_concept, 1, 6000, 'Hook-Zeile',
     '{"kind":"color_gradient","assetId":null,"url":null,"prompt":"","gradient":["#701A75","#BE185D","#1E1B4B"],"isDemo":true}'::jsonb,
     '{"content":"Ich fahr durch die Nacht","subline":"Synthwave","fontFamily":"Inter","fontSize":70,"color":"#FFFFFF","position":"lower_third","animation":"word_by_word"}'::jsonb,
     'fade', 'pulse', ''),
    (target_workspace, new_project, new_concept, 2, 5000, 'CTA',
     '{"kind":"color_gradient","assetId":null,"url":null,"prompt":"","gradient":["#BE185D","#1E1B4B","#701A75"],"isDemo":true}'::jsonb,
     '{"content":"Jetzt überall streamen","subline":"14. März","fontFamily":"Inter","fontSize":74,"color":"#FFFFFF","position":"center","animation":"pop"}'::jsonb,
     'flash', 'pulse', 'Jetzt überall streamen.');

  raise notice 'Seed abgeschlossen für Workspace %', target_workspace;
end;
$$;
