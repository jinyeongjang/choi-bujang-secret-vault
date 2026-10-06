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

-- anon 및 authenticated 역할에 대해 읽기(SELECT) 권한 차단
REVOKE SELECT ON TABLE notes FROM anon, authenticated;

-- 기존 data.json의 가상 메모 네 개 이전
INSERT INTO notes (title, content) VALUES
  ('과제', '실습용 가상 과제 기록'),
  ('포트폴리오', '실습용 가상 포트폴리오 기록'),
  ('아침 리추얼', '실습용 가상 리추얼 기록'),
  ('훈련 행정 자료', '실습용 가상 행정 기록');
