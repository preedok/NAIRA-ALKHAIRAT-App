import { useEffect, useState } from 'react';
import { api } from '../../../services/api';

interface FlyerItem {
  id: string;
  title: string;
  format: string;
  file_type: string;
  file_url: string;
  download_count: number;
  is_active: boolean;
}

export default function FlyersPage() {
  const [items, setItems] = useState<FlyerItem[]>([]);

  useEffect(() => {
    api.get('/flyers').then((res) => setItems(res?.data?.data || [])).catch(() => setItems([]));
  }, []);

  return (
    <div>
      <h2>Flyer Promosi</h2>
      <p>Galeri flyer untuk dibagikan ke calon jamaah.</p>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            {it.title} - {it.format} - download: {it.download_count}
          </li>
        ))}
      </ul>
    </div>
  );
}
