import PageHeader from '@/components/PageHeader';
import AccountsForm from '../AccountsForm';

export default function NewAccountsTxPage() {
  return (
    <div>
      <PageHeader title="Add Transaction" subtitle="Record a manual income or expense" />
      <AccountsForm />
    </div>
  );
}
