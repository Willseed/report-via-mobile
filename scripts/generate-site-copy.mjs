#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, '..');
const sourcePath = path.join(repositoryRoot, 'site-copy.json');
process.chdir(repositoryRoot);
const copy = JSON.parse(readFileSync(sourcePath, 'utf8'));
const expectedToolNames = [
  'list_violation_types',
  'lookup_station',
  'set_report_form',
  'preview_sms',
  'open_sms_composer',
];

validateCopy();

const publicOrigin = copy.url.replace(/\/$/, '');
const skillPath = '/.well-known/agent-skills/report-via-mobile/SKILL.md';
const skillUrl = `${publicOrigin}${skillPath}`;
const mcpCardPath = '/.well-known/mcp/server-card.json';
const mcpCardUrl = `${publicOrigin}${mcpCardPath}`;
const previewWarningLabels = copy.previewWarnings.map((warning) => `\`${warning}\``).join('、');
const oauthProtectedResourcePath = '/.well-known/oauth-protected-resource';
const oauthAuthorizationServerPath = '/.well-known/oauth-authorization-server';
const apiCatalogPath = '/.well-known/api-catalog';
const aiCatalogPath = '/.well-known/ai-catalog.json';
const ardPath = '/.well-known/ard.json';

const skillMarkdown = renderSkill();
const aiCatalog = renderAiCatalog();
const apiCatalog = renderApiCatalog();
const serverCard = renderServerCard();

writeFileSync('src/index.html', withTrailingNewline(renderIndexHtml()));
writeFileSync('public/index.md', withTrailingNewline(renderIndexMarkdown()));
writeFileSync('public/llms.txt', withTrailingNewline(renderLlms()));
writeFileSync('public/auth.md', withTrailingNewline(renderAuth()));
writeFileSync(
  'public/.well-known/agent-skills/report-via-mobile/SKILL.md',
  withTrailingNewline(skillMarkdown),
);
writeFileSync(
  'public/.well-known/agent-skills/index.json',
  withTrailingNewline(stringifyJson(renderSkillsIndex(skillMarkdown))),
);
writeFileSync('public/.well-known/ai-catalog.json', withTrailingNewline(stringifyJson(aiCatalog)));
writeFileSync('public/.well-known/ard.json', withTrailingNewline(stringifyJson(aiCatalog)));
writeFileSync('public/.well-known/api-catalog', withTrailingNewline(stringifyJson(apiCatalog)));
writeFileSync(
  'public/.well-known/mcp/server-card.json',
  withTrailingNewline(stringifyJson(serverCard)),
);
writeFileSync(
  'public/.well-known/oauth-protected-resource',
  withTrailingNewline(stringifyJson(renderProtectedResourceMetadata())),
);
writeFileSync(
  'public/.well-known/oauth-authorization-server',
  withTrailingNewline(stringifyJson(renderAuthorizationServerMetadata())),
);
writeFileSync('public/manifest.webmanifest', withTrailingNewline(stringifyJson(renderManifest())));

function validateCopy() {
  if (copy.name !== '台灣交通違規簡訊報案工具') {
    throw new Error('site-copy.json must use the public product name.');
  }

  const actualToolNames = copy.webmcpTools?.map((tool) => tool.name);
  if (JSON.stringify(actualToolNames) !== JSON.stringify(expectedToolNames)) {
    throw new Error('site-copy.json must declare exactly the five browser WebMCP tools.');
  }

  for (const tool of copy.webmcpTools) {
    if (!tool.description.startsWith('Does not submit a police report.')) {
      throw new Error(`WebMCP description must start with the required sentence: ${tool.name}`);
    }
  }

  if (!Array.isArray(copy.faq) || copy.faq.length === 0) {
    throw new Error('site-copy.json must contain FAQ copy.');
  }
}

function withTrailingNewline(content) {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function stringifyJson(value) {
  return JSON.stringify(value, null, 2);
}

function html(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function jsonForScript(value) {
  return JSON.stringify(value, null, 2).replaceAll('<', '\\u003c');
}

function renderFaqHtml() {
  return copy.faq
    .map(({ question, answer }) => `    <h4>${html(question)}</h4>\n    <p>${html(answer)}</p>`)
    .join('\n');
}

function renderList(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

function notAction(item) {
  return item === '官方系統' ? '不是官方系統' : `不${item}`;
}

function renderIndexMarkdown() {
  return `# ${copy.name}

📅 更新日期：${copy.updated}

${copy.description}

${copy.doesNotStatement}

${copy.agentBoundary}

## 可以做什麼

${renderList(copy.does.map((item) => `${item}。`))}

## 不做什麼

${renderList(copy.doesNot.map((item) => `${notAction(item)}。`))}

${copy.privacy}

${copy.coverage}

## 瀏覽器 WebMCP

${copy.webmcpLimitations.join('\n\n')}

工具名稱與用途：

${copy.webmcpTools.map((tool) => `- \`${tool.name}\`：${tool.description}`).join('\n')}

工具只會在使用者裝置上操作已開啟的本站表單。遠端 Agent 不能送出簡訊；本站沒有託管 MCP transport，也沒有代寄簡訊的遠端 API。

## Agent discovery

- [HTML 首頁](${copy.url})：給人使用的 PWA 表單。
- [Markdown 首頁](${copy.url}index.md)：本文件，供 Agent 與純文字客戶端閱讀。
- [llms.txt](${copy.url}llms.txt)：給語言模型與 Agent 的精簡說明。
- [Agent Skill](${skillUrl})：瀏覽器 WebMCP 工具與使用限制。
- [API catalog](${publicOrigin}${apiCatalogPath})：公開文件與發現資源目錄。
- [MCP server-card](${mcpCardUrl})：宣告沒有託管 MCP transport。
- [授權與資料使用](${copy.url}auth.md)：anonymous/no-credential 的公開使用說明。
- [原始碼](${copy.repository})：公開專案原始碼。

## 常見問題

${copy.faq.map(({ question, answer }) => `### ${question}\n\n${answer}`).join('\n\n')}
`;
}

function renderLlms() {
  return `# ${copy.name}

> ${copy.description}

${copy.doesNotStatement}

${copy.agentBoundary}

## 做什麼

${renderList(copy.does.map((item) => `${item}。`))}

## 不做什麼

${renderList(copy.doesNot.map((item) => `${notAction(item)}。`))}

${copy.privacy}

## 給 Agent

本站唯一的執行面是使用者裝置、本站已開啟頁面中的瀏覽器 WebMCP。可用工具只有：${expectedToolNames.map((name) => `\`${name}\``).join('、')}。

${copy.webmcpLimitations.join('\n\n')}

Agent 請依序使用 \`list_violation_types\`、\`lookup_station\`、\`set_report_form\`、\`preview_sms\`；preview 結果只是完整草稿，${copy.userConfirmation} \`open_sms_composer\` 只有在使用者手勢或頁內明確確認後才可能打開系統簡訊 App。遠端 Agent 不能送出簡訊。

## 文件

- HTML 首頁：${copy.url}
- Markdown 首頁：${copy.url}index.md
- Agent Skill：${skillUrl}
- API catalog：${publicOrigin}${apiCatalogPath}
- MCP server-card：${mcpCardUrl}
- 授權與資料使用：${copy.url}auth.md
- 原始碼：${copy.repository}
`;
}

function renderAuth() {
  return `# 授權與資料使用

${copy.name}是公開的靜態 PWA。${copy.description}

${copy.doesNotStatement}

${copy.agentBoundary}

## 公開使用

本服務沒有帳號系統、受保護 API、OAuth token 或託管 MCP transport。Agent 不需要註冊、登入、API key 或 Authorization header；請直接在使用者裝置開啟本站，讓相容瀏覽器提供 WebMCP 工具。

## anonymous / no credential

若 Agent 需要讀取授權探索文件，請先讀取：

- \`/.well-known/oauth-protected-resource\`
- \`/.well-known/oauth-authorization-server\`

這兩份文件描述 anonymous 身分與 no credential。\`register_uri\` 是本文件的唯讀說明，不接受 POST，也不會核發憑證；\`claim_uri\` 只是文件錨點，不是 API。

## 使用限制

- ${copy.userConfirmation}
- ${copy.agentBoundary}
- ${copy.privacy}
- 本站只提供瀏覽器 WebMCP 工具；沒有遠端 MCP server 或代寄簡訊服務。

## 公開文件

- [首頁](${copy.url})
- [Markdown 首頁](${copy.url}index.md)
- [Agent Skill](${skillUrl})
- [API catalog](${publicOrigin}${apiCatalogPath})
- [MCP server-card](${mcpCardUrl})
- [原始碼](${copy.repository})
`;
}

function renderSkill() {
  const toolLines = copy.webmcpTools
    .map((tool) => `### \`${tool.name}\`\n\n${tool.description}`)
    .join('\n\n');

  return `---
name: report-via-mobile
description: ${copy.name}的瀏覽器 WebMCP 操作說明；只協助使用者查窗口、填表、產生與預覽簡訊草稿。
---

# ${copy.name} Agent Skill

${copy.description}

${copy.doesNotStatement}

${copy.agentBoundary}

## 使用流程

1. 在使用者裝置開啟 ${copy.url}；遠端 Agent 不能操作本站表單或送出簡訊。
2. 使用 \`list_violation_types\` 取得現有違規選項。
3. 使用 \`lookup_station\` 依地址、行政區或使用者已授權提供的座標查受理窗口與號碼。工具不會暗開 GPS。
4. 使用 \`set_report_form\` 將使用者確認的資料寫入表單；這一步只改表單。
5. 使用 \`preview_sms\` 讀取表單並檢查完整草稿、收件人、受理單位與警告。預覽內容尚未送出；warnings 必含 ${previewWarningLabels}。
6. 只有使用者手勢或頁內明確確認後，才可使用 \`open_sms_composer\` 打開系統簡訊 App；是否送出仍由使用者在 App 內決定。

## 瀏覽器工具

${toolLines}

## 限制

${copy.webmcpLimitations.map((item) => `- ${item}`).join('\n')}

工具只使用本站前端狀態與內建受理窗口資料，不會呼叫本站自有後端。不得註冊或宣稱存在 \`send_sms\`、\`submit_report\`、遠端 MCP tools 或代寄簡訊 API。
`;
}

function renderSkillsIndex(skillMarkdown) {
  const digest = `sha256:${createHash('sha256').update(skillMarkdown).digest('hex')}`;
  return {
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills: [
      {
        name: 'report-via-mobile',
        type: 'skill-md',
        description: `${copy.name}的瀏覽器 WebMCP 操作說明。`,
        url: skillUrl,
        digest,
      },
    ],
  };
}

function renderAiCatalog() {
  const toolNames = copy.webmcpTools.map((tool) => tool.name);
  return {
    specVersion: '1.0',
    host: {
      displayName: copy.name,
      identifier: copy.url,
      documentationUrl: `${copy.url}index.md`,
    },
    entries: [
      {
        identifier: 'urn:air:tools.pylot.dev:skill:report-via-mobile',
        displayName: `${copy.name} Agent Skill`,
        type: 'text/markdown; profile="urn:air:agent-skills"',
        url: skillUrl,
        description: `${copy.name}的瀏覽器 WebMCP 工具與使用限制。`,
        tags: ['agent-skill', 'taiwan', 'traffic-reporting', 'sms', 'webmcp'],
        capabilities: toolNames,
        representativeQueries: [
          '查詢交通違規簡訊受理窗口',
          '協助填寫交通違規簡訊表單',
          '預覽尚未送出的簡訊草稿',
          '了解瀏覽器 WebMCP 工具限制',
          '確認 Agent 是否能代替使用者送出簡訊',
        ],
        version: '1.0.0',
      },
      {
        identifier: 'urn:air:tools.pylot.dev:mcp:server-card',
        displayName: `${copy.name} MCP Server Card`,
        type: 'application/mcp-server-card+json',
        url: mcpCardUrl,
        description: '宣告沒有託管 MCP transport；工具只在瀏覽器 WebMCP 中提供。',
        tags: ['mcp', 'server-card', 'discovery', 'webmcp'],
        representativeQueries: [
          '這個網站是否提供遠端 MCP transport',
          '查詢瀏覽器 WebMCP 工具限制',
          '這個網站是否能代寄簡訊',
        ],
        version: '1.0.0',
      },
    ],
  };
}

function renderApiCatalog() {
  const origin = copy.url.replace(/\/$/, '');
  const interfaces = [
    {
      id: 'html',
      name: 'HTML 首頁',
      description: `${copy.name}的使用者表單與 PWA 介面。`,
      url: copy.url,
      mediaType: 'text/html',
    },
    {
      id: 'index.md',
      name: 'Markdown 首頁',
      description: '與 HTML 首頁同一套產品文案，供 Agent 與純文字客戶端閱讀。',
      url: `${origin}/index.md`,
      mediaType: 'text/markdown',
    },
    {
      id: 'llms.txt',
      name: 'llms.txt',
      description: '給語言模型與 Agent 的精簡產品、工具與限制說明。',
      url: `${origin}/llms.txt`,
      mediaType: 'text/plain',
    },
    {
      id: 'skill',
      name: 'report-via-mobile Agent Skill',
      description: '瀏覽器 WebMCP 五個工具的操作流程與安全限制。',
      url: skillUrl,
      mediaType: 'text/markdown',
    },
    {
      id: 'mcp-card',
      name: 'MCP server-card',
      description: '宣告沒有託管 MCP transport，工具只在瀏覽器 WebMCP 中提供。',
      url: mcpCardUrl,
      mediaType: 'application/json',
    },
    {
      id: 'ai-catalog',
      name: 'AI catalog',
      description: '包含瀏覽器 WebMCP 五個工具的機器可讀發現清單。',
      url: `${origin}${aiCatalogPath}`,
      mediaType: 'application/json',
    },
    {
      id: 'ard',
      name: 'ARD manifest',
      description: 'AI catalog 的目前別名。',
      url: `${origin}${ardPath}`,
      mediaType: 'application/json',
    },
    {
      id: 'agent-skills',
      name: 'Agent Skills index',
      description: 'Agent Skill 與 MCP server-card 的公開索引。',
      url: `${origin}/.well-known/agent-skills/index.json`,
      mediaType: 'application/json',
    },
    {
      id: 'oauth-protected-resource',
      name: 'OAuth Protected Resource Metadata',
      description: '公開資源的 anonymous/no-credential 探索資訊。',
      url: `${origin}${oauthProtectedResourcePath}`,
      mediaType: 'application/json',
    },
    {
      id: 'oauth-authorization-server',
      name: 'OAuth Authorization Server Metadata',
      description: '公開 anonymous/no-credential registration profile；不核發憑證。',
      url: `${origin}${oauthAuthorizationServerPath}`,
      mediaType: 'application/json',
    },
    {
      id: 'auth.md',
      name: '授權與資料使用',
      description: '說明公開使用、資料流與沒有遠端代寄簡訊服務。',
      url: `${origin}/auth.md`,
      mediaType: 'text/markdown',
    },
    {
      id: 'web-app-manifest',
      name: 'Web app manifest',
      description: 'PWA 安裝 metadata。',
      url: `${origin}/manifest.webmanifest`,
      mediaType: 'application/manifest+json',
    },
  ];

  return {
    name: copy.name,
    description: copy.description,
    url: `${origin}${apiCatalogPath}`,
    homepage: copy.url,
    repository: copy.repository,
    interfaces,
    linkset: [
      {
        anchor: copy.url,
        self: [{ href: `${origin}${apiCatalogPath}`, type: 'application/linkset+json' }],
        alternate: [
          { href: `${origin}/index.md`, type: 'text/markdown', title: 'Markdown 首頁' },
          { href: `${origin}/llms.txt`, type: 'text/plain', title: 'llms.txt' },
        ],
        'service-desc': [
          { href: `${origin}${aiCatalogPath}`, type: 'application/json', title: 'AI catalog' },
          { href: `${origin}${ardPath}`, type: 'application/json', title: 'ARD manifest' },
          {
            href: `${origin}/manifest.webmanifest`,
            type: 'application/manifest+json',
            title: 'Web app manifest',
          },
          { href: skillUrl, type: 'text/markdown', title: 'Agent Skill' },
          { href: mcpCardUrl, type: 'application/json', title: 'MCP server-card' },
          {
            href: `${origin}/.well-known/agent-skills/index.json`,
            type: 'application/json',
            title: 'Agent Skills index',
          },
        ],
        'service-doc': [
          { href: `${origin}/auth.md`, type: 'text/markdown', title: '授權與資料使用' },
          { href: copy.repository, type: 'text/html', title: '原始碼' },
        ],
      },
    ],
    notes: [
      '本站是靜態 PWA，沒有自有後端、受保護 API 或遠端代寄簡訊服務。',
      'WebMCP 工具只在使用者裝置、本站已開啟的瀏覽器頁面中提供。',
      '遠端 Agent 不能送出簡訊；open_sms_composer 需要使用者手勢或頁內明確確認。',
    ],
  };
}

function renderServerCard() {
  return {
    $schema: 'https://modelcontextprotocol.io/schemas/server-card/draft.json',
    serverInfo: {
      name: 'report-via-mobile-static-site',
      version: '1.0.0',
    },
    description: `${copy.name}的公開靜態 PWA；沒有託管 MCP server 或受保護 API。`,
    endpoint: mcpCardUrl,
    transport: null,
    transports: [],
    capabilities: {
      prompts: false,
      resources: false,
      tools: false,
    },
    links: {
      site: copy.url,
      auth: `${copy.url}auth.md`,
      skills: `${copy.url}.well-known/agent-skills/index.json`,
    },
    notes: `沒有託管 MCP transport。工具僅透過使用者裝置、本站已開啟頁面的 navigator.modelContext 提供瀏覽器 WebMCP；${copy.agentBoundary}`,
  };
}

function renderProtectedResourceMetadata() {
  return {
    resource: copy.url,
    resource_name: copy.name,
    authorization_servers: [copy.url.replace(/\/$/, '')],
    scopes_supported: ['public'],
    bearer_methods_supported: ['header'],
    resource_documentation: `${copy.url}auth.md`,
    notes: `公開靜態 PWA：anonymous 使用不需要 credential，也沒有受保護 API。${copy.agentBoundary}`,
  };
}

function renderAuthorizationServerMetadata() {
  const issuer = copy.url.replace(/\/$/, '');
  const authUrl = `${copy.url}auth.md`;
  return {
    issuer,
    resource: copy.url,
    authorization_servers: [issuer],
    scopes_supported: ['public'],
    bearer_methods_supported: ['header'],
    service_documentation: authUrl,
    agent_auth: {
      skill: authUrl,
      register_uri: authUrl,
      claim_uri: `${authUrl}#anonymous--no-credential`,
      identity_types_supported: ['anonymous'],
      credential_types_supported: ['none'],
      anonymous: {
        credential_types_supported: ['none'],
      },
    },
  };
}

function renderManifest() {
  return {
    name: copy.name,
    short_name: '簡訊報案',
    description: copy.description,
    display: 'standalone',
    orientation: 'portrait',
    scope: './',
    start_url: './',
    theme_color: '#673ab7',
    background_color: '#ffffff',
    icons: [
      { src: 'icons/icon-16x16.png', sizes: '16x16', type: 'image/png' },
      { src: 'icons/icon-32x32.png', sizes: '32x32', type: 'image/png' },
      { src: 'icons/icon-64x64.png', sizes: '64x64', type: 'image/png' },
      {
        src: 'icons/icon-128x128.png',
        sizes: '128x128',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: 'icons/icon-256x256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'maskable any',
      },
      {
        src: 'icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable any',
      },
    ],
  };
}

function renderIndexHtml() {
  const faqSchema = copy.faq.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  }));
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${copy.url}#webapp`,
        name: copy.name,
        alternateName: copy.alternateNames,
        url: copy.url,
        image: `${copy.url}og-image.png`,
        description: copy.description,
        applicationCategory: 'UtilityApplication',
        operatingSystem: 'Android, iOS, Web',
        browserRequirements: '需要 JavaScript 與現代行動瀏覽器。',
        featureList: copy.does,
        softwareVersion: '1.0.0',
        isAccessibleForFree: true,
        inLanguage: 'zh-TW',
        sameAs: copy.repository,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'TWD' },
      },
      {
        '@type': 'FAQPage',
        '@id': `${copy.url}#faq`,
        url: copy.url,
        inLanguage: 'zh-TW',
        isPartOf: { '@id': `${copy.url}#webapp` },
        mainEntity: faqSchema,
      },
    ],
  };
  const staticSeo = renderStaticSeoHtml();
  const noscript = `${copy.name}是免費開源的輔助網站，可協助你查受理窗口、填表、產生草稿、預覽內容，並在確認後打開系統簡訊 App。${copy.doesNotStatement} ${copy.agentBoundary}`;

  return `<!doctype html>
<html lang="zh-TW">
<head>
  <meta charset="utf-8">
  <title>${html(copy.name)}</title>
  <meta name="description" content="${html(copy.description)}">
  <base href="/">
  <link rel="canonical" href="${html(copy.url)}">
  <link rel="alternate service-doc" type="text/markdown" href="/index.md">
  <link rel="alternate" type="text/plain" href="/llms.txt" title="llms.txt">
  <link rel="ai-catalog" type="application/json" href="${aiCatalogPath}">
  <link rel="ard" type="application/json" href="${ardPath}">
  <link rel="api-catalog" type="application/linkset+json" href="${apiCatalogPath}">
  <link rel="describedby" type="application/json" href="${oauthProtectedResourcePath}">
  <link rel="service-desc" type="application/json" href="${oauthAuthorizationServerPath}">
  <link rel="service-desc" type="application/json" href="/.well-known/agent-skills/index.json">
  <link rel="service-desc" type="application/json" href="${mcpCardPath}">
  <link rel="service-doc" type="text/markdown" href="/auth.md">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:type" content="website">
  <meta property="og:title" content="${html(copy.name)}">
  <meta property="og:description" content="${html(copy.description)}">
  <meta property="og:url" content="${html(copy.url)}">
  <meta property="og:image" content="${html(copy.url)}og-image.png">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="${html(copy.name)}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <link rel="icon" type="image/x-icon" href="favicon.ico">
  <link rel="manifest" href="manifest.webmanifest">
  <meta name="theme-color" content="#673ab7">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="default">
  <meta name="apple-mobile-web-app-title" content="簡訊報案">
  <link rel="apple-touch-icon" href="icons/icon-256x256.png">
  <link rel="preload" href="material-icons.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="roboto-latin-400.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="roboto-latin-500.woff2" as="font" type="font/woff2" crossorigin>
  <style>
${staticStyle()}
  </style>
  <script type="application/ld+json">
${jsonForScript(structuredData)}
  </script>
</head>
<body>
  <app-root></app-root>
${staticSeo}
  <noscript>
    ${html(noscript)}
  </noscript>
</body>
</html>
`;
}

function renderStaticSeoHtml() {
  const doList = copy.does.map((item) => `      <li>${html(item)}</li>`).join('\n');
  const notList = copy.doesNot.map((item) => `      <li>${html(notAction(item))}</li>`).join('\n');

  return `  <section class="seo-static-content" aria-labelledby="seo-static-title">
    <h2 id="seo-static-title">${html(copy.name)}</h2>
    <p>📅 更新日期：${html(copy.updated)}</p>
    <p>${html(copy.description)}</p>
    <h3>可以做什麼</h3>
    <ul>
${doList}
    </ul>
    <h3>不做什麼</h3>
    <ul>
${notList}
    </ul>
    <p>${html(copy.agentBoundary)}</p>
    <h3>常見問題</h3>
${renderFaqHtml()}
  </section>`;
}

function staticStyle() {
  return `    @font-face {
      font-family: "Material Icons";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("material-icons.woff2") format("woff2");
    }
    .material-icons {
      font-family: "Material Icons", sans-serif;
      font-weight: normal;
      font-style: normal;
      font-size: 24px;
      line-height: 1;
      letter-spacing: normal;
      text-transform: none;
      display: inline-block;
      white-space: nowrap;
      word-wrap: normal;
      direction: ltr;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: "liga";
    }
    .seo-static-content {
      box-sizing: border-box;
      max-width: 48rem;
      margin: 0 auto;
      padding: 1.5rem;
      font-family: Roboto, "Noto Sans TC", sans-serif;
      line-height: 1.7;
    }
    app-root[ng-version] + .seo-static-content,
    app-root:not(:empty) + .seo-static-content {
      display: none;
    }
    @font-face {
      font-family: "Roboto";
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url("roboto-latin-400.woff2") format("woff2");
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
        U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
        U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    @font-face {
      font-family: "Roboto";
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url("roboto-latin-500.woff2") format("woff2");
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6,
        U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122,
        U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }`;
}
