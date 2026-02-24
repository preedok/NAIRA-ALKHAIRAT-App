import React from 'react';
import BusWorkPage from './BusWorkPage';

/**
 * Halaman pekerjaan bus (invoice-based). Role bus: list invoice + detail + update status tiket & perjalanan.
 * embedInProducts: diterima saat dipanggil dari ProductsPage (tab), tidak mengubah tampilan.
 */
const BusPage: React.FC<{ embedInProducts?: boolean }> = () => <BusWorkPage />;

export default BusPage;
