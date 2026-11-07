const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function makeDrawer(isMobile) {
  const document = {activeElement:null, body:{style:{overflow:'auto'}}, documentElement:{style:{setProperty(){}}}, listeners:{}, addEventListener(k,fn){this.listeners[k]=fn;}, querySelector(){return {offsetHeight:72};}};
  class Element {
    constructor(){this.hidden=true;this.attrs={};this.listeners={};this.classes=new Set();this.classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name)};}
    setAttribute(k,v){this.attrs[k]=v;}
    removeAttribute(k){delete this.attrs[k];}
    addEventListener(k,fn){this.listeners[k]=fn;}
    focus(){document.activeElement=this;}
    getClientRects(){return [1];}
    click(target=this){this.listeners.click({target,button:0});}
  }
  const panel=new Element(),toggle=new Element(),backdrop=new Element(),link=new Element();
  panel.querySelectorAll=()=>[toggle,link];
  const media={matches:isMobile, addEventListener(k,fn){this.change=fn;}};
  const window={matchMedia:()=>media,addEventListener(){}};
  const context=vm.createContext({document,window,location:{hash:'#/'}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/course-drawer.js'),'utf8'),context);
  const drawer=window.initCourseDrawer(panel,toggle,backdrop);
  const key=(key,shiftKey=false)=>{let prevented=false;document.listeners.keydown({key,shiftKey,preventDefault(){prevented=true;}});return prevented;};
  return {document,panel,toggle,backdrop,link,media,drawer,key};
}

test('панель на ПК раскрывается в потоке, не блокируя страницу',()=>{
 const {document,panel,toggle,backdrop,key}=makeDrawer(false);
 toggle.click();assert.equal(panel.classes.has('is-expanded'),true);assert.equal(backdrop.hidden,true);assert.equal(document.body.style.overflow,'auto');assert.equal(toggle.attrs['aria-expanded'],'true');
 assert.equal(key('Tab'),false);assert.equal(key('Escape'),true);assert.equal(panel.classes.has('is-expanded'),false);assert.equal(document.activeElement,toggle);
});
test('мобильная панель удерживает фокус и закрывается по фону',()=>{
 const {document,panel,toggle,backdrop,link,key}=makeDrawer(true);toggle.focus();toggle.click();
 assert.equal(panel.classes.has('is-expanded'),true);assert.equal(backdrop.hidden,false);assert.equal(document.body.style.overflow,'hidden');assert.equal(panel.attrs['aria-modal'],'true');
 assert.equal(key('Tab',true),true);assert.equal(document.activeElement,link);assert.equal(key('Tab'),true);assert.equal(document.activeElement,toggle);
 backdrop.click();assert.equal(backdrop.hidden,true);assert.equal(document.body.style.overflow,'auto');assert.equal(document.activeElement,toggle);assert.equal(panel.attrs['aria-modal'],undefined);
});
test('выбор пункта сворачивает панель только на телефоне',()=>{
 for(const mobile of [false,true]) {const {panel,toggle}=makeDrawer(mobile);toggle.click();panel.click({closest:selector=>selector==='a[href^="#/"]'?{}:null});assert.equal(panel.classes.has('is-expanded'),!mobile);}
});
test('при смене размера возвращается прокрутка и панель сворачивается',()=>{
 const {document,panel,toggle,media}=makeDrawer(true);toggle.click();media.matches=false;media.change();assert.equal(panel.classes.has('is-expanded'),false);assert.equal(document.body.style.overflow,'auto');
});
