import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type AttributeType = 'string' | 'number' | 'boolean' | 'enum' | 'text';
export type AttributeSource = 'sandi' | 'manual' | 'supplier';

export interface DictionaryAttribute {
  id: string;
  internal_category_id: string;
  name: string;
  name_uk?: string;
  type: string;
  unit?: string;
  is_required: boolean;
  synonyms?: string[];
  display_order: number;
  usage_categories: number;
  usage_products: number;
  created_at: string;
  updated_at: string;
}

export interface InboxItem {
  id: string;
  attribute_name: string;
  supplier_category_id: string;
  supplier_id: string;
  supplier_name?: string;
  category_name?: string;
  frequency_count: number;
  example_values?: string[];
  mapped_master_attribute_id?: string;
  mapped_master_attribute?: {
    id: string;
    name: string;
    type: string;
    unit?: string;
  };
}

interface AttributeStoreState {
  dictionary: DictionaryAttribute[];
  inbox: InboxItem[];
  loading: boolean;

  loadDictionary: () => Promise<void>;
  loadInbox: (supplierId?: string) => Promise<void>;
  getDictionaryAttribute: (id: string) => DictionaryAttribute | undefined;
  searchDictionary: (query: string) => DictionaryAttribute[];
  updateDictionaryAttribute: (id: string, updates: Partial<DictionaryAttribute>) => Promise<void>;
  createDictionaryAttribute: (attribute: {
    internal_category_id: string;
    name: string;
    name_uk?: string;
    type: string;
    unit?: string;
    is_required?: boolean;
    synonyms?: string[];
  }) => Promise<DictionaryAttribute | null>;

  getInboxItem: (id: string) => InboxItem | undefined;
  linkInboxToAttribute: (inboxId: string, attributeId: string) => Promise<void>;
  createAttributeFromInbox: (inboxId: string, attribute: {
    internal_category_id: string;
    name: string;
    name_uk?: string;
    type: string;
    unit?: string;
    synonyms?: string[];
  }) => Promise<void>;
}

export const useAttributeStore = create<AttributeStoreState>((set, get) => ({
  dictionary: [],
  inbox: [],
  loading: false,

  loadDictionary: async () => {
    set({ loading: true });

    const { data: attributes, error } = await supabase
      .from('master_attributes')
      .select('*')
      .order('name');

    if (error) {
      console.error('Error loading dictionary:', error);
      set({ loading: false });
      return;
    }

    const dictionaryWithStats = await Promise.all(
      (attributes || []).map(async (attr) => {
        const { count: categoriesCount } = await supabase
          .from('master_attributes')
          .select('*', { count: 'exact', head: true })
          .eq('id', attr.id);

        const { count: productsCount } = await supabase
          .from('supplier_products')
          .select('*', { count: 'exact', head: true });

        return {
          ...attr,
          usage_categories: categoriesCount || 0,
          usage_products: productsCount || 0,
        };
      })
    );

    set({ dictionary: dictionaryWithStats, loading: false });
  },

  loadInbox: async (supplierId?: string) => {
    set({ loading: true });

    let query = supabase
      .from('supplier_category_attribute_presence')
      .select(`
        id,
        attribute_name,
        supplier_category_id,
        supplier_id,
        frequency_count,
        example_values,
        mapped_master_attribute_id,
        mapped_master_attribute:master_attributes(id, name, type, unit),
        supplier_category:supplier_categories(id, name, name_ru, supplier:suppliers(name))
      `)
      .is('mapped_master_attribute_id', null)
      .order('frequency_count', { ascending: false });

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading inbox:', error);
      set({ loading: false });
      return;
    }

    const inbox = (data || []).map((item: any) => ({
      id: item.id,
      attribute_name: item.attribute_name,
      supplier_category_id: item.supplier_category_id,
      supplier_id: item.supplier_id,
      supplier_name: item.supplier_category?.supplier?.name,
      category_name: item.supplier_category?.name_ru || item.supplier_category?.name,
      frequency_count: item.frequency_count,
      example_values: item.example_values,
      mapped_master_attribute_id: item.mapped_master_attribute_id,
      mapped_master_attribute: item.mapped_master_attribute,
    }));

    set({ inbox, loading: false });
  },

  getDictionaryAttribute: (id: string) => {
    return get().dictionary.find(attr => attr.id === id);
  },

  searchDictionary: (query: string) => {
    const lowerQuery = query.toLowerCase();
    return get().dictionary.filter(attr =>
      attr.name.toLowerCase().includes(lowerQuery) ||
      attr.name_uk?.toLowerCase().includes(lowerQuery) ||
      (attr.synonyms || []).some(s => s.toLowerCase().includes(lowerQuery))
    );
  },

  updateDictionaryAttribute: async (id: string, updates: Partial<DictionaryAttribute>) => {
    const { error } = await supabase
      .from('master_attributes')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating attribute:', error);
      return;
    }

    set(state => ({
      dictionary: state.dictionary.map(attr =>
        attr.id === id
          ? { ...attr, ...updates, updated_at: new Date().toISOString() }
          : attr
      ),
    }));
  },

  createDictionaryAttribute: async (attribute) => {
    const { data, error } = await supabase
      .from('master_attributes')
      .insert({
        internal_category_id: attribute.internal_category_id,
        name: attribute.name,
        name_uk: attribute.name_uk,
        type: attribute.type,
        unit: attribute.unit,
        is_required: attribute.is_required || false,
        synonyms: attribute.synonyms || [],
        display_order: 999,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating attribute:', error);
      return null;
    }

    const newAttr: DictionaryAttribute = {
      ...data,
      usage_categories: 0,
      usage_products: 0,
    };

    set(state => ({
      dictionary: [...state.dictionary, newAttr],
    }));

    return newAttr;
  },

  getInboxItem: (id: string) => {
    return get().inbox.find(item => item.id === id);
  },

  linkInboxToAttribute: async (inboxId: string, attributeId: string) => {
    const { error } = await supabase
      .from('supplier_category_attribute_presence')
      .update({
        mapped_master_attribute_id: attributeId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboxId);

    if (error) {
      console.error('Error linking attribute:', error);
      return;
    }

    set(state => ({
      inbox: state.inbox.filter(item => item.id !== inboxId),
    }));
  },

  createAttributeFromInbox: async (inboxId, attribute) => {
    const newAttr = await get().createDictionaryAttribute(attribute);

    if (newAttr) {
      await get().linkInboxToAttribute(inboxId, newAttr.id);
    }
  },
}));
