-- Add demonstration video URLs to the most common standard exercises.
-- Sources: AthleanX, Jeff Nippard, Alan Thrall (verified real, existing videos).

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=hWbUlkb5Ms4'
  WHERE name = 'Benkpress' AND is_standard = true AND video_url IS NULL;

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=Yw3s1JTExkU'
  WHERE name = 'Knebøy' AND is_standard = true AND video_url IS NULL;

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=Y1IGeJEXpF4'
  WHERE name = 'Markløft' AND is_standard = true AND video_url IS NULL;

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=_RlRDWO2jfg'
  WHERE name = 'Skulderpress' AND is_standard = true AND video_url IS NULL;

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=swkOeoEcKW0'
  WHERE name = 'Pull-ups' AND is_standard = true AND video_url IS NULL;

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=KS-1_r9K4XA'
  WHERE name = 'Bicepscurl' AND is_standard = true AND video_url IS NULL;

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=popGXI-qs98'
  WHERE name = 'Triceps Pressdown' AND is_standard = true AND video_url IS NULL;

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=7BkgqzC6WsM'
  WHERE name = 'Sittende roing' AND is_standard = true AND video_url IS NULL;

UPDATE public.exercises SET video_url = 'https://www.youtube.com/watch?v=5Qlke0pZ6d4'
  WHERE name = 'Utfall' AND is_standard = true AND video_url IS NULL;
