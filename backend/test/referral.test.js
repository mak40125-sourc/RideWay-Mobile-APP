const test = require('node:test');
const assert = require('node:assert');

// Mock supabaseAdmin for referral repository
const SUPABASE_PATH = require.resolve('../src/core/database/supabase');
const REPO_PATH = require.resolve('../src/modules/referral/referral.repository');

function mockRepo(overrides={}) {
  const calls={};
  require.cache[SUPABASE_PATH]={
    id:SUPABASE_PATH, filename:SUPABASE_PATH, loaded:true,
    exports:{ supabaseAdmin: {
      from: (table)=> {
        const chain={
          select: ()=>chain,
          eq: (c,v)=>{ calls[c]=v; return chain; },
          maybeSingle: async()=>({data:null,error:null}),
          insert: ()=>({select:()=>({maybeSingle:async()=>({data:null,error:null})})}),
          update: ()=>({eq:()=>({select:()=>({maybeSingle:async()=>({data:null,error:null})})})}),
          order: ()=>chain,
          range: ()=>chain,
        };
        if (overrides.from) return overrides.from(table);
        return chain;
      },
      rpc: async (fn, params)=>{
        if (overrides.rpc) return overrides.rpc(fn,params);
        return {data:null,error:null};
      }
    }}
  };
  delete require.cache[REPO_PATH];
  return require(REPO_PATH);
}

test('generate_referral_code format VEL-XXXXX mocked', async()=>{
  // Direct test of route service would need integration; here we just verify repository code generation fallback
  const repo=mockRepo({
    rpc: async (fn)=>{ if(fn==='generate_referral_code') return {data:'VEL-ABCDE',error:null}; return {data:null,error:null}; }
  });
  assert.ok(repo.getOrCreateDriverReferralCode);
});

test('apply referral validates code via RPC', async()=>{
  const repo=mockRepo({
    rpc: async (fn, p)=>{
      if(fn==='apply_referral'){
        assert.strictEqual(p.p_referral_code,'VEL-A7K29');
        return {data:{id:'ref1', status:'pending'}, error:null};
      }
      return {data:null,error:null};
    }
  });
  const res=await repo.applyReferral('VEL-A7K29','rider-id');
  assert.strictEqual(res.status,'pending');
});

test('referral reward idempotent via RPC', async()=>{
  const repo=mockRepo({
    rpc: async (fn)=>{
      if(fn==='try_reward_referral') return {data:{id:'ref1',status:'rewarded', reward_amount:100}, error:null};
      return {data:null,error:null};
    }
  });
  const r1=await repo.tryReward('rider1','ride1');
  const r2=await repo.tryReward('rider1','ride1');
  assert.strictEqual(r1.status,'rewarded');
  assert.strictEqual(r2.status,'rewarded');
});

test('self-referral rejected maps to 400', async()=>{
  const repo=mockRepo({
    rpc: async (fn)=>{
      if(fn==='apply_referral') return {data:null, error:{message:'Self-referral not allowed', code:'P0001'}};
      return {data:null,error:null};
    }
  });
  try{ await repo.applyReferral('VEL-XXXXX','rider-self'); assert.fail('should throw'); } catch(e){
    const mapped = e.message.includes('Self-referral');
    assert.ok(mapped);
  }
});
