import React, { useRef, useEffect, useState, useCallback } from 'react';
import { GameState, Player, Platform, Coin, Particle, Enemy, Laser } from '../types';
import { 
    GRAVITY, JUMP_FORCE, MOVE_SPEED, FRICTION, 
    CANVAS_WIDTH, CANVAS_HEIGHT, 
    COLOR_BRAND_ORANGE, COLOR_BG, COLOR_WHITE,
    ENEMY_SPEED, LASER_SPEED, LASER_COOLDOWN,
    START_Y
} from '../constants';

const YomirgoGame: React.FC = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<GameState>(GameState.MENU);
    const [score, setScore] = useState(0);
    const [currentPrice, setCurrentPrice] = useState(0); 
    const [isTransitioning, setIsTransitioning] = useState(false); 
    const requestRef = useRef<number>(0);
    
    const playerRef = useRef<Player>({ x: 300, y: START_Y, w: 40, h: 32, vx: 0, vy: 0, isGrounded: false, facingRight: true, invulnerable: 0 });
    const keysRef = useRef<{ [key: string]: boolean }>({});
    const cameraYRef = useRef(START_Y - CANVAS_HEIGHT + 200);
    
    const platformsRef = useRef<Platform[]>([]);
    const coinsRef = useRef<Coin[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const enemiesRef = useRef<Enemy[]>([]);
    const lasersRef = useRef<Laser[]>([]);
    const lastGeneratedYRef = useRef(START_Y);

    const textSequenceIndexRef = useRef(0);
    const specialTexts = ["TO THE MOON", "YOMIRGO", "AI MEGA PLANT"];

    const generateMoreLevel = useCallback((targetY: number) => {
        const platforms: Platform[] = [];
        const coins: Coin[] = [];
        const enemies: Enemy[] = [];
        let currentY = lastGeneratedYRef.current;
        const isHardMode = (START_Y - currentY) * 0.0001 > 0.1;

        while (currentY > targetY) {
            const isTextRow = Math.random() > 0.85; 
            if (isTextRow) {
                const text = specialTexts[textSequenceIndexRef.current % specialTexts.length];
                textSequenceIndexRef.current++;
                const w = 150;
                const x = Math.random() * (CANVAS_WIDTH - w);
                platforms.push({ id: `p-${currentY}-${Math.random()}`, x, y: currentY, w, h: 30, type: 'text', text: text, color: COLOR_WHITE });
                const enemyProb = isHardMode ? 0.4 : 0.65;
                if (Math.random() > enemyProb) {
                    enemies.push({ 
                        id: Math.random(), type: 'robot', x, y: currentY - 40, w: 30, h: 30, 
                        vx: ENEMY_SPEED * (isHardMode ? 1.8 : 1.2) * (1 + Math.abs(currentY / 15000)), 
                        patrolStart: x, patrolEnd: x + w, dead: false, deadTimer: 0, 
                        shootTimer: Math.random() * (isHardMode ? 50 : 100) 
                    });
                }
            } else {
                const w = 85 + Math.random() * 65;
                const x = Math.random() * (CANVAS_WIDTH - w);
                platforms.push({ id: `p-${currentY}-${Math.random()}`, x, y: currentY, w, h: 20, type: 'block', color: Math.random() > 0.85 ? COLOR_BRAND_ORANGE : '#444' });
                if (Math.random() < 0.05) {
                    enemies.push({ 
                        id: Math.random(), type: 'robot', x, y: currentY - 40, w: 30, h: 30, 
                        vx: ENEMY_SPEED * (isHardMode ? 1.5 : 1.0), 
                        patrolStart: x, patrolEnd: x + w, dead: false, deadTimer: 0, 
                        shootTimer: Math.random() * 120 
                    });
                }
                if (Math.random() > 0.3) {
                    coins.push({ id: Math.random(), x: x + w/2, y: currentY - 30, size: 10, collected: false, rotationOffset: Math.random() });
                }
            }
            const gapMin = isHardMode ? 100 : 90;
            const gapMax = isHardMode ? 80 : 60;
            currentY -= (gapMin + Math.random() * gapMax); 
        }
        platformsRef.current = [...platformsRef.current, ...platforms];
        coinsRef.current = [...coinsRef.current, ...coins];
        enemiesRef.current = [...enemiesRef.current, ...enemies];
        lastGeneratedYRef.current = currentY;
        if (platformsRef.current.length > 100) {
            platformsRef.current = platformsRef.current.slice(-60);
            coinsRef.current = coinsRef.current.slice(-60);
            enemiesRef.current = enemiesRef.current.slice(-40);
        }
    }, []);

    const resetGame = () => {
        const floorY = START_Y + 220;
        const firstBrickY = START_Y + 60; 
        playerRef.current = { x: CANVAS_WIDTH/2 - 20, y: floorY - 32, w: 40, h: 32, vx: 0, vy: 0, isGrounded: true, facingRight: true, invulnerable: 0 };
        cameraYRef.current = floorY - CANVAS_HEIGHT + 120;
        platformsRef.current = [
            { id: 'floor', x: 0, y: floorY, w: CANVAS_WIDTH, h: 40, type: 'floor', color: COLOR_BRAND_ORANGE },
            { id: 'start-brick', x: CANVAS_WIDTH / 2 + 40, y: firstBrickY, w: 110, h: 20, type: 'block', color: '#444' }
        ];
        lastGeneratedYRef.current = firstBrickY - 140; 
        textSequenceIndexRef.current = 0; 
        coinsRef.current = []; enemiesRef.current = []; lasersRef.current = []; particlesRef.current = [];
        generateMoreLevel(START_Y - 3500);
        setScore(0); setCurrentPrice(0); setGameState(GameState.PLAYING);
    };

    const handleInitializePump = () => {
        setIsTransitioning(true);
        setTimeout(() => { resetGame(); setIsTransitioning(false); }, 800);
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            keysRef.current[e.code] = true;
            if(["ArrowUp","ArrowDown","ArrowLeft","ArrowRight", "Space"].indexOf(e.code) > -1) e.preventDefault();
        };
        const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.code] = false; };
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
    }, []);

    const update = () => {
        if (gameState !== GameState.PLAYING) return;
        const player = playerRef.current;
        const keys = keysRef.current;
        if (keys['ArrowLeft'] || keys['KeyA']) { player.vx -= 1.2; player.facingRight = false; }
        if (keys['ArrowRight'] || keys['KeyD']) { player.vx += 1.2; player.facingRight = true; }
        player.vx = Math.max(Math.min(player.vx, MOVE_SPEED), -MOVE_SPEED);
        if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW']) && player.isGrounded) {
            player.vy = JUMP_FORCE * 1.15; 
            player.isGrounded = false;
            createParticles(player.x + player.w/2, player.y + player.h, COLOR_BRAND_ORANGE, 5, 'explosion');
        }
        player.vy += GRAVITY * 1.3; player.vx *= (FRICTION * 0.98); player.x += player.vx; player.y += player.vy;
        if (player.x < -player.w) player.x = CANVAS_WIDTH;
        if (player.x > CANVAS_WIDTH) player.x = -player.w;
        player.isGrounded = false;
        const deathBuffer = currentPrice > 0.1 ? 250 : 350;
        if (player.y > cameraYRef.current + CANVAS_HEIGHT + deathBuffer) setGameState(GameState.GAME_OVER);
        platformsRef.current.forEach(plat => {
            if (player.vy > 0 && player.x + player.w > plat.x + 5 && player.x < plat.x + plat.w - 5 && player.y + player.h > plat.y && player.y + player.h < plat.y + plat.h + player.vy + 2) {
                player.y = plat.y - player.h; player.vy = 0; player.isGrounded = true;
            }
        });
        const targetCamY = player.y - CANVAS_HEIGHT * 0.6;
        cameraYRef.current += (targetCamY - cameraYRef.current) * 0.15;
        if (player.y < lastGeneratedYRef.current + 2000) generateMoreLevel(lastGeneratedYRef.current - 3000);
        const baseLevel = START_Y + 188; 
        const heightDiff = Math.max(0, baseLevel - player.y);
        setCurrentPrice(heightDiff * 0.0001);
        enemiesRef.current.forEach(enemy => {
            if (enemy.dead) { enemy.deadTimer--; return; }
            enemy.x += enemy.vx;
            if (enemy.x <= enemy.patrolStart || enemy.x + enemy.w >= enemy.patrolEnd) enemy.vx *= -1;
            enemy.shootTimer--;
            if (enemy.shootTimer <= 0) {
                const dir = enemy.vx > 0 ? 1 : -1;
                lasersRef.current.push({ id: Math.random(), x: enemy.x + (dir > 0 ? enemy.w : 0), y: enemy.y + enemy.h/2 - 2, w: 20, h: 4, vx: dir * LASER_SPEED, life: 60 });
                enemy.shootTimer = currentPrice > 0.1 ? LASER_COOLDOWN * 0.6 : LASER_COOLDOWN;
            }
            if (checkRectCollide(player, enemy)) {
                if (player.vy > 0 && player.y + player.h < enemy.y + enemy.h * 0.6) {
                    enemy.dead = true; enemy.deadTimer = 20; player.vy = JUMP_FORCE * 0.6; setScore(s => s + 500);
                    createParticles(enemy.x, enemy.y, COLOR_WHITE, 10, 'explosion');
                } else if (player.invulnerable <= 0) setGameState(GameState.GAME_OVER);
            }
        });
        for (let i = lasersRef.current.length - 1; i >= 0; i--) {
            const l = lasersRef.current[i]; l.x += l.vx; l.life--;
            if (l.life <= 0 || l.x < 0 || l.x > CANVAS_WIDTH) { lasersRef.current.splice(i, 1); continue; }
            if (player.invulnerable <= 0 && checkRectCollide(player, l)) setGameState(GameState.GAME_OVER);
        }
        coinsRef.current.forEach(coin => { if (!coin.collected && Math.sqrt(Math.pow((player.x + player.w/2) - coin.x, 2) + Math.pow((player.y + player.h/2) - coin.y, 2)) < 20) { coin.collected = true; setScore(prev => prev + 100); createParticles(coin.x, coin.y, COLOR_BRAND_ORANGE, 6, 'sparkle'); } });
        for (let i = particlesRef.current.length - 1; i >= 0; i--) { const p = particlesRef.current[i]; p.x += p.vx; p.y += p.vy; p.life -= 0.05; if (p.life <= 0) particlesRef.current.splice(i, 1); }
    };

    const checkRectCollide = (r1: Player, r2: any) => (r1.x < r2.x + r2.w && r1.x + r1.w > r2.x && r1.y < r2.y + r2.h && r1.y + r1.h > r2.y);
    const createParticles = (x: number, y: number, color: string, count: number, type: string) => { for (let i = 0; i < count; i++) particlesRef.current.push({ id: Math.random(), x, y, vx: (Math.random() - 0.5) * 6, vy: (Math.random() - 0.5) * 6, life: 1.0, color, size: Math.random() * 4 + 2, type: type as any }); };
    const draw3DLetter = (ctx: CanvasRenderingContext2D, char: string, x: number, y: number, size: number) => { ctx.save(); ctx.fillStyle = '#A34800'; ctx.font = `900 ${size}px monospace`; ctx.fillText(char, x + 2, y + 2); ctx.fillStyle = COLOR_BRAND_ORANGE; ctx.fillText(char, x, y); ctx.strokeStyle = 'white'; ctx.lineWidth = 1; ctx.strokeText(char, x, y); ctx.restore(); };

    const draw = (ctx: CanvasRenderingContext2D) => {
        ctx.fillStyle = COLOR_BG; ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        if (gameState === GameState.MENU) return;
        ctx.save(); ctx.translate(0, -Math.floor(cameraYRef.current));
        platformsRef.current.forEach(plat => {
            ctx.fillStyle = plat.color || '#444'; ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
            if (plat.type === 'text' && plat.text) { 
                ctx.fillStyle = '#000'; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; 
                ctx.fillText(plat.text, plat.x + plat.w/2, plat.y + plat.h/2); 
            }
        });
        enemiesRef.current.forEach(enemy => { if (!enemy.dead) { ctx.fillStyle = '#555'; ctx.fillRect(enemy.x, enemy.y, enemy.w, enemy.h); ctx.fillStyle = 'red'; ctx.fillRect(enemy.vx > 0 ? enemy.x + enemy.w - 10 : enemy.x + 6, enemy.y + 8, 4, 4); } });
        lasersRef.current.forEach(l => { ctx.fillStyle = '#FF0000'; ctx.fillRect(l.x, l.y, l.w, l.h); });
        const now = Date.now();
        coinsRef.current.forEach(coin => { if (!coin.collected) { ctx.save(); const bounceOffset = Math.sin(now / 200) * 4; ctx.shadowBlur = 12; ctx.shadowColor = COLOR_BRAND_ORANGE; ctx.fillStyle = COLOR_BRAND_ORANGE; const cx = coin.x; const cy = coin.y + bounceOffset; const size = 8; ctx.beginPath(); ctx.moveTo(cx, cy - size); ctx.lineTo(cx + size, cy); ctx.lineTo(cx, cy + size); ctx.lineTo(cx - size, cy); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#FFF'; ctx.globalAlpha = 0.6; ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3); ctx.restore(); } });
        const p = playerRef.current; draw3DLetter(ctx, '$', p.x - 4, p.y + 22, 18); draw3DLetter(ctx, 'Y', p.x + 8, p.y + 22, 18); draw3DLetter(ctx, 'G', p.x + 20, p.y + 22, 18); draw3DLetter(ctx, 'O', p.x + 32, p.y + 22, 18);
        particlesRef.current.forEach(part => { ctx.fillStyle = part.color; ctx.globalAlpha = part.life; ctx.fillRect(part.x, part.y, part.size, part.size); });
        ctx.globalAlpha = 1.0; ctx.restore();
    };

    const loop = () => { if (gameState === GameState.PLAYING) update(); if (canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); if (ctx) draw(ctx); } requestRef.current = requestAnimationFrame(loop); };
    useEffect(() => { requestRef.current = requestAnimationFrame(loop); return () => cancelAnimationFrame(requestRef.current); }, [gameState]);

    const KeyCap = ({ label, size = 'w-8 sm:w-10', delay = '0s' }: any) => (
        <div style={{ animationDelay: delay }} className={`${size} h-8 sm:h-10 border-2 border-[#E57D25]/30 rounded flex items-center justify-center text-[#E57D25]/40 font-bold font-mono text-xs sm:text-base transition-all animate-key-glow`}>{label}</div>
    );

    return (
        <div className="relative rounded-xl overflow-hidden shadow-[0_0_20px_rgba(229,125,37,0.3)] border-4 border-[#333] bg-black w-full max-w-[600px] h-auto aspect-[3/4] sm:aspect-auto">
            <style>
                {`
                @keyframes keyGlow { 0%, 100% { border-color: rgba(229, 125, 37, 0.3); color: rgba(229, 125, 37, 0.4); box-shadow: none; } 15% { border-color: rgba(229, 125, 37, 1); color: rgba(229, 125, 37, 1); box-shadow: 0 0 15px rgba(229, 125, 37, 0.8), inset 0 0 5px rgba(229, 125, 37, 0.5); } 30%, 100% { border-color: rgba(229, 125, 37, 0.3); color: rgba(229, 125, 37, 0.4); box-shadow: none; } }
                .animate-key-glow { animation: keyGlow 2.5s infinite ease-in-out; }
                @keyframes pumpFlash { 0% { opacity: 0; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); text-shadow: 0 0 25px rgba(229,125,37,0.9), 0 0 10px rgba(229,125,37,1); } 100% { opacity: 0; transform: scale(1.3); } }
                .pump-transition { animation: pumpFlash 0.8s ease-out forwards; }
                `}
            </style>
            <canvas ref={canvasRef} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="block w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
            
            {(gameState === GameState.PLAYING || gameState === GameState.GAME_OVER) && (
                <div className="absolute inset-x-0 top-2 px-2 sm:px-4 flex items-center justify-between pointer-events-none z-10 h-12 sm:h-16">
                    <div className="flex-1 flex flex-col font-mono font-bold whitespace-nowrap" style={{ fontSize: 'clamp(8px, 2.5vw, 14px)', color: '#9ca3af' }}>
                        <div>$YGO PRICE: ${currentPrice.toFixed(4)}</div>
                        <div>SCORE: {score}</div>
                    </div>
                    <div className="flex-[2] flex justify-center">
                        <h1 className="font-black text-[#E57D25] tracking-tight whitespace-nowrap" style={{ fontFamily: 'monospace', textShadow: '2px 2px 0px #A34800', fontSize: 'clamp(14px, 5vw, 36px)' }}>$YGO PUMP</h1>
                    </div>
                    <div className="flex-1 flex justify-end">
                        <img src="/logo.png" alt="Logo" className="h-3 sm:h-6 w-auto object-contain opacity-70" />
                    </div>
                </div>
            )}

            {gameState === GameState.MENU && (
                <div className="absolute inset-0 bg-black flex flex-col items-center justify-between text-white text-center p-4 sm:p-6 z-25 overflow-hidden">
                    <div className="mt-2 sm:mt-8 flex justify-center"><img src="/logo.png" alt="Logo" className="h-6 sm:h-8 w-auto object-contain" /></div>
                    <div className="mt-4 sm:mt-10"><h1 className="text-[10vw] sm:text-7xl font-black text-[#E57D25] tracking-tight leading-none" style={{ fontFamily: 'monospace', textShadow: '4px 4px 0px #A34800' }}>$YGO PUMP</h1></div>
                    <div className="flex-1 flex flex-col items-center justify-center w-full">
                        <h2 className="text-xl sm:text-3xl font-bold text-white mb-2 sm:mb-4 tracking-widest uppercase">MARKET CLIMBER</h2>
                        <div className="mb-4 sm:mb-8 text-xs sm:text-base text-gray-300 font-mono tracking-widest leading-tight"><p>RISE WITH THE MARKET</p><p>AVOID DUMP BOTS & LASERS</p></div>
                        <button onClick={handleInitializePump} className="bg-[#E57D25] hover:bg-[#d46b1a] text-black font-bold py-3 sm:py-5 px-10 sm:px-16 rounded-none border-2 border-white transition-all text-lg sm:text-2xl font-mono animate-pulse touch-manipulation">INITIALIZE PUMP</button>
                        <div className="mt-6 sm:mt-14 scale-75 sm:scale-100 flex flex-col items-center gap-2 sm:gap-4">
                            <div className="flex flex-col items-center gap-1"><KeyCap label="W" delay="0s" /><div className="flex gap-1"><KeyCap label="A" delay="0.4s" /><div className="w-8 sm:w-10 h-8 sm:h-10" /><KeyCap label="D" delay="0.8s" /></div></div>
                            <KeyCap label="SPACE" size="w-40 sm:w-56" delay="1.2s" />
                        </div>
                    </div>
                    <div className="mb-2 opacity-40 text-[9px] sm:text-[11px] font-mono tracking-widest uppercase">AI MEGA PLANT</div>
                </div>
            )}

            {isTransitioning && (
                <div className="absolute inset-0 bg-black z-50 flex items-center justify-center overflow-hidden">
                    <div className="pump-transition text-4xl sm:text-5xl font-black text-[#E57D25] font-mono tracking-tighter">PUMPING!!!</div>
                </div>
            )}

            {gameState === GameState.GAME_OVER && (
                <div className="absolute inset-0 bg-black/85 flex flex-col justify-center items-center text-white z-20 p-4">
                    <h2 className="text-3xl sm:text-4xl font-bold mb-4 sm:mb-6 text-red-500 font-mono tracking-tighter uppercase">HOLD IT</h2>
                    <div className="flex flex-col items-center gap-2 sm:gap-4 mb-8 sm:mb-10">
                        <p className="text-xl sm:text-3xl font-mono uppercase">Max Price: <span className="text-[#E57D25]">${currentPrice.toFixed(4)}</span></p>
                        <p className="text-xl sm:text-3xl font-mono uppercase">Max Score: <span className="text-[#E57D25]">{score}</span></p>
                    </div>
                    <button onClick={resetGame} className="bg-white text-black hover:bg-gray-200 font-bold py-3 px-8 font-mono uppercase touch-manipulation">REBOUND</button>
                </div>
            )}
        </div>
    );
};

export default YomirgoGame;