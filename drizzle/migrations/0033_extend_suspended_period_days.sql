CREATE OR REPLACE FUNCTION public.extend_suspended_period(_p text) RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path TO 'public' AS $$
DECLARE m text[]; y int; mo int; ey int; em int; s date; e date;
BEGIN
  m := regexp_match(trim(coalesce(_p,'')), '(\d{2,3})/(\d{1,2})(?:/(\d{1,2}))?\s*[-~～－至]\s*(\d{2,3})/(\d{1,2})(?:/(\d{1,2}))?$');
  IF m IS NULL THEN RETURN NULL; END IF;
  IF m[6] IS NOT NULL THEN
    s := make_date(m[4]::int + 1911, m[5]::int, m[6]::int) + 1;
    e := (s + interval '1 year')::date - 1;
    RETURN (extract(year from s)::int - 1911) || '/' || extract(month from s)::int || '/' || extract(day from s)::int || '-' ||
           (extract(year from e)::int - 1911) || '/' || extract(month from e)::int || '/' || extract(day from e)::int;
  END IF;
  y := m[4]::int; mo := m[5]::int + 1;
  IF mo > 12 THEN mo := 1; y := y + 1; END IF;
  ey := y + 1; em := mo - 1;
  IF em < 1 THEN em := 12; ey := ey - 1; END IF;
  RETURN y || '/' || mo || '-' || ey || '/' || em;
END $$;