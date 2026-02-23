import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { productsApi } from '../api/client';
import { COLORS } from '../constants';

type Product = { id: string; name?: string; type?: string; code?: string };

export default function ProductsScreen() {
  const [list, setList] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await productsApi.list({ limit: 50 });
      if (res.data?.data) setList(Array.isArray(res.data.data) ? res.data.data : []);
      else setList([]);
    } catch {
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Memuat produk...</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={list}
      keyExtractor={(item: Product) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Belum ada produk</Text>
          <Text style={styles.emptySubtext}>Katalog akan tampil di sini</Text>
        </View>
      }
      renderItem={({ item }: { item: Product }) => (
        <View style={styles.item}>
          <View style={styles.itemAccent} />
          <Text style={styles.itemName}>{item.name || item.code || item.id}</Text>
          {item.type ? (
            <View style={styles.typeChip}>
              <Text style={styles.itemType}>{item.type}</Text>
            </View>
          ) : null}
        </View>
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
  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
  emptySubtext: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
  item: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  itemAccent: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: COLORS.primary,
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  itemName: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  typeChip: {
    alignSelf: 'flex-start',
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: COLORS.primaryLight,
  },
  itemType: { fontSize: 12, fontWeight: '500', color: COLORS.primary },
});
