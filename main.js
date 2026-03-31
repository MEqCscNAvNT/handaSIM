document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('simCanvas');
    const ctx = canvas.getContext('2d');
    const statusEl = document.getElementById('status');
    const scoreContent = document.getElementById('scoreContent');
    const resetBtn = document.getElementById('resetBtn');

    const btnIron = document.getElementById('btnTouchIron');
    const btnSolder = document.getElementById('btnTouchSolder');

    const GROUND_Y = 360; 
    const LEAD_X = 400;   
    const LEAD_WIDTH = 32; 
    const LEAD_HEIGHT = 40; 
    const PAD_EXPOSED_LENGTH = 80; 
    const PAD_HALF_WIDTH = 16 + PAD_EXPOSED_LENGTH; 
    
    const MELTING_POINT = 217; 
    const IDEAL_TEMP_MIN = 230; 
    const WETTING_TEMP = 230; 
    const IDEAL_TEMP_MAX = 310; 
    const OVERHEAT_LIMIT = 325;
    const MAX_IRON_TEMP = 330; 
    const AMBIENT_TEMP = 25;

    const TGT_IRON_X = LEAD_X + LEAD_WIDTH/2 + 8;
    const TGT_IRON_Y = GROUND_Y - 6;
    const TGT_WIRE_X = LEAD_X - LEAD_WIDTH/2;
    const TGT_WIRE_Y = GROUND_Y;
    const actionGroup = document.getElementById('actionGroup');

    let state = {
        temp: AMBIENT_TEMP,
        ironDown: false, solderDown: false, finished: false,
        ironX: TGT_IRON_X + 150, ironY: TGT_IRON_Y - 150,
        wireX: TGT_WIRE_X - 150, wireY: TGT_WIRE_Y - 150,
        amount: 0, flow: 0, 
        isBall: false, isStuck: false, earlyFeed: false, lastFeed: 0,
        feedTime: 0, isOutOfSolder: false, isOverheated: false 
    };

    let particles = [];
    class Particle {
        constructor(x, y) {
            this.x = x + (Math.random() - 0.5) * 10;
            this.y = y;
            this.size = Math.random() * 6 + 4;
            this.speedY = Math.random() * -2 - 0.5;
            this.opacity = 0.6;
        }
        update() {
            this.y += this.speedY;
            this.size += 0.2;
            this.opacity -= 0.02;
        }
        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, this.opacity)})`;
            ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = `rgba(93, 64, 55, ${Math.max(0, this.opacity)})`;
            ctx.lineWidth = 2; ctx.stroke();
        }
    }

    function resetSim() {
        state = { 
            temp: AMBIENT_TEMP, ironDown: false, solderDown: false, finished: false, 
            ironX: TGT_IRON_X + 150, ironY: TGT_IRON_Y - 150, wireX: TGT_WIRE_X - 150, wireY: TGT_WIRE_Y - 150, 
            amount: 0, flow: 0, isBall: false, isStuck: false, earlyFeed: false, lastFeed: 0, feedTime: 0, isOutOfSolder: false, isOverheated: false 
        };
        particles = [];
        updateStatus("準備完了", "#e1f5fe", "#5d4037");
        scoreContent.innerHTML = '<div style="text-align:center; color:#90a4ae; font-weight:900; padding: 20px 0;">スコア待機中...</div>';
        
        resetBtn.style.display = 'none';
        actionGroup.style.display = 'flex'; // 【追加】操作ボタンを表示
        lastTime = 0;
    }

    function updateStatus(text, bg, color) {
        statusEl.innerText = text;
        statusEl.style.background = bg;
        statusEl.style.color = color;
    }

    const startIron = (e) => { 
        if(e) e.preventDefault(); 
        if(!state.finished) { state.ironDown = true; updateStatus("ｱﾌﾟﾛｰﾁ", "#ffe0b2", "#5d4037"); } 
    };
    
    const stopIron = (e) => { 
        if(e) e.preventDefault(); 
        if(state.ironDown && !state.finished) {
            if (state.ironX > TGT_IRON_X + 5 && state.temp < 30 && state.amount === 0) {
                state.ironDown = false; updateStatus("準備完了", "#e1f5fe", "#5d4037"); return;
            }
            if (state.solderDown && state.amount > 0) state.isStuck = true; 
            finishSim(); 
        }
        state.ironDown = false; 
    };

    const startSolder = (e) => { 
        if(e) e.preventDefault(); 
        if(!state.finished && state.ironDown && !state.isOutOfSolder) { 
            state.solderDown = true; 
            if (state.temp < WETTING_TEMP) state.earlyFeed = true;
        } 
    };
    
    const stopSolder = (e) => { 
        if(e) e.preventDefault(); 
        if(state.solderDown) state.lastFeed = Date.now(); 
        state.solderDown = false; 
        if (state.ironDown && !state.finished && state.ironX <= TGT_IRON_X + 5) updateStatus("なじませ中", "#c8e6c9", "#5d4037");
    };

    window.addEventListener('keydown', (e) => { if(e.code === 'Space' && !state.finished) startSolder(e); });
    window.addEventListener('keyup', (e) => { if(e.code === 'Space') stopSolder(e); });
    
    btnIron.addEventListener('mousedown', startIron); window.addEventListener('mouseup', stopIron);
    btnSolder.addEventListener('mousedown', startSolder); btnSolder.addEventListener('mouseup', stopSolder);
    
    btnIron.addEventListener('touchstart', startIron, {passive: false}); btnIron.addEventListener('touchend', stopIron, {passive: false});
    btnSolder.addEventListener('touchstart', startSolder, {passive: false}); btnSolder.addEventListener('touchend', stopSolder, {passive: false});
    
    canvas.addEventListener('mousedown', (e) => { if(e.button === 0) startSolder(e); if(e.button === 2) startIron(e); });
    canvas.addEventListener('mouseup', (e) => { if(e.button === 0) stopSolder(e); if(e.button === 2) stopIron(e); });
    canvas.addEventListener('contextmenu', e => e.preventDefault()); 
    resetBtn.addEventListener('click', resetSim);

    function finishSim() {
        state.finished = true; state.solderDown = false;
        if(state.isStuck) updateStatus("⚠ 固着", "#ffcdd2", "#c62828");
        else updateStatus("終了", "#f5f5f5", "#5d4037");
        
        calcScore();
        
        resetBtn.style.display = 'block';
        actionGroup.style.display = 'none'; // 【追加】操作ボタンを隠す
    }

    function calcScore() {
        let tScore = 0, sScore = 0, pScore = 30; 
        let tMsg = "", sMsg = "", pMsg = "正しい手順";

        if (state.temp < MELTING_POINT) { tScore = 0; tMsg = "加熱不足"; }
        else if (state.temp < IDEAL_TEMP_MIN) { tScore = 15; tMsg = "温度低め"; }
        else if (state.temp <= IDEAL_TEMP_MAX) { tScore = 30; tMsg = "適温！"; }
        else if (state.temp <= OVERHEAT_LIMIT) { tScore = 15; tMsg = "ｱﾂｽｷﾞ!"; }
        else { tScore = 5; tMsg = "オーバーヒート"; }

        if (state.isStuck) { pScore = 0; pMsg = "先こて離し(固着)"; sScore = 0; } 
        else if (state.earlyFeed) { pScore = 10; pMsg = "早すぎ供給"; }
        else if (state.isOutOfSolder) { pScore = 15; pMsg = "はんだ過多"; }

        if (!state.isStuck) {
            if (state.isBall) { sScore = 0; sMsg = "ボール(修復不可)"; }
            else if (state.amount < 15) { sScore = 0; sMsg = "はんだ不足"; }
            else if (state.flow < PAD_EXPOSED_LENGTH * 0.95) { sScore = 0; sMsg = `❌ なじみ不足（ランド未被覆）`; }
            else if (state.amount > 65) { sScore = 0; sMsg = `❌ 供給過多（ボール化）`; } 
            else if (state.amount > 55) { sScore = 15; sMsg = `⚠️ 供給過多（膨らみ気味）`; }
            else {
                if (state.amount <= 45) { sScore = 40; sMsg = `✅ 富士山型！（綺麗な内向きの弧）`; } 
                else { sScore = 30; sMsg = `✅ 良好（適量）`; }
            }
        } else { sMsg = "判定不能"; }

        let total = tScore + sScore + pScore;
        let color = total >= 80 ? "#4caf50" : (total >= 50 ? "#ff9800" : "#f44336"); 

        scoreContent.innerHTML = `
            <div class="score-row"><span>🌡️ 温度</span> <span style="color:${tScore===30?'#4caf50':'#f44336'}">${tScore===30?'✅':'❌'} ${tMsg}</span></div>
            <div class="score-row"><span>🛠️ 手順</span> <span style="color:${pScore>=25?'#4caf50':'#f44336'}">${pScore>=25?'✅':'❌'} ${pMsg}</span></div>
            <div class="score-row"><span>📐 形状</span> <span style="color:${sScore>=30?'#4caf50':'#f44336'}">${sScore>=30?'✅':'❌'} ${sMsg}</span></div>
            <div class="score-total" style="color:${color};">TOTAL: ${total}</div>
        `;
    }

    function drawVUMeter() {
        let cx = canvas.width / 2, cy = 130, r = 65;   
        ctx.save();
        ctx.beginPath(); ctx.rect(cx - r - 30, 0, (r + 30) * 2, cy); ctx.clip();
        ctx.beginPath(); ctx.arc(cx, cy, r + 20, Math.PI, Math.PI * 2); 
        ctx.fillStyle = "#ffffff"; ctx.fill();
        ctx.lineWidth = 6; ctx.strokeStyle = "#5d4037"; ctx.stroke();
        const t2a = (t) => Math.PI + (Math.min(Math.max(t, 0), 350) / 350) * Math.PI;
        ctx.lineWidth = 16; ctx.lineCap = "butt"; 
        ctx.beginPath(); ctx.arc(cx, cy, r, Math.PI, Math.PI * 2); ctx.strokeStyle = "#eeeeee"; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r, t2a(IDEAL_TEMP_MIN), t2a(IDEAL_TEMP_MAX)); ctx.strokeStyle = "#66bb6a"; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, r, t2a(OVERHEAT_LIMIT), t2a(350)); ctx.strokeStyle = "#ef5350"; ctx.stroke();
        ctx.lineWidth = 3; ctx.strokeStyle = "#5d4037"; ctx.lineCap = "round";
        for(let i=0; i<=7; i++) {
            let a = t2a(i * 50); 
            ctx.beginPath(); ctx.moveTo(cx + Math.cos(a)*(r-12), cy + Math.sin(a)*(r-20)); ctx.stroke();
        }
        let needleA = t2a(state.temp);
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(needleA)*(r-2), cy + Math.sin(needleA)*(r-2));
        ctx.lineWidth = 6; ctx.strokeStyle = "#5d4037"; ctx.stroke();
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(cx - r - 23, cy); ctx.lineTo(cx + r + 23, cy);
        ctx.lineWidth = 6; ctx.strokeStyle = "#5d4037"; ctx.lineCap = "round"; ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI*2); ctx.fillStyle = "#5d4037"; ctx.fill();
        ctx.font = "900 24px 'Quicksand', sans-serif"; ctx.textAlign = "center"; 
        ctx.fillText(Math.floor(state.temp) + "℃", cx, cy + 32);
    }

    const drawWithOutline = (fill) => {
        ctx.lineWidth = 6; ctx.strokeStyle = "#5d4037"; ctx.lineJoin = "round"; ctx.lineCap = "round"; ctx.stroke();
        if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    };

    let lastTime = 0;
    function update(currentTime) {
        if (!lastTime) lastTime = currentTime;
        let dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        if (state.temp >= OVERHEAT_LIMIT) state.isOverheated = true;

        if (state.ironDown && !state.finished && state.ironX <= TGT_IRON_X + 5) {
            if (statusEl.innerText !== "なじませ中" && !state.isOutOfSolder) {
                updateStatus(state.solderDown ? "供給中" : "加熱中", state.solderDown ? "#b2ebf2" : "#ffe0b2", "#5d4037");
            }
            let heatRate = state.temp < 200 ? 1.8 : 0.8;
            if (state.solderDown && state.temp > MELTING_POINT - 10 && !state.isOutOfSolder) heatRate = 0.3; 
            state.temp += (MAX_IRON_TEMP - state.temp) * heatRate * dt; 
        } else {
            state.temp = Math.max(AMBIENT_TEMP, state.temp - 50 * dt); 
        }

        let ease = 0.2;
        state.ironX += ((state.ironDown && !state.finished ? TGT_IRON_X : TGT_IRON_X + 150) - state.ironX) * ease;
        state.ironY += ((state.ironDown && !state.finished ? TGT_IRON_Y : TGT_IRON_Y - 150) - state.ironY) * ease;
        let wireActive = (!state.finished && (state.solderDown || state.isStuck) && !state.isOutOfSolder);
        state.wireX += ((wireActive ? TGT_WIRE_X : TGT_WIRE_X - 150) - state.wireX) * ease;
        state.wireY += ((wireActive ? TGT_WIRE_Y : TGT_WIRE_Y - 150) - state.wireY) * ease;

        if (state.ironDown && state.solderDown && !state.finished) {
            if (state.temp >= MELTING_POINT && !state.isOutOfSolder) {
                state.feedTime += dt;
                if (state.feedTime >= 2.0) {
                    state.isOutOfSolder = true;
                    updateStatus("はんだ過多", "#cfd8dc", "#455a64"); 
                } else {
                    state.amount += 45.0 * dt; 
                    let idealFact = Math.min(1.5, Math.max(1.0, (state.temp - MELTING_POINT) / (WETTING_TEMP - MELTING_POINT)));
                    if (state.earlyFeed && state.amount > 10 && state.flow < 5) state.isBall = true;
                    if (state.isBall) { 
                        state.flow = 2; updateStatus("弾かれています", "#ffcdd2", "#c62828"); 
                    } else { 
                        state.flow = Math.min(PAD_EXPOSED_LENGTH, state.flow + (40.0 * idealFact * dt)); 
                    }
                }
            }
        } else if (state.ironDown && !state.solderDown && !state.finished && state.amount > 0 && state.temp > MELTING_POINT) {
            let idealFact = Math.min(1.5, Math.max(1.0, (state.temp - MELTING_POINT) / (WETTING_TEMP - MELTING_POINT)));
            state.flow = Math.min(PAD_EXPOSED_LENGTH, state.flow + (20.0 * idealFact * dt));
        }

        let timeSinceFeed = Date.now() - state.lastFeed;
        if (state.temp > 90 && (state.solderDown || (!state.solderDown && timeSinceFeed < 1000 && state.amount > 0)) && !state.isBall && !state.finished && !state.isOutOfSolder) {
            if (Math.random() < 0.2) particles.push(new Particle(TGT_WIRE_X, TGT_WIRE_Y));
        }
        particles.forEach((p, i) => { p.update(); if(p.opacity <= 0) particles.splice(i, 1); });
        draw();
        requestAnimationFrame(update);
    }

    function draw() {
        ctx.fillStyle = "#fff6e5"; ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawVUMeter();

        ctx.beginPath(); ctx.rect(LEAD_X - LEAD_WIDTH/2, GROUND_Y - LEAD_HEIGHT, LEAD_WIDTH, 150); drawWithOutline("#cfd8dc");
        ctx.beginPath(); ctx.rect(-10, GROUND_Y, canvas.width + 20, canvas.height); drawWithOutline("#81c784");
        ctx.beginPath(); ctx.rect(LEAD_X - PAD_HALF_WIDTH, GROUND_Y, PAD_HALF_WIDTH * 2, 15); drawWithOutline("#f0a07c"); 

        particles.forEach(p => p.draw());

        if (state.amount > 1) {
            let isMelted = (!state.finished && state.temp > MELTING_POINT - 10);
            let baseW = state.flow; 
            let startLx = LEAD_X - LEAD_WIDTH/2 - baseW;
            let startRx = LEAD_X + LEAD_WIDTH/2 + baseW;
            let currentH = Math.min(state.amount, LEAD_HEIGHT); 
            let topY = GROUND_Y - currentH;

            let solderPath = new Path2D();
            if(state.flow < PAD_EXPOSED_LENGTH * 0.5 || state.isBall) {
                solderPath.ellipse(LEAD_X, GROUND_Y, baseW + LEAD_WIDTH/2, currentH, 0, Math.PI, Math.PI * 2);
            } else {
                // 【復旧】v31の綺麗な遷移ロジック
                let topLx = LEAD_X - LEAD_WIDTH/2;
                let topRx = LEAD_X + LEAD_WIDTH/2;
                let cxL, cyL, cxR, cyR;

                if (state.amount <= 45) { // 内向き弧
                    cxL = topLx; cyL = GROUND_Y;
                    cxR = topRx; cyR = GROUND_Y;
                } else if (state.amount <= 55) { // 直線への遷移
                    let t = (state.amount - 45) / 10; 
                    cxL = topLx + (((startLx + topLx) / 2) - topLx) * t;
                    cyL = GROUND_Y + (((GROUND_Y + topY) / 2) - GROUND_Y) * t;
                    cxR = topRx + (((startRx + topRx) / 2) - topRx) * t;
                    cyR = GROUND_Y + (((GROUND_Y + topY) / 2) - GROUND_Y) * t;
                } else { // 外向き（ボール化）
                    let over = state.amount - 55;
                    cxL = ((startLx + topLx) / 2) - over * 1.5; 
                    cyL = ((GROUND_Y + topY) / 2) - over * 0.8; 
                    cxR = ((startRx + topRx) / 2) + over * 1.5;
                    cyR = cyL;
                }

                solderPath.moveTo(startLx, GROUND_Y); 
                solderPath.quadraticCurveTo(cxL, cyL, topLx, topY); 
                solderPath.lineTo(topRx, topY);
                solderPath.quadraticCurveTo(cxR, cyR, startRx, GROUND_Y); 
            }
            
            ctx.lineWidth = 6; ctx.strokeStyle = "#5d4037"; ctx.lineJoin = "round"; ctx.lineCap = "round"; 
            ctx.stroke(solderPath);
            ctx.fillStyle = isMelted ? "#ffffff" : "#b0bec5"; 
            ctx.fill(solderPath);

            if (state.isOverheated) {
                ctx.save(); ctx.clip(solderPath); ctx.fillStyle = "rgba(62, 39, 35, 0.7)"; 
                const scorchDots = [[-10, 5, 3], [12, 8, 2.5], [-5, 18, 4], [22, 6, 2], [-20, 12, 2.5], [8, 25, 3], [-15, 28, 2], [18, 20, 3], [0, 12, 2]];
                scorchDots.forEach(d => {
                    if (d[1] < currentH + 10) { ctx.beginPath(); ctx.arc(LEAD_X + d[0], GROUND_Y - d[1], d[2], 0, Math.PI*2); ctx.fill(); }
                });
                ctx.restore();
            }

            if (isMelted && !state.isOverheated) {
                ctx.fillStyle = "rgba(255, 255, 255, 0.8)"; ctx.beginPath();
                let bulgeAmt = state.isBall ? 5 : (Math.max(0, state.amount - LEAD_HEIGHT) * 0.2);
                ctx.arc(LEAD_X - 12 - bulgeAmt, GROUND_Y - currentH*0.5, 4 + bulgeAmt, 0, Math.PI*2); ctx.fill();
            }
        }

        if (state.wireX > TGT_WIRE_X - 100 || state.isStuck) {
            ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.beginPath(); 
            let drawX = state.isStuck ? TGT_WIRE_X : state.wireX;
            let drawY = state.isStuck ? TGT_WIRE_Y : state.wireY;
            ctx.moveTo(drawX - 150, drawY - 150); ctx.lineTo(drawX, drawY); ctx.stroke();
            ctx.strokeStyle = "#cfd8dc"; ctx.lineWidth = 6; ctx.stroke();
        }

        if (state.ironX < TGT_IRON_X + 100) {
            ctx.save(); ctx.translate(state.ironX, state.ironY); ctx.rotate(-Math.PI / 4);
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, -12); ctx.lineTo(150, -12); ctx.lineTo(150, 8); ctx.lineTo(8, 8); ctx.closePath(); drawWithOutline("#ffb74d"); 
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(24, -12); ctx.lineTo(18, -2); ctx.closePath(); drawWithOutline("#cfd8dc"); 
            ctx.restore();
        }
    }
    resetSim();
    requestAnimationFrame(update); 
});