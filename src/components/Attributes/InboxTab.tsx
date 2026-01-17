import { useState, useEffect } from 'react';
import {
  useAttributeStore,
  InboxItem,
} from '../../stores/attributeStore';
import { Inbox, Link2, Plus, Search, CheckCircle, AlertCircle, X, Loader } from 'lucide-react';

interface InboxTabProps {
  supplierId?: string;
}

export function InboxTab({ supplierId }: InboxTabProps) {
  const {
    inbox,
    dictionary,
    loading,
    loadInbox,
    searchDictionary,
    linkInboxToAttribute,
    createAttributeFromInbox,
    getDictionaryAttribute,
  } = useAttributeStore();

  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [actionMode, setActionMode] = useState<'link' | 'create' | null>(null);
  const [internalCategoryId, setInternalCategoryId] = useState<string>('');

  useEffect(() => {
    loadInbox(supplierId);
  }, [supplierId, loadInbox]);

  const handleLink = (item: InboxItem) => {
    setSelectedItem(item);
    setActionMode('link');
  };

  const handleCreate = (item: InboxItem) => {
    setSelectedItem(item);
    setActionMode('create');
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
          <p className="text-gray-600">Загрузка неопознанных атрибутов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Inbox className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-bold text-gray-900">Неопознанные атрибуты</h2>
          </div>
          <p className="text-sm text-gray-600">
            Атрибуты от поставщиков, которые еще не связаны с мастер-атрибутами
          </p>
        </div>

        <div className="text-sm text-gray-600">
          Найдено: {inbox.length} неопознанных атрибутов
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название атрибута
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Поставщик
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Категория
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Частота
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Примеры значений
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {inbox.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{item.attribute_name}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.supplier_name || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{item.category_name || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                      {item.frequency_count}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {item.example_values && item.example_values.length > 0
                      ? item.example_values.slice(0, 2).join(', ')
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleLink(item)}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                        title="Связать с существующим атрибутом"
                      >
                        <Link2 className="w-3 h-3" />
                        Связать
                      </button>
                      <button
                        onClick={() => handleCreate(item)}
                        className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                        title="Создать новый атрибут"
                      >
                        <Plus className="w-3 h-3" />
                        Создать
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {inbox.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Все атрибуты обработаны</p>
            </div>
          )}
        </div>
      </div>

      {actionMode === 'link' && selectedItem && (
        <LinkAttributeDialog
          item={selectedItem}
          dictionary={dictionary}
          searchDictionary={searchDictionary}
          onLink={async (attrId) => {
            await linkInboxToAttribute(selectedItem.id, attrId);
            await loadInbox(supplierId);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}

      {actionMode === 'create' && selectedItem && (
        <CreateAttributeDialog
          item={selectedItem}
          onCreate={async (attribute) => {
            await createAttributeFromInbox(selectedItem.id, attribute);
            await loadInbox(supplierId);
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
  onLink: (attributeId: string) => void;
  onClose: () => void;
}

function LinkAttributeDialog({
  item,
  dictionary,
  searchDictionary,
  onLink,
  onClose,
}: LinkAttributeDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAttrId, setSelectedAttrId] = useState<string | null>(null);

  const results = searchQuery ? searchDictionary(searchQuery) : dictionary.slice(0, 20);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Связать с существующим атрибутом</h3>
            <p className="text-sm text-gray-600 mt-1">
              Связываем: <span className="font-medium">{item.attribute_name}</span>
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
              placeholder="Поиск по названию атрибута..."
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
                    <div className="font-medium text-gray-900">{attr.name}</div>
                    {attr.name_uk && (
                      <div className="text-sm text-gray-500 mt-0.5">{attr.name_uk}</div>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {attr.type}
                      </span>
                      {attr.unit && (
                        <span className="text-xs text-gray-600">({attr.unit})</span>
                      )}
                    </div>
                  </div>
                  {selectedAttrId === attr.id && (
                    <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  )}
                </div>
              </button>
            ))}
            {results.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Атрибуты не найдены
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => selectedAttrId && onLink(selectedAttrId)}
              disabled={!selectedAttrId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Связать атрибут
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Отмена
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
    internal_category_id: string;
    name: string;
    name_uk?: string;
    type: string;
    unit?: string;
    synonyms?: string[];
  }) => void;
  onClose: () => void;
}

function CreateAttributeDialog({ item, onCreate, onClose }: CreateAttributeDialogProps) {
  const [name, setName] = useState(item.attribute_name);
  const [nameUk, setNameUk] = useState('');
  const [type, setType] = useState('text');
  const [unit, setUnit] = useState('');
  const [internalCategoryId, setInternalCategoryId] = useState('');

  const handleCreate = () => {
    if (!name || !internalCategoryId) {
      alert('Название и категория обязательны');
      return;
    }

    onCreate({
      internal_category_id: internalCategoryId,
      name,
      name_uk: nameUk || undefined,
      type,
      unit: unit || undefined,
      synonyms: [item.attribute_name],
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Создать новый атрибут</h3>
            <p className="text-sm text-gray-600 mt-1">
              Из: <span className="font-medium">{item.attribute_name}</span>
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
              Название (Русский) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Название (Украинский)</label>
            <input
              type="text"
              value={nameUk}
              onChange={(e) => setNameUk(e.target.value)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Единица (необязательно)</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="например: кг, мм, Вт"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID внутренней категории <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={internalCategoryId}
              onChange={(e) => setInternalCategoryId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="UUID категории"
            />
            <p className="text-xs text-gray-500 mt-1">
              Атрибут будет создан в указанной категории
            </p>
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                Новый атрибут будет добавлен в справочник и автоматически связан с этим атрибутом поставщика.
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCreate}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Создать атрибут
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
