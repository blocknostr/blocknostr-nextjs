import React, { useState, useEffect, useRef, useCallback } from 'react';

const ROWS = 20;
const COLS = 10;
const BLOCK_SIZE = 24;
const BOARD_WIDTH = COLS * BLOCK_SIZE;
const BOARD_HEIGHT = ROWS * BLOCK_SIZE;

const SHAPES = [
    { shape: [[1, 1, 1, 1]], color: 'bg-cyan-400', glow: 'shadow-cyan-400/60' },
    { shape: [[1, 1], [1, 1]], color: 'bg-yellow-300', glow: 'shadow-yellow-300/60' },
    { shape: [[0, 1, 1], [1, 1, 0]], color: 'bg-green-400', glow: 'shadow-green-400/60' },
    { shape: [[1, 1, 0], [0, 1, 1]], color: 'bg-pink-400', glow: 'shadow-pink-400/60' },
    { shape: [[1, 0, 0], [1, 1, 1]], color: 'bg-blue-400', glow: 'shadow-blue-400/60' },
    { shape: [[0, 0, 1], [1, 1, 1]], color: 'bg-orange-400', glow: 'shadow-orange-400/60' },
    { shape: [[0, 1, 0], [1, 1, 1]], color: 'bg-purple-400', glow: 'shadow-purple-400/60' },
];

function rotate(matrix: number[][]): number[][] {
    return matrix[0].map((_, i) => matrix.map(row => row[i]).reverse());
}

function randomPiece() {
    const idx = Math.floor(Math.random() * SHAPES.length);
    const { shape, color, glow } = SHAPES[idx];
    return { shape, color, glow, row: 0, col: Math.floor((COLS - shape[0].length) / 2) };
}

function getEmptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(''));
}

const TETRIS_LEADERBOARD_KIND = 30009;

interface TetrisGameProps {
    previewMode?: boolean;
    onScoreSubmit?: (score: number) => void;
    gameId?: string;
}

const TetrisGame: React.FC<TetrisGameProps> = ({ previewMode, onScoreSubmit, gameId = 'tetris' }) => {
    const [grid, setGrid] = useState(getEmptyGrid());
    const [piece, setPiece] = useState(randomPiece());
    const [nextPiece, setNextPiece] = useState(randomPiece());
    const [score, setScore] = useState(0);
    const [lines, setLines] = useState(0);
    const [level, setLevel] = useState(1);
    const [gameOver, setGameOver] = useState(false);
    const [paused, setPaused] = useState(false);
    const [hasFocus, setHasFocus] = useState(false);
    const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'success' | 'error' | 'pending'>('idle');

    const boardRef = useRef<HTMLDivElement>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Prevent page scroll when game is focused
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!hasFocus) return;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' ', 'Space'].includes(e.key)) {
                e.preventDefault();
            }
        };
        window.addEventListener('keydown', handleKeyDown, { passive: false });
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [hasFocus]);

    // Focus trap
    useEffect(() => {
        if (!previewMode && boardRef.current) {
            boardRef.current.tabIndex = 0;
            boardRef.current.focus();
        }
    }, [previewMode]);

    // Collision detection
    const collision = useCallback((shape: number[][], r: number, c: number) => {
        return shape.some((row, i) => row.some((cell, j) => {
            if (cell) {
                const x = r + i;
                const y = c + j;
                if (x < 0 || x >= ROWS || y < 0 || y >= COLS) return true;
                if (grid[x][y]) return true;
            }
            return false;
        }));
    }, [grid]);

    // Merge piece into grid
    const mergePiece = useCallback((pieceObj = piece) => {
        setGrid(prev => {
            const newGrid = prev.map(row => [...row]);
            pieceObj.shape.forEach((row, i) => row.forEach((cell, j) => {
                if (cell) newGrid[pieceObj.row + i][pieceObj.col + j] = pieceObj.color;
            }));
            return newGrid;
        });
    }, [piece]);

    // Clear full rows
    const clearFullRows = useCallback((oldGrid: string[][]) => {
        const newGrid = oldGrid.filter(row => !row.every(cell => cell));
        const cleared = ROWS - newGrid.length;
        if (cleared > 0) {
            setScore(s => s + cleared * 100 * level);
            setLines(l => l + cleared);
            if ((lines + cleared) % 10 === 0) setLevel(lv => lv + 1);
        }
        const emptyRows = Array.from({ length: cleared }, () => Array(COLS).fill(''));
        return [...emptyRows, ...newGrid];
    }, [level, lines]);

    // Game loop
    useEffect(() => {
        if (previewMode || gameOver || paused) return;
        if (intervalRef.current) clearInterval(intervalRef.current);
        intervalRef.current = setInterval(() => {
            setPiece(prev => {
                if (collision(prev.shape, prev.row + 1, prev.col)) {
                    if (prev.row === 0) {
                        setGameOver(true);
                        return prev;
                    } else {
                        mergePiece(prev);
                        setPiece(nextPiece);
                        setNextPiece(randomPiece());
                        setGrid(g => clearFullRows(g));
                        return randomPiece(); // Will be replaced immediately
                    }
                } else {
                    return { ...prev, row: prev.row + 1 };
                }
            });
        }, Math.max(100, 600 - level * 50));
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, [collision, mergePiece, clearFullRows, gameOver, paused, previewMode, nextPiece, level]);

    // Keyboard controls
    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
        if (previewMode || !hasFocus || gameOver || paused) return;
        let moved = null;
        if (e.key === 'ArrowLeft') moved = { row: piece.row, col: piece.col - 1 };
        if (e.key === 'ArrowRight') moved = { row: piece.row, col: piece.col + 1 };
        if (e.key === 'ArrowDown') moved = { row: piece.row + 1, col: piece.col };
        if (moved && !collision(piece.shape, moved.row, moved.col)) {
            setPiece(prev => ({ ...prev, row: moved.row, col: moved.col }));
        }
        if (e.key === 'ArrowUp') {
            const rotated = rotate(piece.shape);
            if (!collision(rotated, piece.row, piece.col)) {
                setPiece(prev => ({ ...prev, shape: rotated }));
            }
        }
        if (e.key === ' ' || e.key === 'Spacebar') {
            // Hard drop
            let dropRow = piece.row;
            while (!collision(piece.shape, dropRow + 1, piece.col)) {
                dropRow++;
            }
            setPiece(prev => ({ ...prev, row: dropRow }));
        }
        if (e.key === 'p' || e.key === 'P') setPaused(p => !p);
        if (e.key === 'r' || e.key === 'R') resetGame();
    }, [piece, collision, previewMode, hasFocus, gameOver, paused]);

    // Reset game
    const resetGame = () => {
        setGrid(getEmptyGrid());
        setPiece(randomPiece());
        setNextPiece(randomPiece());
        setScore(0);
        setLines(0);
        setLevel(1);
        setGameOver(false);
        setPaused(false);
    };

    // Prepare display grid
    const displayGrid = grid.map(row => [...row]);
    if (!previewMode) {
        piece.shape.forEach((row, i) => row.forEach((cell, j) => {
            if (cell && displayGrid[piece.row + i] && displayGrid[piece.row + i][piece.col + j] === '') {
                displayGrid[piece.row + i][piece.col + j] = piece.color;
            }
        }));
    }

    // Next piece preview
    const renderNextPiece = () => {
        // Only support up to 4x4 for next piece preview (all Tetris shapes fit)
        const rows = nextPiece.shape.length;
        const cols = nextPiece.shape[0].length;
        const gridRows = rows === 4 ? 'grid-rows-4' : rows === 3 ? 'grid-rows-3' : rows === 2 ? 'grid-rows-2' : 'grid-rows-1';
        const gridCols = cols === 4 ? 'grid-cols-4' : cols === 3 ? 'grid-cols-3' : cols === 2 ? 'grid-cols-2' : 'grid-cols-1';
        return (
            <div className="flex flex-col items-center">
                <span className="text-xs text-cyan-400 mb-1">Next</span>
                <div className={`grid ${gridRows} ${gridCols}`}>
                    {nextPiece.shape.map((row, i) => row.map((cell, j) => (
                        <div
                            key={`${i}-${j}`}
                            className={`w-4 h-4 m-[1px] rounded ${cell ? `${nextPiece.color} ${nextPiece.glow}` : 'bg-[#23283a]'}`}
                        />
                    )))}
                </div>
            </div>
        );
    };

    // On game over, submit score to leaderboard
    useEffect(() => {
        if (gameOver && !previewMode && score > 0 && onScoreSubmit) {
            onScoreSubmit(score);
        }
    }, [gameOver, previewMode, score, onScoreSubmit]);

    // Early return for preview mode
    if (previewMode) {
        const previewGrid = Array.from({ length: 8 }, () => Array(6).fill(''));
        const previewPiece = randomPiece();
        previewPiece.row = 2;
        previewPiece.col = 2;
        previewPiece.shape.forEach((row, i) => row.forEach((cell, j) => {
            if (cell && previewGrid[previewPiece.row + i] && previewGrid[previewPiece.row + i][previewPiece.col + j] === '') {
                previewGrid[previewPiece.row + i][previewPiece.col + j] = previewPiece.color;
            }
        }));
        return (
            <div className="flex flex-col items-center w-full">
                <div className="relative rounded-lg shadow-lg p-1 bg-[#181c24] border-2 border-cyan-700/60 w-24 h-32">
                    <div className="relative grid grid-rows-8 grid-cols-6 gap-[2px] w-full h-full z-10">
                        {previewGrid.map((row, i) => row.map((cellColor, j) => (
                            <div
                                key={`${i}-${j}`}
                                className={`w-4 h-4 rounded-[2px] ${cellColor ? `${cellColor}` : 'bg-[#23283a]'} border border-gray-900/80`}
                            />
                        )))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div
            ref={boardRef}
            tabIndex={0}
            className="outline-none focus:ring-2 focus:ring-cyan-500 flex flex-col items-center w-full select-none min-w-[240px] min-h-[540px]"
            onFocus={() => setHasFocus(true)}
            onBlur={() => setHasFocus(false)}
            onKeyDown={handleKeyDown}
        >
            {/* Score/Stats */}
            <div className="flex w-full justify-between items-center mb-2 px-1">
                <div className="flex flex-col items-start gap-1">
                    <span className="text-cyan-400 font-bold text-xs">Score</span>
                    <span className="text-cyan-200 font-mono text-base">{score}</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                    <span className="text-cyan-400 font-bold text-xs">Level</span>
                    <span className="text-cyan-200 font-mono text-base">{level}</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                    <span className="text-cyan-400 font-bold text-xs">Lines</span>
                    <span className="text-cyan-200 font-mono text-base">{lines}</span>
                </div>
            </div>
            <div className="flex w-full justify-between items-center mb-2 px-1">
                {renderNextPiece()}
                <div className="flex flex-col items-end gap-1">
                    <span className="text-cyan-400 font-bold text-xs">Controls</span>
                    <span className="text-gray-400 text-xs">← → ↓: Move</span>
                    <span className="text-gray-400 text-xs">↑: Rotate</span>
                    <span className="text-gray-400 text-xs">Space: Drop</span>
                    <span className="text-gray-400 text-xs">P: Pause</span>
                    <span className="text-gray-400 text-xs">R: Restart</span>
                </div>
            </div>
            {/* Game Board */}
            <div
                className="relative rounded-2xl shadow-2xl bg-[#181c24] border-2 border-cyan-700/60 overflow-hidden w-[240px] h-[480px]"
                onClick={() => boardRef.current && boardRef.current.focus()}
            >
                {/* Neon border glow */}
                <div className="absolute -inset-1 rounded-2xl pointer-events-none z-0 animate-pulse bg-gradient-to-br from-cyan-700/30 via-blue-700/10 to-purple-700/20 blur-xl" />
                {/* Faint grid overlay */}
                <div className="absolute inset-0 z-0 pointer-events-none">
                    <svg width="100%" height="100%" viewBox="0 0 240 480">
                        {[...Array(COLS - 1)].map((_, i) => (
                            <line key={i} x1={(i + 1) * BLOCK_SIZE} y1="0" x2={(i + 1) * BLOCK_SIZE} y2={BOARD_HEIGHT} stroke="#2dd4bf22" strokeWidth="1" />
                        ))}
                        {[...Array(ROWS - 1)].map((_, i) => (
                            <line key={i} y1={(i + 1) * BLOCK_SIZE} x1="0" y2={(i + 1) * BLOCK_SIZE} x2={BOARD_WIDTH} stroke="#2dd4bf22" strokeWidth="1" />
                        ))}
                    </svg>
                </div>
                <div className="relative grid grid-rows-20 grid-cols-10 w-full h-full">
                    {displayGrid.map((row, i) => row.map((cellColor, j) => (
                        <div
                            key={`${i}-${j}`}
                            className={`transition-all duration-100 w-6 h-6 rounded-[4px] border border-gray-900/80 ${cellColor ? `${cellColor} shadow-[0_0_12px_2px_rgba(34,211,238,0.18)]` : 'bg-[#23283a]'}`}
                        />
                    )))}
                </div>
                {gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 rounded-2xl z-20">
                        <p className="text-2xl font-bold text-red-400 mb-2 drop-shadow">Game Over</p>
                        <button onClick={resetGame} className="mt-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg shadow hover:from-cyan-600 hover:to-blue-700 transition">Restart</button>
                    </div>
                )}
                {paused && !gameOver && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-2xl z-20">
                        <p className="text-2xl font-bold text-cyan-300 mb-2 drop-shadow">Paused</p>
                        <button onClick={() => setPaused(false)} className="mt-2 px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold rounded-lg shadow hover:from-cyan-600 hover:to-blue-700 transition">Resume</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TetrisGame;
