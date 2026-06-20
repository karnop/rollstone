import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BJJRoundLog } from '@/types/bjj';
import { styles } from '@/app/index.styles';
import { 
  ACCENT_COLOR, 
  getIntensityDots, 
  getActionVerb, 
  invertPerspective 
} from '@/utils/bjj-helpers';

interface RoundDetailModalProps {
  visible: boolean;
  log: BJJRoundLog | null;
  onClose: () => void;
  onEdit: (log: BJJRoundLog) => void;
}

export function RoundDetailModal({ visible, log, onClose, onEdit }: RoundDetailModalProps) {
  const theme = useTheme();

  if (!log) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}>
      <View style={styles.bottomSheetOverlay}>
        <Pressable style={styles.bottomSheetBackdrop} onPress={onClose} />
        <ThemedView style={[styles.bottomSheetContent, { backgroundColor: theme.background, maxHeight: '85%' }]}>
          {/* Grab Bar Indicator */}
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.textSecondary + '44', alignSelf: 'center', marginBottom: Spacing.three }} />
          
          <View style={styles.bottomSheetHeaderNew}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bottomSheetTitleNew, { color: theme.text }]} numberOfLines={1}>
                {log.attire} Round vs. {log.partner_name}
              </Text>
              <Text style={[styles.bottomSheetSubtitleNew, { color: theme.textSecondary }]}>
                {new Date(log.date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })} • {log.total_rounds || 1} x {log.duration}m
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtnNew}>
              <Ionicons name="close" size={20} color={theme.text} />
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            {...({ delaysContentTouches: false } as any)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: Spacing.six }}>
            
            {/* Visual Keyboards / Cards for Session Data */}
            <View style={styles.metaMetricsRow}>
              {/* Intensity Card */}
              <View style={[styles.miniMetricCard, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.miniMetricLabel, { color: theme.textSecondary }]}>INTENSITY</Text>
                <Text style={[styles.miniMetricVal, { color: theme.text }]} numberOfLines={1}>
                  {log.intensity}
                </Text>
                <Text style={[styles.intensityDots, { color: ACCENT_COLOR }]}>
                  {getIntensityDots(log.intensity)}
                </Text>
              </View>

              {/* Feel Score Card */}
              <View style={[styles.miniMetricCard, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.miniMetricLabel, { color: theme.textSecondary }]}>ROUND FEEL</Text>
                <View style={styles.feelScoreRow}>
                  <View style={[styles.feelScoreBadge, { backgroundColor: 'rgba(230,52,98,0.1)', borderColor: ACCENT_COLOR }]}>
                    <Text style={[styles.feelScoreText, { color: ACCENT_COLOR }]}>{log.feel}</Text>
                  </View>
                  <Text style={[styles.feelScoreMax, { color: theme.textSecondary }]}>/ 5 score</Text>
                </View>
              </View>
            </View>

            {/* Focus Goal Section */}
            {log.round_focus ? (
              <View style={[styles.detailFocusBox, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.detailMetaLabel, { color: theme.textSecondary, marginBottom: 4 }]}>ROUND FOCUS GOAL</Text>
                <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 13, color: theme.text, lineHeight: 18 }}>
                  {log.round_focus}
                </Text>
              </View>
            ) : null}

            {/* Action Buttons Row: Share + Edit */}
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginVertical: Spacing.two, paddingHorizontal: Spacing.two }}>
              <TouchableOpacity 
                style={[styles.shareRoundButton, { borderColor: theme.backgroundElement, flex: 1 }]} 
                activeOpacity={0.8}
                onPress={() => alert('Share sheet coming soon!')}>
                <Ionicons name="share-outline" size={14} color={theme.text} />
                <Text style={[styles.shareRoundButtonText, { color: theme.text }]} numberOfLines={1}>
                  Share Summary
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.shareRoundButton, 
                  { 
                    borderColor: theme.backgroundElement, 
                    backgroundColor: theme.backgroundElement, 
                    flex: 1 
                  }
                ]} 
                activeOpacity={0.8}
                onPress={() => onEdit(log)}>
                <Ionicons name="create-outline" size={14} color={theme.text} />
                <Text style={[styles.shareRoundButtonText, { color: theme.text }]} numberOfLines={1}>
                  Edit Log
                </Text>
              </TouchableOpacity>
            </View>

            {/* Visual Flow Chart Graph */}
            {log.bjj_round_events && log.bjj_round_events.length > 0 && (
              <View style={[styles.graphContainer, { backgroundColor: theme.backgroundElement }]}>
                <Text style={[styles.graphTitle, { color: theme.textSecondary }]}>VISUAL FLOW GRAPH</Text>
                
                {(() => {
                  const events = log.bjj_round_events;
                  const renderedFlow: React.ReactNode[] = [];
                  
                  const initialState = events.find(e => e.action_type === 'Initial State');
                  const initialPos = initialState ? initialState.resulting_position : 'Standing / Takedown Phase';
                  
                  renderedFlow.push(
                    <View key="node-init" style={[styles.graphNodePosition, { backgroundColor: theme.background }]}>
                      <Ionicons name="ellipse" size={8} color={theme.textSecondary} style={{ marginRight: 4 }} />
                      <Text style={[styles.graphNodeText, { color: theme.text }]}>{initialPos}</Text>
                    </View>
                  );
                  
                  events.filter(e => e.action_type !== 'Initial State').forEach((event, idx) => {
                    const isSub = event.action_type === 'Submission Finish';
                    const verb = getActionVerb(event.action_type);
                    
                    renderedFlow.push(
                      <View key={`edge-${idx}`} style={styles.graphEdgeContainer}>
                        <View style={[styles.graphEdgeLine, { backgroundColor: theme.textSecondary + '22' }]} />
                        <View style={[styles.graphMoveChip, { borderColor: isSub ? ACCENT_COLOR : theme.textSecondary + '22', backgroundColor: theme.background }]}>
                          <Text style={[styles.graphMoveActor, { color: event.who === 'I' ? theme.text : theme.textSecondary }]}>
                            {event.who === 'I' ? 'YOU' : 'OPPONENT'}
                          </Text>
                          <Text style={[styles.graphMoveAction, { color: isSub ? ACCENT_COLOR : theme.text }]}>
                            {verb} {event.move_name ? `via ${event.move_name}` : ''}
                          </Text>
                        </View>
                        <View style={[styles.graphEdgeLine, { backgroundColor: theme.textSecondary + '22' }]} />
                      </View>
                    );
                    
                    const isTappedOut = event.resulting_position === 'Tapped Out';
                    renderedFlow.push(
                      <View 
                        key={`node-${idx}`} 
                        style={[
                          isTappedOut ? styles.graphNodeSubmission : styles.graphNodePosition,
                          { backgroundColor: isTappedOut ? 'rgba(230,52,98,0.06)' : theme.background, borderColor: isTappedOut ? ACCENT_COLOR : 'transparent' }
                        ]}>
                        <Ionicons 
                          name={isTappedOut ? "flash" : "ellipse"} 
                          size={isTappedOut ? 12 : 8} 
                          color={isTappedOut ? ACCENT_COLOR : theme.textSecondary} 
                          style={{ marginRight: 4 }}
                        />
                        <Text 
                          style={[
                            styles.graphNodeText, 
                            { color: isTappedOut ? ACCENT_COLOR : theme.text, fontFamily: isTappedOut ? 'Pliant-Bold' : 'Pliant-Regular' }
                          ]}>
                          {isTappedOut 
                            ? (event.who === 'I' ? 'Opponent Tapped Out' : 'You Tapped Out') 
                            : invertPerspective(event.resulting_position, event.who)
                          }
                        </Text>
                      </View>
                    );
                  });
                  
                  return renderedFlow;
                })()}
              </View>
            )}

            {/* Locker room memo */}
            {log.locker_room_memo ? (
              <View style={[styles.lockerMemoBox, { backgroundColor: theme.backgroundElement, marginTop: Spacing.four }]}>
                <Text style={[styles.detailMetaLabel, { color: theme.textSecondary, marginBottom: Spacing.one }]}>LOCKER ROOM MEMO</Text>
                <Text style={{ fontFamily: 'Pliant-Regular', fontSize: 13, color: theme.textSecondary, lineHeight: 18 }}>
                  {log.locker_room_memo}
                </Text>
              </View>
            ) : null}
          </ScrollView>
        </ThemedView>
      </View>
    </Modal>
  );
}
