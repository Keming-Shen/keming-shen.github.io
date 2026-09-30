/* Independent figures for the examples in the Attention article. */
(() => {
  'use strict';
  if (window.AttentionInline) { window.AttentionInline.init(); return; }
  const titles = {softmax:'Softmax',geometry:'Q/K 点积',scaling:'分数尺度与 Softmax',values:'Value 加权求和',heads:'多头注意力',block:'编码器层 · Post-Norm',position:'RoPE · 二维旋转'};
  const mounted = new Map();
  const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt = (n,d=2) => (Math.abs(n)<1e-10?0:n).toFixed(d);
  const vec = a => '['+a.map(v=>fmt(v)).join(', ')+']';
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));
  const text = (x,y,value,color='muted',anchor='start',size=12) => `<text x="${x}" y="${y}" text-anchor="${anchor}" style="fill:var(--ai-${color});font-size:${size}px">${esc(value)}</text>`;

  function mount(root) {
    const C=window.AttentionLabCore,type=root.dataset.example;
    if(!C || !titles[type] || mounted.has(root))return;
    let state,scores,multiplier,scaled,selected,head,showSum,drag=null,plot,result;
    function resetState() {
      state=C.createState();state.preset=C.ARTICLE_PRESET_INDEX;state.query=2;state.key=0;
      state.scale=['heads','block'].includes(type);state.position=type==='position'?'rope':'none';
      scores=[1.2,2.6,1.8];multiplier=1;scaled=false;selected=0;head=0;showSum=false;
    }
    resetState();
    const tokens=C.PRESETS[state.preset].tokens;
    const buttons=(kind,labels)=>`<div class="ai-tokens" aria-label="${kind==='query'?'选择 Query':'选择向量'}">${labels.map((t,i)=>`<button type="button" data-${kind}="${i}" aria-pressed="false">${esc(t)}</button>`).join('')}</div>`;
    const range=(label,key,min,max,step,value)=>`<label class="ai-row"><span>${label}<output data-output="${key}">${value}</output></span><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-control="${key}" aria-label="${label}"></label>`;
    let controls='';
    if(type==='softmax') controls=tokens.map((t,i)=>range(t,`score-${i}`,-4,6,.1,scores[i])).join('');
    if(type==='scaling') controls=range('分数倍数','multiplier',1,10,.1,1)+'<label class="ai-check"><input type="checkbox" data-control="scale">除以 √2</label>';
    if(['geometry','values','position'].includes(type)) controls=buttons('select',tokens);
    if(['geometry','values'].includes(type)) controls+=`<div class="ai-coordinate">${[0,1].map(i=>`<label>${type==='geometry'?'q':'v'}${i+1}<input type="number" min="-6" max="6" step=".1" data-coordinate="${i}" aria-label="${type==='geometry'?'Query':'Value'} 第 ${i+1} 维"></label>`).join('')}</div>`;
    if(type==='values') controls+='<button type="button" class="ai-control" data-action="sum" aria-pressed="false">向量累加</button>';
    if(['heads','block'].includes(type)) controls='<span class="ai-label">Query</span>'+buttons('query',tokens);
    if(type==='heads') controls+=buttons('head',['Head 1','Head 2']);
    if(type==='position') controls+=range('共同位置偏移','offset',0,6,.05,0);
    const params=['heads','block'].includes(type)?'<details class="ai-details"><summary>投影矩阵</summary><pre></pre></details>':'';
    root.innerHTML=`<div class="ai-header"><strong>${titles[type]}</strong><button type="button" data-action="reset">重置</button></div><div class="ai-workspace"><div class="ai-visual"></div><div class="ai-panel">${controls}<div class="ai-equation"></div><div class="ai-metrics" aria-live="polite"></div></div></div>${params}`;
    const $=s=>root.querySelector(s),$$=s=>Array.from(root.querySelectorAll(s));
    const visual=$('.ai-visual');
    const metric=(name,value)=>`<div class="ai-metric"><span>${name}</span><strong>${esc(value)}</strong></div>`;
    const chart=(body,label)=>`<svg class="ai-svg" viewBox="0 0 560 310" role="group" aria-label="${esc(label)}"><title>${esc(label)}</title>${body}</svg>`;
    function frame(points) {
      if(drag)return drag.plot;
      const minX=Math.min(-.6,...points.map(v=>v[0]-.65)),maxX=Math.max(1.6,...points.map(v=>v[0]+.65));
      const minY=Math.min(-.6,...points.map(v=>v[1]-.65)),maxY=Math.max(.6,...points.map(v=>v[1]+.65));
      const unit=Math.min(440/(maxX-minX),220/(maxY-minY)),ox=275-(minX+maxX)*unit/2,oy=149+(minY+maxY)*unit/2;
      return {x:x=>ox+x*unit,y:y=>oy-y*unit,from:(x,y)=>[(x-ox)/unit,(oy-y)/unit],ox,oy,unit};
    }
    function axes(p,label='') {
      let s='';const [xmin,ymax]=p.from(45,30),[xmax,ymin]=p.from(515,267),step=Math.max(xmax-xmin,ymax-ymin)>12?2:1;
      for(let x=Math.ceil(xmin/step)*step;x<=xmax;x+=step) {s+=`<path class="ai-axis${x===0?' ai-zero':''}" d="M${p.x(x)} 30 V267"/>`;if(x!==0)s+=text(p.x(x),p.oy+16,x,'muted','middle',10);}
      for(let y=Math.ceil(ymin/step)*step;y<=ymax;y+=step) {s+=`<path class="ai-axis${y===0?' ai-zero':''}" d="M45 ${p.y(y)} H515"/>`;if(y!==0)s+=text(p.ox-9,p.y(y)+4,y,'muted','end',10);}
      return s+text(517,p.oy-8,label+'₁','muted','end',11)+text(p.ox+9,28,label+'₂','muted','start',11);
    }
    function arrow(p,from,to,color,opacity=1) {
      const x1=p.x(from[0]),y1=p.y(from[1]),x2=p.x(to[0]),y2=p.y(to[1]),a=Math.atan2(y2-y1,x2-x1),r=8;
      if(Math.hypot(x2-x1,y2-y1)<.1)return '';
      return `<g opacity="${opacity}"><path d="M${x1} ${y1} L${x2} ${y2}" stroke="var(--ai-${color})" stroke-width="1.8" fill="none"/><path d="M${x2-r*Math.cos(a-.4)} ${y2-r*Math.sin(a-.4)} L${x2} ${y2} L${x2-r*Math.cos(a+.4)} ${y2-r*Math.sin(a+.4)} Z" fill="var(--ai-${color})"/></g>`;
    }
    function dot(p,v,label,color,attrs='',offset=[10,-12]) {
      return `<g ${attrs}><circle cx="${p.x(v[0])}" cy="${p.y(v[1])}" r="15" fill="var(--ai-${color})" opacity=".06"/><circle cx="${p.x(v[0])}" cy="${p.y(v[1])}" r="4" fill="var(--ai-${color})"/><text class="ai-point-label" x="${p.x(v[0])+offset[0]}" y="${p.y(v[1])+offset[1]}" style="fill:var(--ai-${color})">${esc(label)}</text></g>`;
    }
    function distribution(raw,logits) {
      const weights=C.softmax(logits),m=Math.max(3,...raw.map(Math.abs)),unit=92/m;
      let s=text(177,29,type==='scaling'?'原始分数':'分数 s','muted','middle')+text(433,29,'Softmax(s)','k','middle');
      if(type==='scaling')s=text(177,29,'[1, 2, 3] × '+fmt(multiplier,1),'muted','middle')+text(429,29,scaled?'Softmax(s / √2)':'Softmax(s)','k','middle');
      s+=`<path d="M306 48 V258" stroke="var(--ai-line)"/><path d="M283 145 h46 m-6 -4 l6 4 l-6 4" stroke="var(--ai-muted)" fill="none"/>`;
      raw.forEach((v,i)=>{const y=83+i*72,width=Math.abs(v)*unit,x=v<0?175-width:175;
        s+=text(17,y+4,tokens[i],'ink')+`<path d="M175 ${y-19} V${y+19}" stroke="var(--ai-muted)" opacity=".4"/><rect x="${x}" y="${y-7}" width="${width}" height="14" rx="2" fill="var(--ai-q)" opacity=".7"/>`+text(175+v*unit+(v<0?-7:7),y+4,fmt(v,1),'q',v<0?'end':'start',11)+`<path d="M351 ${y} H480" stroke="var(--ai-line)" stroke-width="8"/><path d="M351 ${y} h${129*weights[i]}" stroke="var(--ai-k)" stroke-width="8"/>`+text(493,y+4,fmt(weights[i]*100,1)+'%','k','start',11);
      });
      return {svg:chart(s,'三项分数及其 Softmax 概率'),weights};
    }
    function geometry() {
      const h=result.heads[0],q=h.q[2],k=h.k[selected];plot=frame([q,...h.k]);const p=plot;
      let s=axes(p,'');const kn=Math.hypot(...k),qn=Math.hypot(...q),score=C.dot(q,k);
      if(kn>.001){const proj=k.map(v=>v*score/(kn*kn));s+=`<path d="M${p.ox} ${p.oy} L${p.x(proj[0])} ${p.y(proj[1])}" stroke="var(--ai-q)" stroke-width="5" opacity=".17"/><path d="M${p.x(q[0])} ${p.y(q[1])} L${p.x(proj[0])} ${p.y(proj[1])}" stroke="var(--ai-q)" stroke-dasharray="3 4" fill="none" opacity=".5"/>`;}
      if(kn*qn>.001){const a=Math.atan2(k[1],k[0]),delta=Math.atan2(Math.sin(Math.atan2(q[1],q[0])-a),Math.cos(Math.atan2(q[1],q[0])-a)),r=27;s+=`<path d="M${p.ox+r*Math.cos(a)} ${p.oy-r*Math.sin(a)} A${r} ${r} 0 0 ${delta>0?0:1} ${p.ox+r*Math.cos(a+delta)} ${p.oy-r*Math.sin(a+delta)}" fill="none" stroke="var(--ai-q)" opacity=".7"/>`;}
      h.k.forEach((v,i)=>{s+=arrow(p,[0,0],v,'k',i===selected?1:.45)+dot(p,v,`k${i+1} · ${tokens[i]}`,'k',`role="button" tabindex="0" data-select="${i}" aria-label="选择 Key ${tokens[i]}"`,[10,i===0?-12:18]);});
      s+=arrow(p,[0,0],q,'q')+dot(p,q,'q · '+tokens[2],'q','data-drag="q" tabindex="0" role="button" aria-label="拖动 Query，方向键调整"',[9,-17]);
      return {svg:chart(s,tokens[2]+'的 Query 与三个 Key 的点积'),metrics:metric('q',vec(q))+metric('k · '+tokens[selected],vec(k))+metric('q · k',fmt(score,3))+metric('cos θ',kn*qn>.001?fmt(score/(kn*qn),3):'未定义')};
    }
    function values() {
      const h=result.heads[0],a=h.weights[2],out=h.out[2];plot=frame([...h.v,out]);const p=plot;
      let s=axes(p,'v');s+=`<polygon points="${h.v.map(v=>p.x(v[0])+','+p.y(v[1])).join(' ')}" fill="var(--ai-v)" fill-opacity=".04" stroke="var(--ai-v)" stroke-opacity=".35" stroke-dasharray="3 4"/>`;
      h.v.forEach((v,i)=>{s+=`<path d="M${p.x(v[0])} ${p.y(v[1])} L${p.x(out[0])} ${p.y(out[1])}" stroke="var(--ai-v)" stroke-width="${1+a[i]*4}" opacity=".2"/>`+dot(p,v,tokens[i]+' · '+fmt(a[i]*100,1)+'%','v',`data-drag="v" data-index="${i}" tabindex="0" role="button" aria-label="拖动 Value ${tokens[i]}，方向键调整"`,i===0?[10,18]:[10,-12]);});
      if(showSum){let total=[0,0];h.v.forEach((v,i)=>{const next=total.map((n,d)=>n+a[i]*v[d]);s+=arrow(p,total,next,i===selected?'q':'v',.9);total=next;});}
      const x=p.x(out[0]),y=p.y(out[1]);s+=`<path d="M${x-7} ${y} h14 M${x} ${y-7} v14" stroke="var(--ai-q)" stroke-width="2.5"/>`+text(x+12,y+4,'o','q');
      return {svg:chart(s,'三个 Value 与固定权重的加权输出'),metrics:metric('a · '+tokens[selected],fmt(a[selected],3))+metric('v',vec(h.v[selected]))+metric('a × v',vec(h.v[selected].map(n=>n*a[selected])))+metric('o = Σ av',vec(out))};
    }
    function vectorRow(values,y,colors) {
      return values.map((v,i)=>`<rect x="${167+i*60}" y="${y}" width="55" height="29" rx="2" fill="var(--ai-${colors[i]})" fill-opacity=".06" stroke="var(--ai-${colors[i]})" stroke-opacity=".4"/>`+text(194+i*60,y+19,fmt(v),'ink','middle',11)).join('');
    }
    function heads() {
      const out=result.heads.map(h=>h.out[state.query]),extent=Math.max(.3,...out.flat().map(Math.abs)),unit=43/extent;
      let s='';out.forEach((v,i)=>{const cx=i===0?143:416,cy=86,color=i===0?'k':'v',p={x:n=>cx+n*unit,y:n=>cy-n*unit};s+=text(cx,22,'Head '+(i+1),color,'middle')+`<path d="M${cx-66} ${cy} H${cx+66} M${cx} ${cy-46} V${cy+47}" stroke="var(--ai-line)"/>`+arrow(p,[0,0],v,color)+text(cx,149,vec(v),color,'middle',11)+`<path d="M${cx} 158 V169 H${i===0?220:340} V180" fill="none" stroke="var(--ai-${color})" opacity=".6"/>`;});
      s+=text(147,199,'Concat','muted','end',11)+vectorRow(result.concat[state.query],181,['k','k','v','v'])+`<path d="M282 216 V246 m-4 -6 l4 6 l4 -6" stroke="var(--ai-muted)" fill="none"/>`+text(300,236,'× Wᴼ','ink')+text(147,272,'输出','muted','end',11)+vectorRow(result.projected[state.query],254,['q','q','q','q']);
      const h=result.heads[head];return {svg:chart(s,'两个独立头的二维输出经拼接与线性映射得到四维输出'),metrics:tokens.map((t,i)=>metric('a · '+t,fmt(h.weights[state.query][i],3))).join('')+metric('o'+(head+1),vec(h.out[state.query]))};
    }
    function block() {
      const i=state.query,rows=[['X',result.x[i],'muted',44],['MHA',result.projected[i],'k',85],['X + MHA',result.residual[i],'q',126],['LayerNorm',result.norm1[i],'q',171],['FFN · ReLU',result.ffn[i],'v',215],['Y',result.block[i],'q',273]],xs=[182,272,362,452],extent=Math.max(.5,...rows.flatMap(r=>r[1]).map(Math.abs)),unit=30/extent;
      let s='';xs.forEach((x,i)=>s+=text(x,16,'特征 '+(i+1),'muted','middle',10)+`<path d="M${x} 25 V294" stroke="var(--ai-line)" stroke-dasharray="2 4"/>`);
      rows.forEach(([label,v,color,y])=>{s+=text(14,y+4,label,color,'start',12);v.forEach((n,j)=>{s+=`<path d="M${xs[j]-33} ${y} H${xs[j]+33}" stroke="var(--ai-line)"/><path d="M${xs[j]} ${y} h${n*unit}" stroke="var(--ai-${color})" stroke-width="5" stroke-linecap="round"/>`+text(xs[j],y+17,fmt(n),color,'middle',10);});});
      s+=`<path d="M494 44 H546 V126 H528 M494 85 H519 V117 M510 126 H493 M494 171 H546 V242 H528 M494 215 H519 V233 M519 251 V273 H493" fill="none" stroke="var(--ai-muted)" stroke-width="1"/>`;
      [126,242].forEach(y=>{s+=`<circle cx="519" cy="${y}" r="9" fill="var(--ai-bg)" stroke="var(--ai-q)"/>`+text(519,y+4,'+','q','middle',13);});s+=text(523,269,'LN','q','start',10);
      s+=`<path d="M111 133 V161 m-3 -4 l3 4 l3 -4 M111 178 V204 m-3 -4 l3 4 l3 -4" stroke="var(--ai-muted)" fill="none"/>`;
      return {svg:chart(s,'使用 ReLU 的 Post-Norm Block，六组四维特征共用数值尺度'),metrics:metric('残差均值 μ',fmt(result.normStats[i].mean,3))+metric('残差方差 σ²',fmt(result.normStats[i].variance,3))+metric('输出维度','4')};
    }
    function position() {
      const h=result.heads[0],base=C.compute({...state,position:'none'}).heads[0],baseline=C.compute({...state,positionOffset:0}).heads[0],q=h.q[2],k=h.k[selected];
      const radius=Math.max(1,...[q,k,base.q[2],base.k[selected]].map(v=>Math.hypot(...v)))+.3;plot=frame([[-radius,-radius],[radius,radius]]);const p=plot;
      let s=axes(p,'');s+=`<circle cx="${p.ox}" cy="${p.oy}" r="${Math.hypot(...base.q[2])*p.unit}" stroke="var(--ai-q)" stroke-opacity=".15" fill="none"/>`;
      s+=`<g stroke-dasharray="3 4">${arrow(p,[0,0],base.q[2],'q',.25)}${arrow(p,[0,0],base.k[selected],'k',.25)}</g>`;
      s+=arrow(p,[0,0],q,'q')+arrow(p,[0,0],k,'k')+dot(p,q,'q · '+tokens[2],'q')+dot(p,k,'k · '+tokens[selected],'k');
      const score=C.dot(q,k),drift=score-C.dot(baseline.q[2],baseline.k[selected]);
      return {svg:chart(s,'RoPE 旋转前后的 Query 与 Key'),metrics:metric('Query 位置',fmt(2+state.positionOffset,2))+metric('Key 位置',fmt(selected+state.positionOffset,2))+metric('q · k',fmt(score,3))+metric('偏移引起的 Δ',Math.abs(drift)<1e-10?'0':fmt(drift,4))};
    }
    function render() {
      result=C.compute(state);let view,equation='';
      if(type==='softmax'||type==='scaling') {
        const raw=type==='softmax'?scores:[1,2,3].map(v=>v*multiplier),logits=raw.map(v=>v/(type==='scaling'&&scaled?Math.sqrt(2):1));
        view=distribution(raw,logits);view.metrics=metric('Σ a',fmt(view.weights.reduce((a,b)=>a+b,0),3));equation='aᵢ = exp(sᵢ) / Σ exp(sⱼ)';
        $$('[data-control]').forEach(el=>{const key=el.dataset.control;if(key.startsWith('score-')){const i=+key.slice(6);el.value=scores[i];$(`[data-output="${key}"]`).textContent=fmt(scores[i],1);}else if(key==='multiplier'){el.value=multiplier;$('[data-output="multiplier"]').textContent=fmt(multiplier,1);}else if(key==='scale')el.checked=scaled;});
      } else if(type==='geometry'){view=geometry();equation='q · k = ‖q‖ ‖k‖ cos θ';}
      else if(type==='values'){view=values();equation='o = Σ aᵢvᵢ';$('[data-action="sum"]').setAttribute('aria-pressed',showSum);}
      else if(type==='heads'){view=heads();equation='Concat(o¹, o²) Wᴼ';}
      else if(type==='block'){view=block();equation='Z = LN(X + MHA(X))\nY = LN(Z + FFN(Z))\nFFN: 4 → 8 → ReLU → 4';}
      else {view=position();equation='q̃ = q Rᵢᵀ, k̃ = k Rⱼᵀ\nq̃ k̃ᵀ = q Rⱼ₋ᵢ kᵀ';$('[data-control="offset"]').value=state.positionOffset;$('[data-output="offset"]').textContent=fmt(state.positionOffset,2);}
      visual.innerHTML=view.svg;$('.ai-equation').textContent=equation;$('.ai-metrics').innerHTML=view.metrics;
      $$('[data-select]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.select===selected)));
      $$('[data-query]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.query===state.query)));
      $$('[data-head]').forEach(el=>el.setAttribute('aria-pressed',String(+el.dataset.head===head)));
      $$('[data-coordinate]').forEach(el=>{if(el!==document.activeElement)el.value=fmt(result.heads[0][type==='geometry'?'q':'v'][type==='geometry'?2:selected][+el.dataset.coordinate],3);});
      if($('.ai-details')?.open)renderParameters();
    }
    function renderParameters() {
      if(!$('.ai-details'))return;
      const lines=[['X',result.x],...result.headSpecs.flatMap((h,i)=>[['WQ'+(i+1),h.wq],['WK'+(i+1),h.wk],['WV'+(i+1),h.wv]]),['Wᴼ',C.WO]];
      $('.ai-details pre').textContent=lines.map(([name,m])=>name+'\n'+m.map(vec).join('\n')).join('\n\n');
    }
    function moveVector(role,index,v) {state.overrides[role]['0:'+index]=v.map(n=>clamp(n,-6,6));}
    root.addEventListener('input',event=>{
      const t=event.target,key=t.dataset.control;
      if(key?.startsWith('score-'))scores[+key.slice(6)]=+t.value;
      else if(key==='multiplier')multiplier=+t.value;
      else if(key==='offset')state.positionOffset=+t.value;
      else if(t.dataset.coordinate!==undefined&&t.value!==''&&Number.isFinite(+t.value)){const role=type==='geometry'?'q':'v',index=type==='geometry'?2:selected,v=result.heads[0][role][index].slice();v[+t.dataset.coordinate]=+t.value;moveVector(role,index,v);}
      else return;render();
    });
    root.addEventListener('change',event=>{const t=event.target;if(t.dataset.control==='scale')scaled=t.checked;else if(t.dataset.control==='position')state.position=t.value;else return;render();});
    root.addEventListener('click',event=>{
      const b=event.target.closest('[data-action],[data-select],[data-query],[data-head]');if(!b)return;
      if(b.dataset.action==='reset')resetState();else if(b.dataset.action==='sum')showSum=!showSum;else if(b.dataset.select!==undefined)selected=+b.dataset.select;else if(b.dataset.query!==undefined)state.query=+b.dataset.query;else if(b.dataset.head!==undefined)head=+b.dataset.head;else return;render();
      if(b.dataset.select!==undefined&&b.tagName.toLowerCase()==='g')visual.querySelector(`[data-select="${selected}"]`)?.focus({preventScroll:true});
    });
    visual.addEventListener('pointerdown',event=>{
      const target=event.target.closest('[data-drag]');if(!target||!plot)return;
      const role=target.dataset.drag,index=role==='q'?2:+target.dataset.index;
      if(role==='v')selected=index;
      drag={role,index,plot,rect:visual.querySelector('svg').getBoundingClientRect()};
      visual.setPointerCapture(event.pointerId);event.preventDefault();
    });
    visual.addEventListener('pointermove',event=>{if(!drag)return;const r=drag.rect,x=(event.clientX-r.left)*560/r.width,y=(event.clientY-r.top)*310/r.height;moveVector(drag.role,drag.index,drag.plot.from(clamp(x,45,515),clamp(y,30,267)));render();});
    const finishDrag=()=>{if(drag){drag=null;render();}};
    ['pointerup','pointercancel','lostpointercapture'].forEach(name=>visual.addEventListener(name,finishDrag));
    root.addEventListener('keydown',event=>{
      const t=event.target;if(t.dataset.drag&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){
        event.preventDefault();const role=t.dataset.drag,index=role==='q'?2:+t.dataset.index,v=result.heads[0][role][index].slice(),axis=['ArrowLeft','ArrowRight'].includes(event.key)?0:1;v[axis]+=(['ArrowLeft','ArrowDown'].includes(event.key)?-1:1)*(event.shiftKey?.5:.1);if(role==='v')selected=index;moveVector(role,index,v);render();visual.querySelector(`[data-drag="${role}"]${role==='v'?`[data-index="${index}"]`:''}`)?.focus({preventScroll:true});
      } else if(t.tagName.toLowerCase()==='g'&&t.dataset.select!==undefined&&['Enter',' '].includes(event.key)){event.preventDefault();selected=+t.dataset.select;render();visual.querySelector(`[data-select="${selected}"]`)?.focus({preventScroll:true});}
    });
    $('.ai-details')?.addEventListener('toggle',renderParameters);
    mounted.set(root,()=>{drag=null;});render();
  }
  function init(){for(const [root,destroy] of mounted)if(!root.isConnected){destroy();mounted.delete(root);}document.querySelectorAll('.attention-inline[data-example]').forEach(mount);}
  window.AttentionInline={init};
  document.addEventListener('DOMContentLoaded',init);document.addEventListener('pjax:complete',init);window.addEventListener('attention-lab:core-ready',init);
  document.addEventListener('pjax:send',()=>{for(const destroy of mounted.values())destroy();});
  init();
})();
