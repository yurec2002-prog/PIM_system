import { useState, useEffect } from 'react';
import { useAttributeStore, GlobalAttribute, AttributeSource } from '../../stores/attributeStore';
import { Search, X, Package, Eye, Loader, Tag, AlertCircle } from 'lucide-react';

interface DictionaryTabProps {
  initialSearch?: string;
}

export function DictionaryTab({ initialSearch = '' }: DictionaryTabProps) {
  const { dictionary, loading, loadDictionary, updateDictionaryAttribute } = useAttributeStore();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<AttributeSource | 'all'>('all');
  const [needsReviewFilter, setNeedsReviewFilter] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<GlobalAttribute | null>(null);

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
    if (sourceFilter !== 'all' && attr.source !== sourceFilter) return false;
    if (needsReviewFilter && !attr.needs_review) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        attr.name.toLowerCase().includes(query) ||
        attr.name_uk?.toLowerCase().includes(query) ||
        attr.key.toLowerCase().includes(query) ||
        attr.code.toLowerCase().includes(query) ||
        (attr.aliases || []).some(a => a.toLowerCase().includes(query))
      );
    }

    return true;
  });

  if (loading && dictionary.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-2" />
          <p className="text-gray-600">Загрузка глобального справочника...</p>
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
            Единый мастер-список всех атрибутов без дублей
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, key, code..."
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

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as AttributeSource | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Все источники</option>
            <option value="sandi">Sandi</option>
            <option value="manual">Manual</option>
            <option value="supplier">Supplier</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={needsReviewFilter}
              onChange={(e) => setNeedsReviewFilter(e.target.checked)}
              className="rounded border-gray-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
            />
            <span className="text-sm text-gray-700">Требует ревью</span>
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
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Тип
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Unit
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Статус
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
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{attr.name}</div>
                    {attr.name_uk && (
                      <div className="text-xs text-gray-500">{attr.name_uk}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                      {attr.key}
                    </code>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {attr.code}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {attr.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      attr.source === 'sandi' ? 'bg-purple-100 text-purple-800' :
                      attr.source === 'manual' ? 'bg-green-100 text-green-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      {attr.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {attr.unit_kind ? (
                      <div>
                        <div className="font-medium">{attr.unit_kind}</div>
                        {attr.default_unit && (
                          <div className="text-xs text-gray-500">{attr.default_unit}</div>
                        )}
                      </div>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-600">
                      <Package className="w-3 h-3" />
                      {attr.usage_count}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {attr.needs_review && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">
                        <AlertCircle className="w-3 h-3" />
                        Review
                      </span>
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
  attribute: GlobalAttribute;
  onClose: () => void;
  onUpdate: (updates: Partial<GlobalAttribute>) => void;
}

function AttributeDetailsModal({ attribute, onClose, onUpdate }: AttributeDetailsModalProps) {
  const [editedName, setEditedName] = useState(attribute.name);
  const [editedNameUk, setEditedNameUk] = useState(attribute.name_uk || '');
  const [editedNameEn, setEditedNameEn] = useState(attribute.name_en || '');
  const [editedUnitKind, setEditedUnitKind] = useState(attribute.unit_kind || '');
  const [editedDefaultUnit, setEditedDefaultUnit] = useState(attribute.default_unit || '');
  const [editedNeedsReview, setEditedNeedsReview] = useState(attribute.needs_review);

  const handleSave = () => {
    onUpdate({
      name: editedName,
      name_uk: editedNameUk || undefined,
      name_en: editedNameEn || undefined,
      unit_kind: editedUnitKind || undefined,
      default_unit: editedDefaultUnit || undefined,
      needs_review: editedNeedsReview,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Детали глобального атрибута</h3>
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
              <label className="block text-sm font-medium text-gray-500 mb-1">Key (read-only)</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm font-mono text-gray-900 border border-gray-200">
                {attribute.key}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Code</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                {attribute.code}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Type</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                {attribute.type}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Source</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                {attribute.source}
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
              <div>
                <label className="block text-xs text-gray-500 mb-1">Английский (optional)</label>
                <input
                  type="text"
                  value={editedNameEn}
                  onChange={(e) => setEditedNameEn(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Unit Kind</label>
              <input
                type="text"
                value={editedUnitKind}
                onChange={(e) => setEditedUnitKind(e.target.value)}
                placeholder="например: weight, length, power"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Default Unit</label>
              <input
                type="text"
                value={editedDefaultUnit}
                onChange={(e) => setEditedDefaultUnit(e.target.value)}
                placeholder="например: кг, мм, Вт"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {attribute.aliases && attribute.aliases.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aliases (синонимы)</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                <div className="flex flex-wrap gap-2">
                  {attribute.aliases.map((alias, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      <Tag className="w-3 h-3" />
                      {alias}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedNeedsReview}
                onChange={(e) => setEditedNeedsReview(e.target.checked)}
                className="rounded border-gray-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Требует ревью</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 pt-4 border-t">
            <div>
              <span className="font-medium">Использование:</span> {attribute.usage_count} категорий
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
