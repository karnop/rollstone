import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Alert, Linking, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as SecureStore from 'expo-secure-store';

import { AnimatedIcon } from '@/components/animated-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, BottomTabInset } from '@/constants/theme';
import { useThemeContext, ThemeMode } from '@/context/theme-context';
import { useAuth } from '@/context/auth-context';

const ACCENT_COLOR = '#E63462';

const STORAGE_KEYS = {
  NAME: 'rollstone_profile_name_v2',
  BELT: 'rollstone_profile_belt_v2',
  GYM: 'rollstone_profile_gym_v2',
  ATTIRE: 'rollstone_pref_attire_v2',
  WEIGHT: 'rollstone_pref_weight_v2',
};

// Storage Helpers
async function getStoredValue(key: string, defaultValue: string): Promise<string> {
  if (Platform.OS === 'web') {
    try {
      return typeof window !== 'undefined' ? (window.localStorage.getItem(key) || defaultValue) : defaultValue;
    } catch {
      return defaultValue;
    }
  }
  try {
    const val = await SecureStore.getItemAsync(key);
    return val || defaultValue;
  } catch {
    return defaultValue;
  }
}

async function setStoredValue(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
    } catch {}
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (e) {
    console.warn('Failed to write to secure store:', e);
  }
}

export default function SettingsScreen() {
  const { themeMode, setThemeMode, theme } = useThemeContext();
  const { user, signOut } = useAuth();
  const safeAreaInsets = useSafeAreaInsets();

  // Profile & Preferences (starting as null/empty)
  const [profileName, setProfileName] = useState<string>('');
  const [profileBelt, setProfileBelt] = useState<string>('');
  const [profileGym, setProfileGym] = useState<string>('');
  const [defaultAttire, setDefaultAttire] = useState<string>('');
  const [weightClass, setWeightClass] = useState<string>('');

  // Modals visibility
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [isBeltSelectVisible, setIsBeltSelectVisible] = useState(false);
  const [isTermsVisible, setIsTermsVisible] = useState(false);

  // Edit fields temp state
  const [editName, setEditName] = useState('');
  const [editGym, setEditGym] = useState('');
  const [editWeight, setEditWeight] = useState('');

  // Load Settings
  useEffect(() => {
    async function loadSettings() {
      const name = await getStoredValue(STORAGE_KEYS.NAME, '');
      const belt = await getStoredValue(STORAGE_KEYS.BELT, '');
      const gym = await getStoredValue(STORAGE_KEYS.GYM, '');
      const attire = await getStoredValue(STORAGE_KEYS.ATTIRE, '');
      const weight = await getStoredValue(STORAGE_KEYS.WEIGHT, '');

      setProfileName(name);
      setProfileBelt(belt);
      setProfileGym(gym);
      setDefaultAttire(attire);
      setWeightClass(weight);
    }
    loadSettings();
  }, []);

  const handleSaveProfile = async () => {
    setProfileName(editName);
    setProfileGym(editGym);
    setWeightClass(editWeight);
    setIsEditProfileVisible(false);

    await setStoredValue(STORAGE_KEYS.NAME, editName);
    await setStoredValue(STORAGE_KEYS.GYM, editGym);
    await setStoredValue(STORAGE_KEYS.WEIGHT, editWeight);
  };

  const handleSelectBelt = async (belt: string) => {
    setProfileBelt(belt);
    setIsBeltSelectVisible(false);
    await setStoredValue(STORAGE_KEYS.BELT, belt);
  };

  const handleAttireToggle = async (attire: 'Gi' | 'No-Gi') => {
    setDefaultAttire(attire);
    await setStoredValue(STORAGE_KEYS.ATTIRE, attire);
  };

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  const handleBugReportClick = async () => {
    const subject = encodeURIComponent('Rollstone App Feedback / Bug Report');
    const body = encodeURIComponent('Hi Manav,\n\nI want to report a bug or request a feature:\n\n[Please enter feedback here]\n\n---\nApp Context:\nPlatform: ' + Platform.OS + '\nUser: ' + (user?.email || 'Anonymous') + '\nBelt: ' + (profileBelt || 'Not Set'));
    const mailtoUrl = `mailto:communicate.manav@gmail.com?subject=${subject}&body=${body}`;

    try {
      await Linking.openURL(mailtoUrl);
    } catch (e) {
      Alert.alert(
        'Feedback Email',
        'Could not launch your email app automatically. Please email your feedback directly to: communicate.manav@gmail.com'
      );
    }
  };

  const getBeltStyle = (belt: string) => {
    switch (belt) {
      case 'White':
        return { bg: '#FFFFFF', text: '#1F2937', label: 'White Belt', border: '#D1D5DB' };
      case 'Blue':
        return { bg: '#1E40AF', text: '#FFFFFF', label: 'Blue Belt', border: '#172554' };
      case 'Purple':
        return { bg: '#6B21A8', text: '#FFFFFF', label: 'Purple Belt', border: '#3B0764' };
      case 'Brown':
        return { bg: '#78350F', text: '#FFFFFF', label: 'Brown Belt', border: '#451A03' };
      case 'Black':
        return { bg: '#111827', text: '#EF4444', label: 'Black Belt', border: '#000000' };
      default:
        return { bg: '#374151', text: '#9CA3AF', label: 'Select Belt', border: '#4B5563' };
    }
  };

  const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'Light Mode', icon: 'sunny-outline' },
    { value: 'dark', label: 'Dark Mode', icon: 'moon-outline' },
    { value: 'system', label: 'System Default', icon: 'phone-portrait-outline' },
  ];

  const beltStyle = getBeltStyle(profileBelt);

  return (
    <ThemedView style={styles.container}>
      <View style={{ height: safeAreaInsets.top, backgroundColor: theme.background }} />

      {/* Uniform Header Row */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <AnimatedIcon />
        </View>
        <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 18, color: theme.text }}>Settings</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four }
        ]}>

        {/* 1. Profile Header */}
        <ThemedView type="backgroundElement" style={styles.profileHeader}>
          <View style={styles.profileRow}>
            {/* Avatar Circle */}
            <View style={[styles.avatar, { backgroundColor: theme.background }]}>
              <Text style={[styles.avatarText, { color: ACCENT_COLOR }]}>
                {profileName ? profileName.trim().charAt(0).toUpperCase() : '?'}
              </Text>
            </View>

            {/* Profile Info */}
            <View style={styles.profileDetails}>
              <ThemedText style={{ fontSize: 19, fontWeight: '700' }} numberOfLines={1} ellipsizeMode="tail">
                {profileName || 'Your Name'}
              </ThemedText>

              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spacing.two, marginTop: Spacing.one }}>
                <TouchableOpacity 
                  onPress={() => setIsBeltSelectVisible(true)}
                  activeOpacity={0.7}
                  style={[styles.beltBadge, { backgroundColor: beltStyle.bg, borderWidth: profileBelt === 'White' ? 1 : 0, borderColor: beltStyle.border }]}>
                  <Text style={[styles.beltText, { color: beltStyle.text }]}>{beltStyle.label}</Text>
                </TouchableOpacity>

                <ThemedText type="small" themeColor="textSecondary" style={{ flexShrink: 1 }} numberOfLines={1} ellipsizeMode="tail">
                  {profileGym ? `@ ${profileGym}` : 'No Academy Set'}
                </ThemedText>
              </View>

              {user && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.profileEmail} numberOfLines={1} ellipsizeMode="tail">
                  {user.email}
                </ThemedText>
              )}
            </View>

            {/* Edit Trigger */}
            <TouchableOpacity
              onPress={() => {
                setEditName(profileName);
                setEditGym(profileGym);
                setEditWeight(weightClass);
                setIsEditProfileVisible(true);
              }}
              style={styles.editBtn}
              activeOpacity={0.7}>
              <Ionicons name="create-outline" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>
        </ThemedView>

        {/* 2. Training Preferences */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            Training Preferences
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {/* Default Attire */}
            <View style={styles.staticRow}>
              <View style={styles.rowLabelContainer}>
                <Ionicons name="shirt-outline" size={20} color={theme.text} />
                <ThemedText style={{ marginLeft: Spacing.three }}>Default Attire</ThemedText>
              </View>
              <View style={styles.segmentedContainer}>
                <TouchableOpacity
                  style={[
                    styles.segmentedButton,
                    defaultAttire === 'Gi' && { backgroundColor: theme.background }
                  ]}
                  onPress={() => handleAttireToggle('Gi')}
                  activeOpacity={0.8}>
                  <Text style={[styles.segmentedText, { color: defaultAttire === 'Gi' ? ACCENT_COLOR : theme.textSecondary }]}>Gi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.segmentedButton,
                    defaultAttire === 'No-Gi' && { backgroundColor: theme.background }
                  ]}
                  onPress={() => handleAttireToggle('No-Gi')}
                  activeOpacity={0.8}>
                  <Text style={[styles.segmentedText, { color: defaultAttire === 'No-Gi' ? ACCENT_COLOR : theme.textSecondary }]}>No-Gi</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={[styles.separator, { backgroundColor: theme.background }]} />

            {/* My Weight Class */}
            <TouchableOpacity
              onPress={() => {
                setEditName(profileName);
                setEditGym(profileGym);
                setEditWeight(weightClass);
                setIsEditProfileVisible(true);
              }}
              style={styles.staticRow}
              activeOpacity={0.7}>
              <View style={styles.rowLabelContainer}>
                <Ionicons name="scale-outline" size={20} color={theme.text} />
                <ThemedText style={{ marginLeft: Spacing.three }}>My Weight Class</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <ThemedText themeColor="textSecondary">{weightClass || 'Set weight'}</ThemedText>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} style={{ marginLeft: Spacing.two }} />
              </View>
            </TouchableOpacity>
          </ThemedView>
        </View>

        {/* 3. Appearance Preference Group */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            Appearance
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {themeOptions.map((opt, idx) => {
              const isSelected = themeMode === opt.value;
              return (
                <View key={opt.value}>
                  <TouchableOpacity
                    style={styles.row}
                    onPress={() => handleThemeChange(opt.value)}
                    activeOpacity={0.7}>
                    <View style={styles.rowLabelContainer}>
                      <Ionicons name={opt.icon as any} size={20} color={theme.text} />
                      <ThemedText style={{ marginLeft: Spacing.three }}>{opt.label}</ThemedText>
                    </View>
                    {isSelected && (
                      <Ionicons name="checkmark" size={20} color={ACCENT_COLOR} />
                    )}
                  </TouchableOpacity>
                  {idx !== themeOptions.length - 1 && (
                    <View style={[styles.separator, { backgroundColor: theme.background }]} />
                  )}
                </View>
              );
            })}
          </ThemedView>
        </View>

        {/* 4. Database & Storage Management */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            Database & Storage
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {/* Export CSV Button */}
            <TouchableOpacity 
              style={styles.row} 
              onPress={() => Alert.alert('Coming Soon', 'CSV Export feature will be available in the next release.')} 
              activeOpacity={0.7}>
              <View style={styles.rowLabelContainer}>
                <Ionicons name="download-outline" size={20} color={theme.text} />
                <ThemedText style={{ marginLeft: Spacing.three }}>Export Training Logs (.csv)</ThemedText>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: ACCENT_COLOR, textTransform: 'uppercase' }}>Coming Soon</Text>
                <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
              </View>
            </TouchableOpacity>
          </ThemedView>
        </View>

        {/* 5. Legal, Info & Support */}
        <View style={styles.section}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
            App Support
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {/* T&C */}
            <TouchableOpacity 
              style={styles.row} 
              onPress={() => setIsTermsVisible(true)} 
              activeOpacity={0.7}>
              <View style={styles.rowLabelContainer}>
                <Ionicons name="document-text-outline" size={20} color={theme.text} />
                <ThemedText style={{ marginLeft: Spacing.three }}>Terms & Privacy Policy</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.separator, { backgroundColor: theme.background }]} />

            {/* Bug Report */}
            <TouchableOpacity 
              style={styles.row} 
              onPress={handleBugReportClick} 
              activeOpacity={0.7}>
              <View style={styles.rowLabelContainer}>
                <Ionicons name="bug-outline" size={20} color={theme.text} />
                <ThemedText style={{ marginLeft: Spacing.three }}>Report a Bug / Request Feature</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </ThemedView>
        </View>

        {/* Sign Out Button */}
        {user && (
          <TouchableOpacity
            style={[styles.signOutBtn, { borderColor: theme.textSecondary }]}
            onPress={signOut}
            activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={theme.text} />
            <ThemedText style={styles.signOutBtnText}>Sign Out</ThemedText>
          </TouchableOpacity>
        )}

        {/* Developer Credit */}
        <View style={styles.creditContainer}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.creditText}>
            Developed by Manav Mahesh Sanger
          </ThemedText>
        </View>

      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditProfileVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Edit Profile & Settings</ThemedText>
            
            <View style={styles.inputGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.inputLabel}>Name</ThemedText>
              <TextInput
                value={editName}
                onChangeText={setEditName}
                style={[styles.textInput, { color: theme.text, borderColor: theme.background }]}
                placeholder="Enter name (e.g. Manav)"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.inputLabel}>Academy / Gym</ThemedText>
              <TextInput
                value={editGym}
                onChangeText={setEditGym}
                style={[styles.textInput, { color: theme.text, borderColor: theme.background }]}
                placeholder="Enter gym"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.inputGroup}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.inputLabel}>Weight Class</ThemedText>
              <TextInput
                value={editWeight}
                onChangeText={setEditWeight}
                style={[styles.textInput, { color: theme.text, borderColor: theme.background }]}
                placeholder="Enter weight (e.g. 82 kg)"
                placeholderTextColor={theme.textSecondary}
              />
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEditProfileVisible(false)}>
                <Text style={{ color: theme.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT_COLOR }]} onPress={handleSaveProfile}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </View>
      </Modal>

      {/* Belt Select Modal */}
      <Modal visible={isBeltSelectVisible} animationType="fade" transparent>
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setIsBeltSelectVisible(false)}>
          <ThemedView type="backgroundElement" style={styles.beltModalCard}>
            <ThemedText style={[styles.modalTitle, { textAlign: 'center', marginBottom: Spacing.four }]}>Choose Belt Rank</ThemedText>
            {['White', 'Blue', 'Purple', 'Brown', 'Black'].map((belt) => {
              const style = getBeltStyle(belt);
              const barColor = belt === 'Black' ? '#EF4444' : '#111827';
              const isSelected = profileBelt === belt;
              return (
                <TouchableOpacity
                  key={belt}
                  onPress={() => handleSelectBelt(belt)}
                  style={[
                    styles.beltSelectItem,
                    { 
                      borderColor: theme.background,
                      backgroundColor: theme.background,
                    },
                    isSelected && { borderColor: ACCENT_COLOR, borderWidth: 1 }
                  ]}
                  activeOpacity={0.8}>
                  {/* Miniature BJJ Belt Visual representation */}
                  <View style={[styles.beltVisual, { backgroundColor: style.bg, borderWidth: belt === 'White' ? 1 : 0, borderColor: '#D1D5DB' }]}>
                    <View style={[styles.beltRankBar, { backgroundColor: barColor }]} />
                  </View>
                  <Text style={[styles.beltSelectText, { color: theme.text }]}>{style.label}</Text>
                  {isSelected && (
                    <Ionicons name="checkmark-circle" size={20} color={ACCENT_COLOR} style={{ marginLeft: 'auto' }} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ThemedView>
        </TouchableOpacity>
      </Modal>

      {/* Terms & Privacy Modal */}
      <Modal visible={isTermsVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <ThemedView type="backgroundElement" style={styles.modalCard}>
            <ThemedText style={styles.modalTitle}>Terms & Privacy Policy</ThemedText>
            <ScrollView style={{ maxHeight: 300, marginBottom: Spacing.four }}>
              <ThemedText type="smallBold" style={{ marginBottom: Spacing.one }}>1. Privacy Policy</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.three }}>
                Rollstone respects your privacy. All your training logs, sparring data, and profile information are stored securely in Supabase Cloud. We do not sell or share your personal training metrics with any third parties.
              </ThemedText>
              
              <ThemedText type="smallBold" style={{ marginBottom: Spacing.one }}>2. Terms of Service</ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.three }}>
                By using Rollstone, you agree to record logs responsibly. The application is built to track personal BJJ training progress. Any misuse of service endpoints or disruption of infrastructure is strictly prohibited.
              </ThemedText>

              <ThemedText type="smallBold" style={{ marginBottom: Spacing.one }}>3. Safety Disclaimer</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Brazilian Jiu-Jitsu is a high-intensity combat sport. Ensure you train safely under certified supervision. Rollstone is a performance tracker and does not substitute professional safety guidance.
              </ThemedText>
            </ScrollView>
            <View style={{ alignItems: 'flex-end' }}>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: ACCENT_COLOR }]} onPress={() => setIsTermsVisible(false)}>
                <Text style={{ color: '#FFF', fontWeight: '700' }}>Close</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileHeader: {
    borderRadius: 16,
    padding: 16,
    marginBottom: Spacing.five,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
  },
  avatarText: {
    fontSize: 24,
    fontFamily: 'Pliant-Bold',
  },
  profileDetails: {
    flex: 1,
    marginLeft: Spacing.four,
  },
  beltBadge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: 4,
  },
  beltText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  profileEmail: {
    marginTop: 2,
    opacity: 0.6,
  },
  editBtn: {
    padding: Spacing.two,
  },
  section: {
    marginBottom: Spacing.five,
  },
  sectionTitle: {
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  card: {
    borderRadius: Spacing.four,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  rowLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.four,
  },
  separator: {
    height: 1,
    marginLeft: 52, // Inset separator line to match iOS & Material patterns
    marginRight: Spacing.four,
  },
  segmentedContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderRadius: Spacing.two,
    padding: 2,
  },
  segmentedButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: 6,
    borderRadius: 6,
  },
  segmentedText: {
    fontSize: 13,
    fontWeight: '600',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    marginTop: Spacing.four,
    gap: Spacing.two,
  },
  signOutBtnText: {
    fontWeight: '700',
  },
  creditContainer: {
    marginTop: Spacing.six,
    alignItems: 'center',
    justifyContent: 'center',
  },
  creditText: {
    fontSize: 12,
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  modalCard: {
    width: '100%',
    borderRadius: Spacing.four,
    padding: Spacing.five,
    maxWidth: 400,
  },
  beltModalCard: {
    width: '100%',
    borderRadius: Spacing.four,
    padding: Spacing.five,
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: Spacing.four,
  },
  inputGroup: {
    marginBottom: Spacing.three,
  },
  inputLabel: {
    marginBottom: Spacing.one,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.three,
    fontSize: 15,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
  cancelBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
  },
  saveBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.two,
  },
  beltSelectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.two,
    marginBottom: Spacing.two,
    borderWidth: 1,
  },
  beltSelectText: {
    fontWeight: '700',
    fontSize: 15,
    marginLeft: Spacing.three,
  },
  beltVisual: {
    width: 60,
    height: 12,
    borderRadius: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  beltRankBar: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    width: 14,
  },
});
