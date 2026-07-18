-- ============================================================
-- ØVELSESBIBLIOTEK (Exercise Library)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.exercises (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id       UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL = standard exercise
  name           TEXT NOT NULL,
  description    TEXT,
  instructions   TEXT,
  muscle_groups  TEXT[] NOT NULL DEFAULT '{}',
  video_url      TEXT,
  thumbnail_url  TEXT,
  is_standard    BOOLEAN NOT NULL DEFAULT false,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercises_coach   ON public.exercises(coach_id);
CREATE INDEX IF NOT EXISTS idx_exercises_std     ON public.exercises(is_standard);
CREATE INDEX IF NOT EXISTS idx_exercises_muscles ON public.exercises USING GIN(muscle_groups);

ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Standard exercises are readable by everyone logged in.
-- Coach exercises are readable/writable only by the owning coach.
CREATE POLICY "Read standard exercises"
  ON public.exercises FOR SELECT
  USING (is_standard = true);

CREATE POLICY "Coaches read and write own exercises"
  ON public.exercises FOR ALL
  USING (coach_id = auth.uid());

-- ── Standard exercises seed ───────────────────────────────────────────────────

INSERT INTO public.exercises (name, description, instructions, muscle_groups, is_standard) VALUES

-- Bryst
('Benkpress',
 'Klassisk brystøvelse med stang på flat benk.',
 'Legg deg på benken med føttene flatt i gulvet. Ta grep litt bredere enn skulderbredde. Senk stangen kontrollert til brystet og press tilbake til utgangsposisjon med låste albuer i toppen.',
 ARRAY['Bryst', 'Skuldre', 'Armer'], true),

('Skråbenkpress',
 'Benkpress i oppadgående vinkel som treffer øvre bryst.',
 'Sett benken til 30–45°. Utfør bevegelsen som flat benkpress, men fokuser på å kjenne trekket i øvre brystmuskel.',
 ARRAY['Bryst', 'Skuldre'], true),

('Push-ups',
 'Kroppsvektøvelse for bryst, skuldre og triceps.',
 'Plasser hendene litt bredere enn skulderbredde. Hold kroppen rett som en planke. Senk brystet mot gulvet og press opp.',
 ARRAY['Bryst', 'Skuldre', 'Armer'], true),

('Kabelflyes',
 'Isolasjonsøvelse for brystmuskelen med kabel.',
 'Stå midt mellom to kabelstasjoner. Dra kablene fremover og inn mot midten i en bueformet bevegelse. Squeeze brystet i sluttposisjon.',
 ARRAY['Bryst'], true),

('Dips',
 'Kroppsvektøvelse for bryst og triceps.',
 'Hold deg oppe i parallellstengene. Lut deg litt fremover for mer brystaktivering. Senk deg til albuen er 90°, press opp.',
 ARRAY['Bryst', 'Armer'], true),

-- Rygg
('Markløft',
 'Grunnleggende sammensatt løft for rygg og bein.',
 'Stå med stangen over midtfoten, grip litt bredere enn hoftene. Hold ryggen rett, stram kjernen og løft ved å strekke hofter og knær samtidig.',
 ARRAY['Rygg', 'Bein'], true),

('Pull-ups',
 'Klassisk ryggøvelse med kroppsvekt.',
 'Heng i baren med overhåndsgrep. Trekk deg opp til haken er over baren ved å aktivere latissimusmusklene. Senk kontrollert.',
 ARRAY['Rygg', 'Armer'], true),

('Nedtrekk',
 'Nedtrekk i kabelmaskin – god alternativ til pull-ups.',
 'Sitt i maskinen med lårputen på plass. Grip stangen litt bredere enn skulderbredde. Trekk ned til brystet og la stangen gå kontrollert opp.',
 ARRAY['Rygg', 'Armer'], true),

('Sittende roing',
 'Horisontalt trekk for midtre rygg.',
 'Sitt oppreist med lett bøyde knær. Trekk håndtaket inn mot navlen ved å klemme skulderbladsene sammen. Hold ryggen rett gjennom hele bevegelsen.',
 ARRAY['Rygg', 'Skuldre'], true),

('Enparms hantelroing',
 'Unilateral ryggøvelse som gir god rekkevidde.',
 'Støtt den ene hånden og kneet på benken. Hold ryggen parallell med gulvet. Trekk hantelen opp mot hoften og senk kontrollert.',
 ARRAY['Rygg', 'Armer'], true),

-- Skuldre
('Skulderpress',
 'Grunnøvelse for hele deltoidmusklene.',
 'Sitt eller stå med hantlene i ørehøyde, albuene ca. 90°. Press rett opp til armene er nesten strake og senk kontrollert.',
 ARRAY['Skuldre', 'Armer'], true),

('Sidehev',
 'Isolerer sidedeltoidene for bredere skuldre.',
 'Hold hantlene langs siden. Løft til sidene til armene er parallelle med gulvet med lett bøyde albuer. Senk sakte.',
 ARRAY['Skuldre'], true),

('Frontalhev',
 'Trener fremre del av skuldermuskelen.',
 'Hold hantlene foran lårene. Løft en arm om gangen rett frem til skulderbredde. Kontroller nedsenkningen.',
 ARRAY['Skuldre'], true),

('Face Pull',
 'Trener bakre deltoid og rotatormansjett.',
 'Sett kabelen i hodehøyde med tauehåndtak. Trekk mot ansiktet med albuene høyt til side. Hold posisjonen et sekund og slipp kontrollert.',
 ARRAY['Skuldre', 'Rygg'], true),

-- Armer
('Bicepscurl',
 'Isolasjonsøvelse for biceps.',
 'Stand med hantler langs siden, håndflatene fremover. Curl hantlene opp til skulderbredde ved å bøye i albuen. Senk kontrollert.',
 ARRAY['Armer'], true),

('Hammer Curl',
 'Curl-variasjon som trener brachialis og underarm.',
 'Som bicepscurl men med nøytralt grep (håndflatene mot hverandre). Curl opp og senk kontrollert.',
 ARRAY['Armer'], true),

('Triceps Pressdown',
 'Kabeløvelse for triceps med tauehåndtak.',
 'Stand foran kabelmaskinen med tauet i ca. brysthøyde. Hold overarmene inntil kroppen og press ned til armene er strake. Slipp sakte opp.',
 ARRAY['Armer'], true),

('Trisepsstrekk over hodet',
 'Strekker den lange hodet av triceps effektivt.',
 'Sett på ett tauehåndtak bak hodet i kabelmaskinen. Hold overarmene loddrette og strekk armene opp. Senk kontrollert.',
 ARRAY['Armer'], true),

-- Bein
('Knebøy',
 'Dronningen av beinøvelser – trener hele underkroppen.',
 'Stå med skulderbredde mellom føttene, tærne litt ut. Senk deg ved å bøye knær og hofter simultaneously til låret er parallelt med gulvet. Press opp gjennom hælene.',
 ARRAY['Bein'], true),

('Beinpress',
 'Maskinbasert beinøvelse, lett å justere vekt.',
 'Sett opp rygglenet, plasser føttene skulderbredde på platen. Slipp bremsen og senk kontrollert til knærne er rundt 90°. Press tilbake.',
 ARRAY['Bein'], true),

('Utfall',
 'Unilateral øvelse for lårmuskler og glutes.',
 'Ta et langt skritt fremover. Senk bakre kne mot gulvet til fremre lår er parallelt. Press tilbake til startposisjon med fremre fot.',
 ARRAY['Bein'], true),

('Leg Curl',
 'Isolasjonsøvelse for hamstrings.',
 'Legg deg i maskinen med rullene bak hælene. Curl beina mot setet og senk kontrollert. Hold hoftene inntil puten.',
 ARRAY['Bein'], true),

('Romanian Deadlift',
 'Hip-hinge-bevegelse for hamstrings og glutes.',
 'Hold stangen foran lårene, bena lett bøyde. Bøy i hoften og send stangen ned langs bena til du kjenner strekk i hamstrings. Press hoften frem tilbake til start.',
 ARRAY['Bein', 'Rygg'], true),

-- Mage/Core
('Planken',
 'Statisk kjerneøvelse som aktiverer hele magemuskelen.',
 'Legg deg i push-up-posisjon men hvil på underarmene. Hold kroppen rett som en planke. Trekk navlen inn mot ryggsøylen. Hold posisjonen.',
 ARRAY['Mage/Core'], true),

('Crunches',
 'Grunnleggende øvelse for rectus abdominis.',
 'Legg deg på ryggen med bøyde knær. Plasser hendene bak hodet. Løft skuldrene 30–45° fra gulvet ved å krumme ryggen. Senk kontrollert.',
 ARRAY['Mage/Core'], true),

('Benhev',
 'Trener nedre magemuskulatur.',
 'Heng i en stang eller ligg på en benk. Hold bena strake og løft til 90° mot gulvet. Senk sakte uten å svinge.',
 ARRAY['Mage/Core'], true),

('Russian Twist',
 'Rotasjonsøvelse for skrå magemuskulatur.',
 'Sitt på gulvet med bena lett hevet, overkroppen lent litt bakover. Roter overkroppen til sidene og berør gulvet med hendene. Bruk medisinball for ekstra motstand.',
 ARRAY['Mage/Core'], true),

('Ab Wheel Rollout',
 'Avansert kjerneøvelse med ab-hjul.',
 'Kneel med ab-hjulet foran deg. Rull fremover så langt du klarer mens du holder ryggen rett og kjernen spent. Rull tilbake ved å kontrahere magen.',
 ARRAY['Mage/Core'], true);
