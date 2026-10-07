import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * xdr/fixtures/web-injection.json 파일을 읽어
 * 각 경보에서 시각, 출발 주소, 계정, 규칙 수준, 설명만 추출하여 반환합니다.
 * 비밀값처럼 보이는 값이나 민감정보는 일절 포함하거나 출력하지 않습니다.
 *
 * @param {string} [customPath] - fixture 파일 경로 (기본값: ../fixtures/web-injection.json)
 * @returns {Promise<Array<{id: string, timestamp: string, srcip: string, srcuser: string, level: number, description: string}>>}
 */
export async function readAlerts(customPath) {
  const filePath = customPath || join(__dirname, '..', 'fixtures', 'web-injection.json');
  const rawData = await readFile(filePath, 'utf8');
  const fixture = JSON.parse(rawData);

  if (!Array.isArray(fixture.alerts)) {
    throw new Error('경보 목록(alerts)이 올바르지 않습니다.');
  }

  return fixture.alerts.map((alert) => ({
    id: alert?.id || '',
    timestamp: alert?.timestamp || '',
    srcip: alert?.data?.srcip || '',
    srcuser: alert?.data?.srcuser || '',
    level: alert?.rule?.level ?? 0,
    description: alert?.rule?.description || '',
  }));
}

// 직접 실행 지원
if (process.argv[1] === __filename) {
  readAlerts()
    .then((alerts) => {
      console.log(`[read-alerts] 총 ${alerts.length}건의 경보를 성공적으로 읽었습니다.`);
      if (alerts.length > 0) {
        console.log('[read-alerts] 첫 번째 경보 요약 샘플:');
        console.log(alerts[0]);
      }
    })
    .catch((err) => {
      console.error('[read-alerts] 오류 발생:', err.message);
      process.exitCode = 1;
    });
}
