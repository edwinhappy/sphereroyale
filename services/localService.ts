import { Sphere } from "../types";

const ADJECTIVES = [
    "Neon", "Cyber", "Quantum", "Plasma", "Void", "Hyper", "Solar", "Lunar",
    "Galactic", "Cosmic", "Iron", "Steel", "Titanium", "Shadow", "Rogue", "Elite"
];

const NOUNS = [
    "Striker", "Guardian", "Phantom", "Viper", "Cobra", "Falcon", "Wolf", "Bear",
    "Shark", "Eagle", "Ronin", "Samurai", "Knight", "Hunter", "Slayer", "Reaper"
];

const PERSONALITIES = [
    "Aggressive", "Defensive", "Sneaky", "Unpredictable", "Calculated", "Reckless", "Stoic", "Feral"
];

export const generateGladiators = async (count: number): Promise<Partial<Sphere>[]> => {
    // Simulate async delay for realism
    await new Promise(resolve => setTimeout(resolve, 800));

    return Array.from({ length: count }).map(() => {
        const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
        const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
        const personality = PERSONALITIES[Math.floor(Math.random() * PERSONALITIES.length)];

        return {
            name: `${adj} ${noun}`,
            personality: personality,
        };
    });
};

export const generateCommentary = async (event: string, winner?: string): Promise<string> => {
    // Simulate small delay
    // await new Promise(resolve => setTimeout(resolve, 200));

    if (winner) {
        const winLines = [
            `UNBELIEVABLE! ${winner} HAS CLAIMED VICTORY!`,
            `THE ARENA FALLS SILENT AS ${winner} STANDS ALONE!`,
            `A LEGEND IS BORN! ALL HAIL ${winner}!`,
            `COMPLETE DOMINATION BY ${winner}!`,
            `SYSTEM OVERRIDE: ${winner} IS THE CHAMPION!`
        ];
        return winLines[Math.floor(Math.random() * winLines.length)];
    }

    // Generic event commentary
    const context = event.toLowerCase();

    if (context.includes('eliminated') || context.includes('annihilated')) {
        const killLines = [
            "DESTRUCTION DETECTED!",
            "ANOTHER ONE BITES THE DUST!",
            "OFFLINE!",
            "CRITICAL FAILURE!",
            "TERMINATED!"
        ];
        return killLines[Math.floor(Math.random() * killLines.length)] + ` (${event})`;
    }

    if (context.includes('damage') || context.includes('hit')) {
        const hitLines = [
            "WHAT A HIT!",
            "MASSIVE DAMAGE!",
            "DIRECT IMPACT!",
            "SHIELDS FAILING!",
            "BRUTAL!"
        ];
        return hitLines[Math.floor(Math.random() * hitLines.length)];
    }

    return "THE BATTLE RAGES ON!";
};

export const generateSpeech = async (text: string): Promise<void> => {
    if (!('speechSynthesis' in window)) {
        await new Promise(resolve => setTimeout(resolve, text.length * 50));
        return;
    }

    // Cancel any current speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1;
    utterance.rate = 1.2; // Slightly faster for excitement
    utterance.pitch = 0.8; // Slightly deeper for "announcer" vibe

    // Try to find a good voice
    const voices = window.speechSynthesis.getVoices();
    // Prefer "Google US English" or "Microsoft David" or similar if available
    const preferredVoice = voices.find(v =>
        (v.name.includes("Google") && v.name.includes("English")) ||
        v.name.includes("David") ||
        v.name.includes("Zira")
    );

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);

    return new Promise(resolve => {
        utterance.onend = () => resolve();
    });
};
