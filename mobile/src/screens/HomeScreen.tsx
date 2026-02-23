import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import { invoicesApi, type InvoicesSummaryData } from '../api/client';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, COLORS } from '../constants';
import { formatIDR, formatDate } from '../utils/format';

type InvoiceItem = {
  id: string;
  invoice_number?: string;
  total_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  status?: string;
  due_date_dp?: string | null;
};

type RootStackParamList = {
  MainTabs: undefined;
  Orders: undefined;
  InvoiceDetail: { invoiceId: string };
};

export default function HomeScreen() {
  const { user } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'MainTabs'>>();
  const [summary, setSummary] = useState<InvoicesSummaryData | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<InvoiceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryRes, listRes] = await Promise.all([
        invoicesApi.getSummary({}),
        invoicesApi.list({ limit: 10, sort_by: 'created_at', sort_order: 'desc' }),
      ]);
      if (summaryRes.data?.success && summaryRes.data?.data) setSummary(summaryRes.data.data);
      if (listRes.data?.data) setRecentInvoices(Array.isArray(listRes.data.data) ? listRes.data.data : []);
      else setRecentInvoices([]);
    } catch {
      setSummary(null);
      setRecentInvoices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const pendingCount = summary
    ? (summary.by_invoice_status?.tentative || 0) + (summary.by_invoice_status?.partial_paid || 0)
    : 0;
  const pendingPayments = recentInvoices.filter((inv) => parseFloat(String(inv.remaining_amount || 0)) > 0);

  const openInvoice = (id: string) => {
    (navigation.getParent() as any)?.navigate?.('Orders', { screen: 'InvoiceDetail', params: { invoiceId: id } });
  };

  const goToOrders = () => {
    (navigation.getParent() as any)?.navigate?.('Orders');
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Memuat dashboard...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <Text style={styles.heroLabel}>Selamat datang</Text>
        <Text style={styles.heroTitle}>
          {user?.name || user?.company_name || 'Owner'}
        </Text>
        <Text style={styles.heroSubtitle}>Kelola order & invoice Anda di sini</Text>
      </View>

      {/* Stat cards */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCard1]}>
          <Text style={styles.statValue}>{summary?.total_orders ?? 0}</Text>
          <Text style={styles.statTitle}>Total Order</Text>
        </View>
        <View style={[styles.statCard, styles.statCard2]}>
          <Text style={styles.statValue}>{summary?.total_invoices ?? 0}</Text>
          <Text style={styles.statTitle}>Total Invoice</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={[styles.statCard, styles.statCard3]}>
          <Text style={styles.statValueSmall}>{formatIDR(summary?.total_paid ?? 0)}</Text>
          <Text style={styles.statTitle}>Total Dibayar</Text>
        </View>
        <View style={[styles.statCard, styles.statCard4]}>
          <Text style={styles.statValue}>{pendingCount}</Text>
          <Text style={styles.statTitle}>Belum Lunas</Text>
          <Text style={styles.statSubtitle}>{formatIDR(summary?.total_remaining ?? 0)}</Text>
        </View>
      </View>

      {/* Quick actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Aksi Cepat</Text>
        <View style={styles.quickRow}>
          <TouchableOpacity style={styles.quickBtn} onPress={goToOrders}>
            <Text style={styles.quickBtnText}>Order & Invoice</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => (navigation.getParent() as any)?.navigate?.('Products')}
          >
            <Text style={styles.quickBtnText}>Produk</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Invoice & Order Saya (recent) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Invoice & Order Terbaru</Text>
        {recentInvoices.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.emptyText}>Belum ada invoice</Text>
          </View>
        ) : (
          recentInvoices.slice(0, 5).map((inv) => (
            <TouchableOpacity
              key={inv.id}
              style={styles.card}
              onPress={() => openInvoice(inv.id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardNumber}>{inv.invoice_number || inv.id}</Text>
                <View style={[styles.badge, { backgroundColor: INVOICE_STATUS_COLORS[inv.status || ''] || COLORS.textSecondary }]}>
                  <Text style={styles.badgeText}>{INVOICE_STATUS_LABELS[inv.status || ''] || inv.status || '-'}</Text>
                </View>
              </View>
              <Text style={styles.cardAmount}>Total: {formatIDR(Number(inv.total_amount))}</Text>
              <Text style={styles.cardPaid}>Dibayar: {formatIDR(Number(inv.paid_amount))}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Pembayaran Tertunda */}
      {pendingPayments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pembayaran Tertunda</Text>
          {pendingPayments.slice(0, 5).map((inv) => (
            <TouchableOpacity
              key={inv.id}
              style={[styles.card, styles.pendingCard]}
              onPress={() => openInvoice(inv.id)}
              activeOpacity={0.7}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardNumber}>{inv.invoice_number || inv.id}</Text>
                <Text style={styles.dueLabel}>Jatuh tempo: {formatDate(inv.due_date_dp ?? null)}</Text>
              </View>
              <Text style={styles.remainingAmount}>Sisa: {formatIDR(Number(inv.remaining_amount))}</Text>
              <TouchableOpacity
                style={styles.uploadCta}
                onPress={() => openInvoice(inv.id)}
              >
                <Text style={styles.uploadCtaText}>Upload Bukti Bayar</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 24 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  loadingText: { marginTop: 12, color: COLORS.textSecondary },
  hero: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  heroLabel: { fontSize: 12, fontWeight: '600', color: 'rgba(255,255,255,0.9)', letterSpacing: 0.5 },
  heroTitle: { fontSize: 22, fontWeight: '700', color: '#fff', marginTop: 4 },
  heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statCard1: { borderLeftWidth: 4, borderLeftColor: '#059669' },
  statCard2: { borderLeftWidth: 4, borderLeftColor: '#7c3aed' },
  statCard3: { borderLeftWidth: 4, borderLeftColor: '#0ea5e9' },
  statCard4: { borderLeftWidth: 4, borderLeftColor: '#d97706' },
  statValue: { fontSize: 20, fontWeight: '700', color: COLORS.text },
  statValueSmall: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  statTitle: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  statSubtitle: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  quickBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardNumber: { fontSize: 15, fontWeight: '600', color: COLORS.text },
  cardAmount: { fontSize: 13, color: COLORS.textSecondary },
  cardPaid: { fontSize: 13, color: COLORS.primary, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
  emptyText: { color: COLORS.textSecondary, textAlign: 'center', padding: 8 },
  pendingCard: { borderLeftWidth: 4, borderLeftColor: COLORS.warning },
  dueLabel: { fontSize: 12, color: COLORS.textSecondary },
  remainingAmount: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginTop: 4 },
  uploadCta: {
    marginTop: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  uploadCtaText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  bottomPad: { height: 24 },
});
