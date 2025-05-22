import React, { useState, useEffect, useRef } from 'react';
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardFooter,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface Stats {
    hunger: number;
    happiness: number;
    cleanliness: number;
    energy: number;
}

type AchievementKey =
    | 'first_feed'
    | 'first_cure'
    | 'survived_day'
    | 'max_happiness'
    | 'max_cleanliness';

const STORAGE_KEY = 'tamagotchiEnhanced';
const DECAY_INTERVAL = 10 * 1000;
const DECAY_AMOUNT = 5;

export default function Tamagotchi() {
    const [stats, setStats] = useState<Stats>({
        hunger: 50,
        happiness: 50,
        cleanliness: 50,
        energy: 50,
    });
    const [ageMs, setAgeMs] = useState(0);
    const [isSick, setIsSick] = useState(false);
    const [gameOver, setGameOver] = useState(false);
    const [achievements, setAchievements] = useState<Record<AchievementKey, boolean>>({
        first_feed: false,
        first_cure: false,
        survived_day: false,
        max_happiness: false,
        max_cleanliness: false,
    });

    const decayRef = useRef<number>();

    // Load state & request notifications
    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            setStats(data.stats);
            setAgeMs(data.ageMs);
            setIsSick(data.isSick);
            setAchievements(data.achievements || achievements);
        }
        if (Notification.permission !== 'granted') {
            Notification.requestPermission();
        }
    }, []);

    // Save & check game over
    useEffect(() => {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ stats, ageMs, isSick, achievements })
        );
        if (Object.values(stats).some((v) => v <= 0)) {
            clearInterval(decayRef.current);
            setGameOver(true);
            new Notification('💀 Your pet has passed away...', { silent: true });
        }
    }, [stats, ageMs, isSick, achievements]);

    // Decay stats & age
    useEffect(() => {
        decayRef.current = window.setInterval(() => {
            setStats((prev) => {
                const amt = isSick ? DECAY_AMOUNT * 2 : DECAY_AMOUNT;
                const next = {
                    hunger: Math.min(100, prev.hunger + amt),
                    happiness: Math.max(0, prev.happiness - amt),
                    cleanliness: Math.max(0, prev.cleanliness - amt),
                    energy: Math.max(0, prev.energy - amt),
                };
                // urgent
                if (next.hunger >= 80) new Notification('🍗 Your pet is very hungry!', { silent: true });
                if (next.happiness <= 20) new Notification('😢 Your pet is sad...', { silent: true });
                return next;
            });
            setAgeMs((prev) => prev + DECAY_INTERVAL);
        }, DECAY_INTERVAL);
        return () => clearInterval(decayRef.current);
    }, [isSick]);

    // Age
    const days = Math.floor(ageMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ageMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    // Sprite by evolution & mood
    let spriteUrl = 'https://kaboomjs.com/sprites/bean.png';
    if (days >= 2) spriteUrl = 'https://kaboomjs.com/sprites/ghosty.png';
    else if (days >= 1) spriteUrl = 'https://kaboomjs.com/sprites/portal.png';
    const mood = Math.min(stats.happiness, 100 - stats.hunger);
    if (mood < 25) spriteUrl = 'https://kaboomjs.com/sprites/spike.png';

    // Unlock achievements
    useEffect(() => {
        if (stats.hunger < 50 && !achievements.first_feed) {
            setAchievements((a) => ({ ...a, first_feed: true }));
            new Notification('🏅 Achievement: First Feed!', { silent: true });
        }
        if (!achievements.max_happiness && stats.happiness === 100) {
            setAchievements((a) => ({ ...a, max_happiness: true }));
            new Notification('🏅 Achievement: Max Happiness!', { silent: true });
        }
        if (!achievements.max_cleanliness && stats.cleanliness === 100) {
            setAchievements((a) => ({ ...a, max_cleanliness: true }));
            new Notification('🏅 Achievement: Max Cleanliness!', { silent: true });
        }
        if (!achievements.survived_day && ageMs >= 1000 * 60 * 60 * 24) {
            setAchievements((a) => ({ ...a, survived_day: true }));
            new Notification('🏅 Achievement: Survived 1 Day!', { silent: true });
        }
    }, [stats, ageMs]);

    // Stat update helper
    const updateStat = (key: keyof Stats, delta: number) => {
        if (gameOver) return;
        setStats((prev) => ({
            ...prev,
            [key]: Math.max(0, Math.min(100, prev[key] + delta)),
        }));
    };

    // Cure sickness
    const cure = () => {
        if (!isSick) return;
        setIsSick(false);
        if (!achievements.first_cure) {
            setAchievements((a) => ({ ...a, first_cure: true }));
            new Notification('🏅 Achievement: First Cure!', { silent: true });
        }
        new Notification('💊 Your pet is cured!', { silent: true });
    };

    // Restart the pet
    const restart = () => {
        const fresh = { hunger: 50, happiness: 50, cleanliness: 50, energy: 50 };
        setStats(fresh);
        setAgeMs(0);
        setIsSick(false);
        setGameOver(false);
        setAchievements({
            first_feed: false,
            first_cure: false,
            survived_day: false,
            max_happiness: false,
            max_cleanliness: false,
        });
    };

    // Simple progress bar
    const StatBar = ({
        label,
        value,
        color = 'bg-green-500',
    }: {
        label: string;
        value: number;
        color?: string;
    }) => (
        <div className="mb-2 w-full">
            <div className="flex justify-between text-sm text-gray-300">
                <span>{label}</span>
                <span>{value}%</span>
            </div>
            <div className="w-full h-3 bg-gray-700 rounded overflow-hidden">
                <div className={`${color} h-full`} style={{ width: `${value}%` }} />
            </div>
        </div>
    );

    return (
        <Card className="max-w-sm mx-auto mt-8 bg-[#111] border-gray-800">
            <CardHeader>
                <CardTitle className="text-white text-2xl text-center">
                    Tamagotchi Pet
                </CardTitle>
            </CardHeader>

            <CardContent className="flex flex-col items-center space-y-4">
                {/* Animated, evolving sprite */}
                <img
                    src={spriteUrl}
                    alt="Pet"
                    className="w-32 h-32 animate-bounce"
                />
                <div className="text-gray-300">Age: {days}d {hours}h</div>

                <div className="w-full">
                    <StatBar
                        label="Hunger"
                        value={100 - stats.hunger}
                        color="bg-yellow-500"
                    />
                    <StatBar
                        label="Happiness"
                        value={stats.happiness}
                        color="bg-pink-500"
                    />
                    <StatBar
                        label="Cleanliness"
                        value={stats.cleanliness}
                        color="bg-blue-500"
                    />
                    <StatBar
                        label="Energy"
                        value={stats.energy}
                        color="bg-purple-500"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2 w-full">
                    <Button onClick={() => updateStat('hunger', -20)} disabled={gameOver}>
                        Feed
                    </Button>
                    <Button
                        onClick={() => {
                            updateStat('happiness', 20);
                            updateStat('energy', -10);
                        }}
                        disabled={gameOver}
                    >
                        Play
                    </Button>
                    <Button onClick={() => updateStat('cleanliness', 20)} disabled={gameOver}>
                        Clean
                    </Button>
                    <Button onClick={() => updateStat('energy', 20)} disabled={gameOver}>
                        Sleep
                    </Button>
                </div>

                {/* Cure button when sick */}
                {isSick && (
                    <Button onClick={cure} className="bg-red-600 hover:bg-red-700 mt-2">
                        Give Medicine
                    </Button>
                )}
            </CardContent>

            <CardFooter className="flex flex-col items-center">
                {gameOver && (
                    <Button onClick={restart} className="bg-red-600 hover:bg-red-700">
                        Restart
                    </Button>
                )}

                <div className="mt-4 text-gray-400 text-sm">
                    Achievements:
                    <ul className="list-disc list-inside">
                        {Object.entries(achievements).map(
                            ([key, earned]) =>
                                earned && <li key={key}>{key.replace('_', ' ')}</li>
                        )}
                    </ul>
                </div>
            </CardFooter>
        </Card>
    );
}
