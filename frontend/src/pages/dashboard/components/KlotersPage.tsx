import { useEffect, useState } from 'react';
import { api } from '../../../services/api';

interface KloterItem {
  id: string;
  name: string;
  departure_date: string;
  return_date: string;
  departure_airport: string;
  capacity: number;
  filled_quota: number;
  status: string;
}

export default function KlotersPage() {
  const [items, setItems] = useState<KloterItem[]>([]);

  useEffect(() => {
    api.get('/kloters').then((res) => setItems(res?.data?.data || [])).catch(() => setItems([]));
  }, []);

  return (
    <div>
      <h2>Manajemen Kloter</h2>
      <p>Kelola kloter keberangkatan jamaah.</p>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            {it.name} | {it.departure_date} | kuota {it.filled_quota}/{it.capacity} | {it.status}
          </li>
        ))}
      </ul>
    </div>
  );
}
