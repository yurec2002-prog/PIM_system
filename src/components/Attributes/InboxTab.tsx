import { useState, useEffect } from 'react';
import {
  useAttributeStore,
  InboxItem,
  InboxStatus,
} from '../../stores/attributeStore';
import { Inbox, Link2, Plus, Search, CheckCircle, AlertCircle, X, Loader, XCircle, Filter, Zap, RefreshCw } from 'lucide-react';

interface InboxTabProps {
  supplierId?: string;
}

export function InboxTab({ supplierId }: InboxTabProps) {
  const {
    inbox,
    dictionary,
    loading,
    loadInbox,
    loadDictionary,
    searchDictionary,
    linkInboxToAttribute,
    linkSuggestedAttribute,
    batchLinkSuggested,
    createAttributeFromInbox,
    ignoreInboxItem,
    refreshSuggestions,
  } = useAttributeStore();

  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [actionMode, setActionMode] = useState<'link' | 'create' | null>(null);
  const [statusFilter, setStatusFilter] = useState<InboxStatus | 'all'>('new');
  const [showOnlyWithSuggestions, setShowOnlyWithSuggestions] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  useEffect(() => {
    loadDictionary();
  }, [loadDictionary]);

  useEffect(() => {
    loadInbox(supplierId, statusFilter);
  }, [supplierId, statusFilter, loadInbox]);

  const filteredInbox = showOnlyWithSuggestions
    ? inbox.filter(item => item.suggested_attribute_id)
    : inbox;

  const handleLink = (item: InboxItem) => {
    setSelectedItem(item);
    setActionMode('link');
  };

  const handleLinkSuggested = async (item: InboxItem) => {
    if (!item.suggested_attribute_id) return;

    await linkSuggestedAttribute(item.id);
    await loadInbox(supplierId, statusFilter);
  };

  const handleCreate = (item: InboxItem) => {
    setSelectedItem(item);
    setActionMode('create');
  };

  const handleIgnore = async (item: InboxItem) => {
    if (confirm(`Ігнорувати атрибут "${item.raw_name}"?`)) {
      await ignoreInboxItem(item.id);
      await loadInbox(supplierId, statusFilter);
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredInbox.filter(i => i.status === 'new' && i.suggested_attribute_id).map(i => i.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleBatchLink = async () => {
    if (selectedIds.size === 0) return;

    if (!confirm(`Зв'язати ${selectedIds.size} атрибутів з пропонованими?`)) return;

    setBatchProcessing(true);
    const result = await batchLinkSuggested(Array.from(selectedIds));
    setBatchProcessing(false);
    setSelectedIds(new Set());

    if (result) {
      alert(`Успішно: ${result.success}, Помилок: ${result.failed}`);
      await loadInbox(supplierId, statusFilter);
    }
  };

  const handleRefreshSuggestions = async () => {
    if (!confirm('Оновити пропозиції для всіх нових атрибутів?')) return;
    await refreshSuggestions();
    await loadInbox(supplierId, statusFilter);
  };

  const closeDialog = () => {
    setSelectedItem(null);
    setActionMode(null);
  };

  if (loading && inbox.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Завантаження нерозпізнаних атрибутів...</p>
        </div>
      </div>
    );
  }

  const itemsWithSuggestions = filteredInbox.filter(i => i.status === 'new' && i.suggested_attribute_id).length;

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Inbox className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-bold text-gray-900">Inbox: Нерозпізнані атрибути</h2>
          </div>
          <p className="text-sm text-gray-600">
            Атрибути з імпорту, які потрібно зв'язати (Link) або створити (Create) у глобальному довіднику
          </p>
        </div>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InboxStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Всі статуси</option>
            <option value="new">New (нові)</option>
            <option value="linked">Linked (зв'язані)</option>
            <option value="created">Created (створені)</option>
            <option value="ignored">Ignored (ігноровані)</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={showOnlyWithSuggestions}
              onChange={(e) => setShowOnlyWithSuggestions(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">З пропозиціями</span>
          </label>

          {statusFilter === 'new' && itemsWithSuggestions > 0 && (
            <>
              <div className="ml-auto flex items-center gap-2">
                {selectedIds.size > 0 && (
                  <>
                    <span className="text-sm text-gray-600">
                      Обрано: {selectedIds.size}
                    </span>
                    <button
                      onClick={handleBatchLink}
                      disabled={batchProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      <Zap className="w-4 h-4" />
                      {batchProcessing ? 'Обробка...' : 'Link всі обрані'}
                    </button>
                  </>
                )}
                <button
                  onClick={handleRefreshSuggestions}
                  className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm"
                  title="Оновити пропозиції"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>

        <div className="text-sm text-gray-600">
          Знайдено: {filteredInbox.length} атрибутів
          {itemsWithSuggestions > 0 && ` (${itemsWithSuggestions} з пропозиціями)`}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {statusFilter === 'new' && (
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      checked={selectedIds.size > 0 && selectedIds.size === itemsWithSuggestions}
                      className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                      title="Обрати всі з пропозиціями"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Raw Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Suggested Match
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Постачальник
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Frequency
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дії
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInbox.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  {statusFilter === 'new' && (
                    <td className="px-4 py-3">
                      {item.suggested_attribute_id && (
                        <input
                          type="checkbox"
                          checked={selectedIds.has(item.id)}
                          onChange={(e) => handleSelectItem(item.id, e.target.checked)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{item.raw_name}</div>
                    {item.examples && item.examples.length > 0 && (
                      <div className="text-xs text-gray-500 mt-1">
                        Приклади: {item.examples.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {item.suggested_attribute ? (
                      <div>
                        <div className="text-sm font-medium text-blue-700">
                          {item.suggested_attribute.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="text-xs bg-gray-100 px-1 py-0.5 rounded text-gray-600">
                            {item.suggested_attribute.key}
                          </code>
                          {item.suggested_confidence && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                              item.suggested_confidence >= 0.9 ? 'bg-green-100 text-green-700' :
                              item.suggested_confidence >= 0.7 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-orange-100 text-orange-700'
                            }`}>
                              {(item.suggested_confidence * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">Немає пропозиції</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.supplier_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {item.frequency}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      item.status === 'new' ? 'bg-orange-100 text-orange-800' :
                      item.status === 'linked' ? 'bg-blue-100 text-blue-800' :
                      item.status === 'created' ? 'bg-green-100 text-green-800' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {item.status === 'new' ? (
                      <div className="flex items-center gap-2">
                        {item.suggested_attribute_id && (
                          <button
                            onClick={() => handleLinkSuggested(item)}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs font-medium"
            title="Швидко зв'язати з пропонованим"
                          >
                            <Zap className="w-3 h-3" />
                            Quick Link
                          </button>
                        )}
                        <button
                          onClick={() => handleLink(item)}
                          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                          title="Зв'язати з існуючим атрибутом"
                        >
                          <Link2 className="w-3 h-3" />
                          Link
                        </button>
                        <button
                          onClick={() => handleCreate(item)}
                          className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700 text-xs"
                          title="Створити новий глобальний атрибут"
                        >
                          <Plus className="w-3 h-3" />
                          Create
                        </button>
                        <button
                          onClick={() => handleIgnore(item)}
                          className="flex items-center gap-1 px-2 py-1 bg-gray-400 text-white rounded hover:bg-gray-500 text-xs"
                          title="Ігнорувати"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-500">Оброблений</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredInbox.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>
                {statusFilter === 'new'
                  ? showOnlyWithSuggestions
                    ? 'Немає атрибутів з пропозиціями'
                    : 'Всі нові атрибути оброблені'
                  : 'Атрибути не знайдено'}
              </p>
            </div>
          )}
        </div>
      </div>

      {actionMode === 'link' && selectedItem && (
        <LinkAttributeDialog
          item={selectedItem}
          dictionary={dictionary}
          searchDictionary={searchDictionary}
          onLink={async (attrId, createAlias) => {
            await linkInboxToAttribute(selectedItem.id, attrId, createAlias);
            await loadInbox(supplierId, statusFilter);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}

      {actionMode === 'create' && selectedItem && (
        <CreateAttributeDialog
          item={selectedItem}
          onCreate={async (attribute) => {
            await createAttributeFromInbox(selectedItem.id, attribute, selectedItem.supplier_id);
            await loadInbox(supplierId, statusFilter);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}

interface LinkAttributeDialogProps {
  item: InboxItem;
  dictionary: any[];
  searchDictionary: (query: string) => any[];
  onLink: (attributeId: string, createAlias: boolean) => void;
  onClose: () => void;
}

function LinkAttributeDialog({
  item,
  dictionary,
  searchDictionary,
  onLink,
  onClose,
}: LinkAttributeDialogProps) {
  const [searchQuery, setSearchQuery] = useState(item.raw_name);
  const [selectedAttrId, setSelectedAttrId] = useState<string | null>(
    item.suggested_attribute_id || null
  );
  const [createAlias, setCreateAlias] = useState(true);

  const results = searchQuery ? searchDictionary(searchQuery) : dictionary.slice(0, 20);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Link: Зв'язати з існуючим атрибутом</h3>
            <p className="text-sm text-gray-600 mt-1">
              Raw name: <span className="font-medium text-orange-700">{item.raw_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Пошук у глобальному довіднику..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto">
            {results.map((attr) => (
              <button
                key={attr.id}
                onClick={() => setSelectedAttrId(attr.id)}
                className={`w-full text-left p-3 rounded-lg border-2 transition-colors ${
                  selectedAttrId === attr.id
                    ? 'border-blue-600 bg-blue-50'
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{attr.name_uk || attr.name}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                        {attr.key}
                      </code>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {attr.type}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        attr.source === 'sandi' ? 'bg-purple-100 text-purple-800' :
                        attr.source === 'manual' ? 'bg-green-100 text-green-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {attr.source}
                      </span>
                    </div>
                    {attr.aliases && attr.aliases.length > 0 && (
                      <div className="text-xs text-gray-500 mt-2">
                        Синоніми: {attr.aliases.slice(0, 3).map((a: any) => a.text).join(', ')}
                      </div>
                    )}
                  </div>
                  {selectedAttrId === attr.id && (
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Атрибути не знайдено
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={createAlias}
                onChange={(e) => setCreateAlias(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">
                Створити синонім (додати "{item.raw_name}" як синонім обраного атрибута)
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => selectedAttrId && onLink(selectedAttrId, createAlias)}
              disabled={!selectedAttrId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Зв'язати атрибут
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CreateAttributeDialogProps {
  item: InboxItem;
  onCreate: (attribute: {
    name: string;
    name_uk?: string;
    type: string;
    unit_kind?: string;
    default_unit?: string;
  }) => void;
  onClose: () => void;
}

function CreateAttributeDialog({ item, onCreate, onClose }: CreateAttributeDialogProps) {
  const [nameUk, setNameUk] = useState(item.raw_name);
  const [name, setName] = useState('');
  const [type, setType] = useState('text');
  const [unitKind, setUnitKind] = useState('');
  const [defaultUnit, setDefaultUnit] = useState('');

  const handleCreate = () => {
    if (!nameUk) {
      alert('Назва (Українська) обов\'язкова');
      return;
    }

    onCreate({
      name: name || undefined,
      name_uk: nameUk,
      type,
      unit_kind: unitKind || undefined,
      default_unit: defaultUnit || undefined,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Create: Створити новий глобальний атрибут</h3>
            <p className="text-sm text-gray-600 mt-1">
              Из raw: <span className="font-medium text-orange-700">{item.raw_name}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Назва (Українська) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={nameUk}
              onChange={(e) => setNameUk(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Назва (Російська)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Тип</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="text">Text</option>
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="enum">Enum</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Kind (необов'язково)</label>
              <input
                type="text"
                value={unitKind}
                onChange={(e) => setUnitKind(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="weight, length, power..."
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Unit (необов'язково)</label>
            <input
              type="text"
              value={defaultUnit}
              onChange={(e) => setDefaultUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="например: кг, мм, Вт"
            />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-green-800">
                <div className="font-medium mb-1">Що буде створено:</div>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Новий атрибут у глобальному довіднику (master_attributes)</li>
                  <li>Key буде згенеровано автоматично: supplier:{'{supplier_id}'}:{'{normalized_name}'}</li>
                  <li>Source = supplier, needs_review = true</li>
                  <li>Синонім "{item.raw_name}" буде додано автоматично</li>
                  <li>Inbox item буде позначено як "created" і зв'язано з новим атрибутом</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCreate}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Створити глобальний атрибут
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Скасувати
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
