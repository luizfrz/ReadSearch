import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SearchScreen from './src/screens/SearchScreen';
import LibraryScreen from './src/screens/LibraryScreen';
import DeviceScreen from './src/screens/DeviceScreen';
import Splash from './src/components/Splash';
import Welcome from './src/components/Welcome';
import { WelcomeContext, hasSeenWelcome, markWelcomeSeen } from './src/welcome';
import ReaderScreen from './src/screens/ReaderScreen';
import { colors } from './src/theme';

const Tabs = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const theme = { ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.bg, card: colors.card, primary: colors.accent, border: colors.border } };

function Home() {
  return (
    <Tabs.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => <Ionicons name={{ Buscar: 'search', Biblioteca: 'library', Memória: 'hardware-chip' }[route.name]} size={size} color={color} />,
      })}
    >
      <Tabs.Screen name="Buscar" component={SearchScreen} />
      <Tabs.Screen name="Biblioteca" component={LibraryScreen} />
      <Tabs.Screen name="Memória" component={DeviceScreen} />
    </Tabs.Navigator>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [welcome, setWelcome] = useState(null); // null = fechada; { first } = aberta
  useEffect(() => {
    hasSeenWelcome().then((seen) => { if (!seen) setWelcome({ first: true }); });
  }, []);
  const closeWelcome = () => { markWelcomeSeen(); setWelcome(null); };
  return (
    <SafeAreaProvider>
      <WelcomeContext.Provider value={{ open: () => setWelcome({ first: false }) }}>
      <NavigationContainer theme={theme}>
        <StatusBar style="light" />
        <Stack.Navigator>
          <Stack.Screen name="Home" component={Home} options={{ headerShown: false }} />
          <Stack.Screen name="Reader" component={ReaderScreen} options={{ title: 'Leitor', headerStyle: { backgroundColor: colors.card }, headerTintColor: colors.text }} />
        </Stack.Navigator>
      </NavigationContainer>
        {welcome && <Welcome first={welcome.first} onClose={closeWelcome} />}
        {!ready && <Splash onDone={() => setReady(true)} />}
      </WelcomeContext.Provider>
    </SafeAreaProvider>
  );
}
