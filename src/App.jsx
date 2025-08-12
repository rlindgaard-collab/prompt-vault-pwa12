
import { useEffect, useMemo, useState } from "react";
import { Clipboard, RefreshCcw, ExternalLink, Search } from "lucide-react";

const DEFAULT_LINK = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRTD5myRZpckG-JW5TmkGgvAoyH38rEWIi-g0ha7iQfyDHUDxBAdVp3N9_YUAeKLFE7ErQNuHnopAi0/pub?output=csv";

export default function App(){
  const [sheetLink, setSheetLink] = useState(() => localStorage.getItem("pv43_sheet") || DEFAULT_LINK);
  const [tabs, setTabs] = useState([]); // [{gid,name,csvUrl}]
  const [activeGid, setActiveGid] = useState(() => localStorage.getItem("pv43_gid") || "");
  const [rows, setRows] = useState([]); // raw CSV rows
  const [category, setCategory] = useState(() => localStorage.getItem("pv43_cat") || "");
  const [q, setQ] = useState("");

  const activeTab = useMemo(()=>tabs.find(t=>String(t.gid)===String(activeGid)), [tabs, activeGid]);

  useEffect(()=>localStorage.setItem("pv43_sheet", sheetLink),[sheetLink]);
  useEffect(()=>localStorage.setItem("pv43_gid", String(activeGid||"")),[activeGid]);
  useEffect(()=>localStorage.setItem("pv43_cat", category),[category]);

  async function loadTabs(){
    const htmlUrl = toPubHtml(sheetLink);
    try{
      const res = await fetch(htmlUrl, { cache:"no-store" });
      const html = await res.text();
      const found = extractTabs(html, sheetLink);
      if(found.length===0) throw new Error("Ingen faner fundet");
      setTabs(found);
      setActiveGid(found[0].gid);
      setCategory("");
      setRows([]);
    }catch(e){
      console.error(e);
      alert("Kunne ikke hente faner. Brug 'Publish to the web' linket (CSV).");
    }
  }

  async function loadRowsForActive(){
    const tab = tabs.find(t => String(t.gid)===String(activeGid));
    if(!tab) return;
    try{
      const res = await fetch(tab.csvUrl, { cache:"no-store" });
      const text = await res.text();
      const parsed = parseCSV(text).rows;
      const start = findDataStart(parsed);
      setRows(parsed.slice(start));
      setCategory("");
      setQ("");
    }catch(e){
      console.error(e);
      alert("Kunne ikke hente CSV for fanen.");
    }
  }

  useEffect(()=>{ if(activeGid) loadRowsForActive(); /* eslint-disable-next-line */ }, [activeGid]);

  const categories = useMemo(()=>{
    const s = new Set();
    for(const r of rows){ const a=(r[0]||"").trim(); if(a) s.add(a); }
    return Array.from(s);
  },[rows]);

  const visiblePrompts = useMemo(()=>{
    const list = [];
    for(const r of rows){
      const a=(r[0]||"").trim();
      const b=(r[1]||"").toString();
      if(category && a!==category) continue;
      if(q && !b.toLowerCase().includes(q.toLowerCase())) continue;
      if(b.trim()) list.push(b);
    }
    return list;
  },[rows, category, q]);

  function copy(txt){ navigator.clipboard?.writeText(txt).catch(()=>{}); }
  function openChatGPT(){ window.open("https://chat.openai.com/", "_blank"); }

  return (
    <div className="max-w-3xl mx-auto p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Prompt Vault v4.3</h1>
        <button onClick={openChatGPT} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 text-white">
          <ExternalLink className="w-4 h-4" /> Åbn ChatGPT
        </button>
      </header>

      <section className="bg-slate-50 border border-slate-200 rounded-2xl p-3 mb-3">
        <p className="text-sm text-slate-600 mb-2">Indsæt dit Google Sheets <em>Publish to the web</em>-link (CSV).</p>
        <div className="flex gap-2">
          <input value={sheetLink} onChange={e=>setSheetLink(e.target.value)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2" placeholder="https://docs.google.com/.../pub?output=csv" />
          <button onClick={loadTabs} className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100">
            <RefreshCcw className="w-4 h-4" /> Hent faner
          </button>
        </div>
      </section>

      {tabs.length>0 && (
        <div className="flex gap-2 flex-wrap mb-3">
          {tabs.map(t => (
            <button key={t.gid} onClick={()=>setActiveGid(t.gid)} className={"px-3 py-1.5 rounded-full border " + (String(activeGid)===String(t.gid) ? "bg-slate-900 text-white border-slate-900" : "bg-white border-slate-300")}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      {tabs.length>0 && (
        <div className="flex gap-2 items-center mb-4">
          <select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2 bg-white min-w-[220px]">
            <option value="">Alle kategorier</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Søg i prompts…" className="w-full pl-9 rounded-xl border border-slate-300 px-3 py-2" />
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {visiblePrompts.map((p, idx) => (
          <li key={idx} className="bg-white border border-slate-200 rounded-2xl p-3">
            <pre className="whitespace-pre-wrap text-[15px] leading-relaxed">{p}</pre>
            <div className="mt-2">
              <button onClick={()=>copy(p)} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-300">
                <Clipboard className="w-4 h-4" /> Kopiér
              </button>
            </div>
          </li>
        ))}
        {tabs.length>0 && visiblePrompts.length===0 && <li className="text-slate-500">Ingen prompts matcher.</li>}
      </ul>
    </div>
  );
}

// -------- Helpers --------
function toPubHtml(csvUrl){
  return csvUrl.replace(/\/pub\?[^#]+$/, "/pubhtml");
}
function toCsv(baseCsv, gid){
  let url = baseCsv.replace(/(&gid=\d+)/, "");
  if(!/output=csv/.test(url)){ url += (url.includes("?") ? "&" : "?") + "output=csv"; }
  return url + "&gid=" + gid;
}
function extractTabs(html, baseCsv){
  const out = []; const seen = new Set();
  const patterns = [
    /data-gid="(\d+)".*?<span[^>]*class="sheet-button-name"[^>]*>([^<]+)/g,
    /data-gid="(\d+)".*?class="docs-sheet-tab-name"[^>]*>([^<]+)/g,
    /aria-controls="sheet-tab-(\d+)".*?aria-label="([^"]+)"/g
  ];
  for(const re of patterns){
    let m; let any=false;
    while((m = re.exec(html))!==null){
      const gid=m[1], name=m[2].trim();
      if(seen.has(gid)) continue; seen.add(gid);
      out.push({ gid, name, csvUrl: toCsv(baseCsv, gid) });
      any=true;
    }
    if(any) break;
  }
  if(out.length===0){ out.push({ gid:"0", name:"Fane 1", csvUrl: baseCsv }); }
  return out;
}

// Robust CSV parser
function parseCSV(text){
  const rows=[]; let i=0, field="", row=[], inQuotes=false;
  const pushField=()=>{ row.push(field); field=""; };
  const pushRow=()=>{ rows.push(row); row=[]; };
  while(i<text.length){
    const ch=text[i];
    if(inQuotes){
      if(ch=='"'){ if(text[i+1]=='"'){ field+='"'; i++; } else { inQuotes=false; } }
      else { field+=ch; }
    } else {
      if(ch=='"') inQuotes=true;
      else if(ch===",") pushField();
      else if(ch=="\n"){ pushField(); pushRow(); }
      else if(ch=="\r"){}
      else field+=ch;
    }
    i++;
  }
  if(field.length || row.length){ pushField(); pushRow(); }
  return { rows };
}
// Skip banners/headers to find first real data row (A/B expected)
function findDataStart(rows){
  for(let r=0; r<Math.min(40, rows.length); r++){
    const a=(rows[r][0]||"").trim().toLowerCase();
    const b=(rows[r][1]||"").trim().toLowerCase();
    const nonEmpty=[rows[r][0],rows[r][1]].filter(x=>(x||"").trim()!=="").length;
    const looksHeader=["kategori","category","type","label","navn","title","overskrift"].includes(a)||["prompt","tekst","text"].includes(b);
    if(nonEmpty>=1){
      if(looksHeader) return r+1;
      const nb1=(rows[r+1]||[])[1]||""; const nb2=(rows[r+2]||[])[1]||"";
      if((rows[r][1]||"").toString().trim()||nb1.toString().trim()||nb2.toString().trim()) return r;
    }
  }
  return 0;
}
