import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { FileText, Filter, Calendar } from 'lucide-react';

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

export function QualityLogs() {
  const [logs, setLogs] = useState<QualityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('7days');

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

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <FileText className="w-6 h-6 text-blue-600 mr-3" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">Quality Change Logs</h2>
              <p className="text-sm text-gray-600 mt-1">
                Audit trail of automated quality changes
              </p>
            </div>
          </div>
          <div className="flex gap-3">
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
          </div>
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
            {filteredLogs.map(log => (
              <div
                key={log.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {getChangeTypeLabel(log.change_type)}
                      </span>
                      {getTriggeredByBadge(log.triggered_by)}
                      <span className="text-xs text-gray-500">
                        {formatDate(log.created_at)}
                      </span>
                    </div>

                    {log.product && (
                      <div className="text-sm text-gray-700 mb-1">
                        Product: {log.product.supplier_sku} - {log.product.name_uk || log.product.name_ru || 'N/A'}
                      </div>
                    )}

                    <div className="text-sm text-gray-600 mb-2">
                      {log.reason}
                    </div>

                    {log.old_value && log.new_value && (
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-red-600">
                          Old: {log.old_value}
                        </span>
                        <span className="text-gray-400">→</span>
                        <span className="text-green-600">
                          New: {log.new_value}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
