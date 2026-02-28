import React from 'react';
import { ArrowDownLeft, ArrowUpRight, Building2 } from 'lucide-react';
import Card from '../../../components/common/Card';

const AccurateKasBankPage: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Kas & Bank</h2>
        <p className="text-sm text-slate-600 mt-0.5">Kas masuk / keluar, Rekonsiliasi bank, Multi rekening.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="p-5 border border-slate-200 opacity-75">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Kas Masuk</h3>
              <p className="text-sm text-slate-600 mt-0.5">Pencatatan penerimaan kas.</p>
              <span className="inline-block mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Segera hadir</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-slate-200 opacity-75">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Kas Keluar</h3>
              <p className="text-sm text-slate-600 mt-0.5">Pencatatan pengeluaran kas.</p>
              <span className="inline-block mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Segera hadir</span>
            </div>
          </div>
        </Card>

        <Card className="p-5 border border-slate-200 opacity-75 md:col-span-2 lg:col-span-1">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-500">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Multi Rekening</h3>
              <p className="text-sm text-slate-600 mt-0.5">Kelola beberapa rekening bank dan kas.</p>
              <span className="inline-block mt-2 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded">Segera hadir</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default AccurateKasBankPage;
