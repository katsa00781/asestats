-- Korábbi szezonok hozzáadása

-- 2024/2025 szezon (előző, 1 évvel ezelőtt)
INSERT INTO seasons (name, start_date, end_date, is_current)
VALUES ('2024/2025', '2024-09-01', '2025-05-31', false)
ON CONFLICT (name) DO NOTHING;

-- 2023/2024 szezon (2 évvel ezelőtt)
INSERT INTO seasons (name, start_date, end_date, is_current)
VALUES ('2023/2024', '2023-09-01', '2024-05-31', false)
ON CONFLICT (name) DO NOTHING;

-- Ellenőrzés: lássuk az összes szezont
-- Várt eredmény:
-- 2025/2026 (Jelenlegi, is_current = true)
-- 2024/2025 (Előző, is_current = false)
-- 2023/2024 (2 évvel ezelőtt, is_current = false)
SELECT 
  id,
  name,
  start_date,
  end_date,
  is_current,
  created_at
FROM seasons 
ORDER BY start_date DESC;
