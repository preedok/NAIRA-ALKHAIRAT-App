import React from 'react';
import HotelWorkPage from './HotelWorkPage';

/**
 * Halaman pekerjaan hotel (invoice-based). Role hotel: list invoice + detail + update status kamar/meal.
 * embedInProducts: diterima saat dipanggil dari ProductsPage (tab), tidak mengubah tampilan.
 */
const HotelsPage: React.FC<{ embedInProducts?: boolean }> = () => <HotelWorkPage />;

export default HotelsPage;
