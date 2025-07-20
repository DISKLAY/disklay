// Звуки
const scream = document.getElementById('scream');
const stickwar = document.getElementById('stickwar');
const dnd = document.getElementById('dnd');
const smeshariki = document.getElementById('smeshariki');
const flash = document.getElementById('flash');
const mainTitle = document.getElementById('main-title');
const krosh = document.getElementById('krosh');

let scaryMode = false;

// Вспышки и тряска
function scaryFlash() {
    flash.style.opacity = 1;
    setTimeout(() => { flash.style.opacity = 0; }, 100 + Math.random()*200);
    document.body.classList.add('shake');
    setTimeout(() => document.body.classList.remove('shake'), 500);
}

// Поворот экрана
function rotateScreen() {
    document.body.style.transform = `rotate(${Math.random() > 0.5 ? 10 : -10}deg)`;
    setTimeout(() => document.body.style.transform = '', 400);
}

// Захват курсора
function grabCursor() {
    document.body.style.cursor = 'none';
    setTimeout(() => document.body.style.cursor = '', 2000);
}

// Случайные цвета
function randomColors() {
    document.body.style.background = `rgb(${rand255()},${rand255()},${rand255()})`;
    mainTitle.style.color = `rgb(${rand255()},${rand255()},${rand255()})`;
    setTimeout(() => {
        document.body.style.background = '#000';
        mainTitle.style.color = '#fff';
    }, 300);
}
function rand255() { return Math.floor(Math.random()*256); }

// Случайные страшные события
function scaryEvent() {
    const events = [
        () => { scream.currentTime = 0; scream.play(); scaryFlash(); },
        () => { stickwar.currentTime = 0; stickwar.play(); rotateScreen(); },
        () => { dnd.currentTime = 0; dnd.play(); randomColors(); },
        () => { smeshariki.currentTime = 0; smeshariki.play(); grabCursor(); },
        () => { scaryFlash(); rotateScreen(); },
        () => { scaryFlash(); randomColors(); },
        () => { scaryFlash(); grabCursor(); },
        () => { scaryFlash(); showKrosh(); }
    ];
    events[Math.floor(Math.random()*events.length)]();
}

// Крош появляется и убегает
function showKrosh() {
    krosh.style.left = '-200px';
    krosh.style.top = `${Math.random()*80+10}vh`;
    krosh.style.opacity = 1;
    setTimeout(() => {
        krosh.style.left = '110vw';
        setTimeout(() => { krosh.style.left = '-200px'; }, 1000);
    }, 100);
}

// Кнопка "НЕ НАЖИМАЙ!"
document.getElementById('scaryBtn').addEventListener('click', () => {
    scaryMode = true;
    scaryEvent();
    setInterval(scaryEvent, 2000 + Math.random()*2000);
    mainTitle.textContent = "ТЕПЕРЬ ТЫ В ИГРЕ!";
    document.getElementById('scaryBtn').style.display = 'none';
});

// Убегающая кнопка
const runBtn = document.getElementById('runBtn');
runBtn.addEventListener('mouseover', moveRunBtn);
function moveRunBtn() {
    runBtn.style.left = `${Math.random()*80+10}vw`;
    runBtn.style.top = `${Math.random()*80+10}vh`;
    scaryFlash();
    stickwar.currentTime = 0; stickwar.play();
}

// Курсор превращается в d20
document.body.addEventListener('mousemove', function(e){
    if (scaryMode && Math.random() < 0.1) {
        document.body.style.cursor = 'url("https://upload.wikimedia.org/wikipedia/commons/2/2c/20_sided_dice.png"), auto';
        setTimeout(()=>{document.body.style.cursor='';}, 1000);
    }
});

// Иногда появляется надпись из Stick War
setInterval(()=>{
    if (scaryMode && Math.random()<0.2) {
        let el = document.createElement('div');
        el.textContent = "MINERS, FORWARD!";
        el.style.position = 'fixed';
        el.style.left = `${Math.random()*80+10}vw`;
        el.style.top = `${Math.random()*80+10}vh`;
        el.style.fontSize = '2em';
        el.style.color = '#ff0';
        el.style.textShadow = '0 0 10px #000, 0 0 20px #f00';
        el.style.zIndex = 9999;
        document.body.appendChild(el);
        setTimeout(()=>el.remove(), 1500);
    }
}, 1500);

// Иногда появляется d20 с провалом
setInterval(()=>{
    if (scaryMode && Math.random()<0.15) {
        let el = document.createElement('div');
        el.textContent = "d20: 1 (Epic Fail!)";
        el.style.position = 'fixed';
        el.style.left = `${Math.random()*80+10}vw`;
        el.style.top = `${Math.random()*80+10}vh`;
        el.style.fontSize = '2.5em';
        el.style.color = '#f00';
        el.style.textShadow = '0 0 10px #fff, 0 0 20px #000';
        el.style.zIndex = 9999;
        document.body.appendChild(el);
        setTimeout(()=>el.remove(), 1200);
    }
}, 2000);

// Иногда появляется Крош и кричит
setInterval(()=>{
    if (scaryMode && Math.random()<0.1) {
        showKrosh();
        smeshariki.currentTime = 0; smeshariki.play();
    }
}, 3000);
