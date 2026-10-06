-- Supabase 테이블 생성: auth.users 외래키 없이 owner_id uuid 컬럼 마련
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  owner_id uuid,
  created_at timestamptz DEFAULT now()
);

-- RLS (Row Level Security) 활성화
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- 기존 권한 회수 및 최소 권한 부여
REVOKE ALL ON TABLE notes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE notes TO authenticated;

-- RLS 정책 설정: auth.uid() = owner_id 일 때만 허용
DROP POLICY IF EXISTS "notes_select_policy" ON notes;
CREATE POLICY "notes_select_policy" ON notes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "notes_insert_policy" ON notes;
CREATE POLICY "notes_insert_policy" ON notes
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "notes_update_policy" ON notes;
CREATE POLICY "notes_update_policy" ON notes
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

DROP POLICY IF EXISTS "notes_delete_policy" ON notes;
CREATE POLICY "notes_delete_policy" ON notes
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- 기존 data.json의 가상 메모 네 개 이전 (초기 설정 시)
INSERT INTO notes (title, content) VALUES
  ('과제', '실습용 가상 과제 기록'),
  ('포트폴리오', '실습용 가상 포트폴리오 기록'),
  ('아침 리추얼', '실습용 가상 리추얼 기록'),
  ('훈련 행정 자료', '실습용 가상 행정 기록')
ON CONFLICT DO NOTHING;
