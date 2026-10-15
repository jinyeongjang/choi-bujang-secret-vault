import { appendFile, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { decide } from './decide.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 저장소 루트 및 주요 경로 설정
const ROOT_DIR = join(__dirname, '..', '..');
const FIXTURE_PATH = join(ROOT_DIR, 'xdr', 'fixtures', 'privilege.json');
const ALERTS_LOG_PATH = join(ROOT_DIR, 'xdr', 'alerts.log');
const BLOCKED_RULES_PATH = join(ROOT_DIR, 'xdr', 'privilege', 'blocked-rules.json');

/**
 * XDR privilege 판정 결과 중 차단(block) 후보만을 추출하여
 * ZTNA 판정기 거부 규칙(규칙 ID, 근거 경보 번호, 만료 시각)으로 변환 및 연동합니다.
 *
 * - 정상 사용자(정상 IP 대역 및 정상 이벤트 level <= 4)는 절대 차단 규칙에 포함하지 않습니다.
 * - 알림 이벤트는 xdr/alerts.log에 1줄씩 누적 기록합니다.
 * - decide.mjs 및 ZTNA 판정기 기존 코드는 일절 수정하지 않습니다.
 *
 * @param {object} [options]
 * @param {number} [options.ttlSeconds=3600] 차단 규칙 유효 시간 (초, 기본 1시간)
 * @returns {Promise<Array<object>>} 생성된 ZTNA 거부 규칙 목록
 */
export async function syncBlockedRulesToZTNA({ ttlSeconds = 3600 } = {}) {
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));

  // 1. 정상 사용자 IP 식별 (정상 이벤트 level <= 4에 등장한 IP는 차단 규칙에서 제외)
  const normalIps = new Set();
  for (const alert of fixture.alerts) {
    if ((alert.rule?.level ?? 0) <= 4) {
      if (alert.data?.srcip) normalIps.add(alert.data.srcip);
    }
  }

  // 2. decide(alert)를 호출하여 차단 후보 수집
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000).toISOString();

  const blockedRules = [];
  const logEntries = [];

  for (const alert of fixture.alerts) {
    const decision = await decide(alert);
    if (decision.action !== 'block') {
      continue;
    }

    const srcip = alert.data?.srcip;
    const srcuser = alert.data?.srcuser;

    // 정상 사용자가 사용하는 정상 IP는 거부 규칙에서 엄격히 제외
    if (srcip && normalIps.has(srcip)) {
      continue;
    }

    const ruleId = `xdr.block.privilege.${alert.id}`;
    const blockedRule = {
      ruleId,
      alertId: alert.id,
      action: 'deny',
      reasonCode: 'xdr_privilege_detected',
      ip: srcip || null,
      account: srcuser || null,
      pattern: decision.reason,
      confidence: decision.confidence,
      createdAt: now.toISOString(),
      expiresAt,
    };

    blockedRules.push(blockedRule);

    // xdr/alerts.log 1줄 기록 형식
    const logLine = `[${now.toISOString()}] [ZTNA_RULE_SYNC] alertId=${alert.id} action=deny ruleId=${ruleId} srcip=${srcip || '-'} expiresAt=${expiresAt} pattern=${decision.reason}\n`;
    logEntries.push(logLine);
  }

  // xdr/privilege/blocked-rules.json 저장
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

/**
 * ZTNA 거부 규칙에 대한 요청/경보 평가 시뮬레이션
 *
 * @param {object} alertOrRequest - 경보 또는 요청 객체
 * @param {Array<object>} rules - 활성화된 ZTNA 거부 규칙 목록
 * @returns {{ allowed: boolean, matchedRule?: object }}
 */
export function evaluateAgainstBlockedRules(alertOrRequest, rules) {
  const ip = alertOrRequest?.data?.srcip || alertOrRequest?.ip;
  const now = new Date();

  for (const rule of rules) {
    // 만료된 규칙은 무시
    if (new Date(rule.expiresAt) <= now) continue;

    // 공격 IP 기준 차단 매칭
    if (rule.ip && rule.ip === ip) {
      return { allowed: false, matchedRule: rule };
    }
  }

  return { allowed: true };
}

/**
 * 전체 응답 및 검증 실행기
 * 1) ZTNA 거부 규칙 생성 및 alerts.log 동기화
 * 2) 시험 경보 전체를 다시 흘려 명확한 공격만 차단되고 정상 요청은 통과하는지 검증
 */
export async function respond({ ttlSeconds = 3600 } = {}) {
  const blockedRules = await syncBlockedRulesToZTNA({ ttlSeconds });
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, 'utf8'));

  let blockedCount = 0;
  let allowedCount = 0;
  let normalPassedCount = 0;

  for (const alert of fixture.alerts) {
    const isNormal = (alert.rule?.level ?? 0) <= 4;
    const isClearAttack = (alert.rule?.level ?? 0) >= 10;
    const evaluation = evaluateAgainstBlockedRules(alert, blockedRules);

    if (!evaluation.allowed) {
      blockedCount += 1;
      if (isNormal) {
        throw new Error(`[보안 위반] 정상 요청(alertId=${alert.id})이 차단되었습니다!`);
      }
    } else {
      allowedCount += 1;
      if (isNormal) {
        normalPassedCount += 1;
      }
      if (isClearAttack) {
        throw new Error(`[방어 실패] 명확한 공격(alertId=${alert.id})이 차단되지 않고 통과되었습니다!`);
      }
    }
  }

  return {
    blockedRulesCount: blockedRules.length,
    testVerification: {
      totalAlerts: fixture.alerts.length,
      blockedAttacks: blockedCount,
      allowedRequests: allowedCount,
      normalRequestsPassed: normalPassedCount,
      success: blockedCount === 9 && normalPassedCount === 9,
    },
  };
}

// 직접 실행 지원
if (process.argv[1] === __filename) {
  respond()
    .then((result) => {
      console.log(`[respond] ZTNA 거부 규칙 ${result.blockedRulesCount}개가 생성 및 동기화되었습니다.`);
      console.log(`[respond] 알림 로그가 xdr/alerts.log에 기록되었습니다.`);
      console.log(`[respond] 경보 재검증 결과: 공격 ${result.testVerification.blockedAttacks}건 차단, 정상 ${result.testVerification.normalRequestsPassed}건 통과.`);
      if (result.testVerification.success) {
        console.log('[respond] 검증 통과: 명확한 공격만 막히고 정상 요청은 모두 정상 통과되었습니다.');
      }
    })
    .catch((err) => {
      console.error('[respond] 오류 발생:', err.message);
      process.exitCode = 1;
    });
}
