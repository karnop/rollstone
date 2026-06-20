import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  ScrollView,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function AuthScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertMessage, setAlertMessage] = useState('');

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);

    if (isSignUp) {
      const { error, data } = await supabase.auth.signUp({
        email: email.trim(),
        password: password.trim(),
      });
      
      setLoading(false);
      
      if (error) {
        showAlert('Sign Up Error', error.message);
      } else {
        if (data.session) {
          showAlert('Success', 'Account created and logged in!');
        } else {
          showAlert('Verification Required', 'Please check your email inbox to confirm your account.');
        }
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim(),
      });

      setLoading(false);

      if (error) {
        showAlert('Sign In Error', error.message);
      }
    }
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: safeAreaInsets.top + Spacing.six, paddingBottom: safeAreaInsets.bottom + Spacing.four }
          ]}
          showsVerticalScrollIndicator={false}>
          
          {/* Logo & Title */}
          <View style={styles.logoHeader}>
            <Image
              source={require('@/assets/images/coal.png')}
              style={[styles.logoImage, { tintColor: theme.text }]}
              resizeMode="contain"
            />
            <ThemedText style={styles.title}>rollstone</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              your bjj companion
            </ThemedText>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <ThemedText type="smallBold" style={styles.label}>Email Address</ThemedText>
            <TextInput
              style={[
                styles.input,
                { borderColor: theme.backgroundElement, color: theme.text, backgroundColor: theme.backgroundElement }
              ]}
              placeholder="you@example.com"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />

            <ThemedText type="smallBold" style={[styles.label, { marginTop: Spacing.four }]}>Password</ThemedText>
            <TextInput
              style={[
                styles.input,
                { borderColor: theme.backgroundElement, color: theme.text, backgroundColor: theme.backgroundElement }
              ]}
              placeholder="••••••••"
              placeholderTextColor={theme.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
            />

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: theme.text }]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.9}>
              {loading ? (
                <ActivityIndicator color={theme.background} size="small" />
              ) : (
                <Text style={[styles.submitBtnText, { color: theme.background }]}>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Toggle Flow Link */}
          <TouchableOpacity
            onPress={() => setIsSignUp(!isSignUp)}
            style={styles.toggleBtn}
            activeOpacity={0.7}>
            <ThemedText type="small" themeColor="textSecondary">
              {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
              <ThemedText type="smallBold" style={{ textDecorationLine: 'underline' }}>
                {isSignUp ? 'Sign In' : 'Sign Up'}
              </ThemedText>
            </ThemedText>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Custom Alert Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={alertVisible}
        onRequestClose={() => setAlertVisible(false)}>
        <View style={styles.alertOverlay}>
          <ThemedView type="backgroundElement" style={styles.alertBox}>
            <ThemedText type="smallBold" style={styles.alertTitle}>
              {alertTitle}
            </ThemedText>
            <ThemedText style={styles.alertMessage}>
              {alertMessage}
            </ThemedText>
            <TouchableOpacity
              style={[styles.alertBtn, { backgroundColor: theme.text }]}
              onPress={() => setAlertVisible(false)}
              activeOpacity={0.9}>
              <Text style={[styles.alertBtnText, { color: theme.background }]}>OK</Text>
            </TouchableOpacity>
          </ThemedView>
        </View>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.five,
    justifyContent: 'center',
    flexGrow: 1,
  },
  logoHeader: {
    alignItems: 'center',
    marginBottom: Spacing.six,
  },
  logoImage: {
    width: 64,
    height: 64,
    marginBottom: Spacing.three,
  },
  title: {
    fontFamily: 'Pliant-Bold',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: Spacing.one,
    textAlign: 'center',
  },
  formCard: {
    alignSelf: 'stretch',
  },
  label: {
    marginBottom: Spacing.two,
  },
  input: {
    fontFamily: 'Pliant-Regular',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  submitBtn: {
    borderRadius: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.five,
    justifyContent: 'center',
    height: 48,
  },
  submitBtnText: {
    fontFamily: 'Pliant-Bold',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleBtn: {
    alignItems: 'center',
    marginTop: Spacing.five,
    padding: Spacing.two,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.five,
  },
  alertBox: {
    borderRadius: Spacing.four,
    padding: Spacing.five,
    alignSelf: 'stretch',
    maxWidth: 320,
    alignItems: 'center',
  },
  alertTitle: {
    fontFamily: 'Pliant-Bold',
    fontSize: 18,
    marginBottom: Spacing.two,
    textAlign: 'center',
  },
  alertMessage: {
    fontFamily: 'Pliant-Regular',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: Spacing.five,
    lineHeight: 20,
  },
  alertBtn: {
    alignSelf: 'stretch',
    height: 40,
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertBtnText: {
    fontFamily: 'Pliant-Bold',
    fontSize: 14,
    fontWeight: '700',
  },
});
