"use client";
import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "../../components/ui/tabs";

const FEEDS = [
    { title: "Technology Reads", desc: "Technology-related long form notes", stats: { likes: 76 }, free: true },
    { title: "Food Reads", desc: "Food-related long form notes", stats: { likes: 53 }, free: true },
    { title: "Latest from Free-Floating Intelligence", desc: "Latest blog posts from Free-Floating Intelligence", stats: { likes: 18 }, free: true },
    { title: "Your topics (beta)", desc: "Personalized feed based on your topics", stats: { likes: 96 }, free: true },
    { title: "Gaming Reads", desc: "Gaming-related long form notes", stats: { likes: 56 }, free: true },
    { title: "Popular Pareto Articles (Alpha Version)", desc: "Most popular posts on Pareto", stats: { likes: 15 }, free: true },
    { title: "Nostr Reads", desc: "Nostr-related long form notes", stats: { likes: 65 }, free: true },
    { title: "Photography Reads", desc: "Photography-related long form notes", stats: { likes: 54 }, free: true },
    { title: "Philosophy Reads", desc: "Philosophy-related long form notes", stats: { likes: 150 }, free: true },
    { title: "Sports Reads", desc: "Sports-related long form notes", stats: { likes: 120 }, free: true },
];

const PEOPLE = [
    { name: "BlekDimon (Anilist)", desc: "My top 10 favourite anime of 2023", followers: 5, likes: 146 },
    { name: "craigraw", desc: "Creator of Sparrow Wallet", followers: 39500, likes: 87 },
    { name: "Lyn Alden", desc: "Founder of Lyn Alden Investment Strategy", followers: 97000, likes: 52 },
    { name: "HODL", desc: "A new world is struggling to be born.", followers: 48200, likes: 50 },
    { name: "Gigi", desc: "Not reading DMs. Aspiring Saunameister.", followers: 17000, likes: 50 },
    { name: "Erik Cason", desc: "I like to talk about bitcoin and philosophy...", followers: 36100, likes: 50 },
    { name: "jack mallers", desc: "yo", followers: 144000, likes: 50 },
    { name: "Max DeMarco", desc: "Bitcoin Filmmaker", followers: 50100, likes: 50 },
];

const ZAPS = [
    { user: "Jor", amount: 21000, time: "15 hr.", text: "You're not buying Bitcoin. Or sats. Or bits..." },
    { user: "Heidi", amount: 21000, time: "14 hr.", text: "hi nostr" },
    { user: "thepurpose", amount: 11716, time: "1 hr.", text: "Finally publishing my book..." },
    { user: "art.", amount: 10000, time: "5 hr.", text: "Almost 3 years ago..." },
    { user: "Uno", amount: 10000, time: "12 hr.", text: "-" },
    { user: "sourcenode", amount: 10000, time: "2 hr.", text: "here's your sign" },
];

const TOPICS = [
    { tag: "#Sports", notes: 4361 },
    { tag: "#Politics", notes: 2560 },
    { tag: "#Bitcoin", notes: 2033 },
    { tag: "#Business", notes: 1314 },
    { tag: "#Technology", notes: 1226 },
    { tag: "#News", notes: 1074 },
    { tag: "#World", notes: 1012 },
    { tag: "#Donaldtrump", notes: 957 },
    { tag: "#Unitedstates", notes: 675 },
    { tag: "#Israel", notes: 565 },
];

export default function ExplorePage() {
    const [tab, setTab] = useState("feeds");
    return (
        <div className="w-full max-w-2xl px-2 sm:px-6 py-8">
            <div className="flex items-center gap-4 mb-6">
                <input
                    className="flex-1 px-4 py-2 rounded bg-gray-900 border border-gray-700 text-lg focus:outline-none"
                    placeholder="Search..."
                    type="text"
                />
                <span className="text-pink-500 font-semibold cursor-pointer">Advanced Search</span>
            </div>
            <div className="mb-6">
                <Tabs defaultValue={tab} onValueChange={val => setTab(val)}>
                    <TabsList className="flex gap-2 bg-gray-900 rounded-lg p-1">
                        <TabsTrigger value="feeds">Feeds</TabsTrigger>
                        <TabsTrigger value="people">People</TabsTrigger>
                        <TabsTrigger value="zaps">Zaps</TabsTrigger>
                        <TabsTrigger value="media">Media</TabsTrigger>
                        <TabsTrigger value="topics">Topics</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>
            {/* Tab content below, always rendered, but only visible if active */}
            <div style={{ display: tab === "feeds" ? undefined : "none" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {FEEDS.map(feed => (
                        <div key={feed.title} className="bg-gray-900 rounded-lg p-4 flex flex-col gap-2 border border-gray-800">
                            <div className="flex items-center gap-2">
                                <span className="text-xs bg-gray-800 px-2 py-1 rounded text-pink-400 font-bold">{feed.free ? "FREE" : "PREMIUM"}</span>
                                <span className="font-semibold text-lg">{feed.title}</span>
                            </div>
                            <div className="text-gray-400 text-sm">{feed.desc}</div>
                            <div className="flex gap-4 text-gray-500 text-xs mt-2">
                                <span>❤ {feed.stats.likes}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ display: tab === "people" ? undefined : "none" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PEOPLE.map(person => (
                        <div key={person.name} className="bg-gray-900 rounded-lg p-4 flex flex-col gap-2 border border-gray-800">
                            <div className="flex items-center gap-2">
                                <span className="font-semibold text-lg">{person.name}</span>
                            </div>
                            <div className="text-gray-400 text-sm">{person.desc}</div>
                            <div className="flex gap-4 text-gray-500 text-xs mt-2">
                                <span>👥 {person.followers.toLocaleString()} followers</span>
                                <span>❤ {person.likes}</span>
                            </div>
                            <button className="mt-2 px-3 py-1 rounded bg-pink-500 text-white text-sm font-semibold w-fit">Follow</button>
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ display: tab === "zaps" ? undefined : "none" }}>
                <div className="flex flex-col gap-3">
                    {ZAPS.map((zap, i) => (
                        <div key={i} className="bg-gray-900 rounded-lg p-4 flex items-center gap-4 border border-gray-800">
                            <div className="text-2xl">⚡</div>
                            <div className="flex-1">
                                <div className="font-semibold">{zap.user}</div>
                                <div className="text-gray-400 text-sm">{zap.text}</div>
                            </div>
                            <div className="text-pink-400 font-bold text-lg">{zap.amount.toLocaleString()}</div>
                            <div className="text-gray-500 text-xs">{zap.time}</div>
                        </div>
                    ))}
                </div>
            </div>
            <div style={{ display: tab === "media" ? undefined : "none" }}>
                <div className="text-gray-400 text-center py-12">Media tab coming soon...</div>
            </div>
            <div style={{ display: tab === "topics" ? undefined : "none" }}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {TOPICS.map(topic => (
                        <div key={topic.tag} className="bg-gray-900 rounded-lg p-4 flex items-center justify-between border border-gray-800">
                            <span className="font-semibold">{topic.tag}</span>
                            <span className="text-gray-400 text-sm">{topic.notes.toLocaleString()} notes</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
