import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedIcon } from '@/components/animated-icon';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, BottomTabInset } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

interface Position {
  id: string;
  name: string;
  category: string;
}

interface Move {
  id: string;
  name: string;
  type: string;
  position_id: string;
  bjj_positions?: {
    name: string;
  };
}

const CATEGORIES = ['Neutral', 'Dominant (Top)', 'Submissive (Bottom)', 'Guards (Active Bottom)', 'Leg Entanglements (Ashi)'] as const;
const MOVE_TYPES = ['Submission', 'Sweep', 'Escape', 'Takedown', 'Transition'] as const;
const ACCENT_COLOR = '#E63462';

export default function AdminScreen() {
  const theme = useTheme();
  const safeAreaInsets = useSafeAreaInsets();

  // Data States
  const [positions, setPositions] = useState<Position[]>([]);
  const [moves, setMoves] = useState<Move[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form States - Position
  const [posName, setPosName] = useState('');
  const [posCategory, setPosCategory] = useState<typeof CATEGORIES[number]>('Guards (Active Bottom)');
  const [loadingPos, setLoadingPos] = useState(false);

  // Form States - Move
  const [moveName, setMoveName] = useState('');
  const [moveType, setMoveType] = useState<typeof MOVE_TYPES[number]>('Submission');
  const [selectedPosId, setSelectedPosId] = useState('');
  const [loadingMove, setLoadingMove] = useState(false);

  // Fetch initial data
  const fetchData = async () => {
    setLoadingData(true);
    try {
      const { data: posData, error: posError } = await supabase
        .from('bjj_positions')
        .select('*')
        .order('name');
      
      if (posData) {
        setPositions(posData);
        if (posData.length > 0) {
          setSelectedPosId(posData[0].id);
        }
      }

      const { data: moveData, error: moveError } = await supabase
        .from('bjj_moves')
        .select(`
          id, name, type, position_id,
          bjj_positions ( name )
        `)
        .order('name');

      if (moveData) {
        setMoves(moveData as any);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Handle Add Position
  const handleAddPosition = async () => {
    if (!posName.trim()) {
      Alert.alert('Error', 'Position name cannot be empty.');
      return;
    }

    setLoadingPos(true);
    try {
      const { data, error } = await supabase
        .from('bjj_positions')
        .insert({
          name: posName.trim(),
          category: posCategory,
        })
        .select()
        .single();

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setPosName('');
        Alert.alert('Success', 'Position added successfully!');
        fetchData();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoadingPos(false);
    }
  };

  // Handle Add Move
  const handleAddMove = async () => {
    if (!moveName.trim()) {
      Alert.alert('Error', 'Move name cannot be empty.');
      return;
    }

    if (!selectedPosId) {
      Alert.alert('Error', 'Please create and select a position first.');
      return;
    }

    setLoadingMove(true);
    try {
      const { error } = await supabase
        .from('bjj_moves')
        .insert({
          name: moveName.trim(),
          type: moveType,
          position_id: selectedPosId,
        });

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        setMoveName('');
        Alert.alert('Success', 'Move added successfully!');
        fetchData();
      }
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setLoadingMove(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={{ height: safeAreaInsets.top, backgroundColor: theme.background }} />

      {/* Uniform Header Row */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <AnimatedIcon />
        </View>
        <Text style={{ fontFamily: 'Pliant-Bold', fontSize: 18, color: theme.text }}>Admin</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: safeAreaInsets.bottom + BottomTabInset + Spacing.four }
        ]}>
        
        {/* Descriptive Banner inside ScrollView */}
        <View style={{ marginBottom: Spacing.four, paddingHorizontal: Spacing.two }}>
          <ThemedText type="small" themeColor="textSecondary">
            Manage BJJ Map & Vocabulary
          </ThemedText>
        </View>

        {loadingData ? (
          <ActivityIndicator color={ACCENT_COLOR} size="large" style={{ marginTop: Spacing.six }} />
        ) : (
          <View style={styles.content}>
            {/* 1. Add Position Section */}
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                Add BJJ Position (The Map)
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.formGroup}>
                  <TextInput
                    style={[styles.input, { borderColor: theme.background, color: theme.text, backgroundColor: theme.background }]}
                    placeholder="Position Name (e.g. Side Control, Deep Half Guard)"
                    placeholderTextColor={theme.textSecondary}
                    value={posName}
                    onChangeText={setPosName}
                  />
                </View>

                {/* Category Selection Dropdown/Options */}
                <View style={styles.formGroup}>
                  <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>Category</ThemedText>
                  <View style={styles.optionList}>
                    {CATEGORIES.map(cat => (
                      <TouchableOpacity
                        key={cat}
                        style={[
                          styles.optionPill,
                          {
                            borderColor: theme.background,
                            backgroundColor: posCategory === cat ? ACCENT_COLOR : theme.background,
                          }
                        ]}
                        onPress={() => setPosCategory(cat)}>
                        <Text style={[styles.optionText, { color: posCategory === cat ? '#ffffff' : theme.text }]}>
                          {cat}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: theme.text }]}
                  onPress={handleAddPosition}
                  disabled={loadingPos}
                  activeOpacity={0.9}>
                  {loadingPos ? (
                    <ActivityIndicator color={theme.background} size="small" />
                  ) : (
                    <Text style={[styles.submitBtnText, { color: theme.background }]}>Add Position</Text>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </View>

            {/* 2. Add Move Section */}
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                Add BJJ Move (The Vocabulary)
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={styles.formGroup}>
                  <TextInput
                    style={[styles.input, { borderColor: theme.background, color: theme.text, backgroundColor: theme.background }]}
                    placeholder="Move Name (e.g. Armbar, Hip Escape, Flower Sweep)"
                    placeholderTextColor={theme.textSecondary}
                    value={moveName}
                    onChangeText={setMoveName}
                  />
                </View>

                {/* Position Select */}
                <View style={styles.formGroup}>
                  <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>Starts From Position</ThemedText>
                  {positions.length === 0 ? (
                    <ThemedText type="small" themeColor="textSecondary">Create a position first.</ThemedText>
                  ) : (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalPills}>
                      <View style={{ flexDirection: 'row', gap: Spacing.two }}>
                        {positions.map(pos => (
                          <TouchableOpacity
                            key={pos.id}
                            style={[
                              styles.optionPill,
                              {
                                borderColor: theme.background,
                                backgroundColor: selectedPosId === pos.id ? ACCENT_COLOR : theme.background,
                              }
                            ]}
                            onPress={() => setSelectedPosId(pos.id)}>
                            <Text style={[styles.optionText, { color: selectedPosId === pos.id ? '#ffffff' : theme.text }]}>
                              {pos.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </ScrollView>
                  )}
                </View>

                {/* Move Type Select */}
                <View style={styles.formGroup}>
                  <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>Move Type</ThemedText>
                  <View style={styles.optionList}>
                    {MOVE_TYPES.map(type => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.optionPill,
                          {
                            borderColor: theme.background,
                            backgroundColor: moveType === type ? ACCENT_COLOR : theme.background,
                          }
                        ]}
                        onPress={() => setMoveType(type)}>
                        <Text style={[styles.optionText, { color: moveType === type ? '#ffffff' : theme.text }]}>
                          {type}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.submitBtn, { backgroundColor: theme.text }]}
                  onPress={handleAddMove}
                  disabled={loadingMove}
                  activeOpacity={0.9}>
                  {loadingMove ? (
                    <ActivityIndicator color={theme.background} size="small" />
                  ) : (
                    <Text style={[styles.submitBtnText, { color: theme.background }]}>Add Move</Text>
                  )}
                </TouchableOpacity>
              </ThemedView>
            </View>

            {/* 3. Stats & Details List */}
            <View style={styles.section}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={styles.sectionTitle}>
                Existing Database ({positions.length} Positions, {moves.length} Moves)
              </ThemedText>
              
              <ThemedView type="backgroundElement" style={styles.card}>
                <View style={{ padding: Spacing.four }}>
                  <ThemedText type="smallBold" style={{ marginBottom: Spacing.two }}>Positions</ThemedText>
                  {positions.map(p => (
                    <View key={p.id} style={styles.listRow}>
                      <ThemedText>{p.name}</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">{p.category}</ThemedText>
                    </View>
                  ))}

                  <ThemedText type="smallBold" style={{ marginTop: Spacing.five, marginBottom: Spacing.two }}>Moves</ThemedText>
                  {moves.map(m => (
                    <View key={m.id} style={styles.listRow}>
                      <View>
                        <ThemedText>{m.name}</ThemedText>
                        <ThemedText type="small" themeColor="textSecondary">
                          from: {m.bjj_positions?.name || 'Unknown'}
                        </ThemedText>
                      </View>
                      <ThemedText type="small" themeColor="textSecondary">{m.type}</ThemedText>
                    </View>
                  ))}
                </View>
              </ThemedView>
            </View>
          </View>
        )}
      </ScrollView>
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
  content: {
    gap: Spacing.five,
  },
  section: {
    marginBottom: Spacing.two,
  },
  sectionTitle: {
    marginBottom: Spacing.two,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontSize: 12,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
  },
  formGroup: {
    marginBottom: Spacing.four,
  },
  input: {
    fontFamily: 'Pliant-Regular',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 15,
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  optionPill: {
    borderWidth: 1.5,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  optionText: {
    fontFamily: 'Pliant-Bold',
    fontSize: 12,
    fontWeight: '600',
  },
  horizontalPills: {
    paddingVertical: Spacing.one,
  },
  submitBtn: {
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
  },
  submitBtnText: {
    fontFamily: 'Pliant-Bold',
    fontSize: 14,
    fontWeight: '700',
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
});
