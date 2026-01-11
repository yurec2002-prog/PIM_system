import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Search,
  Download,
  Package,
  TrendingUp,
  Image as ImageIcon,
  DollarSign,
  Clock,
} from 'lucide-react';

interface ImportLog {
  id: string;
  sku: string;
  action: string;
  message: string;
  created_at: string;
}

interface ImportDetails {
  id: string;
  supplier: {
    name: string;
  };
  filename: string;
  status: string;
  products_count: number;
  products_created: number;
  products_updated: number;
  products_skipped: number;
  categories_created: number;
  categories_updated: number;
  brands_created: number;
  brands_updated: number;
  prices_updated: number;
  images_added: number;
  images_skipped: number;
  stock_updated: number;
  errors_count: number;
  selected_categories: string[];
  created_at: string;
  completed_at: string | null;
  error_message: string;
}

interface ImportDetailsProps {
  importId: string;
  onBack: () => void;
}

export function ImportDetailsView({ importId, onBack }: ImportDetailsProps) {
  const [details, setDetails] = useState<ImportDetails | null>(null);
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  useEffect(() => {
    loadImportDetails();
  }, [importId]);

  useEffect(() => {
    filterLogs();
  }, [logs, searchTerm, actionFilter]);

  const loadImportDetails = async () => {
    setLoading(true);

    const [detailsResult, logsResult] = await Promise.all([
      supabase
        .from('imports')
        .select('*, supplier:suppliers(name)')
        .eq('id', importId)
        .single(),
      supabase
        .from('import_logs')
        .select('*')
        .eq('import_id', importId)
        .order('created_at', { ascending: false }),
    ]);

    if (!detailsResult.error && detailsResult.data) {
      setDetails(detailsResult.data as any);
    }

    if (!logsResult.error && logsResult.data) {
      setLogs(logsResult.data);
    }

    setLoading(false);
  };

  const filterLogs = () => {
    let filtered = logs;

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.message.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (actionFilter !== 'all') {
      filtered = filtered.filter((log) => log.action === actionFilter);
    }

    setFilteredLogs(filtered);
  };

  const getErrorLogs = () => {
    return logs.filter((log) => log.action === 'error');
  };

  const exportToJSON = () => {
    const exportData = {
      import: details,
      logs: logs,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-${importId}-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToCSV = () => {
    const headers = ['SKU', 'Action', 'Message', 'Timestamp'];
    const rows = logs.map((log) => [
      log.sku,
      log.action,
      log.message.replace(/"/g, '""'),
      new Date(log.created_at).toISOString(),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-${importId}-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getDuration = () => {
    if (!details?.completed_at) return '-';
    const start = new Date(details.created_at).getTime();
    const end = new Date(details.completed_at).getTime();
    const seconds = Math.floor((end - start) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'created':
        return 'bg-green-100 text-green-800';
      case 'updated':
        return 'bg-blue-100 text-blue-800';
      case 'skipped':
        return 'bg-yellow-100 text-yellow-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || !details) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading import details...</p>
      </div>
    );
  }

  const errorLogs = getErrorLogs();

  return (
    <div>
      <div className="mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Import History
        </button>

        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Import Details</h1>
            <p className="text-gray-600 mt-1">
              {details.supplier?.name} - {details.filename}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              {formatDate(details.created_at)} • Duration: {getDuration()}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={exportToJSON}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export JSON
            </button>
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Products</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {details.products_count}
              </p>
            </div>
            <Package className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Created / Updated</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                <span className="text-green-600">{details.products_created}</span>
                {' / '}
                <span className="text-blue-600">{details.products_updated}</span>
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Images / Prices</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">
                {details.images_added} / {details.prices_updated}
              </p>
            </div>
            <ImageIcon className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Errors</p>
              <p className="text-2xl font-bold text-red-600 mt-1">
                {details.errors_count}
              </p>
            </div>
            <XCircle className="w-8 h-8 text-red-400" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600">Categories</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            <span className="text-green-600">{details.categories_created}</span>
            {' + '}
            <span className="text-blue-600">{details.categories_updated}</span>
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600">Brands</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            <span className="text-green-600">{details.brands_created}</span>
            {' + '}
            <span className="text-blue-600">{details.brands_updated}</span>
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600">Stock Updated</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {details.stock_updated}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <p className="text-xs text-gray-600">Skipped</p>
          <p className="text-lg font-semibold text-gray-900 mt-1">
            {details.products_skipped}
          </p>
        </div>
      </div>

      {errorLogs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-2">
                Top Errors ({errorLogs.length})
              </h3>
              <div className="space-y-2">
                {errorLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="text-sm text-red-800">
                    <span className="font-medium">{log.sku}:</span> {log.message}
                  </div>
                ))}
                {errorLogs.length > 5 && (
                  <p className="text-sm text-red-600 italic">
                    ...and {errorLogs.length - 5} more errors
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            SKU Import Logs ({filteredLogs.length})
          </h2>

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by SKU or message..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Actions</option>
              <option value="created">Created</option>
              <option value="updated">Updated</option>
              <option value="skipped">Skipped</option>
              <option value="error">Error</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No logs found matching your filters
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Message
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(log.created_at).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {log.sku}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getActionColor(
                          log.action
                        )}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {log.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
