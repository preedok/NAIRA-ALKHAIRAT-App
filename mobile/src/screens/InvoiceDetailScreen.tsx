import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  RefreshControl,
  Linking,
  Alert,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { API_BASE_URL } from '../config';
import { invoicesApi } from '../api/client';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, COLORS } from '../constants';
import { formatIDR, formatDate } from '../utils/format';

type InvoiceDetailParams = { invoiceId: string };

export default function InvoiceDetailScreen() {
  const route = useRoute<RouteProp<{ InvoiceDetail: InvoiceDetailParams }, 'InvoiceDetail'>>();
  const navigation = useNavigation();
  const invoiceId = route.params?.invoiceId ?? '';
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!invoiceId) return;
    try {
      const res = await invoicesApi.getById(invoiceId);
      if (res.data?.success && res.data?.data) setData(res.data.data);
      else setData(null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openPdf = () => {
    const url = `${API_BASE_URL}/invoices/${invoiceId}/pdf`;
    Linking.openURL(url).catch(() => Alert.alert('Info', 'Untuk unduh PDF, buka dari aplikasi web dengan login yang sama.'));
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Memuat detail invoice...</Text>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Invoice tidak ditemukan</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const inv = data;
  const order = data.Order;
  const status = inv.status || '';
  const remaining = parseFloat(String(inv.remaining_amount || 0));
  const canUpload = remaining > 0 && !['paid', 'completed', 'canceled', 'cancelled'].includes(status);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.label}>No. Invoice</Text>
          <Text style={styles.value}>{inv.invoice_number || inv.id}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Status</Text>
          <View style={[styles.badge, { backgroundColor: INVOICE_STATUS_COLORS[status] || COLORS.textSecondary }]}>
            <Text style={styles.badgeText}>{INVOICE_STATUS_LABELS[status] || status || '-'}</Text>
          </View>
        </View>
        {order?.order_number && (
          <View style={styles.row}>
            <Text style={styles.label}>No. Order</Text>
            <Text style={styles.value}>{order.order_number}</Text>
          </View>
        )}
        {inv.issued_at && (
          <View style={styles.row}>
            <Text style={styles.label}>Tanggal terbit</Text>
            <Text style={styles.value}>{formatDate(inv.issued_at)}</Text>
          </View>
        )}
        {inv.due_date_dp && (
          <View style={styles.row}>
            <Text style={styles.label}>Jatuh tempo DP</Text>
            <Text style={styles.value}>{formatDate(inv.due_date_dp)}</Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ringkasan Pembayaran</Text>
        <View style={styles.row}>
          <Text style={styles.label}>Total tagihan</Text>
          <Text style={styles.value}>{formatIDR(Number(inv.total_amount))}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Sudah dibayar</Text>
          <Text style={[styles.value, { color: COLORS.success }]}>{formatIDR(Number(inv.paid_amount))}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Sisa</Text>
          <Text style={[styles.value, { color: remaining > 0 ? COLORS.warning : COLORS.success }]}>
            {formatIDR(Number(inv.remaining_amount))}
          </Text>
        </View>
      </View>

      {Array.isArray(inv.PaymentProofs) && inv.PaymentProofs.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Bukti pembayaran</Text>
          {inv.PaymentProofs.map((p: any, i: number) => (
            <View key={p.id || i} style={styles.proofRow}>
              <Text style={styles.proofText}>
                {p.verified_status === 'verified' ? '✓ Terverifikasi' : 'Menunggu verifikasi'} • {formatDate(p.created_at)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity style={styles.primaryBtn} onPress={openPdf}>
          <Text style={styles.primaryBtnText}>Lihat / Unduh PDF</Text>
        </TouchableOpacity>
        {canUpload && (
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={() => Alert.alert('Upload Bukti Bayar', 'Silakan buka aplikasi web untuk upload bukti bayar.')}
          >
            <Text style={styles.secondaryBtnText}>Upload Bukti Bayar (via Web)</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.bottomPad} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: 16, paddingBottom: 32 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 12, color: COLORS.textSecondary },
  errorText: { color: COLORS.textSecondary, textAlign: 'center' },
  backBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: COLORS.primary, borderRadius: 10 },
  backBtnText: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '600', color: COLORS.text, marginBottom: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  label: { fontSize: 13, color: COLORS.textSecondary },
  value: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: '600', color: '#fff' },
  proofRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  proofText: { fontSize: 13, color: COLORS.text },
  actions: { gap: 12 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  secondaryBtn: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 14 },
  bottomPad: { height: 24 },
});
