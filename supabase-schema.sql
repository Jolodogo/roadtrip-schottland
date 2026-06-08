-- Scotland Roadtrip – Supabase Schema
-- Diesen SQL-Block in deinem Supabase Projekt unter SQL Editor ausführen

-- Posts Tabelle
CREATE TABLE posts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  title       TEXT NOT NULL,
  text        TEXT,
  latitude    FLOAT8 NOT NULL,
  longitude   FLOAT8 NOT NULL,
  image_url   TEXT,
  location_name TEXT,
  day_number  INT
);

-- Öffentliches Lesen erlauben (jeder kann die Karte sehen)
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Jeder kann lesen"
  ON posts FOR SELECT
  USING (true);

-- Schreiben nur via Service Role Key (API Route) – kein direkter Client-Zugriff
-- (kein INSERT policy nötig, da wir den service_role key nutzen)

-- Storage Bucket für Fotos
INSERT INTO storage.buckets (id, name, public)
VALUES ('trip-photos', 'trip-photos', true);

-- Storage: öffentliches Lesen
CREATE POLICY "Öffentliche Fotos lesbar"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'trip-photos');

-- Storage: Uploads nur via Service Role (kein separates Policy nötig)

-- Optional: Realtime für die posts Tabelle aktivieren
-- (Im Supabase Dashboard unter Database → Replication → posts aktivieren)
