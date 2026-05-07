// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS PAGE  →  app/dashboard/analytics/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, BarChart2, Shield, PieChart, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useMarket } from "@/hooks/useMarket";

type TimeRange = "1M" | "1Y" | "All";
interface PortfolioPoint { date: string; stocks: number; crypto: number; funds: number; }

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
  hover:   "var(--color-surface-hover)",
};

function generatePerformanceData(range: TimeRange): PortfolioPoint[] {
  const points = range==="1M"?30:range==="1Y"?52:120;
  const data: PortfolioPoint[] = [];
  let stocks=72000,crypto=55000,funds=65000;
  for(let i=points;i>=0;i--){
    const d=new Date();
    if(range==="1M") d.setDate(d.getDate()-i);
    else if(range==="1Y") d.setDate(d.getDate()-i*7);
    else d.setDate(d.getDate()-i*3);
    stocks+=(Math.random()-0.46)*1800; crypto+=(Math.random()-0.44)*2400; funds+=(Math.random()-0.48)*900;
    const label=range==="1M"?d.toLocaleDateString("en-IN",{day:"numeric",month:"short"}):range==="1Y"?d.toLocaleDateString("en-IN",{month:"short",year:"2-digit"}):d.toLocaleDateString("en-IN",{month:"short",year:"numeric"});
    data.push({date:label,stocks:Math.max(40000,+stocks.toFixed(0)),crypto:Math.max(30000,+crypto.toFixed(0)),funds:Math.max(45000,+funds.toFixed(0))});
  }
  return data;
}

function RiskGauge({score}:{score:number}){
  const r=72,cx=100,cy=96,circ=Math.PI*r;
  const progress=(score/100)*circ;
  const color=score<40?"#8FFFD6":score<70?"#f59e0b":"#ef4444";
  const label=score<30?"Low":score<55?"Moderate":score<75?"Elevated":"High";
  const angle=-180+(score/100)*180;
  const rad=(angle*Math.PI)/180;
  const nx=cx+54*Math.cos(rad),ny=cy+54*Math.sin(rad);
  return(
    <div style={{display:"flex",flexDirection:"column",alignItems:"center"}}>
      <svg width={200} height={110} viewBox="0 0 200 110">
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke="var(--color-line)" strokeWidth={14} strokeLinecap="round"/>
        <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`} fill="none" stroke={color} strokeWidth={14} strokeLinecap="round" strokeDasharray={`${progress} ${circ}`} style={{transition:"stroke-dasharray 1s"}}/>
        {[0,25,50,75,100].map(tick=>{const a=-180+(tick/100)*180,ar=(a*Math.PI)/180;return <line key={tick} x1={cx+(r-7)*Math.cos(ar)} y1={cy+(r-7)*Math.sin(ar)} x2={cx+(r+7)*Math.cos(ar)} y2={cy+(r+7)*Math.sin(ar)} stroke="var(--color-line-strong)" strokeWidth={1.5}/>;}) }
        <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={color} strokeWidth={2.5} strokeLinecap="round" style={{transition:"all 1s"}}/>
        <circle cx={cx} cy={cy} r={5} fill={color}/>
        <text x={cx-r-4} y={cy+18} fill="var(--color-muted)" fontSize={10} textAnchor="middle">0</text>
        <text x={cx+r+4} y={cy+18} fill="var(--color-muted)" fontSize={10} textAnchor="middle">100</text>
      </svg>
      <div style={{textAlign:"center",marginTop:-8}}>
        <div style={{fontSize:36,fontWeight:800,color,lineHeight:1}}>{score}</div>
        <div style={{marginTop:6,fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:6,background:`${color}15`,color,border:`1px solid ${color}30`}}>{label} Risk</div>
      </div>
    </div>
  );
}

const PerfTooltip=({active,payload,label,currencySymbol}:any)=>{
  if(!active||!payload?.length) return null;
  return(
    <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:10,padding:"12px 16px",fontSize:12,minWidth:160}}>
      <p style={{color:C.muted,marginBottom:8,fontSize:11}}>{label}</p>
      {payload.map((p:any)=>(
        <div key={p.dataKey} style={{display:"flex",justifyContent:"space-between",gap:16,marginBottom:4}}>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:8,height:8,borderRadius:"50%",background:p.color}}/>
            <span style={{color:C.muted,textTransform:"capitalize"}}>{p.dataKey}</span>
          </div>
          <span style={{color:C.primary,fontWeight:600}}>{currencySymbol}{Number(p.value).toLocaleString("en-IN",{minimumFractionDigits:0})}</span>
        </div>
      ))}
    </div>
  );
};

function StatCard({label,value,change,changeAmt,positive,currencySymbol}:{label:string;value:string;change:string;changeAmt:string;positive:boolean;currencySymbol:string}){
  return(
    <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"20px 22px"}}>
      <p style={{color:C.muted,fontSize:11,margin:"0 0 10px",textTransform:"uppercase",letterSpacing:0.6}}>{label}</p>
      <div style={{fontSize:26,fontWeight:800,color:C.primary,letterSpacing:-0.5,marginBottom:8}}>{currencySymbol}{value}</div>
      <div style={{display:"flex",alignItems:"center",gap:6}}>
        <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:6,background:positive?"rgba(143,255,214,0.08)":"rgba(239,68,68,0.08)",border:`1px solid ${positive?"rgba(143,255,214,0.2)":"rgba(239,68,68,0.2)"}`}}>
          {positive?<ArrowUpRight size={12} color="#8FFFD6"/>:<ArrowDownRight size={12} color="#ef4444"/>}
          <span style={{color:positive?"#8FFFD6":"#ef4444",fontSize:12,fontWeight:600}}>{change}</span>
        </div>
        <span style={{color:C.muted,fontSize:12}}>{changeAmt}</span>
      </div>
    </div>
  );
}

function AllocationDonut({segments}:{segments:{label:string;pct:number;color:string}[]}){
  const r=44,cx=60,cy=60,circ=2*Math.PI*r;
  let cum=0;
  const slices=segments.map(s=>{
    const da=`${(s.pct/100)*circ} ${circ}`,do_=-((cum/100)*circ);
    cum+=s.pct;return{...s,dashArray:da,dashOffset:do_};
  });
  return(
    <div style={{display:"flex",alignItems:"center",gap:24}}>
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-line)" strokeWidth={16}/>
        {slices.map(s=><circle key={s.label} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={16} strokeDasharray={s.dashArray} strokeDashoffset={s.dashOffset} style={{transform:`rotate(-90deg)`,transformOrigin:`${cx}px ${cy}px`,transition:"stroke-dasharray 1s ease"}}/>)}
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fill="var(--color-primary)" fontSize={11} fontWeight={700}>Portfolio</text>
      </svg>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {segments.map(s=>(
          <div key={s.label} style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:10,height:10,borderRadius:3,background:s.color,flexShrink:0}}/>
            <span style={{color:C.muted,fontSize:12}}>{s.label}</span>
            <span style={{color:C.primary,fontSize:12,fontWeight:600,marginLeft:"auto"}}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AnalyticsPage(){
  const {market}=useMarket();
  const currencySymbol=market?.currency??"₹";
  const [range,setRange]=useState<TimeRange>("1Y");
  const [data,setData]=useState<PortfolioPoint[]>([]);
  useEffect(()=>{setData(generatePerformanceData(range));},[range]);
  const LINES=[{key:"stocks",color:"#8FFFD6",label:"Stocks"},{key:"crypto",color:"#818cf8",label:"Crypto"},{key:"funds",color:"#f59e0b",label:"Funds"}];
  const allocSegs=[{label:"Stocks",pct:48,color:"#8FFFD6"},{label:"Crypto",pct:30,color:"#818cf8"},{label:"Funds",pct:22,color:"#f59e0b"}];
  return(
    <>
      <style>{`.range-pill{transition:all 0.2s;cursor:pointer;}.range-pill:hover{opacity:0.8;}.section-card:hover{border-color:var(--color-line-strong)!important;}`}</style>
      <div style={{padding:"28px 32px",maxWidth:1200,margin:"0 auto",background:C.page,minHeight:"100vh"}}>
        <div style={{marginBottom:28}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6}}>
            <BarChart2 size={20} color="#8FFFD6"/>
            <h1 style={{fontSize:22,fontWeight:700,color:C.primary,margin:0}}>Performance Analytics</h1>
          </div>
          <p style={{color:C.muted,fontSize:13,margin:0}}>Track your portfolio performance, risk exposure, and asset allocation</p>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:20}}>
          <StatCard label="Gruvail Portfolio"  value="93,314.56" change="+6.42%" changeAmt={`+${currencySymbol}5,621`} positive={true}  currencySymbol={currencySymbol}/>
          <StatCard label="Overall Portfolio"  value="5,300.56"  change="+4.75%" changeAmt={`+${currencySymbol}1.27%`} positive={true}  currencySymbol={currencySymbol}/>
          <StatCard label="Unrealised P&L"     value="12,480.00" change="-2.13%" changeAmt={`-${currencySymbol}271`}   positive={false} currencySymbol={currencySymbol}/>
        </div>

        <div className="section-card" style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"22px 24px",marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:22}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <Activity size={15} color="#8FFFD6"/>
              <span style={{color:C.primary,fontWeight:600,fontSize:14}}>Portfolio Performance</span>
            </div>
            <div style={{display:"flex",gap:4}}>
              <div style={{display:"flex",gap:14,marginRight:16,alignItems:"center"}}>
                {LINES.map(l=><div key={l.key} style={{display:"flex",alignItems:"center",gap:5}}><div style={{width:10,height:10,borderRadius:"50%",background:l.color}}/><span style={{color:C.muted,fontSize:11}}>{l.label}</span></div>)}
              </div>
              <div style={{display:"flex",background:C.page,border:`1px solid ${C.line}`,borderRadius:8,padding:3,gap:2}}>
                {(["1M","1Y","All"] as TimeRange[]).map(r=>(
                  <button key={r} className="range-pill" onClick={()=>setRange(r)} style={{padding:"5px 12px",borderRadius:6,border:"none",cursor:"pointer",fontSize:11,fontWeight:600,background:range===r?C.card:"transparent",color:range===r?"#8FFFD6":C.muted}}>{r}</button>
                ))}
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data} margin={{top:4,right:4,left:0,bottom:0}}>
              <CartesianGrid stroke="var(--color-line)" strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="date" tick={{fill:"var(--color-muted)",fontSize:10}} axisLine={false} tickLine={false} interval={Math.floor(data.length/8)}/>
              <YAxis tick={{fill:"var(--color-muted)",fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${currencySymbol}${(v/1000).toFixed(0)}k`} width={56} domain={["auto","auto"]}/>
              <Tooltip content={(p)=><PerfTooltip {...p} currencySymbol={currencySymbol}/>}/>
              {LINES.map(l=><Line key={l.key} type="monotone" dataKey={l.key} stroke={l.color} strokeWidth={2} dot={false} activeDot={{r:4,fill:l.color,strokeWidth:0}}/>)}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:14,marginBottom:20}}>
          <div className="section-card" style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"22px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
              <Shield size={15} color="#8FFFD6"/>
              <span style={{color:C.primary,fontWeight:600,fontSize:14}}>Risk Assessment</span>
              <span style={{marginLeft:"auto",fontSize:11,color:C.muted,background:C.page,border:`1px solid ${C.line}`,padding:"2px 8px",borderRadius:5}}>AI-powered</span>
            </div>
            <RiskGauge score={76}/>
            <div style={{marginTop:24}}>
              {[{label:"Market Volatility",val:68,color:"#f59e0b"},{label:"Concentration Risk",val:42,color:"#8FFFD6"},{label:"Liquidity Risk",val:28,color:"#8FFFD6"},{label:"Currency Exposure",val:55,color:"#f59e0b"}].map(({label,val,color})=>(
                <div key={label} style={{marginBottom:12}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{fontSize:12,color:C.muted}}>{label}</span>
                    <span style={{fontSize:12,color,fontWeight:600}}>{val}</span>
                  </div>
                  <div style={{height:4,background:C.line,borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${val}%`,background:color,borderRadius:2,transition:"width 0.8s"}}/>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="section-card" style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"22px 24px"}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24}}>
              <PieChart size={15} color="#8FFFD6"/>
              <span style={{color:C.primary,fontWeight:600,fontSize:14}}>Asset Allocation</span>
            </div>
            <AllocationDonut segments={allocSegs}/>
            <div style={{marginTop:28}}>
              {[{label:"Best Performer",value:"NVDA",change:"+142%",positive:true},{label:"Worst Performer",value:"SNAP",change:"-31%",positive:false},{label:"Most Held",value:"AAPL",change:"23 shares",positive:true},{label:"Highest Value",value:"RELIANCE",change:`${currencySymbol}2.1L`,positive:true}].map(({label,value,change,positive})=>(
                <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 0",borderBottom:`1px solid ${C.line}`}}>
                  <span style={{fontSize:12,color:C.muted}}>{label}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:13,color:C.primary,fontWeight:600}}>{value}</span>
                    <span style={{fontSize:11,color:positive?"#8FFFD6":"#ef4444"}}>{change}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="section-card" style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"22px 24px"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
            <TrendingUp size={15} color="#8FFFD6"/>
            <span style={{color:C.primary,fontWeight:600,fontSize:14}}>Monthly Returns</span>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(12,1fr)",gap:6}}>
            {[{month:"Jan",ret:4.2},{month:"Feb",ret:-1.8},{month:"Mar",ret:6.7},{month:"Apr",ret:2.1},{month:"May",ret:-3.4},{month:"Jun",ret:5.8},{month:"Jul",ret:8.2},{month:"Aug",ret:-0.9},{month:"Sep",ret:3.1},{month:"Oct",ret:-2.2},{month:"Nov",ret:7.4},{month:"Dec",ret:1.9}].map(({month,ret})=>{
              const pos=ret>=0,intensity=Math.min(Math.abs(ret)/10,1);
              return(
                <div key={month} style={{background:pos?`rgba(143,255,214,${0.06+intensity*0.25})`:`rgba(239,68,68,${0.06+intensity*0.25})`,border:`1px solid ${pos?"rgba(143,255,214,0.15)":"rgba(239,68,68,0.15)"}`,borderRadius:8,padding:"10px 4px",textAlign:"center"}}>
                  <div style={{fontSize:10,color:C.muted,marginBottom:4}}>{month}</div>
                  <div style={{fontSize:12,fontWeight:700,color:pos?"#8FFFD6":"#ef4444"}}>{pos?"+":""}{ret}%</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}