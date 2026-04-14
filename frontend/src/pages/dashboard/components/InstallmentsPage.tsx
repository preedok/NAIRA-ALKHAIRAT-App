import { useEffect, useState } from 'react';
import { api } from '../../../services/api';

interface InstallmentItem {
  id: string;
  installment_no: number;
  amount: number;
  due_date: string;
  status: string;
}

interface InstallmentPlan {
  id: string;
  total_amount: number;
  installment_months: number;
  per_installment_amount: number;
  status: string;
  Items: InstallmentItem[];
}

export default function InstallmentsPage() {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);

  useEffect(() => {
    api.get('/installments/me').then((res) => setPlans(res?.data?.data || [])).catch(() => setPlans([]));
  }, []);

  return (
    <div>
      <h2>Jadwal Cicilan</h2>
      {plans.map((plan) => (
        <div key={plan.id}>
          <strong>{plan.installment_months} bulan</strong> - status {plan.status}
          <ul>
            {(plan.Items || []).map((item) => (
              <li key={item.id}>
                Cicilan #{item.installment_no}: Rp {Number(item.amount || 0).toLocaleString('id-ID')} - jatuh tempo {item.due_date} - {item.status}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
