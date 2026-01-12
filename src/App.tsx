import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Auth/Login';
import { Dashboard } from './components/Layout/Dashboard';
import { Import } from './components/Import/Import';
import { ImportHistory } from './components/Import/ImportHistory';
import { ImportDetailsView } from './components/Import/ImportDetails';
import { ProductsList } from './components/Products/ProductsList';
import { ProductDetails } from './components/Products/ProductDetails';
import { CategoryMapping } from './components/Categories/CategoryMapping';
import { SupplierCategoryTree } from './components/Categories/SupplierCategoryTree';
import { Export } from './components/Export/Export';
import { CategoryQualityTemplates } from './components/Quality/CategoryQualityTemplates';
import { QualityLogs } from './components/Quality/QualityLogs';
import { AttributeSchemaManager } from './components/Attributes/AttributeSchemaManager';

function AppContent() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('import');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <Dashboard activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'import' && <Import />}
      {activeTab === 'import-history' && (
        <>
          {selectedImportId ? (
            <ImportDetailsView
              importId={selectedImportId}
              onBack={() => setSelectedImportId(null)}
            />
          ) : (
            <ImportHistory onSelectImport={setSelectedImportId} />
          )}
        </>
      )}
      {activeTab === 'products' && (
        <>
          <ProductsList onSelectProduct={setSelectedProductId} />
          {selectedProductId && (
            <ProductDetails
              productId={selectedProductId}
              onClose={() => setSelectedProductId(null)}
            />
          )}
        </>
      )}
      {activeTab === 'category-tree' && <SupplierCategoryTree />}
      {activeTab === 'mapping' && <CategoryMapping />}
      {activeTab === 'attribute-schema' && <AttributeSchemaManager />}
      {activeTab === 'quality-templates' && <CategoryQualityTemplates />}
      {activeTab === 'quality-logs' && <QualityLogs />}
      {activeTab === 'export' && <Export />}
    </Dashboard>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
