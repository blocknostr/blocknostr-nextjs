import React, { useEffect, useRef, useState } from "react";
import kaboom, { KaboomCtx, GameObj, Vec2 } from "kaboom";

const GAME_WIDTH = 900;
const GAME_HEIGHT = 600;

const RELAYS = ["wss://relay.damus.io", "wss://nostr-pub.wellorder.net"];
const GAME_TAG = "blockwarriors";
const PLAYER_KIND = 30001;
const CHAT_KIND = 30002;
const CHAT_TAG = "blockwarriorsChat";

declare global {
    interface Window {
        __kaboom?: KaboomCtx;
    }
}

const BlockWarriorsGame: React.FC = () => {
    const canvasRef = useRef<HTMLDivElement>(null);
    // --- UI/game state ---
    const [score, setScore] = useState(0);
    const [lives, setLives] = useState(3);
    const [level, setLevel] = useState(1);
    const [kills, setKills] = useState(0);
    const [weapon, setWeapon] = useState("Basic");
    const [gameOver, setGameOver] = useState(false);
    const [paused, setPaused] = useState(false);
    const [showChat, setShowChat] = useState(false);
    // Multiplayer/chat state (future)
    const [others, setOthers] = useState<Record<string, any>>({});
    const [chatLog, setChatLog] = useState<{ pubkey: string; content: string; }[]>([]);
    const [chatInput, setChatInput] = useState("");

    // --- Responsive layout: track window size ---
    const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({ width: GAME_WIDTH, height: GAME_HEIGHT });
    useEffect(() => {
        function handleResize() {
            const minW = 900 + 320 + 48; // canvas + right panel + margin
            const minH = 600;
            setContainerSize({
                width: Math.max(window.innerWidth, minW),
                height: Math.max(window.innerHeight, minH)
            });
        }
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    useEffect(() => {
        if (!canvasRef.current) return;
        // Clean up any previous kaboom instance
        if (window.__kaboom) {
            ["enemy1", "enemy2", "boss", "bullet", "tank", "power-shield", "power-bomb", "bg", "ui"].forEach(tag => {
                window.__kaboom!.get(tag).forEach(obj => obj.destroy());
            });
            window.__kaboom = undefined;
        }
        // Init kaboom
        const k = kaboom({
            global: false,
            width: GAME_WIDTH,
            height: GAME_HEIGHT,
            root: canvasRef.current,
        });
        k.setBackground(k.rgb(0, 0, 0));
        window.__kaboom = k;
        const {
            loadRoot, loadSprite, add, sprite, pos, scale,
            text, onUpdate, onKeyPress, onKeyDown, time, destroy,
            width: W, height: H, rand,
        } = k;
        // Load open source assets
        loadRoot("https://kaboomjs.com/sprites/");
        loadSprite("tank", "bean.png");
        loadSprite("bullet", "coin.png");
        loadSprite("enemy1", "spike.png");
        loadSprite("enemy2", "ghosty.png");
        loadSprite("boss", "portal.png");
        loadSprite("power-shield", "coin.png");
        loadSprite("power-bomb", "portal.png");
        loadSprite("bg", "grass.png", { sliceX: 6, sliceY: 6 });
        // Background & UI
        // Add more level detail: tiled grass, some static obstacles, and a border
        const { rect, rgb, outline } = k;
        for (let x = 0; x < W(); x += 96) {
            for (let y = 0; y < H(); y += 96) {
                add([
                    sprite("bg"), pos(x, y), scale(1.5), { layer: "bg" }
                ]);
            }
        }
        // Add border
        add([rect(W(), 8), pos(0, 0), { color: rgb(0, 200, 0) }, { layer: "bg" }]);
        add([rect(W(), 8), pos(0, H() - 8), { color: rgb(0, 200, 0) }, { layer: "bg" }]);
        add([rect(8, H()), pos(0, 0), { color: rgb(0, 200, 0) }, { layer: "bg" }]);
        add([rect(8, H()), pos(W() - 8, 0), { color: rgb(0, 200, 0) }, { layer: "bg" }]);
        // Add some static obstacles
        for (let i = 0; i < 6; i++) {
            add([
                sprite("enemy1"), pos(rand(100, W() - 100), rand(150, H() - 200)), scale(1.2), { color: rgb(80, 80, 80) }, { layer: "bg" } // gray rocks
            ]);
        }
        // Player entity
        const player = add([
            sprite("tank"), pos(W() / 2, H() - 80), { origin: "center" }, { layer: "game" },
            { tag: "tank" },
            { bullets: [] as { x: number, y: number, vx: number, vy: number }[], weapon: 1, lastShot: 0, kills: 0, level: 1, lives: 3, shielded: false }
        ]);
        // --- Sync kaboom state to React state ---
        function syncStats() {
            setLevel(player.level);
            setLives(player.lives);
            setKills(player.kills);
            setWeapon(player.weapon === 1 ? "Basic" : player.weapon === 2 ? "Spread" : "Laser");
        }
        onUpdate(() => {
            syncStats();
        });
        // Enemy & wave spawner
        let spawnInt = 1, spawnTimer = 0; // spawnInt was 2, now 1 for faster waves
        function checkLevel() {
            const th = player.level * 3; // level up faster (was *5)
            if (player.kills >= th) {
                player.level++;
                spawnInt = Math.max(0.3, spawnInt - 0.2); // minimum interval, faster
                player.kills = 0;
            }
        }
        onUpdate(() => {
            if (paused) return;
            spawnTimer += k.dt();
            if (spawnTimer >= spawnInt) {
                spawnTimer = 0;
                const isBoss = player.level >= 5 && rand() < 0.1;
                const id = isBoss ? "boss" : (rand() < 0.7 ? "enemy1" : "enemy2");
                const hp = isBoss ? 5 : (id === "enemy2" ? 2 : 1);
                const e = add([
                    sprite(id), pos(rand(50, W() - 50), -50),
                    { origin: "center" }, { layer: "game" }, { tag: id }, { vy: rand(180, 320), hp } // vy was 50-150, now 180-320
                ]);
                e.onUpdate(() => {
                    if (paused) return;
                    e.move(0, e.vy * k.dt());
                    if (e.pos.y > H() + 50) destroy(e);
                });
            }
        });
        // Power-up spawner
        let puTimer = 0;
        onUpdate(() => {
            if (paused) return;
            puTimer += k.dt();
            if (puTimer > 6) { // was 10, now 6 for more frequent powerups
                puTimer = 0;
                const kind = rand() < 0.5 ? "power-shield" : "power-bomb";
                const pu = add([
                    sprite(kind), pos(rand(50, W() - 50), -50),
                    { origin: "center" }, { layer: "game" }, { tag: kind }, { kind, vy: 180 } // powerup falls faster
                ]);
                pu.onUpdate(() => {
                    if (paused) return;
                    pu.move(0, 180 * k.dt()); // was 100, now 180
                    if (pu.pos.y > H() + 50) destroy(pu);
                });
            }
        });
        onKeyDown("left", () => { if (!paused) player.move(-900 * k.dt(), 0); });
        onKeyDown("right", () => { if (!paused) player.move(900 * k.dt(), 0); });
        onKeyDown("up", () => { if (!paused) player.move(0, -900 * k.dt()); });
        onKeyDown("down", () => { if (!paused) player.move(0, 900 * k.dt()); });
        onKeyPress("1", () => { if (!paused) { player.weapon = 1; } });
        onKeyPress("2", () => { if (!paused) { player.weapon = 2; } });
        onKeyPress("3", () => { if (!paused) { player.weapon = 3; } });
        function spawnBullet(x: number, y: number, vx: number, vy: number) {
            const b = add([sprite("bullet"), pos(x, y), { origin: "center" }, { layer: "game" }, { tag: "bullet" }, { vx, vy }]);
            player.bullets.push({ x, y, vx, vy });
            b.onUpdate(() => { if (!paused) b.move(vx * k.dt() * 4, vy * k.dt() * 4); }); // bullet speed quadrupled
        }
        onKeyPress("space", () => {
            if (paused) return;
            const now = time();
            const rate = player.weapon === 3 ? 0.1 : player.weapon === 2 ? 0.35 : 0.25; // all fire rates faster
            if (now - player.lastShot < rate) return;
            player.lastShot = now;
            const { x, y } = player.pos as Vec2;
            if (player.weapon === 1) spawnBullet(x, y, 0, -800); // was -400, now -800
            else if (player.weapon === 2) [-0.2, 0, 0.2].forEach(a => {
                spawnBullet(x, y, Math.sin(a) * 800, -Math.cos(a) * 800); // was 400, now 800
            });
            else spawnBullet(x, y, 0, -1200); // was -600, now -1200
        });
        // Collisions & game-over
        // Fix enemy death: ensure enemy hp is set and decremented, and destroy on hit
        k.onCollide("enemy1", "bullet", (e, b) => {
            destroy(b);
            if (typeof e.hp !== "number") e.hp = 1;
            e.hp!--;
            if (e.hp <= 0) {
                destroy(e);
                player.kills++;
                checkLevel();
            }
        });
        k.onCollide("enemy2", "bullet", (e, b) => {
            destroy(b);
            if (typeof e.hp !== "number") e.hp = 2;
            e.hp!--;
            if (e.hp <= 0) {
                destroy(e);
                player.kills++;
                checkLevel();
            }
        });
        k.onCollide("boss", "bullet", (e, b) => {
            destroy(b);
            if (typeof e.hp !== "number") e.hp = 5;
            e.hp!--;
            if (e.hp <= 0) {
                destroy(e);
                player.kills++;
                checkLevel();
            }
        });
        k.onCollide("enemy1", "tank", (e) => hitPlayer(e));
        k.onCollide("enemy2", "tank", (e) => hitPlayer(e));
        k.onCollide("boss", "tank", (e) => hitPlayer(e));
        k.onCollide("power-shield", "tank", (pu) => {
            player.shielded = true;
            setTimeout(() => {
                player.shielded = false;
            }, 5000);
            destroy(pu);
        });
        k.onCollide("power-bomb", "tank", (pu) => {
            ["enemy1", "enemy2", "boss"].forEach(tag => {
                k.get(tag).forEach(e => destroy(e));
            });
            destroy(pu);
        });
        function hitPlayer(e: GameObj) {
            if (!player.shielded) {
                destroy(e);
                player.lives--;
                if (player.lives <= 0) {
                    setGameOver(true);
                    setPaused(true);
                }
            }
        }
        // Sync kaboom state to React state
        onUpdate(() => {
            setLevel(player.level);
            setLives(player.lives);
            setKills(player.kills);
            setWeapon(player.weapon === 1 ? "Basic" : player.weapon === 2 ? "Spread" : "Laser");
        });
        // --- React UI Layout ---
        return () => {
            ["enemy1", "enemy2", "boss", "bullet", "tank", "power-shield", "power-bomb", "bg", "ui"].forEach(tag => {
                k.get(tag).forEach(obj => obj.destroy());
            });
            window.__kaboom = undefined;
        };
    }, [paused]);
    // --- React UI Layout ---
    return (
        <div className="flex w-full h-full bg-black" style={{ minHeight: 600, minWidth: 900 }}>
            {/* Left: Game Canvas */}
            <div className="relative flex-shrink-0" style={{ width: 900, height: 600, background: "#111", borderRadius: 16, overflow: "hidden", boxShadow: "0 0 24px #000a" }}>
                <button
                    className="absolute top-4 left-4 px-4 py-2 bg-gray-900 text-green-400 border border-green-400 rounded hover:bg-green-900 z-10"
                    onClick={() => window.location.href = "/games"}
                >
                    ← Back to Games
                </button>
                <div ref={canvasRef} className="w-full h-full" />
                {/* Game Over Overlay */}
                {gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black bg-opacity-80 z-20">
                        <div className="text-4xl font-bold text-red-400 mb-4">Game Over</div>
                        <button
                            className="px-6 py-2 bg-green-600 text-white rounded text-lg font-semibold shadow hover:bg-green-700"
                            onClick={() => {
                                setGameOver(false);
                                setPaused(false);
                                setLevel(1);
                                setLives(3);
                                setKills(0);
                                setWeapon("Basic");
                            }}
                        >Restart</button>
                    </div>
                )}
            </div>
            {/* Right: Stats, Instructions, Chat */}
            <div className="flex flex-col ml-8 mt-2 w-72 min-w-[260px] max-w-[320px]">
                <div className="bg-gray-900 bg-opacity-90 rounded-lg border border-green-400 p-4 mb-4">
                    <div className="text-green-400 text-2xl font-bold mb-2">BlockWarriors</div>
                    <div className="text-white text-base font-semibold mb-1">Controls:</div>
                    <div className="text-gray-200 text-sm mb-2 whitespace-pre-line">
                        Move: Arrow Keys{"\n"}
                        Shoot: Space{"\n"}
                        Switch Weapon: 1/2/3{"\n"}
                        Collect Powerups{"\n"}
                        Survive & Score!
                    </div>
                    <div className="text-yellow-300 text-xs mb-2">Tip: Enemies drop faster each level!</div>
                    <div className="border-t border-green-700 my-2" />
                    <div className="text-cyan-300 text-base font-mono">
                        Level: {level}<br />
                        Lives: {lives}<br />
                        Kills: {kills}<br />
                        Weapon: {weapon}
                    </div>
                </div>
                {/* Multiplayer Scoreboard (future) */}
                <div className="bg-gray-900 bg-opacity-90 rounded-lg border border-gray-700 p-3 mb-4">
                    <div className="text-white font-bold mb-1">Scoreboard</div>
                    {Object.entries(others).length === 0 ? (
                        <div className="text-gray-400 text-xs">No other players yet.</div>
                    ) : (
                        Object.entries(others).map(([pk, st]) => (
                            <div key={pk} className="text-gray-200 text-xs">
                                {pk.slice(0, 6)}… — L{st.level} K{st.kills}
                            </div>
                        ))
                    )}
                </div>
                {/* Chat (future) */}
                <div className="bg-gray-900 bg-opacity-90 rounded-lg border border-gray-700 p-3 flex flex-col">
                    <div className="text-white font-bold mb-1">Chat</div>
                    <div className="flex-1 overflow-y-auto max-h-32 mb-2 text-gray-200 text-xs">
                        {chatLog.length === 0 ? <div className="text-gray-500">No messages yet.</div> :
                            chatLog.map((m, i) => (
                                <div key={i}><span className="font-bold">{m.pubkey.slice(0, 6)}…:</span> {m.content}</div>
                            ))}
                    </div>
                    <div className="flex">
                        <input
                            type="text"
                            className="flex-1 p-1 rounded text-black text-xs"
                            placeholder="Type to chat…"
                            value={chatInput}
                            onChange={e => setChatInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && setChatInput("") /* sendChat() future */}
                        />
                        <button
                            className="ml-2 px-2 py-1 bg-blue-600 text-white rounded text-xs"
                            onClick={() => setChatInput("") /* sendChat() future */}
                        >Send</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BlockWarriorsGame;
