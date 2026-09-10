const SUPABASE_URL = 'https://dpffgbdazsjwxxdggugb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_H9Y4zUGaoAf2_IQOr_GaIA_qGXk3yRB';

(function(){
  const C=window.HobileNetCore;
  class HobileRoom {
    constructor(){
      this.client=null; this.channel=null; this.room=null;
      this.id=(crypto.randomUUID?.() || "p-"+Math.random().toString(36).slice(2));
      this.name="Player-"+this.id.slice(0,4).toUpperCase();
      this.team="CT"; this.creator=false; this.joinedAt=Date.now();
      this.players=[]; this.hostId=null; this.handlers={};
    }
    on(name,fn){ (this.handlers[name] ||= []).push(fn); return this; }
    emit(name,data){ for(const fn of this.handlers[name]||[]) try{fn(data)}catch(e){console.error(e)} }
    isHost(){ return this.hostId===this.id; }
    presencePayload(){
      return {id:this.id,name:this.name,team:this.team,creator:this.creator,joinedAt:this.joinedAt,onlineAt:new Date().toISOString()};
    }
    async connect(room,{creator=false,name=null,team="CT"}={}){
      if(!window.supabase?.createClient) throw new Error("Supabase client did not load");
      await this.disconnect();
      this.room=String(room).toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,8);
      this.creator=!!creator; this.team=team; if(name) this.name=name.slice(0,18);
      this.joinedAt=Date.now();
      this.client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
        auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}
      });
      this.channel=this.client.channel("hobile:"+this.room,{
        config:{presence:{key:this.id},broadcast:{self:false,ack:false}}
      });
      this.channel
        .on("presence",{event:"sync"},()=>this.syncPresence())
        .on("presence",{event:"join"},()=>this.syncPresence())
        .on("presence",{event:"leave"},()=>this.syncPresence())
        .on("broadcast",{event:"player_state"},m=>this.emit("player_state",m.payload))
        .on("broadcast",{event:"hit_request"},m=>this.emit("hit_request",m.payload))
        .on("broadcast",{event:"damage"},m=>this.emit("damage",m.payload))
        .on("broadcast",{event:"match_start"},m=>this.emit("match_start",m.payload))
        .on("broadcast",{event:"round_state"},m=>this.emit("round_state",m.payload))
        .on("broadcast",{event:"round_end"},m=>this.emit("round_end",m.payload))
        .on("broadcast",{event:"round_reset"},m=>this.emit("round_reset",m.payload))
        .on("broadcast",{event:"plant_request"},m=>this.emit("plant_request",m.payload))
        .on("broadcast",{event:"defuse_request"},m=>this.emit("defuse_request",m.payload))
        .on("broadcast",{event:"bomb_state"},m=>this.emit("bomb_state",m.payload))
        .on("broadcast",{event:"system"},m=>this.emit("system",m.payload));

      return new Promise((resolve,reject)=>{
        let settled=false;
        const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error("Realtime connection timed out"))}},12000);
        this.channel.subscribe(async status=>{
          this.emit("status",status);
          if(status==="SUBSCRIBED" && !settled){
            clearTimeout(timer);settled=true;
            await this.channel.track(this.presencePayload());
            this.syncPresence();resolve(this);
          } else if((status==="CHANNEL_ERROR"||status==="TIMED_OUT")&&!settled){
            clearTimeout(timer);settled=true;reject(new Error("Realtime channel "+status));
          }
        });
      });
    }
    syncPresence(){
      if(!this.channel) return;
      this.players=C.flattenPresence(this.channel.presenceState());
      this.hostId=C.electHost(this.players);
      this.emit("presence",{players:this.players,hostId:this.hostId});
    }
    async updateProfile({name,team}={}){
      if(name) this.name=name.slice(0,18);
      if(team) this.team=team;
      if(this.channel) await this.channel.track(this.presencePayload());
    }
    send(event,payload){
      if(!this.channel) return Promise.resolve("no-channel");
      return this.channel.send({type:"broadcast",event,payload:{...payload,from:this.id,room:this.room}});
    }
    async disconnect(){
      try{if(this.channel) await this.channel.untrack()}catch{}
      try{if(this.client&&this.channel) await this.client.removeChannel(this.channel)}catch{}
      this.channel=null;this.client=null;this.players=[];this.hostId=null;
    }
  }
  window.HobileRoom=HobileRoom;
})();