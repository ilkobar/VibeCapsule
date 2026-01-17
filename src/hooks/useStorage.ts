import { useState, useEffect } from 'react';

/**
 * Custom hook to manage state synchronized with chrome.storage.local
 */
export function useStorage<T>(key: string, initialValue: T) {
    // Initialize with initialValue, but update as soon as we read from storage
    const [value, setValue] = useState<T>(initialValue);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        // 1. Load from storage
        chrome.storage.local.get([key], (result) => {
            if (result[key] !== undefined && result[key] !== null) {
                setValue(result[key] as T);
            }
            setIsLoaded(true);
        });

        // 2. Listen for changes (e.g. from other tabs/pages)
        const listener = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
            if (areaName === 'local' && changes[key]) {
                setValue(changes[key].newValue as T);
            }
        };

        chrome.storage.onChanged.addListener(listener);
        return () => chrome.storage.onChanged.removeListener(listener);
    }, [key]);

    // 3. Setter wrapper
    const setStoredValue = (newValue: T | ((prev: T) => T)) => {
        setValue((prev) => {
            const resolvedValue = newValue instanceof Function ? (newValue as (prev: T) => T)(prev) : newValue;
            chrome.storage.local.set({ [key]: resolvedValue });
            return resolvedValue;
        });
    };

    return { value, setValue: setStoredValue, isLoaded };
}
