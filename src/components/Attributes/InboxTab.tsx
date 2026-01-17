import { useState } from 'react';
import {
  useAttributeStore,
  InboxItem,
  InboxStatus,
  AttributeType,
  AttributeSource,
} from '../../stores/attributeStore';
import { Inbox, Link2, Plus, XCircle, Search, CheckCircle, AlertCircle, X } from 'lucide-react';

interface InboxTabProps {
  initialStatusFilter?: InboxStatus | 'all';
}

export function InboxTab({ initialStatusFilter = 'new' }: InboxTabProps) {
  const {
    inbox,
    dictionary,
    searchDictionary,
    linkInboxToAttribute,
    createAttributeFromInbox,
    ignoreInboxItem,
    getDictionaryAttribute,
  } = useAttributeStore();

  const [statusFilter, setStatusFilter] = useState<InboxStatus | 'all'>(initialStatusFilter);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [actionMode, setActionMode] = useState<'link' | 'create' | null>(null);

  const filteredInbox = inbox.filter(item => {
    if (statusFilter === 'all') return true;
    return item.status === statusFilter;
  });

  const statusCounts = {
    all: inbox.length,
    new: inbox.filter(i => i.status === 'new').length,
    linked: inbox.filter(i => i.status === 'linked').length,
    created: inbox.filter(i => i.status === 'created').length,
    ignored: inbox.filter(i => i.status === 'ignored').length,
  };

  const handleLink = (item: InboxItem) => {
    setSelectedItem(item);
    setActionMode('link');
  };

  const handleCreate = (item: InboxItem) => {
    setSelectedItem(item);
    setActionMode('create');
  };

  const handleIgnore = (item: InboxItem) => {
    if (confirm(`Ignore "${item.raw_name}"?`)) {
      ignoreInboxItem(item.id);
    }
  };

  const closeDialog = () => {
    setSelectedItem(null);
    setActionMode(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b border-gray-200 bg-white">
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Inbox className="w-6 h-6 text-orange-600" />
            <h2 className="text-xl font-bold text-gray-900">Attribute Inbox</h2>
          </div>
          <p className="text-sm text-gray-600">
            Review and process unmapped attributes from imports
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All ({statusCounts.all})
          </button>
          <button
            onClick={() => setStatusFilter('new')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'new'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
            }`}
          >
            New ({statusCounts.new})
          </button>
          <button
            onClick={() => setStatusFilter('linked')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'linked'
                ? 'bg-blue-600 text-white'
                : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
            }`}
          >
            Linked ({statusCounts.linked})
          </button>
          <button
            onClick={() => setStatusFilter('created')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'created'
                ? 'bg-green-600 text-white'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            Created ({statusCounts.created})
          </button>
          <button
            onClick={() => setStatusFilter('ignored')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === 'ignored'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Ignored ({statusCounts.ignored})
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Raw Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Supplier
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Seen Count
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInbox.map((item) => {
                const suggestedAttr = item.suggested_match_id
                  ? getDictionaryAttribute(item.suggested_match_id)
                  : undefined;
                const linkedAttr = item.linked_attribute_id
                  ? getDictionaryAttribute(item.linked_attribute_id)
                  : undefined;

                return (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">{item.raw_name}</div>
                      {suggestedAttr && item.status === 'new' && (
                        <div className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          Suggested: {suggestedAttr.labels.ru}
                        </div>
                      )}
                      {linkedAttr && (
                        <div className="text-xs text-green-600 mt-1 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          Linked to: {linkedAttr.labels.ru}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.supplier_name || 'N/A'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                        {item.seen_count}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          item.status === 'new'
                            ? 'bg-orange-100 text-orange-800'
                            : item.status === 'linked'
                            ? 'bg-blue-100 text-blue-800'
                            : item.status === 'created'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {new Date(item.last_seen).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-3">
                      {item.status === 'new' && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleLink(item)}
                            className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                            title="Link to existing attribute"
                          >
                            <Link2 className="w-3 h-3" />
                            Link
                          </button>
                          <button
                            onClick={() => handleCreate(item)}
                            className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs"
                            title="Create new attribute"
                          >
                            <Plus className="w-3 h-3" />
                            Create
                          </button>
                          <button
                            onClick={() => handleIgnore(item)}
                            className="flex items-center gap-1 px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600 text-xs"
                            title="Ignore this item"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredInbox.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Inbox className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No items in this status</p>
            </div>
          )}
        </div>
      </div>

      {actionMode === 'link' && selectedItem && (
        <LinkAttributeDialog
          item={selectedItem}
          dictionary={dictionary}
          searchDictionary={searchDictionary}
          onLink={(attrId) => {
            linkInboxToAttribute(selectedItem.id, attrId);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}

      {actionMode === 'create' && selectedItem && (
        <CreateAttributeDialog
          item={selectedItem}
          onCreate={(attribute) => {
            createAttributeFromInbox(selectedItem.id, attribute);
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

  const results = searchQuery ? searchDictionary(searchQuery) : dictionary.slice(0, 10);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Link to Existing Attribute</h3>
            <p className="text-sm text-gray-600 mt-1">
              Linking: <span className="font-medium">{item.raw_name}</span>
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
              placeholder="Search dictionary by label, code, or key..."
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
                    <div className="font-medium text-gray-900">{attr.labels.ru}</div>
                    <div className="text-xs font-mono text-gray-500 mt-1">{attr.key}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {attr.type}
                      </span>
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
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={() => selectedAttrId && onLink(selectedAttrId)}
              disabled={!selectedAttrId}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Link Attribute
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

interface CreateAttributeDialogProps {
  item: InboxItem;
  onCreate: (attribute: {
    key: string;
    code: string;
    labels: { ru: string; ro?: string; en?: string };
    type: AttributeType;
    source: AttributeSource;
    unit?: string;
    needs_review: boolean;
  }) => void;
  onClose: () => void;
}

function CreateAttributeDialog({ item, onCreate, onClose }: CreateAttributeDialogProps) {
  const [code, setCode] = useState(
    item.raw_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
  );
  const [labelRu, setLabelRu] = useState(item.raw_name);
  const [labelRo, setLabelRo] = useState('');
  const [labelEn, setLabelEn] = useState('');
  const [type, setType] = useState<AttributeType>('string');
  const [source, setSource] = useState<AttributeSource>('supplier');
  const [unit, setUnit] = useState('');

  const handleCreate = () => {
    if (!code || !labelRu) {
      alert('Code and Russian label are required');
      return;
    }

    const key = `${source}:${code}`;

    onCreate({
      key,
      code,
      labels: {
        ru: labelRu,
        ro: labelRo || undefined,
        en: labelEn || undefined,
      },
      type,
      source,
      unit: unit || undefined,
      needs_review: true,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-gray-900">Create New Attribute</h3>
            <p className="text-sm text-gray-600 mt-1">
              From: <span className="font-medium">{item.raw_name}</span>
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
              Code <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 font-mono"
              placeholder="e.g. weight, length, power"
            />
            <p className="text-xs text-gray-500 mt-1">
              Key will be: <span className="font-mono text-blue-600">{source}:{code}</span>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Label (Russian) <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={labelRu}
              onChange={(e) => setLabelRu(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label (Romanian)</label>
              <input
                type="text"
                value={labelRo}
                onChange={(e) => setLabelRo(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Label (English)</label>
              <input
                type="text"
                value={labelEn}
                onChange={(e) => setLabelEn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AttributeType)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="string">String</option>
                <option value="number">Number</option>
                <option value="boolean">Boolean</option>
                <option value="enum">Enum</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as AttributeSource)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="supplier">Supplier</option>
                <option value="manual">Manual</option>
                <option value="sandi">Sandi</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit (Optional)</label>
            <input
              type="text"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. kg, mm, W, bar"
            />
          </div>

          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                New attribute will be marked as "needs review" and added to the dictionary.
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCreate}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Create Attribute
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
