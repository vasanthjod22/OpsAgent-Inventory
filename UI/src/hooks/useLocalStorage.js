import { useState } from 'react';

export const useLocalStorage = (key, initialValue) => {
  const [state, setState] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = 
        value instanceof Function ? value(state) : value;
      setState(valueToStore);
      localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (err) {
      console.error('LocalStorage error:', err);
    }
  };

  const clearValue = () => {
    try {
      setState(initialValue);
      localStorage.removeItem(key);
    } catch (err) {
      console.error('LocalStorage clear error:', err);
    }
  };

  return [state, setValue, clearValue];
};

export default useLocalStorage;
