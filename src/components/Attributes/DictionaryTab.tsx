import { useState, useEffect } from 'react';
import { useAttributeStore, DictionaryAttribute } from '../../stores/attributeStore';
import { Search, X, CheckCircle, AlertCircle, Package, Eye, Loader } from 'lucide-react';

interface DictionaryTabProps {
  initialSearch?: string;
}

export function DictionaryTab({ initialSearch = '' }: DictionaryTabProps) {
  const { dictionary, loading, loadDictionary, updateDictionaryAttribute } = useAttributeStore();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [requiredFilter, setRequiredFilter] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<DictionaryAttribute | null>(null);

  useEffect(() => {
    loadDictionary();
  }, [loadDictionary]);

  useEffect(() => {
    if (initialSearch) {
      setSearchQuery(initialSearch);
    }
  }, [initialSearch]);

  const filteredAttributes = dictionary.filter(attr => {
    if (typeFilter !== 'all' && attr.type !== typeFilter) return false;
    if (requiredFilter && !attr.is_required) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        attr.name.toLowerCase().includes(query) ||
        attr.name_uk?.toLowerCase().includes(query) ||
        (attr.synonyms || []).some(s => s.toLowerCase().includes(query))
      );
    }

    return true;
  });

  const handleToggleRequired = async (attrId: string, currentValue: boolean) => {
    await updateDictionaryAttribute(attrId, { is_required: !currentValue });
    loadDictionary();
  };

  if (loading && dictionary.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Загрузка атрибутов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Глобальный справочник атрибутов</h2>
          <p className="text-sm text-gray-600 mt-1">
            Мастер-список всех атрибутов без дублей
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все типы</option>
            <option value="text">Text</option>
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="enum">Enum</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={requiredFilter}
              onChange={(e) => setRequiredFilter(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Только обязательные</span>
          </label>
        </div>

        <div className="text-sm text-gray-600">
          Показано {filteredAttributes.length} из {dictionary.length} атрибутов
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название (RU)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Название (UK)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Единица
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Обязательный
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAttributes.map((attr) => (
                <tr
                  key={attr.id}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {attr.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {attr.name_uk || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {attr.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {attr.unit || '-'}
                  </td>
                  <td className="px-4 py-3">
                    {attr.is_required ? (
                      <button
                        onClick={() => handleToggleRequired(attr.id, attr.is_required)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
                      >
                        <AlertCircle className="w-3 h-3" />
                        Да
                      </button>
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedAttribute(attr)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="Просмотр деталей"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredAttributes.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Атрибуты не найдены</p>
            </div>
          )}
        </div>
      </div>

      {selectedAttribute && (
        <AttributeDetailsModal
          attribute={selectedAttribute}
          onClose={() => setSelectedAttribute(null)}
          onUpdate={async (updates) => {
            await updateDictionaryAttribute(selectedAttribute.id, updates);
            await loadDictionary();
            setSelectedAttribute({ ...selectedAttribute, ...updates });
          }}
        />
      )}
    </div>
  );
}

interface AttributeDetailsModalProps {
  attribute: DictionaryAttribute;
  onClose: () => void;
  onUpdate: (updates: Partial<DictionaryAttribute>) => void;
}

function AttributeDetailsModal({ attribute, onClose, onUpdate }: AttributeDetailsModalProps) {
  const [editedName, setEditedName] = useState(attribute.name);
  const [editedNameUk, setEditedNameUk] = useState(attribute.name_uk || '');
  const [editedUnit, setEditedUnit] = useState(attribute.unit || '');
  const [editedIsRequired, setEditedIsRequired] = useState(attribute.is_required);

  const handleSave = () => {
    onUpdate({
      name: editedName,
      name_uk: editedNameUk || undefined,
      unit: editedUnit || undefined,
      is_required: editedIsRequired,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Детали атрибута</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">ID</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                {attribute.id}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Тип</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                {attribute.type}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Названия</label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Русский</label>
                <input
                  type="text"
                  value={editedName}
                  onChange={(e) => setEditedName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Украинский</label>
                <input
                  type="text"
                  value={editedNameUk}
                  onChange={(e) => setEditedNameUk(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Единица измерения</label>
            <input
              type="text"
              value={editedUnit}
              onChange={(e) => setEditedUnit(e.target.value)}
              placeholder="например: кг, мм, Вт"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {attribute.synonyms && attribute.synonyms.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Синонимы</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                {attribute.synonyms.join(', ')}
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedIsRequired}
                onChange={(e) => setEditedIsRequired(e.target.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-2 focus:ring-red-500"
              />
              <span className="text-sm font-medium text-gray-700">Обязательный атрибут</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span className="font-medium">Создан:</span> {new Date(attribute.created_at).toLocaleString('ru-RU')}
            </div>
            <div>
              <span className="font-medium">Обновлен:</span> {new Date(attribute.updated_at).toLocaleString('ru-RU')}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Сохранить изменения
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
