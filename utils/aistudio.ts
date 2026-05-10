
export const hasAistudio = () => typeof window !== 'undefined' && (window as { aistudio?: { hasSelectedApiKey: () => Promise<boolean>; openSelectKey: () => Promise<void> } }).aistudio;

export const checkAndOpenKeySelector = async (): Promise<boolean> => {
    if (hasAistudio()) {
        const aistudio = (window as { aistudio: { hasSelectedApiKey: () => Promise<boolean>; openSelectKey: () => Promise<void> } }).aistudio;
        const hasKey = await aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await aistudio.openSelectKey();
            return true;
        }
    }
    return false;
};
