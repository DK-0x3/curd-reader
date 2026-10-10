// Levels need not be consecutive: a real H1 -> H4 is still a child.
export function tocTree(items) {
  const roots = [], nodes = [], stack = [];
  for (const [key,item] of items.entries()) {
    const node = { key, item, level: Math.max(0, Number(item.level) || 0), children: [], parent: null, search: String(item.label || '').toLocaleLowerCase() };
    while (stack.length && stack[stack.length-1].level >= node.level) stack.pop();
    node.parent = stack[stack.length-1] || null;
    (node.parent ? node.parent.children : roots).push(node); stack.push(node); nodes.push(node);
  }
  return { roots, nodes };
}
export function mountTocTree(host, items, { state = { expanded: new Set(), filter: '' }, jump, measure, revision = () => 0, ready = () => true, currentItem = () => null, isOpen = () => true } = {}) {
  const doc = host.ownerDocument, win = doc.defaultView;
  const tree = tocTree(items), badges = new Map();
  let generation = 0, timer, openTimer, activeKey = null, disposed = false, intersection;
  const make = (parent,tag,cls,text) => { const el=doc.createElement(tag);el.className=cls;if(text!==undefined)el.textContent=text;parent.appendChild(el);return el; };
  const title = make(host,'div','er-pan-title','Содержание');
  const tools = make(host,'div','er-toc-tools');
  const collapse = make(tools,'button','er-toc-collapse','Свернуть всё');collapse.type='button';
  const search = make(tools,'input','er-toc-find-input');search.type='search';search.placeholder='Найти раздел…';search.setAttribute('aria-label','Найти раздел');search.value=state.filter;
  const list = make(host,'div','er-toc-list er-toc-tree');list.setAttribute('role','tree');
  title.setAttribute('aria-label',`Содержание: ${items.length} пунктов`);
  const pending = new Set();
  const scheduleMeasurements = () => {
    win.clearTimeout(timer);
    timer=win.setTimeout(() => {
      if(disposed)return;
      if(!ready()){timer=win.setTimeout(scheduleMeasurements,50);return;}
      let count=0;
      for(const row of pending) {
        pending.delete(row);
        if(!row.isConnected)continue;
        const { node, badge }=row._toc;
        const version=revision();let cached=badges.get(node.key);
        if(!cached || cached.version!==version) { cached={version,...measure?.(node.item)};badges.set(node.key,cached); }
        badge.textContent=[node.item.page ? `стр. ${node.item.page}` : '', Number.isInteger(cached.spread) ? `разв. ${cached.spread+1}` : ''].filter(Boolean).join(' · ');
        if(++count>=12)break;
      }
      if(pending.size)scheduleMeasurements();
    },0);
  };
  if(win.IntersectionObserver)intersection=new win.IntersectionObserver(entries=>{ for(const entry of entries)if(entry.isIntersecting)pending.add(entry.target);scheduleMeasurements(); });
  const render = ({ anchorKey, focusToggle = false, revealKey } = {}) => {
    const savedScroll = host.scrollTop;
    const oldRows = [...list.children].filter(row=>row._toc);
    const existing = new Map(oldRows.map(row=>[row._toc.node.key,row]));
    const anchor = oldRows.find(row=>row._toc.node.key===anchorKey) || oldRows.find(row=>row.getBoundingClientRect().bottom > host.getBoundingClientRect().top + 60);
    const preservedKey = anchor?._toc.node.key;
    const preservedTop = anchor?.getBoundingClientRect().top;
    // Keep the scroll extent while rows are rebuilt in batches. Removing the
    // children must not let the browser clamp scrollTop to zero.
    list.style.minHeight = `${list.getBoundingClientRect().height}px`;
    const token=++generation;intersection?.disconnect();pending.clear();
    for(const child of [...list.children])if(!child._toc)child.remove();
    const filter=state.filter.toLocaleLowerCase().trim(), matches=new Set();
    if(filter)for(const node of [...tree.nodes].reverse())if(node.search.includes(filter) || node.children.some(child=>matches.has(child.key)))matches.add(node.key);
    const visible=[];
    const visit=(nodes,depth=0)=>{ for(const node of nodes) { if(filter&&!matches.has(node.key))continue;visible.push({node,depth});if(filter||state.expanded.has(node.key))visit(node.children,depth+1); } };
    visit(tree.roots);
    const visibleKeys=new Set(visible.map(entry=>entry.node.key));
    if(!visible.length)make(list,'div','er-toc-empty',filter ? 'Ничего не найдено' : 'В книге нет оглавления');
    let offset=0;
    const append=()=>{
      if(disposed||token!==generation)return;
      for(let end=Math.min(offset+60,visible.length);offset<end;offset++) {
        const {node,depth}=visible[offset];
        const reused = existing.get(node.key);
        const row=reused || make(list,'div','er-toc-item er-toc-tree-item');row.style.setProperty('--er-toc-depth',String(depth));row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(depth+1));
        row.classList.toggle('active',node.key===activeKey);if(node.key===activeKey)row.setAttribute('aria-current','location');else row.removeAttribute('aria-current');
        const open=!!filter||state.expanded.has(node.key);
        if(!reused) {
        if(node.children.length) {row.setAttribute('aria-expanded',String(open));const toggle=make(row,'button','er-toc-toggle',open?'▾':'▸');toggle.type='button';toggle.setAttribute('aria-label',`${open?'Свернуть':'Развернуть'}: ${node.item.label}`);toggle.addEventListener('click',()=>{if(state.expanded.has(node.key))state.expanded.delete(node.key);else state.expanded.add(node.key);render({anchorKey:node.key,focusToggle:true});});}
        else make(row,'span','er-toc-toggle-spacer');
        const link=make(row,'button','er-toc-link');link.type='button';make(link,'span','er-toc-label',node.item.label);const badge=make(link,'span','er-toc-where',node.item.page ? `стр. ${node.item.page}` : '');
        link.addEventListener('click',()=>jump?.(node.item));row._toc={node,badge};
        }
        if(node.children.length){row.setAttribute('aria-expanded',String(open));const toggle=row.querySelector('.er-toc-toggle');toggle.textContent=open?'▾':'▸';toggle.setAttribute('aria-label',`${open?'Свернуть':'Развернуть'}: ${node.item.label}`);}
        if(list.children[offset]!==row)list.insertBefore(row,list.children[offset] || null);
        if(intersection)intersection.observe(row);else pending.add(row);
      }
      if(pending.size)scheduleMeasurements();
      if(offset<visible.length)win.setTimeout(append,0);
      else {
        for(const row of [...list.children])if(row._toc&&!visibleKeys.has(row._toc.node.key))row.remove();
        list.style.removeProperty('min-height');
        const rows = [...list.children];
        const target = rows.find(row=>row._toc?.node.key === (revealKey ?? preservedKey));
        if(revealKey !== undefined && target) {
          const panel = host.getBoundingClientRect(), rect = target.getBoundingClientRect();
          host.scrollTop = Math.max(0, host.scrollTop + rect.top-panel.top - Math.max(64,(host.clientHeight-rect.height)/2));
        } else {
          host.scrollTop = savedScroll;
          if(target && preservedTop !== undefined)host.scrollTop += target.getBoundingClientRect().top-preservedTop;
          if(focusToggle)target?.querySelector('.er-toc-toggle')?.focus({preventScroll:true});
        }
      }
    };
    append();
  };
  let searchTimer;
  search.addEventListener('input',()=>{state.filter=search.value;win.clearTimeout(searchTimer);searchTimer=win.setTimeout(render,120);});
  collapse.addEventListener('click',()=>{state.expanded.clear();state.filter='';search.value='';render();});
  const open = () => {
    win.clearTimeout(openTimer);
    if(disposed || !isOpen())return;
    if(!ready()){openTimer=win.setTimeout(open,50);return;}
    const item=currentItem();
    const active=tree.nodes.find(node=>node.item===item);
    activeKey=active?.key ?? null;
    if(active){for(let parent=active.parent;parent;parent=parent.parent)state.expanded.add(parent.key);}
    // Opening always reveals the reading position, even after a prior search.
    state.filter='';search.value='';
    render(active ? {revealKey:active.key} : {});
  };
  render();
  return { render, open, dispose(){disposed=true;generation++;win.clearTimeout(timer);win.clearTimeout(openTimer);win.clearTimeout(searchTimer);intersection?.disconnect();pending.clear();}, state };
}
