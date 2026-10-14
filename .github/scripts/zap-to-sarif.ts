/**
 * ZAP JSON → SARIF 2.1.0 轉換器
 *
 * 將 OWASP ZAP 產生的 JSON 報告轉換為 GitHub Code Scanning 所需的 SARIF 格式。
 * DAST 掃描的 URI 是 HTTP URL，但 GitHub Code Scanning 要求相對路徑，
 * 因此將 `http://localhost:4200/path` 轉為 `path`。
 *
 * 用法：node --experimental-strip-types .github/scripts/zap-to-sarif.ts <input.json> <output.sarif> [rules.tsv]
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// #region ZAP JSON 型別定義

interface ZapInstance {
  readonly uri: string;
  readonly method?: string;
  readonly param?: string;
  readonly evidence?: string;
  readonly otherinfo?: string;
}

interface ZapAlert {
  readonly pluginid: string;
  readonly alertRef?: string;
  readonly name: string;
  readonly desc: string;
  readonly solution: string;
  readonly reference: string;
  readonly riskcode: number | string;
  readonly instances: readonly ZapInstance[];
}

interface ZapSite {
  readonly alerts: readonly ZapAlert[];
}

interface ZapReport {
  readonly '@version'?: string;
  readonly site: readonly ZapSite[];
}

// #endregion

// #region SARIF 型別定義

interface SarifMessage {
  readonly text: string;
}

interface SarifArtifactLocation {
  readonly uri: string;
}

interface SarifPhysicalLocation {
  readonly artifactLocation: SarifArtifactLocation;
}

interface SarifLocation {
  readonly physicalLocation: SarifPhysicalLocation;
}

interface SarifResult {
  readonly ruleId: string;
  readonly level: string;
  readonly message: SarifMessage;
  readonly locations: readonly SarifLocation[];
}

interface SarifRule {
  readonly id: string;
  readonly name: string;
  readonly shortDescription: SarifMessage;
  readonly fullDescription: SarifMessage;
  readonly defaultConfiguration: { readonly level: string };
  readonly helpUri: string;
  readonly properties: { readonly tags: readonly string[] };
}

interface SarifRun {
  readonly tool: {
    readonly driver: {
      readonly name: string;
      readonly informationUri: string;
      readonly version: string;
      readonly rules: readonly SarifRule[];
    };
  };
  readonly results: readonly SarifResult[];
}

interface SarifDocument {
  readonly $schema: string;
  readonly version: string;
  readonly runs: readonly SarifRun[];
}

// #endregion

const RISK_TO_LEVEL: Record<number, string> = {
  3: 'error',
  2: 'warning',
  1: 'note',
  0: 'none',
} as const;

const SARIF_SCHEMA =
  'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json';

/** 移除 HTML 標籤並 trim（迴圈移除以防巢狀標籤殘留） */
function stripHtml(str: string): string {
  let result = str;
  let previous: string;
  do {
    previous = result;
    result = result.replace(/<[^>]*>/g, '');
  } while (result !== previous);
  return result.trim();
}

/** 解析 rules.tsv，回傳所有 IGNORE 的 plugin ID 或精確 alert reference */
function parseIgnoredRules(filePath: string): Set<string> {
  const ignored = new Set<string>();
  if (!existsSync(filePath)) return ignored;
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [pluginId, level] = trimmed.split('\t');
    if (level?.trim() === 'IGNORE') ignored.add(pluginId.trim());
  }
  return ignored;
}

/** 將 HTTP URL 轉為相對路徑（GitHub Code Scanning 不接受 http scheme） */
function urlToRelativePath(uri: string): string {
  try {
    const { pathname } = new URL(uri);
    return pathname.replace(/^\//, '') || 'index.html';
  } catch {
    return uri || 'index.html';
  }
}

/** 從 reference 文字中擷取第一個 HTTP(S) 連結 */
function extractHelpUri(reference: string, alertId: string): string {
  const cleaned = stripHtml(reference);
  return (
    cleaned.split(/\s+/).find((s) => s.startsWith('http')) ??
    `https://www.zaproxy.org/docs/alerts/${encodeURIComponent(alertId)}/`
  );
}

function alertReference(alert: ZapAlert): string {
  return alert.alertRef?.trim() || alert.pluginid;
}

function alertLevel(alert: ZapAlert): string {
  if (!/^[0-3]$/.test(String(alert.riskcode))) return 'warning';
  return RISK_TO_LEVEL[Number(alert.riskcode)] ?? 'warning';
}

/**
 * 只略過已核對的資訊性觀察；原始 JSON／HTML 報告仍完整保留。
 * 10109 只辨識 SPA，兩個掃描 workflow 均已使用 -j 啟用瀏覽器爬蟲。
 * localStorage 僅接受 ThemeService 的三種非敏感偏好值；其他 key、值、
 * subrule、風險等級或不完整證據一律保留，避免隱藏後續敏感資料儲存問題。
 */
function isReviewedInformationalInstance(alert: ZapAlert, instance: ZapInstance): boolean {
  if (alert.riskcode !== 0 && alert.riskcode !== '0') return false;

  if (alert.pluginid === '10109' && alertReference(alert) === '10109') return true;

  if (
    alert.pluginid !== '120000' ||
    alert.alertRef !== '120000-1' ||
    instance.param !== 'theme-preference'
  ) {
    return false;
  }

  const evidence = instance.otherinfo?.split(/\r?\n/);
  if (!evidence || evidence.length > 2) return false;
  return (
    /^The following data \(key=value\) was set: theme-preference=(?:auto|light|dark)$/.test(
      evidence[0],
    ) &&
    (evidence.length === 1 ||
      evidence[1] === 'Note that this alert will only be raised once for each URL + key.')
  );
}

/** 將單一 ZAP alert 轉為 SARIF rule */
function toSarifRule(alert: ZapAlert, ruleId: string): SarifRule {
  const description = stripHtml(alert.desc) || alert.name || ruleId;
  return {
    id: ruleId,
    name: alert.name || ruleId,
    shortDescription: { text: alert.name || ruleId },
    fullDescription: { text: description },
    defaultConfiguration: { level: alertLevel(alert) },
    helpUri: extractHelpUri(alert.reference, alertReference(alert)),
    properties: { tags: ['security'] },
  };
}

/** 將單一 ZAP instance 轉為 SARIF result */
function toSarifResult(alert: ZapAlert, instance: ZapInstance, ruleId: string): SarifResult {
  const context = [stripHtml(alert.name) || ruleId];
  if (instance.method && /^[A-Z]{3,10}$/.test(instance.method)) {
    context.push(`Method: ${instance.method}`);
  }
  // 報告只帶入參數名稱，不匯出 evidence／otherinfo 中可能含有的敏感值。
  if (instance.param && /^[A-Za-z0-9_.:-]{1,128}$/.test(instance.param)) {
    context.push(`Parameter: ${instance.param}`);
  }
  const solution = stripHtml(alert.solution);
  if (solution) context.push(solution);

  return {
    ruleId,
    level: alertLevel(alert),
    message: { text: context.join('\n') },
    locations: [
      {
        physicalLocation: {
          artifactLocation: { uri: urlToRelativePath(instance.uri) },
        },
      },
    ],
  };
}

/** 轉換 ZAP JSON 報告為 SARIF document */
function convertZapToSarif(
  report: ZapReport,
  ignoredPluginIds: ReadonlySet<string> = new Set(),
): SarifDocument {
  const ruleMap = new Map<string, SarifRule>();
  const results: SarifResult[] = [];
  const alerts = (report.site ?? []).flatMap((site) => site.alerts ?? []);

  for (const alert of alerts) {
    const alertId = alertReference(alert);
    if (ignoredPluginIds.has(alert.pluginid) || ignoredPluginIds.has(alertId)) continue;
    const instances = (alert.instances ?? []).filter(
      (instance) => !isReviewedInformationalInstance(alert, instance),
    );
    if (instances.length === 0) continue;

    const ruleId = `ZAP-${alertId}`;
    if (!ruleMap.has(ruleId)) {
      ruleMap.set(ruleId, toSarifRule(alert, ruleId));
    }
    for (const instance of instances) {
      results.push(toSarifResult(alert, instance, ruleId));
    }
  }

  return {
    $schema: SARIF_SCHEMA,
    version: '2.1.0',
    runs: [
      {
        tool: {
          driver: {
            name: 'OWASP ZAP',
            informationUri: 'https://www.zaproxy.org/',
            version: report['@version'] ?? 'unknown',
            rules: [...ruleMap.values()],
          },
        },
        results,
      },
    ],
  };
}

// #region CLI 進入點

const [reportPath = 'report_json.json', outputPath = 'zap-results.sarif', rulesPath] =
  process.argv.slice(2);

if (!existsSync(reportPath)) {
  console.log(`Report file not found: ${reportPath}`);
  process.exit(0);
}

const ignoredRules = rulesPath ? parseIgnoredRules(rulesPath) : new Set<string>();
const report: ZapReport = JSON.parse(readFileSync(reportPath, 'utf8'));
const sarif = convertZapToSarif(report, ignoredRules);

writeFileSync(outputPath, JSON.stringify(sarif, null, 2));

const { results, tool } = sarif.runs[0];
console.log(
  `SARIF report generated: ${results.length} results, ${tool.driver.rules.length} rules` +
    `${ignoredRules.size > 0 ? `, ${ignoredRules.size} rules ignored` : ''} → ${outputPath}`,
);

// #endregion
