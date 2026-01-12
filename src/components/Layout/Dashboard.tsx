import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Package, Upload, Link2, Download, LogOut, Menu, X, FolderTree, FileText, Settings, Activity, ListTree } from 'lucide-react';

interface DashboardProps {
  children: React.ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function Dashboard({ children, activeTab, onTabChange }: DashboardProps) {
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { id: 'import', name: 'Import', icon: Upload },
    { id: 'import-history', name: 'Import History', icon: FileText },
    { id: 'products', name: 'Products', icon: Package },
    { id: 'category-tree', name: 'Category Tree', icon: FolderTree },
    { id: 'mapping', name: 'Category Mapping', icon: Link2 },
    { id: 'attribute-schema', name: 'Attribute Schema', icon: ListTree },
    { id: 'quality-templates', name: 'Quality Templates', icon: Settings },
    { id: 'quality-logs', name: 'Quality Logs', icon: Activity },
    { id: 'export', name: 'Export', icon: Download },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <Package className="w-8 h-8 text-blue-600" />
                <span className="ml-3 text-xl font-bold text-gray-900">PIM System</span>
              </div>

              <div className="hidden md:ml-10 md:flex md:space-x-1">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => onTabChange(item.id)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center ${
                        activeTab === item.id
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden md:block text-sm text-gray-600">
                {user?.email}
              </div>
              <button
                onClick={() => signOut()}
                className="hidden md:flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onTabChange(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center px-3 py-2 rounded-lg text-base font-medium ${
                      activeTab === item.id
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </button>
                );
              })}
              <button
                onClick={() => signOut()}
                className="w-full flex items-center px-3 py-2 rounded-lg text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50"
              >
                <LogOut className="w-5 h-5 mr-3" />
                Sign Out
              </button>
            </div>
            <div className="px-5 py-3 border-t border-gray-200">
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>
        )}
      </nav>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
