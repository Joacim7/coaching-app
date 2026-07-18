-- ============================================================
-- RECIPE SEED — 50 Norwegian recipes
-- Run AFTER migration 014_recipe_meal_types.sql
-- Deletes existing seed recipes and re-inserts corrected ones.
-- AI-generated recipes (is_ai_generated = true) are NOT deleted.
--
-- After seeding, fetch Pexels images for all imageless recipes:
--   POST /api/recipes/backfill-images
-- This stores one fixed image_url per recipe in the DB.
-- ============================================================

DO $$
DECLARE cid UUID;
BEGIN
  SELECT id INTO cid FROM public.profiles WHERE role = 'coach' LIMIT 1;
  IF cid IS NULL THEN
    RAISE EXCEPTION 'No coach profile found. Create a coach account first.';
  END IF;

  DELETE FROM public.recipes WHERE meal_type ILIKE 'kveldsmat';
  DELETE FROM public.recipes WHERE is_ai_generated = false;

  INSERT INTO public.recipes (
    coach_id, title, meal_type, is_ai_generated, servings,
    ingredients, instructions,
    calories_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving
  ) VALUES

  -- ── FROKOST (10) ─────────────────────────────────────────────────────────────

  (cid, 'Havregryn med banan og mandler', 'Frokost', false, 1,
   '[{"name":"Havregryn","amount_g":80,"calories_per_100g":370,"protein_per_100g":13,"carbs_per_100g":58,"fat_per_100g":7,"source":"approved"},{"name":"Banan, rå","amount_g":100,"calories_per_100g":89,"protein_per_100g":1,"carbs_per_100g":21,"fat_per_100g":0,"source":"approved"},{"name":"Mandel, tørket","amount_g":20,"calories_per_100g":579,"protein_per_100g":21,"carbs_per_100g":22,"fat_per_100g":50,"source":"approved"}]'::jsonb,
   '["Kok havregryn med vann i 4 minutter under omrøring.", "Server i en bolle og topp med skivede bananer og mandler."]',
   501, 15.6, 71.8, 15.6),

  (cid, 'Havregryn med blåbær og honning', 'Frokost', false, 1,
   '[{"name":"Havregryn","amount_g":80,"calories_per_100g":370,"protein_per_100g":13,"carbs_per_100g":58,"fat_per_100g":7,"source":"approved"},{"name":"Blåbær, rå","amount_g":100,"calories_per_100g":56,"protein_per_100g":1,"carbs_per_100g":13,"fat_per_100g":1,"source":"approved"},{"name":"Honning","amount_g":15,"calories_per_100g":304,"protein_per_100g":0,"carbs_per_100g":82,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok havregryn med vann i 4 minutter.", "Hell i en bolle, topp med blåbær og dryss over honning."]',
   398, 11.4, 71.7, 6.6),

  (cid, 'Gresk yoghurt med jordbær og granola', 'Frokost', false, 1,
   '[{"name":"Gresk yoghurt, 10% fett","amount_g":200,"calories_per_100g":97,"protein_per_100g":10,"carbs_per_100g":4,"fat_per_100g":5,"source":"approved"},{"name":"Jordbær, rå","amount_g":100,"calories_per_100g":33,"protein_per_100g":1,"carbs_per_100g":7,"fat_per_100g":0,"source":"approved"},{"name":"Granola","amount_g":40,"calories_per_100g":410,"protein_per_100g":8,"carbs_per_100g":58,"fat_per_100g":17,"source":"approved"}]'::jsonb,
   '["Ha gresk yoghurt i en bolle.", "Topp med friske jordbær og granola. Server umiddelbart."]',
   391, 24.2, 38.2, 16.8),

  (cid, 'Gresk yoghurt med blåbær og honning', 'Frokost', false, 1,
   '[{"name":"Gresk yoghurt, 10% fett","amount_g":200,"calories_per_100g":97,"protein_per_100g":10,"carbs_per_100g":4,"fat_per_100g":5,"source":"approved"},{"name":"Blåbær, rå","amount_g":120,"calories_per_100g":56,"protein_per_100g":1,"carbs_per_100g":13,"fat_per_100g":1,"source":"approved"},{"name":"Honning","amount_g":10,"calories_per_100g":304,"protein_per_100g":0,"carbs_per_100g":82,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Ha gresk yoghurt i en bolle.", "Topp med blåbær og dryss over honning."]',
   292, 21.2, 31.8, 11.2),

  (cid, 'Cottage cheese med banan', 'Frokost', false, 1,
   '[{"name":"Cottage cheese","amount_g":200,"calories_per_100g":98,"protein_per_100g":11,"carbs_per_100g":4,"fat_per_100g":4,"source":"approved"},{"name":"Banan, rå","amount_g":120,"calories_per_100g":89,"protein_per_100g":1,"carbs_per_100g":21,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Ha cottage cheese i en bolle.", "Skjær bananen i skiver og legg på toppen."]',
   303, 23.2, 33.2, 8.0),

  (cid, 'Egg og rugbrød', 'Frokost', false, 1,
   '[{"name":"Egg, høne, rå","amount_g":120,"calories_per_100g":155,"protein_per_100g":13,"carbs_per_100g":1,"fat_per_100g":11,"source":"approved"},{"name":"Rugbrød","amount_g":60,"calories_per_100g":220,"protein_per_100g":7,"carbs_per_100g":41,"fat_per_100g":3,"source":"approved"}]'::jsonb,
   '["Stek eggene i en panne med litt olje til hviten er stivnet.", "Server på rugbrødskiver."]',
   318, 19.8, 25.8, 15.0),

  (cid, 'Havregryn med kvarg og jordbær', 'Frokost', false, 1,
   '[{"name":"Havregryn","amount_g":60,"calories_per_100g":370,"protein_per_100g":13,"carbs_per_100g":58,"fat_per_100g":7,"source":"approved"},{"name":"Kvarg","amount_g":100,"calories_per_100g":67,"protein_per_100g":11,"carbs_per_100g":5,"fat_per_100g":0,"source":"approved"},{"name":"Jordbær, rå","amount_g":100,"calories_per_100g":33,"protein_per_100g":1,"carbs_per_100g":7,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok havregryn med vann i 4 minutter.", "Server i en bolle og topp med kvarg og friske jordbær."]',
   322, 19.8, 46.8, 4.2),

  (cid, 'Müsli med helmelk', 'Frokost', false, 1,
   '[{"name":"Müsli","amount_g":70,"calories_per_100g":380,"protein_per_100g":10,"carbs_per_100g":65,"fat_per_100g":9,"source":"approved"},{"name":"Helmelk","amount_g":200,"calories_per_100g":61,"protein_per_100g":3.4,"carbs_per_100g":5,"fat_per_100g":3,"source":"approved"}]'::jsonb,
   '["Hell müsli i en dyp bolle.", "Hell over kald helmelk og la stå ett minutt før servering."]',
   388, 13.8, 55.5, 12.3),

  (cid, 'Rugbrød med røkelaks og kremost', 'Frokost', false, 1,
   '[{"name":"Rugbrød","amount_g":80,"calories_per_100g":220,"protein_per_100g":7,"carbs_per_100g":41,"fat_per_100g":3,"source":"approved"},{"name":"Røkelaks","amount_g":60,"calories_per_100g":190,"protein_per_100g":20,"carbs_per_100g":0,"fat_per_100g":12,"source":"approved"},{"name":"Kremost, Philadelphia","amount_g":20,"calories_per_100g":342,"protein_per_100g":7,"carbs_per_100g":2,"fat_per_100g":34,"source":"approved"}]'::jsonb,
   '["Smør kremost på rugbrødskivene.", "Legg røkelaks på toppen og server."]',
   358, 19.0, 33.2, 16.4),

  (cid, 'Kvarg med blåbær og mandler', 'Frokost', false, 1,
   '[{"name":"Kvarg","amount_g":200,"calories_per_100g":67,"protein_per_100g":11,"carbs_per_100g":5,"fat_per_100g":0,"source":"approved"},{"name":"Blåbær, rå","amount_g":80,"calories_per_100g":56,"protein_per_100g":1,"carbs_per_100g":13,"fat_per_100g":1,"source":"approved"},{"name":"Mandel, tørket","amount_g":20,"calories_per_100g":579,"protein_per_100g":21,"carbs_per_100g":22,"fat_per_100g":50,"source":"approved"}]'::jsonb,
   '["Ha kvarg i en bolle.", "Topp med blåbær og mandler."]',
   295, 27.0, 24.8, 10.8),

  -- ── LUNSJ (10) ───────────────────────────────────────────────────────────────

  (cid, 'Rugbrød med makrell i tomat', 'Lunsj', false, 1,
   '[{"name":"Rugbrød","amount_g":80,"calories_per_100g":220,"protein_per_100g":7,"carbs_per_100g":41,"fat_per_100g":3,"source":"approved"},{"name":"Makrell, hermetisk i tomat","amount_g":120,"calories_per_100g":170,"protein_per_100g":16,"carbs_per_100g":3,"fat_per_100g":10,"source":"approved"}]'::jsonb,
   '["Legg rugbrødskiver på en tallerken.", "Fordel makrell i tomat jevnt over brødskivene og server."]',
   380, 24.8, 36.4, 14.4),

  (cid, 'Wrap med kyllingbryst og avokado', 'Lunsj', false, 1,
   '[{"name":"Tortilla, hvete","amount_g":60,"calories_per_100g":310,"protein_per_100g":8,"carbs_per_100g":53,"fat_per_100g":8,"source":"approved"},{"name":"Kyllingbryst, rå","amount_g":150,"calories_per_100g":165,"protein_per_100g":23,"carbs_per_100g":0,"fat_per_100g":8,"source":"approved"},{"name":"Avokado","amount_g":80,"calories_per_100g":160,"protein_per_100g":2,"carbs_per_100g":2,"fat_per_100g":16,"source":"approved"}]'::jsonb,
   '["Stek kyllingbryst i panne til gjennomstekt og skjær i strimler.", "Legg kylling og skivede avokadoer i wrapen, rull godt sammen og skjær i to."]',
   562, 40.9, 33.4, 29.6),

  (cid, 'Rugbrød med tunfisk og agurk', 'Lunsj', false, 1,
   '[{"name":"Rugbrød","amount_g":80,"calories_per_100g":220,"protein_per_100g":7,"carbs_per_100g":41,"fat_per_100g":3,"source":"approved"},{"name":"Tunfisk, hermetisk i vann","amount_g":100,"calories_per_100g":116,"protein_per_100g":25,"carbs_per_100g":0,"fat_per_100g":2,"source":"approved"},{"name":"Agurk, rå","amount_g":80,"calories_per_100g":15,"protein_per_100g":0.7,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Legg rugbrødskiver på en tallerken.", "Fordel tunfisk over brødskivene og topp med skivede agurker."]',
   304, 31.2, 35.2, 4.4),

  (cid, 'Pitabrød med hummus og paprika', 'Lunsj', false, 1,
   '[{"name":"Pitabrød","amount_g":80,"calories_per_100g":265,"protein_per_100g":8,"carbs_per_100g":52,"fat_per_100g":3,"source":"approved"},{"name":"Hummus","amount_g":80,"calories_per_100g":166,"protein_per_100g":8,"carbs_per_100g":14,"fat_per_100g":10,"source":"approved"},{"name":"Paprika, rød, rå","amount_g":100,"calories_per_100g":31,"protein_per_100g":1,"carbs_per_100g":6,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Varm pitabrødet lett i brødrister eller ovn.", "Smør hummus inni pitalommen og fyll med skivede paprikastriper."]',
   376, 13.8, 58.8, 10.4),

  (cid, 'Rugbrød med skinke og norvegia ost', 'Lunsj', false, 1,
   '[{"name":"Rugbrød","amount_g":80,"calories_per_100g":220,"protein_per_100g":7,"carbs_per_100g":41,"fat_per_100g":3,"source":"approved"},{"name":"Skinke, kokt","amount_g":60,"calories_per_100g":145,"protein_per_100g":18,"carbs_per_100g":2,"fat_per_100g":7,"source":"approved"},{"name":"Norvegia, 27 %","amount_g":20,"calories_per_100g":370,"protein_per_100g":27,"carbs_per_100g":0,"fat_per_100g":29,"source":"approved"}]'::jsonb,
   '["Legg skinke og osteskiver på rugbrødskivene.", "Server umiddelbart."]',
   337, 21.8, 34.0, 12.4),

  (cid, 'Wrap med tunfisk og salat', 'Lunsj', false, 1,
   '[{"name":"Tortilla, hvete","amount_g":60,"calories_per_100g":310,"protein_per_100g":8,"carbs_per_100g":53,"fat_per_100g":8,"source":"approved"},{"name":"Tunfisk, hermetisk i vann","amount_g":120,"calories_per_100g":116,"protein_per_100g":25,"carbs_per_100g":0,"fat_per_100g":2,"source":"approved"},{"name":"Salat, isbergsalat","amount_g":60,"calories_per_100g":14,"protein_per_100g":1.4,"carbs_per_100g":2,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Fordel tunfisk og salat over wrapen.", "Rull godt sammen og skjær i to."]',
   334, 35.6, 33.0, 7.2),

  (cid, 'Knekkebrød med kremost og røkelaks', 'Lunsj', false, 1,
   '[{"name":"Knekkebrød, mørkt","amount_g":40,"calories_per_100g":370,"protein_per_100g":10,"carbs_per_100g":69,"fat_per_100g":6,"source":"approved"},{"name":"Kremost, Philadelphia","amount_g":30,"calories_per_100g":342,"protein_per_100g":7,"carbs_per_100g":2,"fat_per_100g":34,"source":"approved"},{"name":"Røkelaks","amount_g":60,"calories_per_100g":190,"protein_per_100g":20,"carbs_per_100g":0,"fat_per_100g":12,"source":"approved"}]'::jsonb,
   '["Smør kremost på knekkebrødene.", "Legg røkelaks på toppen og server."]',
   365, 18.1, 28.2, 19.8),

  (cid, 'Grovbrød med egg og tomat', 'Lunsj', false, 1,
   '[{"name":"Grovbrød","amount_g":80,"calories_per_100g":220,"protein_per_100g":8,"carbs_per_100g":39,"fat_per_100g":3,"source":"approved"},{"name":"Egg, høne, rå","amount_g":120,"calories_per_100g":155,"protein_per_100g":13,"carbs_per_100g":1,"fat_per_100g":11,"source":"approved"},{"name":"Tomat, rå","amount_g":100,"calories_per_100g":18,"protein_per_100g":0.9,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Stek eggene i panne til de er gjennomstekte.", "Server på grovbrødskiver med skivede tomater."]',
   380, 22.9, 35.4, 15.6),

  (cid, 'Rugbrød med makrell og agurk', 'Lunsj', false, 1,
   '[{"name":"Rugbrød","amount_g":60,"calories_per_100g":220,"protein_per_100g":7,"carbs_per_100g":41,"fat_per_100g":3,"source":"approved"},{"name":"Makrell, hermetisk i tomat","amount_g":120,"calories_per_100g":170,"protein_per_100g":16,"carbs_per_100g":3,"fat_per_100g":10,"source":"approved"},{"name":"Agurk, rå","amount_g":80,"calories_per_100g":15,"protein_per_100g":0.7,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Legg makrell i tomat på rugbrødskivene.", "Topp med skivede agurker og server."]',
   348, 24.0, 30.6, 13.8),

  (cid, 'Pitabrød med kyllingbryst og salat', 'Lunsj', false, 1,
   '[{"name":"Pitabrød","amount_g":80,"calories_per_100g":265,"protein_per_100g":8,"carbs_per_100g":52,"fat_per_100g":3,"source":"approved"},{"name":"Kyllingbryst, rå","amount_g":120,"calories_per_100g":165,"protein_per_100g":23,"carbs_per_100g":0,"fat_per_100g":8,"source":"approved"},{"name":"Salat, isbergsalat","amount_g":60,"calories_per_100g":14,"protein_per_100g":1.4,"carbs_per_100g":2,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Stek kyllingbryst til gjennomstekt og skjær i strimler.", "Varm pitabrødet og fyll med kylling og fersk salat."]',
   418, 34.8, 42.8, 12.0),

  -- ── MIDDAG (15) ──────────────────────────────────────────────────────────────

  (cid, 'Kyllingbryst med ris og brokkoli', 'Middag', false, 1,
   '[{"name":"Kyllingbryst, rå","amount_g":180,"calories_per_100g":165,"protein_per_100g":23,"carbs_per_100g":0,"fat_per_100g":8,"source":"approved"},{"name":"Ris, hvit, rå","amount_g":80,"calories_per_100g":360,"protein_per_100g":7,"carbs_per_100g":81,"fat_per_100g":1,"source":"approved"},{"name":"Brokkoli, rå","amount_g":150,"calories_per_100g":34,"protein_per_100g":3,"carbs_per_100g":5,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Stek kyllingbryst i panne med litt olje, 6-7 minutter per side.", "Kok ris etter anvisning og kok brokkoli i lettsaltet vann i 5 minutter.", "Anrett kylling, ris og brokkoli på en tallerken."]',
   636, 51.5, 72.3, 15.2),

  (cid, 'Laks med potet og brokkoli', 'Middag', false, 1,
   '[{"name":"Laks, oppdrettet, rå","amount_g":180,"calories_per_100g":208,"protein_per_100g":20,"carbs_per_100g":0,"fat_per_100g":14,"source":"approved"},{"name":"Potet, rå","amount_g":200,"calories_per_100g":77,"protein_per_100g":2,"carbs_per_100g":17,"fat_per_100g":0,"source":"approved"},{"name":"Brokkoli, rå","amount_g":150,"calories_per_100g":34,"protein_per_100g":3,"carbs_per_100g":5,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok poteter i saltet vann i 20 minutter.", "Stek laksefileten i panne med litt olje, 4 minutter per side.", "Server med poteter og kokt brokkoli."]',
   579, 44.5, 41.5, 25.2),

  (cid, 'Kjøttdeig med pasta og tomat', 'Middag', false, 1,
   '[{"name":"Kjøttdeig, storfe, rå","amount_g":150,"calories_per_100g":200,"protein_per_100g":18,"carbs_per_100g":0,"fat_per_100g":14,"source":"approved"},{"name":"Pasta, hvit, rå","amount_g":80,"calories_per_100g":370,"protein_per_100g":12,"carbs_per_100g":76,"fat_per_100g":2,"source":"approved"},{"name":"Tomat, rå","amount_g":100,"calories_per_100g":18,"protein_per_100g":0.9,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok pasta etter anvisning på pakken.", "Stek kjøttdeig i panne og tilsett hakkede tomater, la surre i 5 minutter.", "Bland pasta med kjøttsausen og server."]',
   614, 37.5, 63.8, 22.6),

  (cid, 'Torsk med potet og gulrot', 'Middag', false, 1,
   '[{"name":"Torsk, filet, rå","amount_g":200,"calories_per_100g":82,"protein_per_100g":18,"carbs_per_100g":0,"fat_per_100g":1,"source":"approved"},{"name":"Potet, rå","amount_g":200,"calories_per_100g":77,"protein_per_100g":2,"carbs_per_100g":17,"fat_per_100g":0,"source":"approved"},{"name":"Gulrot, rå","amount_g":100,"calories_per_100g":41,"protein_per_100g":1,"carbs_per_100g":9,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok poteter og gulrøtter i lettsaltet vann i 20 minutter.", "Stek torskefileten i panne med smør, 3-4 minutter per side.", "Server med kokte poteter og gulrøtter."]',
   359, 41.0, 43.0, 2.0),

  (cid, 'Kyllingbryst med søtpotet og spinat', 'Middag', false, 1,
   '[{"name":"Kyllingbryst, rå","amount_g":180,"calories_per_100g":165,"protein_per_100g":23,"carbs_per_100g":0,"fat_per_100g":8,"source":"approved"},{"name":"Søtpotet, rå","amount_g":200,"calories_per_100g":86,"protein_per_100g":2,"carbs_per_100g":19,"fat_per_100g":0,"source":"approved"},{"name":"Spinat, rå","amount_g":80,"calories_per_100g":23,"protein_per_100g":2.9,"carbs_per_100g":2,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Skjær søtpotet i terninger og ovnsbak ved 200 grader i 25 minutter.", "Stek kyllingbryst i panne til gjennomstekt og wok spinat raskt i olje.", "Anrett alt på en tallerken og server."]',
   487, 47.7, 39.6, 14.4),

  (cid, 'Biff med potet og asparges', 'Middag', false, 1,
   '[{"name":"Storfekjøtt, indrefilet, rå","amount_g":180,"calories_per_100g":150,"protein_per_100g":22,"carbs_per_100g":0,"fat_per_100g":7,"source":"approved"},{"name":"Potet, rå","amount_g":200,"calories_per_100g":77,"protein_per_100g":2,"carbs_per_100g":17,"fat_per_100g":0,"source":"approved"},{"name":"Asparges, rå","amount_g":100,"calories_per_100g":20,"protein_per_100g":2,"carbs_per_100g":4,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok poteter i saltet vann i 20 minutter.", "Stek biffen i varm panne, 3 minutter per side for medium rosa.", "Server med kokte poteter og grillet asparges."]',
   444, 45.6, 38.0, 12.6),

  (cid, 'Karbonadedeig med ris og blomkål', 'Middag', false, 1,
   '[{"name":"Karbonadedeig, storfe","amount_g":180,"calories_per_100g":135,"protein_per_100g":20,"carbs_per_100g":0,"fat_per_100g":6,"source":"approved"},{"name":"Ris, hvit, rå","amount_g":80,"calories_per_100g":360,"protein_per_100g":7,"carbs_per_100g":81,"fat_per_100g":1,"source":"approved"},{"name":"Blomkål, rå","amount_g":150,"calories_per_100g":25,"protein_per_100g":1.9,"carbs_per_100g":4,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok ris etter anvisning på pakken.", "Form karbonader og stek i panne, 5 minutter per side.", "Server med ris og kokt blomkål."]',
   569, 44.5, 70.8, 11.6),

  (cid, 'Laks med fullkornsris og zucchini', 'Middag', false, 1,
   '[{"name":"Laks, oppdrettet, rå","amount_g":180,"calories_per_100g":208,"protein_per_100g":20,"carbs_per_100g":0,"fat_per_100g":14,"source":"approved"},{"name":"Ris, fullkorn, rå","amount_g":80,"calories_per_100g":350,"protein_per_100g":8,"carbs_per_100g":74,"fat_per_100g":3,"source":"approved"},{"name":"Zucchini, rå","amount_g":150,"calories_per_100g":17,"protein_per_100g":1,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok fullkornsris etter anvisning, ca. 30 minutter.", "Stek laksen i panne med litt olje, 4 minutter per side.", "Stek zucchini i strimler og server alt sammen."]',
   680, 43.9, 63.7, 27.6),

  (cid, 'Tunfisk med pasta og brokkoli', 'Middag', false, 1,
   '[{"name":"Tunfisk, hermetisk i vann","amount_g":150,"calories_per_100g":116,"protein_per_100g":25,"carbs_per_100g":0,"fat_per_100g":2,"source":"approved"},{"name":"Pasta, hvit, rå","amount_g":80,"calories_per_100g":370,"protein_per_100g":12,"carbs_per_100g":76,"fat_per_100g":2,"source":"approved"},{"name":"Brokkoli, rå","amount_g":150,"calories_per_100g":34,"protein_per_100g":3,"carbs_per_100g":5,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok pasta og brokkoli sammen i lettsaltet vann etter anvisning.", "Sil av vannet og vend inn tunfisk.", "Server varm med litt olivenolje om ønskelig."]',
   521, 51.6, 68.3, 4.6),

  (cid, 'Ørret med potet og gulrot', 'Middag', false, 1,
   '[{"name":"Ørret, oppdrettet, rå","amount_g":180,"calories_per_100g":175,"protein_per_100g":20,"carbs_per_100g":0,"fat_per_100g":11,"source":"approved"},{"name":"Potet, rå","amount_g":200,"calories_per_100g":77,"protein_per_100g":2,"carbs_per_100g":17,"fat_per_100g":0,"source":"approved"},{"name":"Gulrot, rå","amount_g":100,"calories_per_100g":41,"protein_per_100g":1,"carbs_per_100g":9,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok poteter og gulrøtter i lettsaltet vann i 20 minutter.", "Stek ørretfileten i panne med smør, 4 minutter per side.", "Server med kokte poteter og gulrøtter."]',
   510, 41.0, 43.0, 19.8),

  (cid, 'Kyllingbryst med pasta og paprika', 'Middag', false, 1,
   '[{"name":"Kyllingbryst, rå","amount_g":180,"calories_per_100g":165,"protein_per_100g":23,"carbs_per_100g":0,"fat_per_100g":8,"source":"approved"},{"name":"Pasta, hvit, rå","amount_g":80,"calories_per_100g":370,"protein_per_100g":12,"carbs_per_100g":76,"fat_per_100g":2,"source":"approved"},{"name":"Paprika, rød, rå","amount_g":100,"calories_per_100g":31,"protein_per_100g":1,"carbs_per_100g":6,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Stek kyllingbryst og paprika i strimler i panne med olje.", "Kok pasta etter anvisning og sil av.", "Bland pasta med kylling og paprika og server."]',
   624, 52.0, 66.8, 16.0),

  (cid, 'Kalkun med fullkornsris og spinat', 'Middag', false, 1,
   '[{"name":"Kalkun, bryst, rå","amount_g":180,"calories_per_100g":120,"protein_per_100g":24,"carbs_per_100g":0,"fat_per_100g":2,"source":"approved"},{"name":"Ris, fullkorn, rå","amount_g":80,"calories_per_100g":350,"protein_per_100g":8,"carbs_per_100g":74,"fat_per_100g":3,"source":"approved"},{"name":"Spinat, rå","amount_g":80,"calories_per_100g":23,"protein_per_100g":2.9,"carbs_per_100g":2,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Stek kalkunbryst i panne til gjennomstekt, 5-6 minutter per side.", "Kok fullkornsris etter anvisning.", "Wok spinat raskt i litt olje og server alt på en tallerken."]',
   514, 51.9, 60.8, 6.0),

  (cid, 'Sei med søtpotet og brokkoli', 'Middag', false, 1,
   '[{"name":"Sei, rå","amount_g":180,"calories_per_100g":80,"protein_per_100g":18,"carbs_per_100g":0,"fat_per_100g":1,"source":"approved"},{"name":"Søtpotet, rå","amount_g":200,"calories_per_100g":86,"protein_per_100g":2,"carbs_per_100g":19,"fat_per_100g":0,"source":"approved"},{"name":"Brokkoli, rå","amount_g":150,"calories_per_100g":34,"protein_per_100g":3,"carbs_per_100g":5,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Skjær søtpotet i terninger og ovnsbak ved 200 grader i 25 minutter.", "Stek seien i panne med smør, 3-4 minutter per side.", "Server med ovnsbakt søtpotet og kokt brokkoli."]',
   367, 40.9, 45.5, 1.8),

  (cid, 'Kjøttdeig med potet og løk', 'Middag', false, 1,
   '[{"name":"Kjøttdeig, storfe, rå","amount_g":150,"calories_per_100g":200,"protein_per_100g":18,"carbs_per_100g":0,"fat_per_100g":14,"source":"approved"},{"name":"Potet, rå","amount_g":200,"calories_per_100g":77,"protein_per_100g":2,"carbs_per_100g":17,"fat_per_100g":0,"source":"approved"},{"name":"Løk, rå","amount_g":80,"calories_per_100g":40,"protein_per_100g":1,"carbs_per_100g":9,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Stek løk i panne med litt olje til myk og gyllenbrun.", "Tilsett kjøttdeig og stek til gjennomstekt, ca. 8 minutter.", "Server med kokte poteter."]',
   486, 31.8, 41.2, 21.0),

  (cid, 'Torsk med byggryner og gulrot', 'Middag', false, 1,
   '[{"name":"Torsk, filet, rå","amount_g":200,"calories_per_100g":82,"protein_per_100g":18,"carbs_per_100g":0,"fat_per_100g":1,"source":"approved"},{"name":"Byggryner","amount_g":80,"calories_per_100g":350,"protein_per_100g":10,"carbs_per_100g":72,"fat_per_100g":2,"source":"approved"},{"name":"Gulrot, rå","amount_g":100,"calories_per_100g":41,"protein_per_100g":1,"carbs_per_100g":9,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Kok byggryner i lettsaltet vann i 20-25 minutter.", "Kok gulrøtter til møre og stek torsk i panne, 3-4 minutter per side.", "Anrett alt på en tallerken og server."]',
   485, 45.0, 66.6, 3.6),

  -- ── SNACK (8) ────────────────────────────────────────────────────────────────

  (cid, 'Gresk yoghurt med honning', 'Snack', false, 1,
   '[{"name":"Gresk yoghurt, 10% fett","amount_g":150,"calories_per_100g":97,"protein_per_100g":10,"carbs_per_100g":4,"fat_per_100g":5,"source":"approved"},{"name":"Honning","amount_g":15,"calories_per_100g":304,"protein_per_100g":0,"carbs_per_100g":82,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Ha gresk yoghurt i en bolle.", "Dryss over honning og server."]',
   191, 15.0, 18.3, 7.5),

  (cid, 'Banan med mandler', 'Snack', false, 1,
   '[{"name":"Banan, rå","amount_g":130,"calories_per_100g":89,"protein_per_100g":1,"carbs_per_100g":21,"fat_per_100g":0,"source":"approved"},{"name":"Mandel, tørket","amount_g":25,"calories_per_100g":579,"protein_per_100g":21,"carbs_per_100g":22,"fat_per_100g":50,"source":"approved"}]'::jsonb,
   '["Skjær bananen i skiver.", "Server med mandler ved siden av."]',
   260, 6.6, 32.8, 12.5),

  (cid, 'Cottage cheese med eple', 'Snack', false, 1,
   '[{"name":"Cottage cheese","amount_g":150,"calories_per_100g":98,"protein_per_100g":11,"carbs_per_100g":4,"fat_per_100g":4,"source":"approved"},{"name":"Eple, rå","amount_g":150,"calories_per_100g":52,"protein_per_100g":0.3,"carbs_per_100g":14,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Ha cottage cheese i en bolle.", "Skjær eplet i biter og legg på toppen."]',
   225, 17.0, 27.0, 6.0),

  (cid, 'Knekkebrød med hummus', 'Snack', false, 1,
   '[{"name":"Knekkebrød, mørkt","amount_g":30,"calories_per_100g":370,"protein_per_100g":10,"carbs_per_100g":69,"fat_per_100g":6,"source":"approved"},{"name":"Hummus","amount_g":60,"calories_per_100g":166,"protein_per_100g":8,"carbs_per_100g":14,"fat_per_100g":10,"source":"approved"}]'::jsonb,
   '["Legg knekkebrød på en tallerken.", "Fordel hummus jevnt over knekkebrødene."]',
   211, 7.8, 29.1, 7.8),

  (cid, 'Kvarg med blåbær', 'Snack', false, 1,
   '[{"name":"Kvarg","amount_g":150,"calories_per_100g":67,"protein_per_100g":11,"carbs_per_100g":5,"fat_per_100g":0,"source":"approved"},{"name":"Blåbær, rå","amount_g":100,"calories_per_100g":56,"protein_per_100g":1,"carbs_per_100g":13,"fat_per_100g":1,"source":"approved"}]'::jsonb,
   '["Ha kvarg i en bolle.", "Topp med friske blåbær."]',
   157, 17.5, 20.5, 1.0),

  (cid, 'Eple med peanøtter', 'Snack', false, 1,
   '[{"name":"Eple, rå","amount_g":150,"calories_per_100g":52,"protein_per_100g":0.3,"carbs_per_100g":14,"fat_per_100g":0,"source":"approved"},{"name":"Peanøtt, tørket","amount_g":25,"calories_per_100g":567,"protein_per_100g":26,"carbs_per_100g":16,"fat_per_100g":49,"source":"approved"}]'::jsonb,
   '["Skjær eplet i båter.", "Server med peanøtter til dypping."]',
   220, 7.0, 25.0, 12.3),

  (cid, 'Gresk yoghurt med bringebær', 'Snack', false, 1,
   '[{"name":"Gresk yoghurt, 10% fett","amount_g":150,"calories_per_100g":97,"protein_per_100g":10,"carbs_per_100g":4,"fat_per_100g":5,"source":"approved"},{"name":"Bringebær, rå","amount_g":100,"calories_per_100g":52,"protein_per_100g":1,"carbs_per_100g":12,"fat_per_100g":1,"source":"approved"}]'::jsonb,
   '["Ha gresk yoghurt i en bolle.", "Topp med friske bringebær og server."]',
   198, 16.0, 18.0, 8.5),

  (cid, 'Gulrot med hummus', 'Snack', false, 1,
   '[{"name":"Gulrot, rå","amount_g":150,"calories_per_100g":41,"protein_per_100g":1,"carbs_per_100g":9,"fat_per_100g":0,"source":"approved"},{"name":"Hummus","amount_g":80,"calories_per_100g":166,"protein_per_100g":8,"carbs_per_100g":14,"fat_per_100g":10,"source":"approved"}]'::jsonb,
   '["Skjær gulrøtter i strimler.", "Dypp i hummus og server."]',
   194, 7.9, 24.7, 8.0),

  -- ── KVELDSMAT (7) — lett kveldsmat 150–280 kcal ─────────────────────────────
  -- knekkebrød 25g, rugbrød 50g, ost 15g, skinke 30-50g, kremost 15-20g

  (cid, 'Knekkebrød med norvegia ost og skinke', 'Kveldsmat', false, 1,
   '[{"name":"Knekkebrød, mørkt","amount_g":25,"calories_per_100g":370,"protein_per_100g":10,"carbs_per_100g":69,"fat_per_100g":6,"source":"approved"},{"name":"Norvegia, 27 %","amount_g":15,"calories_per_100g":370,"protein_per_100g":27,"carbs_per_100g":0,"fat_per_100g":29,"source":"approved"},{"name":"Skinke, kokt","amount_g":30,"calories_per_100g":145,"protein_per_100g":18,"carbs_per_100g":2,"fat_per_100g":7,"source":"approved"}]'::jsonb,
   '["Legg osteskiver og skinke på knekkebrødene.", "Server umiddelbart."]',
   192, 12.0, 17.9, 8.0),

  (cid, 'Rugbrød med skinke og tomat', 'Kveldsmat', false, 1,
   '[{"name":"Rugbrød","amount_g":50,"calories_per_100g":220,"protein_per_100g":7,"carbs_per_100g":41,"fat_per_100g":3,"source":"approved"},{"name":"Skinke, kokt","amount_g":50,"calories_per_100g":145,"protein_per_100g":18,"carbs_per_100g":2,"fat_per_100g":7,"source":"approved"},{"name":"Tomat, rå","amount_g":80,"calories_per_100g":18,"protein_per_100g":0.9,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Legg skinke på rugbrødskivene.", "Topp med skivede tomater og server."]',
   197, 13.2, 23.9, 5.0),

  (cid, 'Cottage cheese med agurk', 'Kveldsmat', false, 1,
   '[{"name":"Cottage cheese","amount_g":150,"calories_per_100g":98,"protein_per_100g":11,"carbs_per_100g":4,"fat_per_100g":4,"source":"approved"},{"name":"Agurk, rå","amount_g":80,"calories_per_100g":15,"protein_per_100g":0.7,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Ha cottage cheese i en bolle.", "Skjær agurk i skiver og legg ved siden av."]',
   159, 17.1, 8.4, 6.0),

  (cid, 'Knekkebrød med kremost og agurk', 'Kveldsmat', false, 1,
   '[{"name":"Knekkebrød, mørkt","amount_g":30,"calories_per_100g":370,"protein_per_100g":10,"carbs_per_100g":69,"fat_per_100g":6,"source":"approved"},{"name":"Kremost, Philadelphia","amount_g":20,"calories_per_100g":342,"protein_per_100g":7,"carbs_per_100g":2,"fat_per_100g":34,"source":"approved"},{"name":"Agurk, rå","amount_g":80,"calories_per_100g":15,"protein_per_100g":0.7,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Smør kremost på knekkebrødene.", "Topp med skivede agurker og server."]',
   191, 5.0, 23.5, 8.6),

  (cid, 'Rugbrød med røkelaks og kremost', 'Kveldsmat', false, 1,
   '[{"name":"Rugbrød","amount_g":50,"calories_per_100g":220,"protein_per_100g":7,"carbs_per_100g":41,"fat_per_100g":3,"source":"approved"},{"name":"Røkelaks","amount_g":50,"calories_per_100g":190,"protein_per_100g":20,"carbs_per_100g":0,"fat_per_100g":12,"source":"approved"},{"name":"Kremost, Philadelphia","amount_g":15,"calories_per_100g":342,"protein_per_100g":7,"carbs_per_100g":2,"fat_per_100g":34,"source":"approved"}]'::jsonb,
   '["Smør kremost på rugbrødskivene.", "Legg røkelaks på toppen og server."]',
   256, 14.6, 20.8, 12.6),

  (cid, 'Kvarg med jordbær', 'Kveldsmat', false, 1,
   '[{"name":"Kvarg","amount_g":150,"calories_per_100g":67,"protein_per_100g":11,"carbs_per_100g":5,"fat_per_100g":0,"source":"approved"},{"name":"Jordbær, rå","amount_g":100,"calories_per_100g":33,"protein_per_100g":1,"carbs_per_100g":7,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Ha kvarg i en bolle.", "Topp med ferske jordbær."]',
   134, 17.5, 14.5, 0.0),

  (cid, 'Grovbrød med norvegia ost og tomat', 'Kveldsmat', false, 1,
   '[{"name":"Grovbrød","amount_g":50,"calories_per_100g":220,"protein_per_100g":8,"carbs_per_100g":39,"fat_per_100g":3,"source":"approved"},{"name":"Norvegia, 27 %","amount_g":15,"calories_per_100g":370,"protein_per_100g":27,"carbs_per_100g":0,"fat_per_100g":29,"source":"approved"},{"name":"Tomat, rå","amount_g":80,"calories_per_100g":18,"protein_per_100g":0.9,"carbs_per_100g":3,"fat_per_100g":0,"source":"approved"}]'::jsonb,
   '["Legg osteskiver på grovbrødskivene.", "Topp med skivede tomater og server."]',
   180, 8.8, 21.9, 5.9);

  -- Fix Ytt Proteinyoghurt per-100g values in any existing recipes (AI-generated or seeded)
  -- that were stored with the old Matvaretabellen fallback values (65 kcal / 10g P / 4g C / 1g F).
  UPDATE public.recipes
  SET ingredients = (
    SELECT jsonb_agg(
      CASE
        WHEN (ing->>'name') ILIKE '%proteinyoghurt%'
          THEN ing || jsonb_build_object(
            'calories_per_100g', 67,
            'protein_per_100g',  9.2,
            'carbs_per_100g',    3.2,
            'fat_per_100g',      1.8
          )
        ELSE ing
      END
    )
    FROM jsonb_array_elements(recipes.ingredients) ing
  )
  WHERE ingredients::text ILIKE '%proteinyoghurt%';

  -- Stamp smart unit/unit_amount on all seed ingredients
  UPDATE public.recipes
  SET ingredients = (
    SELECT jsonb_agg(
      CASE
        WHEN (ing->>'name') ILIKE '%egg%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 60)))
        WHEN (ing->>'name') ILIKE '%knekkebrød%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 10)))
        WHEN (ing->>'name') ILIKE '%rugbrød%' OR (ing->>'name') ILIKE '%grovbrød%' OR (ing->>'name') ILIKE '%brødskive%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 35)))
        WHEN (ing->>'name') ILIKE '%banan%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 120)))
        WHEN (ing->>'name') ILIKE '%appelsin%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 150)))
        WHEN (ing->>'name') ILIKE '%eple%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 150)))
        WHEN (ing->>'name') ILIKE '%skinkeskive%' OR (ing->>'name') ILIKE '%skinke%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 6)))
        WHEN (ing->>'name') ILIKE '%salamiskive%' OR (ing->>'name') ILIKE '%salami%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 6)))
        WHEN (ing->>'name') ILIKE '%osteskive%' OR (ing->>'name') ILIKE '%norvegia%' OR (ing->>'name') ILIKE '%jarlsberg%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 12)))
        WHEN (ing->>'name') ILIKE '%ost%' AND (ing->>'name') NOT ILIKE '%toast%'
          THEN ing || jsonb_build_object('unit', 'stk', 'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 12)))
        WHEN (ing->>'name') ILIKE '%yoghurt%' OR (ing->>'name') ILIKE '%melk%'
          THEN ing || jsonb_build_object('unit', 'dl',  'unit_amount', ROUND(((ing->>'amount_g')::numeric / 100)::numeric, 1))
        WHEN (ing->>'name') ILIKE '%olje%'
          THEN ing || jsonb_build_object('unit', 'ss',  'unit_amount', GREATEST(1, ROUND((ing->>'amount_g')::numeric / 15)))
        ELSE
          ing || jsonb_build_object('unit', 'g', 'unit_amount', (ing->>'amount_g')::numeric)
      END
    )
    FROM jsonb_array_elements(recipes.ingredients) ing
  )
  WHERE is_ai_generated = false;

END;
$$;
