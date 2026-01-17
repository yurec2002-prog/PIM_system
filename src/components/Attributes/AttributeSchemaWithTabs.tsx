import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAttributeStore } from '../../stores/attributeStore';
import { Package, BookOpen, Inbox as InboxIcon } from 'lucide-react';
import { AttributeSchemaManager } from './AttributeSchemaManager';
import { DictionaryTab } from './DictionaryTab';
import { InboxTab } from './InboxTab';

type TabType = 'schema' | 'dictionary' | 'inbox';

export function AttributeSchemaWithTabs() {
  const [activeTab, setActiveTab] = useState<TabType>('schema');
  const [selectedSupplier, setSelectedSupplier] = useState<string>('');
  const [syncStats, setSyncStats] = useState<any>({
    total_products: 0,
    total_attributes: 0,
    total_categories: 0,
    mapped_attributes: 0,
    unmapped_attributes: 0,
  });

  const { dictionary, inbox, loadDictionary, loadInbox } = useAttributeStore();

  useEffect(() => {
    loadDictionary();
  }, [loadDictionary]);

  useEffect(() => {
    if (selectedSupplier) {
      loadSyncStats();
      loadInbox(selectedSupplier);
    }
  }, [selectedSupplier, loadInbox]);

  const loadSyncStats = async () => {
    const { count: productsCount } = await supabase
      .from('supplier_products')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier);

    const { count: categoriesCount } = await supabase
      .from('supplier_categories')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier);

    const { count: presenceCount } = await supabase
      .from('supplier_category_attribute_presence')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier);

    const { count: mappedCount } = await supabase
      .from('supplier_category_attribute_presence')
      .select('*', { count: 'exact', head: true })
      .eq('supplier_id', selectedSupplier)
      .not('mapped_master_attribute_id', 'is', null);

    const stats = {
      total_products: productsCount || 0,
      total_attributes: presenceCount || 0,
      total_categories: categoriesCount || 0,
      mapped_attributes: mappedCount || 0,
      unmapped_attributes: (presenceCount || 0) - (mappedCount || 0),
    };

    setSyncStats(stats);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-full mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Attribute Schema Manager</h1>
          <p className="text-gray-600">
            Manage attribute mappings, dictionary, and process unmapped attributes
          </p>
        </div>

        <div className="mb-6 grid grid-cols-5 gap-4">
          <div
            onClick={() => {}}
            className="bg-white rounded-lg border border-gray-200 p-3 cursor-default"
          >
            <div className="text-xs text-gray-500 mb-1">Products</div>
            <div className="text-lg font-bold text-gray-900">{syncStats.total_products}</div>
          </div>
          <div
            onClick={() => {}}
            className="bg-white rounded-lg border border-gray-200 p-3 cursor-default"
          >
            <div className="text-xs text-gray-500 mb-1">Categories</div>
            <div className="text-lg font-bold text-gray-900">{syncStats.total_categories}</div>
          </div>
          <div
            onClick={() => setActiveTab('dictionary')}
            className="bg-white rounded-lg border border-gray-200 p-3 cursor-pointer hover:border-blue-400 hover:shadow-md transition-all"
            title="Click to view Dictionary"
          >
            <div className="text-xs text-gray-500 mb-1">Attributes</div>
            <div className="text-lg font-bold text-gray-900">{dictionary.length}</div>
          </div>
          <div
            onClick={() => {}}
            className="bg-white rounded-lg border border-green-200 p-3 cursor-default"
          >
            <div className="text-xs text-green-600 mb-1">Mapped</div>
            <div className="text-lg font-bold text-green-700">{syncStats.mapped_attributes}</div>
          </div>
          <div
            onClick={() => {
              setActiveTab('inbox');
            }}
            className="bg-white rounded-lg border border-orange-200 p-3 cursor-pointer hover:border-orange-400 hover:shadow-md transition-all"
            title="Click to view Inbox"
          >
            <div className="text-xs text-orange-600 mb-1">Unmapped</div>
            <div className="text-lg font-bold text-orange-700">
              {inbox.length}
            </div>
          </div>
        </div>

        <div className="mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('schema')}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'schema'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Package className="w-5 h-5" />
                Schema Manager
              </button>
              <button
                onClick={() => setActiveTab('dictionary')}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'dictionary'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <BookOpen className="w-5 h-5" />
                Dictionary
                <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                  {dictionary.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('inbox')}
                className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === 'inbox'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <InboxIcon className="w-5 h-5" />
                Inbox
                {inbox.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded-full text-xs font-medium">
                    {inbox.length}
                  </span>
                )}
              </button>
            </nav>
          </div>
        </div>

        <div className="min-h-[600px]">
          {activeTab === 'schema' && (
            <SchemaManagerWrapper
              onSupplierChange={setSelectedSupplier}
              onStatsChange={setSyncStats}
            />
          )}
          {activeTab === 'dictionary' && <DictionaryTab />}
          {activeTab === 'inbox' && <InboxTab supplierId={selectedSupplier} />}
        </div>
      </div>
    </div>
  );
}

interface SchemaManagerWrapperProps {
  onSupplierChange: (supplierId: string) => void;
  onStatsChange: (stats: any) => void;
}

function SchemaManagerWrapper({ onSupplierChange, onStatsChange }: SchemaManagerWrapperProps) {
  return (
    <div className="-mt-6">
      <AttributeSchemaManager
        onSupplierChange={onSupplierChange}
        onStatsChange={onStatsChange}
      />
    </div>
  );
}
