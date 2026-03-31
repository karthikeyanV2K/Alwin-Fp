import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import CameraScreen from './screens/CameraScreen';
import ConfigScreen from './screens/ConfigScreen';
import RoomSelectScreen from './screens/RoomSelectScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  const [serverIp, setServerIp] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkServerConfig();
  }, []);

  const checkServerConfig = async () => {
    try {
      const savedIp = await AsyncStorage.getItem('SERVER_IP');
      setServerIp(savedIp);
    } catch (error) {
      console.error('Error checking server config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfigured = (ip) => {
    setServerIp(ip);
  };

  if (isLoading) {
    return null;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: true,
          headerStyle: {
            backgroundColor: '#1a1a1a',
          },
          headerTintColor: '#fff',
          headerTitleStyle: {
            fontWeight: 'bold',
            fontSize: 20,
          },
        }}
      >
        {!serverIp ? (
          /* ── Step 1: Server IP setup ── */
          <Stack.Screen
            name="ConfigScreen"
            options={{ title: 'Server Configuration', headerShown: false }}
          >
            {(props) => (
              <ConfigScreen {...props} onConfigured={handleConfigured} />
            )}
          </Stack.Screen>
        ) : (
          <>
            {/* ── Step 2: Pick room ── */}
            <Stack.Screen
              name="RoomSelectScreen"
              options={{
                title: 'Select Room',
                headerStyle: { backgroundColor: '#080812' },
                headerTintColor: '#a78bfa',
                headerTitleStyle: { fontWeight: '800', fontSize: 18 },
              }}
            >
              {(props) => (
                <RoomSelectScreen {...props} serverIp={serverIp} />
              )}
            </Stack.Screen>

            {/* ── Step 3: Camera + detection ── */}
            <Stack.Screen
              name="CameraScreen"
              options={{
                title: 'Detecting...',
                headerStyle: { backgroundColor: '#0f0f1e' },
                headerTintColor: '#a78bfa',
                headerTitleStyle: { fontWeight: '800' },
                gestureEnabled: false,
              }}
            >
              {(props) => (
                <CameraScreen {...props} serverIp={serverIp} />
              )}
            </Stack.Screen>
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
