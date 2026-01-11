import { useState } from 'react';
import { ChevronRight, ChevronDown, Package } from 'lucide-react';
import { CategoryNode } from '../../utils/preScanParser';

interface CategorySelectorProps {
  categories: CategoryNode[];
  selectedRefs: Set<string>;
  onToggle: (ref: string) => void;
  onToggleAll: (refs: string[], selected: boolean) => void;
}

interface CategoryItemProps {
  node: CategoryNode;
  level: number;
  selectedRefs: Set<string>;
  onToggle: (ref: string) => void;
  onToggleAll: (refs: string[], selected: boolean) => void;
}

function CategoryItem({ node, level, selectedRefs, onToggle, onToggleAll }: CategoryItemProps) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedRefs.has(node.ref);

  const getAllChildRefs = (category: CategoryNode): string[] => {
    const refs = [category.ref];
    category.children.forEach(child => {
      refs.push(...getAllChildRefs(child));
    });
    return refs;
  };

  const handleToggle = () => {
    if (hasChildren) {
      const allRefs = getAllChildRefs(node);
      onToggleAll(allRefs, !isSelected);
    } else {
      onToggle(node.ref);
    }
  };

  return (
    <div>
      <div
        className="flex items-center py-2 hover:bg-gray-50 rounded cursor-pointer"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="p-1 hover:bg-gray-200 rounded mr-1"
          >
            {expanded ? (
              <ChevronDown className="w-4 h-4 text-gray-600" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-600" />
            )}
          </button>
        ) : (
          <div className="w-6 mr-1" />
        )}

        <input
          type="checkbox"
          checked={isSelected}
          onChange={handleToggle}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mr-2"
        />

        <div className="flex items-center flex-1 min-w-0" onClick={handleToggle}>
          <Package className="w-4 h-4 text-gray-400 mr-2 flex-shrink-0" />
          <span className="text-sm text-gray-900 truncate">{node.name}</span>
          <span className="ml-2 text-xs text-gray-500 flex-shrink-0">
            ({node.totalProductCount})
          </span>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children.map(child => (
            <CategoryItem
              key={child.ref}
              node={child}
              level={level + 1}
              selectedRefs={selectedRefs}
              onToggle={onToggle}
              onToggleAll={onToggleAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function CategorySelector({ categories, selectedRefs, onToggle, onToggleAll }: CategorySelectorProps) {
  console.log('CategorySelector: Received categories', categories.length);
  if (categories.length > 0) {
    console.log('First category sample:', {
      ref: categories[0].ref,
      name: categories[0].name,
      productCount: categories[0].productCount,
      totalProductCount: categories[0].totalProductCount,
      childrenCount: categories[0].children.length
    });
  }

  const totalSelected = selectedRefs.size;
  const totalCategories = categories.reduce((sum, cat) => {
    const countCategories = (node: CategoryNode): number => {
      return 1 + node.children.reduce((s, c) => s + countCategories(c), 0);
    };
    return sum + countCategories(cat);
  }, 0);

  const selectAll = () => {
    const allRefs: string[] = [];
    const collectRefs = (node: CategoryNode) => {
      allRefs.push(node.ref);
      node.children.forEach(collectRefs);
    };
    categories.forEach(collectRefs);
    onToggleAll(allRefs, true);
  };

  const deselectAll = () => {
    const allRefs: string[] = [];
    const collectRefs = (node: CategoryNode) => {
      allRefs.push(node.ref);
      node.children.forEach(collectRefs);
    };
    categories.forEach(collectRefs);
    onToggleAll(allRefs, false);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Select Categories</h3>
          <div className="text-sm text-gray-600">
            {totalSelected} of {totalCategories} selected
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={selectAll}
            className="px-3 py-1 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors"
          >
            Select All
          </button>
          <button
            onClick={deselectAll}
            className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
          >
            Deselect All
          </button>
        </div>
      </div>

      <div className="p-4 max-h-96 overflow-y-auto">
        {categories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No categories found in the file
          </div>
        ) : (
          <div className="space-y-1">
            {categories.map(category => (
              <CategoryItem
                key={category.ref}
                node={category}
                level={0}
                selectedRefs={selectedRefs}
                onToggle={onToggle}
                onToggleAll={onToggleAll}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
