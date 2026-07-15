/** Browser-only loader for the OAuth SDKs used by Calendar account import. */
export function loadRemoteScript(src: string, id: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("登录组件加载失败"));
    document.head.appendChild(script);
  });
}
