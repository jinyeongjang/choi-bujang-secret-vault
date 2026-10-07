import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ROOT_DIR = join(__dirname, '..', '..');
const FIXTURE_PATH = join(ROOT_DIR, 'xdr', 'fixtures', 'web-injection.json');
const RESULT_PATH = join(ROOT_DIR, 'xdr', 'web-injection', 'result.json');
const ALERTS_LOG_PATH = join(ROOT_DIR, 'xdr', 'alerts.log');
const BLOCKED_RULES_PATH = join(ROOT_DIR, 'xdr', 'web-injection', 'blocked-rules.json');

/**
 * XDR web-injection 판정 결과 중 차단(block) 후보만을 추출하여
 * ZTNA 판정기 거부 규칙(규칙 ID, 근거 경보 번호, 만료 시각)으로 변환 및 연동합니다.
 *
 * - 정상 사용자(정상 IP 대역 및 정상 이벤트)는 차단 규칙에 포함하지 않습니다.
 * - 알림 이벤트는 xdr/alerts.log에 1줄씩 누적 기록합니다.
 * - 기존 판정기(src/decider.mjs) 코드는 일절 수정하지 않습니다.
 *
 * @param {object} [options]
 * @param {number} [options.ttlSeconds=3600] 차단 규칙 유효 시간 (초, 기본 1시간)
 * @returns {Promise<Array<object>>} 생성된 ZTNA 거부 규칙 목록
 */
export async function syncBlockedRulesToZTNA({ ttlSeconds = 3600 } = {}) {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));
  const result = JSON.parse(await readFile(RESULT_PATH, 'utf8'));

  const alertsMap = new Map();
  for (const alert of fixture.alerts) {
    alertsMap.set(alert.id, alert);
  }

  // 정상 사용자 IP 식별 (정상 이벤트 level <= 4에 등장한 IP는 절대 차단하지 않음)
  const normalIps = new Set();
  for (const alert of fixture.alerts) {
    if ((alert.rule?.level ?? 0) <= 4 && alert.data?.srcip) {
      normalIps.add(alert.data.srcip);
    }
  }

  const blockDecisions = result.decisions.filter((d) => d.action === 'block');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  const blockedRules = [];
  const logEntries = [];

  for (const decision of blockDecisions) {
    const alert = alertsMap.get(decision.alertId);
    if (!alert) continue;

    const srcip = alert.data?.srcip;
    // 정상 사용자가 사용하는 IP는 거부 규칙에서 제외 (안전 보장)
    if (srcip && normalIps.has(srcip)) {
      continue;
    }

    const ruleId = `xdr.block.webinjection.${alert.id}`;
    const blockedRule = {
      ruleId,
      alertId: alert.id,
      action: 'deny',
      reasonCode: 'xdr_web_injection_detected',
      ip: srcip || null,
      targetUrl: alert.data?.url || null,
      pattern: decision.reason,
      confidence: decision.confidence,
      createdAt: now.toISOString(),
      expiresAt,
    };

    blockedRules.push(blockedRule);

    const logLine = `[${now.toISOString()}] [ZTNA_RULE_SYNC] alertId=${alert.id} action=deny ruleId=${ruleId} srcip=${srcip || '-'} expiresAt=${expiresAt} pattern=${decision.reason}\n`;
    logEntries.push(logLine);
  }

  // xdr/web-injection/blocked-rules.json 저장
  await writeFile(
    BLOCKED_RULES_PATH,
    `${JSON.stringify({ schema: 'aleph.ztna.blocked-rules.v1', rules: blockedRules }, null, 2)}\n`,
    'utf8'
  );

  // xdr/alerts.log 에 한 줄씩 누적 기록
  if (logEntries.length > 0) {
    await appendFile(ALERTS_LOG_PATH, logEntries.join(''), 'utf8');
  }

  return blockedRules;
}

// 직접 실행 지원
if (process.argv[1] === __filename) {
  syncBlockedRulesToZTNA()
    .then((rules) => {
      console.log(`[bridge] ZTNA 거부 규칙 ${rules.length}개가 생성 및 동기화되었습니다.`);
      console.log(`[bridge] 알림 로그가 xdr/alerts.log에 기록되었습니다.`);
    })
    .catch((err) => {
      console.error('[bridge] 오류 발생:', err.message);
      process.exitCode = 1;
    });
}
