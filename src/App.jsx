import { saveJobs, loadJobs, saveChecked, loadChecked, savePendingCOs, loadPendingCOs, useRealtimeSync } from './useSupabase';
import React, { useState, useEffect, useRef, useCallback } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────
const F       = "'Inter',system-ui,sans-serif";
const ACCENT  = "#2563EB";
const POLL_MS = 5000;
const STORAGE_KEY = "tardio_v9";
const PENDING_KEY = "tardio_pending_v1";
const CO_COLORS   = ["#C97B4B","#4A7FA5","#5A8A6A","#8A6AAA","#A07850","#6A8AA0"];

const MGMT_USERS = [
  { id:"marco",   name:"Marco",   role:"Owner",                  pin:"1111", access:"owner"    },
  { id:"nikki",   name:"Nikki",   role:"Director of Operations", pin:"2222", access:"director" },
  { id:"audelio", name:"Audelio", role:"Project Manager",        pin:"3333", access:"pm"       },
  { id:"adrian",  name:"Adrian",  role:"Asst. Project Manager",  pin:"4444", access:"apm"      },
];
const EMPLOYEE_USER     = { id:"employee", name:"Employee", role:"Field Crew", access:"employee" };
const NEEDS_CO_APPROVAL = ["pm","apm"];
const CAN_APPROVE_CO    = ["owner","director"];

const PERMS = {
  owner:    { addJob:true,  deleteJob:true,  editJob:true,  changeOrder:true, addNote:true, warranty:true  },
  director: { addJob:true,  deleteJob:true,  editJob:true,  changeOrder:true, addNote:true, warranty:true  },
  pm:       { addJob:false, deleteJob:false, editJob:true,  changeOrder:true, addNote:true, warranty:false },
  apm:      { addJob:false, deleteJob:false, editJob:true,  changeOrder:true, addNote:true, warranty:false },
  employee: { addJob:false, deleteJob:false, editJob:false, changeOrder:false,addNote:true, warranty:false },
};

const STATUS = {
  active:   { label:"Active",   color:"#2563EB", bg:"#EBF3FA" },
  hold:     { label:"On Hold",  color:"#C97B4B", bg:"#FAF0E6" },
  complete: { label:"Complete", color:"#5A8A6A", bg:"#EAF3EE" },
};

const MAT_STATUS = {
  on_site:  { label:"On Site",  labelEs:"En Sitio",  color:"#16A34A", bg:"#DCFCE7" },
  at_store: { label:"At Store", labelEs:"En Tienda", color:"#2563EB", bg:"#DBEAFE" },
  pending:  { label:"Pending",  labelEs:"Pendiente", color:"#D97706", bg:"#FEF3C7" },
  missing:  { label:"Missing",  labelEs:"Falta",     color:"#DC2626", bg:"#FEE2E2" },
};

const MAT_ES = {
  "shower system":"Sistema de ducha","tub faucet & drain":"Grifo y drenaje de tina",
  "vanity faucets":"Grifos de vanity","mirrors (3)":"Espejos (3)","3 sconce lights":"3 luces de pared",
  "floor tile":"Tile del piso","vanity w/ countertop":"Vanity con cubierta","paint":"Pintura",
  "tile":"Tile","grout":"Lechada","lumber":"Madera","drywall":"Drywall","caulk":"Sellador",
  "primer":"Imprimante","door":"Puerta","window":"Ventana","toilet":"Inodoro","sink":"Lavamanos",
  "faucet":"Grifo","light":"Luz","outlet":"Tomacorriente","switch":"Interruptor","fan":"Abanico",
  "mirror":"Espejo","vanity":"Vanity","cabinet":"Gabinete","door knob":"Perilla","hinge":"Bisagra",
  "casing":"Marco","baseboard":"Zócalo","trim":"Moldura","carpet":"Alfombra","pad":"Relleno",
  "hardwood":"Piso de madera","stain":"Tinte","sealer":"Sellador","quarter round":"Cuarto redondo",
  "register":"Registro de AC","weather strip":"Burlete","countertop":"Cubierta","backsplash":"Salpicadero",
  "shower":"Ducha","tub":"Tina","drain":"Drenaje","valve":"Válvula","pipe":"Tubo","wire":"Cable",
  "breaker":"Breaker","panel":"Panel",
};

const INITIAL_JOBS = [{
  id:"lisa", name:"Lisa", address:"15 Ken Bell Rd", status:"active", phase:"Tile & Shower", phone:"",
  notes:[{id:"n_init",text:"Talk to Clara – confirm if switching brushed nickel to metal fixtures",author:"Audelio",ts:"Mar 13, 9:00 AM"}],
  materials:[
    {id:"m1",name:"Shower system",        nameEs:"Sistema de ducha",        providedBy:"client",     status:"on_site"},
    {id:"m2",name:"Tub faucet & drain",   nameEs:"Grifo y drenaje de tina", providedBy:"client",     status:"on_site"},
    {id:"m3",name:"Vanity faucets",       nameEs:"Grifos de vanity",        providedBy:"client",     status:"on_site"},
    {id:"m4",name:"Mirrors (3)",          nameEs:"Espejos (3)",             providedBy:"client",     status:"on_site"},
    {id:"m5",name:"3 sconce lights",      nameEs:"3 luces de pared",        providedBy:"client",     status:"pending"},
    {id:"m6",name:"Floor tile",           nameEs:"Tile del piso",           providedBy:"contractor", status:"at_store"},
    {id:"m7",name:"Vanity w/ countertop", nameEs:"Vanity con cubierta",     providedBy:"contractor", status:"pending"},
    {id:"m8",name:"Paint",                nameEs:"Pintura",                 providedBy:"contractor", status:"pending"},
  ],
  sections:[
    {id:"demo",label:"Demolición / Demo",color:"#C97B4B",items:[
      {id:"d1",en:"Remove vanity, mirrors & vanity lights",es:"Remover vanity, espejos y luces de vanity"},
      {id:"d2",en:"Remove floor tile",es:"Remover tile del piso"},
      {id:"d3",en:"Remove tub",es:"Remover tina"},
      {id:"d4",en:"Remove shower",es:"Remover shower"},
      {id:"d5",en:"Remove toilet (reinstall same after)",es:"Remover toilet (reinstalar el mismo después)",note:"Save for reinstall"},
    ]},
    {id:"tile",label:"Tile & Shower",color:"#4A7FA5",items:[
      {id:"t1",en:"Install new floor tile",es:"Instalar tile nuevo en el piso",note:"Pick up at Floor & Decor"},
      {id:"t2",en:"Build new corner shower with step, glass & niche",es:"Hacer shower nuevo en la esquina con escalón, vidrio y niche"},
      {id:"t3",en:"Tile tub area – 2 full pieces no cuts",es:"Tile en área de tina – 2 piezas enteras sin cortar"},
      {id:"t4",en:"Verify marble for shower step",es:"Verificar marble para el escalón del shower",note:"Check availability"},
      {id:"t5",en:"Talk to Clara – confirm if switching brushed to metal",es:"Hablar con Clara – confirmar si cambia pinceles por metal"},
    ]},
    {id:"plumbing",label:"Plomería / Plumbing",color:"#5A8A6A",items:[
      {id:"p1",en:"Install new shower system",es:"Instalar nuevo shower system",note:"Client must have on site"},
      {id:"p2",en:"Install new tub – center drain",es:"Instalar nueva tina – centrar drenaje"},
      {id:"p3",en:"Install tub faucet in corner from floor",es:"Instalar faucet de tina en esquina desde el piso"},
      {id:"p4",en:"Reinstall toilet",es:"Reinstalar toilet"},
    ]},
    {id:"lighting",label:"Iluminación / Lighting",color:"#8A6AAA",items:[
      {id:"l1",en:"Canless light in shower (1)",es:"Canless light en el shower (1)"},
      {id:"l2",en:"Canless light at tub (1)",es:"Canless light en la tina (1)"},
      {id:"l3",en:"Canless lights in hallway (2)",es:"Canless lights en el pasillo (2)"},
      {id:"l4",en:"3 sconce lights – one each side of vanity",es:"3 sconces – una a cada lado del vanity",note:"Client must have sconces"},
    ]},
    {id:"vanity",label:"Vanity & Espejos",color:"#A07850",items:[
      {id:"v1",en:"Install new vanity with countertop",es:"Instalar vanity nuevo con countertop",note:"We buy – chosen by client"},
      {id:"v2",en:"Install vanity faucets",es:"Instalar faucets del vanity",note:"Client has faucets"},
      {id:"v3",en:"Install mirrors",es:"Instalar espejos",note:"Already at house"},
    ]},
    {id:"paint",label:"Pintura / Paint",color:"#6A8AA0",items:[
      {id:"pa1",en:"Confirm paint color with client",es:"Confirmar color de pintura con la clienta"},
      {id:"pa2",en:"Paint entire bathroom & closet",es:"Pintar todo el baño y clóset",note:"We buy · Satin walls · Semigloss trim"},
    ]},
  ],
}];

// ─── Shared styles ────────────────────────────────────────────────────────────
const css = {
  page:  { fontFamily:F, fontSize:14, lineHeight:1.6, maxWidth:600, margin:"0 auto", padding:"1.5rem 1rem 5rem" },
  inp:   { width:"100%", padding:"11px 14px", border:"1px solid var(--color-border-secondary)", borderRadius:10, fontSize:14, background:"var(--color-background-primary)", color:"var(--color-text-primary)", boxSizing:"border-box", outline:"none", fontFamily:F },
  solid: (bg=ACCENT) => ({ flex:1, padding:"11px", background:bg, color:"white", border:"none", borderRadius:10, fontSize:14, fontWeight:600, cursor:"pointer", fontFamily:F }),
  ghost: { flex:1, padding:"11px", background:"transparent", border:"1px solid var(--color-border-secondary)", borderRadius:10, fontSize:14, cursor:"pointer", color:"var(--color-text-secondary)", fontFamily:F },
  label: { fontSize:11, fontWeight:600, letterSpacing:0.8, textTransform:"uppercase", color:"var(--color-text-tertiary)" },
  card:  { border:"1px solid var(--color-border-tertiary)", borderRadius:14, padding:"14px 16px", background:"var(--color-background-primary)" },
  row:   { display:"flex", alignItems:"center", gap:10 },
  errBox:{ marginTop:10, padding:"10px 14px", background:"#FFF1F2", border:"1px solid #FECACA", borderRadius:10, fontSize:12, color:"#DC2626", lineHeight:1.5 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid    = () => `${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
const tsNow  = () => new Date().toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});
const getMatEs = m => m.nameEs || MAT_ES[m.name.toLowerCase()] || m.name;

const getSectionLabel = (sec, lang, trans) => {
  if (lang !== "es") return sec.label;
  if (sec.label.includes("/")) return sec.label.split("/").slice(1).join("/").trim() || sec.label;
  return trans[sec.label] || sec.label;
};

async function callAI(system, user, max=1000) {
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method:"POST",
    headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},
    body:JSON.stringify({ model:"claude-sonnet-4-6", max_tokens:max, system, messages:[{role:"user",content:user}] })
  });
  if (!r.ok) throw new Error(`API error (HTTP ${r.status}). Please try again.`);
  const d = await r.json();
  if (d.error) throw new Error(d.error.message);
  return (d.content?.[0]?.text||"").replace(/```json|```/g,"").trim();
}

function parseJSON(raw) {
  const a=raw.indexOf("{"), b=raw.lastIndexOf("}");
  if (a===-1||b===-1) throw new Error("Could not parse AI response. Try again.");
  return JSON.parse(raw.slice(a,b+1));
}

async function translateSections(labels) {
  try {
    const raw = await callAI(
      "You are a translator. Respond ONLY with raw valid JSON. No markdown.",
      `Translate these construction section names to Spanish. Return ONLY: {"translations":{"original":"traduccion"}}\n\nLabels: ${JSON.stringify(labels)}`
    , 500);
    return parseJSON(raw).translations || {};
  } catch(e) { return {}; }
}

function getProgress(job, checked) {
  const total = job.sections.reduce((s,sec)=>s+sec.items.length, 0);
  const done  = job.sections.reduce((s,sec)=>s+sec.items.filter(i=>checked[`${job.id}_${i.id}`]).length, 0);
  return { total, done, pct: total ? Math.round((done/total)*100) : 0 };
}

// ─── Primitives ───────────────────────────────────────────────────────────────
const BackBtn = ({onClick}) => (
  <div onClick={onClick} style={{width:36,height:36,borderRadius:10,border:"1px solid var(--color-border-secondary)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",background:"var(--color-background-secondary)",flexShrink:0}}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </div>
);
const CheckIcon = () => (
  <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
);
const TrashBtn = ({onClick}) => (
  <div onClick={e=>{e.stopPropagation();onClick();}} style={{width:28,height:28,borderRadius:8,background:"#FFF1F2",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
    <svg width="13" height="14" viewBox="0 0 13 14" fill="none"><path d="M1 3.5h11M4.5 3.5V2.5a1 1 0 011-1h2a1 1 0 011 1v1M5.5 6.5v4M7.5 6.5v4M2 3.5l.7 8a1 1 0 001 .9h5.6a1 1 0 001-.9l.7-8" stroke="#EF4444" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
  </div>
);
const LangToggle = ({lang,setLang}) => (
  <div onClick={()=>setLang(l=>l==="es"?"en":"es")} style={{padding:"6px 14px",borderRadius:20,border:"1px solid var(--color-border-secondary)",cursor:"pointer",background:"var(--color-background-secondary)",fontSize:12,fontWeight:600,color:"var(--color-text-primary)",flexShrink:0,userSelect:"none"}}>
    {lang==="es"?"Español":"English"}
  </div>
);
const PinDots = ({len,error,color=ACCENT}) => (
  <div style={{display:"flex",gap:12,justifyContent:"center",marginBottom:28}}>
    {[0,1,2,3].map(i=>(
      <div key={i} style={{width:14,height:14,borderRadius:"50%",background:len>i?(error?"#EF4444":color):"var(--color-background-secondary)",border:`2px solid ${len>i?(error?"#EF4444":color):"var(--color-border-secondary)"}`,transition:"all 0.15s"}}/>
    ))}
  </div>
);
const Badge = ({label,bg,color}) => (
  <span style={{fontSize:10,background:bg,color,borderRadius:20,padding:"2px 8px",fontWeight:600,flexShrink:0,whiteSpace:"nowrap"}}>{label}</span>
);
const ConfirmBox = ({message,confirmLabel="Yes, Delete",confirmColor="#EF4444",onConfirm,onCancel,solid,ghost}) => (
  <div style={{border:"1.5px solid #FECACA",borderRadius:14,padding:16,marginBottom:12,background:"#FFF1F2"}}>
    <div style={{fontSize:14,fontWeight:600,color:"#DC2626",marginBottom:6}}>Are you sure?</div>
    <div style={{fontSize:13,color:"#7F1D1D",lineHeight:1.6,marginBottom:14}}>{message}</div>
    <div style={{display:"flex",gap:10}}>
      <button onClick={onConfirm} style={solid(confirmColor)}>{confirmLabel}</button>
      <button onClick={onCancel} style={ghost}>Cancel</button>
    </div>
  </div>
);
const InfoBanner = ({icon,text,color="#1E40AF",bg="#EFF6FF",border="#BFDBFE"}) => (
  <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",border:`1px solid ${border}`,borderRadius:10,marginBottom:16,background:bg}}>
    <span style={{fontSize:14,flexShrink:0}}>{icon}</span>
    <span style={{fontSize:12,color}}>{text}</span>
  </div>
);
const ErrMsg = ({msg}) => msg ? <div style={css.errBox}>{msg}</div> : null;
const RedBtn = ({onClick,label,style={}}) => (
  <button onClick={onClick} style={{flex:"none",padding:"11px 16px",background:"#EF4444",color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:F,...style}}>{label}</button>
);
const BlueOutlineBtn = ({onClick,label}) => (
  <button onClick={onClick} style={{flex:"none",padding:"11px 16px",background:"transparent",border:`1.5px solid ${ACCENT}`,borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",color:ACCENT,fontFamily:F}}>✎ {label}</button>
);

// ─── Error Boundary ───────────────────────────────────────────────────────────
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state={crashed:false,msg:""}; }
  static getDerivedStateFromError(e) { return {crashed:true,msg:e.message}; }
  render() {
    if (!this.state.crashed) return this.props.children;
    return (
      <div style={{fontFamily:F,maxWidth:400,margin:"80px auto",padding:"0 1.5rem",textAlign:"center"}}>
        <div style={{fontSize:32,marginBottom:12}}>⚠️</div>
        <div style={{fontSize:18,fontWeight:700,color:"var(--color-text-primary)",marginBottom:8}}>Something went wrong</div>
        <div style={{fontSize:13,color:"var(--color-text-tertiary)",marginBottom:24,lineHeight:1.6}}>{this.state.msg}</div>
        <button onClick={()=>this.setState({crashed:false,msg:""})} style={{padding:"11px 24px",background:ACCENT,color:"white",border:"none",borderRadius:10,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:F}}>Try Again</button>
      </div>
    );
  }
}

// ─── Warranty Card ────────────────────────────────────────────────────────────
function WarrantyCard({activeJob,jobsRef,checkedRef,setJobs,save,inp,solid,ghost}) {
  const [open,setOpen]       = useState(false);
  const [notes,setNotes]     = useState("");
  const [loading,setLoading] = useState(false);
  const [preview,setPreview] = useState(null);
  const [err,setErr]         = useState("");

  const generate = async () => {
    if (!notes.trim()) return;
    setLoading(true); setPreview(null); setErr("");
    try {
      const raw = await callAI(
        "You are a construction warranty assistant. Respond ONLY with raw valid JSON. No markdown, no backticks.",
        `Generate a warranty checklist from these notes. Keep tasks SHORT.\n\nNotes:\n${notes}\n\nReturn:\n{"items":[{"id":"w1","en":"task","es":"tarea","note":""}]}\n\nTranslate all tasks to Spanish.`
      );
      const parsed = parseJSON(raw);
      if (!parsed?.items?.length) throw new Error("No items returned. Add more detail.");
      setPreview(parsed);
    } catch(e) { setErr(e.message); }
    setLoading(false);
  };

  const confirm = () => {
    if (!preview?.items?.length) return;
    const sec = { id:`warranty_${uid()}`, label:"Garantía / Warranty", color:"#7C3AED", isWarranty:true, items:preview.items.map(i=>({...i,isWarranty:true})) };
    const updated = jobsRef.current.map(j=>j.id!==activeJob?j:{...j,status:"active",sections:[...j.sections,sec]});
    setJobs(updated); save(checkedRef.current,updated);
    setOpen(false); setNotes(""); setPreview(null);
  };

  if (!open) return (
    <div onClick={()=>setOpen(true)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",border:"1.5px solid #7C3AED",borderRadius:12,marginTop:16,cursor:"pointer",background:"#F5F3FF"}}>
      <div style={{width:28,height:28,borderRadius:8,background:"#EDE9FE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>🔧</div>
      <div>
        <div style={{fontSize:13,fontWeight:600,color:"#5B21B6"}}>Start Warranty Job</div>
        <div style={{fontSize:11,color:"#7C3AED",marginTop:1}}>Reopen job with warranty checklist</div>
      </div>
    </div>
  );
  return (
    <div style={{border:"1.5px solid #7C3AED",borderRadius:14,padding:16,marginTop:16,background:"#F5F3FF"}}>
      <div style={{fontSize:14,fontWeight:700,color:"#5B21B6",marginBottom:4}}>🔧 Start Warranty Job</div>
      <div style={{fontSize:12,color:"#7C3AED",marginBottom:14}}>Describe the warranty work. AI will generate the checklist.</div>
      {!preview ? (
        <>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder={"- Fix crack in shower tile\n- Re-caulk tub area\n- Touch up paint near door"} style={{...inp,minHeight:90,resize:"vertical",lineHeight:1.7,marginBottom:10,border:"1px solid #C4B5FD"}}/>
          <ErrMsg msg={err}/>
          <div style={{display:"flex",gap:10,marginTop:err?10:0}}>
            <button onClick={generate} disabled={loading||!notes.trim()} style={solid(loading||!notes.trim()?"#94A3B8":"#7C3AED")}>{loading?"Generating…":"✦ Generate Warranty Items"}</button>
            <button onClick={()=>setOpen(false)} style={ghost}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <div style={{fontSize:13,fontWeight:600,color:"#5B21B6",marginBottom:10}}>Review warranty items</div>
          <div style={{border:"1px solid #C4B5FD",borderRadius:12,overflow:"hidden",marginBottom:14}}>
            {preview.items?.map((item,i)=>(
              <div key={i} style={{padding:"10px 14px",borderBottom:"1px solid #EDE9FE",background:i%2===0?"#F5F3FF":"white"}}>
                <div style={css.label}>Warranty</div>
                <div style={{fontSize:13,color:"#3B0764",marginTop:2}}>{item.es||item.en}</div>
                {item.note && <div style={{fontSize:11,color:"#7C3AED",marginTop:2}}>{item.note}</div>}
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={confirm} style={solid("#7C3AED")}>Confirm & Reopen Job</button>
            <button onClick={()=>setPreview(null)} style={ghost}>Re-generate</button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Project Complete Card ────────────────────────────────────────────────────
function ProjectCompleteCard({job,activeJob,user,jobsRef,checkedRef,pendingRef,setJobs,save,setPendingCOs,savePending,setScreen,isOwnerOrDirector,pausePollRef,inp,solid,ghost}) {
  const [choice,setChoice]           = useState(null);
  const [explanation,setExplanation] = useState("");
  const [submitted,setSubmitted]     = useState(false);

  const notify = async (type,text) => {
    const entry = { id:`pco_${uid()}`,type:"project_status",jobId:activeJob,jobName:job.name,submittedBy:user.name,submittedAt:tsNow(),status:"pending",statusType:type,note:text };
    const updated = [...pendingRef.current,entry];
    setPendingCOs(updated);
    await savePending(updated);
  };

  const handleYes = async () => {
    pausePollRef.current = true;
    const updated = jobsRef.current.map(j=>j.id===activeJob?{...j,status:"complete"}:j);
    setJobs(updated);
    await save(checkedRef.current,updated);
    await notify("complete",`${user.name} has marked ${job.name} as complete. All tasks finished.`);
    pausePollRef.current = false;
    setScreen("home");
  };

  const handleNoSubmit = async () => {
    if (!explanation.trim()) return;
    pausePollRef.current = true;
    await notify("in_progress",explanation.trim());
    pausePollRef.current = false;
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{border:"1px solid #BBF7D0",borderRadius:14,padding:16,marginTop:24,background:"#F0FDF4",textAlign:"center"}}>
      <div style={{fontSize:15,fontWeight:700,color:"#166534",marginBottom:4}}>
        {isOwnerOrDirector ? "Notification sent to team" : "Sent to Nikki & Marco"}
      </div>
      <div style={{fontSize:13,color:"#16A34A"}}>Your explanation has been submitted.</div>
    </div>
  );
  return (
    <div style={{border:"1px solid #BBF7D0",borderRadius:14,padding:16,marginTop:24,background:"#F0FDF4"}}>
      <div style={{fontSize:15,fontWeight:700,color:"#166534",marginBottom:14}}>Project Complete?</div>
      {choice===null && (
        <div style={{display:"flex",gap:12}}>
          {[{k:"yes",label:"Yes, mark complete",c:"#16A34A"},{k:"no",label:"No, still in progress",c:"#94A3B8"}].map(({k,label,c})=>(
            <div key={k} onClick={()=>setChoice(k)} style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"12px 14px",border:`2px solid ${c}`,borderRadius:12,cursor:"pointer",background:"white"}}>
              <div style={{width:20,height:20,borderRadius:6,border:`2px solid ${c}`,flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:600,color:k==="yes"?"#166534":"#475569"}}>{label}</span>
            </div>
          ))}
        </div>
      )}
      {choice==="yes" && (
        <div style={{border:"1.5px solid #16A34A",borderRadius:12,padding:14,background:"white"}}>
          <div style={{fontSize:13,color:"#166534",marginBottom:14}}>
            This will mark the job as <strong>Complete</strong> and notify the team.
          </div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={handleYes} style={solid("#16A34A")}>Confirm Complete</button>
            <button onClick={()=>setChoice(null)} style={ghost}>Cancel</button>
          </div>
        </div>
      )}
      {choice==="no" && (
        <div style={{border:"1.5px solid #94A3B8",borderRadius:12,padding:14,background:"white"}}>
          <div style={{fontSize:13,color:"#475569",marginBottom:10}}>Explain why the project is still in progress:</div>
          <textarea value={explanation} onChange={e=>setExplanation(e.target.value)} placeholder="e.g. Waiting on materials, client requested changes…" style={{...inp,minHeight:80,resize:"vertical",lineHeight:1.6,marginBottom:10,border:"1px solid #CBD5E1"}}/>
          <div style={{display:"flex",gap:10}}>
            <button onClick={handleNoSubmit} disabled={!explanation.trim()} style={solid(!explanation.trim()?"#94A3B8":ACCENT)}>Send to Nikki & Marco</button>
            <button onClick={()=>setChoice(null)} style={ghost}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Remove Tab ───────────────────────────────────────────────────────────────
function RemoveTab({job,lang,isApprovalUser,submitCO,activeJob,setCoSubmitted,setShowCO,deleteItem,solid,ghost}) {
  const [selected,setSelected]          = useState({});
  const [pendingRemove,setPendingRemove] = useState(null);
  const count = Object.values(selected).filter(Boolean).length;

  const handleSubmit = () => {
    const items = [];
    Object.entries(selected).forEach(([key,val])=>{
      if (!val) return;
      const [secId,itemId] = key.split("__");
      const sec  = job.sections.find(s=>s.id===secId);
      const item = sec?.items.find(i=>i.id===itemId);
      if (item) items.push({itemId,secId,label:lang==="es"?(item.es||item.en):item.en,en:item.en,es:item.es});
    });
    if (!items.length) return;
    if (isApprovalUser) { submitCO(activeJob,{type:"remove_items",items}); setCoSubmitted(true); }
    else setPendingRemove(items);
  };
  const doRemove = () => {
    if (!pendingRemove) return;
    deleteItem(activeJob,null,null,pendingRemove);
    setPendingRemove(null); setShowCO(false);
  };

  return (
    <>
      {!pendingRemove && (
        <>
        <div style={{fontSize:13,color:"var(--color-text-tertiary)",marginBottom:16}}>
          {isApprovalUser?"Select items to request removal — sent for approval.":"Select items to remove from the checklist."}
        </div>
        {job.sections.map(sec=>(
        <div key={sec.id} style={{marginBottom:20}}>
          <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:"var(--color-background-secondary)",marginBottom:8}}>
            <div style={{width:10,height:10,borderRadius:3,background:sec.color,flexShrink:0}}/>
            <span style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)",flex:1}}>{sec.label}</span>
            <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{sec.items.length} items</span>
          </div>
          <div style={{border:"1px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden"}}>
            {sec.items.length===0 && <div style={{padding:"12px 16px",fontSize:13,color:"var(--color-text-tertiary)",textAlign:"center"}}>No items</div>}
            {sec.items.map((item,idx)=>{
              const key=`${sec.id}__${item.id}`; const isSel=!!selected[key];
              return (
                <div key={item.id} onClick={()=>setSelected(p=>({...p,[key]:!p[key]}))} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 16px",borderBottom:"1px solid var(--color-border-tertiary)",background:isSel?"#FFF1F2":idx%2===0?"var(--color-background-primary)":"var(--color-background-secondary)",cursor:"pointer"}}>
                  <div style={{width:18,height:18,borderRadius:5,border:`2px solid ${isSel?"#EF4444":"var(--color-border-secondary)"}`,background:isSel?"#EF4444":"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>{isSel&&<CheckIcon/>}</div>
                  {item.isChangeOrder && <Badge label="CO" bg="#FEF3C7" color="#92400E"/>}
                  <div style={{flex:1,fontSize:13,color:"var(--color-text-primary)",lineHeight:1.45}}>{lang==="es"?(item.es||item.en):item.en}</div>
                </div>
              );
            })}
          </div>
        </div>
              ))}
      {count>0 && (
        <div style={{display:"flex",gap:10,marginTop:8}}>
          <button onClick={handleSubmit} style={solid(isApprovalUser?"#C97B4B":"#EF4444")}>
            {isApprovalUser?"Submit Removal for Approval":`Remove ${count} Item${count!==1?"s":""}`}
          </button>
          <button onClick={()=>setSelected({})} style={ghost}>Clear</button>
        </div>
      )}
      </>
      )}
      {pendingRemove && (
        <ConfirmBox
          message={pendingRemove.length===1?`Remove "${pendingRemove[0].label}" from the checklist?`:`Remove ${pendingRemove.length} items from the checklist?`}
          onConfirm={doRemove} onCancel={()=>setPendingRemove(null)} solid={solid} ghost={ghost}
        />
      )}
    </>
  );
}

// ─── Approvals Screen ─────────────────────────────────────────────────────────
function ApprovalsScreen({user,pendingCOs,approveCO,rejectCO,dismissNotification,setShowApprovals,inp,solid,ghost}) {
  const [rejectId,setRejectId]   = useState(null);
  const [rejectMsg,setRejectMsg] = useState("");

  const pending  = pendingCOs.filter(p=>p.status==="pending"&&p.type!=="project_status");
  const updates  = pendingCOs.filter(p=>p.type==="project_status"&&!(p.dismissedBy||[]).includes(user?.name));
  const rejected = pendingCOs.filter(p=>p.status==="rejected"&&p.submittedBy===user?.name&&!(p.dismissedBy||[]).includes(user?.name));

  useEffect(()=>{
    if (!pending.length&&!rejected.length&&!updates.length) setShowApprovals(false);
  },[pending.length,rejected.length,updates.length]);

  const describeType = p => {
    if (p.type==="project_status"&&p.statusType==="complete")    return `Marked Complete: ${p.jobName}`;
    if (p.type==="project_status"&&p.statusType==="in_progress") return `Still In Progress: ${p.jobName}`;
    if (p.type==="add_items")    return `Add ${p.items?.length} checklist item${p.items?.length!==1?"s":""}`;
    if (p.type==="remove_items") return `Remove ${p.items?.length} checklist item${p.items?.length!==1?"s":""}`;
    if (p.type==="add_mat")      return `Add material: ${p.mat?.name}`;
    return "Change order";
  };

  return (
    <div style={css.page}>
      <div style={{...css.row,marginBottom:24}}>
        <BackBtn onClick={()=>setShowApprovals(false)}/>
        <div style={{fontSize:20,fontWeight:700,color:"var(--color-text-primary)",flex:1}}>Notifications</div>
        {pending.length>0 && <Badge label={`${pending.length} pending`} bg="#FEE2E2" color="#DC2626"/>}
        {updates.length>0 && <Badge label={`${updates.length} update${updates.length!==1?"s":""}`} bg="#DCFCE7" color="#166534"/>}
      </div>
      {!pending.length&&!rejected.length&&!updates.length && (
        <div style={{textAlign:"center",padding:"50px 0",color:"var(--color-text-tertiary)"}}>
          <div style={{fontSize:28,marginBottom:8}}>✓</div><div>All clear</div>
        </div>
      )}
      {pending.length>0 && (
        <>
          <div style={{...css.label,marginBottom:12}}>Awaiting Approval</div>
          {pending.map(p=>(
            <div key={p.id} style={{...css.card,border:"1.5px solid #FDE68A",background:"#FFFBEB",marginBottom:12}}>
              {rejectId===p.id ? (
                <>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)",marginBottom:10}}>Rejection reason for {p.submittedBy}:</div>
                  <textarea value={rejectMsg} onChange={e=>setRejectMsg(e.target.value)} placeholder="Optional…" style={{...inp,minHeight:70,resize:"vertical",lineHeight:1.6,marginBottom:10}}/>
                  <div style={{display:"flex",gap:10}}>
                    <button onClick={()=>{rejectCO(p.id,rejectMsg);setRejectId(null);setRejectMsg("");}} style={solid("#EF4444")}>Confirm Reject</button>
                    <button onClick={()=>{setRejectId(null);setRejectMsg("");}} style={ghost}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:"var(--color-text-primary)"}}>{describeType(p)}</div>
                      <div style={{fontSize:12,color:"#E05C3A",marginTop:2}}>📍 {p.jobName}</div>
                    </div>
                    <Badge label="Pending" bg="#FEF3C7" color="#92400E"/>
                  </div>
                  <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginBottom:10}}>By {p.submittedBy} · {p.submittedAt}</div>
                  {(p.type==="add_items"||p.type==="remove_items")&&p.items?.map((item,i)=>(
                    <div key={i} style={{fontSize:12,color:"var(--color-text-secondary)",padding:"4px 8px",background:"var(--color-background-secondary)",borderRadius:8,marginBottom:4,display:"flex",gap:6}}>
                      <span style={{color:p.type==="remove_items"?"#EF4444":"#16A34A",fontWeight:700,flexShrink:0}}>{p.type==="remove_items"?"−":"+"}</span>
                      <span>{item.es||item.en||item.label}</span>
                    </div>
                  ))}
                  {p.type==="add_mat" && <div style={{fontSize:12,color:"var(--color-text-secondary)",padding:"4px 8px",background:"var(--color-background-secondary)",borderRadius:8,marginBottom:4}}>📦 {p.mat?.name} · {p.mat?.providedBy} · {MAT_STATUS[p.mat?.status]?.label}</div>}
                  <div style={{display:"flex",gap:10,marginTop:12}}>
                    <button onClick={()=>approveCO(p.id)} style={solid("#16A34A")}>Approve</button>
                    <button onClick={()=>setRejectId(p.id)} style={solid("#EF4444")}>Reject</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </>
      )}
      {updates.length>0 && (
        <>
          <div style={{...css.label,marginBottom:12,marginTop:pending.length>0?24:0}}>Jobsite Updates</div>
          {updates.map(p=>(
            <div key={p.id} style={{...css.card,border:`1.5px solid ${p.statusType==="complete"?"#BBF7D0":"#FDE68A"}`,background:p.statusType==="complete"?"#F0FDF4":"#FFFBEB",marginBottom:12}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                <div>
                  <div style={{fontSize:14,fontWeight:600,color:"var(--color-text-primary)"}}>{p.statusType==="complete"?"Marked Complete":"Still In Progress"}</div>
                  <div style={{fontSize:12,color:"#E05C3A",marginTop:2}}>📍 {p.jobName}</div>
                </div>
                <Badge label={p.statusType==="complete"?"Complete":"In Progress"} bg={p.statusType==="complete"?"#DCFCE7":"#FEF3C7"} color={p.statusType==="complete"?"#166534":"#92400E"}/>
              </div>
              <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginBottom:p.note?8:12}}>By {p.submittedBy} · {p.submittedAt}</div>
              {p.note && <div style={{fontSize:13,color:"var(--color-text-secondary)",padding:"8px 12px",background:"var(--color-background-primary)",borderRadius:8,marginBottom:12,lineHeight:1.6}}>{p.note}</div>}
              <button onClick={()=>dismissNotification(p.id)} style={{...solid(p.statusType==="complete"?"#16A34A":"#C97B4B"),flex:"none",width:"100%"}}>Dismiss</button>
            </div>
          ))}
        </>
      )}
      {rejected.length>0 && (
        <>
          <div style={{...css.label,marginBottom:12,marginTop:(pending.length>0||updates.length>0)?24:0}}>Rejected</div>
          {rejected.map(p=>(
            <div key={p.id} style={{...css.card,marginBottom:10,opacity:0.9}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div>
                  <div style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)"}}>{describeType(p)}</div>
                  <div style={{fontSize:11,color:"#E05C3A",marginTop:1}}>📍 {p.jobName}</div>
                </div>
                <Badge label="Rejected" bg="#FEE2E2" color="#DC2626"/>
              </div>
              <div style={{fontSize:11,color:"var(--color-text-tertiary)"}}>By {p.rejectedBy||"Management"}</div>
              {p.rejectReason && <div style={{fontSize:12,color:"#DC2626",marginTop:6,padding:"6px 10px",background:"#FEF2F2",borderRadius:8}}>{p.rejectReason}</div>}
              <div onClick={()=>dismissNotification(p.id)} style={{marginTop:10,fontSize:12,color:"var(--color-text-tertiary)",cursor:"pointer",textDecoration:"underline"}}>Dismiss</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// ─── CO Screen ────────────────────────────────────────────────────────────────
function COScreen({job,activeJob,lang,setLang,user,coTab,setCoTab,checkedRef,jobsRef,setJobs,save,submitCO,deleteItem,setShowCO,inp,solid,ghost}) {
  const [coMode,        setCoMode]        = useState("ai");
  const [coNotes,       setCoNotes]       = useState("");
  const [coLoading,     setCoLoading]     = useState(false);
  const [coPreview,     setCoPreview]     = useState(null);
  const [coEditing,     setCoEditing]     = useState(false);
  const [coDraft,       setCoDraft]       = useState(null);
  const [coErr,         setCoErr]         = useState("");
  const [secTrans,      setSecTrans]      = useState({});
  const [submitted,     setSubmitted]     = useState(false);
  const [confirmDelMat, setConfirmDelMat] = useState(null);
  const [manual,        setManual]        = useState({en:"",es:"",note:"",section:""});
  const [mat,           setMat]           = useState({name:"",providedBy:"client",status:"pending"});

  const isApprovalUser = NEEDS_CO_APPROVAL.includes(user.access);
  const mats = job?.materials||[];

  useEffect(()=>{
    if (lang!=="es") return;
    const need=(job?.sections||[]).filter(s=>!s.label.includes("/")&&!secTrans[s.label]).map(s=>s.label);
    if (!need.length) return;
    translateSections(need).then(t=>setSecTrans(p=>({...p,...t})));
  },[lang]);

  const resetCO = useCallback(()=>{ setCoPreview(null); setCoEditing(false); setCoDraft(null); setCoErr(""); },[]);

  const updateMatStatus = useCallback((matId,status)=>{
    const updated=jobsRef.current.map(j=>j.id!==activeJob?j:{...j,materials:(j.materials||[]).map(m=>m.id===matId?{...m,status}:m)});
    setJobs(updated); save(checkedRef.current,updated);
  },[activeJob,jobsRef,checkedRef,setJobs,save]);

  const commitDelMat = useCallback((matId)=>{
    const updated=jobsRef.current.map(j=>j.id!==activeJob?j:{...j,materials:(j.materials||[]).filter(m=>m.id!==matId)});
    setJobs(updated); save(checkedRef.current,updated); setConfirmDelMat(null);
  },[activeJob,jobsRef,checkedRef,setJobs,save]);

  const handleGenerate = async () => {
    if (!coNotes.trim()||!job) return;
    setCoLoading(true); setCoPreview(null); setCoEditing(false); setCoDraft(null); setCoErr("");
    try {
      const raw = await callAI(
        "You are a construction project assistant. Respond ONLY with raw valid JSON. No markdown, no backticks.",
        `Parse this change order into checklist items.\n\nNotes:\n${coNotes}\n\nExisting sections: ${job.sections.map(s=>s.label).join(", ")}\n\nReturn:\n{"items":[{"section":"existing section name","en":"task in english","es":"tarea en español","note":"","isNew":false}]}\n\nRules: Match section names exactly. Set isNew=true only for truly new sections. Translate all tasks to Spanish. Keep tasks concise.`
      , 1000);
      const parsed = parseJSON(raw);
      if (!parsed?.items?.length) throw new Error("No items returned. Try adding more detail to your notes.");
      setCoPreview(parsed);
    } catch(e) { setCoErr(e.message); }
    setCoLoading(false);
  };

  const handleSubmitCO = useCallback((data)=>{
    submitCO(activeJob,data);
    if (isApprovalUser) setSubmitted(true);
    else { setShowCO(false); resetCO(); }
  },[activeJob,submitCO,isApprovalUser,setShowCO,resetCO]);

  if (submitted) return (
    <div style={css.page}>
      <div style={{textAlign:"center",padding:"60px 20px"}}>
        <div style={{fontSize:36,marginBottom:14}}>📋</div>
        <div style={{fontSize:18,fontWeight:700,color:"var(--color-text-primary)",marginBottom:8}}>Sent for Approval</div>
        <div style={{fontSize:14,color:"var(--color-text-tertiary)",marginBottom:28}}>Submitted to Nikki and Marco for review.</div>
        <button onClick={()=>{setSubmitted(false);setShowCO(false);resetCO();}} style={{...solid(ACCENT),flex:"none",width:180,display:"block",margin:"0 auto"}}>Back to Job</button>
      </div>
    </div>
  );

  return (
    <div style={css.page}>
      {confirmDelMat && <ConfirmBox message={`Remove material "${confirmDelMat.name}"?`} onConfirm={()=>commitDelMat(confirmDelMat.id)} onCancel={()=>setConfirmDelMat(null)} solid={solid} ghost={ghost}/>}
      <div style={{...css.row,marginBottom:20}}>
        <BackBtn onClick={()=>{setShowCO(false);resetCO();setCoTab("add");}}/>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:700,color:"var(--color-text-primary)"}}>Change Order</div>
          <div style={{fontSize:12,color:"#E05C3A",marginTop:1}}>📍 {job?.name}</div>
        </div>
        <LangToggle lang={lang} setLang={setLang}/>
      </div>
      {isApprovalUser && <InfoBanner icon="ℹ️" text="Your change orders go to Nikki & Marco for approval first."/>}
      <div style={{display:"flex",border:"1px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden",marginBottom:20,background:"var(--color-background-secondary)"}}>
        {[{k:"add",label:"+ Add"},{k:"remove",label:"− Remove"},{k:"materials",label:"📦 Materials"}].map(({k,label})=>(
          <div key={k} onClick={()=>{setCoTab(k);resetCO();}} style={{flex:1,padding:"10px 4px",textAlign:"center",fontSize:12,fontWeight:500,cursor:"pointer",background:coTab===k?ACCENT:"transparent",color:coTab===k?"white":"var(--color-text-tertiary)"}}>
            {label}
          </div>
        ))}
      </div>

      {coTab==="add" && (
        <>
          <div style={{display:"flex",border:"1px solid var(--color-border-tertiary)",borderRadius:10,overflow:"hidden",marginBottom:16,background:"var(--color-background-secondary)"}}>
            {["ai","manual"].map(m=>(
              <div key={m} onClick={()=>{setCoMode(m);resetCO();}} style={{flex:1,padding:"8px",textAlign:"center",fontSize:12,fontWeight:500,cursor:"pointer",background:coMode===m?"#C97B4B":"transparent",color:coMode===m?"white":"var(--color-text-tertiary)"}}>
                {m==="ai"?"✦ AI Generate":"Manual Entry"}
              </div>
            ))}
          </div>

          {coMode==="ai" ? (
            !coPreview ? (
              <>
                <div style={{fontSize:11,color:coNotes.length>1800?"#EF4444":"var(--color-text-tertiary)",marginBottom:6,textAlign:"right"}}>{coNotes.length}/2000</div>
                <textarea value={coNotes} onChange={e=>e.target.value.length<=2000&&setCoNotes(e.target.value)} placeholder={lang==="es"?"- Agregar toallero\n- Tomacorriente extra":"- Add towel bar\n- Extra outlet near vanity"} style={{...inp,minHeight:110,resize:"vertical",lineHeight:1.7,marginBottom:12}}/>
                <ErrMsg msg={coErr}/>
                <div style={{display:"flex",gap:10,marginTop:coErr?10:0}}>
                  <button onClick={handleGenerate} disabled={coLoading||!coNotes.trim()} style={solid(coLoading||!coNotes.trim()?"#94A3B8":"#C97B4B")}>{coLoading?"Generating…":"✦ Generate"}</button>
                  <RedBtn onClick={()=>setShowCO(false)} label={lang==="es"?"Cancelar":"Cancel"}/>
                </div>
              </>
            ) : coEditing && coDraft ? (
              <>
                <div style={{fontSize:13,fontWeight:600,color:ACCENT,marginBottom:14}}>{lang==="es"?"Editar antes de enviar":"Edit before submitting"}</div>
                {coDraft.items?.map((item,i)=>(
                  <div key={i} style={{...css.card,marginBottom:10}}>
                    <div style={{...css.label,color:"#C97B4B",marginBottom:8}}>→ {item.section}</div>
                    {[{f:"en",l:"English"},{f:"es",l:"Español"},{f:"note",l:lang==="es"?"Nota (opcional)":"Note (optional)"}].map(({f,l})=>(
                      <div key={f} style={{marginBottom:6}}>
                        <div style={{...css.label,marginBottom:4}}>{l}</div>
                        <input value={item[f]||""} onChange={e=>setCoDraft(p=>({...p,items:p.items.map((it,j)=>j!==i?it:{...it,[f]:e.target.value})}))} style={inp}/>
                      </div>
                    ))}
                  </div>
                ))}
                <div style={{display:"flex",gap:10}}>
                  <button onClick={()=>{ setCoPreview(coDraft); setCoEditing(false); }} style={solid(ACCENT)}>{lang==="es"?"Listo":"Done Editing"}</button>
                  <button onClick={()=>setCoEditing(false)} style={ghost}>{lang==="es"?"Cancelar":"Cancel"}</button>
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:13,fontWeight:600,color:"#16A34A",marginBottom:12}}>{lang==="es"?"Revisar antes de enviar":"Review before submitting"}</div>
                <div style={{border:"1px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden",marginBottom:14}}>
                  {coPreview.items?.map((item,i)=>(
                    <div key={i} style={{padding:"12px 16px",borderBottom:"1px solid var(--color-border-tertiary)",background:i%2===0?"var(--color-background-primary)":"var(--color-background-secondary)"}}>
                      <div style={{...css.label,color:"#C97B4B",marginBottom:4}}>→ {item.section}</div>
                      <div style={{fontSize:14,color:"var(--color-text-primary)"}}>{lang==="es"?(item.es||item.en):item.en}</div>
                      {item.note && <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginTop:3}}>{item.note}</div>}
                    </div>
                  ))}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button onClick={()=>handleSubmitCO({type:"add_items",items:coPreview.items})} style={{...solid(isApprovalUser?"#C97B4B":"#16A34A"),flex:"none",padding:"11px 16px"}}>
                    {isApprovalUser?(lang==="es"?"Enviar para Aprobación":"Submit for Approval"):(lang==="es"?"Agregar a Lista":"Add to Checklist")}
                  </button>
                  <BlueOutlineBtn onClick={()=>{ setCoDraft(JSON.parse(JSON.stringify(coPreview))); setCoEditing(true); }} label={lang==="es"?"Editar":"Edit"}/>
                  <button onClick={()=>{ setCoPreview(null); setCoEditing(false); setCoDraft(null); }} style={{...solid("#7C3AED"),flex:"none",padding:"11px 16px"}}>{lang==="es"?"Regenerar":"Re-generate"}</button>
                  <RedBtn onClick={()=>setShowCO(false)} label={lang==="es"?"Cancelar":"Cancel"}/>
                </div>
              </>
            )
          ) : (
            <>
              <div style={{marginBottom:12}}>
                <div style={{...css.label,marginBottom:6}}>{lang==="es"?"Sección":"Section"}</div>
                <select value={manual.section} onChange={e=>setManual(p=>({...p,section:e.target.value}))} style={inp}>
                  <option value="">{lang==="es"?"Seleccionar sección…":"Select section…"}</option>
                  {job?.sections.map(s=><option key={s.id} value={s.id}>{getSectionLabel(s,lang,secTrans)}</option>)}
                </select>
              </div>
              {[{f:"en",l:"Task (English)",les:"Tarea (English)"},{f:"es",l:"Tarea (Español)",les:"Tarea (Español)"},{f:"note",l:"Note (optional)",les:"Nota (opcional)"}].map(({f,l,les})=>(
                <div key={f} style={{marginBottom:12}}>
                  <div style={{...css.label,marginBottom:6}}>{lang==="es"?les:l}</div>
                  <input value={manual[f]||""} onChange={e=>setManual(p=>({...p,[f]:e.target.value}))} style={inp}/>
                </div>
              ))}
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>{
                  if ((!manual.en&&!manual.es)||!manual.section) return;
                  const sec=job.sections.find(s=>s.id===manual.section);
                  handleSubmitCO({type:"add_items",items:[{
                    ...manual,
                    en:manual.en||manual.es,
                    es:manual.es||manual.en,
                    section:sec?.id||manual.section,  // store id for reliable matching
                    sectionLabel:sec?.label||manual.section
                  }]});
                  if (!isApprovalUser) setManual({en:"",es:"",note:"",section:""});
                }} disabled={(!manual.en&&!manual.es)||!manual.section} style={solid((!manual.en&&!manual.es)||!manual.section?"#94A3B8":isApprovalUser?"#C97B4B":"#16A34A")}>
                  {isApprovalUser?(lang==="es"?"Enviar para Aprobación":"Submit for Approval"):(lang==="es"?"Agregar ítem":"Add Item")}
                </button>
                <RedBtn onClick={()=>setShowCO(false)} label={lang==="es"?"Cancelar":"Cancel"}/>
              </div>
            </>
          )}
        </>
      )}

      {coTab==="remove" && <RemoveTab job={job} lang={lang} isApprovalUser={isApprovalUser} submitCO={submitCO} activeJob={activeJob} setCoSubmitted={setSubmitted} setShowCO={setShowCO} deleteItem={deleteItem} solid={solid} ghost={ghost}/>}

      {coTab==="materials" && (
        <>
          {["client","contractor"].map(provider=>{
            const filtered=mats.filter(m=>m.providedBy===provider);
            return (
              <div key={provider} style={{marginBottom:20}}>
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"7px 12px",borderRadius:10,background:provider==="client"?"#EFF6FF":"#F0FDF4",marginBottom:8}}>
                  <span style={{fontSize:13,fontWeight:600,color:provider==="client"?"#1E40AF":"#166534"}}>
                    {provider==="client"?(lang==="es"?"👤 Cliente Provee":"👤 Client Provides"):(lang==="es"?"🔨 Contratista Provee":"🔨 Contractor Provides")}
                  </span>
                  <span style={{marginLeft:"auto",fontSize:11,color:"var(--color-text-tertiary)"}}>{filtered.length} item{filtered.length!==1?"s":""}</span>
                </div>
                {filtered.length===0 && <div style={{fontSize:13,color:"var(--color-text-tertiary)",padding:"4px 12px"}}>None listed.</div>}
                {filtered.length>0 && (
                  <div style={{border:"1px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden"}}>
                    {filtered.map((m,idx)=>{
                      const st=MAT_STATUS[m.status]||MAT_STATUS.pending;
                      return (
                        <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:"1px solid var(--color-border-tertiary)",background:idx%2===0?"var(--color-background-primary)":"var(--color-background-secondary)"}}>
                          <div style={{flex:1,fontSize:13,color:"var(--color-text-primary)",fontWeight:500}}>{lang==="es"?getMatEs(m):m.name}</div>
                          <select value={m.status} onChange={e=>updateMatStatus(m.id,e.target.value)} style={{fontSize:11,fontWeight:600,color:st.color,background:st.bg,border:"none",borderRadius:20,padding:"3px 8px",cursor:"pointer",outline:"none"}}>
                            {Object.entries(MAT_STATUS).map(([k,v])=><option key={k} value={k}>{lang==="es"?v.labelEs:v.label}</option>)}
                          </select>
                          <TrashBtn onClick={()=>setConfirmDelMat({id:m.id,name:m.name})}/>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
          <div style={{...css.card,marginTop:4}}>
            <div style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)",marginBottom:12}}>{lang==="es"?"Agregar Material":"Add Material"}</div>
            <input value={mat.name} onChange={e=>setMat(p=>({...p,name:e.target.value}))} placeholder={lang==="es"?"Nombre del material…":"Material name…"} style={{...inp,marginBottom:10}}/>
            <div style={{display:"flex",gap:10,marginBottom:10}}>
              <div style={{flex:1}}>
                <div style={{...css.label,marginBottom:6}}>{lang==="es"?"Provisto por":"Provided by"}</div>
                <select value={mat.providedBy} onChange={e=>setMat(p=>({...p,providedBy:e.target.value}))} style={inp}>
                  <option value="client">{lang==="es"?"Cliente":"Client"}</option>
                  <option value="contractor">{lang==="es"?"Contratista":"Contractor"}</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <div style={{...css.label,marginBottom:6}}>Status</div>
                <select value={mat.status} onChange={e=>setMat(p=>({...p,status:e.target.value}))} style={inp}>
                  {Object.entries(MAT_STATUS).map(([k,v])=><option key={k} value={k}>{lang==="es"?v.labelEs:v.label}</option>)}
                </select>
              </div>
            </div>
            <button disabled={!mat.name.trim()} onClick={()=>{
              if (!mat.name.trim()) return;
              submitCO(activeJob,{type:"add_mat",mat:{...mat}});
              if (isApprovalUser) setSubmitted(true);
              else setMat({name:"",providedBy:"client",status:"pending"});
            }} style={{...solid(!mat.name.trim()?"#94A3B8":isApprovalUser?"#C97B4B":ACCENT),flex:"none",width:"100%"}}>
              {isApprovalUser?(lang==="es"?"Enviar para Aprobación":"Submit for Approval"):(lang==="es"?"Agregar Material":"Add Material")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Field Notes ──────────────────────────────────────────────────────────────
function FieldNotesScreen({job,activeJob,user,jobsRef,checkedRef,setJobs,save,setShowNotes,can,inp,solid,ghost}) {
  const [localNote,setLocalNote]   = useState("");
  const [confirmDel,setConfirmDel] = useState(null);
  const notes = job?.notes||[];

  const handleAdd = useCallback(()=>{
    if (!localNote.trim()) return;
    const note={id:`n_${uid()}`,text:localNote.trim(),author:user?.name||"Unknown",ts:tsNow()};
    const updated=jobsRef.current.map(j=>j.id===activeJob?{...j,notes:[...(j.notes||[]),note]}:j);
    setJobs(updated); save(checkedRef.current,updated); setLocalNote("");
  },[localNote,user,activeJob,jobsRef,checkedRef,setJobs,save]);

  const commitDel = useCallback((noteId)=>{
    const updated=jobsRef.current.map(j=>j.id===activeJob?{...j,notes:(j.notes||[]).filter(n=>n.id!==noteId)}:j);
    setJobs(updated); save(checkedRef.current,updated); setConfirmDel(null);
  },[activeJob,jobsRef,checkedRef,setJobs,save]);

  return (
    <div style={css.page}>
      {confirmDel && <ConfirmBox message="Delete this note?" onConfirm={()=>commitDel(confirmDel)} onCancel={()=>setConfirmDel(null)} solid={solid} ghost={ghost}/>}
      <div style={{...css.row,marginBottom:24}}>
        <BackBtn onClick={()=>setShowNotes(false)}/>
        <div>
          <div style={{fontSize:20,fontWeight:700,color:"var(--color-text-primary)"}}>Field Notes</div>
          <div style={{fontSize:12,color:"#E05C3A",marginTop:1}}>📍 {job?.name}</div>
        </div>
      </div>
      {notes.length===0 && <div style={{textAlign:"center",padding:"40px 0",color:"var(--color-text-tertiary)"}}><div style={{fontSize:28,marginBottom:8}}>📋</div><div>No notes yet</div></div>}
      <div style={{marginBottom:16}}>
        {notes.map(n=>(
          <div key={n.id} style={{...css.card,marginBottom:8}}>
            <div style={{fontSize:14,color:"var(--color-text-primary)",lineHeight:1.6,marginBottom:8}}>{n.text}</div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <div style={{width:22,height:22,borderRadius:8,background:"#EEF2FF",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#4F46E5"}}>{n.author[0]}</div>
                <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{n.author} · {n.ts}</span>
              </div>
              {can("editJob") && <TrashBtn onClick={()=>setConfirmDel(n.id)}/>}
            </div>
          </div>
        ))}
      </div>
      {can("addNote") && (
        <div style={css.card}>
          <textarea value={localNote} onChange={e=>setLocalNote(e.target.value)} placeholder="Add a field note…" style={{...inp,minHeight:80,resize:"vertical",lineHeight:1.6,marginBottom:10}}/>
          <button onClick={handleAdd} disabled={!localNote.trim()} style={{...solid(ACCENT),flex:"none",width:"100%"}}>Add Note</button>
        </div>
      )}
    </div>
  );
}

// ─── Job Detail ───────────────────────────────────────────────────────────────
function JobDetail({job,checked,toggle,lang,setLang,user,can,jobsRef,checkedRef,pendingRef,setJobs,setChecked,save,setPendingCOs,savePending,setScreen,setShowCO,setCoTab,setShowNotes,pausePollRef,inp,solid,ghost}) {
  const {total,done,pct}=getProgress(job,checked);
  const barColor=pct===100?"#16A34A":pct>=60?"#C97B4B":ACCENT;
  const noteCount=(job.notes||[]).length;
  const mats=job.materials||[];
  const pendingMats=mats.filter(m=>m.status==="pending"||m.status==="missing").length;
  const isOwnerOrDirector=user?.access==="owner"||user?.access==="director";

  return (
    <div style={css.page}>
      <div style={{...css.row,marginBottom:20}}>
        <BackBtn onClick={()=>setScreen("home")}/>
        <div style={{flex:1}}>
          <div style={{fontSize:20,fontWeight:700,color:"var(--color-text-primary)"}}>{job.name}</div>
          <div style={{fontSize:12,color:"#E05C3A",marginTop:1}}>📍 {job.address}</div>
          {job.phone && <div style={{fontSize:12,color:"var(--color-text-tertiary)",marginTop:1}}>📞 {job.phone}</div>}
        </div>
        <LangToggle lang={lang} setLang={setLang}/>
      </div>
      <div style={{...css.card,marginBottom:16}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:10}}>
          <span style={css.label}>Progress</span>
          <span style={{fontSize:22,fontWeight:700,color:barColor}}>{pct}%</span>
        </div>
        <div style={{background:"var(--color-background-secondary)",borderRadius:4,height:8,overflow:"hidden",marginBottom:6}}>
          <div style={{width:`${pct}%`,height:"100%",background:barColor,borderRadius:4,transition:"width 0.4s"}}/>
        </div>
        <div style={{fontSize:12,color:"var(--color-text-tertiary)"}}>{done} of {total} tasks complete</div>
      </div>
      <div style={{display:"flex",gap:10,marginBottom:16}}>
        {can("changeOrder") && (
          <div onClick={()=>{setShowCO(true);setCoTab("add");}} style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"12px 14px",border:"1px solid #FDE68A",borderRadius:12,cursor:"pointer",background:"#FFFBEB"}}>
            <div style={{width:28,height:28,borderRadius:8,background:"#FEF3C7",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>⚙</div>
            <div><div style={{fontSize:13,fontWeight:600,color:"#92400E"}}>Change Order</div><div style={{fontSize:11,color:"#A16207"}}>Add · Remove · Materials</div></div>
          </div>
        )}
        <div onClick={()=>setShowNotes(true)} style={{flex:1,display:"flex",alignItems:"center",gap:10,padding:"12px 14px",border:"1px solid #BFDBFE",borderRadius:12,cursor:"pointer",background:"#EFF6FF"}}>
          <div style={{width:28,height:28,borderRadius:8,background:"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>✎</div>
          <div><div style={{fontSize:13,fontWeight:600,color:"#1E40AF"}}>Field Notes</div><div style={{fontSize:11,color:"#2563EB"}}>{noteCount} note{noteCount!==1?"s":""}</div></div>
        </div>
      </div>
      {mats.length>0 && (
        <div onClick={()=>can("changeOrder")&&(setShowCO(true),setCoTab("materials"))} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",border:`1px solid ${pendingMats>0?"#FDE68A":"var(--color-border-tertiary)"}`,borderRadius:12,marginBottom:20,cursor:can("changeOrder")?"pointer":"default",background:pendingMats>0?"#FFFBEB":"var(--color-background-secondary)"}}>
          <span style={{fontSize:14}}>📦</span>
          <div style={{flex:1}}>
            <span style={{fontSize:13,fontWeight:600,color:pendingMats>0?"#92400E":"var(--color-text-primary)"}}>{mats.length} material{mats.length!==1?"s":""} tracked</span>
            {pendingMats>0 && <span style={{fontSize:11,color:"#D97706",marginLeft:8}}>{pendingMats} pending</span>}
          </div>
          {can("changeOrder") && <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/></svg>}
        </div>
      )}
      {job.sections.length===0 && <div style={{fontSize:13,color:"var(--color-text-tertiary)",textAlign:"center",marginTop:40}}>No checklist items yet.</div>}
      {job.sections.map(sec=>{
        const secDone=sec.items.filter(i=>checked[`${job.id}_${i.id}`]).length;
        const coCount=sec.items.filter(i=>i.isChangeOrder).length;
        return (
          <div key={sec.id} style={{marginBottom:28}}>
            <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderRadius:10,background:sec.isWarranty?"#EDE9FE":"var(--color-background-secondary)",marginBottom:8}}>
              <div style={{width:10,height:10,borderRadius:3,background:sec.color,flexShrink:0}}/>
              <span style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)",flex:1}}>{sec.label}</span>
              {sec.isWarranty && <Badge label="Warranty" bg="#EDE9FE" color="#5B21B6"/>}
              {coCount>0 && <Badge label={`+${coCount} CO`} bg="#FEF3C7" color="#92400E"/>}
              <span style={{fontSize:11,fontWeight:600,color:secDone===sec.items.length?"#16A34A":sec.color}}>{secDone}/{sec.items.length}</span>
            </div>
            <div style={{border:"1px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden"}}>
              {sec.items.map(item=>{
                const k=`${job.id}_${item.id}`; const isDone=checked[k];
                const bl=item.isWarranty?"3px solid #7C3AED":item.isChangeOrder?"3px solid #F59E0B":"3px solid transparent";
                const bg=isDone?"var(--color-background-secondary)":item.isWarranty?"#F5F3FF":item.isChangeOrder?"#FFFBEB":"var(--color-background-primary)";
                return (
                  <div key={item.id} onClick={()=>toggle(job.id,item.id)} style={{display:"flex",alignItems:"flex-start",gap:14,padding:"13px 16px",background:bg,borderBottom:"1px solid var(--color-border-tertiary)",cursor:"pointer",opacity:isDone?0.5:1,transition:"opacity 0.2s",borderLeft:bl}}>
                    <div style={{width:20,height:20,flexShrink:0,marginTop:1,border:`2px solid ${isDone?"#16A34A":item.isWarranty?"#7C3AED":item.isChangeOrder?"#F59E0B":sec.color}`,borderRadius:6,background:isDone?"#16A34A":"transparent",display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.2s"}}>
                      {isDone && <CheckIcon/>}
                    </div>
                    <div style={{flex:1}}>
                      {item.isWarranty && <div style={{fontSize:9,color:"#7C3AED",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Warranty</div>}
                      {item.isChangeOrder&&!item.isWarranty && <div style={{fontSize:9,color:"#D97706",letterSpacing:1,textTransform:"uppercase",fontWeight:700,marginBottom:2}}>Change Order</div>}
                      <div style={{fontSize:14,color:"var(--color-text-primary)",textDecoration:isDone?"line-through":"none",lineHeight:1.5}}>{lang==="es"?(item.es||item.en):item.en}</div>
                      {item.note && <div style={{fontSize:11,color:item.isWarranty?"#7C3AED":item.isChangeOrder?"#D97706":sec.color,marginTop:4,fontWeight:500}}>{item.note}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {job.status==="complete" && can("warranty") && <WarrantyCard activeJob={job.id} jobsRef={jobsRef} checkedRef={checkedRef} setJobs={setJobs} save={save} inp={inp} solid={solid} ghost={ghost}/>}
      {pct===100 && can("editJob") && job.status!=="complete" && <ProjectCompleteCard job={job} activeJob={job.id} user={user} jobsRef={jobsRef} checkedRef={checkedRef} pendingRef={pendingRef} setJobs={setJobs} save={save} setPendingCOs={setPendingCOs} savePending={savePending} setScreen={setScreen} isOwnerOrDirector={isOwnerOrDirector} pausePollRef={pausePollRef} inp={inp} solid={solid} ghost={ghost}/>}
    </div>
  );
}

// ─── Edit Job Form ────────────────────────────────────────────────────────────
function EditJobForm({editingJob,setEditingJob,jobsRef,checkedRef,setJobs,save,user,inp,solid,ghost}) {
  const [form,setForm]=useState({...editingJob,clientNotes:""});
  const upd=f=>e=>setForm(p=>({...p,[f]:e.target.value}));
  const handleSave=()=>{
    let updated=jobsRef.current.map(j=>j.id===form.id?{...j,...form}:j);
    if (form.clientNotes?.trim()) {
      const note={id:`n_${uid()}`,text:form.clientNotes.trim(),author:user?.name||"",ts:tsNow()};
      updated=updated.map(j=>j.id===form.id?{...j,notes:[...(j.notes||[]),note],clientNotes:""}:j);
    }
    setJobs(updated); save(checkedRef.current,updated); setEditingJob(null);
  };
  return (
    <div style={css.page}>
      <div style={{...css.row,marginBottom:24}}>
        <BackBtn onClick={()=>setEditingJob(null)}/>
        <div style={{fontSize:20,fontWeight:700,color:"var(--color-text-primary)"}}>Edit Job</div>
      </div>
      {[{f:"name",l:"Client Name"},{f:"address",l:"Address"},{f:"phone",l:"Client Phone"}].map(({f,l})=>(
        <div key={f} style={{marginBottom:14}}>
          <div style={{...css.label,marginBottom:6}}>{l}</div>
          <input value={form[f]||""} onChange={upd(f)} placeholder={f==="phone"?"(912) 555-0100":""} style={inp}/>
        </div>
      ))}
      <div style={{marginBottom:20}}>
        <div style={{...css.label,marginBottom:8}}>Status</div>
        <div style={{display:"flex",gap:8}}>
          {Object.entries(STATUS).filter(([s])=>s!=="complete").map(([s,{label,color,bg}])=>(
            <div key={s} onClick={()=>setForm(p=>({...p,status:s}))} style={{flex:1,padding:"10px",textAlign:"center",borderRadius:10,border:`2px solid ${form.status===s?color:"var(--color-border-tertiary)"}`,background:form.status===s?bg:"transparent",color:form.status===s?color:"var(--color-text-tertiary)",fontSize:12,fontWeight:form.status===s?600:400,cursor:"pointer"}}>
              {label}
            </div>
          ))}
        </div>
      </div>
      <div style={{marginBottom:20}}>
        <div style={{...css.label,marginBottom:8}}>Client Notes</div>
        <textarea value={form.clientNotes||""} onChange={upd("clientNotes")} placeholder="e.g. Call Clara to confirm fixture finish…" style={{...inp,minHeight:90,resize:"vertical",lineHeight:1.6}}/>
        <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginTop:6}}>Saves as a Field Note on this job.</div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={handleSave} style={solid(ACCENT)}>Save Changes</button>
        <button onClick={()=>setEditingJob(null)} style={ghost}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Home Screen ──────────────────────────────────────────────────────────────
function HomeScreen({jobs,checked,user,can,canApprove,pendingCOs,statusFilter,setStatusFilter,searchQuery,setSearchQuery,setActiveJob,setScreen,setEditingJob,setShowApprovals,setShowAddJob,showAddJob,jobsRef,checkedRef,setJobs,setChecked,save,syncStatus,lang,setLang,signOut,inp,solid,ghost,aiPreview,setAiPreview,aiEditing,setAiEditing,aiDraft,setAiDraft,pausePollRef,setShowCO,setCoTab}) {
  const [jobMenu,setJobMenu]       = useState(null);
  const [confirmDelete,setConfirm] = useState(null);
  const [addMode,setAddMode]       = useState("ai");
  const [rawNotes,setRawNotes]     = useState("");
  const [aiLoading,setAiLoading]   = useState(false);
  const [aiErr,setAiErr]           = useState("");
  const [newJob,setNewJob]         = useState({name:"",address:"",phase:"",phone:""});
  const [confirmSO,setConfirmSO]   = useState(false);

  const openAiEdit  = useCallback(()=>{ setAiDraft(JSON.parse(JSON.stringify(aiPreview))); setAiEditing(true); },[aiPreview,setAiDraft,setAiEditing]);
  const saveAiEdit  = useCallback(()=>{ setAiPreview(aiDraft); setAiEditing(false); },[aiDraft,setAiPreview,setAiEditing]);
  const draftField  = useCallback((f,v)       =>setAiDraft(p=>({...p,[f]:v})),[setAiDraft]);
  const draftItem   = useCallback((si,ii,f,v) =>setAiDraft(p=>({...p,sections:p.sections.map((s,i)=>i!==si?s:{...s,items:s.items.map((it,j)=>j!==ii?it:{...it,[f]:v})})})),[setAiDraft]);
  const removeAiItem= useCallback((si,ii)     =>setAiDraft(p=>({...p,sections:p.sections.map((s,i)=>i!==si?s:{...s,items:s.items.filter((_,j)=>j!==ii)})})),[setAiDraft]);
  const addAiItem   = useCallback((si)        =>setAiDraft(p=>({...p,sections:p.sections.map((s,i)=>i!==si?s:{...s,items:[...s.items,{id:`i_${uid()}`,en:"",es:"",note:""}]})})),[setAiDraft]);
  const draftMat    = useCallback((mi,f,v)    =>setAiDraft(p=>({...p,materials:p.materials.map((m,i)=>i!==mi?m:{...m,[f]:v})})),[setAiDraft]);
  const removeAiMat = useCallback((mi)        =>setAiDraft(p=>({...p,materials:p.materials.filter((_,i)=>i!==mi)})),[setAiDraft]);

  const runGenerate = async () => {
    if (!rawNotes.trim()) return;
    setAiLoading(true); setAiPreview(null); setAiErr("");
    try {
      const raw = await callAI(
        "You are a construction project assistant. Respond ONLY with raw valid JSON. No markdown, no backticks, no preamble.",
        `Parse these raw job notes into a structured checklist JSON. Organize by room/trade. Keep task text SHORT.\n\nNotes:\n${rawNotes}\n\nReturn ONLY:\n{"name":"client","address":"","phase":"","sections":[{"id":"s1","label":"Label","color":"#C97B4B","items":[{"id":"i1","en":"task","es":"tarea","note":""}]}],"materials":[{"id":"m1","name":"item","providedBy":"client","status":"pending"}]}\n\nColors: #C97B4B #4A7FA5 #5A8A6A #8A6AAA #A07850 #6A8AA0. Translate all tasks to Spanish. Omit empty notes.`
      , 4000);
      const parsed = parseJSON(raw);
      if (!parsed?.sections?.length) throw new Error("No sections returned. Add more detail to your notes.");
      setAiPreview(parsed);
    } catch(e) { setAiErr(e.message); }
    setAiLoading(false);
  };

  const runConfirm = useCallback(()=>{
    if (!aiPreview) return;
    const j={id:`job_${uid()}`,status:"active",phone:"",notes:[],...aiPreview,materials:aiPreview.materials||[]};
    const updated=[...jobsRef.current,j];
    setJobs(updated); save(checkedRef.current,updated);
    setRawNotes(""); setAiPreview(null); setAiEditing(false); setAiDraft(null); setShowAddJob(false);
  },[aiPreview,jobsRef,checkedRef,setJobs,save,setAiPreview,setAiEditing,setAiDraft,setShowAddJob]);

  const doDelete = useCallback(async(id)=>{
    pausePollRef.current=true;
    const updated=jobsRef.current.filter(j=>j.id!==id);
    const nc={...checkedRef.current};
    Object.keys(nc).forEach(k=>{ if(k.startsWith(id)) delete nc[k]; });
    setJobs(updated); setChecked(nc);
    await save(nc,updated);
    pausePollRef.current=false;
    setConfirm(null);
  },[jobsRef,checkedRef,setJobs,setChecked,save,pausePollRef]);

  const syncDot=syncStatus==="synced"?"#22C55E":syncStatus==="saving"?"#F59E0B":"#EF4444";
  const myRejected=pendingCOs.filter(p=>p.status==="rejected"&&p.submittedBy===user?.name&&!(p.dismissedBy||[]).includes(user?.name));
  const pendingCount=pendingCOs.filter(p=>p.status==="pending"&&p.type!=="project_status"&&!(p.dismissedBy||[]).includes(user?.name)).length;
  const updatesCount=pendingCOs.filter(p=>p.type==="project_status"&&!(p.dismissedBy||[]).includes(user?.name)).length;
  const totalNotifs=pendingCount+updatesCount+myRejected.length;
  const filteredJobs=(statusFilter==="all"?jobs:jobs.filter(j=>j.status===statusFilter)).filter(j=>{
    if (!searchQuery.trim()) return true;
    const q=searchQuery.toLowerCase();
    return (j.address||"").toLowerCase().includes(q)||(j.phone||"").toLowerCase().includes(q)||(j.name||"").toLowerCase().includes(q);
  });
  const accessStyles={owner:["#FFF7ED","#C2410C"],director:["#EFF6FF","#1D4ED8"],pm:["#F0FDF4","#166534"],apm:["#FAF5FF","#6B21A8"],employee:["#F0FDF4","#166534"]};
  const [abg,atx]=accessStyles[user?.access]||["var(--color-background-secondary)","var(--color-text-secondary)"];

  return (
    <div style={css.page} onClick={()=>jobMenu&&setJobMenu(null)}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <div style={{fontSize:28,fontWeight:700,color:"var(--color-text-primary)",letterSpacing:-1,fontFamily:F}}>Tardio</div>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:20,background:"var(--color-background-secondary)",border:"1px solid var(--color-border-tertiary)"}}>
            <div style={{width:7,height:7,borderRadius:"50%",background:syncDot,transition:"background 0.3s"}}/>
            <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{syncStatus==="synced"?"Synced":syncStatus==="saving"?"Saving…":"Offline"}</span>
          </div>
          <div style={{width:36,height:36,borderRadius:10,background:abg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,color:atx,border:"1px solid var(--color-border-tertiary)"}}>{user?.name[0]}</div>
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",borderRadius:12,background:abg,border:"1px solid var(--color-border-tertiary)",marginBottom:16}}>
        <div>
          <div style={{fontSize:13,fontWeight:600,color:atx}}>{user?.name}</div>
          <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginTop:1}}>{user?.role}</div>
        </div>
        <div style={{...css.label,color:atx,fontSize:10}}>{user?.access?.toUpperCase()}</div>
      </div>
      {canApprove()&&totalNotifs>0 && (
        <div onClick={()=>setShowApprovals(true)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:"1.5px solid #FCA5A5",borderRadius:12,marginBottom:16,background:"#FFF1F2",cursor:"pointer"}}>
          <div style={{width:32,height:32,borderRadius:9,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>⚠️</div>
          <div style={{flex:1}}><div style={{fontSize:13,fontWeight:700,color:"#DC2626"}}>{totalNotifs} Notification{totalNotifs!==1?"s":""}</div><div style={{fontSize:11,color:"#EF4444",marginTop:1}}>Tap to review</div></div>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#DC2626" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
      )}
      {myRejected.length>0 && (
        <div onClick={()=>setShowApprovals(true)} style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",border:"1px solid var(--color-border-tertiary)",borderRadius:12,marginBottom:16,background:"var(--color-background-secondary)",cursor:"pointer"}}>
          <div style={{width:32,height:32,borderRadius:9,background:"#FEE2E2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,flexShrink:0}}>✕</div>
          <div style={{flex:1}}>
            <div style={{fontSize:13,fontWeight:600,color:"#DC2626"}}>{myRejected.length} Change Order{myRejected.length!==1?"s":""} Rejected</div>
            {myRejected[0].rejectReason && <div style={{fontSize:11,color:"var(--color-text-tertiary)",marginTop:2}}>"{myRejected[0].rejectReason.slice(0,60)}{myRejected[0].rejectReason.length>60?"…":""}"</div>}
          </div>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/></svg>
        </div>
      )}
      <div style={{position:"relative",marginBottom:14}}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>
          <circle cx="6.5" cy="6.5" r="4.5" stroke="var(--color-text-tertiary)" strokeWidth="1.5"/>
          <path d="M10 10L14 14" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search by name, address or phone…" style={{...inp,paddingLeft:34,paddingRight:searchQuery?34:14}}/>
        {searchQuery && <div onClick={()=>setSearchQuery("")} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",cursor:"pointer",fontSize:16,color:"var(--color-text-tertiary)",lineHeight:1}}>✕</div>}
      </div>
      <div style={{display:"flex",gap:6,marginBottom:20,overflowX:"auto",paddingBottom:2}}>
        {["active","hold","complete","all"].map(f=>{
          const count=f==="all"?jobs.length:jobs.filter(j=>j.status===f).length;
          const isActive=statusFilter===f;
          const col=f==="all"?ACCENT:STATUS[f]?.color;
          const bg=f==="all"?"#EEF2FF":STATUS[f]?.bg;
          return (
            <div key={f} onClick={()=>setStatusFilter(f)} style={{flexShrink:0,display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:20,border:`1.5px solid ${isActive?col:"var(--color-border-tertiary)"}`,background:isActive?bg:"transparent",cursor:"pointer",fontSize:12,fontWeight:isActive?600:400,color:isActive?col:"var(--color-text-tertiary)",userSelect:"none"}}>
              {f==="all"?"All":STATUS[f].label}
              <span style={{fontSize:10,background:isActive?`${col}25`:"var(--color-background-secondary)",color:isActive?col:"var(--color-text-tertiary)",borderRadius:10,padding:"1px 6px",fontWeight:600}}>{count}</span>
            </div>
          );
        })}
      </div>
      {filteredJobs.length===0 && <div style={{textAlign:"center",padding:"40px 0",color:"var(--color-text-tertiary)",fontSize:13}}>{searchQuery?`No jobs matching "${searchQuery}"`:`No ${statusFilter!=="all"?STATUS[statusFilter]?.label.toLowerCase():""} jobs.`}</div>}
      {filteredJobs.map(job=>{
        const {total,done,pct}=getProgress(job,checked);
        const barColor=pct===100?"#16A34A":pct>=60?"#C97B4B":ACCENT;
        const coCount=job.sections.reduce((s,sec)=>s+sec.items.filter(i=>i.isChangeOrder).length,0);
        const nc=(job.notes||[]).length;
        const pmats=(job.materials||[]).filter(m=>m.status==="pending"||m.status==="missing").length;
        const st=STATUS[job.status];
        return (
          <div key={job.id} style={{marginBottom:12}}>
            {confirmDelete===job.id && <ConfirmBox message="Delete jobsite? This cannot be undone." onConfirm={()=>doDelete(job.id)} onCancel={()=>setConfirm(null)} solid={solid} ghost={ghost}/>}
            <div style={{...css.card,position:"relative"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                <div onClick={()=>{setActiveJob(job.id);setScreen("job");}} style={{flex:1,cursor:"pointer"}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:4}}>
                    <div style={{fontSize:17,fontWeight:700,color:"var(--color-text-primary)",letterSpacing:-0.3}}>{job.name}</div>
                    {coCount>0 && <Badge label={`+${coCount} CO`} bg="#FEF3C7" color="#92400E"/>}
                    {nc>0      && <Badge label={`${nc} note${nc!==1?"s":""}`} bg="#DBEAFE" color="#1E40AF"/>}
                    {pmats>0   && <Badge label={`📦 ${pmats}`} bg="#FEF3C7" color="#D97706"/>}
                  </div>
                  <div style={{fontSize:12,color:"#E05C3A"}}>📍 {job.address}</div>
                  {job.phone && <div style={{fontSize:12,color:"var(--color-text-tertiary)",marginTop:2}}>📞 {job.phone}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6}}>
                  <span style={{fontSize:11,background:st.bg,color:st.color,borderRadius:20,padding:"3px 10px",fontWeight:600}}>{st.label}</span>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:11,color:"var(--color-text-tertiary)"}}>{job.phase}</span>
                    {(can("editJob")||can("deleteJob")||can("changeOrder")) && (
                      <div onClick={e=>{e.stopPropagation();setJobMenu(jobMenu===job.id?null:job.id);}} style={{width:28,height:28,borderRadius:8,border:"1px solid var(--color-border-secondary)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",background:"var(--color-background-primary)",fontSize:16,color:"var(--color-text-tertiary)"}}>⋯</div>
                    )}
                  </div>
                </div>
              </div>
              {jobMenu===job.id && (
                <div onClick={e=>e.stopPropagation()} style={{background:"#DCFCE7",borderRadius:"0 0 12px 12px",margin:"12px -14px -14px",padding:"4px 0 4px"}}>
                  <div style={{padding:"6px 16px 8px",borderBottom:"1px solid rgba(0,0,0,0.06)"}}>
                    <span style={{fontSize:11,color:"#166534",fontWeight:600,textTransform:"uppercase",letterSpacing:0.8}}>Options</span>
                  </div>
                  {can("editJob")     && <div onClick={()=>{setEditingJob({...job});setJobMenu(null);}} style={{padding:"12px 16px",fontSize:14,cursor:"pointer",color:"#166534",fontWeight:500,borderBottom:"1px solid rgba(0,0,0,0.06)"}}>✎  Edit job</div>}
                  {can("changeOrder") && <div onClick={()=>{setActiveJob(job.id);setScreen("job");setShowCO(true);setCoTab("add");setJobMenu(null);}} style={{padding:"12px 16px",fontSize:14,cursor:"pointer",color:"#15803D",fontWeight:500,borderBottom:"1px solid rgba(0,0,0,0.06)"}}>+  Change order</div>}
                  {can("deleteJob")   && <div onClick={e=>{e.stopPropagation();setConfirm(job.id);setJobMenu(null);}} style={{padding:"12px 16px",fontSize:14,cursor:"pointer",color:"#DC2626",fontWeight:500}}>✕  Delete job</div>}
                </div>
              )}
            </div>
          </div>
        );
      })}
      {can("addJob") && (showAddJob ? (
        <div style={{...css.card,marginTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
            <div style={{fontSize:15,fontWeight:700,color:"var(--color-text-primary)"}}>New Job Site</div>
            <div style={{display:"flex",border:"1px solid var(--color-border-tertiary)",borderRadius:10,overflow:"hidden",background:"var(--color-background-secondary)"}}>
              {["ai","manual"].map(m=>(
                <div key={m} onClick={()=>{setAddMode(m);setAiPreview(null);setAiEditing(false);setAiDraft(null);setAiErr("");}} style={{padding:"6px 16px",fontSize:12,fontWeight:500,cursor:"pointer",background:addMode===m?ACCENT:"transparent",color:addMode===m?"white":"var(--color-text-tertiary)",userSelect:"none"}}>
                  {m==="ai"?"✦ AI":"Manual"}
                </div>
              ))}
            </div>
          </div>
          {addMode==="ai" ? (
            !aiPreview ? (
              <>
                <div style={{fontSize:12,color:"var(--color-text-tertiary)",marginBottom:6}}>Bullet-point your notes. AI organizes by room and trade.</div>
                <div style={{fontSize:11,color:rawNotes.length>4800?"#EF4444":"var(--color-text-tertiary)",marginBottom:6,textAlign:"right"}}>{rawNotes.length}/5000</div>
                <textarea value={rawNotes} onChange={e=>e.target.value.length<=5000&&setRawNotes(e.target.value)} placeholder={"Client: Maria, 44 Oak St\nMaster Bath:\n- Demo everything\n- New tile floor"} style={{...inp,minHeight:130,resize:"vertical",lineHeight:1.7,marginBottom:12}}/>
                <ErrMsg msg={aiErr}/>
                <div style={{display:"flex",gap:10,marginTop:aiErr?10:0}}>
                  <button onClick={runGenerate} disabled={aiLoading||!rawNotes.trim()} style={solid(aiLoading||!rawNotes.trim()?"#94A3B8":ACCENT)}>{aiLoading?"Generating…":"✦ Generate"}</button>
                  <button onClick={()=>setShowAddJob(false)} style={ghost}>Cancel</button>
                </div>
              </>
            ) : aiEditing && aiDraft ? (
              <>
                <div style={{fontSize:13,fontWeight:600,color:ACCENT,marginBottom:14}}>Edit before saving</div>
                {[{f:"name",l:"Client Name"},{f:"address",l:"Address"},{f:"phase",l:"Phase"}].map(({f,l})=>(
                  <div key={f} style={{marginBottom:12}}>
                    <div style={{...css.label,marginBottom:5}}>{l}</div>
                    <input value={aiDraft[f]||""} onChange={e=>draftField(f,e.target.value)} style={inp}/>
                  </div>
                ))}
                {aiDraft.sections?.map((sec,si)=>(
                  <div key={si} style={{marginBottom:14,border:"1px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",background:"var(--color-background-secondary)"}}>
                      <div style={{width:10,height:10,borderRadius:3,background:sec.color,flexShrink:0}}/>
                      <span style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)"}}>{sec.label}</span>
                    </div>
                    {sec.items.map((item,ii)=>(
                      <div key={ii} style={{padding:"10px 14px",borderTop:"1px solid var(--color-border-tertiary)",background:"var(--color-background-primary)"}}>
                        <div style={{display:"flex",gap:8,marginBottom:6}}>
                          <input value={item.en||""} onChange={e=>draftItem(si,ii,"en",e.target.value)} placeholder="English task" style={{...inp,fontSize:12,padding:"7px 10px",flex:1}}/>
                          <div onClick={()=>removeAiItem(si,ii)} style={{width:28,height:32,borderRadius:8,background:"#FFF1F2",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
                          </div>
                        </div>
                        <input value={item.es||""} onChange={e=>draftItem(si,ii,"es",e.target.value)} placeholder="Tarea en español" style={{...inp,fontSize:12,padding:"7px 10px",marginBottom:6}}/>
                        <input value={item.note||""} onChange={e=>draftItem(si,ii,"note",e.target.value)} placeholder="Note (optional)" style={{...inp,fontSize:12,padding:"7px 10px"}}/>
                      </div>
                    ))}
                    <div onClick={()=>addAiItem(si)} style={{padding:"10px 14px",borderTop:"1px solid var(--color-border-tertiary)",fontSize:12,color:ACCENT,cursor:"pointer",background:"var(--color-background-secondary)",fontWeight:500}}>+ Add item</div>
                  </div>
                ))}
                {aiDraft.materials?.length>0 && (
                  <div style={{marginBottom:14,border:"1px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden"}}>
                    <div style={{padding:"10px 14px",background:"#FFFBEB",borderBottom:"1px solid var(--color-border-tertiary)"}}>
                      <span style={{fontSize:13,fontWeight:600,color:"#92400E"}}>📦 Materials</span>
                    </div>
                    {aiDraft.materials.map((m,mi)=>(
                      <div key={mi} style={{display:"flex",gap:8,padding:"10px 14px",borderTop:mi>0?"1px solid var(--color-border-tertiary)":undefined,alignItems:"center",background:"var(--color-background-primary)"}}>
                        <input value={m.name||""} onChange={e=>draftMat(mi,"name",e.target.value)} placeholder="Material" style={{...inp,fontSize:12,padding:"7px 10px",flex:2}}/>
                        <select value={m.providedBy||"client"} onChange={e=>draftMat(mi,"providedBy",e.target.value)} style={{...inp,fontSize:12,padding:"7px 10px",flex:1}}>
                          <option value="client">Client</option>
                          <option value="contractor">Contractor</option>
                        </select>
                        <div onClick={()=>removeAiMat(mi)} style={{width:28,height:32,borderRadius:8,background:"#FFF1F2",border:"1px solid #FECACA",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",flexShrink:0}}>
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2l-8 8" stroke="#EF4444" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{display:"flex",gap:10}}>
                  <button onClick={saveAiEdit} style={solid(ACCENT)}>Done Editing</button>
                  <button onClick={()=>setAiEditing(false)} style={ghost}>Cancel</button>
                </div>
              </>
            ) : (
              <>
                <div style={{fontSize:13,fontWeight:600,color:"#16A34A",marginBottom:12}}>Review before saving</div>
                <div style={{border:"1px solid var(--color-border-tertiary)",borderRadius:12,overflow:"hidden",marginBottom:14}}>
                  <div style={{padding:"12px 16px",background:"var(--color-background-secondary)",borderBottom:"1px solid var(--color-border-tertiary)"}}>
                    <div style={{fontSize:16,fontWeight:700,color:"var(--color-text-primary)"}}>{aiPreview.name}</div>
                    <div style={{fontSize:12,color:"#E05C3A",marginTop:2}}>📍 {aiPreview.address||"No address"}</div>
                  </div>
                  {aiPreview.sections?.map(sec=>(
                    <div key={sec.id} style={{padding:"10px 16px",borderBottom:"1px solid var(--color-border-tertiary)"}}>
                      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
                        <div style={{width:8,height:8,borderRadius:2,background:sec.color}}/>
                        <span style={{fontSize:11,fontWeight:600,color:sec.color,textTransform:"uppercase",letterSpacing:0.5}}>{sec.label}</span>
                      </div>
                      {sec.items?.map(item=>(
                        <div key={item.id} style={{fontSize:13,color:"var(--color-text-secondary)",padding:"3px 0",display:"flex",gap:8}}>
                          <span style={{color:"var(--color-border-secondary)"}}>·</span>
                          <span>{item.es||item.en}{item.note&&<span style={{fontSize:11,color:sec.color,marginLeft:6}}>({item.note})</span>}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {aiPreview.materials?.length>0 && (
                    <div style={{padding:"10px 16px",background:"#FFFBEB"}}>
                      <div style={{fontSize:11,fontWeight:600,color:"#92400E",textTransform:"uppercase",letterSpacing:0.5,marginBottom:6}}>📦 Materials</div>
                      {aiPreview.materials.map(m=>(
                        <div key={m.id} style={{fontSize:13,color:"var(--color-text-secondary)",padding:"2px 0",display:"flex",gap:8,alignItems:"center"}}>
                          <span style={{color:"var(--color-border-secondary)"}}>·</span>
                          <span>{m.name}</span>
                          <Badge label={m.providedBy} bg={m.providedBy==="client"?"#DBEAFE":"#DCFCE7"} color={m.providedBy==="client"?"#1E40AF":"#166534"}/>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                  <button onClick={runConfirm} style={{...solid("#16A34A"),flex:"none",padding:"11px 20px"}}>Save Job</button>
                  <BlueOutlineBtn onClick={openAiEdit} label="Edit"/>
                  <button onClick={()=>{setAiPreview(null);setAiEditing(false);setAiDraft(null);}} style={{...ghost,flex:"none",padding:"11px 16px"}}>Re-generate</button>
                  <button onClick={()=>{setShowAddJob(false);setAiPreview(null);setAiEditing(false);setAiDraft(null);setRawNotes("");}} style={{...ghost,flex:"none",padding:"11px 14px"}}>✕</button>
                </div>
              </>
            )
          ) : (
            <>
              {[{f:"name",ph:"Client name *"},{f:"address",ph:"Address *"},{f:"phone",ph:"Client phone (optional)"},{f:"phase",ph:"Current phase (optional)"}].map(({f,ph})=>(
                <input key={f} placeholder={ph} value={newJob[f]} onChange={e=>setNewJob(p=>({...p,[f]:e.target.value}))} style={{...inp,marginBottom:10}}/>
              ))}
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>{
                  if (!newJob.name||!newJob.address) return;
                  const j={id:`job_${uid()}`,...newJob,status:"active",phase:newJob.phase||"In Progress",sections:[],notes:[],materials:[]};
                  const updated=[...jobsRef.current,j];
                  setJobs(updated); save(checkedRef.current,updated);
                  setNewJob({name:"",address:"",phase:"",phone:""}); setShowAddJob(false);
                }} disabled={!newJob.name||!newJob.address} style={solid(!newJob.name||!newJob.address?"#94A3B8":ACCENT)}>Add Job</button>
                <button onClick={()=>setShowAddJob(false)} style={ghost}>Cancel</button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div onClick={()=>setShowAddJob(true)} style={{border:"1.5px dashed var(--color-border-secondary)",borderRadius:14,padding:"18px",textAlign:"center",cursor:"pointer",color:"var(--color-text-tertiary)",fontSize:14,fontWeight:500,marginTop:4,display:"flex",alignItems:"center",justifyContent:"center",gap:8,userSelect:"none"}}>
          <span style={{fontSize:18,fontWeight:300}}>+</span> Add Job Site
        </div>
      ))}
      {confirmSO ? (
        <div style={{marginTop:24,...css.card}}>
          <div style={{fontSize:14,color:"var(--color-text-primary)",marginBottom:12,textAlign:"center",fontWeight:500}}>Sign out as <strong>{user?.name}</strong>?</div>
          <div style={{display:"flex",gap:10}}>
            <button onClick={signOut} style={solid("#EF4444")}>Sign Out</button>
            <button onClick={()=>setConfirmSO(false)} style={ghost}>Cancel</button>
          </div>
        </div>
      ) : (
        <div onClick={()=>setConfirmSO(true)} style={{marginTop:32,textAlign:"center",fontSize:12,color:"var(--color-text-tertiary)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M11 11l3-3-3-3M14 8H6" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Sign out
        </div>
      )}
    </div>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,        setScreen]       = useState("login");
  const [loginType,     setLoginType]    = useState(null);
  const [user,          setUser]         = useState(null);
  const [pinInput,      setPinInput]     = useState("");
  const [pinError,      setPinError]     = useState(false);
  const [jobs,          setJobs]         = useState(INITIAL_JOBS);
  const [checked,       setChecked]      = useState({});
  const [activeJob,     setActiveJob]    = useState(null);
  const [lang,          setLang]         = useState("es");
  const [syncStatus,    setSyncStatus]   = useState("synced");
  const [statusFilter,  setStatusFilter] = useState("all");
  const [searchQuery,   setSearchQuery]  = useState("");
  const [showAddJob,    setShowAddJob]   = useState(false);
  const [editingJob,    setEditingJob]   = useState(null);
  const [showCO,        setShowCO]       = useState(false);
  const [coTab,         setCoTab]        = useState("add");
  const [showNotes,     setShowNotes]    = useState(false);
  const [pendingCOs,    setPendingCOs]   = useState([]);
  const [showApprovals, setShowApprovals]= useState(false);
  const [aiPreview,     setAiPreview]    = useState(null);
  const [aiEditing,     setAiEditing]    = useState(false);
  const [aiDraft,       setAiDraft]      = useState(null);

  const jobsRef    = useRef(INITIAL_JOBS);
  const pendingRef = useRef([]);
  const checkedRef = useRef({});
  const userRef    = useRef(null);
  const pausePollRef = useRef(false);

  useEffect(()=>{ jobsRef.current=jobs; },          [jobs]);
  useEffect(()=>{ pendingRef.current=pendingCOs; }, [pendingCOs]);
  useEffect(()=>{ checkedRef.current=checked; },    [checked]);
  useEffect(()=>{ userRef.current=user; },          [user]);

  const can        = useCallback(p=>user?(PERMS[user.access]?.[p]??false):false,[user]);
  const canApprove = useCallback(()=>!!(user&&CAN_APPROVE_CO.includes(user.access)),[user]);

  const loadPending = async()=>{ try { const list=await loadPendingCOs(); if(list) setPendingCOs(list); } catch(e){} };
  const savePending = async list=>{ try { await savePendingCOs(list); } catch(e){} };

  const load = async(silent=false)=>{
    try {
      const [j,c]=await Promise.all([loadJobs(),loadChecked()]);
      if(j) setJobs(j);
      if(c) setChecked({...c});
      if(!silent) setSyncStatus("synced");
    } catch(e) { if(!silent) setSyncStatus("offline"); }
  };

  const save = useCallback(async(nc,nj)=>{
    setSyncStatus("saving");
    try {
      await Promise.all([saveJobs(nj||jobsRef.current),saveChecked(nc)]);
      setSyncStatus("synced");
    } catch(e) { setSyncStatus("error"); }
  },[jobsRef]);
  useRealtimeSync({setJobs,setChecked,setPendingCOs});

  useEffect(()=>{
    load(); loadPending();
    const onVisChange=()=>{ if (!document.hidden) { load(true); loadPending(); } };
    document.addEventListener("visibilitychange",onVisChange);
    const t=setInterval(()=>{ if(!pausePollRef.current&&!document.hidden){load(true);loadPending();} },POLL_MS);
    return()=>{ clearInterval(t); document.removeEventListener("visibilitychange",onVisChange); };
  },[]);

  const handlePin = (k,type)=>{
    if (k==="del") { setPinInput(p=>p.slice(0,-1)); setPinError(false); return; }
    const next=pinInput+k; setPinInput(next);
    if (next.length===4) {
      if (type==="employee") {
        if (next==="0000") { setUser(EMPLOYEE_USER); setScreen("home"); setPinInput(""); setPinError(false); setLoginType(null); }
        else { setPinError(true); setTimeout(()=>{ setPinInput(""); setPinError(false); },800); }
      } else {
        const match=MGMT_USERS.find(u=>u.pin===next);
        if (match) { setUser(match); setScreen("home"); setPinInput(""); setPinError(false); setLoginType(null); }
        else { setPinError(true); setTimeout(()=>{ setPinInput(""); setPinError(false); },800); }
      }
    }
  };

  const signOut = ()=>{
    setUser(null); setScreen("login"); setLoginType(null); setPinInput(""); setPinError(false);
    setActiveJob(null); setShowCO(false); setShowNotes(false); setShowApprovals(false);
    setAiPreview(null); setAiEditing(false); setAiDraft(null);
  };

  const toggle = useCallback((jobId,itemId)=>{
    if (!can("changeOrder")&&!can("editJob")) return;
    const key=`${jobId}_${itemId}`;
    const next={...checkedRef.current,[key]:!checkedRef.current[key]};
    // If a task gets unchecked and the job is complete, revert it to active
    const job=jobsRef.current.find(j=>j.id===jobId);
    if (job?.status==="complete" && !next[key]) {
      const updated=jobsRef.current.map(j=>j.id===jobId?{...j,status:"active"}:j);
      setJobs(updated); setChecked(next); save(next,updated);
    } else {
      setChecked(next); save(next);
    }
  },[can,checkedRef,jobsRef,setJobs,save]);

  const deleteItem = useCallback((jobId,secId,itemId,batchItems)=>{
    let updated;
    if (batchItems) {
      updated=jobsRef.current.map(j=>{
        if(j.id!==jobId) return j;
        let secs=j.sections.map(s=>({...s,items:[...s.items]}));
        batchItems.forEach(({itemId:iId,secId:sId})=>{ secs=secs.map(sec=>sec.id!==sId?sec:{...sec,items:sec.items.filter(i=>i.id!==iId)}); });
        return {...j,sections:secs};
      });
      const nc={...checkedRef.current}; batchItems.forEach(({itemId:iId})=>delete nc[`${jobId}_${iId}`]);
      setJobs(updated); setChecked(nc); save(nc,updated);
    } else {
      updated=jobsRef.current.map(j=>j.id!==jobId?j:{...j,sections:j.sections.map(sec=>sec.id!==secId?sec:{...sec,items:sec.items.filter(i=>i.id!==itemId)})});
      const nc={...checkedRef.current}; delete nc[`${jobId}_${itemId}`];
      setJobs(updated); setChecked(nc); save(nc,updated);
    }
  },[jobsRef,checkedRef,setJobs,setChecked,save]);

  const applyAddItems=(jobId,items,base)=>{
    const job=base.find(j=>j.id===jobId); if(!job) return base;
    const secs=job.sections.map(s=>({...s,items:[...s.items]}));
    items.forEach(item=>{
      // Match by id first, then exact label, then fuzzy label
      const sec=secs.find(s=>s.id===item.section)
        || secs.find(s=>s.label===item.section)
        || secs.find(s=>s.label.toLowerCase().includes(item.section.toLowerCase())||item.section.toLowerCase().includes(s.label.toLowerCase().split("/")[0].trim()));
      const id=`co_${uid()}`;
      if(sec) sec.items=[...sec.items,{id,en:item.en,es:item.es,note:item.note||"",isChangeOrder:true}];
      else    secs.push({id:`sec_${uid()}`,label:item.section,color:CO_COLORS[secs.length%CO_COLORS.length],items:[{id,en:item.en,es:item.es,note:item.note||"",isChangeOrder:true}]});
    });
    return base.map(j=>j.id===jobId?{...j,sections:secs}:j);
  };
  const applyRemoveItems=(jobId,items,base)=>base.map(j=>{
    if(j.id!==jobId) return j;
    return {...j,sections:j.sections.map(sec=>({...sec,items:sec.items.filter(i=>!items.find(r=>r.itemId===i.id))}))};
  });
  const applyAddMat=(jobId,mat,base)=>{
    const nameEs=MAT_ES[mat.name.trim().toLowerCase()]||mat.name.trim();
    return base.map(j=>j.id!==jobId?j:{...j,materials:[...(j.materials||[]),{id:`mat_${uid()}`,name:mat.name.trim(),nameEs,providedBy:mat.providedBy,status:mat.status}]});
  };

  const submitCO = useCallback((jobId,coData)=>{
    const u=userRef.current; const nc=checkedRef.current; const curPending=pendingRef.current;
    const jobName=jobsRef.current.find(j=>j.id===jobId)?.name||jobId;
    const requiresApproval=!!(u&&NEEDS_CO_APPROVAL.includes(u.access));
    if (!requiresApproval) {
      let updated=jobsRef.current;
      if(coData.type==="add_items")    updated=applyAddItems(jobId,coData.items,updated);
      if(coData.type==="remove_items") updated=applyRemoveItems(jobId,coData.items,updated);
      if(coData.type==="add_mat")      updated=applyAddMat(jobId,coData.mat,updated);
      setJobs(updated); save(nc,updated);
    } else {
      const entry={id:`pco_${uid()}`,jobId,jobName,submittedBy:u.name,submittedAt:tsNow(),status:"pending",...coData};
      const updated=[...curPending,entry]; setPendingCOs(updated); savePending(updated);
    }
    return requiresApproval;
  },[userRef,checkedRef,pendingRef,jobsRef,setJobs,save,savePending]);

  const approveCO = useCallback(async id=>{
    pausePollRef.current=true;
    const entry=pendingRef.current.find(p=>p.id===id); if(!entry){ pausePollRef.current=false; return; }
    let updated=jobsRef.current;
    if(entry.type==="add_items")    updated=applyAddItems(entry.jobId,entry.items,updated);
    if(entry.type==="remove_items") updated=applyRemoveItems(entry.jobId,entry.items,updated);
    if(entry.type==="add_mat")      updated=applyAddMat(entry.jobId,entry.mat,updated);
    setJobs(updated);
    await save(checkedRef.current,updated);
    const np=pendingRef.current.filter(p=>p.id!==id);
    setPendingCOs(np);
    await savePending(np);
    pausePollRef.current=false;
  },[pendingRef,jobsRef,checkedRef,setJobs,save,savePending]);

  const rejectCO = useCallback((id,reason)=>{
    const updated=pendingRef.current.map(p=>p.id===id?{...p,status:"rejected",rejectedBy:userRef.current?.name,rejectReason:reason||""}:p);
    setPendingCOs(updated); savePending(updated);
  },[pendingRef,userRef,savePending]);

  const dismissNotification = useCallback(id=>{
    const u=userRef.current?.name;
    const updated=pendingRef.current.map(p=>p.id!==id?p:{...p,dismissedBy:[...(p.dismissedBy||[]),u]});
    setPendingCOs(updated); savePending(updated);
  },[pendingRef,userRef,savePending]);

  const inp   = css.inp;
  const solid = css.solid;
  const ghost = css.ghost;

  if (screen==="login") {
    const PinPad = ({type}) => (
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,maxWidth:240,margin:"0 auto"}}>
        {["1","2","3","4","5","6","7","8","9","","0","del"].map((k,i)=>(
          k===""?<div key={i}/>:
          <div key={i} onClick={()=>handlePin(k,type)} style={{height:58,display:"flex",alignItems:"center",justifyContent:"center",fontSize:k==="del"?18:20,fontWeight:400,border:"1px solid var(--color-border-secondary)",borderRadius:12,cursor:"pointer",background:"var(--color-background-primary)",color:"var(--color-text-primary)",userSelect:"none",fontFamily:F}}>
            {k==="del"?"⌫":k}
          </div>
        ))}
      </div>
    );
    return (
      <div style={{fontFamily:F,minHeight:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1.5rem"}}>
        <div style={{marginBottom:40,textAlign:"center"}}>
          <div style={{fontSize:36,fontWeight:700,color:"var(--color-text-primary)",letterSpacing:-1,fontFamily:F}}>Tardio</div>
          <div style={{fontSize:11,fontWeight:600,letterSpacing:0.8,textTransform:"uppercase",color:"var(--color-text-tertiary)",marginTop:4}}>Field App</div>
        </div>
        {loginType===null && (
          <div style={{width:"100%",maxWidth:300}}>
            {[{type:"employee",icon:"👷",label:"Employee Login",bg:"#DCFCE7"},{type:"management",icon:"🔑",label:"Management Login",bg:"#DBEAFE"}].map(({type,icon,label,bg})=>(
              <div key={type} onClick={()=>{setLoginType(type);setPinInput("");setPinError(false);}} style={{display:"flex",alignItems:"center",gap:16,padding:"18px 20px",marginBottom:12,border:"1px solid var(--color-border-tertiary)",borderRadius:16,cursor:"pointer",background:"var(--color-background-primary)"}}>
                <div style={{width:44,height:44,borderRadius:12,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{icon}</div>
                <div style={{fontSize:15,fontWeight:700,color:"var(--color-text-primary)"}}>{label}</div>
              </div>
            ))}
          </div>
        )}
        {(loginType==="employee"||loginType==="management") && (
          <div style={{width:"100%",maxWidth:280,textAlign:"center"}}>
            <div style={{width:52,height:52,borderRadius:14,background:loginType==="employee"?"#DCFCE7":"#DBEAFE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 14px"}}>{loginType==="employee"?"👷":"🔑"}</div>
            <div style={{fontSize:15,fontWeight:600,color:"var(--color-text-primary)",marginBottom:4}}>{loginType==="employee"?"Employee":"Management"} Access</div>
            <div style={{fontSize:12,color:"var(--color-text-tertiary)",marginBottom:24}}>Enter your PIN</div>
            <PinDots len={pinInput.length} error={pinError} color={loginType==="employee"?"#16A34A":ACCENT}/>
            <PinPad type={loginType}/>
            <div onClick={()=>{setLoginType(null);setPinInput("");setPinError(false);}} style={{marginTop:20,fontSize:13,color:"var(--color-text-tertiary)",cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round"/></svg>Back
            </div>
          </div>
        )}
      </div>
    );
  }

  if (showApprovals) return <ApprovalsScreen user={user} pendingCOs={pendingCOs} approveCO={approveCO} rejectCO={rejectCO} dismissNotification={dismissNotification} setShowApprovals={setShowApprovals} inp={inp} solid={solid} ghost={ghost}/>;
  if (editingJob)    return <EditJobForm editingJob={editingJob} setEditingJob={setEditingJob} jobsRef={jobsRef} checkedRef={checkedRef} setJobs={setJobs} save={save} user={user} inp={inp} solid={solid} ghost={ghost}/>;

  if (screen==="job"&&activeJob) {
    const job=jobs.find(j=>j.id===activeJob);
    if (!job) { setScreen("home"); return null; }
    if (showCO)    return <COScreen job={job} activeJob={activeJob} lang={lang} setLang={setLang} user={user} coTab={coTab} setCoTab={setCoTab} checkedRef={checkedRef} jobsRef={jobsRef} setJobs={setJobs} save={save} submitCO={submitCO} deleteItem={deleteItem} setShowCO={setShowCO} inp={inp} solid={solid} ghost={ghost}/>;
    if (showNotes) return <FieldNotesScreen job={job} activeJob={activeJob} user={user} jobsRef={jobsRef} checkedRef={checkedRef} setJobs={setJobs} save={save} setShowNotes={setShowNotes} can={can} inp={inp} solid={solid} ghost={ghost}/>;
    return <JobDetail job={job} checked={checked} toggle={toggle} lang={lang} setLang={setLang} user={user} can={can} jobsRef={jobsRef} checkedRef={checkedRef} pendingRef={pendingRef} setJobs={setJobs} setChecked={setChecked} save={save} setPendingCOs={setPendingCOs} savePending={savePending} setScreen={setScreen} setShowCO={setShowCO} setCoTab={setCoTab} setShowNotes={setShowNotes} pausePollRef={pausePollRef} inp={inp} solid={solid} ghost={ghost}/>;
  }

  return (
    <ErrorBoundary>
      <HomeScreen jobs={jobs} checked={checked} user={user} can={can} canApprove={canApprove} pendingCOs={pendingCOs} statusFilter={statusFilter} setStatusFilter={setStatusFilter} searchQuery={searchQuery} setSearchQuery={setSearchQuery} setActiveJob={setActiveJob} setScreen={setScreen} setEditingJob={setEditingJob} setShowApprovals={setShowApprovals} setShowAddJob={setShowAddJob} showAddJob={showAddJob} jobsRef={jobsRef} checkedRef={checkedRef} setJobs={setJobs} setChecked={setChecked} save={save} syncStatus={syncStatus} lang={lang} setLang={setLang} signOut={signOut} inp={inp} solid={solid} ghost={ghost} aiPreview={aiPreview} setAiPreview={setAiPreview} aiEditing={aiEditing} setAiEditing={setAiEditing} aiDraft={aiDraft} setAiDraft={setAiDraft} pausePollRef={pausePollRef} setShowCO={setShowCO} setCoTab={setCoTab}/>
    </ErrorBoundary>
  );
}