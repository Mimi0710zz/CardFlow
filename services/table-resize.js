const PREF_KEY="cardflow-client-table-column-widths-v2";
const MIN_WIDTH=56;

const read=()=>{try{return JSON.parse(localStorage.getItem(PREF_KEY)||"{}");}catch{return {};}};
const write=value=>{try{localStorage.setItem(PREF_KEY,JSON.stringify(value));}catch{}};

const safeKey=value=>String(value||"")
  .trim()
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g,"")
  .replace(/[^a-z0-9]+/g,"-")
  .replace(/^-+|-+$/g,"") || "column";

const tableKey=(table,index)=>{
  const view=table.closest(".view")?.id||"global";
  const identity=table.dataset.entity||table.dataset.featureTable||table.dataset.accordionEntity||table.dataset.insuranceTable!==undefined&&"insurance"||table.className||"table";
  return `${view}:${safeKey(identity)}:${index}`;
};

const columnKey=(th,index)=>`${index}:${safeKey(th.dataset.columnKey||th.textContent)}`;

function ensureColgroup(table,count){
  let group=table.querySelector(":scope > colgroup[data-resize-colgroup]");
  if(!group){
    group=document.createElement("colgroup");
    group.dataset.resizeColgroup="";
    table.insertBefore(group,table.firstChild);
  }
  while(group.children.length<count)group.append(document.createElement("col"));
  while(group.children.length>count)group.lastElementChild.remove();
  return [...group.children];
}

function setColumnWidth(table,col,width){
  const value=Math.max(MIN_WIDTH,Math.round(width));
  col.style.width=`${value}px`;
  col.style.minWidth=`${value}px`;
  return value;
}

function syncTableWidth(table,cols){
  const total=cols.reduce((sum,col)=>sum+(Number.parseFloat(col.style.width)||MIN_WIDTH),0);
  table.style.tableLayout="fixed";
  table.style.width=`${Math.ceil(total)}px`;
  table.style.minWidth=`${Math.ceil(total)}px`;
  table.style.maxWidth="none";
}

function initialWidths(table,headers){
  // Measure the currently rendered auto-layout before switching to a fixed layout.
  return headers.map(th=>Math.max(MIN_WIDTH,Math.ceil(th.getBoundingClientRect().width)));
}

export function attachResizableTables(root=document){
  if(window.matchMedia?.("(max-width:767px)").matches)return;
  const saved=read();

  root.querySelectorAll("table").forEach((table,tableIndex)=>{
    if(table.dataset.noResize!==undefined||table.closest(".matrix-stacked")||table.classList.contains("matrix-table"))return;

    const headers=[...table.querySelectorAll(":scope > thead > tr:first-child > th")];
    if(!headers.length)return;

    const key=tableKey(table,tableIndex);
    const measured=initialWidths(table,headers);
    const cols=ensureColgroup(table,headers.length);

    headers.forEach((th,index)=>{
      const stored=Number(saved[key]?.[columnKey(th,index)]);
      const width=Number.isFinite(stored)&&stored>=MIN_WIDTH?stored:measured[index];
      setColumnWidth(table,cols[index],width);
      th.style.width="";
      th.style.minWidth="";
    });
    syncTableWidth(table,cols);

    headers.forEach((th,index)=>{
      if(th.querySelector(":scope > [data-table-resize-handle]"))return;
      if(getComputedStyle(th).position==="static")th.style.position="relative";

      const handle=document.createElement("span");
      handle.className="table-resize-handle";
      handle.dataset.tableResizeHandle="";
      handle.setAttribute("role","separator");
      handle.setAttribute("aria-orientation","vertical");
      handle.setAttribute("aria-label",`Kéo để đổi độ rộng ${th.textContent.trim()}`);
      th.append(handle);

      handle.addEventListener("click",event=>{
        event.preventDefault();
        event.stopPropagation();
      });

      handle.addEventListener("pointerdown",event=>{
        if(event.button!==0)return;
        event.preventDefault();
        event.stopPropagation();

        const col=cols[index];
        const startX=event.clientX;
        const startWidth=Number.parseFloat(col.style.width)||th.getBoundingClientRect().width;
        let lastWidth=startWidth;
        document.body.classList.add("table-resizing");
        try{handle.setPointerCapture?.(event.pointerId);}catch{}

        const move=e=>{
          lastWidth=setColumnWidth(table,col,startWidth+e.clientX-startX);
          syncTableWidth(table,cols);
        };
        const end=e=>{
          document.body.classList.remove("table-resizing");
          try{if(handle.hasPointerCapture?.(event.pointerId))handle.releasePointerCapture(event.pointerId);}catch{}
          saved[key]||=(saved[key]={});
          saved[key][columnKey(th,index)]=Math.round(lastWidth);
          write(saved);
          window.removeEventListener("pointermove",move);
          window.removeEventListener("pointerup",end);
          window.removeEventListener("pointercancel",end);
          e?.preventDefault?.();
        };

        window.addEventListener("pointermove",move,{passive:false});
        window.addEventListener("pointerup",end,{once:true});
        window.addEventListener("pointercancel",end,{once:true});
      });
    });
  });
}
