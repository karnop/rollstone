import { DarkTheme, DefaultTheme, ThemeProvider as NavigationProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider, useThemeContext } from '@/context/theme-context';
import { AuthProvider, useAuth } from '@/context/auth-context';
import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import AuthScreen from '@/components/auth-screen';

function AppContent() {
  const { isDark } = useThemeContext();
  const { session, loading } = useAuth();

  // 1. Show splash overlay while checking session status
  if (loading) {
    return (
      <NavigationProvider value={isDark ? DarkTheme : DefaultTheme}>
        <AnimatedSplashOverlay />
      </NavigationProvider>
    );
  }

  // 2. Auth Gate
  if (!session) {
    return (
      <NavigationProvider value={isDark ? DarkTheme : DefaultTheme}>
        <AuthScreen />
      </NavigationProvider>
    );
  }

  // 3. Authenticated App Experience
  return (
    <NavigationProvider value={isDark ? DarkTheme : DefaultTheme}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AnimatedSplashOverlay />
      <AppTabs />
    </NavigationProvider>
  );
}

export default function TabLayout() {
  const [fontsLoaded] = useFonts({
    'Pliant-Regular': require('@/assets/fonts/Pliant-Regular.ttf'),
    'Pliant-Bold': require('@/assets/fonts/Pliant-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null; // Keep screen blank / native splash until fonts load
  }

  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
