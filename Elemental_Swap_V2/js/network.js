/*
 * Elemental Swap V2 - network.js
 * ------------------------------------------------------------
 * 雙人原型層：PeerJS + WebRTC DataConnection。
 *
 * 設計目的：
 * - GitHub Pages 是靜態網站，不能自己跑 Node 遊戲伺服器。
 * - 先用 PeerJS 協助交換連線資訊，再由瀏覽器之間建立 WebRTC P2P。
 * - Host 保留較多世界狀態權威；Guest 主要送玩家輸入/狀態。
 *
 * 注意：這是「可展示的 2P prototype」，不是競技遊戲等級 netcode。
 * 真正商用會需要 authoritative server、插值、reconciliation、rollback、TURN 等。
 */

(function () {
  class ESNetwork {
    constructor() {
      this.peer = null;
      this.conn = null;
      this.isHost = false;
      this.connected = false;
      this.roomCode = "";
      this.remoteState = null;
      this.handlers = new Map();
      this.lastSent = 0;
    }

    on(type, fn) {
      if (!this.handlers.has(type)) this.handlers.set(type, []);
      this.handlers.get(type).push(fn);
    }

    emit(type, payload) {
      const list = this.handlers.get(type) || [];
      for (const fn of list) fn(payload);
    }

    ensurePeerJS() {
      if (!window.Peer) {
        throw new Error("PeerJS 尚未載入。請確認網路連線，或檢查 index.html 的 PeerJS CDN。\n本機離線遊玩不受影響。")
      }
    }

    createRoom() {
      this.ensurePeerJS();
      this.disconnect();
      this.isHost = true;
      this.peer = new Peer();
      this.peer.on("open", (id) => {
        this.roomCode = id;
        this.emit("room", id);
        this.emit("status", `房間已建立：${id}`);
      });
      this.peer.on("connection", (conn) => this.attachConnection(conn));
      this.peer.on("error", (err) => this.emit("error", err.message || String(err)));
    }

    joinRoom(code) {
      this.ensurePeerJS();
      this.disconnect();
      this.isHost = false;
      this.roomCode = String(code || "").trim();
      if (!this.roomCode) throw new Error("請輸入房間代碼。");
      this.peer = new Peer();
      this.peer.on("open", () => {
        const conn = this.peer.connect(this.roomCode, { reliable: true, serialization: "json" });
        this.attachConnection(conn);
      });
      this.peer.on("error", (err) => this.emit("error", err.message || String(err)));
    }

    attachConnection(conn) {
      if (this.conn && this.conn.open) this.conn.close();
      this.conn = conn;
      conn.on("open", () => {
        this.connected = true;
        this.emit("status", "2P 已連線");
        this.emit("connected", { isHost: this.isHost, peer: conn.peer });
        this.send({ type: "hello", isHost: this.isHost, version: window.ES_CONFIG?.VERSION });
      });
      conn.on("data", (data) => {
        if (!data || typeof data !== "object") return;
        if (data.type === "state") this.remoteState = data.state;
        this.emit(data.type || "message", data);
      });
      conn.on("close", () => {
        this.connected = false;
        this.emit("status", "2P 連線已中斷");
        this.emit("disconnected", null);
      });
      conn.on("error", (err) => this.emit("error", err.message || String(err)));
    }

    send(payload) {
      if (this.conn && this.conn.open) {
        this.conn.send(payload);
        return true;
      }
      return false;
    }

    sendState(state, nowMs) {
      // 不需要每個 requestAnimationFrame 都送封包；約 20Hz 已足夠做原型。
      if (!this.connected) return;
      if (nowMs - this.lastSent < 50) return;
      this.lastSent = nowMs;
      this.send({ type: "state", state });
    }

    disconnect() {
      try { if (this.conn) this.conn.close(); } catch (_) {}
      try { if (this.peer) this.peer.destroy(); } catch (_) {}
      this.conn = null;
      this.peer = null;
      this.connected = false;
      this.remoteState = null;
      this.roomCode = "";
    }
  }

  window.ESNetwork = ESNetwork;
})();
