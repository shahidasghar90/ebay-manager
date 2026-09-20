import PageHeader from '@/components/PageHeader';
import ProductForm from '../ProductForm';

export default function NewProductPage() {
  return (
    <div>
      <PageHeader
        title="Add Product"
        subtitle="New, used, refurbished, stock or dropship product"
      />
      <ProductForm />
    </div>
  );
}
