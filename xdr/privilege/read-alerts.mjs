import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * xdr/fixtures/privilege.json 파일을 읽어
 * 각 경보에서 시각, 출발 주소, 계정, 규칙 수준, 설명만 추출하여 반환합니다.
 * 토큰, 비밀키, 세션 정보 등 비밀값이나 민감정보로 보일 수 있는 값은 일체 포함하거나 출력하지 않습니다.
 *
 * @param {string} [customPath] - fixture 파일 경로 (기본값: ../fixtures/privilege.json)
 * @returns {Promise<Array<{timestamp: string, srcip: string, srcuser: string, level: number, description: string}>>}
 */
export async function readAlerts(customPath) {
  const filePath = customPath || join(__dirname, '..', 'fixtures', 'privilege.json');
  const rawData = await readFile(filePath, 'utf8');
  const fixture = JSON.parse(rawData);

  if (!Array.isArray(fixture.alerts)) {
    throw new Error('경보 목록(alerts)이 올바르지 않습니다.');
  }

  return fixture.alerts.map((alert) => ({
    timestamp: alert?.timestamp || '',
    srcip: alert?.data?.srcip || '-',
    srcuser: alert?.data?.srcuser || '-',
    level: alert?.rule?.level ?? 0,
    description: alert?.rule?.description || '',
  }));
}

// 직접 실행 시 경보 건수와 뽑은 줄 수가 일치하도록 각 경보를 1줄씩만 출력
if (process.argv[1] === __filename) {
  readAlerts()
    .then((alerts) => {
      for (const a of alerts) {
        console.log(`[${a.timestamp}] 출발주소: ${a.srcip} | 계정: ${a.srcuser} | 수준: ${a.level} | 설명: ${a.description}`);
      }
    })
    .catch((err) => {
      console.error('[read-alerts] 오류:', err.message);
      process.exitCode = 1;
    });
}
