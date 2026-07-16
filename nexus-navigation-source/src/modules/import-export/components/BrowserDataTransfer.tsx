"use client";

import { useRef, useState, type ChangeEvent } from "react";

import { migrateToCurrent } from "@/src/core/migrations";
import type { NexusData } from "@/src/shared/types";
import { parseNexusBackup } from "../services/backupService";

interface Props {
  exportData: () => Promise<string>;
  importData: (rawData: string) => Promise<NexusData>;
}

interface Preview {
  name: string;
  rawData: string;
  data: NexusData;
}

export function BrowserDataTransfer({ exportData, importData }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function downloadForDesktop() {
    setBusy(true);
    setMessage("");
    try {
      const rawData = await exportData();
      const blobUrl = URL.createObjectURL(new Blob([rawData], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = blobUrl;
      anchor.download = `nexus-web-data-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(blobUrl);
      setMessage("已下载 Nexus JSON。请在 Nexus Desktop 的数据迁移区域选择该文件。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导出失败");
    } finally {
      setBusy(false);
    }
  }

  async function selectBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setMessage("");
    try {
      const rawData = await file.text();
      const data = migrateToCurrent(parseNexusBackup(rawData));
      setPreview({ name: file.name, rawData, data });
      setMessage("预览完成；确认前不会修改当前网页数据。");
    } catch (error) {
      setPreview(null);
      setMessage(error instanceof Error ? error.message : "无法读取 Nexus JSON");
    } finally {
      setBusy(false);
    }
  }

  async function confirmImport() {
    if (!preview) return;
    setBusy(true);
    try {
      await importData(preview.rawData);
      setPreview(null);
      setMessage("数据已恢复到当前浏览器。原 JSON 文件没有上传到服务器。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入失败，原数据未修改");
    } finally {
      setBusy(false);
    }
  }

  return <section className="setting-section browser-data-transfer">
    <div className="setting-title"><h3>Web ↔ Desktop 数据迁移</h3><span>LOCAL JSON</span></div>
    <p className="field-help">浏览器和 Desktop 的本地存储彼此隔离。使用 JSON 手动迁移；文件只在本机处理，不会上传。完整备份可能包含你保存的 BYOK API Key，请妥善保管。</p>
    <div className="browser-transfer-actions"><button disabled={busy} onClick={() => void downloadForDesktop()}>导出给 Desktop</button><button disabled={busy} onClick={() => fileInput.current?.click()}>从 Desktop JSON 恢复</button><input ref={fileInput} type="file" accept="application/json,.json" onChange={(event) => void selectBackup(event)} /></div>
    {preview && <div className="browser-import-preview"><small>RESTORE PREVIEW</small><strong>{preview.name}</strong><div><span>Schema <b>v{preview.data.schemaVersion}</b></span><span>分类 <b>{preview.data.categories.length}</b></span><span>Resource <b>{preview.data.resources.length}</b></span><span>Event <b>{preview.data.events.length}</b></span></div><p>用户名：{preview.data.settings.username || "未设置"} · AI Provider：{preview.data.aiPlanner.provider}。API Key 不会显示在摘要中。</p><footer><button onClick={() => setPreview(null)}>取消</button><button className="primary" disabled={busy} onClick={() => void confirmImport()}>确认并恢复</button></footer></div>}
    {message && <p className="browser-transfer-status" role="status">{message}</p>}
  </section>;
}
