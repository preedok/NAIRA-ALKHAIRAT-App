import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { invoicesApi, type InvoicesSummaryData } from '../api/client';
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_COLORS, COLORS } from '../constants';
import { formatIDR } from '../utils/format';

type InvoiceItem = {
  id: string;
  invoice_number?: string;
  total_amount?: number;
  paid_amount?: number;
  remaining_amount?: number;
  status?: string;
};

type OrdersStackParamList = {
  OrdersList: undefined;
  InvoiceDetail: { invoiceId: string };
};

export default function OrdersScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<OrdersStackParamList, 'OrdersList'>>();
  const [list, setList] = useState<InvoiceItem[]>([]);
  const [summary, setSummary] = useState<InvoicesSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryRes, listRes] = await Promise.all([
        invoicesApi.getSummary({}),
        invoicesApi.list({ limit: 50, sort_by: 'created_at', sort_order: 'desc' }),
      ]);
      if (summaryRes.data?.success && summaryRes.data?.data) setSummary(summaryRes.data.data);
      if (listRes.data?.data) setList(Array.isArray(listRes.data.data) ? listRes.data.data : []);
      else setList([]);
    } catch {
      setList([]);
      setSummary(null);
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

  const openDetail = (id: string) => {
    navigation.navigate('InvoiceDetail', { invoiceId: id });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Memuat order & invoice...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        summary ? (
          <View style={styles.summaryStrip}>
            <Text style={styles.summaryTitle}>Ringkasan</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Order</Text>
              <Text style={styles.summaryValue}>{summary.total_orders ?? 0}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Invoice</Text>
              <Text style={styles.summaryValue}>{summary.total_invoices ?? 0}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Dibayar</Text>
              <Text style={[styles.summaryValue, { color: COLORS.success }]}>
                {formatIDR(summary.total_paid ?? 0)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Sisa</Text>
              <Text style={[styles.summaryValue, { color: COLORS.warning }]}>
                {formatIDR(summary.total_remaining ?? 0)}
              </Text>
            </View>
          </View>
        ) : null
      }
      ListEmptyComponent={<Text style={styles.empty}>Belum ada invoice</Text>}
      renderItem={({ item }: { item: InvoiceItem }) => (
        <TouchableOpacity
          style={styles.item}
          onPress={() => openDetail(item.id)}
          activeOpacity={0.7}
        >
          <View style={styles.itemRow}>
            <Text style={styles.itemNumber}>{item.invoice_number || item.id}</Text>
            <View
              style={[
                styles.badge,
                { backgroundColor: INVOICE_STATUS_COLORS[item.status || ''] || COLORS.textSecondary },
              ]}
            >
              <Text style={styles.badgeText}>
                {INVOICE_STATUS_LABELS[item.status || ''] || item.status || '-'}
              </Text>
            </View>
          </View>
          <Text style={styles.itemAmount}>Total: {formatIDR(Number(item.total_amount))}</Text>
          <Text style={styles.itemPaid}>Dibayar: {formatIDR(Number(item.paid_amount))}</Text>
          {parseFloat(String(item.remaining_amount || 0)) > 0 && (
            <Text style={styles.itemRemaining}>Sisa: {formatIDR(Number(item.remaining_amount))}</Text>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
  },
  loadingText: { marginTop: 12, color: COLORS.textSecondary },
  list: { padding: 16, paddingBottom: 40, backgroundColor: COLORS.background },
  summaryStrip: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.9)', marginBottom: 10 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  summaryLabel: { fontSize: 13, color: 'rgba(255,255,255,0.85)' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#fff' },
  empty: { textAlign: 'center', color: COLORS.textSecondary, padding: 24 },
  item: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  itemNumber: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  itemAmount: { fontSize: 14, color: COLORS.textSecondary },
  itemPaid: { fontSize: 14, color: COLORS.success, marginTop: 2 },
  itemRemaining: { fontSize: 13, color: COLORS.warning, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: '600', color: '#fff' },
});
