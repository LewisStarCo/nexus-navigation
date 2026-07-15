import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const variants = [
  { directory: "edge-extension", name: "Nexus Save", version: "1.3.0" },
  { directory: "chrome-extension", name: "Nexus Save for Chrome", version: "1.0.0" },
  { directory: "safari-extension", name: "Nexus Save for Safari", version: "1.0.0" },
];

for (const variant of variants) {
  test(`${variant.name} has a valid minimal-permission Manifest V3 package`, async () => {
    const manifest = JSON.parse(await readFile(`${variant.directory}/manifest.json`, "utf8"));
    assert.equal(manifest.manifest_version, 3);
    assert.equal(manifest.name, variant.name);
    assert.equal(manifest.version, variant.version);
    assert.deepEqual(manifest.permissions.sort(), ["activeTab", "scripting", "storage"]);
    assert.equal(manifest.action.default_popup, "popup.html");
    assert.equal(manifest.background.service_worker, "background.js");
    assert.deepEqual(manifest.host_permissions, ["https://nexus-navigation.vercel.app/*"]);
  });

  test(`${variant.name} includes editable metadata capture and the Nexus bridge`, async () => {
    const [popup, background, content] = await Promise.all([
      readFile(`${variant.directory}/popup.html`, "utf8"),
      readFile(`${variant.directory}/background.js`, "utf8"),
      readFile(`${variant.directory}/content.js`, "utf8"),
    ]);
    assert.match(popup, /id="page-description"/);
    assert.match(popup, /id="duplicate-note"/);
    assert.match(background, /description:/);
    assert.match(background, /existingIndex/);
    assert.match(background, /NEXUS_QUEUE_SAVE/);
    assert.match(content, /NEXUS_EXTENSION_SAVE/);
  });
}
