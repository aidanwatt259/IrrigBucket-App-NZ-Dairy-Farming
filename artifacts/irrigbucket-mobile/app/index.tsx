import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColors } from '@/hooks/useColors';
import { useWizard } from '@/context/WizardContext';

interface IrrigatorType {
  id: string;
  name: string;
  desc: string;
  icon: keyof typeof Feather.glyphMap;
}

const IRRIGATOR_TYPES: IrrigatorType[] = [
  { id: 'pivot', name: 'Centre Pivot', desc: 'Rotating arm that sweeps in a circle', icon: 'refresh-cw' },
  { id: 'lateral', name: 'Lateral Move', desc: 'Linear system moving across paddock', icon: 'move' },
  { id: 'kline', name: 'K-Line / Pods', desc: 'Portable pod-based drip system', icon: 'grid' },
  { id: 'gun', name: 'Travelling Gun', desc: 'Single large sprinkler head on cart', icon: 'target' },
  { id: 'solid', name: 'Solid Set / Fixed', desc: 'Permanent fixed sprinkler grid', icon: 'layout' },
  { id: 'boom', name: 'Roto Rainer', desc: 'Rotating boom arm sprinkler system', icon: 'rotate-cw' },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setIrrigatorType, irrigatorType, savedReports } = useWizard();
  const topPad = Platform.OS === 'web' ? 67 : insets.top;
  const bottomPad = Platform.OS === 'web' ? 34 : insets.bottom;

  const handleSelect = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIrrigatorType(id);
  };

  const handleContinue = () => {
    if (!irrigatorType) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/setup');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.logoRow}>
          <View style={[styles.logoIcon, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="droplet" size={20} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground }]}>
            Irrig<Text style={{ color: colors.primary }}>Bucket</Text>
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={() => router.push('/account')}
            style={[styles.reportsBtn, { backgroundColor: colors.muted }]}
            activeOpacity={0.7}
            testID="account-button"
          >
            <Feather name="user" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/reports')}
            style={[styles.reportsBtn, { backgroundColor: colors.muted }]}
            activeOpacity={0.7}
            testID="reports-button"
          >
            <Feather name="file-text" size={18} color={colors.foreground} />
            {savedReports.length > 0 && (
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                  {savedReports.length}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scroll, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={[styles.hero, { backgroundColor: colors.primary + '0A' }]}>
          <View style={[styles.heroIcon, { backgroundColor: colors.primary + '18' }]}>
            <Feather name="droplet" size={40} color={colors.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: colors.foreground }]}>
            Perfect Bucket Tests,{'\n'}
            <Text style={{ color: colors.primary }}>Every Time.</Text>
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            Bucket count, spacing, and placement — calculated instantly for NZ dairy farmers.
          </Text>
        </View>

        {/* Section title */}
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Select your irrigator type</Text>

        {/* Grid */}
        <View style={styles.grid}>
          {IRRIGATOR_TYPES.map((type) => {
            const isSelected = irrigatorType === type.id;
            return (
              <TouchableOpacity
                key={type.id}
                onPress={() => handleSelect(type.id)}
                activeOpacity={0.8}
                testID={`irrigator-${type.id}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: isSelected ? colors.primary + '08' : colors.card,
                    borderColor: isSelected ? colors.primary : colors.border,
                    borderWidth: isSelected ? 2 : 1.5,
                  },
                ]}
              >
                <View style={[styles.cardIcon, { backgroundColor: isSelected ? colors.primary : colors.muted }]}>
                  <Feather name={type.icon} size={24} color={isSelected ? colors.primaryForeground : colors.foreground} />
                </View>
                <Text style={[styles.cardTitle, { color: colors.foreground }]}>{type.name}</Text>
                <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}>{type.desc}</Text>
                {isSelected && (
                  <View style={[styles.selectedDot, { backgroundColor: colors.primary }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* DairyNZ badge */}
        <View style={[styles.dairyBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.dairyDot, { backgroundColor: colors.primary + '20' }]}>
            <Feather name="check-circle" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.dairyText, { color: colors.foreground }]}>Follows DairyNZ testing protocols</Text>
        </View>
      </ScrollView>

      {/* Fixed bottom bar — Start Test button */}
      <View style={[
        styles.bottomBar,
        {
          paddingBottom: bottomPad + 12,
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        }
      ]}>
        {!irrigatorType && (
          <Text style={[styles.bottomHint, { color: colors.mutedForeground }]}>
            Select an irrigator type above to continue
          </Text>
        )}
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!irrigatorType}
          activeOpacity={0.8}
          testID="start-test-button"
          style={[
            styles.startBtn,
            {
              backgroundColor: irrigatorType ? colors.primary : colors.muted,
              opacity: irrigatorType ? 1 : 0.6,
            },
          ]}
        >
          <Text style={[styles.startBtnText, { color: irrigatorType ? colors.primaryForeground : colors.mutedForeground }]}>
            {irrigatorType ? `Start Test — ${IRRIGATOR_TYPES.find(t => t.id === irrigatorType)?.name ?? ''}` : 'Start Test'}
          </Text>
          <Feather name="arrow-right" size={18} color={irrigatorType ? colors.primaryForeground : colors.mutedForeground} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logoIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: 22, fontFamily: 'Outfit_700Bold', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  reportsBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { fontSize: 10, fontFamily: 'Inter_700Bold' },
  scrollView: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingTop: 0 },
  hero: {
    alignItems: 'center',
    paddingVertical: 36,
    marginHorizontal: -20,
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  heroIcon: { width: 80, height: 80, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroTitle: { fontSize: 30, fontFamily: 'Outfit_700Bold', textAlign: 'center', letterSpacing: -0.5, lineHeight: 38, marginBottom: 12 },
  heroSub: { fontSize: 15, fontFamily: 'Inter_400Regular', textAlign: 'center', lineHeight: 22, maxWidth: 300 },
  sectionTitle: { fontSize: 18, fontFamily: 'Outfit_700Bold', marginBottom: 16, letterSpacing: -0.3 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  card: {
    width: '47.5%',
    borderRadius: 16,
    padding: 16,
    alignItems: 'flex-start',
    position: 'relative',
  },
  cardIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  cardTitle: { fontSize: 14, fontFamily: 'Outfit_700Bold', marginBottom: 4, letterSpacing: -0.2 },
  cardDesc: { fontSize: 12, fontFamily: 'Inter_400Regular', lineHeight: 17 },
  selectedDot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
  dairyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 30,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignSelf: 'center',
    marginBottom: 16,
  },
  dairyDot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  dairyText: { fontSize: 13, fontFamily: 'Inter_500Medium' },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  bottomHint: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
    textAlign: 'center',
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 54,
    borderRadius: 14,
    paddingHorizontal: 24,
  },
  startBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.2,
  },
});
