import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);
const previewRoot = new URL("../app/_sites-preview/", import.meta.url);

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the Baton Rouge civic map", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(
    html,
    /<title>Baton Rouge Civic Map \| We the People Baton Rouge<\/title>/i,
  );
  assert.match(html, /Baton Rouge government, simplified/);
  assert.match(html, /Citizens of East Baton Rouge Parish/);
  assert.match(html, /Judicial Branch/);
  assert.match(html, /State Constitutional Offices/);
  assert.match(html, /Executive Branch/);
  assert.match(html, /Legislative Branch/);
  assert.match(html, /Mayor-President \*/);
  assert.match(html, /Metropolitan Council \*/);
  assert.match(html, /Municipal Fire &amp; Police Civil Service Board \*\*/);
  assert.match(html, /Search offices/);
  assert.match(html, /Police, council, assessor/);
  assert.match(html, /Focused view/);
  assert.match(html, /Reset map/);
  assert.match(html, /data-selection-assistant/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|SkeletonPreview/);
});

test("keeps the interactive surfaces wired", async () => {
  const [
    page,
    civicMap,
    civicData,
    selectionChat,
    explainRoute,
    layout,
    css,
    packageJson,
  ] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/CivicMap.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/civic-data.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/SelectionExplainChat.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/explain/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);

  assert.match(page, /<CivicMap branches=\{branches\}/);
  assert.match(civicMap, /"use client"/);
  assert.match(civicMap, /useState<BranchId \| null>/);
  assert.match(civicMap, /<SelectionExplainChat \/>/);
  assert.match(civicMap, /Search offices/);
  assert.match(civicMap, /aria-pressed/);
  assert.match(civicData, /branches:\s*Branch\[\]/);
  assert.match(selectionChat, /getSelectionState/);
  assert.match(selectionChat, /Explain/);
  assert.match(selectionChat, /\/api\/explain/);
  assert.match(explainRoute, /OPENAI_API_KEY/);
  assert.match(explainRoute, /https:\/\/api\.openai\.com\/v1\/responses/);
  assert.match(layout, /Baton Rouge Civic Map/);
  assert.match(css, /\.control-panel/);
  assert.match(css, /\.focus-panel/);
  assert.match(css, /\.selection-toolbar/);
  assert.match(css, /\.explain-chat/);
  assert.match(css, /\.map-canvas/);
  assert.match(css, /\.branch-grid::before/);
  assert.doesNotMatch(page, /codex-preview|SkeletonPreview|_sites-preview/);
  assert.doesNotMatch(layout, /codex-preview|_sites-preview/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.doesNotMatch(
    css,
    /sites-skeleton|loading-spinner|status-progress|cookie|random/i,
  );

  await assert.rejects(access(previewRoot));
  await assert.rejects(access(new URL("public/_sites-preview", templateRoot)));
});
