/* Elemental Swap V4 — optional 2P PeerJS/WebRTC layer. */
(function(){
  class ES4Network{
    constructor(){this.peer=null;this.conn=null;this.connected=false;this.isHost=false;this.room='';this.handlers=new Map();this.lastStateAt=0;}
    on(type,fn){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(fn);}
    emit(type,data){for(const fn of this.handlers.get(type)||[])fn(data);}
    requirePeer(){if(!window.Peer)throw new Error('PeerJS 尚未載入；單人模式仍可正常遊玩。');}
    host(){this.requirePeer();this.disconnect();this.isHost=true;this.peer=new Peer();this.peer.on('open',id=>{this.room=id;this.emit('room',id);this.emit('status','房間已建立，等待 P2');});this.peer.on('connection',c=>this.attach(c));this.peer.on('error',e=>this.emit('error',e.message||String(e)));}
    join(code){this.requirePeer();this.disconnect();this.isHost=false;this.room=String(code||'').trim();if(!this.room)throw new Error('請輸入房間代碼');this.peer=new Peer();this.peer.on('open',()=>this.attach(this.peer.connect(this.room,{reliable:true,serialization:'json'})));this.peer.on('error',e=>this.emit('error',e.message||String(e)));}
    attach(c){if(this.conn?.open)this.conn.close();this.conn=c;c.on('open',()=>{this.connected=true;this.emit('status','2P ONLINE');this.emit('connected',{isHost:this.isHost,peer:c.peer});});c.on('data',d=>{if(d&&typeof d==='object')this.emit(d.type||'message',d);});c.on('close',()=>{this.connected=false;this.emit('status','連線中斷');this.emit('disconnected');});c.on('error',e=>this.emit('error',e.message||String(e)));}
    send(type,payload){if(this.conn?.open){this.conn.send({type,payload});return true;}return false;}
    sendState(state,ms){if(!this.connected||ms-this.lastStateAt<50)return;this.lastStateAt=ms;this.send('playerState',state);}
    disconnect(){try{this.conn?.close();}catch{}try{this.peer?.destroy();}catch{}this.peer=this.conn=null;this.connected=false;this.room='';}
  }
  window.ES4Network=ES4Network;
})();
