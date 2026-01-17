import { useState } from 'react';
import { useAttributeStore, DictionaryAttribute, AttributeType, AttributeSource } from '../../stores/attributeStore';
import { Search, X, CheckCircle, AlertCircle, Package, Eye } from 'lucide-react';

interface DictionaryTabProps {
  initialSearch?: string;
}

export function DictionaryTab({ initialSearch = '' }: DictionaryTabProps) {
  const { dictionary, updateDictionaryAttribute } = useAttributeStore();
  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [sourceFilter, setSourceFilter] = useState<AttributeSource | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AttributeType | 'all'>('all');
  const [needsReviewFilter, setNeedsReviewFilter] = useState(false);
  const [selectedAttribute, setSelectedAttribute] = useState<DictionaryAttribute | null>(null);

  const filteredAttributes = dictionary.filter(attr => {
    if (sourceFilter !== 'all' && attr.source !== sourceFilter) return false;
    if (typeFilter !== 'all' && attr.type !== typeFilter) return false;
    if (needsReviewFilter && !attr.needs_review) return false;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        attr.labels.ru.toLowerCase().includes(query) ||
        attr.labels.ro?.toLowerCase().includes(query) ||
        attr.labels.en?.toLowerCase().includes(query) ||
        attr.code.toLowerCase().includes(query) ||
        attr.key.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const handleToggleReview = (attrId: string, currentValue: boolean) => {
    updateDictionaryAttribute(attrId, { needs_review: !currentValue });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="mb-4">
          <h2 className="text-xl font-bold text-gray-900">Global Attribute Dictionary</h2>
          <p className="text-sm text-gray-600 mt-1">
            Master list of all attributes without duplicates
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by label, code, key..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <select
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value as AttributeSource | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Sources</option>
            <option value="sandi">Sandi</option>
            <option value="manual">Manual</option>
            <option value="supplier">Supplier</option>
          </select>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as AttributeType | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="enum">Enum</option>
          </select>

          <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input
              type="checkbox"
              checked={needsReviewFilter}
              onChange={(e) => setNeedsReviewFilter(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Needs Review</span>
          </label>
        </div>

        <div className="text-sm text-gray-600">
          Showing {filteredAttributes.length} of {dictionary.length} attributes
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Label (RU)
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Key
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Review
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
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
                    {attr.labels.ru}
                    {attr.unit && <span className="text-gray-500 ml-1">({attr.unit})</span>}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-600">
                    {attr.code}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-blue-600">
                    {attr.key}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      {attr.type}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        attr.source === 'sandi'
                          ? 'bg-green-100 text-green-800'
                          : attr.source === 'manual'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {attr.source}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{attr.usage_categories}c</span>
                      <span className="text-xs">{attr.usage_products}p</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {attr.needs_review ? (
                      <button
                        onClick={() => handleToggleReview(attr.id, attr.needs_review)}
                        className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                        title="Mark as reviewed"
                      >
                        <AlertCircle className="w-3 h-3" />
                        Review
                      </button>
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => setSelectedAttribute(attr)}
                      className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      title="View Details"
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
              <p>No attributes found</p>
            </div>
          )}
        </div>
      </div>

      {selectedAttribute && (
        <AttributeDetailsModal
          attribute={selectedAttribute}
          onClose={() => setSelectedAttribute(null)}
          onUpdate={(updates) => {
            updateDictionaryAttribute(selectedAttribute.id, updates);
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
  const [editedLabels, setEditedLabels] = useState(attribute.labels);
  const [editedNeedsReview, setEditedNeedsReview] = useState(attribute.needs_review);

  const handleSave = () => {
    onUpdate({
      labels: editedLabels,
      needs_review: editedNeedsReview,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <h3 className="text-xl font-bold text-gray-900">Attribute Details</h3>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 mb-1">Key (Immutable)</label>
            <div className="px-3 py-2 bg-gray-50 rounded-lg font-mono text-sm text-blue-600 border border-gray-200">
              {attribute.key}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Code</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg font-mono text-sm text-gray-900 border border-gray-200">
                {attribute.code}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Type</label>
              <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                {attribute.type}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Labels</label>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Russian</label>
                <input
                  type="text"
                  value={editedLabels.ru}
                  onChange={(e) => setEditedLabels({ ...editedLabels, ru: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Romanian</label>
                <input
                  type="text"
                  value={editedLabels.ro || ''}
                  onChange={(e) => setEditedLabels({ ...editedLabels, ro: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">English</label>
                <input
                  type="text"
                  value={editedLabels.en || ''}
                  onChange={(e) => setEditedLabels({ ...editedLabels, en: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Source</label>
              <span
                className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium ${
                  attribute.source === 'sandi'
                    ? 'bg-green-100 text-green-800'
                    : attribute.source === 'manual'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-orange-100 text-orange-800'
                }`}
              >
                {attribute.source}
              </span>
            </div>
            {attribute.unit && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-1">Unit</label>
                <div className="px-3 py-2 bg-gray-50 rounded-lg text-sm text-gray-900 border border-gray-200">
                  {attribute.unit}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Usage Statistics</label>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-xs text-blue-600 mb-1">Categories</div>
                <div className="text-2xl font-bold text-blue-900">{attribute.usage_categories}</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-xs text-green-600 mb-1">Products</div>
                <div className="text-2xl font-bold text-green-900">{attribute.usage_products}</div>
              </div>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editedNeedsReview}
                onChange={(e) => setEditedNeedsReview(e.target.checked)}
                className="rounded border-gray-300 text-orange-600 focus:ring-2 focus:ring-orange-500"
              />
              <span className="text-sm font-medium text-gray-700">Needs Review</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
            <div>
              <span className="font-medium">Created:</span> {new Date(attribute.created_at).toLocaleString('ru-RU')}
            </div>
            <div>
              <span className="font-medium">Updated:</span> {new Date(attribute.updated_at).toLocaleString('ru-RU')}
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleSave}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Save Changes
            </button>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
