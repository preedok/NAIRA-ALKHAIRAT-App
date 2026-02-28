import React from 'react';
import { Percent, FileText, Receipt, Download } from 'lucide-react';
import Card from '../../../components/common/Card';

const FEATURES = [
  { id: 'ppn', title: 'PPN', desc: 'Pengelolaan Pajak Pertambahan Nilai (PPN) masukan dan keluaran.', icon: Percent },
  { id: 'efaktur', title: 'e-Faktur', desc: 'Integrasi dan pengiriman faktur pajak elektronik (e-Faktur).', icon: FileText },
  { id: 'bukti-potong', title: 'Bukti Potong', desc: 'PPh pasal 21, 22, 23, 4(2) dan bukti potong lainnya.', icon: Receipt },
  { id: 'laporan-pajak', title: 'Laporan Pajak', desc: 'Laporan pajak siap ekspor untuk SPT dan pelaporan DJP.', icon: Download }
];

const AccuratePerpajakanPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Perpajakan</h2>
        <p className="text-sm text-slate-600 mt-0.5">PPN, e-Faktur, Bukti potong, Laporan pajak siap ekspor.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.id} className="p-5 border border-slate-200">
              <div className="flex items-start gap-3">
                <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600">
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <p className="text-sm text-slate-600 mt-0.5">{f.desc}</p>
                  <span className="inline-block mt-3 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-lg">Segera hadir</span>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default AccuratePerpajakanPage;
