export const generateSpeech = async (text: string): Promise<void> => {
    if (!('speechSynthesis' in window)) {
        await new Promise(resolve => setTimeout(resolve, text.length * 50));
        return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.volume = 1;
    utterance.rate = 1.2;
    utterance.pitch = 0.8;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
        (v.name.includes('Google') && v.name.includes('English')) ||
        v.name.includes('David') ||
        v.name.includes('Zira')
    );

    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);

    return new Promise(resolve => {
        utterance.onend = () => resolve();
    });
};
