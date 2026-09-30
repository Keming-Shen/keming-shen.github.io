/* Linked views over an exact, deliberately small Transformer. No model/network downloads. */
(() => {
  'use strict';
  if (window.initAttentionLab) { window.initAttentionLab(); return; }
  const SCENES = {
    geometry: { name: 'Q · K', title: '向量与点积', sub: '', hint: '拖动 Q · 点击 K · 方向键微调', formula: 'q · k = ‖q‖ ‖k‖ cos θ' },
    weights: { name: 'Softmax', title: '注意力矩阵', sub: '', hint: '点击矩阵选择 Q / K · 行归一化', formula: 'A = softmax(QKᵀ / √2 / T)' },
    values: { name: 'Σ aV', title: 'Value 加权求和', sub: '', hint: '拖动 V · 虚线轮廓为凸包', formula: 'oᵢ = Σⱼ aᵢⱼ vⱼ' },
    heads: { name: 'Multi-head', title: '多头注意力', sub: '', hint: '点击 Head 切换 · 两个头独立计算', formula: 'MHA = Concat(o¹, o²) Wᴼ' },
    position: { name: 'Position', title: '位置编码', sub: '', hint: '虚线：原向量 · 实线：编码后向量', formula: '(Rᵢq) · (Rⱼk) = qᵀRⱼ₋ᵢk' },
    block: { name: 'Block', title: 'Transformer Block', sub: '', hint: '每行 4 个特征 · 所有特征棒共用尺度', formula: 'Z = LN(X + MHA(X))\nY = LN(Z + FFN(Z))' }
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const fmt = (x, digits = 2) => Number.isFinite(x) ? (Math.abs(x) < 0.00001 ? 0 : x).toFixed(digits) : '−∞';
  const vec = v => '[' + v.map(x => fmt(x)).join(', ') + ']';
  const length = v => Math.hypot(...v);
  const arrowIcon = '↗';

  function mount(root) {
    const C = window.AttentionLabCore;
    if (!C || root.dataset.attentionReady) return;
    root.dataset.attentionReady = 'true';
    let state = C.createState(), scene = 'geometry', result, drag = null, plot = null, frame = 0, playing = false, lastTick = 0;
    let expandedFrom = null, matrixMode = 'weights', showSum = false;
    root.dataset.labTheme = 'dark';
    const order = Object.keys(SCENES);
    root.innerHTML = `
      <div class="al-top"><div class="al-name">Transformer <span>可视化</span></div>
        <div class="al-toolbar"><button class="al-btn" data-action="reset" type="button">重置</button><button class="al-btn" data-action="theme" type="button" aria-label="切换可视化深浅主题">浅色</button><button class="al-btn" data-action="expand" type="button" aria-expanded="false">展开 ${arrowIcon}</button></div></div>
      <div class="al-tabs" role="tablist" aria-label="六个计算视角">${order.map((id,i) => `<button class="al-tab" role="tab" id="al-tab-${id}" aria-controls="al-panel" aria-selected="${i === 0}" tabindex="${i === 0 ? '0' : '-1'}" data-scene="${id}"><span>0${i+1}</span>${SCENES[id].name}</button>`).join('')}</div>
      <div class="al-inputs"><label class="al-input-label" for="al-preset">输入</label><select id="al-preset" aria-label="选择示例输入">${C.PRESETS.map((p,i) => i===C.ARTICLE_PRESET_INDEX?'':`<option value="${i}">示例 ${i+1}</option>`).join('')}</select><div class="al-tokens" aria-label="选择 Query token"></div></div>
      <div class="al-config"><div class="al-segment" aria-label="注意力头"><button data-head="0" type="button" aria-pressed="true">Head 1</button><button data-head="1" type="button" aria-pressed="false">Head 2</button></div><label for="al-temperature">温度 <span class="al-mono">T</span><input id="al-temperature" type="range" min="0.15" max="3" step="0.05" value="1"><output id="al-temperature-value" class="al-mono">1.00</output></label><label><input id="al-causal" type="checkbox">因果遮罩</label><label><input id="al-scale" type="checkbox" checked>√dₖ 缩放</label></div>
      <div class="al-workspace" id="al-panel" role="tabpanel" aria-labelledby="al-tab-geometry"><section class="al-stage"><div class="al-stage-heading"><h3 class="al-scene-title"></h3><p class="al-scene-sub"></p></div><div class="al-canvas"></div><div class="al-mobile-keys" aria-label="选择比较的 Key 或 Value"></div><div class="al-stage-bottom"><div class="al-legend"></div><div class="al-local-controls"></div></div><p class="al-hint"></p></section><aside class="al-inspector" aria-label="数值检查器"></aside></div>
      <div class="al-summary" aria-live="polite" aria-atomic="true"></div>
      <div class="al-footer"><details class="al-data"><summary>中间张量 <span class="al-mono">X · Q · K · V · A · O</span></summary><div class="al-data-grid"></div></details>
      <details class="al-model"><summary>模型设置</summary><p>d_model = 4；2 个头；dₖ = dᵥ = 2；Post-LN；无 dropout。参数手工设定、未经训练。图中为实际二维计算坐标。拖动操作修改中间向量，T 调节注意力分数。</p></details>
      <div class="al-foot"><button type="button" class="al-btn" data-action="next">下一模块 →</button></div></div>`;
    const $ = s => root.querySelector(s);
    const $$ = s => Array.from(root.querySelectorAll(s));
    const canvas = $('.al-canvas');
    const tag = (label, value) => `<div class="al-measure"><span>${label}</span><strong>${value}</strong></div>`;
    const vectorCells = v => `<div class="al-vector">${v.map((a,i) => `<span title="特征 ${i+1}">${fmt(a)}</span>`).join('')}</div>`;
    const activeHead = () => result.heads[state.head];
    const overrideId = i => `${state.head}:${i}`;
    function setOverride(role, index, value) { state.overrides[role][overrideId(index)] = value.map(v => clamp(v, -8, 8)); }
    function bars(weights, options = {}) {
      return `<div class="al-bars">${weights.map((w,j) => `<div class="al-bar-row ${j === state.key ? 'is-selected' : ''} ${state.causal && j > state.query ? 'is-masked' : ''}"><button type="button" data-key="${j}" title="检查 ${esc(result.tokens[j])}">${esc(result.tokens[j])}</button><div class="al-bar-track"><div class="al-bar-fill" style="width:${w*100}%;${options.value ? 'background:var(--al-v)' : ''}"></div></div><span class="al-mono">${fmt(w*100,1)}%</span></div>`).join('')}</div>`;
    }
    function coordinateInputs(role, token) {
      const value = activeHead()[role][token];
      return `<div class="al-coordinate">${value.map((v,i) => `<label>${role.toUpperCase()}${i+1}<input type="number" step="0.1" min="-8" max="8" value="${fmt(v,3)}" data-coordinate="${i}" data-role="${role}" data-index="${token}" aria-label="${role.toUpperCase()} 第 ${i+1} 维"></label>`).join('')}</div>`;
    }
    function createPlot(points, force) {
      const max = Math.max(1.5, ...points.flat().map(Math.abs));
      const extent = force || (drag ? drag.extent : Math.ceil((max + .35)*2)/2);
      const ox = 292, oy = 191, unit = 150 / extent;
      return { extent, x:x=>ox+x*unit, y:y=>oy-y*unit, from:(x,y)=>[(x-ox)/unit,(oy-y)/unit], ox,oy,unit };
    }
    function axes(p, space) {
      let s = '';
      const step = p.extent > 5 ? 2 : 1;
      for (let v = Math.ceil(-p.extent / step) * step; v <= p.extent; v += step) {
        s += `<path class="${v === 0 ? 'al-axis-zero' : 'al-axis'}" d="M${p.x(v)} 35 V347 M55 ${p.y(v)} H533"/>`;
        if (v !== 0) s += `<text x="${p.x(v)}" y="${p.oy+17}" text-anchor="middle" style="font-size:9px">${v}</text><text x="${p.ox-9}" y="${p.y(v)+3}" text-anchor="end" style="font-size:9px">${v}</text>`;
      }
      s += `<text x="542" y="${p.oy-10}" text-anchor="end">${space}₁</text><text x="${p.ox+10}" y="29">${space}₂</text><text x="${p.ox-12}" y="${p.oy+16}" style="font-size:10px">0</text>`;
      return s;
    }
    function arrow(p, v, color, extra = '', from = [0,0]) {
      const a = [p.x(from[0]),p.y(from[1])], b = [p.x(v[0]),p.y(v[1])];
      const ang = Math.atan2(b[1]-a[1],b[0]-a[0]), n=8;
      return `<path d="M${a} L${b}" fill="none" stroke="var(--al-${color})" stroke-width="1.8" ${extra}/><path d="M${b[0]-n*Math.cos(ang-.42)},${b[1]-n*Math.sin(ang-.42)} L${b} L${b[0]-n*Math.cos(ang+.42)},${b[1]-n*Math.sin(ang+.42)} Z" fill="var(--al-${color})" ${extra}/>`;
    }
    function svgStart(label) { return `<svg viewBox="0 0 600 390" role="group" aria-label="${esc(label)}"><title>${esc(label)}</title>`; }
    function labelLayout(p, points, q) {
      // Keep labels legible without moving the data points themselves.
      const boxes = q ? [{x:p.x(q[0])+12,y:p.y(q[1])-30,w:95,h:19}] : [];
      return points.map((v,j)=>{
        const x=p.x(v[0]),y=p.y(v[1]),w=82,h=17;
        const candidates=[[13,-18],[13,24],[-94,-14],[-94,25],[18,-42],[-90,46],[30,10],[-118,0],[18,62],[-80,-60]];
        const scored=candidates.map(([dx,dy])=>{
          const box={x:clamp(x+dx,56,514-w),y:clamp(y+dy,45,340),w,h};
          let cost=Math.abs(dx)*.02+Math.abs(dy)*.025;
          for(const b of boxes)if(box.x<b.x+b.w+5&&box.x+w+5>b.x&&box.y<b.y+b.h+5&&box.y+h+5>b.y)cost+=100;
          for(const a of points)if(p.x(a[0])>box.x-6&&p.x(a[0])<box.x+w+6&&p.y(a[1])>box.y-6&&p.y(a[1])<box.y+h+6)cost+=15;
          return {box,cost};
        }).sort((a,b)=>a.cost-b.cost);
        boxes.push(scored[0].box);return scored[0].box;
      });
    }
    function geometrySvg(isPosition = false) {
      const h = activeHead(), q = h.q[state.query], k = h.k[state.key];
      let base;
      if (isPosition) base = C.compute({...state,position:'none',overrides:{q:{},k:{},v:{}}}).heads[state.head];
      plot = createPlot([q,...h.k,...(base ? [base.q[state.query],base.k[state.key]] : [])]);
      const p = plot, qLen = length(q), kLen = length(k), cosine = qLen*kLen ? C.dot(q,k)/(qLen*kLen) : 0;
      let s=svgStart(isPosition ? '位置编码前后的 Query 与 Key 向量' : '可拖动 Query 与六个 Key 的二维几何图')+axes(p,'Q/K');
      if (base) { s+=arrow(p,base.q[state.query],'q','stroke-dasharray="4 5" opacity=".35"')+arrow(p,base.k[state.key],'k','stroke-dasharray="4 5" opacity=".35"'); }
      if (kLen > .01) {
        const projection = k.map(x => C.dot(q,k)*x/(kLen*kLen));
        s+=`<path d="M${p.ox} ${p.oy} L${p.x(projection[0])} ${p.y(projection[1])}" stroke="var(--al-q)" stroke-width="5" opacity=".18"/><path d="M${p.x(q[0])},${p.y(q[1])} L${p.x(projection[0])},${p.y(projection[1])}" stroke="var(--al-q)" stroke-dasharray="3 5" opacity=".5" fill="none"/><circle cx="${p.x(projection[0])}" cy="${p.y(projection[1])}" r="3" fill="var(--al-q)" opacity=".8"/>`;
        if(qLen > .01) {
          const a=Math.atan2(k[1],k[0]),delta=Math.atan2(Math.sin(Math.atan2(q[1],q[0])-a),Math.cos(Math.atan2(q[1],q[0])-a)),r=31;
          const x1=p.ox+r*Math.cos(a),y1=p.oy-r*Math.sin(a),x2=p.ox+r*Math.cos(a+delta),y2=p.oy-r*Math.sin(a+delta);
          s+=`<path d="M${p.ox} ${p.oy} L${x1} ${y1} A${r} ${r} 0 0 ${delta>0?0:1} ${x2} ${y2} Z" fill="var(--al-q)" opacity=".07"/><path d="M${x1} ${y1} A${r} ${r} 0 0 ${delta>0?0:1} ${x2} ${y2}" fill="none" stroke="var(--al-q)" stroke-width="1" opacity=".8"/>`;
        }
      }
      const labels=labelLayout(p,h.k,q);
      h.k.forEach((v,j) => {
        const selected = state.key===j, disabled=state.causal&&j>state.query;
        s += `<g data-key="${j}" role="button" tabindex="0" aria-label="检查 Key ${esc(result.tokens[j])}" opacity="${disabled?.2:1}"><title>K${j+1} · ${esc(result.tokens[j])} ${vec(v)} · a = ${fmt(h.weights[state.query][j],3)}</title>`;
        s += arrow(p,v,'k',`opacity="${selected?'1':'.42'}"`);
        const label=labels[j];
        s += `<circle cx="${p.x(v[0])}" cy="${p.y(v[1])}" r="${selected?5:3}" fill="var(--al-k)"/><circle cx="${p.x(v[0])}" cy="${p.y(v[1])}" r="14" fill="transparent"/><path d="M${p.x(v[0])} ${p.y(v[1])} L${label.x+(label.x<p.x(v[0])?60:0)} ${label.y+5}" stroke="var(--al-k)" opacity=".18"/><text class="al-plot-label ${selected?'is-selected':''}" x="${label.x}" y="${label.y+11}" style="fill:var(--al-k);opacity:${selected?1:.65};font-size:11px;paint-order:stroke;stroke:var(--al-bg);stroke-width:4px;stroke-linejoin:round">${esc(result.tokens[j])} · k${j+1}</text></g>`;
      });
      s+=arrow(p,q,'q');
      s+=`<g ${isPosition?'':`data-drag="q" data-index="${state.query}" role="button" tabindex="0" aria-label="拖动 Query ${esc(result.tokens[state.query])}，方向键调整"`}><circle cx="${p.x(q[0])}" cy="${p.y(q[1])}" r="16" fill="var(--al-q)" opacity=".055"/><circle cx="${p.x(q[0])}" cy="${p.y(q[1])}" r="10" fill="none" stroke="var(--al-q)" stroke-opacity=".45"/><circle cx="${p.x(q[0])}" cy="${p.y(q[1])}" r="4" fill="var(--al-q)"/><text x="${p.x(q[0])+14}" y="${p.y(q[1])-17}" style="fill:var(--al-q);font-weight:500">q · ${esc(result.tokens[state.query])}</text></g>`;
      s+=`<text x="56" y="20" style="fill:var(--al-ink);font-size:11px">q · k${state.key+1} = ${fmt(C.dot(q,k),3)}</text><text x="532" y="20" text-anchor="end" style="font-size:10px">${qLen*kLen?`夹角 ${fmt(Math.acos(clamp(cosine,-1,1))*180/Math.PI,1)}°`:'零向量：夹角未定义'}</text></svg>`;
      return s;
    }
    function heatmapSvg() {
      plot = null;
      const h = activeHead(), cell=43,x0=157,y0=47, scores=matrixMode==='scores';
      const intensity=Math.max(1,...h.scores.flat().map(Math.abs));
      let s=svgStart('六乘六注意力矩阵，行是 Query，列是 Key');
      s+=`<text x="${x0+129}" y="11" text-anchor="middle" style="fill:var(--al-k);font-size:12px">Kᵀ</text><text x="57" y="180" style="fill:var(--al-q);font-size:18px">Q</text>`;
      result.tokens.forEach((t,j) => {s+=`<text x="${x0+j*cell+cell/2}" y="35" text-anchor="middle" style="fill:${j===state.key?'var(--al-k)':'var(--al-muted)'};font-size:11px">${esc(t)}</text><text x="143" y="${y0+j*cell+cell/2+4}" text-anchor="end" style="fill:${j===state.query?'var(--al-q)':'var(--al-muted)'};font-size:11px">${esc(t)}</text>`;});
      h.weights.forEach((row,i)=>row.forEach((w,j)=>{
        const x=x0+j*cell,y=y0+i*cell,masked=state.causal&&j>i;
        const value=scores?h.scores[i][j]:w,color=scores&&value<0?'v':'k',hidden=masked&&!scores;
        s+=`<g data-cell="${i},${j}" tabindex="0" role="button" aria-label="Query ${esc(result.tokens[i])}，Key ${esc(result.tokens[j])}，${scores?'点积 '+fmt(value,2):masked?'被遮罩':fmt(w*100,2)+'%'}"><rect x="${x}" y="${y}" width="${cell}" height="${cell}" fill="var(--al-${color})" fill-opacity="${hidden?0:scores?.04+.15*Math.abs(value)/intensity:.03+.6*w}" stroke="var(--al-line)" stroke-width=".6"/>${hidden?`<text x="${x+cell/2}" y="${y+cell/2+4}" text-anchor="middle" style="font-size:12px;opacity:.4">—</text>`:`<text x="${x+cell/2}" y="${y+cell/2+4}" text-anchor="middle" style="font:11px Consolas,monospace;fill:var(--al-${scores?color:'ink'})">${scores&&value>0?'+':''}${fmt(value,2)}</text>`}</g>`;
      }));
      s+=`<rect x="${x0}" y="${y0+state.query*cell}" width="${cell*6}" height="${cell}" stroke="var(--al-q)" stroke-width="1.3" fill="none" pointer-events="none"/><rect x="${x0+state.key*cell+2}" y="${y0+state.query*cell+2}" width="${cell-4}" height="${cell-4}" stroke="var(--al-ink)" stroke-opacity=".65" fill="none" pointer-events="none"/><path d="M286 313 V329" stroke="var(--al-muted)" stroke-width="1"/><text x="445" y="180" style="font-size:11px">${scores?'QKᵀ':'softmax'}</text>`;
      let offset=0;
      h.weights[state.query].forEach((w,j)=>{const width=w*cell*6,x=x0+offset;offset+=width;if(w===0)return;s+=`<g data-cell="${state.query},${j}" role="button" tabindex="0" aria-label="${esc(result.tokens[j])} ${fmt(w*100,1)}%"><rect x="${x}" y="338" width="${width}" height="12" fill="var(--al-k)" fill-opacity="${.22+j*.12}" stroke="var(--al-bg)" stroke-width="1"/>${width>28?`<text x="${x+width/2}" y="367" text-anchor="middle" style="font-size:10px">${esc(result.tokens[j])}</text>`:''}<title>${esc(result.tokens[j])} · ${fmt(w*100,1)}%</title></g>`;});
      s+=`<text x="143" y="348" text-anchor="end" style="fill:var(--al-q);font-size:11px">a${state.query+1}</text><text x="431" y="348" style="font-size:11px">Σ a = 1</text></svg>`;
      return s;
    }
    function convexHull(points) {
      const a=points.map(p=>p.slice()).sort((p,q)=>p[0]-q[0]||p[1]-q[1]);
      const cross=(o,p,q)=>(p[0]-o[0])*(q[1]-o[1])-(p[1]-o[1])*(q[0]-o[0]);
      const lower=[],upper=[]; for(const p of a){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);} for(const p of a.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);} return lower.slice(0,-1).concat(upper.slice(0,-1));
    }
    function valueSvg() {
      const h=activeHead(),weights=h.weights[state.query],out=h.out[state.query];
      plot=createPlot([...h.v,out]); const p=plot;
      let s=svgStart('Value 加权重心，可拖动 Value，十字标记输出')+axes(p,'V');
      const hull=convexHull(h.v.filter((v,j)=>!state.causal||j<=state.query));
      if(hull.length>2)s+=`<polygon points="${hull.map(v=>`${p.x(v[0])},${p.y(v[1])}`).join(' ')}" fill="var(--al-v)" fill-opacity=".035" stroke="var(--al-v)" stroke-opacity=".3" stroke-dasharray="3 4"/>`;
      if(hull.length===2)s+=`<path d="M${p.x(hull[0][0])} ${p.y(hull[0][1])} L${p.x(hull[1][0])} ${p.y(hull[1][1])}" stroke="var(--al-v)" stroke-width="5" opacity=".15"/>`;
      const labels=labelLayout(p,h.v,out);
      h.v.forEach((v,j)=>{
        const x=p.x(v[0]),y=p.y(v[1]),w=weights[j],r=6+w*17;
        s+=`<path d="M${x},${y} L${p.x(out[0])},${p.y(out[1])}" stroke="var(--al-v)" stroke-width="${.5+w*5}" opacity="${.08+w*.45}"/><g data-drag="v" data-index="${j}" tabindex="0" role="button" aria-label="拖动 Value ${esc(result.tokens[j])}，权重 ${fmt(w*100,1)}%，方向键调整" opacity="${w===0?.35:1}"><circle cx="${x}" cy="${y}" r="${r+5}" fill="var(--al-v)" opacity=".12"/><circle cx="${x}" cy="${y}" r="${r}" fill="var(--al-v)" opacity=".8" stroke="${j===state.key?'var(--al-ink)':'var(--al-panel)'}" stroke-width="${j===state.key?2:1}"/><text class="al-plot-label ${j===state.key?'is-selected':''}" x="${labels[j].x}" y="${labels[j].y+11}" style="fill:var(--al-v);font-size:11px;paint-order:stroke;stroke:var(--al-bg);stroke-width:4px;stroke-linejoin:round">${esc(result.tokens[j])} ${fmt(w*100,1)}%</text></g>`;
      });
      if(showSum) {
        let sum=[0,0];
        h.v.forEach((v,j)=>{
          const next=sum.map((a,d)=>a+weights[j]*v[d]);
          if(weights[j]>.00001){
            s+=arrow(p,next,j===state.key?'q':'v',`opacity="${j===state.key?1:.6}"`,sum);
            s+=`<circle cx="${p.x(sum[0])}" cy="${p.y(sum[1])}" r="2" fill="var(--al-ink)"/>`;
            if(j===state.key)s+=`<text x="${p.x((sum[0]+next[0])/2)+7}" y="${p.y((sum[1]+next[1])/2)-10}" style="fill:var(--al-q);font-size:11px;paint-order:stroke;stroke:var(--al-bg);stroke-width:3px">a${j+1}v${j+1}</text>`;
          }
          sum=next;
        });
      }
      s+=`<circle cx="${p.x(out[0])}" cy="${p.y(out[1])}" r="10" fill="var(--al-panel)"/><path d="M${p.x(out[0])-9} ${p.y(out[1])} h18 M${p.x(out[0])} ${p.y(out[1])-9} v18" stroke="var(--al-q)" stroke-width="3"/><text x="${p.x(out[0])+13}" y="${p.y(out[1])+5}" style="fill:var(--al-q);font-weight:650">o = Σ av</text></svg>`;
      return s;
    }
    function headsView() {
      plot = null;
      const outputs = result.heads.map(h => h.out[state.query]);
      const extent = Math.max(.25, ...outputs.flat().map(Math.abs));
      const unit = 49 / extent;
      const cellX = [180, 240, 300, 360];
      const colors = ['k', 'k', 'v', 'v'];
      const down = (x, y1, y2, color = 'muted') => `<path d="M${x} ${y1} V${y2} m-4 -6 l4 6 l4 -6" fill="none" stroke="var(--al-${color})" stroke-width="1.4"/>`;
      const cells = (values, y, isOutput) => values.map((v, d) => {
        const color = isOutput ? 'q' : colors[d];
        return `<g><rect x="${cellX[d]}" y="${y}" width="55" height="34" rx="3" fill="var(--al-${color})" fill-opacity=".08" stroke="var(--al-${color})" stroke-opacity=".5"/><text x="${cellX[d] + 27.5}" y="${y + 22}" text-anchor="middle" style="font:12px Consolas,monospace;fill:var(--al-${color})">${fmt(v, 3)}</text></g>`;
      }).join('');
      let s = svgStart('两个独立的二维头输出，拼接后经 Wᴼ 投影成四维输出');
      outputs.forEach((v, h) => {
        const cx = h === 0 ? 152 : 448, cy = 103, color = h === 0 ? 'k' : 'v';
        const p = { x: x => cx + x * unit, y: y => cy - y * unit };
        s += `<g data-head="${h}" role="button" tabindex="0" aria-label="选择 Head ${h + 1}"><rect x="${cx - 64}" y="8" width="128" height="30" rx="5" fill="var(--al-${color})" fill-opacity="${state.head === h ? '.13' : '.02'}" stroke="var(--al-${color})" stroke-opacity="${state.head === h ? '.65' : '.18'}"/><text x="${cx}" y="28" text-anchor="middle" style="font-size:14px;fill:var(--al-${color})">Head ${h + 1}${state.head === h ? ' · 当前' : ''}</text></g>`;
        s += `<path d="M${cx - 69} ${cy} H${cx + 69} M${cx} ${cy - 57} V${cy + 57}" stroke="var(--al-muted)" stroke-opacity=".24" fill="none"/><circle cx="${cx}" cy="${cy}" r="2" fill="var(--al-muted)"/><text x="${cx + 73}" y="${cy + 4}" style="font-size:11px">o${h + 1}₁</text><text x="${cx + 8}" y="${cy - 50}" style="font-size:11px">o${h + 1}₂</text>`;
        s += arrow(p, v, color);
        s += `<circle cx="${p.x(v[0])}" cy="${p.y(v[1])}" r="4" fill="var(--al-${color})"/><text x="${cx}" y="182" text-anchor="middle" style="font:12px Consolas,monospace;fill:var(--al-${color})">o${h + 1} = ${esc(vec(v))}</text>`;
        const targetX = h === 0 ? 237.5 : 357.5;
        s += `<path d="M${cx} 190 V200 H${targetX} V215 m-4 -6 l4 6 l4 -6" fill="none" stroke="var(--al-${color})" stroke-width="1.4" stroke-opacity=".7"/>`;
      });
      s += `<text x="162" y="238" text-anchor="end" style="font-size:12px">Concat</text>${cells(result.concat[state.query], 217, false)}`;
      s += down(298, 257, 292);
      s += `<text x="320" y="279" style="font-size:14px;fill:var(--al-ink)">× Wᴼ</text><text x="378" y="279" style="font-size:11px">4 × 4</text>`;
      s += `<text x="162" y="319" text-anchor="end" style="font-size:12px;fill:var(--al-q)">MHA</text>${cells(result.projected[state.query], 298, true)}`;
      s += `<text x="300" y="366" text-anchor="middle" style="font-size:11px">两个平面共用数值尺度 · 拼接保留各头分量 · Wᴼ 重新组合</text></svg>`;
      return s;
    }

    function blockView() {
      plot = null;
      const i = state.query;
      const rows = [
        ['X', result.x[i], 'muted', 51],
        ['MHA', result.projected[i], 'k', 100],
        ['X + MHA', result.residual[i], 'q', 149],
        ['LayerNorm', result.norm1[i], 'q', 206],
        ['FFN', result.ffn[i], 'v', 256],
        ['Y', result.block[i], 'q', 332]
      ];
      const centers = [185, 280, 375, 470];
      const extent = Math.max(.5, ...rows.flatMap(r => r[1]).map(Math.abs));
      const unit = 32 / extent;
      const tinyArrow = (x, y, direction, color = 'muted') => direction === 'left'
        ? `<path d="M${x + 6} ${y - 4} L${x} ${y} L${x + 6} ${y + 4}" fill="none" stroke="var(--al-${color})" stroke-width="1.4"/>`
        : `<path d="M${x - 4} ${y - 6} L${x} ${y} L${x + 4} ${y - 6}" fill="none" stroke="var(--al-${color})" stroke-width="1.4"/>`;
      let s = svgStart('当前 token 的六组四维特征，使用相同尺度；右侧显示两次残差相加');
      centers.forEach((cx, d) => {
        s += `<text x="${cx}" y="20" text-anchor="middle" style="font-size:11px">特征 ${d + 1}</text><path d="M${cx} 33 V349" stroke="var(--al-muted)" stroke-opacity=".18" stroke-dasharray="2 5"/>`;
      });
      rows.forEach(([label, values, color, y]) => {
        s += `<text x="20" y="${y + 4}" style="font-size:13px;fill:var(--al-${color})">${label}</text>`;
        values.forEach((v, d) => {
          const cx = centers[d], end = cx + v * unit;
          s += `<path d="M${cx - 36} ${y} H${cx + 36}" stroke="var(--al-muted)" stroke-opacity=".16"/><path d="M${cx} ${y} H${end}" stroke="var(--al-${color})" stroke-width="6" stroke-linecap="round" stroke-opacity=".85"/><circle cx="${cx}" cy="${y}" r="2" fill="var(--al-ink)" fill-opacity=".65"/><circle cx="${end}" cy="${y}" r="3.4" fill="var(--al-${color})"/><text x="${cx}" y="${y + 19}" text-anchor="middle" style="font:11px Consolas,monospace;fill:var(--al-${color})">${fmt(v, 3)}</text>`;
        });
      });
      // First residual: X and MHA both enter the sum; the sum is then normalized.
      s += `<path d="M513 51 H581 V149 H566 M513 100 H555 V138" fill="none" stroke="var(--al-muted)" stroke-width="1.3" stroke-opacity=".65"/><circle cx="555" cy="149" r="10" fill="var(--al-bg)" stroke="var(--al-q)" stroke-opacity=".7"/><text x="555" y="153" text-anchor="middle" style="font-size:15px;fill:var(--al-q)">+</text><path d="M545 149 H514" fill="none" stroke="var(--al-q)" stroke-width="1.4"/>${tinyArrow(514, 149, 'left', 'q')}`;
      s += `<path d="M110 156 V195" fill="none" stroke="var(--al-muted)" stroke-width="1.2" stroke-opacity=".5"/>${tinyArrow(110, 195, 'down')}<text x="119" y="183" style="font-size:11px">LN</text>`;
      s += `<path d="M110 213 V245" fill="none" stroke="var(--al-muted)" stroke-width="1.2" stroke-opacity=".5"/>${tinyArrow(110, 245, 'down')}`;
      // Second residual: normalized Z skips the FFN and is added to FFN(Z), then LN.
      s += `<path d="M513 206 H581 V291 H566 M513 256 H555 V280" fill="none" stroke="var(--al-muted)" stroke-width="1.3" stroke-opacity=".65"/><circle cx="555" cy="291" r="10" fill="var(--al-bg)" stroke="var(--al-q)" stroke-opacity=".7"/><text x="555" y="295" text-anchor="middle" style="font-size:15px;fill:var(--al-q)">+</text><path d="M555 301 V310 M555 325 V332 H514" fill="none" stroke="var(--al-q)" stroke-width="1.4"/><text x="555" y="322" text-anchor="middle" style="font-size:11px;fill:var(--al-q)">LN</text>${tinyArrow(514, 332, 'left', 'q')}`;
      s += `<text x="20" y="284" style="font-size:11px">4 → 8 → GELU → 4</text><text x="300" y="378" text-anchor="middle" style="font-size:11px">post-LN · 所有棒共用尺度：左负右正 · FFN 逐 token 计算</text></svg>`;
      return s;
    }
    function inspector() {
      const h=activeHead(),i=state.query,j=state.key,q=h.q[i],k=h.k[j],w=h.weights[i][j],score=h.scores[i][j];
      const formula = scene === 'weights' ? `A = softmax(QKᵀ${state.scale?' / √2':''} / T${state.causal?' + M':''})` : scene === 'position' ? ({none:'Q = XWQ; K = XWK',sinusoidal:'X′ = X + PE(position)',rope:'(Rᵢq) · (Rⱼk) = qᵀRⱼ₋ᵢk'}[state.position]) : SCENES[scene].formula;
      const header=`<div class="al-equation">${esc(formula).replace(/\n/g,'<br>')}</div>`;
      let s=header;
      if(scene==='geometry') {
        const cos=length(q)*length(k)?C.dot(q,k)/(length(q)*length(k)):null;
        s+=tag('Query','「'+esc(result.tokens[i])+'」')+tag('匹配 Key','「'+esc(result.tokens[j])+'」')+tag('cos θ',cos===null?'未定义':fmt(cos,3))+tag('‖q‖ × ‖k‖',fmt(length(q)*length(k),3))+tag('点积 q · k',fmt(score,3))+coordinateInputs('q',i);
        s+='<div class="al-note">点积由夹角与模长共同决定。</div>';
      } else if(scene==='weights') {
        s+=tag('q · k',fmt(score,3))+tag('缩放因子',`${state.scale?'√2':'1'} × ${fmt(state.temperature)}`)+tag('logit',fmt(h.logits[i][j],3))+tag('权重 a',fmt(w*100,2)+'%');
        const row=h.logits[i],rowMax=Math.max(...row),exps=row.map(v=>Math.exp(v-rowMax)),denominator=exps.reduce((a,b)=>a+b,0);
        s+=tag('exp(sⱼ − max)',fmt(exps[j],4))+tag('Σ exp(s − max)',fmt(denominator,4));
        s+=`<div class="al-note">${state.causal&&j>i?'因果遮罩：logit = −∞，a = 0。':'按行减去最大值，再求指数并归一化。'}</div>`;
      } else if(scene==='values') {
        const v=h.v[j];
        s+=tag('选中的 Value','「'+esc(result.tokens[j])+'」')+tag('权重 a',fmt(w,4))+coordinateInputs('v',j)+tag('贡献 a × v',vec(v.map(a=>a*w)))+tag('汇合输出 o',vec(h.out[i]));
        s+='<div class="al-note">V 的变化不影响权重。加权输出位于可访问 V 的凸包内。</div>';
      } else if(scene==='heads') {
        s+=tag('输入维度','4')+tag('头数 × 每头维度','2 × 2')+tag('拼接后维度','4')+tag('Wᴼ 形状','4 × 4');
        s+=`<div class="al-small-title">Head ${state.head+1} · 注意力权重</div>${bars(h.weights[i])}`;
      } else if(scene==='position') {
        const clean={...state,overrides:{q:{},k:{},v:{}}};
        const baseline=C.compute({...clean,positionOffset:0}).heads[state.head];
        const shifted=C.compute(clean).heads[state.head];
        const drift=Math.max(...baseline.weights.flat().map((v,n)=>Math.abs(v-shifted.weights.flat()[n])));
        s+=tag('位置机制',{none:'无位置',sinusoidal:'正余弦相加',rope:'RoPE'}[state.position])+tag('共同位置偏移',String(state.positionOffset||0))+tag('最大权重变化',drift<1e-12?'≈ 0':fmt(drift,5));
        s+='<div class="al-note">比较整体偏移前后的注意力矩阵，未施加手动干预。<br>RoPE：dₖ = 2，θ₀ = 1。</div>';
        s+=tag('Q',vec(q))+tag('K',vec(k))+tag('q · k',fmt(score,3));
      } else {
        const stats=result.normStats[i];
        s+=tag('残差均值 μ',fmt(stats.mean,4))+tag('残差方差 σ²',fmt(stats.variance,4));
        s+='<div class="al-note">LN(x) = (x − μ) / √(σ² + ε)<br>ε = 10⁻⁵，γ = 1，β = 0。沿特征维归一化。</div>';
        const n=result.next;
        s+='<div class="al-small-title" style="margin-top:20px;margin-bottom:8px">词表读出 · 未训练参数</div><div class="al-note" style="margin-top:0">当前 token → 线性映射 → softmax</div>';
        s+=`<div class="al-output-bars">${n.labels.map((label,j)=>`<div class="al-bar-row"><span>${esc(label)}</span><div class="al-bar-track"><div class="al-bar-fill" style="width:${n.probs[j]*100}%;background:var(--al-q)"></div></div><span class="al-mono">${fmt(n.probs[j]*100,1)}%</span></div>`).join('')}</div>`;
      }
      if(['geometry','weights','values'].includes(scene))s+=`<div class="al-small-title" style="margin-top:20px;margin-bottom:10px">注意力权重</div>${bars(h.weights[i],{value:scene==='values'})}`;
      return s;
    }
    function updateData() {
      if(!$('.al-data').open)return;
      const h=activeHead(),spec=result.headSpecs?.[state.head]||C.HEADS[state.head];
      const matrices=[['输入 X · 6 × 4',result.x],['WQ · 4 × 2',spec.wq],['WK · 4 × 2',spec.wk],['WV · 4 × 2',spec.wv],['Q · 6 × 2',h.q],['K · 6 × 2',h.k],['V · 6 × 2',h.v],['A · 6 × 6',h.weights],['单头输出 O · 6 × 2',h.out]];
      $('.al-data-grid').innerHTML=matrices.map(([label,m])=>`<div><div class="al-matrix-label">${label}</div><div class="al-matrix">${m.map(r=>r.map(v=>fmt(v,3).padStart(7)).join(' ')).join('\n')}</div></div>`).join('');
    }
    function render(options = {}) {
      result=C.compute(state); state.key=clamp(state.key,0,result.tokens.length-1);
      $$('.al-tab').forEach(b=>{const on=b.dataset.scene===scene;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;});
      $('#al-panel').setAttribute('aria-labelledby','al-tab-'+scene);
      $$('.al-config [data-head]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.head)===state.head)));
      $('#al-preset').value=state.preset; $('#al-temperature').value=state.temperature;
      $('#al-temperature-value').textContent=fmt(state.temperature); $('#al-causal').checked=state.causal; $('#al-scale').checked=state.scale;
      if(root.dataset.tokenPreset!==String(state.preset)) {
        $('.al-tokens').innerHTML=result.tokens.map((t,i)=>`<button class="al-token" type="button" data-query="${i}" aria-label="用 ${esc(t)} 作为 Query" aria-pressed="${i===state.query}"><small>0${i+1}</small>${esc(t)}</button>`).join('');
        root.dataset.tokenPreset=String(state.preset);
      }
      $$('.al-tokens [data-query]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.query)===state.query)));
      $('.al-scene-title').textContent=SCENES[scene].title; $('.al-scene-sub').textContent=SCENES[scene].sub; $('.al-hint').textContent=SCENES[scene].hint;
      if(!options.keepControls) {
        $('.al-local-controls').innerHTML=scene==='position'?`<select id="al-position" aria-label="位置编码方式"><option value="none">无位置编码</option><option value="sinusoidal">Sinusoidal</option><option value="rope">RoPE</option></select><label>偏移 <input id="al-offset" type="range" min="0" max="12" step="1" value="${state.positionOffset||0}" aria-label="所有 token 的共同位置偏移"><output id="al-offset-value">${state.positionOffset||0}</output></label>`:scene==='geometry'?`<button class="al-btn" type="button" data-action="play" aria-pressed="${playing}">${playing?'暂停':'自动旋转'}</button><button class="al-btn" type="button" data-action="zero-query">Q = 0</button>`:scene==='weights'?`<div class="al-segment" aria-label="矩阵显示"><button type="button" data-action="matrix-scores" aria-pressed="${matrixMode==='scores'}">QKᵀ</button><button type="button" data-action="matrix-weights" aria-pressed="${matrixMode==='weights'}">Softmax</button></div>`:scene==='values'?`<button class="al-btn" type="button" data-action="sum" aria-pressed="${showSum}">向量累加</button>`:'';
        if($('#al-position'))$('#al-position').value=state.position;
      }
      canvas.innerHTML=scene==='geometry'?geometrySvg():scene==='weights'?heatmapSvg():scene==='values'?valueSvg():scene==='heads'?headsView():scene==='position'?geometrySvg(true):blockView();
      $('.al-mobile-keys').innerHTML=['geometry','values','position'].includes(scene)?result.tokens.map((t,i)=>`<button class="al-btn" type="button" data-key="${i}" aria-pressed="${i===state.key}">${esc(t)}</button>`).join(''):'';
      $('.al-legend').innerHTML=['geometry','position'].includes(scene)?'<span class="al-q"><i></i>Query</span><span class="al-k"><i></i>Key</span>':scene==='values'?'<span class="al-v"><i></i>Value</span><span class="al-q">＋ 加权输出</span>':'';
      if(!options.keepInspector)$('.al-inspector').innerHTML=inspector();
      else {
        const next=document.createElement('div');next.innerHTML=inspector();
        next.querySelectorAll('.al-measure').forEach((el,i)=>{const old=$$('.al-inspector .al-measure')[i];if(old)old.innerHTML=el.innerHTML;});
        const newBars=next.querySelector('.al-bars'),oldBars=$('.al-inspector .al-bars');if(newBars&&oldBars)oldBars.innerHTML=newBars.innerHTML;
      }
      const h=activeHead(),weights=h.weights[state.query],max=Math.max(...weights),j=weights.indexOf(max),entropy=C.entropy(weights);
      const entropyBits=entropy/Math.log(2);
      $('.al-summary').innerHTML=`<div><div class="al-summary-label">最大权重 · ${esc(result.tokens[j])}</div><div class="al-summary-value">${fmt(max*100,1)}<span style="font-size:11px"> %</span></div></div><div><div class="al-summary-label">分布熵</div><div class="al-summary-value">${fmt(entropyBits,3)} <span style="font-size:10px">bits</span></div></div><div><div class="al-summary-label">输出 o</div><div class="al-summary-value">${vec(h.out[state.query])}</div></div>`;
      $('[data-action="next"]').textContent=scene==='block'?'返回 Q · K':'下一模块 →';
      updateData();
    }
    function stop() {
      playing=false;cancelAnimationFrame(frame);frame=0;lastTick=0;
      const button=$('[data-action="play"]');
      if(button){button.textContent='自动旋转';button.setAttribute('aria-pressed','false');}
    }
    function navigate(next) {
      if(!SCENES[next])return;stop();scene=next;drag=null;
      if(next==='position'){state.overrides.q={};state.overrides.k={};}
      render();
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
        canvas.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:280,easing:'cubic-bezier(.22,1,.36,1)'});
      }
    }
    function tick(time) {
      if(!playing||!root.isConnected||document.hidden){stop();return;}
      const elapsed=lastTick?Math.min(time-lastTick,50):16; lastTick=time;
      if(!root._lastPaint||time-root._lastPaint>32){const q=activeHead().q[state.query];state.overrides.q[overrideId(state.query)]=C.rotate(q,elapsed*.001);render({keepControls:true});root._lastPaint=time;}
      frame=requestAnimationFrame(tick);
    }
    function expand() {
      const expanded=root.classList.toggle('al-expanded');document.body.classList.toggle('al-has-expanded',expanded);
      const button=$('[data-action="expand"]');button.textContent=expanded?'收起 ↙':'展开 ↗';button.setAttribute('aria-expanded',String(expanded));
      if(expanded){expandedFrom=document.activeElement;button.focus();}else if(expandedFrom&&expandedFrom.isConnected){expandedFrom.focus();}
    }
    root.addEventListener('click',event=>{
      const b=event.target.closest('[data-scene],[data-query],[data-head],[data-key],[data-cell],[data-action]');if(!b)return;
      if(b.dataset.scene)navigate(b.dataset.scene);
      else if(b.dataset.query!==undefined){stop();state.query=Number(b.dataset.query);render();$(`[data-query="${state.query}"]`).focus({preventScroll:true});}
      else if(b.dataset.head!==undefined){stop();state.head=Number(b.dataset.head);render();}
      else if(b.dataset.key!==undefined){state.key=Number(b.dataset.key);render();if(event.detail===0)$(`[data-key="${state.key}"]`)?.focus({preventScroll:true});}
      else if(b.dataset.cell){[state.query,state.key]=b.dataset.cell.split(',').map(Number);render();if(event.detail===0)$(`[data-cell="${state.query},${state.key}"]`)?.focus({preventScroll:true});}
      else if(b.dataset.action==='reset'){stop();state=C.createState();render();}
      else if(b.dataset.action==='theme'){
        const light=root.dataset.labTheme==='dark';root.dataset.labTheme=light?'light':'dark';b.textContent=light?'深色':'浅色';
        if(root.dataset.embedded!=='true')document.documentElement.dataset.theme=root.dataset.labTheme;
      }
      else if(b.dataset.action==='matrix-scores'||b.dataset.action==='matrix-weights'){matrixMode=b.dataset.action==='matrix-scores'?'scores':'weights';render();}
      else if(b.dataset.action==='sum'){showSum=!showSum;render();}
      else if(b.dataset.action==='next')navigate(order[(order.indexOf(scene)+1)%order.length]);
      else if(b.dataset.action==='expand')expand();
      else if(b.dataset.action==='zero-query'){stop();setOverride('q',state.query,[0,0]);render();}
      else if(b.dataset.action==='play'){if(playing)stop();else{playing=true;frame=requestAnimationFrame(tick);}render();}
    });
    root.addEventListener('input',event=>{
      if(event.target.id==='al-temperature'){state.temperature=Number(event.target.value);render({keepControls:true});}
      if(event.target.id==='al-offset'){state.positionOffset=Number(event.target.value);$('#al-offset-value').textContent=state.positionOffset;render({keepControls:true});}
      const t=event.target;
      if(t.dataset.coordinate!==undefined&&t.value!==''){
        const value=Number(t.value);if(!Number.isFinite(value))return;
        stop();const role=t.dataset.role,index=Number(t.dataset.index),axis=Number(t.dataset.coordinate),v=activeHead()[role][index].slice();v[axis]=value;setOverride(role,index,v);render({keepInspector:true,keepControls:true});
      }
    });
    root.addEventListener('change',event=>{
      const t=event.target;
      if(t.id==='al-preset'){stop();const preset=Number(t.value);state=C.createState();state.preset=preset;render();}
      else if(t.id==='al-causal'){state.causal=t.checked;render({keepControls:true});}
      else if(t.id==='al-scale'){state.scale=t.checked;render({keepControls:true});}
      else if(t.id==='al-position'){stop();state.position=t.value;state.overrides.q={};state.overrides.k={};render({keepControls:true});}
      else if(t.dataset.coordinate!==undefined){const role=t.dataset.role,index=Number(t.dataset.index),axis=Number(t.dataset.coordinate),v=activeHead()[role][index].slice(),value=Number(t.value);if(Number.isFinite(value)){v[axis]=value;setOverride(role,index,v);render();}}
    });
    canvas.addEventListener('pointerdown',event=>{
      const point=event.target.closest('[data-drag]');if(!point||!plot)return;
      stop();const svg=canvas.querySelector('svg'),rect=svg.getBoundingClientRect();
      drag={role:point.dataset.drag,index:Number(point.dataset.index),rect,extent:plot.extent,plot};
      if(drag.role==='v')state.key=drag.index;
      canvas.setPointerCapture(event.pointerId);event.preventDefault();
    });
    canvas.addEventListener('pointermove',event=>{
      if(!drag)return;
      const x=(event.clientX-drag.rect.left)*600/drag.rect.width,y=(event.clientY-drag.rect.top)*390/drag.rect.height;
      const v=drag.plot.from(x,y).map(a=>clamp(a,-drag.extent+.3,drag.extent-.3));setOverride(drag.role,drag.index,v);render({keepControls:true});
    });
    const finishDrag=()=>{if(drag){drag=null;render({keepControls:true});}};
    canvas.addEventListener('pointerup',finishDrag);canvas.addEventListener('pointercancel',finishDrag);canvas.addEventListener('lostpointercapture',finishDrag);
    root.addEventListener('keydown',event=>{
      const t=event.target;
      if(event.key==='Escape'&&root.classList.contains('al-expanded')){expand();return;}
      if(t.dataset.scene&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
        event.preventDefault();let n=order.indexOf(t.dataset.scene);n=event.key==='Home'?0:event.key==='End'?5:(n+(event.key==='ArrowRight'?1:5))%6;navigate(order[n]);$(`[data-scene="${order[n]}"]`).focus();
      } else if(t.dataset.drag&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();stop();const role=t.dataset.drag,i=Number(t.dataset.index),v=activeHead()[role][i].slice(),axis=['ArrowLeft','ArrowRight'].includes(event.key)?0:1;v[axis]+=(['ArrowLeft','ArrowDown'].includes(event.key)?-1:1)*(event.shiftKey?.5:.1);setOverride(role,i,v);if(role==='v')state.key=i;render();$(`[data-drag="${role}"][data-index="${i}"]`).focus({preventScroll:true});
      } else if((t.dataset.cell||t.dataset.key!==undefined||t.dataset.head!==undefined)&&['Enter',' '].includes(event.key)&&t.tagName.toLowerCase()==='g'){event.preventDefault();t.dispatchEvent(new MouseEvent('click',{bubbles:true}));}
    });
    $('.al-data').addEventListener('toggle',updateData);
    const onNavigate=event=>{if(root.isConnected)navigate(event.detail?.scene);};
    document.addEventListener('attention-lab:navigate',onNavigate);
    const onHidden=()=>{if(document.hidden&&playing){stop();if(root.isConnected)render();}};
    document.addEventListener('visibilitychange',onHidden);
    const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&playing){stop();render();}}):null;
    observer?.observe(root);
    // Provide a small lifecycle handle for PJAX and browser-independent integration checks.
    root.attentionLab={getState:()=>JSON.parse(JSON.stringify(state)),getResult:()=>result,navigate,destroy:()=>{stop();observer?.disconnect();document.removeEventListener('attention-lab:navigate',onNavigate);document.removeEventListener('visibilitychange',onHidden);document.body.classList.remove('al-has-expanded');}};
    render();
  }
  function init(){const root=document.getElementById('transformer-lab');if(root)mount(root);}
  if(!window.__attentionLabEvents){
    document.addEventListener('DOMContentLoaded',init);document.addEventListener('pjax:complete',init);window.addEventListener('attention-lab:core-ready',init);window.__attentionLabEvents=true;
    document.addEventListener('pjax:send',()=>document.getElementById('transformer-lab')?.attentionLab?.destroy());
  }
  window.initAttentionLab=init;init();
})();
