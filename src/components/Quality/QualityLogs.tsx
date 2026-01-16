import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  FileText,
  Filter,
  Calendar,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Package,
  Eye,
  X
} from 'lucide-react';

interface QualityLog {
  id: string;
  variant_id: string | null;
  product_id: string | null;
  change_type: string;
  old_value: string | null;
  new_value: string | null;
  reason: string;
  triggered_by: string;
  created_at: string;
  product?: {
    name_uk: string | null;
    name_ru: string | null;
    supplier_sku: string;
  };
}

interface LogGroup {
  key: string;
  label: string;
  count: number;
  logs: QualityLog[];
  isExpanded: boolean;
}

type GroupMode = 'type' | 'date' | 'trigger' | 'product' | 'none';

export function QualityLogs() {
  const [logs, setLogs] = useState<QualityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days');
  const [groupMode, setGroupMode] = useState<GroupMode>('type');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedLog, setSelectedLog] = useState<QualityLog | null>(null);

  useEffect(() => {
    loadLogs();
  }, [dateFilter]);

  const loadLogs = async () => {
    setLoading(true);

    let query = supabase
      .from('quality_change_logs')
      .select(`
        *,
        product:products(name_uk, name_ru, supplier_sku)
      `)
      .order('created_at', { ascending: false })
      .limit(500);

    if (dateFilter === '24hours') {
      const since = new Date();
      since.setHours(since.getHours() - 24);
      query = query.gte('created_at', since.toISOString());
    } else if (dateFilter === '7days') {
      const since = new Date();
      since.setDate(since.getDate() - 7);
      query = query.gte('created_at', since.toISOString());
    } else if (dateFilter === '30days') {
      const since = new Date();
      since.setDate(since.getDate() - 30);
      query = query.gte('created_at', since.toISOString());
    }

    const { data } = await query;

    if (data) {
      setLogs(data as any);
    }

    setLoading(false);
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'readiness') return log.change_type === 'readiness_status';
    if (filter === 'import') return log.triggered_by === 'import';
    return true;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const getChangeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      readiness_status: 'Readiness Status',
      quality_score: 'Quality Score',
      category_mapping: 'Category Mapping',
      price_update: 'Price Update',
      stock_update: 'Stock Update',
    };
    return labels[type] || type;
  };

  const getTriggeredByBadge = (triggeredBy: string) => {
    const styles: Record<string, string> = {
      import: 'bg-blue-100 text-blue-800',
      auto_quality_check: 'bg-green-100 text-green-800',
      manual: 'bg-gray-100 text-gray-800',
      category_mapping: 'bg-purple-100 text-purple-800',
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[triggeredBy] || 'bg-gray-100 text-gray-800'}`}>
        {triggeredBy}
      </span>
    );
  };

  const groupLogs = (logs: QualityLog[]): LogGroup[] => {
    if (groupMode === 'none') {
      return [{
        key: 'all',
        label: 'All Logs',
        count: logs.length,
        logs: logs,
        isExpanded: true
      }];
    }

    const groups = new Map<string, QualityLog[]>();

    logs.forEach(log => {
      let groupKey = '';
      let groupLabel = '';

      switch (groupMode) {
        case 'type':
          groupKey = log.change_type;
          groupLabel = getChangeTypeLabel(log.change_type);
          break;
        case 'date':
          const date = new Date(log.created_at);
          groupKey = date.toISOString().split('T')[0];
          groupLabel = date.toLocaleDateString('ru-RU', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
          break;
        case 'trigger':
          groupKey = log.triggered_by;
          groupLabel = log.triggered_by;
          break;
        case 'product':
          groupKey = log.product?.supplier_sku || 'unknown';
          groupLabel = `${log.product?.supplier_sku || 'Unknown'} - ${log.product?.name_ru || log.product?.name_uk || 'N/A'}`;
          break;
      }

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(log);
    });

    const result: LogGroup[] = Array.from(groups.entries()).map(([key, logs]) => ({
      key,
      label: groups.size === 1 ? 'All Logs' : key,
      count: logs.length,
      logs: logs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      isExpanded: expandedGroups.has(key)
    }));

    return result.sort((a, b) => b.count - a.count);
  };

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  const expandAll = () => {
    const allKeys = groupLogs(filteredLogs).map(g => g.key);
    setExpandedGroups(new Set(allKeys));
  };

  const collapseAll = () => {
    setExpandedGroups(new Set());
  };

  const getStats = () => {
    const total = filteredLogs.length;
    const byType = new Map<string, number>();
    const byTrigger = new Map<string, number>();

    filteredLogs.forEach(log => {
      byType.set(log.change_type, (byType.get(log.change_type) || 0) + 1);
      byTrigger.set(log.triggered_by, (byTrigger.get(log.triggered_by) || 0) + 1);
    });

    return { total, byType, byTrigger };
  };

  const stats = getStats();
  const groupedLogs = groupLogs(filteredLogs);

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <FileText className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Quality Change Logs</h2>
              <p className="text-sm text-gray-600 mt-1">
                Audit trail of automated quality changes with grouping and drill-down
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600 font-medium mb-1">Total Changes</div>
            <div className="text-2xl font-bold text-blue-900">{stats.total}</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600 font-medium mb-1">Change Types</div>
            <div className="text-2xl font-bold text-green-900">{stats.byType.size}</div>
          </div>
          <div className="bg-purple-50 rounded-lg p-4">
            <div className="text-sm text-purple-600 font-medium mb-1">Trigger Sources</div>
            <div className="text-2xl font-bold text-purple-900">{stats.byTrigger.size}</div>
          </div>
          <div className="bg-orange-50 rounded-lg p-4">
            <div className="text-sm text-orange-600 font-medium mb-1">Groups</div>
            <div className="text-2xl font-bold text-orange-900">{groupedLogs.length}</div>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap">
          <select
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="24hours">Last 24 hours</option>
            <option value="7days">Last 7 days</option>
            <option value="30days">Last 30 days</option>
            <option value="all">All time</option>
          </select>
          <select
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Changes</option>
            <option value="readiness">Readiness Changes</option>
            <option value="import">Import Triggered</option>
          </select>
          <select
            value={groupMode}
            onChange={e => setGroupMode(e.target.value as GroupMode)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="type">Group by Type</option>
            <option value="date">Group by Date</option>
            <option value="trigger">Group by Trigger</option>
            <option value="product">Group by Product</option>
            <option value="none">No Grouping</option>
          </select>
          {groupMode !== 'none' && (
            <>
              <button
                onClick={expandAll}
                className="px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md border border-blue-300"
              >
                Expand All
              </button>
              <button
                onClick={collapseAll}
                className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-md border border-gray-300"
              >
                Collapse All
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No quality changes recorded yet</p>
          </div>
        ) : (
          <div className="space-y-3">
            {groupedLogs.map(group => (
              <div key={group.key} className="border border-gray-200 rounded-lg overflow-hidden">
                <div
                  className="flex items-center justify-between p-4 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                  onClick={() => toggleGroup(group.key)}
                >
                  <div className="flex items-center gap-3">
                    {groupMode !== 'none' && (
                      group.isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-600" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                      )
                    )}
                    <div>
                      <div className="font-semibold text-gray-900">{group.label}</div>
                      {groupMode === 'date' && (
                        <div className="text-xs text-gray-500 mt-0.5">{group.key}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                      {group.count} {group.count === 1 ? 'change' : 'changes'}
                    </span>
                  </div>
                </div>

                {(group.isExpanded || groupMode === 'none') && (
                  <div className="p-4 space-y-3">
                    {group.logs.map(log => (
                      <div
                        key={log.id}
                        className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              {groupMode !== 'type' && (
                                <span className="font-medium text-gray-900 text-sm">
                                  {getChangeTypeLabel(log.change_type)}
                                </span>
                              )}
                              {groupMode !== 'trigger' && getTriggeredByBadge(log.triggered_by)}
                              {groupMode !== 'date' && (
                                <span className="text-xs text-gray-500">
                                  {formatDate(log.created_at)}
                                </span>
                              )}
                            </div>

                            {log.product && groupMode !== 'product' && (
                              <div className="text-sm text-gray-700 mb-1 flex items-center gap-2">
                                <Package className="w-3.5 h-3.5" />
                                <span className="font-mono text-xs">{log.product.supplier_sku}</span>
                                <span>-</span>
                                <span>{log.product.name_uk || log.product.name_ru || 'N/A'}</span>
                              </div>
                            )}

                            <div className="text-sm text-gray-600 mb-2">
                              {log.reason}
                            </div>

                            {log.old_value && log.new_value && (
                              <div className="flex items-center gap-3 text-xs bg-gray-50 p-2 rounded">
                                <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                                <span className="text-red-700 font-mono">
                                  {log.old_value}
                                </span>
                                <span className="text-gray-400">→</span>
                                <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                                <span className="text-green-700 font-mono">
                                  {log.new_value}
                                </span>
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="ml-3 p-2 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-gray-900">Log Details</h3>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Change Type</div>
                <div className="text-lg font-semibold text-gray-900">
                  {getChangeTypeLabel(selectedLog.change_type)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Triggered By</div>
                  <div>{getTriggeredByBadge(selectedLog.triggered_by)}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Timestamp</div>
                  <div className="text-sm text-gray-900">
                    {new Date(selectedLog.created_at).toLocaleString('ru-RU')}
                  </div>
                </div>
              </div>

              {selectedLog.product && (
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-2">Product</div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Package className="w-4 h-4 text-gray-600" />
                      <span className="font-mono text-sm font-semibold">
                        {selectedLog.product.supplier_sku}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">
                      {selectedLog.product.name_ru && (
                        <div>🇷🇺 {selectedLog.product.name_ru}</div>
                      )}
                      {selectedLog.product.name_uk && (
                        <div>🇺🇦 {selectedLog.product.name_uk}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-gray-500 mb-2">Reason</div>
                <div className="bg-blue-50 rounded-lg p-4 text-sm text-gray-900">
                  {selectedLog.reason}
                </div>
              </div>

              {selectedLog.old_value && selectedLog.new_value && (
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-2">Value Change</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-medium text-red-900">Old Value</span>
                      </div>
                      <div className="font-mono text-sm text-red-700">
                        {selectedLog.old_value}
                      </div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-900">New Value</span>
                      </div>
                      <div className="font-mono text-sm text-green-700">
                        {selectedLog.new_value}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                <div>
                  <span className="font-medium">Log ID:</span> {selectedLog.id}
                </div>
                {selectedLog.product_id && (
                  <div>
                    <span className="font-medium">Product ID:</span> {selectedLog.product_id}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
