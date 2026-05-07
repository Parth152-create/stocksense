"use client";

import { useState } from "react";
import { User, Mail, Lock, Bell, MessageSquare, Eye, EyeOff, ShieldCheck, CreditCard } from "lucide-react";

const C = {
  page:    "var(--color-page)",
  card:    "var(--color-card)",
  line:    "var(--color-line)",
  hover:   "var(--color-surface-hover)",
  primary: "var(--color-primary)",
  muted:   "var(--color-muted)",
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button onClick={onChange} style={{
      width:44,height:24,borderRadius:12,border:"none",cursor:"pointer",padding:3,
      background:checked?"linear-gradient(135deg,#8FFFD6,#00c896)":"var(--color-line)",
      transition:"background 0.3s",display:"flex",alignItems:"center",
      justifyContent:checked?"flex-end":"flex-start",flexShrink:0,
    }}>
      <div style={{width:18,height:18,borderRadius:"50%",background:checked?"#0a0a0a":"var(--color-muted)",transition:"all 0.25s cubic-bezier(0.16,1,0.3,1)",boxShadow:"0 1px 4px rgba(0,0,0,0.4)"}}/>
    </button>
  );
}

function SectionCard({children,style}:{children:React.ReactNode;style?:React.CSSProperties}) {
  return (
    <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:24,...style}}>
      {children}
    </div>
  );
}

function SectionTitle({icon,label}:{icon:React.ReactNode;label:string}) {
  return (
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20}}>
      <div style={{color:"#8FFFD6"}}>{icon}</div>
      <span style={{color:C.primary,fontWeight:700,fontSize:15}}>{label}</span>
    </div>
  );
}

function InputField({label,value,onChange,type="text",placeholder,rightEl}:{
  label:string;value:string;onChange:(v:string)=>void;type?:string;placeholder?:string;rightEl?:React.ReactNode;
}) {
  return (
    <div style={{marginBottom:16}}>
      <label style={{display:"block",color:C.muted,fontSize:12,marginBottom:7,fontWeight:500}}>{label}</label>
      <div style={{position:"relative"}}>
        <input type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)}
          style={{width:"100%",background:C.page,border:`1px solid ${C.line}`,borderRadius:9,color:C.primary,fontSize:14,padding:rightEl?"10px 40px 10px 14px":"10px 14px",outline:"none",boxSizing:"border-box",transition:"border-color 0.2s",fontFamily:"inherit"}}
          onFocus={e=>(e.target.style.borderColor="#8FFFD6")}
          onBlur={e=>(e.target.style.borderColor="var(--color-line)")}/>
        {rightEl&&<div style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)"}}>{rightEl}</div>}
      </div>
    </div>
  );
}

function NotifRow({icon,label,checked,onChange,last=false}:{icon:React.ReactNode;label:string;checked:boolean;onChange:()=>void;last?:boolean}) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 0",borderBottom:last?"none":`1px solid ${C.line}`}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{color:C.muted}}>{icon}</div>
        <span style={{color:C.primary,fontSize:14}}>{label}</span>
      </div>
      <Toggle checked={checked} onChange={onChange}/>
    </div>
  );
}

function ProfileAvatar({name}:{name:string}) {
  const initials=name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{width:64,height:64,borderRadius:"50%",background:"linear-gradient(135deg,#8FFFD6,#00c896)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:20,color:"#0a0a0a",flexShrink:0,border:`3px solid ${C.line}`}}>
      {initials}
    </div>
  );
}

export default function SettingsPage() {
  const [name,setName]                   = useState("John Doe");
  const [email,setEmail]                 = useState("macillle@gmail.com");
  const [showPassword,setShowPassword]   = useState(false);
  const [password,setPassword]           = useState("password123");
  const [twoFA,setTwoFA]                 = useState(true);
  const [priceAlerts,setPriceAlerts]     = useState(true);
  const [txEmails,setTxEmails]           = useState(true);
  const [mentMessages,setMentMessages]   = useState(false);
  const [txEmails2,setTxEmails2]         = useState(false);
  const [saved,setSaved]                 = useState(false);

  const handleSave=()=>{setSaved(true);setTimeout(()=>setSaved(false),2200);};

  return (
    <>
      <style>{`@keyframes fadeInUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}input::placeholder{color:var(--color-muted);}`}</style>
      <div style={{padding:"28px 32px",maxWidth:1100,margin:"0 auto",animation:"fadeInUp 0.4s ease",background:C.page,minHeight:"100vh"}}>

        {/* Header */}
        <div style={{marginBottom:24}}>
          <h1 style={{fontSize:24,fontWeight:800,color:C.primary,margin:"0 0 6px"}}>Profile</h1>
          <p style={{color:C.muted,fontSize:13,margin:0}}>Manage your account, security, and notification preferences</p>
        </div>

        {/* Profile Banner */}
        <div style={{background:C.card,border:`1px solid ${C.line}`,borderRadius:14,padding:"18px 24px",marginBottom:18,display:"flex",alignItems:"center",gap:16}}>
          <ProfileAvatar name={name}/>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:700,color:C.primary}}>{name}</div>
            <div style={{fontSize:13,color:C.muted,marginTop:2}}>{email}</div>
          </div>
          <span style={{fontSize:11,color:"#8FFFD6",background:"rgba(143,255,214,0.08)",border:"1px solid rgba(143,255,214,0.2)",borderRadius:6,padding:"4px 10px",fontWeight:600}}>Pro Member</span>
        </div>

        {/* Two-column grid */}
        <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) minmax(0,1fr)",gap:16}}>

          {/* LEFT */}
          <div style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* Personal Information */}
            <SectionCard>
              <SectionTitle icon={<User size={15}/>} label="Personal Information"/>
              <InputField label="Name"     value={name}     onChange={setName}     placeholder="Your full name"/>
              <InputField label="Email"    value={email}    onChange={setEmail}    placeholder="your@email.com" type="email"/>
              <InputField label="Password" value={password} onChange={setPassword} type={showPassword?"text":"password"} placeholder="••••••••"
                rightEl={
                  <button onClick={()=>setShowPassword(!showPassword)} style={{background:"none",border:"none",cursor:"pointer",color:C.muted,padding:0,display:"flex"}}>
                    {showPassword?<EyeOff size={15}/>:<Eye size={15}/>}
                  </button>
                }/>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginTop:-4}} onClick={()=>setShowPassword(!showPassword)}>
                <div style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${showPassword?"#8FFFD6":C.line}`,background:showPassword?"rgba(143,255,214,0.15)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all 0.2s",flexShrink:0}}>
                  {showPassword&&<svg width="10" height="10" viewBox="0 0 10 10"><polyline points="1.5,5 4,7.5 8.5,2.5" fill="none" stroke="#8FFFD6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <span style={{color:C.muted,fontSize:12}}>Show your password</span>
              </label>
            </SectionCard>

            {/* Security Left */}
            <SectionCard>
              <SectionTitle icon={<ShieldCheck size={15}/>} label="Security"/>
              <button style={{width:"100%",padding:"12px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:"linear-gradient(135deg,#8FFFD6,#00c896)",color:"#0a0a0a",marginBottom:16,letterSpacing:0.3,transition:"filter 0.2s"}}
                onMouseOver={e=>(e.currentTarget.style.filter="brightness(1.1)")} onMouseOut={e=>(e.currentTarget.style.filter="brightness(1)")}>
                Change Password
              </button>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:14,borderTop:`1px solid ${C.line}`}}>
                <div>
                  <div style={{color:C.primary,fontSize:14,fontWeight:500}}>2FA</div>
                  <div style={{color:C.muted,fontSize:12,marginTop:2}}>Toggle save password</div>
                </div>
                <Toggle checked={twoFA} onChange={()=>setTwoFA(!twoFA)}/>
              </div>
            </SectionCard>
          </div>

          {/* RIGHT */}
          <div style={{display:"flex",flexDirection:"column",gap:16}}>

            {/* Security Right */}
            <SectionCard>
              <SectionTitle icon={<Lock size={15}/>} label="Security"/>
              <button style={{width:"100%",padding:"12px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:700,fontSize:14,background:"linear-gradient(135deg,#8FFFD6,#00c896)",color:"#0a0a0a",marginBottom:16,letterSpacing:0.3,transition:"filter 0.2s"}}
                onMouseOver={e=>(e.currentTarget.style.filter="brightness(1.1)")} onMouseOut={e=>(e.currentTarget.style.filter="brightness(1)")}>
                Change Password
              </button>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",paddingTop:14,borderTop:`1px solid ${C.line}`}}>
                <div>
                  <div style={{color:C.primary,fontSize:14,fontWeight:500}}>2FA</div>
                  <div style={{color:C.muted,fontSize:12,marginTop:2}}>Toggle sopo password</div>
                </div>
                <Toggle checked={twoFA} onChange={()=>setTwoFA(!twoFA)}/>
              </div>
            </SectionCard>

            {/* Notifications */}
            <SectionCard>
              <SectionTitle icon={<Bell size={15}/>} label="Notification Preferences"/>
              <NotifRow icon={<Bell size={15}/>}          label="Price Alerts"       checked={priceAlerts}  onChange={()=>setPriceAlerts(!priceAlerts)}/>
              <NotifRow icon={<Mail size={15}/>}          label="Transaction Emails" checked={txEmails}     onChange={()=>setTxEmails(!txEmails)}/>
              <NotifRow icon={<MessageSquare size={15}/>} label="Ment Messages"      checked={mentMessages} onChange={()=>setMentMessages(!mentMessages)}/>
              <NotifRow icon={<CreditCard size={15}/>}    label="Transaction Emails" checked={txEmails2}    onChange={()=>setTxEmails2(!txEmails2)} last/>
            </SectionCard>

            {/* Save */}
            <button onClick={handleSave} style={{width:"100%",padding:"14px 0",borderRadius:12,border:"none",cursor:"pointer",fontWeight:700,fontSize:15,letterSpacing:0.4,background:saved?"linear-gradient(135deg,#22c55e,#16a34a)":"linear-gradient(135deg,#8FFFD6,#00c896)",color:"#0a0a0a",transition:"all 0.3s",boxShadow:saved?"0 0 0 3px rgba(34,197,94,0.2)":"none"}}>
              {saved?"✓ Changes Saved!":"Save Changes"}
            </button>

            {/* Danger Zone */}
            <SectionCard>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14}}>
                <ShieldCheck size={15} color="#ef4444"/>
                <span style={{color:"#ef4444",fontWeight:700,fontSize:15}}>Danger Zone</span>
              </div>
              <p style={{color:C.muted,fontSize:13,margin:"0 0 16px",lineHeight:1.6}}>Permanently delete your account and all associated data. This cannot be undone.</p>
              <button style={{width:"100%",padding:"11px 0",borderRadius:10,border:"1px solid rgba(239,68,68,0.3)",cursor:"pointer",fontWeight:600,fontSize:13,background:"rgba(239,68,68,0.06)",color:"#ef4444",transition:"all 0.2s"}}
                onMouseOver={e=>{e.currentTarget.style.background="rgba(239,68,68,0.12)";e.currentTarget.style.borderColor="rgba(239,68,68,0.5)";}}
                onMouseOut={e=>{e.currentTarget.style.background="rgba(239,68,68,0.06)";e.currentTarget.style.borderColor="rgba(239,68,68,0.3)";}}>
                Delete Account
              </button>
            </SectionCard>
          </div>
        </div>
      </div>
    </>
  );
}