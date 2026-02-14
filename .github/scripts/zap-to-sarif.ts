/**
 * ZAP JSON → SARIF 2.1.0 轉換器
 *
 * 將 OWASP ZAP 產生的 JSON 報告轉換為 GitHub Code Scanning 所需的 SARIF 格式。
 * DAST 掃描的 URI 是 HTTP URL，但 GitHub Code Scanning 要求相對路徑，
 * 因此將 `http://localhost:4200/path` 轉為 `path`。
 *
 * 用法：node --experimental-strip-types .github/scripts/zap-to-sarif.ts <input.json> <output.sarif>
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// #region ZAP JSON 型別定義

interface ZapInstance {
  readonly uri: string;
  readonly method?: string;
  readonly param?: string;
  readonly evidence?: string;
}

interface ZapAlert {
  readonly pluginid: string;
  readonly name: string;
  readonly desc: string;
  readonly solution: string;
  readonly reference: string;
  readonly riskcode: number;
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
function extractHelpUri(reference: string): string {
  const cleaned = stripHtml(reference);
  return cleaned.split(/\s+/).find((s) => s.startsWith('http')) ?? 'https://www.zaproxy.org/';
}

/** 將單一 ZAP alert 轉為 SARIF rule */
function toSarifRule(alert: ZapAlert, ruleId: string): SarifRule {
  const description = stripHtml(alert.desc) || alert.name || ruleId;
  return {
    id: ruleId,
    name: alert.name || ruleId,
    shortDescription: { text: alert.name || ruleId },
    fullDescription: { text: description },
    defaultConfiguration: { level: RISK_TO_LEVEL[alert.riskcode] ?? 'warning' },
    helpUri: extractHelpUri(alert.reference),
    properties: { tags: ['security'] },
  };
}

/** 將單一 ZAP instance 轉為 SARIF result */
function toSarifResult(alert: ZapAlert, instance: ZapInstance, ruleId: string): SarifResult {
  return {
    ruleId,
    level: RISK_TO_LEVEL[alert.riskcode] ?? 'warning',
    message: { text: stripHtml(alert.solution) || alert.name },
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
function convertZapToSarif(report: ZapReport): SarifDocument {
  const ruleMap = new Map<string, SarifRule>();
  const results: SarifResult[] = [];

  for (const site of report.site ?? []) {
    for (const alert of site.alerts ?? []) {
      const ruleId = `ZAP-${alert.pluginid}`;

      if (!ruleMap.has(ruleId)) {
        ruleMap.set(ruleId, toSarifRule(alert, ruleId));
      }

      for (const instance of alert.instances ?? []) {
        results.push(toSarifResult(alert, instance, ruleId));
      }
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

const [reportPath = 'report_json.json', outputPath = 'zap-results.sarif'] = process.argv.slice(2);

if (!existsSync(reportPath)) {
  console.log(`Report file not found: ${reportPath}`);
  process.exit(0);
}

const report: ZapReport = JSON.parse(readFileSync(reportPath, 'utf8'));
const sarif = convertZapToSarif(report);

writeFileSync(outputPath, JSON.stringify(sarif, null, 2));

const { results, tool } = sarif.runs[0];
console.log(
  `SARIF report generated: ${results.length} results, ${tool.driver.rules.length} rules → ${outputPath}`,
);

// #endregion
