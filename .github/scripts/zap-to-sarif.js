// 將 ZAP JSON 報告轉換為 SARIF 格式（適用於 GitHub Code Scanning）
// DAST 掃描的 URI 是 HTTP URL，GitHub Code Scanning 要求 file: scheme 或相對路徑
// 因此將 URL 轉換為 URL path 相對路徑，並移除 uriBaseId
const fs = require('fs');

const reportPath = process.argv[2] || 'report_json.json';
const outputPath = process.argv[3] || 'zap-results.sarif';

if (!fs.existsSync(reportPath)) {
  console.log(`Report file not found: ${reportPath}`);
  process.exit(0);
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));

const sarif = {
  $schema:
    'https://raw.githubusercontent.com/oasis-tcs/sarif-spec/main/sarif-2.1/schema/sarif-schema-2.1.0.json',
  version: '2.1.0',
  runs: [
    {
      tool: {
        driver: {
          name: 'OWASP ZAP',
          informationUri: 'https://www.zaproxy.org/',
          version: report['@version'] || 'unknown',
          rules: [],
        },
      },
      results: [],
    },
  ],
};

const stripHtml = (str) => (str || '').replace(/<[^>]*>/g, '').trim();

// 將 HTTP URL 轉為相對路徑（GitHub Code Scanning 要求 file scheme）
const urlToRelativePath = (uri) => {
  try {
    const url = new URL(uri);
    // 取 pathname，移除開頭 /，確保是相對路徑
    const path = url.pathname.replace(/^\//, '') || 'index.html';
    return path;
  } catch {
    return uri || 'index.html';
  }
};

const riskToLevel = { 3: 'error', 2: 'warning', 1: 'note', 0: 'none' };
const ruleMap = new Map();

for (const site of report.site || []) {
  for (const alert of site.alerts || []) {
    const ruleId = `ZAP-${alert.pluginid}`;

    if (!ruleMap.has(ruleId)) {
      const ref = stripHtml(alert.reference);
      const helpUri = ref.split(/\s+/).find((s) => s.startsWith('http')) || 'https://www.zaproxy.org/';
      ruleMap.set(ruleId, {
        id: ruleId,
        name: alert.name || ruleId,
        shortDescription: { text: alert.name || ruleId },
        fullDescription: { text: stripHtml(alert.desc) || alert.name || ruleId },
        defaultConfiguration: { level: riskToLevel[alert.riskcode] || 'warning' },
        helpUri,
        properties: { tags: ['security'] },
      });
    }

    for (const instance of alert.instances || []) {
      sarif.runs[0].results.push({
        ruleId,
        level: riskToLevel[alert.riskcode] || 'warning',
        message: { text: stripHtml(alert.solution) || alert.name },
        locations: [
          {
            physicalLocation: {
              artifactLocation: {
                uri: urlToRelativePath(instance.uri),
              },
            },
          },
        ],
      });
    }
  }
}

sarif.runs[0].tool.driver.rules = Array.from(ruleMap.values());

fs.writeFileSync(outputPath, JSON.stringify(sarif, null, 2));
console.log(
  `SARIF report generated: ${sarif.runs[0].results.length} results, ${ruleMap.size} rules → ${outputPath}`
);
