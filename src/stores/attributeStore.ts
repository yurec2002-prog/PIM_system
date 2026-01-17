import { create } from 'zustand';
import { supabase } from '../lib/supabase';

export type AttributeType = 'string' | 'number' | 'boolean' | 'enum' | 'text';
export type AttributeSource = 'sandi' | 'manual' | 'supplier';
export type InboxStatus = 'new' | 'linked' | 'created' | 'ignored';

export interface GlobalAttribute {
  id: string;
  key: string;
  code: string;
  name: string;
  name_uk?: string;
  name_en?: string;
  type: string;
  source: AttributeSource;
  unit_kind?: string;
  default_unit?: string;
  needs_review: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
  aliases?: string[];
}

export interface InboxItem {
  id: string;
  supplier_id: string;
  supplier_category_id?: string;
  raw_name: string;
  raw_key?: string;
  normalized_key?: string;
  frequency: number;
  examples?: string[];
  status: InboxStatus;
  suggested_attribute_id?: string;
  resolved_attribute_id?: string;
  supplier_name?: string;
  category_name?: string;
  suggested_attribute?: {
    id: string;
    name: string;
    key: string;
    type: string;
  };
}

interface AttributeStoreState {
  dictionary: GlobalAttribute[];
  inbox: InboxItem[];
  loading: boolean;

  loadDictionary: () => Promise<void>;
  loadInbox: (supplierId?: string, status?: InboxStatus | 'all') => Promise<void>;
  getDictionaryAttribute: (id: string) => GlobalAttribute | undefined;
  searchDictionary: (query: string) => GlobalAttribute[];
  updateDictionaryAttribute: (id: string, updates: Partial<GlobalAttribute>) => Promise<void>;
  createDictionaryAttribute: (attribute: {
    name: string;
    name_uk?: string;
    name_en?: string;
    type: string;
    source: AttributeSource;
    unit_kind?: string;
    default_unit?: string;
    supplier_id?: string;
  }) => Promise<GlobalAttribute | null>;

  getInboxItem: (id: string) => InboxItem | undefined;
  linkInboxToAttribute: (inboxId: string, attributeId: string, createAlias?: boolean) => Promise<void>;
  createAttributeFromInbox: (inboxId: string, attribute: {
    name: string;
    name_uk?: string;
    type: string;
    unit_kind?: string;
    default_unit?: string;
  }, supplierId: string) => Promise<void>;
  ignoreInboxItem: (inboxId: string) => Promise<void>;
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
        const { count: usageCount } = await supabase
          .from('category_attributes')
          .select('*', { count: 'exact', head: true })
          .eq('attribute_id', attr.id);

        const { data: aliases } = await supabase
          .from('attribute_aliases')
          .select('alias_text')
          .eq('attribute_id', attr.id);

        return {
          ...attr,
          usage_count: usageCount || 0,
          aliases: aliases?.map(a => a.alias_text) || [],
        };
      })
    );

    set({ dictionary: dictionaryWithStats, loading: false });
  },

  loadInbox: async (supplierId?: string, status: InboxStatus | 'all' = 'new') => {
    set({ loading: true });

    let query = supabase
      .from('attribute_inbox')
      .select(`
        *,
        supplier:suppliers(name),
        supplier_category:supplier_categories(name, name_ru),
        suggested_attribute:master_attributes!attribute_inbox_suggested_attribute_id_fkey(id, name, key, type)
      `)
      .order('frequency', { ascending: false });

    if (supplierId) {
      query = query.eq('supplier_id', supplierId);
    }

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error loading inbox:', error);
      set({ loading: false });
      return;
    }

    const inbox = (data || []).map((item: any) => ({
      id: item.id,
      supplier_id: item.supplier_id,
      supplier_category_id: item.supplier_category_id,
      raw_name: item.raw_name,
      raw_key: item.raw_key,
      normalized_key: item.normalized_key,
      frequency: item.frequency,
      examples: item.examples,
      status: item.status,
      suggested_attribute_id: item.suggested_attribute_id,
      resolved_attribute_id: item.resolved_attribute_id,
      supplier_name: item.supplier?.name,
      category_name: item.supplier_category?.name_ru || item.supplier_category?.name,
      suggested_attribute: item.suggested_attribute,
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
      attr.key.toLowerCase().includes(lowerQuery) ||
      attr.code.toLowerCase().includes(lowerQuery) ||
      (attr.aliases || []).some(a => a.toLowerCase().includes(lowerQuery))
    );
  },

  updateDictionaryAttribute: async (id: string, updates: Partial<GlobalAttribute>) => {
    const { error } = await supabase
      .from('master_attributes')
      .update({
        name: updates.name,
        name_uk: updates.name_uk,
        name_en: updates.name_en,
        unit_kind: updates.unit_kind,
        default_unit: updates.default_unit,
        needs_review: updates.needs_review,
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
    const key = await supabase.rpc('generate_attribute_key', {
      p_source: attribute.source,
      p_name: attribute.name,
      p_supplier_id: attribute.supplier_id || null,
    });

    if (!key.data) {
      console.error('Failed to generate attribute key');
      return null;
    }

    const { data, error } = await supabase
      .from('master_attributes')
      .insert({
        key: key.data,
        code: attribute.name.toUpperCase().replace(/[^A-ZА-ЯЁ0-9]+/g, '_'),
        name: attribute.name,
        name_uk: attribute.name_uk,
        name_en: attribute.name_en,
        type: attribute.type,
        source: attribute.source,
        unit_kind: attribute.unit_kind,
        default_unit: attribute.default_unit,
        needs_review: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating attribute:', error);
      return null;
    }

    const newAttr: GlobalAttribute = {
      ...data,
      usage_count: 0,
      aliases: [],
    };

    set(state => ({
      dictionary: [...state.dictionary, newAttr],
    }));

    return newAttr;
  },

  getInboxItem: (id: string) => {
    return get().inbox.find(item => item.id === id);
  },

  linkInboxToAttribute: async (inboxId: string, attributeId: string, createAlias: boolean = true) => {
    const inboxItem = get().getInboxItem(inboxId);

    const { error } = await supabase
      .from('attribute_inbox')
      .update({
        resolved_attribute_id: attributeId,
        status: 'linked',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboxId);

    if (error) {
      console.error('Error linking attribute:', error);
      return;
    }

    if (createAlias && inboxItem) {
      await supabase
        .from('attribute_aliases')
        .insert({
          attribute_id: attributeId,
          alias_text: inboxItem.raw_name,
          supplier_id: inboxItem.supplier_id,
        });
    }

    await get().loadInbox();
  },

  createAttributeFromInbox: async (inboxId, attribute, supplierId) => {
    const newAttr = await get().createDictionaryAttribute({
      ...attribute,
      source: 'supplier',
      supplier_id: supplierId,
    });

    if (newAttr) {
      await get().linkInboxToAttribute(inboxId, newAttr.id, true);
    }
  },

  ignoreInboxItem: async (inboxId: string) => {
    const { error } = await supabase
      .from('attribute_inbox')
      .update({
        status: 'ignored',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inboxId);

    if (error) {
      console.error('Error ignoring inbox item:', error);
      return;
    }

    set(state => ({
      inbox: state.inbox.filter(item => item.id !== inboxId),
    }));
  },
}));
