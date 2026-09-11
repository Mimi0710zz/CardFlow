const PREF_KEY="cardflow-client-table-column-widths-v3-autofit";
const MIN_WIDTH=56;
const MAX_AUTO_WIDTH=520;
const WRAP_AUTO_WIDTH=340;
const NOTE_AUTO_WIDTH=260;

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
  table.classList.add("independent-resize-table");
}

function buildLogicalColumns(table,count){
  const columns=Array.from({length:count},()=>[]);
  const occupied=[];
  const rows=[...table.rows];

  rows.forEach((row,rowIndex)=>{
    occupied[rowIndex]||=[];
    let logicalIndex=0;

    [...row.cells].filter(cell=>!cell.classList.contains("accordion-toggle-cell")).forEach(cell=>{
      while(occupied[rowIndex][logicalIndex])logicalIndex+=1;

      const colSpan=Math.max(1,Number(cell.colSpan)||1);
      const rowSpan=Math.max(1,Number(cell.rowSpan)||1);

      if(colSpan===1 && logicalIndex<count)columns[logicalIndex].push(cell);

      for(let r=rowIndex;r<rowIndex+rowSpan;r+=1){
        occupied[r]||=[];
        for(let c=logicalIndex;c<logicalIndex+colSpan;c+=1)occupied[r][c]=true;
      }
      logicalIndex+=colSpan;
    });
  });

  return columns;
}

export function syncStickyColumns(table,targetHeaders){
  if(!table)return;
  const headers=[...table.querySelectorAll(":scope > thead > tr:first-child > th")];
  const targetIndex=headers.findIndex(th=>targetHeaders.includes(th.textContent.trim()));
  table.querySelectorAll(".sticky-table-column").forEach(cell=>{
    cell.classList.remove("sticky-table-column");
    cell.style.removeProperty("--sticky-column-left");
  });
  if(targetIndex<0||window.matchMedia?.("(max-width:767px)").matches)return;
  const cols=[...table.querySelectorAll(":scope > colgroup[data-resize-colgroup] > col")];
  const logicalColumns=buildLogicalColumns(table,headers.length);
  let left=0;
  for(let index=0;index<=targetIndex;index+=1){
    logicalColumns[index].forEach(cell=>{
      cell.classList.add("sticky-table-column");
      cell.style.setProperty("--sticky-column-left",`${Math.round(left)}px`);
    });
    left+=Number.parseFloat(cols[index]?.style.width)||headers[index].getBoundingClientRect().width;
  }
}

function cellAutoCap(cell){
  if(cell.classList.contains("note-cell"))return NOTE_AUTO_WIDTH;
  if(cell.classList.contains("wrap-cell"))return WRAP_AUTO_WIDTH;
  if(cell.querySelector?.(".insurance-url"))return MAX_AUTO_WIDTH;
  return MAX_AUTO_WIDTH;
}

function measureCellIntrinsic(cell){
  const clone=cell.cloneNode(true);
  clone.querySelectorAll?.("[data-table-resize-handle]").forEach(node=>node.remove());

  // Widths from a previous render must not influence the intrinsic measurement.
  clone.removeAttribute?.("width");
  clone.style.width="auto";
  clone.style.minWidth="0";
  clone.style.maxWidth="none";
  clone.style.position="static";
  clone.style.left="auto";
  clone.style.right="auto";
  clone.style.whiteSpace="nowrap";
  clone.style.overflow="visible";
  clone.style.textOverflow="clip";

  const measurer=document.createElement("table");
  measurer.className=tableMeasurementClass(cell.closest("table"));
  measurer.style.position="fixed";
  measurer.style.left="-100000px";
  measurer.style.top="0";
  measurer.style.visibility="hidden";
  measurer.style.pointerEvents="none";
  measurer.style.width="max-content";
  measurer.style.minWidth="0";
  measurer.style.maxWidth="none";
  measurer.style.tableLayout="auto";
  measurer.style.borderCollapse="collapse";

  const tbody=document.createElement("tbody");
  const tr=document.createElement("tr");
  tr.append(clone);
  tbody.append(tr);
  measurer.append(tbody);
  document.body.append(measurer);

  const width=Math.ceil(clone.getBoundingClientRect().width)+2;
  measurer.remove();
  return Math.max(MIN_WIDTH,Math.min(cellAutoCap(cell),width));
}

function tableMeasurementClass(table){
  if(!table)return "";
  return [...table.classList]
    .filter(name=>name!=="independent-resize-table")
    .join(" ");
}

function initialWidths(table,headers){
  const columns=buildLogicalColumns(table,headers.length);
  return headers.map((header,index)=>{
    const cells=columns[index]?.length?columns[index]:[header];
    let width=MIN_WIDTH;
    cells.forEach(cell=>{width=Math.max(width,measureCellIntrinsic(cell));});
    // Ensure the header itself is always part of the calculation.
    width=Math.max(width,measureCellIntrinsic(header));
    return width;
  });
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
          if(table.dataset.stickyThrough)syncStickyColumns(table,table.dataset.stickyThrough.split("|"));
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
    if(table.dataset.stickyThrough)syncStickyColumns(table,table.dataset.stickyThrough.split("|"));
  });
}
