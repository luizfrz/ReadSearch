import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'rs:welcome-seen';

export const WelcomeContext = React.createContext({ open: () => {} });

export async function hasSeenWelcome() {
  try {
    return (await AsyncStorage.getItem(KEY)) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen() {
  return AsyncStorage.setItem(KEY, '1').catch(() => {});
}
